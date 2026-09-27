#!/usr/bin/env node
// Fetches a project's geometry from OpenStreetMap into data/geometry/<project-id>.geojson
// (docs/plans/02 §2) and marks the project's geometry_basis as "osm".
//
//   npm run fetch-osm -- <project-id> relation/<id> [way/<id> node/<id> ...]
//   npm run fetch-osm -- <project-id> relation/<id> --input overpass.json   # offline, from a saved response
//
// Find ids on openstreetmap.org: click the metro line, road or lake and read
// the id from the URL (e.g. openstreetmap.org/relation/1234567).
//
// Route relations (metro lines, roads) become a MultiLineString of their track
// ways; platforms and stops are skipped. Multipolygon relations (lakes, parks)
// become polygons. Closed ways tagged as areas become polygons, other ways
// lines, nodes points. Provenance (OSM ids, retrieval date, ODbL attribution)
// is stored in the feature's properties.
//
// Afterwards run `npm run assign-wards` to derive the project's wards.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { stringifyRecord } from "./lib/json-style.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const OVERPASS = "https://overpass-api.de/api/interpreter";
const SKIP_ROLES = new Set(["platform", "stop", "stop_entry_only", "stop_exit_only", "platform_entry_only", "platform_exit_only"]);
const AREA_TAGS = ["natural", "leisure", "landuse", "amenity", "building", "water", "area"];

const round = (n) => Math.round(n * 1e7) / 1e7;
const coord = (p) => [round(p.lon), round(p.lat)];
const sameCoord = (a, b) => a[0] === b[0] && a[1] === b[1];

/** Overpass query for the given ids, e.g. ["relation/1", "way/2"]. */
export function overpassQuery(ids) {
  const parts = ids.map((id) => {
    const [type, num] = id.split("/");
    return `${type}(${num});`;
  });
  return `[out:json][timeout:60];(${parts.join("")});out geom;`;
}

/** Join way segments end to end into closed rings (for multipolygon relations). */
export function assembleRings(segments) {
  const pending = segments.map((s) => [...s]);
  const rings = [];
  while (pending.length) {
    let ring = pending.shift();
    let extended = true;
    while (!sameCoord(ring[0], ring.at(-1)) && extended) {
      extended = false;
      for (let i = 0; i < pending.length; i++) {
        const s = pending[i];
        const end = ring.at(-1);
        if (sameCoord(s[0], end)) ring = ring.concat(s.slice(1));
        else if (sameCoord(s.at(-1), end)) ring = ring.concat([...s].reverse().slice(1));
        else continue;
        pending.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (sameCoord(ring[0], ring.at(-1)) && ring.length >= 4) rings.push(ring);
  }
  return rings;
}

const isArea = (tags = {}) => tags.area !== "no" && AREA_TAGS.some((k) => k in tags);

/** Convert Overpass `out geom` elements into one GeoJSON geometry. */
export function toGeometry(elements) {
  const lines = [];
  const polygons = [];
  const points = [];
  for (const el of elements) {
    if (el.type === "node") points.push([round(el.lon), round(el.lat)]);
    else if (el.type === "way" && el.geometry) {
      const c = el.geometry.map(coord);
      if (sameCoord(c[0], c.at(-1)) && c.length >= 4 && isArea(el.tags)) polygons.push([c]);
      else lines.push(c);
    } else if (el.type === "relation") {
      const members = (el.members ?? []).filter((m) => m.type === "way" && m.geometry);
      if (el.tags?.type === "multipolygon" || el.tags?.type === "boundary") {
        const outers = assembleRings(members.filter((m) => m.role !== "inner").map((m) => m.geometry.map(coord)));
        const inners = assembleRings(members.filter((m) => m.role === "inner").map((m) => m.geometry.map(coord)));
        const polys = outers.map((o) => [o]);
        for (const inner of inners) {
          const host = polys.find((p) => booleanPointInPolygon(inner[0], { type: "Polygon", coordinates: [p[0]] }));
          if (host) host.push(inner);
        }
        polygons.push(...polys);
      } else {
        for (const m of members) if (!SKIP_ROLES.has(m.role)) lines.push(m.geometry.map(coord));
      }
    }
  }
  const parts = [];
  if (lines.length) parts.push(lines.length === 1 ? { type: "LineString", coordinates: lines[0] } : { type: "MultiLineString", coordinates: lines });
  if (polygons.length) parts.push(polygons.length === 1 ? { type: "Polygon", coordinates: polygons[0] } : { type: "MultiPolygon", coordinates: polygons });
  if (points.length) parts.push(points.length === 1 ? { type: "Point", coordinates: points[0] } : { type: "MultiPoint", coordinates: points });
  if (parts.length === 0) throw new Error("no usable geometry in the Overpass response (check the ids)");
  return parts.length === 1 ? parts[0] : { type: "GeometryCollection", geometries: parts };
}

async function main() {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf("--input");
  const input = inputIdx >= 0 ? args.splice(inputIdx, 2)[1] : null;
  const [projectId, ...ids] = args;
  if (!projectId || ids.length === 0 || ids.some((id) => !/^(relation|way|node)\/\d+$/.test(id))) {
    console.error("usage: npm run fetch-osm -- <project-id> relation/<id> [way/<id> node/<id> ...] [--input overpass.json]");
    process.exit(1);
  }
  const projectPath = join(root, "data", "projects", `${projectId}.json`);
  if (!existsSync(projectPath)) {
    console.error(`No project ${projectId} in data/projects/.`);
    process.exit(1);
  }

  let response;
  if (input) response = JSON.parse(readFileSync(input, "utf8"));
  else {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "NammaBLR geometry fetcher (https://github.com/littlemissbot/namma-blr)" },
      body: new URLSearchParams({ data: overpassQuery(ids) }),
    });
    if (!res.ok) throw new Error(`Overpass returned ${res.status}`);
    response = await res.json();
  }

  const geometry = toGeometry(response.elements ?? []);
  const feature = {
    type: "Feature",
    properties: {
      source: "OpenStreetMap",
      osm: ids,
      retrieved_on: new Date().toISOString().slice(0, 10),
      licence: "ODbL 1.0, © OpenStreetMap contributors (https://www.openstreetmap.org/copyright)",
    },
    geometry,
  };
  const outPath = join(root, "data", "geometry", `${projectId}.geojson`);
  writeFileSync(outPath, JSON.stringify(feature) + "\n");

  const project = JSON.parse(readFileSync(projectPath, "utf8"));
  if (project.geometry_basis !== "osm") {
    const entries = Object.entries(project).filter(([k]) => k !== "geometry_basis");
    const at = entries.findIndex(([k]) => k === "status") + 1;
    entries.splice(at, 0, ["geometry_basis", "osm"]);
    writeFileSync(projectPath, stringifyRecord(Object.fromEntries(entries)) + "\n");
  }
  console.log(`Wrote data/geometry/${projectId}.geojson (${geometry.type}); ${projectId}.geometry_basis = "osm".`);
  console.log("Next: npm run assign-wards, then npm run validate.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
