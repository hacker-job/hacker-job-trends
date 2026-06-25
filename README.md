# hacker-job

> Searchable jobs and hiring trends from Hacker News [Ask HN: Who is Hiring?](https://news.ycombinator.com/submitted?id=whoishiring) threads.

Each month's "Who is Hiring?" thread holds hundreds of job posts as free-text
comments — impossible to search or compare over time. This project parses them
into structured data with an LLM and serves a React app on top.

## Layout

```
data/                 # the dataset (committed) — source of truth, no database
  jobs/<month>.json   #   one JSONL file per month: raw HN text + AI-extracted fields
  jobs/index.json     #   manifest of available months   (derived)
  trends.json         #   salary + keyword series         (derived)
  pending.jsonl       #   fetched posts awaiting AI analysis (queue)
  hackers.json        #   GitHub sponsors
scripts/              # Node/TS pipeline (fetch → analyze, backfill, derive, store)
frontend/             # Vite + React + TS app → builds to frontend/dist
```

The app fetches `data/*` at runtime, so data and app are fully decoupled — a data
refresh needs no rebuild. A daily refresh only touches the current month's file,
so git diffs stay tiny.

## Develop

```bash
git clone --depth 1 --single-branch --branch main git@github.com:hacker-job/hacker-job.git

cd frontend && npm install && npm run dev   # app at http://localhost:5173
npm install                                 # pipeline deps (from repo root)
```

The dev server serves the repo-root `data/` at `/data/*`, so the app has live data
while you work. Requires Node 18+.

## Data pipeline

No database — the month files under `data/jobs/` *are* the dataset. The daily
update is split into a cheap fetch and the AI step, connected by a queue:

```bash
npm run jobs:fetch     # current thread → queue new posts (no AI)
npm run jobs:analyze   # drain queue → AI-parse → write data/jobs/<month>.json + derived files
npm run jobs:update    # both, in sequence
```

Posts that fail to parse stay queued and retry next run. Other commands:

```bash
npm run jobs:backfill        # rebuild every month from scratch (idempotent, slow)
npm run jobs:derive          # regenerate manifest + trends without fetching
npm run hackers:fetch        # refresh sponsors (needs GITHUB_TOKEN, see below)
```

LLM extraction uses the `openai` client and defaults to a local LM Studio server;
override with `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`.

## Automation & deploy

| Workflow | What it does | Secrets |
|---|---|---|
| [`update.yml`](.github/workflows/update.yml) | Daily (13:00 UTC): fetch + analyze, commit `data/` | `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` |
| [`refresh-github-data.yml`](.github/workflows/refresh-github-data.yml) | Refresh sponsors | `GH_PAT` (token of the sponsored account, `read:user`) |
| [`deploy.yml`](.github/workflows/deploy.yml) | Build `frontend/` + dataset → GitHub Pages on push to `main` | — |

The commit *is* the persistence — no database to stash. In CI the LLM must be a
hosted, internet-reachable endpoint (the local default won't work on a runner).
Enable Pages once under **Settings → Pages → Source: GitHub Actions**; the custom
domain lives in [`frontend/public/CNAME`](frontend/public/CNAME).

## License

[MIT](./LICENSE)
