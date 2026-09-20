import type { APIRoute } from "astro";
import { getProjects, latestCost, overrunPct, slippageMonths } from "../lib/data";

export const GET: APIRoute = () => {
  const rows = getProjects().map((p) => {
    const cost = latestCost(p.id);
    return {
      id: p.id,
      name: p.name,
      agency: p.agency,
      category: p.category,
      status: p.status,
      latest_cost_cr: cost?.amount_cr ?? null,
      overrun_pct: overrunPct(p.id),
      slippage_months: slippageMonths(p),
      verified_on: p.verified_on,
      confidence: p.confidence,
    };
  });
  return new Response(JSON.stringify(rows, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};
