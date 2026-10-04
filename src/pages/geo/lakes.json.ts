import type { APIRoute } from "astro";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

// Lakes around Bengaluru for the map's lake layer: data/places/lakes.geojson
// (from OpenStreetMap, see scripts/fetch-osm-lakes.mjs) plus, for each lake,
// its distance from the city centre and the GBA ward it sits in, if any.

const lakeFiles = import.meta.glob<string>("/data/places/lakes.geojson", { eager: true, query: "?raw", import: "default" });
const wardFiles = import.meta.glob<string>("/data/wards/gba2025/wards.geojson", { eager: true, query: "?raw", import: "default" });

/** Vidhana Soudha, the usual "city centre" for distances. */
const CENTRE: [number, number] = [77.5907, 12.9796];

function km([lon1, lat1]: number[], [lon2, lat2]: number[]): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export const GET: APIRoute = () => {
  const raw = Object.values(lakeFiles)[0];
  const wardsRaw = Object.values(wardFiles)[0];
  if (!raw) {
    return new Response(JSON.stringify({ type: "FeatureCollection", features: [], loaded: false }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  const lakes = JSON.parse(raw);
  const wards = wardsRaw ? JSON.parse(wardsRaw).features : [];
  const features = lakes.features.map((f: any) => {
    const ward = wards.find((w: any) => booleanPointInPolygon(f.geometry.coordinates, w));
    return {
      ...f,
      properties: {
        ...f.properties,
        distance_km: Math.round(km(CENTRE, f.geometry.coordinates) * 10) / 10,
        ward: ward ? ward.properties.code : null,
        ward_name: ward ? ward.properties.name : null,
        corporation: ward ? ward.properties.corporation : null,
      },
    };
  });
  return new Response(
    JSON.stringify({
      type: "FeatureCollection",
      loaded: true,
      source: lakes.source,
      licence: lakes.licence,
      retrieved_on: lakes.retrieved_on,
      features,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};
