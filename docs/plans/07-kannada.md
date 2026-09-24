# Plan 7: Kannada

**Roadmap goal:** G7. **Spec:** §5.6, §9 ("retrofitting localisation is far more
expensive than building for it").
**Timing:** set up the routing **before** Plans 3 and 4 add new pages. Translate
content alongside them.

## Approach

- Use Astro's built-in i18n routing (`astro.config.mjs` `i18n`): `en` as the
  default and `kn` under `/kn/`.
- Keep interface strings in `src/i18n/{en,kn}.json`. Status, kind and
  confidence labels are translated once, centrally.
- Data stays in English. Add optional `name_kn` to projects. Ward names already
  come with Kannada in the GBA source data (Plan 2).
- Have a native speaker review the disclaimer, status labels, and the letter
  and RTI templates. Machine translation must not go straight to the site for
  these texts.
- Load a Kannada-capable font (Noto Sans Kannada; @fontsource has a subset),
  because Zilla Slab and IBM Plex don't include Kannada script.

## Minimum at launch (spec §5.6)

Interface, disclaimer and project status labels.

## Issues to open

- [ ] i18n routing + string files + language switcher
- [ ] Kannada font subset
- [ ] Translate interface, status labels and disclaimer, with native-speaker review
- [ ] `name_kn` for projects
