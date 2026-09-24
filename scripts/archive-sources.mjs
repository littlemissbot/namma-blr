#!/usr/bin/env node
// Fills in archive_url on every source that doesn't have one (spec §4.2:
// "Government URLs rot. Every source gets a Wayback snapshot at collection time").
//
// For each source with archive_url: null it:
//   1. asks the Wayback availability API for an existing snapshot closest to
//      the source's retrieved_on date, and uses it if there is one;
//   2. otherwise, with --save, asks Save Page Now to capture the URL.
//
// Usage:
//   npm run archive-sources                 # look up existing snapshots only
//   npm run archive-sources -- --save       # also capture missing ones
//   npm run archive-sources -- --dry-run    # report, don't write files
//   npm run archive-sources -- --limit 5    # stop after 5 sources
//
// Save Page Now is rate-limited for anonymous use, so captures are spaced
// out. Set ARCHIVE_ORG_ACCESS_KEY and ARCHIVE_ORG_SECRET_KEY (from
// https://archive.org/account/s3.php) to use the authenticated API, which is
// more reliable. Only the archive_url line of each file is changed, so diffs
// stay one line per source.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcesDir = join(root, "data", "sources");

const args = process.argv.slice(2);
const SAVE = args.includes("--save");
const DRY_RUN = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

const ACCESS = process.env.ARCHIVE_ORG_ACCESS_KEY;
const SECRET = process.env.ARCHIVE_ORG_SECRET_KEY;
const USER_AGENT = "NammaBLR source archiver (https://github.com/littlemissbot/namma-blr)";
const SAVE_SPACING_MS = ACCESS && SECRET ? 5_000 : 20_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Closest existing snapshot to `date` (YYYY-MM-DD), or null. */
export async function findSnapshot(url, date) {
  const timestamp = date ? date.replaceAll("-", "") : "";
  const api = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${timestamp}`;
  const res = await fetch(api, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`availability API returned ${res.status}`);
  const closest = (await res.json())?.archived_snapshots?.closest;
  if (!closest?.available || String(closest.status) !== "200") return null;
  return closest.url.replace(/^http:/, "https:");
}

/** Capture `url` with Save Page Now and return the snapshot URL. */
export async function saveSnapshot(url) {
  if (ACCESS && SECRET) {
    const headers = {
      Accept: "application/json",
      Authorization: `LOW ${ACCESS}:${SECRET}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    };
    const res = await fetch("https://web.archive.org/save", {
      method: "POST",
      headers,
      body: new URLSearchParams({ url, skip_first_archive: "1" }),
    });
    const job = await res.json();
    if (!job.job_id) throw new Error(job.message || `Save Page Now returned ${res.status}`);
    for (let i = 0; i < 30; i++) {
      await sleep(6_000);
      const status = await (
        await fetch(`https://web.archive.org/save/status/${job.job_id}`, { headers })
      ).json();
      if (status.status === "success") return `https://web.archive.org/web/${status.timestamp}/${status.original_url}`;
      if (status.status === "error") throw new Error(status.message || status.status_ext || "capture failed");
    }
    throw new Error("capture did not finish in time");
  }

  // Anonymous capture: the response is (or redirects to) the new snapshot.
  const res = await fetch(`https://web.archive.org/save/${url}`, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  const location = res.headers.get("content-location");
  if (location) return `https://web.archive.org${location}`;
  if (res.ok && /\/web\/\d{14}/.test(res.url)) return res.url;
  throw new Error(`Save Page Now returned ${res.status}`);
}

/** Replace only the archive_url line, keeping the rest of the file byte-for-byte. */
export function withArchiveUrl(text, archiveUrl) {
  if (/"archive_url":\s*null/.test(text)) {
    return text.replace(/"archive_url":\s*null/, `"archive_url": ${JSON.stringify(archiveUrl)}`);
  }
  const record = JSON.parse(text);
  record.archive_url = archiveUrl;
  return JSON.stringify(record, null, 2) + "\n";
}

async function main() {
  const files = readdirSync(sourcesDir)
    .filter((f) => f.endsWith(".json"))
    .sort((a, b) => Number(a.slice(1, -5)) - Number(b.slice(1, -5)));

  const pending = [];
  for (const f of files) {
    const text = readFileSync(join(sourcesDir, f), "utf8");
    const record = JSON.parse(text);
    if (!record.archive_url) pending.push({ file: join(sourcesDir, f), text, record });
  }
  console.log(`${pending.length} of ${files.length} sources have no archive_url.`);

  const summary = { found: 0, saved: 0, missing: 0, failed: 0 };
  let lastSave = 0;
  for (const { file, text, record } of pending.slice(0, LIMIT)) {
    try {
      let archiveUrl = await findSnapshot(record.url, record.retrieved_on);
      let how = "found";
      if (!archiveUrl && SAVE) {
        await sleep(Math.max(0, lastSave + SAVE_SPACING_MS - Date.now()));
        lastSave = Date.now();
        archiveUrl = await saveSnapshot(record.url);
        how = "saved";
      }
      if (!archiveUrl) {
        summary.missing++;
        console.log(`  ${record.id}: no snapshot yet (re-run with --save to capture one)`);
        continue;
      }
      summary[how]++;
      console.log(`  ${record.id}: ${how} ${archiveUrl}`);
      if (!DRY_RUN) writeFileSync(file, withArchiveUrl(text, archiveUrl));
    } catch (err) {
      summary.failed++;
      console.log(`  ${record.id}: failed (${err.message})`);
    }
  }

  console.log(
    `\nFound ${summary.found}, saved ${summary.saved}, still missing ${summary.missing}, failed ${summary.failed}.` +
      (DRY_RUN ? " (dry run: no files written)" : "")
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
