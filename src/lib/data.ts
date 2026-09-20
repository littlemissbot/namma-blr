// Loads the flat-file data model (spec §3) at build time and derives the
// read-only view fields the site's pages need (latest cost, overrun %,
// slippage). Validation of the raw records happens separately in
// scripts/validate.mjs — this module assumes clean data.

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
  wards: string[];
  corporation: "Central" | "East" | "North" | "South" | "West" | "outside_GBA";
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
  source_id: string;
  as_of: string;
  comparable_to_prior?: boolean;
}

export interface Event {
  project_id: string;
  date: string;
  type:
    | "sanctioned"
    | "tender_floated"
    | "bid_received"
    | "awarded"
    | "deadline_revised"
    | "section_opened"
    | "cost_revised"
    | "stalled";
  summary: string;
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
 * Most recent sanctioned/revised cost figure for a project, or undefined if none exists yet.
 * Excludes entries flagged comparable_to_prior: false (P3) — a separately-sanctioned
 * component (e.g. a funding tranche, or one corridor's own line item) is not the same
 * series as the project's total cost and must not silently become "the latest cost".
 */
export function latestCost(projectId: string): MoneyEntry | undefined {
  const costEntries = getMoneyEntries(projectId).filter(
    (m) => COST_KINDS.has(m.kind) && m.comparable_to_prior !== false
  );
  return costEntries.at(-1);
}

/** Earliest sanctioned figure — the baseline for overrun %. */
export function originalSanctionedCost(projectId: string): MoneyEntry | undefined {
  return getMoneyEntries(projectId).find((m) => m.kind === "sanctioned");
}

/** Overrun % vs. the original sanctioned amount, or null when either figure is missing. */
export function overrunPct(projectId: string): number | null {
  const original = originalSanctionedCost(projectId);
  const latest = latestCost(projectId);
  if (!original || !latest || original.amount_cr === 0) return null;
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
  return project.agency === "corporation"
    ? `Bengaluru ${project.corporation.replace(/_/g, " ")} City Corporation`
    : project.agency;
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
