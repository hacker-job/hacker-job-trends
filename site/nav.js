// Shared site header — injected so the pages don't duplicate nav markup.
(function () {
  const MARK = '<svg class="mark" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="hacker·job logo">'
    + '<rect width="32" height="32" rx="7" fill="#e85d04"/>'
    + '<path d="M10 10 L16 16 L10 22" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M18 22 H23" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>'
    + '</svg>';

  const active = location.pathname.split('/').pop() || 'index.html';
  const links = [['hackers.html', 'Hackers'], ['index.html', 'Jobs'], ['trends.html', 'Trends']];
  const linksHtml = links
    .map(([href, label]) => '<a href="' + href + '"' + (href === active ? ' class="active"' : '') + '>' + label + '</a>')
    .join('');

  const header = document.createElement('header');
  header.className = 'nav';
  header.innerHTML = '<div class="nav-inner">'
    + '<a href="index.html" class="brand">' + MARK + '<span>hacker<b>·</b>job</span></a>'
    + '<nav class="nav-links">' + linksHtml + '</nav>'
    + '</div>';
  document.body.insertBefore(header, document.body.firstChild);
})();
