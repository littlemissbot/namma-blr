# Plan 2: Geometry and ward data

**Roadmap goal:** G2. **Spec:** §5.1, §8.3; Phase 2/3.
**Depends on:** Plan 0 (licence decision, schema fields).
**Can run in parallel with:** Plan 1 (backfill).

Today, no project has geometry or wards. The map (Plan 3) and the "my ward" view
(Plan 4) both need this data layer first. It is also the part where Kaun's open
data saves the most work.

## 1. Ward boundaries

Keep **both** boundary sets (spec §8.3), with a scheme prefix on every code:

| Scheme | Code format | Source | Notes |
| --- | --- | --- | --- |
| `gba2025` | `gba2025:<corporation_id>-<ward_no>` | OpenCity "GBA 369 wards, December 2025" KML (the same file Kaun converts in `scripts/generate-gba-wards.mjs`) | Ward numbers restart in each corporation, so the corporation id is part of the key. Corporation ids 1–5 are Central/North/East/South/West. |
| `bbmp243` | `bbmp243:<ward_no>` | DataMeet `Municipal_Spatial_Data/Bangalore/BBMP.geojson` | 2022 delimitation |
| `bbmp198` | `bbmp198:<ward_no>` | DataMeet `BBMP_oldWards.geojson` | 2010 wards. Most pre-2022 budget documents refer to these. |

Steps:
1. Fetch the source files into `data/wards/<scheme>/source/` with a
   `SOURCE.md` recording the URL, retrieval date and licence.
2. Write `scripts/build-wards.mjs`. It converts KML to GeoJSON (Kaun's
   `scripts/lib/kml.mjs` is MIT-licensed and can be reused), normalises the
   properties to `{code, name, name_kn, corporation, assembly_constituency}`,
   and writes:
   - `data/wards/<scheme>/wards.geojson`: full resolution, used for spatial joins
   - `public/geo/wards-<scheme>.json`: simplified with mapshaper, targeting
     roughly 300 KB. Kaun's full file is 3.8 MB, far too heavy for phones on a
     WhatsApp link.
3. **Crosswalk.** Either reuse Kaun's
   `data/ward-crosswalk/gba2025_369_to_datameet_243.json` and
   `bbmp2010_198_to_datameet_243.json`, which are CC BY-SA 4.0 and so have
   share-alike implications, or re-derive them with a small area-overlap
   script. Area overlap is about 50 lines with `@turf/intersect`, and its
   licence would be ours. Decide in Plan 0.

## 2. Project geometry

Store geometry in `data/geometry/<project-id>.geojson`, with
`project.geometry_basis` recording where it came from:

| Category | Geometry | Source |
| --- | --- | --- |
| Metro lines, open sections | LineString + station Points | OpenStreetMap (`railway=subway`, route relations), ODbL. Record the OSM relation id. |
| Metro lines under construction | LineString | BMRCL DPR alignment maps, traced by hand; basis `approximate` |
| Roads, flyovers, PRR, tunnel | LineString | OSM where built; DPR or notification maps where not |
| Lakes | Polygon | OSM `natural=water` |
| Parks | Polygon | OSM `leisure=park` |
| Water, STPs, depots | Point | Agency documents |
| Programmes (e-buses, white-topping) | none, or a MultiPoint of sites | Show on the map only if sites are known |

Rule (spec §5.1): **where the alignment is unknown, store a Point and set
`geometry_basis: "approximate"`.** Never draw a line we can't source.

Helper: `scripts/fetch-osm-geometry.mjs <project-id> <osm-relation-id>`,
using the Overpass API. It writes the file and records the relation id and
retrieval date, so the geometry can be traced like any other figure.

## 3. Assigning wards to projects

`scripts/assign-wards.mjs`:
- Buffers each geometry (40 m for lines, following Kaun's "within 40 m of the
  alignment" rule; none for polygons and points), intersects it with every
  ward scheme, and writes the resulting `wards` array and `ward_basis`.
- Sets `corporation` from the GBA wards. Where a project spans several
  corporations, add `corporations[]`. This replaces the current "Central as
  placeholder" on `metro-phase-2`.
- Runs in CI and fails if the committed `wards` array doesn't match what the
  script computes, so derived data can't drift from the geometry.

## Definition of done

- All 3 ward schemes are in `data/wards/`, each with a source note and licence.
- Every existing project has either geometry or an explicit
  `geometry_basis: "unknown"`.
- Every project with geometry has computed `wards` and `corporation`.
- The validator rejects unknown ward codes.

## Issues to open

- [ ] Import GBA 369 wards (OpenCity KML)
- [ ] Import BBMP 198 and 243 wards (DataMeet)
- [ ] Crosswalk: reuse Kaun's or re-derive (licence decision)
- [ ] `fetch-osm-geometry` script
- [ ] Geometry for the 14 metro projects
- [ ] Geometry for roads (PRR, tunnel, Varthur–Gunjur, Alpine Eco)
- [ ] Geometry for BSRP, Cauvery Stage 5, lake, park
- [ ] `assign-wards` script + CI check
