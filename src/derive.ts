/**
 * Regenerate site/data/jobs/index.json (manifest) and site/data/trends.json
 * from the jobs store. `update`/`backfill` already do this after adding data —
 * run this only when you change the derivation itself (e.g. the keyword list).
 *
 *   npm run derive
 */
import { writeManifest, writeTrends } from "./store.js";

const { count, months } = writeManifest();
const { months: trendMonths } = writeTrends();
console.log(`Derived — ${count.toLocaleString()} jobs across ${months} months, ${trendMonths} trend months`);
