# Ward boundaries

One folder per ward scheme (see `docs/plans/02-geometry-and-wards.md`):

| Folder | Scheme | Code format |
| --- | --- | --- |
| `gba2025/` | Wards of the five GBA corporations (2025) | `gba2025:<corporation_id>-<ward_no>` |
| `bbmp243/` | BBMP 243 wards (2022 delimitation) | `bbmp243:<ward_no>` |
| `bbmp198/` | BBMP 198 wards (2010) | `bbmp198:<ward_no>` |

Official sources come first. Third-party files are a last resort, and the reason
for using one is recorded in that scheme's `SOURCE.md`.

## Importing a scheme

1. Put the raw file in `<scheme>/source/`. It can be `.kml`, `.shp` (with its
   `.dbf`/`.prj` alongside), `.geojson` or `.json`.
2. Write `<scheme>/SOURCE.md` with the URL or RTI reference, the date
   received, and the licence.
3. Write `<scheme>/mapping.json` to say which source fields hold what:

   ```json
   {
     "source_file": "source/wards.shp",
     "source_crs": "+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs",
     "simplify": "10%",
     "fields": {
       "ward_no": "WARD_NO",
       "name": "WARD_NAME",
       "name_kn": "WARD_NAME_KN",
       "corporation_id": "CORP_ID",
       "corporation": "CORP_NAME",
       "assembly_constituency": "AC_NAME"
     },
     "corporations": { "1": "Central", "2": "North", "3": "East", "4": "South", "5": "West" }
   }
   ```

   - Only `source_file` and `fields.ward_no` are required.
   - `source_crs` is needed only when the file isn't in longitude/latitude
     (WGS84). You can find it in the shapefile's `.prj`. KGIS layers are often
     in UTM zone 43N.
   - `gba2025` also needs either `corporation_id`, or `corporation` plus the
     `corporations` table. The id-to-name numbering must match the official
     notification.
4. Run:

   ```sh
   npm run build-wards -- <scheme>   # writes <scheme>/wards.geojson and public/geo/wards-<scheme>.json
   npm run build-crosswalk           # writes crosswalk/<from>__<to>.json between imported schemes
   npm run assign-wards              # recomputes every project's wards from data/geometry/
   npm run validate
   ```

`wards.geojson` is the full-resolution file used for the calculations.
`public/geo/wards-<scheme>.json` is simplified for phones; it keeps
neighbouring wards gap-free, so don't edit it by hand.

## Crosswalks

`crosswalk/<from>__<to>.json` lists every pair of overlapping wards, with the
share of each ward that the overlap covers. It's built by us from the
committed boundaries, so it carries the same licence as the rest of `data/`.
Overlaps under 1% of both wards are dropped, because two independently drawn
maps never line up exactly.
