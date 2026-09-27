// Shared geometry helpers for the ward tooling (docs/plans/02-geometry-and-wards.md).
// Only the build scripts use these; nothing here ships to the browser.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import area from "@turf/area";
import bbox from "@turf/bbox";
import buffer from "@turf/buffer";
import intersect from "@turf/intersect";
import { featureCollection } from "@turf/helpers";

export const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
export const dataDir = join(root, "data");

/** Ward schemes, oldest first (docs/plans/02 §1). */
export const SCHEMES = ["bbmp198", "bbmp243", "gba2025"];

/** Buffer applied to line geometry before intersecting with wards: "passes within 40 m". */
export const LINE_BUFFER_M = 40;
/** Points get a tiny buffer so they can be intersected like areas. */
const POINT_BUFFER_M = 1;
/** Overlaps smaller than this are boundary noise between two independently drawn maps. */
export const MIN_OVERLAP_M2 = 1;

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** The built ward file for a scheme, or null if that scheme hasn't been imported yet. */
export function loadWards(scheme, dir = dataDir) {
  const path = join(dir, "wards", scheme, "wards.geojson");
  return existsSync(path) ? readJson(path) : null;
}

/** All project geometry files: { projectId, feature } where feature is a single GeoJSON Feature. */
export function loadProjectGeometries(dir = dataDir) {
  const geoDir = join(dir, "geometry");
  if (!existsSync(geoDir)) return [];
  return readdirSync(geoDir)
    .filter((f) => f.endsWith(".geojson"))
    .map((f) => ({ projectId: f.replace(/\.geojson$/, ""), feature: asFeature(readJson(join(geoDir, f))) }));
}

/** Accept a Feature, FeatureCollection or bare geometry and return one Feature. */
export function asFeature(geojson) {
  if (geojson.type === "Feature") return geojson;
  if (geojson.type === "FeatureCollection") {
    // Merge members into one multi-geometry per kind; mixed kinds become a GeometryCollection.
    return { type: "Feature", properties: {}, geometry: { type: "GeometryCollection", geometries: geojson.features.map((f) => f.geometry) } };
  }
  return { type: "Feature", properties: {}, geometry: geojson };
}

/** Flatten any geometry into its simple parts (Point, LineString, Polygon). */
function* simpleParts(geometry) {
  switch (geometry.type) {
    case "Point":
    case "LineString":
    case "Polygon":
      yield geometry;
      break;
    case "MultiPoint":
      for (const c of geometry.coordinates) yield { type: "Point", coordinates: c };
      break;
    case "MultiLineString":
      for (const c of geometry.coordinates) yield { type: "LineString", coordinates: c };
      break;
    case "MultiPolygon":
      for (const c of geometry.coordinates) yield { type: "Polygon", coordinates: c };
      break;
    case "GeometryCollection":
      for (const g of geometry.geometries) yield* simpleParts(g);
      break;
    default:
      throw new Error(`unsupported geometry type ${geometry.type}`);
  }
}

/**
 * The areas a project occupies for ward-matching purposes: polygons as drawn,
 * lines buffered by LINE_BUFFER_M, points buffered by POINT_BUFFER_M.
 */
export function footprints(feature) {
  const out = [];
  for (const part of simpleParts(feature.geometry)) {
    if (part.type === "Polygon") {
      out.push({ type: "Feature", properties: {}, geometry: part });
    } else {
      const radius = part.type === "LineString" ? LINE_BUFFER_M : POINT_BUFFER_M;
      out.push(buffer({ type: "Feature", properties: {}, geometry: part }, radius, { units: "meters" }));
    }
  }
  return out;
}

const bboxesOverlap = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

/** Area in m² of the overlap between two polygon features (0 if none). */
export function overlapArea(a, b, aBox = bbox(a), bBox = bbox(b)) {
  if (!bboxesOverlap(aBox, bBox)) return 0;
  const shared = intersect(featureCollection([a, b]));
  return shared ? area(shared) : 0;
}

/**
 * Wards a project touches in one scheme, with the overlap area of each.
 * Returns [{ code, corporation, overlap_m2 }] sorted by code.
 */
export function wardsForFeature(feature, wards) {
  const parts = footprints(feature).map((f) => ({ f, box: bbox(f) }));
  const hits = [];
  for (const ward of wards.features) {
    const wardBox = ward.bbox ?? bbox(ward);
    let overlap = 0;
    for (const { f, box } of parts) overlap += overlapArea(f, ward, box, wardBox);
    if (overlap >= MIN_OVERLAP_M2) {
      hits.push({ code: ward.properties.code, corporation: ward.properties.corporation ?? null, overlap_m2: overlap });
    }
  }
  return hits.sort((a, b) => compareCodes(a.code, b.code));
}

/** Sort ward codes numerically within a scheme: gba2025:1-2 before gba2025:1-10. */
export function compareCodes(a, b) {
  const key = (c) => c.split(/[:-]/).map((p) => (/^\d+$/.test(p) ? p.padStart(6, "0") : p)).join(":");
  return key(a).localeCompare(key(b));
}

/**
 * Area-overlap crosswalk between two ward schemes. For every pair of wards
 * that overlap, records what share of each ward the overlap is. Shares under
 * minShare (default 1%) are dropped as digitising noise between two maps.
 */
export function crosswalk(fromWards, toWards, minShare = 0.01) {
  const to = toWards.features.map((w) => ({ w, box: w.bbox ?? bbox(w), area: area(w) }));
  const rows = [];
  for (const a of fromWards.features) {
    const aBox = a.bbox ?? bbox(a);
    const aArea = area(a);
    for (const { w: b, box: bBox, area: bArea } of to) {
      const shared = overlapArea(a, b, aBox, bBox);
      if (shared === 0) continue;
      const shareOfFrom = shared / aArea;
      const shareOfTo = shared / bArea;
      if (shareOfFrom < minShare && shareOfTo < minShare) continue;
      rows.push({
        from: a.properties.code,
        to: b.properties.code,
        share_of_from: round(shareOfFrom),
        share_of_to: round(shareOfTo),
      });
    }
  }
  return rows.sort((x, y) => compareCodes(x.from, y.from) || compareCodes(x.to, y.to));
}

const round = (n) => Math.round(n * 1000) / 1000;
