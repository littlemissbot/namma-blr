# Contributing to NammaBLR

Thanks for helping. Most contributions are **data**: adding figures, events
and sources from a document. You don't need to write code to do that. You
edit small JSON files, and the validator checks your work.

Before anything else, read the editorial principles (P1–P9) in the
[build spec](./Bengaluru%20Infrastructure%20Accountability%20Tracker%20%E2%80%94%20Build%20Spec.pdf) §2.
They aren't style preferences. They are what keeps the site accurate and
defensible.

## One PR per source document

Work document by document, not project by project. Read one budget document,
annual report, audit report or Assembly reply, and add **every** in-scope figure
from it in a single PR titled after the document, e.g.
`Backfill: Karnataka Budget 2018-19`. See
[`docs/plans/01-historical-backfill.md`](./docs/plans/01-historical-backfill.md)
for the order we're working through documents in.

## Checklist for a data PR (spec §4.4)

- [ ] **Find the primary document.** The priority order is: budget
      document → CAG audit → agency annual report → Assembly reply → RTI
      reply → news. Data from OpenCity, Kaun or GTrack is used only when no
      official source exists, and the source record must say why.
- [ ] **Add a source** in `data/sources/S<next number>.json` with `doc_type`,
      `url`, `page_ref` (page or section, for PDFs), `published_on` and
      `retrieved_on`.
- [ ] **Archive it.** Run `npm run archive-sources -- --save`, or paste a
      [Wayback](https://web.archive.org/save) snapshot into `archive_url`
      yourself. The weekly archive workflow also catches any you miss.
- [ ] **Add figures** in `data/money_entries/`, one file per figure:
  - `kind` must say what the number *is*: announced, sanctioned, revised
    cost, bid, released or utilised. These are never the same thing (P1,
    P2). A budget speech figure is `announced`, not `sanctioned`.
  - `as_of` is when the figure was true, not when you read it.
  - `budget_head` is the line item as printed, if there is one.
  - Set `comparable_to_prior: false` if the definition changed from earlier
    years (P3).
- [ ] **Add events** in `data/events/` for dated developments. The summary
      is one factual sentence with no reasons or blame (P5). A
      `deadline_revised` event gets `new_deadline` (and `previous_deadline`
      if the source states it).
- [ ] **Conflicts:** if your figure disagrees with one already on file, keep
      both and explain the conflict in the project's `notes`. Never overwrite.
- [ ] **Confidence:** raise a project to `high` only when a primary
      document (budget, audit, Assembly reply, RTI) now backs it. The
      validator enforces this.
- [ ] **Update the project's `verified_on`** to today.
- [ ] **Run `npm run validate`** and fix errors. Read the warnings too:
      they flag likely typos and missing archives.

## File naming

One record per file, named after what it is:
`data/money_entries/<project-id>-<what>-<year>.json`,
`data/events/<project-id>-<what>-<year>.json`. Project files are
`data/projects/<project-id>.json`, and the id is a lowercase slug.

## What we don't accept

- Claims about why something is delayed, or about anyone's intent (P5)
- Figures sourced only from social media or unattributed claims
- Contractor rankings or allegations of wrongdoing
- Named officials in project content

## Code contributions

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # validates, then builds
```

CI runs the validator and build on every PR. The roadmap and per-goal plans
are in [`docs/ROADMAP.md`](./docs/ROADMAP.md). Pick an unchecked item from a
plan's "Issues to open" list.
