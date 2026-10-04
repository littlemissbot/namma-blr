# Places

Context layers for the map that aren't projects.

## `lakes.geojson`

Every named lake, tank (*kere*) and reservoir within roughly 50 km of
Bengaluru, one point per lake, from OpenStreetMap. Refresh with:

```sh
npm run fetch-lakes
```

Each point has the lake's name (and Kannada name where mapped), kind, OSM id
and an approximate size taken from its bounding box (an upper bound, not a
surveyed area). The map adds the distance from the city centre and the
Greater Bengaluru ward the lake sits in, at build time (`src/pages/geo/lakes.json.ts`).

Licence: ODbL 1.0, © OpenStreetMap contributors.
