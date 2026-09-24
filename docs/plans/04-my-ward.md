# Plan 4: "My ward" view

**Roadmap goal:** G4. **Spec:** §1 ("finds their ward's projects in under a
minute"), §5.1 ("the single highest-value interaction"); Phase 3.
**Depends on:** Plan 2 (wards and project ward assignments), Plan 3 (map).

## Features, modelled on Kaun's ward picker

These are interaction ideas only. The ward data behind them is our own (Plan 2).

| Kaun feature | NammaBLR version |
| --- | --- |
| "My location" (`navigator.geolocation`) | Same. The point-in-polygon check runs **in the browser** against the simplified ward GeoJSON with `@turf/boolean-point-in-polygon`. There's no server (Kaun uses Supabase/PostGIS for this). The location never leaves the phone, and the page says so. |
| Click or drop a pin | Same, using the same client-side lookup |
| Search, including **old ward names** ("Koramangala" finds the new GBA wards covering it) | A build-time search index over GBA ward names, old BBMP 198/243 names (via the crosswalk), locality names and project `aka` values (plus Kannada names once Plan 7 lands) |
| Shareable `?gba_corporation=&gba_ward=` | Static pages instead: `/wards/<corporation>/<ward-no>`. They are statically generated, one per GBA ward (369), which makes them easy to cite and find in search engines. |
| Ward card | A ward page: projects touching the ward, grouped by status, with latest cost, slippage and verified-on for each; "projects in neighbouring wards"; and the ward's corporation and assembly constituency |

## Ward page contents

1. The ward's name, corporation, assembly constituency, and its old BBMP ward
   numbers (via the crosswalk). Budget documents before 2022 use the old
   numbers.
2. Projects that touch this ward, with the same row design as the project
   table.
3. The same projects on a small map, centred on the ward.
4. "What changed here": recent events for these projects (Plan 6).
5. "Ask about these projects" (Plan 5).
6. The ward's `ward_basis` explanation: "A project is listed here if its
   alignment passes within 40 m of the ward."

We also add corporation pages at `/corporations/<name>`, which roll up the
ward pages.

## What this plan leaves out on purpose

- No ward grades or rankings. Kaun's A–F grade mixes MLA and spending
  indicators. That's a valid choice for Kaun, but it's outside our scope (no
  characterisation, P5) and would make a delay look like a verdict.
- No per-ward spending totals built by assigning city-wide project costs to
  wards. That would be a false precision problem (P3).

## Issues to open

- [ ] Client-side ward lookup module (geolocation + pin)
- [ ] Build-time search index (wards, old ward names, projects)
- [ ] `/wards/[corporation]/[ward]` static pages
- [ ] `/corporations/[name]` roll-up pages
- [ ] Ward filter on `/map` and `/projects`
- [ ] Privacy note on the location feature
