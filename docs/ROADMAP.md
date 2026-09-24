# NammaBLR Roadmap

_Drafted 2026-09-24. The build phases in spec §9 still apply; this roadmap
breaks them into goals, each with its own plan of action in
[`docs/plans/`](./plans/)._

## Where we are

| | Today |
| --- | --- |
| Projects | 22 across 7 agencies; 14 of them are metro |
| Money entries / events / sources | 35 / 29 / 39 |
| Confidence | All `medium`. 36 of 39 sources are news. |
| History | Money entries span FY2014-15 to FY2026-27, but most years have only 1–2 rows. 3 events predate 2020. |
| `released` / `utilised` figures | None |
| Archived sources (`archive_url`) | 0 |
| Geometry / ward assignments | 0 / 0 |
| Site | Table, project pages, corrections log, CSV/JSON export |

The two things you asked for, a **5–10 year backfill** and **Kaun-style map
features**, depend on each other. A map over thin, news-only data is exactly
what spec §9 warns against. So the roadmap runs the data work (backfill,
geometry) first and in parallel, and opens the map to the public only once the
data meets the quality bar.

## Goals

| # | Goal | Plan | Spec phase | Depends on |
| --- | --- | --- | --- | --- |
| G0 | **Foundations:** decisions, schema additions, archive tooling, CI | [00](./plans/00-foundations.md) | pre-launch | — |
| G1 | **Historical backfill, FY2016-17 to FY2026-27**, from primary sources | [01](./plans/01-historical-backfill.md) | 1 → 4 | G0 |
| G2 | **Geometry + ward data** (GBA 369, BBMP 243/198, crosswalk) | [02](./plans/02-geometry-and-wards.md) | 2 → 3 | G0 |
| G3 | **Project map** (MapLibre + self-hosted PMTiles) | [03](./plans/03-map.md) | 2 | G2, G1 quality gate |
| G4 | **"My ward"** (locate me, pin, search, ward pages) | [04](./plans/04-my-ward.md) | 3 | G2, G3 |
| G5 | **Ask your representative** (factual letter + RTI templates) | [05](./plans/05-ask-your-representative.md) | 3 | G4 |
| G6 | **What-changed feed + quarterly cadence automation** | [06](./plans/06-change-feed-and-cadence.md) | 4 | G1 |
| G7 | **Kannada** | [07](./plans/07-kannada.md) | cross-cutting | G0 decision; before G3/G4 pages |

## Sequence

Indicative only, since this is volunteer time. Each quarter lines up with a
sweep window from spec §6.1.

```
            Oct–Dec 2026        Jan–Mar 2027        Apr–Jun 2027           Jul–Sep 2027
G0 found.   ██████
G1 backfill   ██████████████████████████████████████████  (ongoing after)
G2 geo/wards      ██████████████
G7 Kannada          ████ routing ·········· translation ·····
G3 map                        ████████ preview ──▶ public (gate)
G4 my ward                                ██████████████
G5 ask rep                                          ████████████
G6 feed         ██ small ····················· ████ cadence automation
```

**Milestones**
1. **M1, Foundations closed (end of Oct 2026):** licence, publisher and
   Kannada decided; schema additions merged; every existing source archived;
   CI running.
2. **M2, Metro at high confidence (Jan 2027 sweep):** all metro projects
   re-sourced to primary documents, with FY2016-17 onward covered. This
   meets the spec's Phase 1 bar.
3. **M3, Geometry complete (Jan 2027):** every project has geometry or a
   stated reason why not, and wards are assigned automatically.
4. **M4, Public launch (Apr 2027 sweep, after the Karnataka budget):**
   map, ward pages, Kannada interface, legal review done.
5. **M5, Action tools (Jul 2027 sweep):** letter and RTI templates, and the
   feed with cadence automation.

## Borrowing from Kaun

[Kaun](https://kaun.city) ([source](https://github.com/kaun-city/kaun)) does
**ward accountability**: who represents you, and what was spent in your ward.
NammaBLR does **project accountability**: what was promised, what it costs,
and how late it is. The two are complementary rather than overlapping. Kaun
has a small typed project model (`apps/web/lib/civic-projects.ts`, six
projects) but no project geometry. NammaBLR's dataset could feed those
project cards, which makes a good case for approaching Kaun as a collaborator
rather than a competitor.

**Adopting** (with attribution and licence checks, see Plan 0):
- Ward picking by geolocation, map pin, or search that includes old ward names (Plan 4)
- The GBA 369-ward GeoJSON pipeline from OpenCity's KML (`scripts/generate-gba-wards.mjs`, MIT) (Plan 2)
- Old-to-new ward crosswalks. They are CC BY-SA 4.0, so reuse means share-alike; the alternative is to re-derive them (Plan 2)
- Project records carrying `affectedWards` together with a stated `wardBasis` (Plan 0 schema, Plan 2)
- Shareable, URL-addressable ward views (Plan 4)

**Not adopting, and why** (each conflicts with the spec, not with Kaun's own
choices):
- **MLA criminal cases, flagged contractors, A–F ward grades.** These are
  out of scope (§1: no allegations, no contractor rankings) and are
  characterisation (P5).
- **Citizen reports and Reddit feeds.** These are user-generated content with
  IT Act intermediary liability (§7.1, §10.1).
- **LLM chatbot.** A generated answer can't guarantee P1: source, date and
  kind on every number.
- **Supabase/PostGIS backend and Leaflet with third-party tiles.** Spec §8.2
  calls for a static site with no runtime database and no usage-billed tiles.
  Ward lookup runs in the browser instead.

## Standing rules for every goal

- Editorial principles P1–P9 and the validator decide what's allowed. A
  feature that would need to relax them doesn't ship.
- Each data PR is tied to one source document and passes `npm run validate`.
- "No data" is displayed, never hidden (P2).
- Mobile first. A phone on 4G, arriving from a WhatsApp link, is the target
  device.
