// Tests for the ward tooling (scripts/lib/geo.mjs, build-wards, assign-wards)
// against small synthetic wards near Bengaluru. Run with `npm test`.
//
// Layout (each ward ~1.1 km square, lat 12.90–12.91):
//   gba2025:1-1 (Central)  lon 77.50–77.51
//   gba2025:2-1 (North)    lon 77.51–77.52
//   bbmp198:7              lon 77.50–77.52 (covers both)

import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { wardsForFeature, crosswalk, compareCodes } from "../scripts/lib/geo.mjs";
import { normalise, readSource, simplify } from "../scripts/build-wards.mjs";
import { assignmentFor, applyAssignment } from "../scripts/assign-wards.mjs";
import { stringifyRecord } from "../scripts/lib/json-style.mjs";

const square = (lon0, lon1, lat0 = 12.9, lat1 = 12.91) => ({
  type: "Polygon",
  coordinates: [[[lon0, lat0], [lon1, lat0], [lon1, lat1], [lon0, lat1], [lon0, lat0]]],
});

const gbaMapping = {
  fields: { ward_no: "WARD_NO", name: "NAME", corporation: "CORP" },
  corporations: { 1: "Central", 2: "North", 3: "East", 4: "South", 5: "West" },
};
const gba = normalise(
  "gba2025",
  {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { WARD_NO: "1", NAME: "Alpha", CORP: "Central" }, geometry: square(77.5, 77.51) },
      { type: "Feature", properties: { WARD_NO: "1", NAME: "Beta", CORP: "North" }, geometry: square(77.51, 77.52) },
      { type: "Feature", properties: { NAME: "label" }, geometry: { type: "Point", coordinates: [77.505, 12.905] } },
    ],
  },
  gbaMapping
);
const bbmp198 = normalise(
  "bbmp198",
  { type: "FeatureCollection", features: [{ type: "Feature", properties: { NO: "7" }, geometry: square(77.5, 77.52) }] },
  { fields: { ward_no: "NO" } }
);
const line = (lon0, lon1, lat = 12.905) => ({
  type: "Feature",
  properties: {},
  geometry: { type: "LineString", coordinates: [[lon0, lat], [lon1, lat]] },
});

test("normalise builds scheme-prefixed codes and skips non-polygons", () => {
  assert.deepEqual(gba.features.map((f) => f.properties.code), ["gba2025:1-1", "gba2025:2-1"]);
  assert.equal(gba.features[1].properties.corporation, "North");
  assert.equal(gba.features[1].properties.corporation_id, 2);
  assert.equal(bbmp198.features[0].properties.code, "bbmp198:7");
  assert.ok(Array.isArray(gba.features[0].bbox));
});

test("normalise rejects duplicate wards and missing ward numbers", () => {
  const dup = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { NO: "3" }, geometry: square(77.5, 77.51) },
      { type: "Feature", properties: { NO: "3" }, geometry: square(77.51, 77.52) },
    ],
  };
  assert.throws(() => normalise("bbmp243", dup, { fields: { ward_no: "NO" } }), /duplicate ward bbmp243:3/);
  const missing = { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: square(77.5, 77.51) }] };
  assert.throws(() => normalise("bbmp243", missing, { fields: { ward_no: "NO" } }), /numeric ward number/);
});

test("readSource parses KML with ExtendedData", async () => {
  const dir = mkdtempSync(join(tmpdir(), "wards-"));
  const path = join(dir, "w.kml");
  writeFileSync(
    path,
    `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark>
      <ExtendedData><Data name="WARD_NO"><value>12</value></Data></ExtendedData>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>77.5,12.9 77.51,12.9 77.51,12.91 77.5,12.91 77.5,12.9</coordinates></LinearRing></outerBoundaryIs></Polygon>
    </Placemark></Document></kml>`
  );
  const fc = await readSource(path);
  const wards = normalise("bbmp243", fc, { fields: { ward_no: "WARD_NO" } });
  assert.equal(wards.features[0].properties.code, "bbmp243:12");
});

test("simplify keeps every ward", async () => {
  const light = await simplify(gba);
  assert.equal(light.features.length, 2);
  assert.equal(light.features[0].properties.code, "gba2025:1-1");
});

test("a line well inside one ward touches only that ward", () => {
  const hits = wardsForFeature(line(77.502, 77.508), gba);
  assert.deepEqual(hits.map((h) => h.code), ["gba2025:1-1"]);
});

test("a line ending within 40 m of a boundary also touches the neighbour", () => {
  // Ends ~22 m short of the 77.51 boundary.
  const hits = wardsForFeature(line(77.505, 77.5098), gba);
  assert.deepEqual(hits.map((h) => h.code), ["gba2025:1-1", "gba2025:2-1"]);
});

test("a line ending 100 m short of a boundary does not", () => {
  const hits = wardsForFeature(line(77.505, 77.5091), gba);
  assert.deepEqual(hits.map((h) => h.code), ["gba2025:1-1"]);
});

test("points and polygons are matched by overlap", () => {
  const point = { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [77.515, 12.905] } };
  assert.deepEqual(wardsForFeature(point, gba).map((h) => h.code), ["gba2025:2-1"]);
  const lake = { type: "Feature", properties: {}, geometry: square(77.508, 77.512, 12.902, 12.904) };
  assert.deepEqual(wardsForFeature(lake, gba).map((h) => h.code), ["gba2025:1-1", "gba2025:2-1"]);
});

test("crosswalk records the share of each ward an overlap covers", () => {
  const rows = crosswalk(bbmp198, gba);
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.equal(r.from, "bbmp198:7");
    assert.ok(Math.abs(r.share_of_from - 0.5) < 0.01, `share_of_from ${r.share_of_from}`);
    assert.ok(Math.abs(r.share_of_to - 1) < 0.01, `share_of_to ${r.share_of_to}`);
  }
});

test("assignment picks the majority corporation and lists all touched", () => {
  const a = assignmentFor(line(77.502, 77.5098), { bbmp198, gba2025: gba });
  assert.deepEqual(a.wards, ["bbmp198:7", "gba2025:1-1", "gba2025:2-1"]);
  assert.equal(a.corporation, "Central");
  assert.deepEqual(a.corporations, ["Central", "North"]);
});

test("a project touching no GBA ward is outside_GBA", () => {
  const a = assignmentFor(line(77.6, 77.61, 13.1), { gba2025: gba });
  assert.deepEqual(a.wards, []);
  assert.equal(a.corporation, "outside_GBA");
  assert.equal(a.corporations, undefined);
});

test("without GBA wards loaded, corporation fields are left alone", () => {
  const project = { id: "x", wards: [], corporation: "East", corporations: ["East", "South"], confidence: "medium" };
  const out = applyAssignment(project, assignmentFor(line(77.502, 77.508), { bbmp198 }));
  assert.equal(out.corporation, "East");
  assert.deepEqual(out.corporations, ["East", "South"]);
  assert.deepEqual(out.wards, ["bbmp198:7"]);
});

test("applyAssignment keeps field order and the repo's JSON style", () => {
  const project = { id: "x", name: "X", wards: [], corporation: "Central", confidence: "medium" };
  const out = applyAssignment(project, assignmentFor(line(77.502, 77.5098), { gba2025: gba }));
  assert.deepEqual(Object.keys(out), ["id", "name", "wards", "ward_basis", "corporation", "corporations", "confidence"]);
  assert.match(stringifyRecord(out), /"wards": \["gba2025:1-1", "gba2025:2-1"\],/);
});

test("ward codes sort numerically", () => {
  assert.deepEqual(["gba2025:1-10", "gba2025:1-2", "gba2025:2-1"].sort(compareCodes), ["gba2025:1-2", "gba2025:1-10", "gba2025:2-1"]);
});
