// LenziMap: menu de contexto leve, compartilhado pela timeline e pelo editor de keyframes.
// TlMenu.show(x, y, items): item = {label, fn, on, disabled, hint} ou '-' (separador). Fecha com Esc, clique fora ou ao escolher.
(function (root) {
  'use strict';
  var menuEl = null;
  var CSS = [
    '.kf-menu{position:fixed;z-index:300;min-width:210px;max-height:80vh;overflow-y:auto;background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.5);padding:4px;display:flex;flex-direction:column}',
    '.kf-menu button{font:inherit;font-size:12px;text-align:left;color:var(--fg);background:none;border:0;padding:6px 10px;border-radius:5px;cursor:pointer;display:flex;gap:18px;justify-content:space-between}',
    '.kf-menu button:hover:not(:disabled){background:var(--panel-2)}.kf-menu button:disabled{opacity:.4;cursor:default}.kf-menu button.on{color:#ffd23d}',
    '.kf-menu button i{font:normal 11px var(--font-mono);color:var(--muted)}',
    '.kf-menu .sep{height:1px;background:var(--line);margin:3px 2px}',
    '.kf-menu .hd{font:500 10px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding:5px 10px 2px}'
  ].join('\n');
  function injectCss() { if (document.getElementById('tl-menu-css')) return; var s = document.createElement('style'); s.id = 'tl-menu-css'; s.textContent = CSS; document.head.appendChild(s); }
  function close() {
    if (menuEl) { menuEl.remove(); menuEl = null; }
    document.removeEventListener('pointerdown', onOut, true);
    document.removeEventListener('keydown', onKey, true);
  }
  function onOut(e) { if (menuEl && !menuEl.contains(e.target)) close(); }
  function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } }
  function show(x, y, items) {
    injectCss(); close();
    menuEl = document.createElement('div'); menuEl.className = 'kf-menu'; menuEl.setAttribute('role', 'menu');
    items.forEach(function (it) {
      if (it === '-') { var s = document.createElement('div'); s.className = 'sep'; menuEl.appendChild(s); return; }
      if (it.header) { var h = document.createElement('div'); h.className = 'hd'; h.textContent = it.header; menuEl.appendChild(h); return; }
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); if (it.on) b.className = 'on';
      var l = document.createElement('span'); l.textContent = (it.on ? '✓ ' : '') + it.label; b.appendChild(l);
      if (it.hint) { var i = document.createElement('i'); i.textContent = it.hint; b.appendChild(i); }
      if (it.disabled) b.disabled = true;
      b.addEventListener('click', function () { close(); try { it.fn(); } catch (err) { if (window.console) console.error(err); } });
      menuEl.appendChild(b);
    });
    document.body.appendChild(menuEl);
    var r = menuEl.getBoundingClientRect();
    menuEl.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 4)) + 'px';
    menuEl.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) + 'px';
    setTimeout(function () { document.addEventListener('pointerdown', onOut, true); document.addEventListener('keydown', onKey, true); }, 0);
    return menuEl;
  }
  root.TlMenu = { show: show, close: close, isOpen: function () { return !!menuEl; } };
})(typeof window !== 'undefined' ? window : globalThis);
