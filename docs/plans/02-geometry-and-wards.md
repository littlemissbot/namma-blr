# Plan 2: Geometry and ward data

**Roadmap goal:** G2. **Spec:** §5.1, §8.3; Phase 2/3.
**Depends on:** Plan 0 (licence decision, schema fields).
**Can run in parallel with:** Plan 1 (backfill).

Today, no project has geometry or wards. The map (Plan 3) and the "my ward" view
(Plan 4) both need this data layer first.

**Sourcing rule (Plan 0 decision):** boundaries come from official or primary
sources. Third-party civic datasets (OpenCity, Kaun, GTrack) are a last resort,
used only when no official file can be obtained, with the reason written into
that scheme's `SOURCE.md`. Crosswalks and ward assignments are always derived
in-house.

## 1. Ward boundaries

Keep **both** boundary sets (spec §8.3), with a scheme prefix on every code:

| Scheme | Code format | Source | Notes |
| --- | --- | --- | --- |
| `gba2025` | `gba2025:<corporation_id>-<ward_no>` | The Karnataka government's 2025 GBA ward delimitation: the final notification in the Karnataka Gazette and its ward maps, plus any GIS layer published on the state GIS portal, KGIS (spec §8.3). | Ward numbers restart in each corporation, so the corporation id is part of the key. Corporation ids 1–5 are Central/North/East/South/West. |
| `bbmp243` | `bbmp243:<ward_no>` | The 2022/2023 BBMP delimitation notification and maps. If no machine-readable layer is published, use DataMeet's municipal spatial data (an open-data community project, not one of the three excluded datasets); check its licence. | 2022 delimitation |
| `bbmp198` | `bbmp198:<ward_no>` | The 2010 BBMP ward maps. As with 243, fall back to DataMeet if nothing official is machine-readable. | 2010 wards. Most pre-2022 budget documents refer to these. |

**Getting official GIS files.** Delimitation notifications are usually
published as PDF maps and written boundary descriptions, not shapefiles. In
order:
1. Look for a published layer on KGIS or the GBA / Urban Development
   Department sites.
2. File an RTI with GBA / UDD / KSRSAC asking for the ward boundary shapefile
   or KML. Do this early, because replies take 30 days or more.
3. If only PDF maps exist, georeference and digitise them, using the written
   boundary descriptions and OSM roads as snapping guides. This takes a lot of
   work for 369 wards, but it's feasible as a contributor task split by
   corporation.
4. Last resort: a third-party file, with the reason recorded in `SOURCE.md`.

Steps:
1. Put the source files into `data/wards/<scheme>/source/` with a
   `SOURCE.md` recording the URL (or RTI reference), retrieval date and
   licence.
2. Write `scripts/build-wards.mjs`. It converts the source format (KML,
   shapefile or digitised GeoJSON) to GeoJSON, normalises the properties to
   `{code, name, name_kn, corporation, assembly_constituency}`, and
   writes:
   - `data/wards/<scheme>/wards.geojson`: full resolution, used for spatial joins
   - `public/geo/wards-<scheme>.json`: simplified with mapshaper, targeting
     roughly 300 KB. A full-resolution 369-ward file is several MB, far too
     heavy for phones arriving from a WhatsApp link.
3. **Crosswalk (in-house).** `scripts/build-crosswalk.mjs` computes area
   overlap between every pair of schemes (198 ↔ 243 ↔ GBA 2025) with
   `@turf/intersect` and records each overlap's share in both directions. It
   is about 50 lines, reproducible from the committed boundaries, and
   licensed with the rest of `data/`.

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
- Buffers each geometry (40 m for lines; none for polygons and points), intersects it with every
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

- [ ] Find the GBA 2025 delimitation notification + maps; check KGIS for a GIS layer
- [ ] File RTI for GBA 369-ward boundary shapefile/KML (GBA / UDD / KSRSAC)
- [ ] Import BBMP 198 and 243 wards (official first, DataMeet fallback)
- [ ] `build-crosswalk` script (in-house area overlap)
- [ ] `fetch-osm-geometry` script
- [ ] Geometry for the 14 metro projects
- [ ] Geometry for roads (PRR, tunnel, Varthur–Gunjur, Alpine Eco)
- [ ] Geometry for BSRP, Cauvery Stage 5, lake, park
- [ ] `assign-wards` script + CI check
