#!/usr/bin/env node
// Creates a new source, money_entry or event file by asking questions, so
// contributors don't have to hand-write JSON (CONTRIBUTING.md).
//
//   npm run new -- source
//   npm run new -- money
//   npm run new -- event
//
// Every answer is checked against the JSON Schema before anything is written.
// Press Enter to accept a [default]; optional fields can be left blank.

import { createInterface } from "node:readline/promises";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { stringifyRecord } from "./lib/json-style.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(root, "data");
const schema = (name) => JSON.parse(readFileSync(join(root, "schema", `${name}.schema.json`), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const load = (dir) =>
  readdirSync(join(dataDir, dir))
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dataDir, dir, f), "utf8")));

const today = () => new Date().toISOString().slice(0, 10);
const fiscalYearOf = (date) => {
  const d = new Date(date);
  const start = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};

// Answers come from the terminal, or from piped stdin (one per line) for scripting and tests.
const piped = !process.stdin.isTTY;
const pipedLines = piped ? readFileSync(0, "utf8").split("\n") : null;
const rl = piped ? null : createInterface({ input: process.stdin, output: process.stdout });

async function ask(question, { def, optional = false, choices, check } = {}) {
  const hint = choices ? ` (${choices.join(" / ")})` : "";
  const suffix = def !== undefined ? ` [${def}]` : optional ? " (optional)" : "";
  for (;;) {
    let answer;
    if (piped) {
      if (pipedLines.length === 0) throw new Error(`ran out of input at "${question}"`);
      answer = pipedLines.shift().trim();
      process.stdout.write(`${question}${hint}${suffix}: ${answer}\n`);
    } else {
      answer = (await rl.question(`${question}${hint}${suffix}: `)).trim();
    }
    if (answer === "" && def !== undefined) answer = String(def);
    if (answer === "" && optional) return undefined;
    if (answer === "") {
      console.log("  This one is required.");
      if (piped) throw new Error(`missing required answer for "${question}"`);
      continue;
    }
    if (choices && !choices.includes(answer)) {
      console.log(`  Choose one of: ${choices.join(", ")}`);
      if (piped) throw new Error(`invalid choice "${answer}" for "${question}"`);
      continue;
    }
    const problem = check?.(answer);
    if (problem) {
      console.log(`  ${problem}`);
      if (piped) throw new Error(`${problem} ("${question}")`);
      continue;
    }
    return answer;
  }
}

const isDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s)) ? null : "Use YYYY-MM-DD.");
const isUrl = (s) => {
  try {
    new URL(s);
    return null;
  } catch {
    return "That isn't a full URL (include https://).";
  }
};

function projectCheck(projects) {
  const ids = new Set(projects.map((p) => p.id));
  return (id) => {
    if (ids.has(id)) return null;
    const near = [...ids].filter((x) => x.includes(id) || id.includes(x)).slice(0, 5);
    return `No project "${id}".${near.length ? ` Did you mean: ${near.join(", ")}?` : " See data/projects/."}`;
  };
}

function sourceCheck(sources) {
  const ids = new Set(sources.map((s) => s.id));
  return (id) => (ids.has(id) ? null : `No source "${id}". Add it first with \`npm run new -- source\`.`);
}

/** A file name that doesn't collide: base.json, base-2.json, ... */
function freePath(dir, base) {
  let path = join(dataDir, dir, `${base}.json`);
  for (let n = 2; existsSync(path); n++) path = join(dataDir, dir, `${base}-${n}.json`);
  return path;
}

function save(schemaName, dir, path, record) {
  const validate = ajv.compile(schema(schemaName));
  if (!validate(record)) {
    for (const e of validate.errors) console.error(`  ${e.instancePath || "/"} ${e.message}`);
    throw new Error("record doesn't match the schema; nothing was written");
  }
  writeFileSync(path, stringifyRecord(record) + "\n");
  console.log(`\nWrote ${path.slice(root.length + 1)}`);
}

async function newSource() {
  const sources = load("sources");
  const nextId = `S${Math.max(0, ...sources.map((s) => Number(s.id.slice(1)))) + 1}`;
  const docTypes = schema("source").properties.doc_type.enum;
  const record = {
    id: nextId,
    title: await ask("Title of the document or article"),
    publisher: await ask("Publisher (e.g. Finance Department, Karnataka; Deccan Herald)"),
    doc_type: await ask("Document type", { choices: docTypes }),
    url: await ask("URL", { check: isUrl }),
    page_ref: await ask("Page or section, for PDFs", { optional: true }),
    published_on: await ask("Published on (YYYY-MM-DD)", { optional: true, check: isDate }),
    retrieved_on: await ask("Retrieved on", { def: today(), check: isDate }),
    archive_url: (await ask("Wayback archive URL (blank: `npm run archive-sources` fills it later)", { optional: true, check: isUrl })) ?? null,
  };
  save("source", "sources", join(dataDir, "sources", `${nextId}.json`), record);
  console.log(`Cite it as source_id "${nextId}".`);
}

async function newMoney() {
  const projects = load("projects");
  const props = schema("money_entry").properties;
  const project_id = await ask("Project id", { check: projectCheck(projects) });
  const kind = await ask("Kind of figure (a budget speech figure is \"announced\", not \"sanctioned\")", { choices: props.kind.enum });
  const amount = await ask("Amount in ₹ crore", { check: (s) => (Number.isFinite(Number(s)) && Number(s) >= 0 ? null : "Enter a number, e.g. 1234.5") });
  const as_of = await ask("As of: when this figure was true (YYYY-MM-DD)", { check: isDate });
  const fiscal_year = await ask("Fiscal year", { def: fiscalYearOf(as_of), check: (s) => (/^\d{4}-\d{2}$/.test(s) ? null : "Use e.g. 2025-26.") });
  const funder = await ask("Funder", { choices: props.funder.enum });
  const funder_detail = await ask("Funder detail (e.g. JICA) or context", { optional: true });
  const budget_head = await ask("Budget head / line item as printed", { optional: true });
  const source_id = await ask("Source id (e.g. S12)", { check: sourceCheck(load("sources")) });
  const comparable = await ask("Comparable to earlier figures for this project? (n if the definition changed)", { def: "y", choices: ["y", "n"] });
  const record = {
    project_id,
    fiscal_year,
    kind,
    amount_cr: Number(amount),
    funder,
    funder_detail,
    budget_head,
    source_id,
    as_of,
    comparable_to_prior: comparable === "y",
  };
  save("money_entry", "money_entries", freePath("money_entries", `${project_id}-${kind.replace(/_/g, "-")}-${fiscal_year.slice(0, 4)}`), record);
}

async function newEvent() {
  const projects = load("projects");
  const types = schema("event").properties.type.enum;
  const project_id = await ask("Project id", { check: projectCheck(projects) });
  const date = await ask("Date of the development (YYYY-MM-DD)", { check: isDate });
  const type = await ask("Type", { choices: types });
  const summary = await ask("One factual sentence, no reasons or blame (P5)");
  let previous_deadline;
  let new_deadline;
  if (type === "deadline_revised") {
    new_deadline = await ask("New deadline (YYYY-MM-DD; blank if the source gives no exact date)", { optional: true, check: isDate });
    previous_deadline = await ask("Previous deadline (YYYY-MM-DD)", { optional: true, check: isDate });
  }
  const source_id = await ask("Source id (e.g. S12)", { check: sourceCheck(load("sources")) });
  const record = { project_id, date, type, summary, previous_deadline, new_deadline, source_id };
  save("event", "events", freePath("events", `${project_id}-${type.replace(/_/g, "-")}-${date.slice(0, 4)}`), record);
}

const kinds = { source: newSource, money: newMoney, event: newEvent };
const which = process.argv[2];
if (!kinds[which]) {
  console.error("usage: npm run new -- <source|money|event>");
  process.exit(1);
}
try {
  await kinds[which]();
  console.log("Next: update the project's verified_on, then run `npm run validate`.");
} catch (err) {
  console.error(`\n${err.message}`);
  process.exitCode = 1;
} finally {
  rl?.close();
}
