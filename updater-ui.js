// Cartão discreto de atualização (só no app de Mac/Electron; no iOS e no navegador não faz nada).
(function () {
  'use strict';
  var U = window.api && window.api.updater;
  if (!U) return;
  var card = document.createElement('div');
  card.id = 'upd-card'; card.setAttribute('role', 'status'); card.setAttribute('aria-live', 'polite'); card.hidden = true;
  var css = document.createElement('style');
  css.textContent = '#upd-card{position:fixed;left:16px;bottom:16px;z-index:9000;width:300px;padding:12px 14px;background:var(--panel-2,#1b212a);color:var(--fg,#e8ebf0);border:1px solid var(--line,#2a313c);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.45);font:13px/1.4 system-ui,sans-serif}' +
    '#upd-card[hidden]{display:none}#upd-card .u-msg{margin:0 0 10px}#upd-card .u-row{display:flex;gap:8px;justify-content:flex-end}' +
    '#upd-card .u-bar{height:6px;border-radius:3px;background:var(--line,#2a313c);overflow:hidden;margin:2px 0 6px}#upd-card .u-bar i{display:block;height:100%;width:0;background:var(--accent,#ff4fa3);transition:width .2s}' +
    '#upd-card .u-pct{font:11px ui-monospace,monospace;color:var(--muted,#8e97a6);text-align:right}';
  document.head.appendChild(css);
  document.body.appendChild(card);

  function btn(label, cls, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (cls ? ' ' + cls : ''); b.textContent = label; b.addEventListener('click', fn); return b; }
  function render(s) {
    card.textContent = '';
    // Durante a projeção nada aparece: o aviso volta quando a saída for fechada.
    var show = s && !s.hidden && !s.projecting && ['available', 'downloading', 'ready', 'none', 'error'].indexOf(s.status) >= 0;
    if (s && s.status === 'ready' && s.projecting) show = false;
    if (!show) { card.hidden = true; return; }
    var p = document.createElement('p'); p.className = 'u-msg'; p.textContent = s.message; card.appendChild(p);
    var row = document.createElement('div'); row.className = 'u-row';
    if (s.status === 'available') { row.appendChild(btn('Later', '', function () { U.later(); })); row.appendChild(btn('Update Now', 'primary', function () { U.download(); })); }
    else if (s.status === 'downloading') {
      var bar = document.createElement('div'); bar.className = 'u-bar'; var i = document.createElement('i'); i.style.width = s.percent + '%'; bar.appendChild(i); card.appendChild(bar);
      var pc = document.createElement('div'); pc.className = 'u-pct'; pc.textContent = s.percent + '%'; card.appendChild(pc);
    } else if (s.status === 'ready') { row.appendChild(btn('Install Later', '', function () { U.later(); })); row.appendChild(btn('Restart and Install', 'primary', function () { U.install(); })); }
    else { row.appendChild(btn('OK', '', function () { U.later(); })); }
    if (row.childNodes.length) card.appendChild(row);
    card.hidden = false;
  }
  U.onState(render);
  U.state().then(render).catch(function () {});
  window.__updRender = render;
})();
