# Plan 0: Foundations (unblocks everything else)

**Roadmap goal:** G0. **Spec:** §7, §8.2, §10.1.
**Why first:** every later goal either writes records in a shape that is
expensive to change afterwards, or publishes something that needs a licence
and a named publisher. Getting these settled now is cheap; changing them after
the backfill is not.

## 1. Decisions to close (owner: maintainer)

| Decision | Recommendation | Blocks |
| --- | --- | --- |
| Data licence for `data/` | **ODbL** or **CC BY 4.0**. Check this against the licence of any boundary or crosswalk data we reuse. Kaun's ward crosswalks are CC BY-SA 4.0 (share-alike), so publishing derived ward assignments under plain CC BY may not be compatible. Either re-derive our own crosswalk (see Plan 2) or choose a share-alike-compatible licence. | Plans 2, 3 |
| Publisher of record | A named civic entity rather than an individual (spec §10.1) | Launch |
| Kannada at launch | **Yes**, for interface, status labels and disclaimer (spec §5.6). Set up i18n routing before the map and ward pages exist so they aren't built twice (Plan 7) | Plans 3, 4 |
| Named individuals | **Out** for project content. Elected representatives appear only as "who represents this ward" contact details, never alongside project blame (Plan 5) | Plan 5 |
| Comments / citizen reports | **No** (IT Act intermediary liability, spec §7.1) | — |
| Collaboration outreach | Contact **OpenCity** (BBMP budgets, ward KMLs), **Kaun** (ward data, and Kaun's project cards could use our dataset) and **GTrack** before scraping any of them | Plans 1, 2 |
| Backfill threshold | Track BBMP/GBA works only above about ₹50 cr, or where there is notable public interest | Plan 1 |

## 2. Schema additions (all additive, so existing records stay valid)

- `event.type` += `announced`, `completed`, `cancelled`, `resumed`
- `event.previous_deadline`, `event.new_deadline`: optional dates. Once the
  project page reads these, the validator should require them on
  `deadline_revised` events.
- `money_entry.budget_head`: optional string
- `project.corporation` += `BBMP` (for records that predate GBA)
- `project.wards`: scheme-prefixed codes, e.g. `gba2025:3-41`, `bbmp198:150`
  (see Plan 2)
- `project.geometry_basis`: `surveyed | osm | approximate | unknown`. This lets
  the map say "approximate" rather than drawing a false line (spec §5.1).
- `project.ward_basis`: how the ward list was derived (e.g. "within 40 m
  of the OSM alignment"). This idea comes from Kaun's `wardBasis`.

Geometry is large, so it moves out of the project JSON into
`data/geometry/<project-id>.geojson`. That keeps project diffs readable.

## 3. Tooling

- `scripts/archive-sources.mjs`: submits every source with `archive_url: null`
  to the Wayback Machine's Save Page Now and writes the snapshot URL back.
  Runs by hand and in CI as a warning, not a build failure.
- `scripts/new-record.mjs`: interactive scaffolding for a
  source, money_entry or event. It reduces hand-typed JSON mistakes, which
  matters for contributors who don't write code.
- Validator additions:
  - warn when a `money_entry`'s `fiscal_year` and `as_of` disagree by more
    than a year
  - warn on duplicate figures (same project, kind, amount and date)
  - fail when a ward code doesn't resolve to a known ward
- CI: run `npm run validate` and `npm run build` on every PR (GitHub Actions).
- `CONTRIBUTING.md`: the §4.4 workflow as a checklist, plus the PR-per-document
  convention from Plan 1.

## 4. Hosting

Static hosting on infrastructure already in use (spec §8.2). Cloudflare Pages
and GitHub Pages are both free and both work with the PMTiles approach in
Plan 3. Set up the domain (`nammablr.org`) here.

## Issues to open

- [ ] Decide data licence (check Kaun/OpenCity/DataMeet licence compatibility first)
- [ ] Decide publisher of record
- [ ] Confirm Kannada-at-launch
- [ ] Send outreach to OpenCity, Kaun and GTrack
- [ ] Schema additions PR (event types, deadline fields, budget_head, BBMP, basis fields)
- [ ] `archive-sources` script
- [ ] `new-record` scaffolding script
- [ ] Validator additions
- [ ] GitHub Actions: validate + build on PR
- [ ] CONTRIBUTING.md
