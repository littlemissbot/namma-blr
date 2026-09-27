// Tests for scripts/fetch-osm-geometry.mjs conversion, using hand-written
// Overpass `out geom` responses (no network).

import { test } from "node:test";
import assert from "node:assert/strict";
import { toGeometry, assembleRings, overpassQuery } from "../scripts/fetch-osm-geometry.mjs";

const g = (...pts) => pts.map(([lon, lat]) => ({ lon, lat }));

test("overpassQuery lists every id", () => {
  assert.equal(overpassQuery(["relation/1", "way/2"]), "[out:json][timeout:60];(relation(1);way(2););out geom;");
});

test("route relation becomes track lines, skipping platforms and stops", () => {
  const geom = toGeometry([
    {
      type: "relation",
      id: 1,
      tags: { type: "route", route: "subway" },
      members: [
        { type: "node", ref: 9, role: "stop" },
        { type: "way", ref: 10, role: "", geometry: g([77.5, 12.9], [77.51, 12.91]) },
        { type: "way", ref: 11, role: "", geometry: g([77.51, 12.91], [77.52, 12.92]) },
        { type: "way", ref: 12, role: "platform", geometry: g([77.505, 12.905], [77.506, 12.906]) },
      ],
    },
  ]);
  assert.equal(geom.type, "MultiLineString");
  assert.equal(geom.coordinates.length, 2);
});

test("multipolygon relation assembles split outer ways into one ring, with a hole", () => {
  const geom = toGeometry([
    {
      type: "relation",
      id: 2,
      tags: { type: "multipolygon", natural: "water" },
      members: [
        { type: "way", ref: 1, role: "outer", geometry: g([77.5, 12.9], [77.52, 12.9], [77.52, 12.92]) },
        { type: "way", ref: 2, role: "outer", geometry: g([77.5, 12.9], [77.5, 12.92], [77.52, 12.92]) },
        { type: "way", ref: 3, role: "inner", geometry: g([77.505, 12.905], [77.51, 12.905], [77.51, 12.91], [77.505, 12.905]) },
      ],
    },
  ]);
  assert.equal(geom.type, "Polygon");
  assert.equal(geom.coordinates.length, 2, "outer ring plus one hole");
  const outer = geom.coordinates[0];
  assert.deepEqual(outer[0], outer.at(-1), "ring is closed");
});

test("closed way tagged as an area becomes a polygon; untagged closed way stays a line", () => {
  const ring = g([77.5, 12.9], [77.51, 12.9], [77.51, 12.91], [77.5, 12.9]);
  assert.equal(toGeometry([{ type: "way", id: 1, tags: { leisure: "park" }, geometry: ring }]).type, "Polygon");
  assert.equal(toGeometry([{ type: "way", id: 2, tags: { highway: "primary" }, geometry: ring }]).type, "LineString");
});

test("mixed kinds become a GeometryCollection", () => {
  const geom = toGeometry([
    { type: "node", id: 1, lon: 77.5, lat: 12.9 },
    { type: "way", id: 2, tags: {}, geometry: g([77.5, 12.9], [77.51, 12.91]) },
  ]);
  assert.equal(geom.type, "GeometryCollection");
});

test("empty responses are an error, not an empty file", () => {
  assert.throws(() => toGeometry([]), /no usable geometry/);
});

test("assembleRings drops segments that never close", () => {
  assert.deepEqual(assembleRings([[[0, 0], [1, 0]]]), []);
});
