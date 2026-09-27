import type { APIRoute } from "astro";
import { getChanges } from "../lib/data";

/** Machine-readable "what changed" feed: every event, newest first, with its source. */
export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL("https://nammablr.vercel.app");
  const rows = getChanges().map(({ event, project, source, id }) => ({
    id,
    date: event.date,
    type: event.type,
    project_id: project.id,
    project_name: project.name,
    project_url: new URL(`/projects/${project.id}`, base).href,
    agency: project.agency,
    category: project.category,
    summary: event.summary,
    previous_deadline: event.previous_deadline ?? null,
    new_deadline: event.new_deadline ?? null,
    source: source
      ? {
          id: source.id,
          title: source.title,
          publisher: source.publisher,
          doc_type: source.doc_type,
          url: source.url,
          archive_url: source.archive_url ?? null,
        }
      : null,
  }));
  return new Response(JSON.stringify(rows, null, 2), { headers: { "Content-Type": "application/json" } });
};
