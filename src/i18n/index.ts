// Interface strings (docs/plans/07-kannada.md). Short, reused text such as
// nav, footer and enum labels lives in src/i18n/<lang>.json; long page prose
// stays in the pages and will be translated as whole per-language pages when
// Kannada routing lands. English is the only language for now.
//
// A missing key throws at build time, so a typo fails the build instead of
// shipping an empty label.

import en from "./en.json";

type Dict = { [key: string]: string | Dict };
const dictionaries: Record<string, Dict> = { en };
const DEFAULT_LANG = "en";

/** Look up a dotted key, e.g. t("nav.projects") or t("footer.cadence", { date: "October 2026" }). */
export function t(key: string, params: Record<string, string | number> = {}, lang = DEFAULT_LANG): string {
  const value = key.split(".").reduce<string | Dict | undefined>(
    (node, part) => (node && typeof node === "object" ? node[part] : undefined),
    dictionaries[lang] ?? dictionaries[DEFAULT_LANG]
  );
  if (typeof value !== "string") throw new Error(`i18n: missing string "${key}" for "${lang}"`);
  return value.replace(/\{(\w+)\}/g, (_, name) => (name in params ? String(params[name]) : `{${name}}`));
}

export type LabelGroup =
  | "status"
  | "category"
  | "confidence"
  | "kind"
  | "kind_short"
  | "funder"
  | "event_type"
  | "doc_type"
  | "source_strength"
  | "corporation";

/** Display label for a data enum value, e.g. label("status", "under_construction"). */
export function label(group: LabelGroup, value: string, lang = DEFAULT_LANG): string {
  return t(`labels.${group}.${value}`, {}, lang);
}
