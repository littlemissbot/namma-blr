#!/usr/bin/env node
// Builds area-overlap crosswalks between every pair of imported ward schemes
// (docs/plans/02 §1, "Crosswalk (in-house)").
//
//   npm run build-crosswalk
//
// Writes data/wards/crosswalk/<from>__<to>.json: one row per overlapping pair,
// with the share of each ward the overlap covers. Old budget documents name
// BBMP 198-ward numbers; this is how they're found under today's GBA wards.

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { root, dataDir, SCHEMES, loadWards, crosswalk } from "./lib/geo.mjs";

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

// For the map: which old BBMP wards make up each current GBA ward, so a ward
// card can say "formerly BBMP ward 150 (Bellanduru)". Old documents use old numbers.
if (available.includes("gba2025")) {
  const MIN_SHARE = 0.1; // ignore old wards covering under 10% of the GBA ward
  const names = Object.fromEntries(
    available.flatMap((s) => loadWards(s).features.map((f) => [f.properties.code, f.properties.name]))
  );
  const lookup = {};
  for (const old of available.filter((s) => s !== "gba2025")) {
    const { rows } = JSON.parse(readFileSync(join(outDir, `${old}__gba2025.json`), "utf8"));
    for (const r of rows) {
      if (r.share_of_to < MIN_SHARE) continue;
      ((lookup[r.to] ??= {})[old] ??= []).push([r.from, names[r.from] ?? null, r.share_of_to]);
    }
  }
  for (const byScheme of Object.values(lookup)) for (const list of Object.values(byScheme)) list.sort((a, b) => b[2] - a[2]);
  writeFileSync(join(root, "public", "geo", "gba2025-former-wards.json"), JSON.stringify(lookup));
  console.log(`public/geo/gba2025-former-wards.json: ${Object.keys(lookup).length} GBA wards`);
}
