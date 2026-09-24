# Plan 6: "What changed" feed and the quarterly cadence

**Roadmap goal:** G6. **Spec:** §5.4, §6; Phase 4.
**Depends on:** Plan 1 (events backfilled). It can start small at any time.

Spec §10.2: "Maintenance is the real cost, not the build." This goal makes
the quarterly promise visible, keeps it cheap to meet, and makes it obvious
when it's missed.

## Feed

- `/changes`: all events in reverse date order, filterable by agency, category
  and ward.
- `/changes.xml` (RSS) and `/changes.json`, so journalists and other civic
  projects can subscribe.
- Per-project and per-ward feeds, which come free from the same endpoint.
- Build these from the Git history too: "record updated" entries taken from
  commits that touch `data/`. This makes the "every change auditable"
  principle (§8.1) visible on the site.

## Cadence machinery

- Sweep windows: **April** (the big one, after the budget), **July**,
  **October** and **January** (§6.1).
- A GitHub Actions scheduled job opens a "Quarterly sweep" issue at each
  window, using the §6.4 checklist and listing every project whose
  `verified_on` falls before the window starts.
- A weekly job (warn-only) checks each source URL for link rot and runs
  `archive-sources` for anything new.
- A changelog lives at `/changelog`, one entry per sweep, naming what changed
  and **what couldn't be verified** (§6.4 step 5).
- The site already has `isStale()` and `nextUpdateDue()` in `src/lib/data.ts`.
  Make sure every page shows "updated quarterly · next update due [date]".

## Issues to open

- [ ] `/changes` page + RSS + JSON
- [ ] Git-history-derived "record updated" entries
- [ ] Scheduled "Quarterly sweep" issue workflow
- [ ] Weekly link-rot check
- [ ] `/changelog` page + first entry
