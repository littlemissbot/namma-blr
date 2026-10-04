#!/usr/bin/env node
// Fetches every named lake, tank and reservoir around Bengaluru from
// OpenStreetMap into data/places/lakes.geojson (one point per lake).
//
//   npm run fetch-lakes                        # live, via the Overpass API
//   npm run fetch-lakes -- --input saved.json  # offline, from a saved Overpass response
//
// The area is a box of roughly 50 km around the city centre, which covers
// Greater Bengaluru and the reservoirs people drive out to (TG Halli,
// Manchanabele, Hesaraghatta, Byramangala, Hoskote...). Each lake gets its
// centre point, OSM id, English/Kannada name, kind (lake, reservoir, pond)
// and an approximate size from its bounding box. Map data © OpenStreetMap
// contributors, ODbL.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const OVERPASS = "https://overpass-api.de/api/interpreter";

/** south, west, north, east: ~50 km around Bengaluru. */
export const AREA = [12.55, 77.15, 13.45, 78.05];

/** Names that mark a water body as a lake even when OSM lacks a water=* tag ("Kere" is Kannada for lake). */
const LAKE_NAME = /(kere|lake|tank|reservoir|dam|katte|kunte|sagara)/i;
const KINDS = new Set(["lake", "reservoir", "pond", "lagoon", "basin"]);

export function overpassQuery([s, w, n, e] = AREA) {
  const bbox = `${s},${w},${n},${e}`;
  return `[out:json][timeout:120];
(
  nwr["natural"="water"]["name"](${bbox});
  nwr["water"~"^(lake|reservoir|pond)$"]["name"](${bbox});
  nwr["landuse"="reservoir"]["name"](${bbox});
);
out tags center bb;`;
}

/** Approximate area in hectares of a lat/lon bounding box (an upper bound for the lake itself). */
export function bboxHectares(b) {
  if (!b) return null;
  const midLat = ((b.minlat + b.maxlat) / 2) * (Math.PI / 180);
  const h = (b.maxlat - b.minlat) * 111_320;
  const w = (b.maxlon - b.minlon) * 111_320 * Math.cos(midLat);
  return Math.round((h * w) / 10_000);
}

const round = (n) => Math.round(n * 1e6) / 1e6;

/** Convert Overpass elements into lake point features, dropping rivers, pools and unnamed water. */
export function toLakes(elements) {
  const seen = new Map();
  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags.name?.trim();
    if (!name) continue;
    if (["river", "stream", "canal", "wastewater", "moat"].includes(tags.water)) continue;
    if (tags.leisure === "swimming_pool" || tags.amenity === "fountain") continue;
    const kind = KINDS.has(tags.water) ? tags.water : tags.landuse === "reservoir" ? "reservoir" : LAKE_NAME.test(name) ? "lake" : null;
    if (!kind) continue;
    const lat = el.center?.lat ?? el.lat;
    const lon = el.center?.lon ?? el.lon;
    if (lat == null || lon == null) continue;
    const feature = {
      type: "Feature",
      properties: {
        name,
        name_kn: tags["name:kn"] ?? null,
        kind,
        approx_hectares: bboxHectares(el.bounds),
        osm: `${el.type}/${el.id}`,
        wikidata: tags.wikidata ?? null,
      },
      geometry: { type: "Point", coordinates: [round(lon), round(lat)] },
    };
    // The same lake can be mapped as a relation and as its outer way; keep the larger record.
    const key = `${name.toLowerCase()}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
    const prev = seen.get(key);
    if (!prev || (feature.properties.approx_hectares ?? 0) > (prev.properties.approx_hectares ?? 0)) seen.set(key, feature);
  }
  return [...seen.values()].sort((a, b) => a.properties.name.localeCompare(b.properties.name));
}

async function main() {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf("--input");
  let response;
  if (inputIdx >= 0) response = JSON.parse(readFileSync(args[inputIdx + 1], "utf8"));
  else {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "NammaBLR lakes fetcher (https://github.com/littlemissbot/namma-blr)" },
      body: new URLSearchParams({ data: overpassQuery() }),
    });
    if (!res.ok) throw new Error(`Overpass returned ${res.status}`);
    response = await res.json();
  }
  const lakes = toLakes(response.elements ?? []);
  if (lakes.length === 0) throw new Error("no lakes in the response; nothing written");
  const out = {
    type: "FeatureCollection",
    source: "OpenStreetMap via the Overpass API",
    licence: "ODbL 1.0, © OpenStreetMap contributors (https://www.openstreetmap.org/copyright)",
    retrieved_on: new Date().toISOString().slice(0, 10),
    area: { south: AREA[0], west: AREA[1], north: AREA[2], east: AREA[3] },
    features: lakes,
  };
  const path = join(root, "data", "places", "lakes.geojson");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(out, null, 0).replace(/\},\{"type":"Feature"/g, '},\n{"type":"Feature"') + "\n");
  console.log(`Wrote data/places/lakes.geojson: ${lakes.length} named lakes, tanks and reservoirs.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
