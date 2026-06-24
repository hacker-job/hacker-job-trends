/**
 * Incremental update (no database): pull new job posts from the *current*
 * "Who is hiring?" thread, AI-parse them, and append to the month's JSONL file.
 * Safe to run repeatedly (e.g. daily) — existing posts are skipped.
 *
 *   npm run update            # then commit site/data/
 */
import pLimit from "p-limit";
import { extractJob } from "./extract.js";
import { Job, cleanText, loadMonth, writeMonth, writeManifest, writeTrends } from "./store.js";

const ALGOLIA_SEARCH = "https://hn.algolia.com/api/v1/search_by_date";
const ALGOLIA_ITEMS = "https://hn.algolia.com/api/v1/items";

interface AlgoliaStory { objectID: string; title: string; created_at: string }
interface AlgoliaComment { id: number; parent_id: number; author: string | null; text: string | null; created_at_i: number }
interface AlgoliaItem { id: number; children: AlgoliaComment[] }

/** The most recent "Who is hiring?" thread by the whoishiring account. */
export async function latestHiringStory(): Promise<AlgoliaStory> {
  const res = await fetch(`${ALGOLIA_SEARCH}?tags=story,author_whoishiring&hitsPerPage=20`);
  const data = (await res.json()) as { hits: AlgoliaStory[] };
  const story = data.hits.find((h) => /Who is hiring\?/i.test(h.title));
  if (!story) throw new Error("No recent 'Who is hiring?' thread found.");
  return story;
}

/** Fetch a thread, parse posts not already stored, and merge into its month file. */
export async function processThread(storyId: string, month: string, concurrency = 4): Promise<{ added: number; failed: number }> {
  const item = (await fetch(`${ALGOLIA_ITEMS}/${storyId}`).then((r) => r.json())) as AlgoliaItem;

  const existing = loadMonth(month);
  const known = new Set(existing.map((j) => j.id));
  const candidates = item.children.filter(
    (c) => c.parent_id === item.id && c.text && !known.has(c.id)
  );
  if (!candidates.length) return { added: 0, failed: 0 };

  const limit = pLimit(concurrency);
  const added: Job[] = [];
  let failed = 0;

  await Promise.all(candidates.map((c) => limit(async () => {
    try {
      const text = cleanText(c.text);
      const p = await extractJob(text);
      if (!p.company) { failed++; return; }
      added.push({
        id: c.id,
        author: c.author || null,
        ts: c.created_at_i,
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
        text,
      });
    } catch {
      failed++; // transient parse failures are retried on the next run
    }
  })));

  if (added.length) writeMonth(month, [...existing, ...added]);
  return { added: added.length, failed };
}

async function main() {
  const story = await latestHiringStory();
  const month = story.created_at.slice(0, 7);
  console.log(`Current thread: ${story.title} (${story.objectID}, ${month})`);

  const { added, failed } = await processThread(story.objectID, month);
  console.log(`Added ${added} new post(s)${failed ? `, ${failed} unparseable (will retry)` : ""}.`);

  if (added > 0) {
    const { count } = writeManifest();
    writeTrends();
    console.log(`Store now holds ${count.toLocaleString()} jobs. site/data refreshed.`);
  } else {
    console.log("Nothing new.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
