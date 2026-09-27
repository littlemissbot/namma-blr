// Every enum value the schemas allow must have a display label in
// src/i18n/en.json, so adding a status or event type can't ship a blank label.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const en = JSON.parse(readFileSync(new URL("../src/i18n/en.json", import.meta.url), "utf8")).labels;
const schema = (name) => JSON.parse(readFileSync(new URL(`../schema/${name}`, import.meta.url), "utf8")).properties;
const project = schema("project.schema.json");
const money = schema("money_entry.schema.json");

const groups = {
  status: project.status.enum,
  category: project.category.enum,
  confidence: project.confidence.enum,
  corporation: project.corporation.enum,
  kind: money.kind.enum,
  kind_short: money.kind.enum,
  funder: money.funder.enum,
  event_type: schema("event.schema.json").type.enum,
  doc_type: schema("source.schema.json").doc_type.enum,
};

for (const [group, values] of Object.entries(groups)) {
  test(`labels.${group} covers every schema value`, () => {
    const missing = values.filter((v) => typeof en[group]?.[v] !== "string");
    assert.deepEqual(missing, [], `add these to src/i18n/en.json labels.${group}`);
  });
}
