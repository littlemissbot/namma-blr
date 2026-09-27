// Serialises records in the repo's hand-edited JSON style: two-space indent,
// with arrays of plain values kept on one line (e.g. "aka": ["a", "b"]).
// Scripts that rewrite data files use this so their diffs stay minimal.

export function stringifyRecord(value, indent = "") {
  const next = indent + "  ";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((v) => v === null || typeof v !== "object")) return `[${value.map((v) => JSON.stringify(v)).join(", ")}]`;
    return `[\n${value.map((v) => next + stringifyRecord(v, next)).join(",\n")}\n${indent}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return "{}";
    return `{\n${entries.map(([k, v]) => `${next}${JSON.stringify(k)}: ${stringifyRecord(v, next)}`).join(",\n")}\n${indent}}`;
  }
  return JSON.stringify(value);
}
