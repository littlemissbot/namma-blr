# Plan 5: Ask your representative (letters and RTI templates)

**Roadmap goal:** G5. **Spec:** §5.5, §7.2; Phase 3.
**Depends on:** Plan 4 (ward → representative mapping), Plan 0 (named-individuals decision).

## Scope

For any project, or for all the projects in a ward, the site generates:
- a **factual summary**: status, the latest figure of each kind with its
  source, deadline history, what is pending, and the verified-on date
- a **letter template** to the corporator, MLA or agency asking for
  **information and status**, not making accusations (spec §5.5)
- an **RTI application template** under RTI Act s.6(1), addressed to the right
  agency's Public Information Officer (PIO). It lists specific questions
  generated from the data we're missing, e.g. "`utilised`: no data" becomes
  "Please provide the amount spent on X as of [date]."

The RTI template fills gaps in our own dataset. Readers who file RTIs and
share the replies become a source for Plan 1, reviewed by a maintainer before
anything is added.

## Content rules

- Templates are fixed, reviewed text with slots filled from the data. They are
  never free-generated. **No LLM-written letters.** Kaun has an OpenAI chatbot,
  but we don't want generated text going out under a reader's name.
- Every generated figure keeps its kind, source and as-of date (P1, P6).
- Counsel reviews the templates before launch (added to the Plan 0 legal
  questions).
- Output is copy-to-clipboard, printable, or a `mailto:` link. **Nothing is
  sent through our servers.**

## Representative data

- Represent **roles**, not people, in project content: e.g. "MLA, Shivajinagar
  AC". Where a name and contact are shown on a ward page, source them from ECI
  or GBA records, give them an as-of date, and never put them next to delay
  data in a way that implies blame (spec §7.2).
- Map AC to ward using the `assembly_constituency` property that already comes
  with the GBA ward data (Plan 2).
- PIO addresses for each agency go in `data/agencies/<agency>.json`, with a
  source for each.

## Issues to open

- [ ] Agency PIO directory with sources
- [ ] Summary generator (pure function over `src/lib/data.ts`)
- [ ] Letter template (English; Kannada when Plan 7 lands) and counsel review
- [ ] RTI template (English; Kannada when Plan 7 lands) with gap-driven questions
- [ ] "Ask about this" panel on project and ward pages
- [ ] Intake process for reader-shared RTI replies (email, reviewed, then a normal source PR)
