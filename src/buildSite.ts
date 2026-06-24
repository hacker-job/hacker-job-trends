/**
 * Build the static site into site/ — emits the app shells (HTML/SVG) and
 * re-derives the manifest + trends.json from the jobs store. There is no
 * database: site/data/jobs/<month>.json (maintained by `update`/`backfill`)
 * is the source of truth.
 *
 *   site/*.html, *.svg          — the app (changes only when code changes)
 *   site/data/jobs/<month>.json — one JSONL file per month (raw text + AI fields)
 *   site/data/jobs/index.json   — manifest of available months (derived)
 *   site/data/trends.json       — salary + keyword series (derived)
 *   site/data/hackers.json      — GitHub sponsors (from data/hackers.json)
 *
 * The pages fetch these files at runtime, so a data refresh needs no rebuild.
 * (Because pages fetch(), preview over http — `npm run serve` — not file://.)
 */
import fs from "fs";
import path from "path";
import { writeManifest, writeTrends } from "./store.js";

const OUT = path.resolve("site");
const DATA_OUT = path.join(OUT, "data");
fs.mkdirSync(DATA_OUT, { recursive: true });

// GitHub repo that receives "report an issue" data-correction reports.
const REPO = "hacker-job/hacker-job-trends";

// Jobs data (site/data/jobs/<month>.json) is the source of truth, maintained by
// `npm run update` / `npm run backfill`. The build only re-derives the manifest
// and trends.json from it (see the end of this file) and emits the app shells.

// ---------------------------------------------------------------------------
// HACKERS — copy data/hackers.json → site/data/hackers.json
// ---------------------------------------------------------------------------
const hackersSrc = path.resolve("data/hackers.json");
const hackersOut = path.join(DATA_OUT, "hackers.json");
if (fs.existsSync(hackersSrc)) {
  fs.copyFileSync(hackersSrc, hackersOut);
} else if (!fs.existsSync(hackersOut)) {
  fs.writeFileSync(hackersOut, "[]\n"); // keep the fetch from 404-ing
}

// ===========================================================================
// App shell
// ===========================================================================
const MARK_SVG = `<svg class="mark" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="hacker·job logo">
  <rect width="32" height="32" rx="7" fill="#e85d04"/>
  <path d="M10 10 L16 16 L10 22" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18 22 H23" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
</svg>`;

fs.writeFileSync(path.join(OUT, "favicon.svg"),
  `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="7" fill="#e85d04"/>
  <path d="M10 10 L16 16 L10 22" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18 22 H23" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
</svg>\n`);

fs.writeFileSync(path.join(OUT, "logo.svg"),
  `<svg viewBox="0 0 220 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="hacker·job">
  <rect x="8" y="8" width="32" height="32" rx="7" fill="#e85d04"/>
  <path d="M18 18 L24 24 L18 30" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M26 30 H31" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
  <text x="52" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="22" font-weight="700" fill="#1a1a1a">hacker<tspan fill="#e85d04">·</tspan>job</text>
</svg>\n`);

const SHARED_CSS = `
  :root { --accent: #e85d04; --ink: #1a1a1a; --muted: #777; --line: #e5e5e5; --bg: #fafafa; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); margin: 0; background: var(--bg); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  header.nav { background: #fff; border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 10; }
  .nav-inner { max-width: 980px; margin: 0 auto; padding: 0 20px; display: flex; align-items: center; gap: 28px; height: 56px; }
  .brand { display: flex; align-items: center; gap: 9px; font-weight: 700; font-size: 1.05rem; color: var(--ink); }
  .brand:hover { text-decoration: none; }
  .brand .mark { width: 26px; height: 26px; display: block; }
  .brand b { color: var(--accent); }
  .nav-links { display: flex; gap: 22px; margin-left: auto; }
  .nav-links a { color: var(--muted); font-size: 0.92rem; font-weight: 500; }
  .nav-links a.active { color: var(--ink); }
  .wrap { max-width: 980px; margin: 0 auto; padding: 28px 20px 80px; }
  h1 { font-size: 1.5rem; margin: 0 0 4px; }
  p.sub { color: var(--muted); font-size: 0.88rem; margin: 0 0 24px; }
`;

function shell(active: string, title: string, body: string, scripts = ""): string {
  const link = (href: string, key: string, label: string) =>
    `<a href="${href}"${active === key ? ' class="active"' : ""}>${label}</a>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<link rel="icon" type="image/svg+xml" href="favicon.svg" />
<style>${SHARED_CSS}</style>
</head>
<body>
<header class="nav"><div class="nav-inner">
  <a href="index.html" class="brand">${MARK_SVG}<span>hacker<b>·</b>job</span></a>
  <nav class="nav-links">
    ${link("hackers.html", "hackers", "Hackers")}
    ${link("index.html", "jobs", "Jobs")}
    ${link("trends.html", "trends", "Trends")}
  </nav>
</div></header>
<main class="wrap">${body}</main>
${scripts}
</body>
</html>`;
}

// ---- Jobs page -------------------------------------------------------------
const jobsBody = `
<h1>Jobs</h1>
<p class="sub" id="sub">Loading…</p>
<input id="q" type="search" placeholder="Search company, role, location, stack…"
  style="width:100%;padding:11px 14px;font-size:0.95rem;border:1px solid var(--line);border-radius:8px;margin-bottom:10px;" />
<div class="filters">
  <select id="f-remote">
    <option value="">Remote: any</option>
    <option value="remote">Remote</option>
    <option value="hybrid">Hybrid</option>
    <option value="onsite">Onsite</option>
  </select>
  <select id="f-salary">
    <option value="0">Salary: any</option>
    <option value="100000">$100k+</option>
    <option value="150000">$150k+</option>
    <option value="200000">$200k+</option>
    <option value="300000">$300k+</option>
  </select>
  <input id="f-loc" type="text" placeholder="Location…" />
  <label class="chk"><input type="checkbox" id="f-visa" /> Visa sponsor</label>
  <label class="chk"><input type="checkbox" id="f-intern" /> Internship</label>
  <button id="f-clear" class="clearbtn">Clear</button>
</div>
<p id="count" class="sub" style="margin:14px 0 16px"></p>
<div id="list"></div>
<div style="text-align:center;margin-top:24px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
  <button id="more" style="display:none;padding:10px 22px;border:1px solid var(--line);background:#fff;border-radius:8px;cursor:pointer;font-size:0.9rem">Load more</button>
  <button id="older" style="display:none;padding:10px 22px;border:1px solid var(--line);background:#fff;border-radius:8px;cursor:pointer;font-size:0.9rem">Load older months</button>
</div>`;

const jobsScript = `<script>
const REPO = ${JSON.stringify(REPO)};
const PAGE = 50;        // rendered cards per "Load more"
const MONTH_BATCH = 12; // months fetched per "Load older months"
const DESC_LIMIT = 1200;
const elList = document.getElementById('list');
const elCount = document.getElementById('count');
const elMore = document.getElementById('more');
const elOlder = document.getElementById('older');
const elSub = document.getElementById('sub');
const elQ = document.getElementById('q');
const fRemote = document.getElementById('f-remote');
const fSalary = document.getElementById('f-salary');
const fLoc = document.getElementById('f-loc');
const fVisa = document.getElementById('f-visa');
const fIntern = document.getElementById('f-intern');
let JOBS = [], filtered = [], shown = 0;
let MONTHS = [], monthsLoaded = 0, TOTAL = 0;

function fmtSalary(j){
  if(!j.salary_min && !j.salary_max) return '';
  const cur = j.salary_currency || 'USD';
  const k = n => n>=1000 ? Math.round(n/1000)+'k' : n;
  const sym = cur==='USD'?'$':(cur==='EUR'?'€':(cur==='GBP'?'£':''));
  const unit = sym || (cur+' ');
  if(j.salary_min && j.salary_max) return unit+k(j.salary_min)+'–'+k(j.salary_max);
  return unit+k(j.salary_min||j.salary_max);
}
function fmtDate(ts){ return new Date(ts*1000).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}); }
function esc(s){ return (s||'').replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

function issueUrl(j){
  const title = 'Data issue: '+j.company+' (job #'+j.id+')';
  const body = 'The extracted info for this job looks wrong (fields are AI-extracted).\\n\\n'
    + 'Job: '+j.company+'\\nHacker News: https://news.ycombinator.com/item?id='+j.id+'\\n\\n'
    + 'What is incorrect:\\n- ';
  return 'https://github.com/'+REPO+'/issues/new?title='+encodeURIComponent(title)+'&body='+encodeURIComponent(body);
}

function card(j){
  const badges = [];
  if(j.remote_type) badges.push('<span class="badge rt-'+j.remote_type+'">'+j.remote_type+'</span>');
  if(j.job_type) badges.push('<span class="badge">'+j.job_type+'</span>');
  if(j.visa) badges.push('<span class="badge">visa</span>');
  const sal = fmtSalary(j);
  if(sal) badges.push('<span class="badge sal">'+sal+'</span>');
  const tech = (j.tech_stack||[]).slice(0,12).map(t=>'<span class="tag">'+esc(t)+'</span>').join('');
  const roles = (j.roles&&j.roles.length) ? esc(j.roles.join(' · ')) : '';
  const desc = (j.text||'').length > DESC_LIMIT ? j.text.slice(0,DESC_LIMIT)+'…' : (j.text||'');
  return '<article class="job">'
    + '<div class="job-head"><span class="co">'+esc(j.company)+'</span>'
    + (j.location?'<span class="loc">'+esc(j.location)+'</span>':'')
    + '<span class="date">'+fmtDate(j.ts)+'</span></div>'
    + (roles?'<div class="roles">'+roles+'</div>':'')
    + (badges.length?'<div class="badges">'+badges.join('')+'</div>':'')
    + (tech?'<div class="tags">'+tech+'</div>':'')
    + '<details><summary>details</summary><pre class="desc">'+esc(desc)+'</pre>'
    + '<div class="job-foot">'
    + '<a href="https://news.ycombinator.com/item?id='+j.id+'" target="_blank" rel="noopener">View on Hacker News →</a>'
    + '<a class="report" href="'+issueUrl(j)+'" target="_blank" rel="noopener" title="These fields are AI-extracted and may be wrong">⚑ Report an issue</a>'
    + '</div></details>'
    + '</article>';
}

function render(reset){
  if(reset){ elList.innerHTML=''; shown=0; }
  const next = filtered.slice(shown, shown+PAGE);
  elList.insertAdjacentHTML('beforeend', next.map(card).join(''));
  shown += next.length;
  elMore.style.display = shown < filtered.length ? 'inline-block' : 'none';
  elCount.textContent = filtered.length.toLocaleString()+' result'+(filtered.length===1?'':'s');
}

function apply(){
  const terms = elQ.value.trim().toLowerCase().split(/\\s+/).filter(Boolean);
  const remote = fRemote.value;
  const minSal = parseInt(fSalary.value, 10) || 0;
  const loc = fLoc.value.trim().toLowerCase();
  const visa = fVisa.checked;
  const intern = fIntern.checked;
  filtered = JOBS.filter(j=>{
    if(remote && j.remote_type !== remote) return false;
    if(minSal && !((j.salary_max||j.salary_min||0) >= minSal)) return false;
    if(loc && !(j.location||'').toLowerCase().includes(loc)) return false;
    if(visa && !j.visa) return false;
    if(intern && j.job_type !== 'intern') return false;
    if(terms.length){
      const hay = (j.company+' '+(j.roles||[]).join(' ')+' '+(j.location||'')+' '+(j.tech_stack||[]).join(' ')+' '+(j.remote_type||'')+' '+(j.job_type||'')+' '+(j.text||'')).toLowerCase();
      if(!terms.every(t=>hay.includes(t))) return false;
    }
    return true;
  });
  render(true);
}

function updateSub(){
  const older = MONTHS.length - monthsLoaded;
  elSub.textContent = TOTAL.toLocaleString()+' openings from HN "Who is Hiring?" · '
    + 'loaded '+JOBS.length.toLocaleString()+' from last '+monthsLoaded+' months · newest first';
  elOlder.style.display = older > 0 ? 'inline-block' : 'none';
  elOlder.textContent = 'Load older months ('+older+' more)';
}

async function loadMonths(n){
  const slice = MONTHS.slice(monthsLoaded, monthsLoaded + n);
  const files = await Promise.all(slice.map(m => fetch('data/jobs/'+m+'.json').then(r=>r.text())));
  for(const text of files){
    for(const line of text.split('\\n')){ if(line.trim()) JOBS.push(JSON.parse(line)); }
  }
  monthsLoaded += slice.length;
  JOBS.sort((a,b)=>b.ts-a.ts);
  updateSub();
  apply();
}

elMore.onclick = ()=>render(false);
elOlder.onclick = ()=>loadMonths(MONTH_BATCH);
let deb; elQ.oninput = ()=>{ clearTimeout(deb); deb=setTimeout(apply,150); };
[fRemote, fSalary, fVisa, fIntern].forEach(el=>el.onchange = apply);
let debLoc; fLoc.oninput = ()=>{ clearTimeout(debLoc); debLoc=setTimeout(apply,150); };
document.getElementById('f-clear').onclick = ()=>{
  elQ.value=''; fRemote.value=''; fSalary.value='0'; fLoc.value=''; fVisa.checked=false; fIntern.checked=false;
  apply();
};

async function load(){
  const manifest = await fetch('data/jobs/index.json').then(r=>r.json());
  MONTHS = manifest.months; // newest first
  TOTAL = manifest.count;
  await loadMonths(MONTH_BATCH);
}
load().catch(e=>{ elSub.textContent='Failed to load jobs data.'; console.error(e); });
</script>
<style>
  .filters { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .filters select, .filters input[type=text] { padding:8px 10px; font-size:0.86rem; border:1px solid var(--line);
    border-radius:8px; background:#fff; color:var(--ink); }
  .filters input[type=text] { min-width:150px; }
  .filters .chk { display:flex; align-items:center; gap:5px; font-size:0.86rem; color:#555; cursor:pointer;
    padding:7px 10px; border:1px solid var(--line); border-radius:8px; background:#fff; }
  .filters .chk input { margin:0; cursor:pointer; }
  .filters .clearbtn { margin-left:auto; padding:8px 14px; font-size:0.84rem; border:1px solid var(--line);
    background:#fff; border-radius:8px; cursor:pointer; color:var(--muted); }
  .filters .clearbtn:hover { color:var(--ink); border-color:#bbb; }
  .job { background:#fff; border:1px solid var(--line); border-radius:10px; padding:16px 18px; margin-bottom:12px; }
  .job-head { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; }
  .co { font-weight:700; font-size:1.02rem; }
  .loc { color:var(--muted); font-size:0.86rem; }
  .date { margin-left:auto; color:var(--muted); font-size:0.8rem; }
  .roles { margin-top:4px; font-size:0.92rem; color:#333; }
  .badges { margin-top:8px; display:flex; gap:6px; flex-wrap:wrap; }
  .badge { font-size:0.74rem; padding:2px 8px; border-radius:20px; background:#f0f0f0; color:#555; text-transform:capitalize; }
  .badge.rt-remote { background:#e6f4ea; color:#1e7d34; }
  .badge.rt-hybrid { background:#fff4e0; color:#b06a00; }
  .badge.rt-onsite { background:#eef1f6; color:#3a5a8a; }
  .badge.sal { background:#fdeee4; color:var(--accent); font-weight:600; }
  .tags { margin-top:8px; display:flex; gap:5px; flex-wrap:wrap; }
  .tag { font-size:0.72rem; padding:2px 7px; border:1px solid var(--line); border-radius:5px; color:#666; }
  details { margin-top:10px; }
  summary { cursor:pointer; color:var(--muted); font-size:0.82rem; }
  .desc { white-space:pre-wrap; word-wrap:break-word; font-family:inherit; font-size:0.86rem; line-height:1.5; color:#444; background:var(--bg); padding:12px; border-radius:8px; margin:10px 0; }
  .job-foot { display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
  .report { color:var(--muted); font-size:0.82rem; }
  .report:hover { color:var(--accent); }
</style>`;

fs.writeFileSync(path.join(OUT, "index.html"),
  shell("jobs", 'hacker·job — Jobs', jobsBody, jobsScript));

// ---- Trends page -----------------------------------------------------------
const trendsBody = `
<h1>Trends</h1>
<p class="sub" id="sub">Loading…</p>

<section class="panel">
  <h2>Average salary over time</h2>
  <p class="hint">USD only · months with ≥5 salary disclosures · mid = (min + max) / 2</p>
  <svg id="salary" class="chart"></svg>
</section>

<section class="panel">
  <h2>Keyword popularity</h2>
  <p class="hint">% of each month's jobs mentioning the keyword. Toggle keywords to compare.</p>
  <div class="chips" id="chips"></div>
  <svg id="keywords" class="chart"></svg>
</section>`;

const trendsScript = `<script src="https://cdn.jsdelivr.net/npm/chart.xkcd@1.1/dist/chart.xkcd.min.js"></script>
<script>
const PALETTE = ['#e85d04','#1e7d34','#3a5a8a','#9b2226','#7b2cbf','#0096c7','#c9184a','#5f7d00','#bc6c25','#118ab2','#d62828','#2a9d8f','#6a4c93','#ef476f'];
let KW = [];
const selected = new Set();
function colorFor(key){ const i = KW.findIndex(k=>k.key===key); return PALETTE[i % PALETTE.length]; }

function drawKeywords(){
  const svg = document.getElementById('keywords');
  svg.innerHTML = '';
  const active = KW.filter(k=>selected.has(k.key));
  if(!active.length) return;
  new chartXkcd.XY(svg, {
    yLabel: '% of jobs',
    data: { datasets: active.map(k=>({ label: k.label, data: k.data })) },
    options: { xTickCount: 8, yTickCount: 5, timeFormat: 'YYYY-MM', showLine: true, dotSize: 0,
      legendPosition: chartXkcd.config.positionType.upLeft,
      dataColors: active.map(k=>colorFor(k.key)) }
  });
}

async function load(){
  const t = await fetch('data/trends.json').then(r=>r.json());
  document.getElementById('sub').textContent =
    'Signals from '+t.meta.months+' months of HN hiring posts ('+t.meta.from+' → '+t.meta.to+')';

  new chartXkcd.XY(document.getElementById('salary'), {
    yLabel: 'USD',
    data: { datasets: [{ label: 'Avg mid salary', data: t.salary }] },
    options: { xTickCount: 8, yTickCount: 5, timeFormat: 'YYYY-MM', showLine: true, dotSize: 0.4,
      legendPosition: chartXkcd.config.positionType.upLeft, dataColors: ['#e85d04'] }
  });

  KW = t.keywords;
  KW.filter(k=>k.default).forEach(k=>selected.add(k.key));
  const chips = document.getElementById('chips');
  chips.innerHTML = KW.map(k=>'<button class="chip'+(k.default?' on':'')+'" data-k="'+k.key+'">'+k.label+'</button>').join('');
  chips.querySelectorAll('.chip').forEach(btn=>{
    btn.onclick = ()=>{
      const k = btn.dataset.k;
      if(selected.has(k)){ selected.delete(k); btn.classList.remove('on'); }
      else { selected.add(k); btn.classList.add('on'); }
      drawKeywords();
    };
  });
  drawKeywords();
}
load().catch(e=>{ document.getElementById('sub').textContent='Failed to load trends data.'; console.error(e); });
</script>
<style>
  .panel { background:#fff; border:1px solid var(--line); border-radius:12px; padding:20px 22px; margin-bottom:24px; padding-right:34px; }
  .panel h2 { font-size:1.05rem; margin:0 0 2px; }
  .hint { color:var(--muted); font-size:0.82rem; margin:0 0 14px; }
  .chart { width:100%; overflow:visible; }
  .chips { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; }
  .chip { font-size:0.82rem; padding:5px 12px; border:1px solid var(--line); background:#fff; color:#555;
          border-radius:20px; cursor:pointer; transition:all .12s; }
  .chip:hover { border-color:#bbb; }
  .chip.on { background:var(--accent); border-color:var(--accent); color:#fff; }
</style>`;

fs.writeFileSync(path.join(OUT, "trends.html"),
  shell("trends", 'hacker·job — Trends', trendsBody, trendsScript));

// ---- Hackers page ----------------------------------------------------------
const hackersBody = `
<h1>Hackers</h1>
<p class="sub">Talented people who back hacker·job. Reach out, collaborate, or hire them.</p>

<div id="hackers"></div>

<section class="join">
  <h2>Get listed here</h2>
  <ol class="steps">
    <li><a href="https://github.com/sponsors/timqian" target="_blank" rel="noopener">Sponsor <b>timqian</b></a> on GitHub.</li>
    <li>Your info will appear here soon. ✨</li>
  </ol>
</section>`;

const hackersScript = `<script>
function esc(s){ return (s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function card(h){
  const url = esc(h.url || 'https://github.com/'+h.login);
  const avatar = esc(h.avatar || 'https://github.com/'+h.login+'.png');
  return '<a class="hacker" href="'+url+'" target="_blank" rel="noopener">'
    + '<img src="'+avatar+'" alt="'+esc(h.login)+'" loading="lazy" />'
    + '<div class="h-name">'+esc(h.name || h.login)+'</div>'
    + '<div class="h-login">@'+esc(h.login)+'</div>'
    + (h.bio?'<div class="h-bio">'+esc(h.bio)+'</div>':'')
    + '</a>';
}
fetch('data/hackers.json').then(r=>r.json()).then(list=>{
  const el = document.getElementById('hackers');
  el.innerHTML = list.length
    ? '<div class="hackers-grid">'+list.map(card).join('')+'</div>'
    : '<div class="empty"><div class="empty-icon">🧑‍💻</div><p>No hackers listed yet.</p>'
      + '<p class="sub">Sponsors will appear here soon — be the first!</p></div>';
}).catch(e=>console.error(e));
</script>
<style>
  .hackers-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:14px; margin-bottom:36px; }
  .hacker { display:block; background:#fff; border:1px solid var(--line); border-radius:12px; padding:18px; text-align:center; color:var(--ink); transition:border-color .12s, transform .12s; }
  .hacker:hover { border-color:var(--accent); transform:translateY(-2px); text-decoration:none; }
  .hacker img { width:64px; height:64px; border-radius:50%; object-fit:cover; }
  .h-name { font-weight:700; margin-top:10px; }
  .h-login { color:var(--muted); font-size:0.82rem; }
  .h-bio { color:#555; font-size:0.82rem; margin-top:8px; line-height:1.4; }
  .empty { text-align:center; padding:48px 0; background:#fff; border:1px dashed var(--line); border-radius:12px; margin-bottom:36px; }
  .empty-icon { font-size:2.4rem; }
  .empty p { margin:6px 0 0; }
  .join { background:#fff; border:1px solid var(--line); border-radius:12px; padding:22px 26px; }
  .join h2 { font-size:1.1rem; margin:0 0 14px; }
  .steps { margin:0; padding-left:22px; line-height:1.9; color:#333; }
  .steps code { background:var(--bg); border:1px solid var(--line); border-radius:5px; padding:1px 6px; font-size:0.86em; }
</style>`;

fs.writeFileSync(path.join(OUT, "hackers.html"),
  shell("hackers", 'hacker·job — Hackers', hackersBody, hackersScript));

// ---------------------------------------------------------------------------
// Derive manifest + trends from the jobs store (the source of truth).
const { count, months } = writeManifest();
const { months: trendMonths } = writeTrends();
console.log(`Built site/ — ${count.toLocaleString()} jobs across ${months} months, ${trendMonths} trend months`);
