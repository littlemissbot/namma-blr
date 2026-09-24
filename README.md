# NammaBLR

A public, free site tracking what Karnataka's agencies (BMRCL, BMTC, BDA, BWSSB,
K-RIDE, B-SMILE, GBA and the city corporations) have committed to building in
Bengaluru — cost, schedule slippage, and pending status — sourced from budget
documents, audit reports, agency reports, Assembly replies, RTI responses and
credible news, each figure carrying its own source, date and confidence level.

Planned domain: **nammablr.org** ("Namma Bengaluru" itself was not available).

Full spec: [`Bengaluru Infrastructure Accountability Tracker — Build Spec.pdf`](./Bengaluru%20Infrastructure%20Accountability%20Tracker%20%E2%80%94%20Build%20Spec.pdf).
Read it before making schema or scope changes — the editorial principles in §2 (P1–P9)
drive the data model and are not optional style preferences.

## Status

Early Phase 1: 22 projects across 7 agencies and all 6 categories, backed by 39
sources, 35 money entries and 29 events — see `data/projects/` for the live count.
All records are currently `medium` confidence (news-sourced); upgrading individual
records to `high` confidence means re-sourcing them against a primary document
(budget document, audit report, Assembly reply, RTI response), not just adding more
news coverage. Nothing here should yet be treated as launch-ready content — legal
review and the Kannada decision (below) are still outstanding.

## Data model

Four entities as flat JSON files under `data/`, validated against JSON Schemas in
`schema/`:

| Entity        | Directory             | Schema                            |
| ------------- | ---------------------- | ---------------------------------- |
| `project`     | `data/projects/`       | `schema/project.schema.json`       |
| `money_entry` | `data/money_entries/`  | `schema/money_entry.schema.json`   |
| `event`       | `data/events/`         | `schema/event.schema.json`         |
| `source`      | `data/sources/`        | `schema/source.schema.json`        |
| `correction`  | `data/corrections.json`| `schema/correction.schema.json`    |

Ward boundary geometry (both pre-GBA BBMP wards and the new five-corporation
divisions, per spec §8.3) belongs under `data/wards/` — not populated yet, needed for
Phase 3 (ward filtering).

One file per record, named after its id (e.g. `data/projects/metro-phase-2.json`), so
diffs stay small and reviewable at a single commit — that reviewability is itself part
of the point (spec §8.1: the site holds itself to the standard it asks of the
government).

A single figure is rarely the whole story: where sources genuinely conflict (e.g. two
outlets reporting different revised costs for the same project) or a figure needs
context a schema field can't hold, that's recorded in the project's own `notes` field
rather than silently picked or dropped.

## Validation

```sh
npm run validate
```

Runs before every `npm run build`. Enforces spec §8.4 mechanically:

- every `money_entry` and `event` has a `source_id` that resolves to a real source
- every `source` has `retrieved_on`
- every `project` has `verified_on`
- a project's `confidence` is consistent with the `doc_type` of the sources backing it
  (see the doc_type → confidence mapping in spec §3.4/§4.1)

A build with invalid or under-sourced data fails.

## Site

Built with [Astro](https://astro.build) as a static site — no runtime database, data
lives entirely in this Git repo. Design is a "civic ledger" system (kraft-paper
palette, Zilla Slab + IBM Plex Sans, a Namma Metro-style stage tracker for project
status) — see `src/styles/global.css` for the token system shared across pages.

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # validates, then builds to ./dist
npm run preview   # serve the built ./dist locally
```

Pages: a homepage with live-computed totals and a filterable case-file grid, a
sortable/filterable project table with CSV/JSON export, per-project pages with a
money timeline and numbered source ledger, an about/disclaimer page, and a public
corrections log.

## Build phases (spec §9)

The current roadmap, which breaks these phases into goals with a plan of action for
each, is in [`docs/ROADMAP.md`](./docs/ROADMAP.md).


1. **Metro only.** Table + project pages, no map. *(Underway — broadened to 7
   agencies ahead of schedule; map deliberately not started yet, per the spec's own
   warning that thin data looks falsely authoritative on a map.)*
2. **Map + remaining agencies.** Geometry for metro lines/corridors, agency layer
   toggles, status colouring.
3. **Ward filtering + representative tools.** Ward-scoped views, generated summaries,
   letter/RTI templates.
4. **Event feed + pre-2020 history.** Ongoing, not a finite deliverable.

## Open decisions (spec §10.1) — not yet resolved

- Kannada at launch, or English first? *Good to have, not a launch blocker;*
  interface strings will be kept in one file so adding it later stays cheap.
- Named individuals in project content: spec recommends **out** — projects and
  agencies only.
- Who is the publisher of record (named individual, or a separate civic entity)?
  Affects legal exposure and perceived political framing. *Good to have, not a
  launch blocker.*
- **Decided:** data from other Bengaluru civic-data projects
  ([OpenCity](https://opencity.in), [GTrack.in](https://www.gtrack.in),
  [KAUN](https://kaun.city)) is not used unless necessary, meaning only when no
  official or primary source can be found (including through RTI), and any such use
  is recorded with its reason. Ward crosswalks are derived in-house. See
  [`docs/ROADMAP.md`](./docs/ROADMAP.md#data-sourcing-policy).
- Comments / citizen reports: spec recommends **no**, at least initially — changes the
  IT Act intermediary-liability position.

**Before Phase 1 ships:** legal review of the disclaimer draft in `content/disclaimer.md`
(spec p.12).

## Contributing

Follow the collection workflow in spec §4.4: locate the primary document → extract
figures with page references → snapshot the URL (Wayback) → record `as_of` and
`retrieved_on` → set `confidence` from `doc_type` → flag any conflict with an existing
figure in `notes` rather than overwriting it. Run `npm run validate` before opening a
PR.

## License

Code is MIT-licensed (see `LICENSE`). The data license for `data/` is not yet decided
— the spec recommends an open data licence (CC BY or ODbL) once the dataset is
launch-ready (spec §8.2); until then, treat `data/` as available for the same MIT
terms as the rest of the repo, not as a separately-guaranteed open dataset.
