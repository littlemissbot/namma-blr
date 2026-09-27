import type { APIRoute } from "astro";
import {
  getProjects,
  getProjectGeometries,
  latestCost,
  statusGroup,
  agencyLabel,
  isStale,
} from "../../lib/data";
import { label } from "../../i18n";

/**
 * Every project that has geometry, as one FeatureCollection for the map
 * (docs/plans/03-map.md). Each feature carries what the map needs to draw
 * and describe it, so the page needs no other data file.
 */
export const GET: APIRoute = () => {
  const projects = new Map(getProjects().map((p) => [p.id, p]));
  const features = [];
  for (const { projectId, geojson } of getProjectGeometries()) {
    const project = projects.get(projectId);
    if (!project) continue;
    const cost = latestCost(project.id);
    const properties = {
      id: project.id,
      name: project.name,
      agency: project.agency,
      agency_label: agencyLabel(project),
      category: project.category,
      status: project.status,
      status_label: label("status", project.status),
      status_group: statusGroup(project.status),
      confidence: project.confidence,
      geometry_basis: project.geometry_basis ?? "unknown",
      cost_label: cost ? `₹${cost.amount_cr.toLocaleString("en-IN")} cr (${label("kind", cost.kind)})` : "no whole-project cost figure yet",
      verified_on: project.verified_on,
      stale: isStale(project),
      wards: project.wards,
    };
    const parts = geojson.type === "FeatureCollection" ? geojson.features : [geojson.type === "Feature" ? geojson : { type: "Feature", geometry: geojson }];
    for (const part of parts) features.push({ type: "Feature", properties, geometry: part.geometry });
  }
  return new Response(JSON.stringify({ type: "FeatureCollection", features }), {
    headers: { "Content-Type": "application/geo+json" },
  });
};
