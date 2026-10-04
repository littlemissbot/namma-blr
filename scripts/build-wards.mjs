#!/usr/bin/env node
// Builds normalised ward boundaries for one scheme (docs/plans/02 §1).
//
//   npm run build-wards -- gba2025
//
// Reads data/wards/<scheme>/mapping.json, which says where the raw source file
// is and which of its fields hold the ward number, name and so on (see
// data/wards/README.md). Writes:
//   data/wards/<scheme>/wards.geojson   full resolution, used for spatial joins
//   public/geo/wards-<scheme>.json      simplified, for the browser

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import { kml } from "@tmcw/togeojson";
import * as shapefile from "shapefile";
import proj4 from "proj4";
import mapshaper from "mapshaper";
import bbox from "@turf/bbox";
import { root, dataDir, SCHEMES, readJson, compareCodes } from "./lib/geo.mjs";

/** Read the raw source file into a FeatureCollection, whatever its format. */
export async function readSource(path) {
  const ext = extname(path).toLowerCase();
  if (ext === ".kml") {
    const doc = new DOMParser().parseFromString(readFileSync(path, "utf8"), "text/xml");
    return kml(doc);
  }
  if (ext === ".shp") return shapefile.read(path);
  if (ext === ".geojson" || ext === ".json") return readJson(path);
  throw new Error(`unsupported source format ${ext} (use .kml, .shp, .geojson or .json)`);
}

/** Reproject every coordinate in place from `from` (proj4 string or EPSG code) to WGS84. */
function reproject(fc, from) {
  const convert = proj4(from, "EPSG:4326");
  const walk = (c) => (typeof c[0] === "number" ? convert.forward(c) : c.map(walk));
  for (const f of fc.features) {
    if (f.geometry?.coordinates) f.geometry.coordinates = walk(f.geometry.coordinates);
  }
}

/** Trim coordinates to ~1 cm precision, which keeps diffs and file sizes sane. */
function roundCoords(c) {
  return typeof c[0] === "number" ? c.slice(0, 2).map((n) => Math.round(n * 1e7) / 1e7) : c.map(roundCoords);
}

const clean = (v) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());

/**
 * Normalise raw features into { code, scheme, ward_no, name, name_kn,
 * corporation, corporation_id, assembly_constituency } using the mapping.
 */
export function normalise(scheme, raw, mapping) {
  const fields = mapping.fields ?? {};
  const get = (props, key) => (fields[key] ? clean(props[fields[key]]) : null);
  const corpNames = mapping.corporations ?? {}; // { "<id>": "<Name>" }
  const corpIdsByName = Object.fromEntries(Object.entries(corpNames).map(([id, name]) => [name.toLowerCase(), id]));

  const seen = new Set();
  const features = [];
  for (const f of raw.features) {
    if (!f.geometry || !/Polygon$/.test(f.geometry.type)) continue; // skip labels/points in KMLs
    const p = f.properties ?? {};
    const wardNo = get(p, "ward_no");
    if (!wardNo || !/^\d+$/.test(wardNo)) {
      throw new Error(`${scheme}: feature without a numeric ward number (field "${fields.ward_no}"): ${JSON.stringify(p).slice(0, 200)}`);
    }
    let corporationId = get(p, "corporation_id");
    let corporation = get(p, "corporation");
    if (!corporationId && corporation) corporationId = corpIdsByName[corporation.toLowerCase()] ?? null;
    if (corporationId && !corporation) corporation = corpNames[corporationId] ?? null;

    let code;
    if (scheme === "gba2025") {
      if (!corporationId) throw new Error(`gba2025: ward ${wardNo} has no corporation id; set fields.corporation_id or fields.corporation + corporations in mapping.json`);
      code = `gba2025:${corporationId}-${Number(wardNo)}`;
    } else {
      code = `${scheme}:${Number(wardNo)}`;
    }
    if (seen.has(code)) throw new Error(`${scheme}: duplicate ward ${code}`);
    seen.add(code);

    const geometry = { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) };
    const feature = {
      type: "Feature",
      properties: {
        code,
        scheme,
        ward_no: Number(wardNo),
        name: get(p, "name"),
        name_kn: get(p, "name_kn"),
        corporation,
        corporation_id: corporationId ? Number(corporationId) : null,
        assembly_constituency: get(p, "assembly_constituency"),
      },
      geometry,
    };
    feature.bbox = bbox(feature).map((n) => Math.round(n * 1e7) / 1e7);
    features.push(feature);
  }
  if (features.length === 0) throw new Error(`${scheme}: no polygon features found in source`);
  features.sort((a, b) => compareCodes(a.properties.code, b.properties.code));
  return { type: "FeatureCollection", features };
}

/**
 * Corporation outlines for the GBA scheme: each corporation's wards merged into
 * one shape, simplified for the browser. Derived, so it always matches the wards.
 */
export async function dissolveCorporations(fc, percentage = "10%") {
  const out = await mapshaper.applyCommands(
    `-i in.json -dissolve corporation_id copy-fields=corporation -simplify ${percentage} keep-shapes -o out.json precision=0.00001`,
    { "in.json": fc }
  );
  return JSON.parse(out["out.json"].toString());
}

/** Topology-preserving simplification for the browser copy (adjacent wards stay gap-free). */
export async function simplify(fc, percentage = "10%") {
  const out = await mapshaper.applyCommands(
    `-i in.json -simplify ${percentage} keep-shapes -o out.json precision=0.00001`,
    { "in.json": fc }
  );
  const simplified = JSON.parse(out["out.json"].toString());
  for (const f of simplified.features) delete f.bbox;
  return simplified;
}

async function main() {
  const scheme = process.argv[2];
  if (!SCHEMES.includes(scheme)) {
    console.error(`usage: npm run build-wards -- <${SCHEMES.join("|")}>`);
    process.exit(1);
  }
  const schemeDir = join(dataDir, "wards", scheme);
  const mapping = readJson(join(schemeDir, "mapping.json"));
  const raw = await readSource(join(schemeDir, mapping.source_file));
  if (mapping.source_crs && mapping.source_crs !== "EPSG:4326") reproject(raw, mapping.source_crs);

  const wards = normalise(scheme, raw, mapping);
  writeFileSync(join(schemeDir, "wards.geojson"), JSON.stringify(wards) + "\n");

  const publicPath = join(root, "public", "geo", `wards-${scheme}.json`);
  mkdirSync(dirname(publicPath), { recursive: true });
  const light = await simplify(wards, mapping.simplify ?? "10%");
  writeFileSync(publicPath, JSON.stringify(light));

  let corporationsLine = "";
  if (scheme === "gba2025") {
    const corps = await dissolveCorporations(wards, mapping.simplify ?? "10%");
    const corpPath = join(root, "public", "geo", "gba-corporations.json");
    writeFileSync(corpPath, JSON.stringify(corps));
    corporationsLine = `  public/geo/gba-corporations.json   ${corps.features.length} corporations`;
  }

  const kb = (s) => `${Math.round(Buffer.byteLength(s) / 1024)} KB`;
  console.log(`${scheme}: ${wards.features.length} wards`);
  console.log(`  data/wards/${scheme}/wards.geojson  ${kb(JSON.stringify(wards))}`);
  console.log(`  public/geo/wards-${scheme}.json     ${kb(JSON.stringify(light))} (simplified ${mapping.simplify ?? "10%"})`);
  if (corporationsLine) console.log(corporationsLine);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
