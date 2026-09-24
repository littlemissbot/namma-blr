# Plan 7: Kannada

**Roadmap goal:** G7. **Spec:** §5.6, §9 ("retrofitting localisation is far more
expensive than building for it").
**Status:** good to have, not a launch blocker (Plan 0 decision).
**Cheap step to take now:** as Plans 3 and 4 add pages, put every interface
string in `src/i18n/en.json` instead of hard-coding it. That keeps the
spec's warning about expensive retrofits from applying, whenever Kannada
lands.

## Approach

- Use Astro's built-in i18n routing (`astro.config.mjs` `i18n`): `en` as the
  default and `kn` under `/kn/`.
- Keep interface strings in `src/i18n/{en,kn}.json`. Status, kind and
  confidence labels are translated once, centrally.
- Data stays in English. Add optional `name_kn` to projects. Take Kannada ward
  names from the official delimitation notification where it gives them
  (Plan 2).
- Have a native speaker review the disclaimer, status labels, and the letter
  and RTI templates. Machine translation must not go straight to the site for
  these texts.
- Load a Kannada-capable font (Noto Sans Kannada; @fontsource has a subset),
  because Zilla Slab and IBM Plex don't include Kannada script.

## Minimum scope when it ships (spec §5.6)

Interface, disclaimer and project status labels.

## Issues to open

- [ ] Now: move interface strings into `src/i18n/en.json` (no routing yet)
- [ ] Later: i18n routing + `kn` strings + language switcher
- [ ] Kannada font subset
- [ ] Translate interface, status labels and disclaimer, with native-speaker review
- [ ] `name_kn` for projects
