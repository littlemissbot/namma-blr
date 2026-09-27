#!/usr/bin/env node
// Derives each project's wards and corporation from its geometry
// (docs/plans/02 §3). A project's ward list is never typed by hand: it comes
// from data/geometry/<project-id>.geojson intersected with every imported
// ward scheme.
//
//   npm run assign-wards            # rewrite project files
//   npm run assign-wards -- --check # CI: fail if any project file is out of date
//
// Rules: lines count as touching a ward if they pass within 40 m of it;
// polygons and points by overlap. `corporation` is the GBA corporation with
// the largest overlap, `corporations` lists every one touched when there's
// more than one, and a project touching no GBA ward is `outside_GBA`.
// Projects without a geometry file are left alone.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { dataDir, SCHEMES, LINE_BUFFER_M, loadWards, loadProjectGeometries, wardsForFeature } from "./lib/geo.mjs";
import { stringifyRecord } from "./lib/json-style.mjs";

export const WARD_BASIS = `Derived from the project's geometry: lines count as touching a ward if they pass within ${LINE_BUFFER_M} m of it, areas and points by overlap (scripts/assign-wards.mjs).`;

/**
 * Compute { wards, ward_basis, corporation, corporations } for one project
 * feature against the loaded schemes. `corporation`/`corporations` are only
 * returned when the GBA scheme is loaded.
 */
export function assignmentFor(feature, schemes) {
  const wards = [];
  let gbaHits = null;
  for (const [scheme, fc] of Object.entries(schemes)) {
    const hits = wardsForFeature(feature, fc);
    wards.push(...hits.map((h) => h.code));
    if (scheme === "gba2025") gbaHits = hits;
  }
  const result = { wards, ward_basis: WARD_BASIS };
  if (gbaHits) {
    const byCorp = new Map();
    for (const h of gbaHits) if (h.corporation) byCorp.set(h.corporation, (byCorp.get(h.corporation) ?? 0) + h.overlap_m2);
    const ranked = [...byCorp.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    result.corporation = ranked[0] ?? "outside_GBA";
    result.corporations = ranked.length > 1 ? [...ranked].sort() : undefined;
  }
  return result;
}

/** Apply an assignment to a project record, keeping field order stable. */
export function applyAssignment(project, a) {
  const out = {};
  for (const [k, v] of Object.entries(project)) {
    if (k === "ward_basis" || k === "corporations") continue; // re-inserted below
    out[k] = k === "wards" ? a.wards : k === "corporation" && a.corporation ? a.corporation : v;
    if (k === "wards") out.ward_basis = a.ward_basis;
    if (k === "corporation") out.corporations = a.corporation ? a.corporations : project.corporations;
  }
  return out;
}

async function main() {
  const check = process.argv.includes("--check");
  const schemes = Object.fromEntries(SCHEMES.map((s) => [s, loadWards(s)]).filter(([, fc]) => fc));
  const geometries = loadProjectGeometries();

  if (Object.keys(schemes).length === 0 || geometries.length === 0) {
    console.log(
      `Nothing to assign yet: ${Object.keys(schemes).length} ward scheme(s) imported, ${geometries.length} project geometry file(s).`
    );
    return;
  }

  const stale = [];
  for (const { projectId, feature } of geometries) {
    const file = join(dataDir, "projects", `${projectId}.json`);
    const before = readFileSync(file, "utf8");
    const project = JSON.parse(before);
    const after = stringifyRecord(applyAssignment(project, assignmentFor(feature, schemes))) + "\n";
    if (after === before) continue;
    stale.push(projectId);
    if (!check) {
      writeFileSync(file, after);
      const updated = JSON.parse(after);
      console.log(`${projectId}: ${updated.wards.length} ward(s), corporation ${updated.corporation}`);
      if (/placeholder/i.test(updated.notes ?? "")) {
        console.log(`  note: ${projectId}'s notes mention a placeholder corporation; update the notes by hand.`);
      }
    }
  }

  if (check && stale.length > 0) {
    console.error(`Ward assignments are out of date for: ${stale.join(", ")}\nRun \`npm run assign-wards\` and commit the result.`);
    process.exit(1);
  }
  console.log(check ? "Ward assignments are up to date." : `Updated ${stale.length} project(s).`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
