/**
 * Full rebuild (no database): walk every "Who is hiring?" thread and ensure each
 * month's JSONL file has all posts parsed. Idempotent — already-stored posts are
 * skipped, so re-running only fills gaps. This is the disaster-recovery path; the
 * committed site/data/ is the normal dataset.
 *
 *   npm run backfill            # parses everything missing (expensive!)
 *   npm run backfill 2025       # only months starting with "2025"
 */
import { processThread, latestHiringStory } from "./update.js";
import { writeManifest, writeTrends } from "./store.js";

const ALGOLIA_SEARCH = "https://hn.algolia.com/api/v1/search";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Hit { objectID: string; title: string; created_at: string }

async function allHiringThreads(): Promise<Hit[]> {
  const hits: Hit[] = [];
  let page = 0;
  while (true) {
    const url = `${ALGOLIA_SEARCH}?tags=story,author_whoishiring&hitsPerPage=1000&page=${page}`;
    const data = (await fetch(url).then((r) => r.json())) as { hits: Hit[]; nbPages: number };
    hits.push(...data.hits);
    if (page >= data.nbPages - 1) break;
    page++;
    await sleep(150);
  }
  return hits.filter((h) => /Who is hiring\?/i.test(h.title));
}

async function main() {
  const prefix = process.argv[2] || "";
  const threads = (await allHiringThreads())
    .map((h) => ({ id: h.objectID, month: h.created_at.slice(0, 7) }))
    .filter((t) => t.month.startsWith(prefix))
    .sort((a, b) => a.month.localeCompare(b.month));

  console.log(`Processing ${threads.length} thread(s)${prefix ? ` matching "${prefix}"` : ""}...`);

  let totalAdded = 0;
  for (const t of threads) {
    const { added, failed } = await processThread(t.id, t.month);
    if (added || failed) console.log(`  ${t.month}: +${added}${failed ? ` (${failed} failed)` : ""}`);
    totalAdded += added;
    await sleep(150);
  }

  // make sure the newest, still-open thread is captured too
  try {
    const latest = await latestHiringStory();
    const m = latest.created_at.slice(0, 7);
    if (!prefix || m.startsWith(prefix)) {
      const { added } = await processThread(latest.objectID, m);
      totalAdded += added;
    }
  } catch { /* ignore */ }

  const { count } = writeManifest();
  writeTrends();
  console.log(`Done. Added ${totalAdded} post(s). Store holds ${count.toLocaleString()} jobs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
