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
