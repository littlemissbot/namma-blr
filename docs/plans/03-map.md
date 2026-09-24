# Plan 3: Project map

**Roadmap goal:** G3. **Spec:** §5.1, §8.2; Phase 2.
**Depends on:** Plan 2 (geometry). Also gated on data quality (see below).

## How this differs from Kaun's map

Kaun's map (Leaflet + OSM tiles) colours **wards** by indicators such as MLA
fund utilisation, attendance and criminal cases. It also has click-to-pin,
"my location" and search to pick a ward. It has **no layer for
infrastructure projects**: its six project cards have no geometry.

NammaBLR's map is the other half. It shows **projects as lines, points and
polygons**, coloured by status. We borrow Kaun's ward-picking interaction
*ideas* (Plan 4), but not its data or its indicator layers (see the roadmap).

## Launch gate (spec §9: "thin data on a map looks authoritative")

Ship the public map only when both are true:
- every project on the map has sourced geometry or is visibly marked as
  approximate
- at least all metro projects are at `high` confidence (the Plan 1 target)

Until then the map can be a preview route, unlisted and marked as a preview.

## Stack

- **MapLibre GL JS** (spec §8.2). It renders vector data on the GPU and
  styles dashed or low-confidence lines natively.
- **Basemap:** a Protomaps **PMTiles** extract of Bengaluru, served as a static
  file from our own host. There are no usage-billed tile APIs to be
  "weaponised by traffic" (spec §8.2). Attribution: © OpenStreetMap
  contributors. A muted style fits the kraft-paper palette in
  `src/styles/global.css`.
- **Project data:** a build-time endpoint, `src/pages/geo/projects.geojson.ts`,
  merges `data/geometry/*` with the derived fields from `src/lib/data.ts`:
  status, latest cost, overrun, confidence and slippage. It is one small file,
  so no tiling is needed.
- **Integration:** an Astro island (`client:visible`) on `/map`, and a small
  inset map on each project page. The table and project pages keep working
  without JavaScript.

## Behaviour (spec §5.1)

- **Colour by status**, not agency, using the same stage colours as
  `StageTracker.astro`. Agency is a layer toggle.
- **Confidence on the marker:** solid for high, dashed for medium, dotted
  outline for low. `approximate` geometry gets a hatched halo and says
  "approximate location".
- **Hover:** name, latest cost (with its kind label, per P1) and status.
- **Click:** a card with the money summary, verified-on date and a link to
  the project page.
- **Filters:** agency, category, status, a "stale" toggle (P7), and a ward
  (Plan 4).
- **URL state:** `?agency=&status=&ward=&project=`, so any view can be shared
  on WhatsApp.
- **Mobile first:** a bottom sheet instead of a sidebar, and large touch
  targets.
- **Accessibility:** every map view has a linked table equivalent. Colours are
  never the only signal: patterns and labels are also used.

## Issues to open

- [ ] PMTiles Bengaluru extract + muted style JSON
- [ ] `/geo/projects.geojson` build endpoint
- [ ] `/map` page (MapLibre island, layers, legend)
- [ ] Status colours + confidence line styles shared with StageTracker
- [ ] Hover and click cards
- [ ] URL-synced filters
- [ ] Project-page inset map
- [ ] Performance budget: under 250 KB of JS and under 1.5 MB of first-load
  map data on 4G
