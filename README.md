# hacker-job-trends

> Searchable jobs and hiring trends from Hacker News [Ask HN: Who is Hiring?](https://news.ycombinator.com/submitted?id=whoishiring) posts.

Every month HN's "Who is Hiring?" thread collects hundreds of job posts, but they
live in free-text comments — impossible to search, filter, or compare over time.
This project parses those comments into structured data with an LLM and serves a
small static site on top of it.

## The site

Three pages, all static (no backend):

- **Jobs** — recent openings (last ~12 months), newest first. Full-text search plus
  filters for remote type, salary, location, visa sponsorship, and internships.
  Every job links back to its original HN comment, and has a "Report an issue"
  button (fields are AI-extracted and occasionally wrong).
- **Trends** — average salary over time, and keyword popularity (% of each month's
  posts mentioning React, Python, Rust, AI, remote, … — toggle keywords to compare).
- **Hackers** — GitHub sponsors of [@timqian](https://github.com/sponsors/timqian).

### Data / app separation

The app (`site/*.html`, `*.svg`) and the data (`site/data/`) are decoupled and
fetched at runtime:

```
site/
├── index.html · trends.html · hackers.html · *.svg   # the app
└── data/
    ├── jobs/<month>.json   # one JSONL file per month, full history (raw HN
    ├── jobs/index.json     #   text + AI-extracted fields in each record)
    ├── trends.json         # salary + keyword series
    └── hackers.json        # GitHub sponsors
```

Each job record carries both the raw comment and the AI-extracted fields, so the
Jobs page reads these files directly — no separate copy. A daily refresh only
rewrites the current month's file, so past months stay byte-identical and git
diffs stay tiny. The Jobs page loads recent months first and lazy-loads older
ones on demand. The app can be updated without touching data, and vice-versa.

## Develop

Clone shallow and main-only — the old branches are heavy, and `main` carries the
full committed dataset, so you don't need any history:

```bash
git clone --depth 1 --single-branch --branch main git@github.com:hacker-job/hacker-job-trends.git
```

Requires Node 18+ (uses global `fetch`).

```bash
npm install
npm run serve      # preview at http://localhost:8080 (must be http, pages fetch())
npm run build      # re-derive manifest + trends.json and rewrite the app shells
```

## Data pipeline

There is no database. The month files under `site/data/jobs/` *are* the dataset —
each line is one job with the raw HN text and the AI-extracted fields. They're
committed, so the dataset travels with the repo.

**Daily incremental update** — pull new posts from the *current* "Who is hiring?"
thread (people keep posting all month), AI-parse them, and append to the month's
file:

```bash
npm run update     # current thread → parse new posts → append to site/data/jobs/<month>.json
npm run build      # re-derive manifest + trends.json and refresh the app shells
```

`update` already refreshes the manifest and trends; `build` is only needed when
the app code changed. Commit `site/data/` afterwards.

**Full rebuild from scratch** (disaster recovery) — walk every historical
"Who is hiring?" thread and parse anything missing. Idempotent and expensive:

```bash
npm run backfill        # all months (re-parses gaps only)
npm run backfill 2025   # just months starting with "2025"
```

LLM extraction uses the `openai` client; configure the endpoint/model via env
(`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` — defaults target a local LM Studio
server).

To refresh the Hackers list (needs a token belonging to the sponsored account):

```bash
GITHUB_TOKEN=ghp_xxx npm run hackers   # → data/hackers.json
npm run build
```

## Automation

[`.github/workflows/update.yml`](.github/workflows/update.yml) runs `npm run
update` daily (13:00 UTC, or on manual dispatch) and commits the refreshed
`site/data/` back to the repo. No database to stash — the commit *is* the
persistence.

It needs an OpenAI-compatible LLM endpoint, set as repo **secrets**:

| Secret | Example |
|---|---|
| `LLM_BASE_URL` | `https://api.openai.com/v1` |
| `LLM_API_KEY`  | your key |
| `LLM_MODEL`    | `gpt-4o-mini` |

## Deploy

`site/` is a plain static directory — host it anywhere (GitHub Pages, Netlify,
Cloudflare Pages, …). It's committed to the repo, so GitHub Pages can serve it
directly from the `site/` folder.

## License

[MIT](./LICENSE)
