// Tests for scripts/fetch-osm-lakes.mjs, using hand-written Overpass
// `out tags center bb` responses (no network).

import { test } from "node:test";
import assert from "node:assert/strict";
import { toLakes, bboxHectares, overpassQuery } from "../scripts/fetch-osm-lakes.mjs";

const way = (id, tags, lat, lon, span = 0.005) => ({
  type: "way",
  id,
  tags,
  center: { lat, lon },
  bounds: { minlat: lat - span, maxlat: lat + span, minlon: lon - span, maxlon: lon + span },
});

test("keeps named lakes, reservoirs and Kere-named water", () => {
  const lakes = toLakes([
    way(1, { natural: "water", water: "lake", name: "Hebbal Lake" }, 13.045, 77.592),
    way(2, { natural: "water", water: "reservoir", name: "Thippagondanahalli Reservoir" }, 12.98, 77.33),
    way(3, { natural: "water", name: "Doddakallasandra Kere" }, 12.88, 77.55),
    way(4, { landuse: "reservoir", name: "Manchanabele Dam" }, 12.86, 77.33),
  ]);
  assert.deepEqual(lakes.map((l) => [l.properties.name, l.properties.kind]), [
    ["Doddakallasandra Kere", "lake"],
    ["Hebbal Lake", "lake"],
    ["Manchanabele Dam", "reservoir"],
    ["Thippagondanahalli Reservoir", "reservoir"],
  ]);
});

test("drops rivers, pools, unnamed water and water with no lake-like name or tag", () => {
  const lakes = toLakes([
    way(1, { natural: "water", water: "river", name: "Arkavathi" }, 12.9, 77.4),
    way(2, { leisure: "swimming_pool", natural: "water", name: "Club Pool" }, 12.97, 77.6),
    way(3, { natural: "water" }, 12.95, 77.6),
    way(4, { natural: "water", name: "Some Water Feature" }, 12.96, 77.61),
  ]);
  assert.equal(lakes.length, 0);
});

test("one lake mapped twice (relation and way) is kept once, the larger record", () => {
  const lakes = toLakes([
    way(10, { natural: "water", water: "lake", name: "Bellandur Lake" }, 12.934, 77.671, 0.005),
    { ...way(11, { type: "multipolygon", natural: "water", water: "lake", name: "Bellandur Lake" }, 12.9341, 77.6712, 0.012), type: "relation" },
  ]);
  assert.equal(lakes.length, 1);
  assert.equal(lakes[0].properties.osm, "relation/11");
});

test("records Kannada names, OSM ids and points as [lon, lat]", () => {
  const [lake] = toLakes([way(5, { natural: "water", water: "lake", name: "Ulsoor Lake", "name:kn": "ಹಲಸೂರು ಕೆರೆ" }, 12.983, 77.62)]);
  assert.equal(lake.properties.name_kn, "ಹಲಸೂರು ಕೆರೆ");
  assert.equal(lake.properties.osm, "way/5");
  assert.deepEqual(lake.geometry.coordinates, [77.62, 12.983]);
});

test("bounding-box size is a sane approximation", () => {
  // ~1.1 km x ~1.08 km at Bengaluru's latitude ≈ 120 ha
  const ha = bboxHectares({ minlat: 12.95, maxlat: 12.96, minlon: 77.6, maxlon: 77.61 });
  assert.ok(ha > 110 && ha < 130, `got ${ha}`);
  assert.equal(bboxHectares(undefined), null);
});

test("query covers the Bengaluru box and asks for centres", () => {
  const q = overpassQuery();
  assert.match(q, /12\.55,77\.15,13\.45,78\.05/);
  assert.match(q, /out tags center bb;/);
});
