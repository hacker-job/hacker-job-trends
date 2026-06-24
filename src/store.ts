/**
 * The data store: month JSONL files under site/data/jobs/ are the source of
 * truth (no database). Each line is one job — raw HN text + AI-extracted fields.
 * This module reads/writes those files and derives the manifest + trends.json.
 */
import fs from "fs";
import path from "path";

export const DATA_DIR = path.resolve("site/data");
export const JOBS_DIR = path.join(DATA_DIR, "jobs");

export interface Job {
  id: number;
  author: string | null;
  ts: number; // created_at_i (unix seconds)
  company: string;
  roles: string[];
  location: string | null;
  remote_type: string | null;
  remote_regions: string[];
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  tech_stack: string[];
  job_type: string | null;
  visa: number | null;
  text: string;
}
// At load time we tag each job with the month of its file (not stored on disk).
export type LoadedJob = Job & { month: string };

const MONTH_RE = /^(\d{4}-\d{2})\.json$/;

// Redact API keys people occasionally paste into job posts — they trip GitHub's
// push protection and don't belong in the dataset anyway.
function redactSecrets(s: string): string {
  return s
    .replace(/\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]+/g, "$1_$2_REDACTED")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "AKIA_REDACTED")
    .replace(/\bghp_[A-Za-z0-9]{36}\b/g, "ghp_REDACTED")
    .replace(/\bAIza[0-9A-Za-z_-]{35}\b/g, "AIza_REDACTED");
}

// Strip HN's HTML-ish markup to readable text (kept full — this is the raw record).
export function cleanText(s: string | null): string {
  if (!s) return "";
  return redactSecrets(s
    .replace(/<p>/g, "\n\n")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>.*?<\/a>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, "/")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .trim());
}

export function listMonths(): string[] {
  if (!fs.existsSync(JOBS_DIR)) return [];
  return fs.readdirSync(JOBS_DIR)
    .map((f) => f.match(MONTH_RE)?.[1])
    .filter((m): m is string => !!m)
    .sort()
    .reverse(); // newest first
}

export function loadMonth(month: string): Job[] {
  const file = path.join(JOBS_DIR, `${month}.json`);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Job);
}

export function writeMonth(month: string, jobs: Job[]): void {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
  const sorted = [...jobs].sort((a, b) => b.ts - a.ts); // newest first, stable diffs
  fs.writeFileSync(path.join(JOBS_DIR, `${month}.json`), sorted.map((j) => JSON.stringify(j)).join("\n") + "\n");
}

export function loadAll(): LoadedJob[] {
  const out: LoadedJob[] = [];
  for (const month of listMonths()) {
    for (const j of loadMonth(month)) out.push({ ...j, month });
  }
  return out;
}

export function writeManifest(): { count: number; months: number } {
  const months = listMonths();
  let count = 0;
  for (const m of months) count += loadMonth(m).length;
  fs.writeFileSync(path.join(JOBS_DIR, "index.json"), JSON.stringify({
    months,
    count,
    generated: new Date().toISOString().slice(0, 10),
  }, null, 2) + "\n");
  return { count, months: months.length };
}

// --- Trends ---------------------------------------------------------------
// Keyword → SQL-LIKE patterns (matched case-insensitively against job text).
export const KEYWORDS: { key: string; label: string; patterns: string[]; default?: boolean }[] = [
  { key: "react", label: "React", patterns: ["%react%"], default: true },
  { key: "vue", label: "Vue", patterns: ["%vue%"], default: true },
  { key: "angular", label: "Angular", patterns: ["%angular%"], default: true },
  { key: "remote", label: "Remote", patterns: ["%remote%"] },
  { key: "python", label: "Python", patterns: ["%python%"] },
  { key: "golang", label: "Golang", patterns: ["%golang%", "%go lang%"] },
  { key: "typescript", label: "TypeScript", patterns: ["%typescript%"] },
  { key: "javascript", label: "JavaScript", patterns: ["%javascript%"] },
  { key: "rust", label: "Rust", patterns: ["%rust%"] },
  { key: "java", label: "Java", patterns: ["% java%", "%(java%"] },
  { key: "cpp", label: "C++", patterns: ["%c++%"] },
  { key: "ruby", label: "Ruby", patterns: ["%ruby%"] },
  { key: "rails", label: "Rails", patterns: ["%rails%"] },
  { key: "php", label: "PHP", patterns: ["%php%"] },
  { key: "kotlin", label: "Kotlin", patterns: ["%kotlin%"] },
  { key: "swift", label: "Swift", patterns: ["%swift%"] },
  { key: "scala", label: "Scala", patterns: ["%scala%"] },
  { key: "elixir", label: "Elixir", patterns: ["%elixir%"] },
  { key: "node", label: "Node.js", patterns: ["%node.js%", "%nodejs%", "%node %"] },
  { key: "django", label: "Django", patterns: ["%django%"] },
  { key: "kubernetes", label: "Kubernetes", patterns: ["%kubernetes%", "%k8s%"] },
  { key: "docker", label: "Docker", patterns: ["%docker%"] },
  { key: "aws", label: "AWS", patterns: ["%aws%"] },
  { key: "postgres", label: "Postgres", patterns: ["%postgres%"] },
  { key: "graphql", label: "GraphQL", patterns: ["%graphql%"] },
  { key: "ai", label: "AI", patterns: ["% ai %", "%(ai)%", "% ai,", "% ai.", "%a.i.%"] },
  { key: "ml", label: "ML / Machine Learning", patterns: ["%machine learning%", "% ml %", "% ml,"] },
  { key: "llm", label: "LLM", patterns: ["%llm%", "%large language model%"] },
];

const MONTH_MIN_JOBS = 30; // ignore sparse months in trend lines

// Compile a SQL LIKE pattern into a fast matcher over a lowercased string.
function compilePattern(pat: string): (t: string) => boolean {
  if (/^%[^%_]*%$/.test(pat)) {
    const sub = pat.slice(1, -1);
    return (t) => t.includes(sub);
  }
  const re = new RegExp(
    "^" + pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$",
    "s"
  );
  return (t) => re.test(t);
}

export function writeTrends(): { months: number } {
  const jobs = loadAll();

  // month totals
  const total: Record<string, number> = {};
  for (const j of jobs) total[j.month] = (total[j.month] || 0) + 1;
  const months = Object.keys(total).filter((m) => total[m] >= MONTH_MIN_JOBS).sort();

  // salary: avg of (min+max)/2 for USD disclosures, months with >= 5
  const salAcc: Record<string, { sum: number; n: number }> = {};
  for (const j of jobs) {
    if (j.salary_currency === "USD" && j.salary_min != null && j.salary_max != null && j.salary_max < 1_000_000) {
      (salAcc[j.month] ||= { sum: 0, n: 0 });
      salAcc[j.month].sum += (j.salary_min + j.salary_max) / 2;
      salAcc[j.month].n += 1;
    }
  }
  const salary = Object.keys(salAcc).filter((m) => salAcc[m].n >= 5).sort()
    .map((m) => ({ x: m, y: Math.round(salAcc[m].sum / salAcc[m].n) }));

  // keywords: % of each month's jobs whose text matches any pattern
  const keywords = KEYWORDS.map((kw) => {
    const matchers = kw.patterns.map(compilePattern);
    const hit: Record<string, number> = {};
    for (const j of jobs) {
      const t = j.text.toLowerCase();
      if (matchers.some((m) => m(t))) hit[j.month] = (hit[j.month] || 0) + 1;
    }
    const data = months.map((m) => ({ x: m, y: Math.round(((hit[m] || 0) / total[m]) * 1000) / 10 }));
    return { key: kw.key, label: kw.label, default: !!kw.default, data };
  });

  fs.writeFileSync(path.join(DATA_DIR, "trends.json"), JSON.stringify({
    meta: { months: months.length, from: months[0], to: months[months.length - 1] },
    salary,
    keywords,
  }, null, 2) + "\n");
  return { months: months.length };
}
