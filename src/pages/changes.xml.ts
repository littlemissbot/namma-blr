import type { APIRoute } from "astro";
import { getChanges, agencyLabel, EVENT_TYPE_LABEL } from "../lib/data";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** RSS 2.0 feed of every recorded event, newest first (spec §5.4). */
export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL("https://nammablr.vercel.app");
  const changes = getChanges();
  const items = changes
    .map(({ event, project, source, id }) => {
      const link = new URL(`/projects/${project.id}`, base).href;
      const attribution = source ? ` Source: ${source.publisher} (${source.doc_type.replace(/_/g, " ")}).` : "";
      return `    <item>
      <title>${escape(`${EVENT_TYPE_LABEL[event.type]}: ${project.name}`)}</title>
      <link>${escape(link)}</link>
      <guid isPermaLink="false">${escape(id)}</guid>
      <pubDate>${new Date(event.date).toUTCString()}</pubDate>
      <category>${escape(agencyLabel(project))}</category>
      <description>${escape(event.summary + attribution)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>NammaBLR: what changed</title>
    <link>${escape(new URL("/changes", base).href)}</link>
    <atom:link href="${escape(new URL("/changes.xml", base).href)}" rel="self" type="application/rss+xml" />
    <description>Dated developments on Bengaluru infrastructure projects (sanctions, tenders, awards, cost and deadline revisions, openings), each with its source.</description>
    <language>en-in</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
