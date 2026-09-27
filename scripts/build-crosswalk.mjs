#!/usr/bin/env node
// Builds area-overlap crosswalks between every pair of imported ward schemes
// (docs/plans/02 §1, "Crosswalk (in-house)").
//
//   npm run build-crosswalk
//
// Writes data/wards/crosswalk/<from>__<to>.json: one row per overlapping pair,
// with the share of each ward the overlap covers. Old budget documents name
// BBMP 198-ward numbers; this is how they're found under today's GBA wards.

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir, SCHEMES, loadWards, crosswalk } from "./lib/geo.mjs";

const available = SCHEMES.filter((s) => loadWards(s));
if (available.length < 2) {
  console.log(`Need at least two imported ward schemes; found: ${available.join(", ") || "none"}.`);
  process.exit(0);
}

const outDir = join(dataDir, "wards", "crosswalk");
mkdirSync(outDir, { recursive: true });
for (let i = 0; i < available.length; i++) {
  for (let j = i + 1; j < available.length; j++) {
    const [from, to] = [available[i], available[j]];
    const rows = crosswalk(loadWards(from), loadWards(to));
    const file = join(outDir, `${from}__${to}.json`);
    writeFileSync(
      file,
      JSON.stringify(
        {
          from,
          to,
          method: "area overlap; pairs where the overlap is under 1% of both wards are dropped as digitising noise",
          rows,
        },
        null,
        1
      ) + "\n"
    );
    console.log(`${from} → ${to}: ${rows.length} overlapping pairs`);
  }
}
