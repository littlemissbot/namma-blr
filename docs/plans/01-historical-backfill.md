# Plan 1: Historical backfill (FY2016-17 to FY2026-27)

**Roadmap goal:** G1. **Spec:** P1, P2, P3, P9; §4.1–4.4; §10.2 ("Perceived partisanship").
**Depends on:** [Plan 0](./00-foundations.md) (schema additions and the archive script).

## Why this goal comes first

Pre-2020 history is the spec's main defence against the site being read as
partisan (P9). The 10-year window from FY2016-17 covers at least two changes of
government in Karnataka, and BBMP's own published budgets are available
from roughly the same point.

Backfilling also means upgrading records, not just adding older ones. Today
36 of the 39 sources are `news`, every project is `medium` confidence, no
source has an `archive_url`, and there are no `released` or `utilised` figures
at all. A backfill that only adds more news rows would make the dataset longer
without making it any more reliable.

## Target: definition of done

| Measure | Today | Target |
| --- | --- | --- |
| Fiscal years with at least one `money_entry` | 11 years, most with 1–2 rows | Every tracked project has an entry, or an explicit "no data" note, for each year it existed from FY2016-17 on |
| Projects at `high` confidence | 0 | At least 12, with every metro project included (this was the spec's Phase 1 bar) |
| Sources with `archive_url` | 0 of 39 | All of them |
| `released` / `utilised` figures | 0 | Every one a CAG or agency report actually states |
| Projects with `original_deadline` | 1 of 22 | Every project that has a publicly stated deadline |
| Events before 2020 | 3 | Every sanction, award, deadline revision and opening in the window |
| Projects | 22 | Roughly 40–50, adding significant 2016–2020 projects (see candidates below) |

## Approach: work source by source, not project by project

A single budget speech or BMRCL annual report covers many projects at once.
Reading each document once and extracting every Bengaluru line from it is
several times cheaper than chasing one project through ten different
documents. It also keeps each PR tied to one citable document, which makes
review much easier.

### Pass order (follows spec §4.1 priority)

1. **Karnataka budget speeches and link documents, FY2016-17 to FY2026-27**
   (finance.karnataka.gov.in). That's 11 documents plus any supplementary
   estimates. They yield `announced` and `sanctioned` rows. Record the budget
   head or line item wherever one is given.
2. **BMRCL annual reports** (every year available in the window). These cover
   physical progress, `revised_cost`, section openings and loan tranches.
   Then do the same for BWSSB, BMTC and BDA.
3. **CAG audit reports on Karnataka** (cag.gov.in, filtered to Karnataka). Look
   for audits covering BBMP, BMRCL, BWSSB or urban development. This is the
   only reliable source of `utilised` figures and of sanctioned-against-spent
   comparisons.
4. **BBMP / GBA budget documents, 2016-17 onward**, taken from the
   corporation's own site. For years that have been taken down, use Wayback
   snapshots of the official URLs, then RTI. These give corporation-level
   works: roads, drains and lakes. Third-party mirrors (such as OpenCity) are
   used only if a year can't be recovered any other way, and the reason is
   noted on the source record (per the [Plan 0](./00-foundations.md)
   decision).
5. **Karnataka Legislative Assembly and Council question replies**
   (kla.kar.nic.in). These give project-wise status and deadlines, and are
   usually PDFs.
6. **RTI applications, to fill whatever is still missing.** Plan to file these
   in batches early, because replies take 30 days or more. Use the neutral
   template from Plan 5.
7. **News**, only for events between official releases. News stays `medium`
   confidence and never replaces a primary figure.

### Per-document workflow (extends spec §4.4)

1. Add a `source` record, archive it immediately with
   `npm run archive-sources`, and set `page_ref`.
2. Extract every in-scope figure from the document into `money_entry` or
   `event` rows, with `as_of` set to when the figure was true, not when it
   was published.
3. Where a figure conflicts with one already on file, keep both rows and
   explain the conflict in the project's `notes` (current practice; see
   `metro-phase-2`).
4. Where a definition changes between years (for example, what the
   "Bengaluru grant" covers), set `comparable_to_prior: false` on the later
   row (P3).
5. When a primary source now backs a project, raise its confidence from
   `medium` to `high` only if the validator's doc_type rule allows it.
6. Update the project's `verified_on`.
7. Open one PR per source document, titled after the document, e.g.
   "Backfill: Karnataka Budget 2018-19".

### Tracking progress

Add a **coverage matrix** (projects × fiscal years) built at build time from
`data/`. Each cell is either empty, has a figure (showing its confidence), or
carries an explicit "no data found" marker. It serves two purposes:

- **Internally,** it shows which backfill work remains and makes a good
  "good first issue" board for contributors.
- **Publicly,** as `/coverage`, it puts P2 into practice: missing data is shown,
  not hidden.

## Candidate projects to add for 2016–2020

Each of these needs a primary source before it is added, and every item on this
list is unverified until sourced:

- BDA steel flyover (Basaveshwara Circle to Hebbal), announced and then cancelled
- BBMP white-topping programme (multiple phases)
- TenderSURE road packages
- Ejipura (Koramangala) elevated corridor
- Shivananda Circle steel bridge
- Elevated corridors proposal (KRDCL)
- Satellite Town Ring Road (Bengaluru section)
- BWSSB sewage treatment plant programme
- Bellandur and Varthur lake rejuvenation (including NGT-ordered works)
- Stormwater drain remodelling programmes

## Schema changes this goal needs

These are specified in [Plan 0](./00-foundations.md), and all are additive, so no
existing record breaks:

- `event.type`: add `announced`, `completed`, `cancelled` and `resumed`. The
  2016–2020 window contains cancellations such as the steel flyover, which the
  current enum can't express.
- `event.new_deadline` and `event.previous_deadline` (optional dates). These
  let the project page show a structured deadline history rather than one
  hidden in summary prose (spec §5.3).
- `money_entry.budget_head` (optional string), for budget line references.
- `corporation`: add `BBMP` for records that predate GBA.
- Ward codes: add a scheme prefix (see Plan 2).

## Issues to open

- [ ] Archive all 39 existing sources (depends on the Plan 0 script)
- [ ] Backfill from Karnataka Budget 2016-17 … 2026-27: one issue per year, 11 in total
- [ ] Backfill from BMRCL annual reports: one issue per report
- [ ] Backfill from BWSSB, BMTC and BDA annual reports
- [ ] CAG sweep: list the Karnataka audit reports in the window that mention in-scope agencies
- [ ] Assembly question sweep: metro, PRR, Cauvery Stage 5, suburban rail
- [ ] First RTI batch: original deadlines for all BMRCL corridors
- [ ] Coverage matrix page (`/coverage`)
- [ ] Add candidate projects, one PR per project, each with a primary source

## Risks

- **Scope creep into BBMP ward-level works.** Thousands of small works would
  swamp the dataset. For now, add only projects above a threshold (proposal:
  ₹50 cr) or ones with notable public interest. Record the threshold in
  `about-the-data`.
- **Manual effort.** Government portals serve PDFs badly to scripts (§4.2).
  Plan for manual extraction, and treat any scraper as a helper that saves
  time rather than as the source of truth.
- **Budget speech figures are `announced`, not `sanctioned`.** Label them
  correctly (P1), because it's the most common mistake in this kind of data.
