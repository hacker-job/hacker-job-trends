const REPO = "hacker-job/hacker-job-trends";
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
  const body = 'The extracted info for this job looks wrong (fields are AI-extracted).\n\n'
    + 'Job: '+j.company+'\nHacker News: https://news.ycombinator.com/item?id='+j.id+'\n\n'
    + 'What is incorrect:\n- ';
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
  const terms = elQ.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
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
    for(const line of text.split('\n')){ if(line.trim()) JOBS.push(JSON.parse(line)); }
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
