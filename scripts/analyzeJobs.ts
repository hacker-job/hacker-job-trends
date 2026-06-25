/**
 * AI analysis: turn fetched raw posts into structured jobs.
 *
 *   npm run jobs:analyze       # drain the data/pending.jsonl queue
 *
 * Reads the queue written by `jobs:fetch`, AI-extracts each post, and merges the
 * results into the month files. Posts that fail to parse stay queued and are
 * retried on the next run. Safe to run repeatedly.
 */
import pLimit from "p-limit";
import { extractJob } from "./extract.js";
import {
  Job, loadMonth, writeMonth, loadPending, writePending, writeManifest, writeTrends,
} from "./store.js";
import type { RawPost } from "./types.js";

/** AI-extract one raw post into a Job, or null if it isn't a parseable posting. */
export async function analyzePost(raw: RawPost): Promise<Job | null> {
  const p = await extractJob(raw.text);
  if (!p.company) return null;
  return {
    id: raw.id,
    author: raw.author,
    ts: raw.ts,
    company: p.company,
    roles: p.roles ?? [],
    location: p.location ?? null,
    remote_type: p.remote_type ?? null,
    remote_regions: p.remote_regions ?? [],
    salary_min: p.salary_min ?? null,
    salary_max: p.salary_max ?? null,
    salary_currency: p.salary_currency ?? null,
    tech_stack: p.tech_stack ?? [],
    job_type: p.job_type ?? null,
    visa: p.visa == null ? null : p.visa ? 1 : 0,
    text: raw.text,
  };
}

/** Analyze many posts in parallel; returns the jobs and the ids that failed. */
export async function analyzePosts(
  raws: RawPost[],
  concurrency = 4,
): Promise<{ jobs: Job[]; failedIds: Set<number> }> {
  const limit = pLimit(concurrency);
  const jobs: Job[] = [];
  const failedIds = new Set<number>();
  await Promise.all(raws.map((r) => limit(async () => {
    try {
      const job = await analyzePost(r);
      if (job) jobs.push(job);
      else { failedIds.add(r.id); console.warn(`  post ${r.id}: no company extracted`); }
    } catch (err) {
      failedIds.add(r.id); // transient failure — retried on the next run
      const e = err as { status?: number; message?: string; error?: unknown };
      console.warn(`  post ${r.id} failed: ${e.status ?? ""} ${e.message ?? err}`
        + (e.error ? ` | ${JSON.stringify(e.error)}` : ""));
    }
  })));
  return { jobs, failedIds };
}

/** Merge new jobs into their month files (skipping ids already stored). */
function mergeIntoMonths(jobs: Job[], monthOf: Map<number, string>): void {
  const byMonth = new Map<string, Job[]>();
  for (const j of jobs) {
    const m = monthOf.get(j.id)!;
    (byMonth.get(m) ?? byMonth.set(m, []).get(m)!).push(j);
  }
  for (const [month, newJobs] of byMonth) {
    const existing = loadMonth(month);
    const known = new Set(existing.map((j) => j.id));
    const fresh = newJobs.filter((j) => !known.has(j.id));
    if (fresh.length) writeMonth(month, [...existing, ...fresh]);
  }
}

async function main() {
  const pending = loadPending();
  if (!pending.length) {
    console.log("Queue empty — nothing to analyze.");
    return;
  }
  console.log(`Analyzing ${pending.length} queued post(s)...`);

  const { jobs, failedIds } = await analyzePosts(pending);
  const monthOf = new Map(pending.map((p) => [p.id, p.month]));
  mergeIntoMonths(jobs, monthOf);

  // Keep only the failures in the queue, to retry next time.
  writePending(pending.filter((p) => failedIds.has(p.id)));

  if (jobs.length) {
    const { count } = writeManifest();
    writeTrends();
    console.log(`Added ${jobs.length} job(s). Store now holds ${count.toLocaleString()} jobs. site/data refreshed.`);
  }
  const stillFailed = pending.filter((p) => failedIds.has(p.id)).length;
  if (stillFailed) console.log(`${stillFailed} post(s) unparseable, left in queue to retry.`);
}

// Run as a script (but allow importing analyzePost/analyzePosts without executing).
import { fileURLToPath } from "url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
