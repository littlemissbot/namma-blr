#!/usr/bin/env node
// Build-time validator (spec §8.4). Fails the build on:
//   - a money_entry with no source_id
//   - a source with no retrieved_on
//   - a project with no verified_on
//   - a confidence value inconsistent with its doc_type
// JSON Schema checks (shape/enum/type) run first via Ajv, then the
// cross-file rules above run against the loaded, valid records.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(root, "data");
const schemaDir = join(root, "schema");

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const ENTITIES = [
  { name: "project", dir: "projects", schema: "project.schema.json" },
  { name: "money_entry", dir: "money_entries", schema: "money_entry.schema.json" },
  { name: "event", dir: "events", schema: "event.schema.json" },
  { name: "source", dir: "sources", schema: "source.schema.json" },
];

// doc_type -> confidence values it may justify (spec §3.4).
const DOC_TYPE_CONFIDENCE = {
  budget_document: ["high"],
  audit_report: ["high"],
  assembly_reply: ["high"],
  rti_response: ["high"],
  agency_report: ["high", "medium"],
  news: ["medium"],
  press_release: ["low"],
};

/** @returns {{file: string, record: unknown}[]} */
function loadJsonDir(dirPath) {
  if (!existsSync(dirPath)) return [];
  return readdirSync(dirPath)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const file = join(dirPath, f);
      try {
        return { file, record: JSON.parse(readFileSync(file, "utf8")) };
      } catch (err) {
        return { file, record: null, parseError: err.message };
      }
    });
}

let errors = [];

const records = {};
for (const entity of ENTITIES) {
  const schemaPath = join(schemaDir, entity.schema);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const validateFn = ajv.compile(schema);

  const items = loadJsonDir(join(dataDir, entity.dir));
  const valid = [];
  for (const { file, record, parseError } of items) {
    if (parseError) {
      errors.push(`[${entity.name}] ${file}: invalid JSON (${parseError})`);
      continue;
    }
    if (!validateFn(record)) {
      for (const err of validateFn.errors) {
        errors.push(`[${entity.name}] ${file}: ${err.instancePath || "/"} ${err.message}`);
      }
      continue;
    }
    valid.push({ file, record });
  }
  records[entity.name] = valid;
}

// Cross-file rule: every money_entry.source_id must resolve, spec §8.4.
const sourceIds = new Set(records.source.map(({ record }) => record.id));
for (const { file, record } of records.money_entry) {
  if (!record.source_id) {
    errors.push(`[money_entry] ${file}: missing source_id`);
  } else if (!sourceIds.has(record.source_id)) {
    errors.push(`[money_entry] ${file}: source_id "${record.source_id}" not found in data/sources`);
  }
}

// Cross-file rule: every event.source_id must resolve too (same P1 principle).
for (const { file, record } of records.event) {
  if (!record.source_id) {
    errors.push(`[event] ${file}: missing source_id`);
  } else if (!sourceIds.has(record.source_id)) {
    errors.push(`[event] ${file}: source_id "${record.source_id}" not found in data/sources`);
  }
}

// Rule: every source needs retrieved_on (schema already requires it; this
// catches empty-string/whitespace values that pass the format check).
for (const { file, record } of records.source) {
  if (!record.retrieved_on || !record.retrieved_on.trim()) {
    errors.push(`[source] ${file}: missing retrieved_on`);
  }
}

// Rule: every project needs verified_on (schema already requires it; same
// belt-and-braces check as above).
for (const { file, record } of records.project) {
  if (!record.verified_on || !record.verified_on.trim()) {
    errors.push(`[project] ${file}: missing verified_on`);
  }
}

// Rule: confidence must be consistent with doc_type, but confidence lives on
// the project/money_entry/event, sourced from a source record. We check the
// project's confidence against the doc_type of every source it cites via its
// money_entry and event rows — the project's stated confidence may not
// exceed the best doc_type backing it.
const projectSources = new Map(); // project_id -> Set(doc_type)
const sourceById = new Map(records.source.map(({ record }) => [record.id, record]));
for (const { record } of [...records.money_entry, ...records.event]) {
  const src = sourceById.get(record.source_id);
  if (!src) continue;
  if (!projectSources.has(record.project_id)) projectSources.set(record.project_id, new Set());
  projectSources.get(record.project_id).add(src.doc_type);
}

for (const { file, record } of records.project) {
  const docTypes = projectSources.get(record.id);
  if (!docTypes || docTypes.size === 0) continue; // no money/event rows yet — nothing to check
  const allowed = new Set([...docTypes].flatMap((dt) => DOC_TYPE_CONFIDENCE[dt] ?? []));
  if (allowed.size > 0 && !allowed.has(record.confidence)) {
    errors.push(
      `[project] ${file}: confidence "${record.confidence}" is not supported by any cited source's doc_type (${[...docTypes].join(", ")})`
    );
  }
}

if (errors.length > 0) {
  console.error(`\nValidation failed: ${errors.length} error(s)\n`);
  for (const e of errors) console.error(" - " + e);
  console.error("");
  process.exit(1);
}

const counts = ENTITIES.map((e) => `${records[e.name].length} ${e.name}`).join(", ");
console.log(`Validation passed (${counts}).`);
