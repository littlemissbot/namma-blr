// Loads the flat-file data model (spec §3) at build time and derives the
// read-only view fields the site's pages need (latest cost, overrun %,
// slippage). Validation of the raw records happens separately in
// scripts/validate.mjs — this module assumes clean data.

import { label } from "../i18n";

export type Confidence = "high" | "medium" | "low";

export interface Project {
  id: string;
  name: string;
  aka?: string[];
  agency: string;
  category:
    | "metro_rail"
    | "roads"
    | "buses"
    | "water_sewerage"
    | "drains_lakes"
    | "parks_public";
  scope: string;
  status:
    | "announced"
    | "sanctioned"
    | "tendering"
    | "awarded"
    | "under_construction"
    | "partially_open"
    | "complete"
    | "stalled"
    | "cancelled";
  sanction_date?: string | null;
  original_deadline?: string | null;
  current_deadline?: string | null;
  pending?: string;
  geometry?: unknown;
  geometry_basis?: "surveyed" | "osm" | "approximate" | "unknown";
  wards: string[];
  ward_basis?: string;
  corporation: "Central" | "East" | "North" | "South" | "West" | "outside_GBA" | "BBMP";
  corporations?: ("Central" | "East" | "North" | "South" | "West")[];
  confidence: Confidence;
  verified_on: string;
  notes?: string;
}

export interface MoneyEntry {
  project_id: string;
  fiscal_year: string;
  kind: "announced" | "sanctioned" | "revised_cost" | "bid_received" | "released" | "utilised";
  amount_cr: number;
  funder: "state" | "centre" | "agency_borrowing" | "external" | "private";
  funder_detail?: string;
  covers?: string;
  budget_head?: string;
  source_id: string;
  as_of: string;
  comparable_to_prior?: boolean;
}

export interface Event {
  project_id: string;
  date: string;
  type:
    | "announced"
    | "sanctioned"
    | "tender_floated"
    | "bid_received"
    | "awarded"
    | "deadline_revised"
    | "section_opened"
    | "cost_revised"
    | "stalled"
    | "resumed"
    | "completed"
    | "cancelled";
  summary: string;
  previous_deadline?: string | null;
  new_deadline?: string;
  source_id: string;
}

export interface Source {
  id: string;
  title: string;
  publisher: string;
  doc_type:
    | "budget_document"
    | "audit_report"
    | "agency_report"
    | "assembly_reply"
    | "rti_response"
    | "news"
    | "press_release";
  url: string;
  page_ref?: string;
  published_on?: string | null;
  retrieved_on: string;
  archive_url?: string | null;
}

export interface Correction {
  id: string;
  date: string;
  project_id: string;
  was: string;
  now: string;
  raised_by: string;
  resolved_by_source_id: string;
}

const projectModules = import.meta.glob<Project>("/data/projects/*.json", { eager: true, import: "default" });
const moneyModules = import.meta.glob<MoneyEntry>("/data/money_entries/*.json", { eager: true, import: "default" });
const eventModules = import.meta.glob<Event>("/data/events/*.json", { eager: true, import: "default" });
const sourceModules = import.meta.glob<Source>("/data/sources/*.json", { eager: true, import: "default" });
const correctionsModule = import.meta.glob<Correction[]>("/data/corrections.json", { eager: true, import: "default" });

export function getProjects(): Project[] {
  return Object.values(projectModules).sort((a, b) => a.name.localeCompare(b.name));
}

export function getProject(id: string): Project | undefined {
  return getProjects().find((p) => p.id === id);
}

export function getMoneyEntries(projectId?: string): MoneyEntry[] {
  const all = Object.values(moneyModules);
  const scoped = projectId ? all.filter((m) => m.project_id === projectId) : all;
  return [...scoped].sort((a, b) => a.as_of.localeCompare(b.as_of));
}

export function getEvents(projectId?: string): Event[] {
  const all = Object.values(eventModules);
  const scoped = projectId ? all.filter((e) => e.project_id === projectId) : all;
  return [...scoped].sort((a, b) => a.date.localeCompare(b.date));
}

export function getSources(): Source[] {
  return Object.values(sourceModules);
}

export function getSource(id: string): Source | undefined {
  return getSources().find((s) => s.id === id);
}

/** Distinct sources actually cited by a project's money_entries and events. */
export function getProjectSourceIds(projectId: string): string[] {
  const money = getMoneyEntries(projectId).map((m) => m.source_id);
  const events = getEvents(projectId).map((e) => e.source_id);
  return [...new Set([...money, ...events])];
}

/**
 * Site-wide sourcing health, inspired by GTrack.in's "Source Health" panel —
 * a transparency signal about the tracker's own data quality, not the
 * projects' progress. Counts projects by confidence and how many are stale.
 */
export function sourcingHealth() {
  const projects = getProjects();
  const byConfidence = { high: 0, medium: 0, low: 0 };
  let stale = 0;
  let noMoneyData = 0;
  for (const p of projects) {
    byConfidence[p.confidence]++;
    if (isStale(p)) stale++;
    if (getProjectSourceIds(p.id).length === 0) noMoneyData++;
  }
  return {
    totalProjects: projects.length,
    totalSources: getSources().length,
    byConfidence,
    stale,
    noMoneyData,
  };
}

export function getCorrections(): Correction[] {
  const file = correctionsModule["/data/corrections.json"];
  return file ?? [];
}

/** Cost-defining money_entry kinds — excludes announced/bid/released/utilised (P2: allocation is not spend). */
const COST_KINDS = new Set(["sanctioned", "revised_cost"]);

/**
 * A figure for the whole project, as opposed to one package, reach, loan tranche
 * or a combined figure for several projects (those carry `covers`). Only
 * whole-project figures may stand for "the project's cost".
 */
export function isWholeProject(m: MoneyEntry): boolean {
  return !m.covers;
}

/**
 * Most recent sanctioned/revised whole-project cost, or undefined if none exists yet.
 * Excludes part-project figures (`covers`) and entries flagged comparable_to_prior:
 * false (P3), which aren't the same series as the project's total cost.
 */
export function latestCost(projectId: string): MoneyEntry | undefined {
  const costEntries = getMoneyEntries(projectId).filter(
    (m) => COST_KINDS.has(m.kind) && isWholeProject(m) && m.comparable_to_prior !== false
  );
  return costEntries.at(-1);
}

/** Earliest whole-project sanctioned figure — the baseline for overrun %. */
export function originalSanctionedCost(projectId: string): MoneyEntry | undefined {
  return getMoneyEntries(projectId).find((m) => m.kind === "sanctioned" && isWholeProject(m));
}

/** Number of part-project figures on file, to explain a missing whole-project cost. */
export function partFigureCount(projectId: string): number {
  return getMoneyEntries(projectId).filter((m) => !isWholeProject(m)).length;
}

/**
 * Change % from the original sanctioned amount to the latest whole-project cost.
 * Null unless there are two different figures to compare: a project with a
 * single figure has no measured change, which is not the same as "0%".
 */
export function overrunPct(projectId: string): number | null {
  const original = originalSanctionedCost(projectId);
  const latest = latestCost(projectId);
  if (!original || !latest || original === latest || original.amount_cr === 0) return null;
  return ((latest.amount_cr - original.amount_cr) / original.amount_cr) * 100;
}

/** Slippage in whole months between original_deadline and current_deadline (spec §3.1 derived field). */
export function slippageMonths(project: Project): number | null {
  if (!project.original_deadline || !project.current_deadline) return null;
  const original = new Date(project.original_deadline);
  const current = new Date(project.current_deadline);
  const months =
    (current.getFullYear() - original.getFullYear()) * 12 + (current.getMonth() - original.getMonth());
  return months;
}

/**
 * Human-readable agency label. "corporation" alone is ambiguous — it names a
 * category of agency (one of the five GBA city corporations), not which one,
 * and reads oddly next to a project's own `corporation` field. Spell out
 * which corporation instead wherever agency is displayed.
 */
export function agencyLabel(project: Project): string {
  if (project.agency !== "corporation") return project.agency;
  // Records from before the 2025 GBA restructuring belong to the single BBMP.
  if (project.corporation === "BBMP") return "BBMP";
  return `Bengaluru ${label("corporation", project.corporation)} City Corporation`;
}

/** A project's verified_on is stale if the site's quarterly cycle has turned over twice since (spec P7/§6.2). */
export function isStale(project: Project, cycleDays = 91): boolean {
  const verified = new Date(project.verified_on);
  const ageDays = (Date.now() - verified.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > cycleDays * 2;
}

/** The natural build sequence a project moves through. stalled/cancelled are exception
 * states overlaid on top — since we don't record which stage a project stalled at, the
 * tracker is only meaningful for the sequence itself. */
export const STAGE_ORDER = [
  "announced",
  "sanctioned",
  "tendering",
  "awarded",
  "under_construction",
  "partially_open",
  "complete",
] as const;

/** Index into STAGE_ORDER, or null for stalled/cancelled (no recorded stage to show). */
export function stageIndex(status: Project["status"]): number | null {
  const i = STAGE_ORDER.indexOf(status as (typeof STAGE_ORDER)[number]);
  return i === -1 ? null : i;
}

/** Next quarterly sweep window per spec §6.1: April (post-budget), July, October, January. */
export function nextUpdateDue(reference = new Date()): Date {
  const windows = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct (0-indexed months)
  const year = reference.getFullYear();
  for (const month of windows) {
    const candidate = new Date(year, month, 1);
    if (candidate > reference) return candidate;
  }
  return new Date(year + 1, 0, 1);
}

/** Fiscal year (Apr–Mar) containing a date, as "2025-26". */
export function fiscalYearOf(date: string | Date): string {
  const d = new Date(date);
  const start = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** First year of the historical backfill window (docs/plans/01-historical-backfill.md). */
export const BACKFILL_START_FY = "2016-17";

/**
 * Source strength for coverage purposes: a primary document (budget, audit,
 * Assembly reply, RTI, agency report), news, or a press release alone.
 * Mirrors the doc_type → confidence mapping in spec §3.4.
 */
export type SourceStrength = "primary" | "news" | "press_release";
export function sourceStrength(docType: Source["doc_type"]): SourceStrength {
  if (docType === "news") return "news";
  if (docType === "press_release") return "press_release";
  return "primary";
}

export interface CoverageCell {
  fiscalYear: string;
  /** False for years before the project's first known date: nothing is expected there yet. */
  applicable: boolean;
  entries: MoneyEntry[];
  /** Strongest source backing any entry in this cell, or null when there are none. */
  strength: SourceStrength | null;
}

/**
 * Projects × fiscal years grid of money_entry coverage (P2: missing data is
 * displayed, not hidden). Drives /coverage and tracks the backfill.
 */
export function coverageMatrix() {
  const money = getMoneyEntries();
  const events = getEvents();
  const current = fiscalYearOf(new Date());
  const allYears = [BACKFILL_START_FY, current, ...money.map((m) => m.fiscal_year)].sort();
  const first = Number(allYears[0].slice(0, 4));
  const last = Number(allYears.at(-1)!.slice(0, 4));
  const years = Array.from({ length: last - first + 1 }, (_, i) => fiscalYearOf(new Date(first + i, 6, 1)));
  const rank: Record<SourceStrength, number> = { primary: 3, news: 2, press_release: 1 };

  const rows = getProjects().map((project) => {
    const projectMoney = money.filter((m) => m.project_id === project.id);
    const knownDates = [
      project.sanction_date,
      ...projectMoney.map((m) => m.as_of),
      ...events.filter((e) => e.project_id === project.id).map((e) => e.date),
    ].filter((d): d is string => Boolean(d));
    const firstFy = knownDates.length > 0 ? fiscalYearOf(knownDates.sort()[0]) : current;
    const firstFigureFy = projectMoney.map((m) => m.fiscal_year).sort()[0];
    const startFy = firstFigureFy && firstFigureFy < firstFy ? firstFigureFy : firstFy;

    const cells: CoverageCell[] = years.map((fy) => {
      const entries = projectMoney.filter((m) => m.fiscal_year === fy);
      let strength: SourceStrength | null = null;
      for (const m of entries) {
        const src = getSource(m.source_id);
        if (!src) continue;
        const s = sourceStrength(src.doc_type);
        if (!strength || rank[s] > rank[strength]) strength = s;
      }
      return { fiscalYear: fy, applicable: fy >= startFy, entries, strength };
    });
    return { project, cells };
  });

  const window = rows.flatMap((r) => r.cells.filter((c) => c.applicable && c.fiscalYear >= BACKFILL_START_FY));
  const sources = getSources();
  return {
    years,
    rows,
    totals: {
      projectYears: window.length,
      withFigure: window.filter((c) => c.entries.length > 0).length,
      withPrimary: window.filter((c) => c.strength === "primary").length,
      sources: sources.length,
      archivedSources: sources.filter((s) => s.archive_url).length,
      primarySources: sources.filter((s) => sourceStrength(s.doc_type) === "primary").length,
    },
  };
}

export interface Change {
  event: Event;
  project: Project;
  source: Source | undefined;
  /** Stable id for feeds: project, date and type are unique in practice. */
  id: string;
}

/** Every event, newest first, with its project and source: the "what changed" feed (spec §5.4). */
export function getChanges(): Change[] {
  const projects = new Map(getProjects().map((p) => [p.id, p]));
  return getEvents()
    .filter((e) => projects.has(e.project_id))
    .map((event) => ({
      event,
      project: projects.get(event.project_id)!,
      source: getSource(event.source_id),
      id: `${event.project_id}/${event.date}/${event.type}`,
    }))
    .sort((a, b) => b.event.date.localeCompare(a.event.date) || a.project.name.localeCompare(b.project.name));
}

// Project geometry lives in data/geometry/<project-id>.geojson (docs/plans/02 §2).
const geometryModules = import.meta.glob<string>("/data/geometry/*.geojson", { eager: true, query: "?raw", import: "default" });

/** Every project geometry file as { projectId, geojson }. */
export function getProjectGeometries(): { projectId: string; geojson: any }[] {
  return Object.entries(geometryModules).map(([path, raw]) => ({
    projectId: path.split("/").pop()!.replace(/\.geojson$/, ""),
    geojson: JSON.parse(raw),
  }));
}

/** Colour group for a status: the same five groups StageTracker and the status pills use. */
export function statusGroup(status: Project["status"]): "announced" | "sanctioned" | "progress" | "complete" | "stalled" {
  if (status === "announced") return "announced";
  if (status === "sanctioned" || status === "tendering" || status === "awarded") return "sanctioned";
  if (status === "under_construction" || status === "partially_open") return "progress";
  if (status === "complete") return "complete";
  return "stalled";
}

/** ₹ crore, Indian digit grouping: 40614 -> "₹40,614 cr". */
export function formatCr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} cr`;
}

/** Signed percentage for a cost change, e.g. "+53.8%". */
export function formatPct(pct: number): string {
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`;
}

/**
 * The most common confidence level across projects. Showing a badge that is
 * identical on every row is noise; lists show confidence only where a project
 * differs from this (P4 is still met on the project page and in exports).
 */
export function typicalConfidence(): Confidence {
  const counts = new Map<Confidence, number>();
  for (const p of getProjects()) counts.set(p.confidence, (counts.get(p.confidence) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "medium";
}

export function isConfidenceNotable(project: Project): boolean {
  return project.confidence !== typicalConfidence();
}

/** Plain-language meaning of each confidence level (spec §3.4 / P4). */
export const CONFIDENCE_MEANING: Record<Confidence, string> = {
  high: "backed by an official document (budget, audit report, Assembly reply or RTI reply)",
  medium: "based on news reports or an agency's own report, not yet an official document",
  low: "based on an announcement only, not yet verified against any document",
};

/**
 * The facts a project page leads with, plus a list of what isn't on record
 * yet, so missing values become one line instead of a grid of "no data".
 */
export function projectFacts(project: Project) {
  const cost = latestCost(project.id);
  const sanctioned = originalSanctionedCost(project.id);
  const change = overrunPct(project.id);
  const slippage = slippageMonths(project);
  const parts = partFigureCount(project.id);
  const missing: string[] = [];
  if (!cost) missing.push(parts > 0 ? "a whole-project cost (only part figures so far)" : "a cost figure");
  if (!project.sanction_date) missing.push("sanction date");
  if (!project.original_deadline) missing.push("original deadline");
  if (!project.current_deadline && project.status !== "complete" && project.status !== "cancelled") missing.push("current deadline");
  if (!project.pending && project.status !== "complete") missing.push("what's pending");
  return { cost, sanctioned, change, slippage, parts, missing };
}

export type TimelineItem =
  | { kind: "event"; date: string; event: Event }
  | { kind: "money"; date: string; entry: MoneyEntry };

/** Money figures and events for one project, merged into a single dated story (oldest first). */
export function projectTimeline(projectId: string): TimelineItem[] {
  const items: TimelineItem[] = [
    ...getEvents(projectId).map((event) => ({ kind: "event" as const, date: event.date, event })),
    ...getMoneyEntries(projectId).map((entry) => ({ kind: "money" as const, date: entry.as_of, entry })),
  ];
  // Same date: the event (e.g. "Cabinet approved") reads before the figure it produced.
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === "event" ? -1 : 1));
}

/** Headline facts for the homepage, each the most defensible figure of its kind (P5: facts, not verdicts). */
export function standoutFacts() {
  const projects = getProjects();
  const biggestRise = projects
    .map((project) => ({ project, pct: overrunPct(project.id) }))
    .filter((x): x is { project: Project; pct: number } => x.pct !== null && x.pct > 0)
    .sort((a, b) => b.pct - a.pct)[0];
  const longestDelay = projects
    .map((project) => ({ project, months: slippageMonths(project) }))
    .filter((x): x is { project: Project; months: number } => x.months !== null && x.months > 0)
    .sort((a, b) => b.months - a.months)[0];
  return { biggestRise, longestDelay, latest: getChanges()[0] };
}

/** City-wide totals over projects that have both an original and a later whole-project figure. */
export function cityTotals() {
  const projects = getProjects();
  let withBoth = 0;
  let sanctioned = 0;
  let latest = 0;
  for (const p of projects) {
    if (overrunPct(p.id) === null) continue;
    withBoth++;
    sanctioned += originalSanctionedCost(p.id)!.amount_cr;
    latest += latestCost(p.id)!.amount_cr;
  }
  const withCost = projects.filter((p) => latestCost(p.id)).length;
  return { projects: projects.length, withCost, withBoth, sanctioned, latest, stale: projects.filter((p) => isStale(p)).length };
}
