# Source: GBA 369 wards (2025)

- **File:** `source/gba-369-wards-december-2025.geojson`
- **Original:** OpenCity, "GBA 369 wards — December 2025" (KML),
  https://data.opencity.in/dataset/863209cb-4ced-4f51-b5c5-156939c50922/resource/9013d656-8051-4e2d-9648-46efd0d86d3d/download/gba-369-wards-december-2025.kml
- **Copy used:** the GeoJSON conversion of that KML published in the KAUN
  repository (https://github.com/kaun-city/kaun, `apps/web/public/bengaluru-gba-369.geojson`,
  commit `c54918e`, 2026-09-20), produced by its MIT-licensed
  `scripts/generate-gba-wards.mjs`. Geometry and attributes are OpenCity's.
- **Retrieved:** 2026-10-04
- **What it is:** the 369 wards of the five city corporations constituted under
  the Greater Bengaluru Authority (Central 63, North 72, East 50, South 72,
  West 112), with ward and corporation names in English and Kannada, assembly
  constituency, population, division and zone. Ward numbers restart in each
  corporation, so ward codes are `gba2025:<corporation_id>-<ward_no>`.
- **Licence:** OpenCity datasets are published under CC BY 4.0 (as stated by
  KAUN; not re-checked at source because data.opencity.in is unreachable from
  the build environment). Attribution: *GBA ward boundaries, OpenCity
  (opencity.in), CC BY 4.0.*

## Why a third-party file

Primary sources come first (docs/ROADMAP.md, data sourcing policy). The
official sources (the GBA / Urban Development Department delimitation and the
KGIS portal) couldn't be reached from the build environment on 2026-10-04, and
the RTI for the official boundary files (docs/rti/2026-10-gba-ward-boundaries.md)
hasn't been answered. The maintainer approved using this file in the meantime.

**Swap plan:** when the official file arrives, replace `source/`, update
`mapping.json` and this note, and re-run `npm run build-wards -- gba2025`.
Ward codes don't change, so project records stay valid.
