import type { APIRoute } from "astro";
import { getProjects, latestCost, overrunPct, slippageMonths } from "../lib/data";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const COLUMNS = [
  "id",
  "name",
  "agency",
  "category",
  "status",
  "latest_cost_cr",
  "overrun_pct",
  "slippage_months",
  "verified_on",
  "confidence",
] as const;

export const GET: APIRoute = () => {
  const rows = getProjects().map((p) => {
    const cost = latestCost(p.id);
    return {
      id: p.id,
      name: p.name,
      agency: p.agency,
      category: p.category,
      status: p.status,
      latest_cost_cr: cost?.amount_cr ?? "",
      overrun_pct: overrunPct(p.id) ?? "",
      slippage_months: slippageMonths(p) ?? "",
      verified_on: p.verified_on,
      confidence: p.confidence,
    };
  });

  const lines = [
    COLUMNS.join(","),
    ...rows.map((row) => COLUMNS.map((col) => csvEscape(row[col])).join(",")),
  ];

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=projects.csv",
    },
  });
};
