#!/usr/bin/env node
// Writes the body of the quarterly sweep issue (spec §6.4) and prints its title.
// Used by .github/workflows/quarterly-sweep.yml; runnable locally to preview:
//
//   node scripts/sweep-issue.mjs --out sweep.md
//
// Uses only Node built-ins, so the workflow doesn't need `npm ci`.

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const load = (dir) =>
  existsSync(join(root, "data", dir))
    ? readdirSync(join(root, "data", dir))
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(readFileSync(join(root, "data", dir, f), "utf8")))
    : [];

const now = new Date();
const windowLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
const windowSlug = now.toISOString().slice(0, 7);
const CYCLE_DAYS = 91; // matches isStale() in src/lib/data.ts

const projects = load("projects").sort((a, b) => a.verified_on.localeCompare(b.verified_on) || a.name.localeCompare(b.name));
const sources = load("sources");
const unarchived = sources.filter((s) => !s.archive_url).length;
const ageDays = (d) => Math.floor((now - new Date(d)) / 86_400_000);

const projectLines = projects.map((p) => {
  const age = ageDays(p.verified_on);
  const flag = age > CYCLE_DAYS * 2 ? " **(stale: shown as possibly outdated on the site)**" : "";
  return `- [ ] \`${p.id}\` ${p.name} (${p.agency}): last verified ${p.verified_on}, ${age} days ago${flag}`;
});

const body = `Quarterly sweep for **${windowLabel}** (spec §6.4). Close this issue when the changelog entry is published.

### 1. New documents
- [ ] Karnataka budget / supplementary estimates since the last sweep: add \`money_entry\` rows
- [ ] New CAG reports on Karnataka that mention BBMP/GBA, BMRCL, BWSSB, BMTC, BDA, K-RIDE or B-SMILE
- [ ] New agency annual reports
- [ ] Assembly / Council question replies from the last session
- [ ] RTI replies received

### 2. Re-verify every project
Update \`verified_on\` on each project, even when nothing changed. Oldest first:

${projectLines.join("\n")}

### 3. Events
- [ ] Add \`event\` rows for this quarter's developments (sanctions, tenders, awards, openings, revisions)

### 4. Sources
- [ ] Re-check source URLs that have moved or died, and re-archive them
- [ ] ${unarchived} of ${sources.length} sources have no \`archive_url\`: run the "Archive sources" workflow

### 5. Publish
- [ ] Write \`content/changelog/${windowSlug}.md\`: what changed, and **what could not be verified** (see \`content/changelog/README.md\`)
- [ ] \`npm run build\` passes, then push to \`master\`
`;

const outIdx = process.argv.indexOf("--out");
if (outIdx >= 0) writeFileSync(process.argv[outIdx + 1], body);
else process.stderr.write(body);
console.log(`Quarterly sweep: ${windowLabel}`);
