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
