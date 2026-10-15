// Layout profissional (desktop): divisórias arrastáveis, mostrar/ocultar painéis, maximizar Viewer ou Timeline,
// workspaces (Editing, Mapping, Animation, Audio, Show), layouts salvos e persistência. Não altera nenhuma lógica de projeção.
(function () {
  'use strict';
  var LC = window.LayoutCore; if (!LC) return;
  var coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
  var narrow = window.matchMedia && matchMedia('(max-width:820px) and (orientation:portrait)').matches;
  if (coarse || narrow) return;                         // iPhone/iPad usam a folha inferior própria
  var app = document.querySelector('.app'), wrap = document.querySelector('.stage-wrap'), panel = document.querySelector('.panel');
  if (!app || !wrap || !panel) return;

  var S;
  try { S = LC.sanitize(JSON.parse(localStorage.getItem(LC.KEY) || 'null'), window.innerHeight); } catch (e) { S = LC.defaults(); }
  if (S.show) LC.applyWorkspace(S, 'editing');          // nunca abre direto em Show Mode
  var els = {};

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function tlOn() { var T = window.TimelineUI; return !!(T && T._h && T._h.tl && T._h.tl.on); }
  function save() { try { localStorage.setItem(LC.KEY, JSON.stringify(S)); } catch (e) {} }

  var css = document.createElement('style');
  css.textContent = [
    '.app{position:relative;grid-template-columns:minmax(0,1fr) var(--panelw,360px)}',
    '.app.lay-nopanel{grid-template-columns:minmax(0,1fr)}.app.lay-nopanel>.panel{display:none}',
    '.app.tl-open.lay-notl{grid-template-rows:minmax(0,1fr)}.app.tl-open.lay-notl>.tl-dock{display:none}',
    '.app.tl-open.lay-maxtl{grid-template-rows:minmax(0,1fr)}.app.lay-maxtl>.stage-wrap{display:none}.app.lay-maxtl>.tl-dock{grid-row:1}.app.lay-maxtl .tl-grip{display:none}',
    '.lay-bar{position:absolute;left:26px;top:26px;z-index:7;display:flex;gap:4px;align-items:center;padding:4px;background:rgba(14,17,22,.88);border:1px solid var(--line);border-radius:10px;backdrop-filter:blur(6px)}',
    '.lay-bar select{font:inherit;font-size:12px;color:var(--fg);background:var(--panel-2);border:1px solid var(--line);border-radius:6px;padding:4px 6px}',
    '.lay-b{font:inherit;font-size:12px;min-width:28px;height:26px;padding:0 7px;border:1px solid transparent;background:transparent;color:var(--fg);border-radius:6px;cursor:pointer}',
    '.lay-b:hover{background:var(--panel-2)}.lay-b.on{background:var(--accent);color:var(--accent-ink);font-weight:600}',
    '.lay-time{font:11px ui-monospace,monospace;color:var(--muted);min-width:64px;text-align:right}',
    '.lay-sep{width:1px;height:18px;background:var(--line);margin:0 2px}',
    '.app.lay-maxtl .lay-bar{left:auto;top:auto;right:16px;bottom:14px}',
    '.lay-split{position:absolute;top:0;width:16px;z-index:8;cursor:col-resize;touch-action:none}',
    '.lay-split::after{content:"";position:absolute;left:7px;top:35%;bottom:35%;width:2px;border-radius:1px;background:var(--line);opacity:0;transition:opacity .15s}',
    '.lay-split:hover::after,.lay-split:focus-visible::after,.lay-split.drag::after{opacity:1;background:var(--accent)}',
    '.app.lay-nopanel .lay-split,.app.lay-maxtl .lay-split{display:none}',
    '.app.lay-show .overlay,.app.lay-show .ftool,.app.lay-show .tl-vbar,.app.lay-show .tl-hud{display:none!important}',
    '.app.lay-show .stage-wrap{border-color:transparent}',
    '.lay-toast{position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:9;padding:6px 12px;background:rgba(14,17,22,.92);border:1px solid var(--line);border-radius:8px;font-size:12px;color:var(--fg);pointer-events:none}'
  ].join('\n');
  document.head.appendChild(css);

  // ---- barra
  var bar = el('div', 'lay-bar'); bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Layout e workspaces');
  var sel = el('select'); sel.setAttribute('aria-label', 'Workspace'); sel.title = 'Workspace: muda a organização da tela';
  function fillSel() {
    sel.textContent = '';
    LC.ORDER.forEach(function (k) { var o = el('option', '', LC.WORKSPACES[k].label); o.value = k; sel.appendChild(o); });
    Object.keys(S.custom).forEach(function (k) { var o = el('option', '', '★ ' + k); o.value = 'c:' + k; sel.appendChild(o); });
    sel.value = S.workspace === 'custom' ? (els.lastCustom ? 'c:' + els.lastCustom : sel.value) : S.workspace;
  }
  function btn(label, title, fn, key) { var b = el('button', 'lay-b', label); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.addEventListener('click', fn); if (key) b.dataset.k = key; bar.appendChild(b); els[key] = b; return b; }
  bar.appendChild(sel);
  btn('◧', 'Mostrar ou ocultar o painel lateral', function () { S.showPanel = !S.showPanel; if (S.max) S.max = null; S.workspace = 'custom'; commit(); }, 'panel');
  btn('⬓', 'Mostrar ou ocultar a timeline', function () { S.showTimeline = !S.showTimeline; if (S.max) S.max = null; S.workspace = 'custom'; commit(); }, 'tl');
  btn('⤢', 'Maximizar o Viewer (de novo restaura)', function () { LC.toggleMax(S, 'viewer'); commit(); }, 'maxv');
  btn('⤡', 'Maximizar a Timeline (de novo restaura)', function () { LC.toggleMax(S, 'timeline'); commit(); }, 'maxt');
  btn('↺', 'Restaurar o layout padrão', function () { S = LC.reset(S); commit(true); }, 'reset');
  btn('★', 'Salvar este layout com um nome', function () {
    var n = window.prompt ? window.prompt('Nome do layout:', '') : ''; if (!n) return;
    var k = LC.saveCustom(S, n); if (k) { els.lastCustom = k; commit(true); toast('Layout "' + k + '" salvo'); }
  }, 'save');
  // transporte mínimo, visível no Show Mode
  var tbox = el('span', 'lay-tr'); tbox.style.display = 'none'; tbox.style.alignItems = 'center'; tbox.style.gap = '4px';
  var bPlay = el('button', 'lay-b', '▶'); bPlay.type = 'button'; bPlay.title = 'Tocar ou pausar'; bPlay.setAttribute('aria-label', 'Tocar ou pausar');
  var bStop = el('button', 'lay-b', '■'); bStop.type = 'button'; bStop.title = 'Parar e voltar ao início'; bStop.setAttribute('aria-label', 'Parar');
  var bExit = el('button', 'lay-b', 'Sair do Show'); bExit.type = 'button'; bExit.title = 'Voltar ao modo de edição';
  var tTime = el('span', 'lay-time', '00:00.000');
  tbox.appendChild(el('span', 'lay-sep')); tbox.appendChild(bPlay); tbox.appendChild(bStop); tbox.appendChild(tTime); tbox.appendChild(bExit); bar.appendChild(tbox);
  app.appendChild(bar);
  function T() { return window.TimelineUI; }
  bPlay.addEventListener('click', function () { var t = T(); if (!t) return; var c = t._h.tl.clock; if (c.playing) t.api.pause(); else t.api.play(); });
  bStop.addEventListener('click', function () { var t = T(); if (!t) return; t.api.pause(); t.api.seek(0); });
  bExit.addEventListener('click', function () { LC.applyWorkspace(S, 'editing'); commit(true); });
  var tick = setInterval(function () { if (!S.show) return; var t = T(); if (!t || !t._h) return; var c = t._h.tl.clock, s = c.now(); bPlay.textContent = c.playing ? '❚❚' : '▶'; tTime.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + (s % 60).toFixed(3).padStart(6, '0'); }, 200);

  sel.addEventListener('change', function () {
    var v = sel.value;
    if (v.indexOf('c:') === 0) { if (LC.recallCustom(S, v.slice(2))) els.lastCustom = v.slice(2); }
    else LC.applyWorkspace(S, v);
    commit(true);
  });

  // ---- divisória vertical (largura do painel)
  var split = el('div', 'lay-split'); split.setAttribute('role', 'separator'); split.setAttribute('aria-orientation', 'vertical'); split.setAttribute('aria-label', 'Largura do painel lateral'); split.tabIndex = 0; split.title = 'Arraste para mudar a largura (duplo clique restaura)';
  app.appendChild(split);
  function placeSplit() {
    var a = app.getBoundingClientRect(), w = wrap.getBoundingClientRect(), p = panel.getBoundingClientRect();
    if (!p.width) return;
    split.style.left = (p.left - a.left - 16) + 'px'; split.style.top = (w.top - a.top) + 'px'; split.style.height = w.height + 'px';
    split.setAttribute('aria-valuenow', String(Math.round(S.panelW))); split.setAttribute('aria-valuemin', String(LC.LIM.panelW[0])); split.setAttribute('aria-valuemax', String(LC.LIM.panelW[1]));
  }
  split.addEventListener('pointerdown', function (e) {
    e.preventDefault(); split.classList.add('drag'); var x0 = e.clientX, w0 = S.panelW;
    function mv(ev) { S.panelW = LC.clamp(w0 + (x0 - ev.clientX), LC.LIM.panelW[0], LC.LIM.panelW[1]); S.workspace = S.workspace === 'custom' ? 'custom' : S.workspace; apply(); }
    function up() { split.classList.remove('drag'); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); save(); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
  split.addEventListener('dblclick', function () { S.panelW = LC.WORKSPACES.editing.panelW; apply(); save(); });
  split.addEventListener('keydown', function (e) {
    var d = e.key === 'ArrowLeft' ? 20 : e.key === 'ArrowRight' ? -20 : 0; if (!d) return;
    e.preventDefault(); e.stopPropagation(); S.panelW = LC.clamp(S.panelW + d, LC.LIM.panelW[0], LC.LIM.panelW[1]); apply(); save();
  });

  function toast(t) { var x = el('div', 'lay-toast', t); app.appendChild(x); setTimeout(function () { x.remove(); }, 1600); }

  // ---- aplicar estado ao DOM
  function setTab(t) { try { var b = panel.querySelector('.phead [data-go="' + t + '"]'); if (b) b.click(); } catch (e) {} }
  var lastShow = null;
  function apply() {
    var on = tlOn();
    app.style.setProperty('--panelw', S.panelW + 'px');
    var ts = T() && T()._state; if (ts) { ts.dockH = S.tlH; }
    if (on) app.style.setProperty('--tlh', S.tlH + 'px');
    ['lay-nopanel', 'lay-notl', 'lay-maxtl', 'lay-maxv', 'lay-show'].forEach(function (c) { app.classList.remove(c); });
    LC.classes(S, on).forEach(function (c) { app.classList.add(c); });
    var isShow = !!S.show, isMain = !isShow;
    els.panel.classList.toggle('on', S.showPanel && !S.max); els.tl.classList.toggle('on', S.showTimeline && !S.max);
    els.maxv.classList.toggle('on', S.max === 'viewer'); els.maxt.classList.toggle('on', S.max === 'timeline');
    [els.panel, els.tl, els.maxv, els.maxt, els.reset, els.save, sel].forEach(function (b) { b.style.display = isShow ? 'none' : ''; });
    tbox.style.display = isShow ? 'flex' : 'none';
    if (lastShow !== isShow) { lastShow = isShow; try { window.api && window.api.setShowMode && window.api.setShowMode(isShow); } catch (e) {} if (isShow) { try { var h = T() && T()._h; if (h) { h.state.mode = 'corners'; h.renderOverlay(); } } catch (e) {} } }
    var tlRow = document.querySelector('.tl-dock'); if (tlRow) tlRow.setAttribute('aria-hidden', app.classList.contains('lay-notl') ? 'true' : 'false');
    placeSplit();
    // o Viewer (stage) se ajusta pelo ResizeObserver que já existe no control.js
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  }
  function commit(withTab) {
    if (withTab && S.tab) setTab(S.tab);
    apply(); save(); fillSel(); sel.value = S.workspace === 'custom' ? (els.lastCustom ? 'c:' + els.lastCustom : '') : S.workspace;
  }

  // no Show Mode, tudo que edita fica bloqueado (calibração protegida); só transporte, cenas e blackout
  window.addEventListener('keydown', function (e) {
    if (!S.show) return;
    var k = e.key, mod = e.ctrlKey || e.metaKey;
    var edit = /^Arrow/.test(k) || k === 'Delete' || k === 'Backspace' || (mod && /^[zyxvdc]$/i.test(k)) || (e.shiftKey && /^[tdc]$/i.test(k) && !mod);
    if (edit) { e.stopPropagation(); e.preventDefault(); }
    if (k === 'Escape') { LC.applyWorkspace(S, 'editing'); commit(true); }
  }, true);
  // o escudo bloqueia também clique no overlay (calibração protegida)
  wrap.addEventListener('pointerdown', function (e) { if (S.show && e.target.closest && e.target.closest('#overlay')) { e.stopPropagation(); e.preventDefault(); } }, true);

  // acompanha mudanças feitas pela própria timeline (arrastar a borda dela) e do tamanho da janela
  window.addEventListener('pointerup', function () { var ts = T() && T()._state; if (ts && ts.dockH && ts.dockH !== S.tlH && !S.show) { S.tlH = LC.clamp(ts.dockH, LC.LIM.tlH[0], Math.round(window.innerHeight * LC.LIM.tlH[1])); save(); } });
  window.addEventListener('resize', placeSplit);
  if (typeof ResizeObserver === 'function') new ResizeObserver(placeSplit).observe(app);
  // quando a timeline liga ou desliga, reaplica
  var mo = new MutationObserver(function () { var on = app.classList.contains('tl-open'); if (on !== els.prevOn) { els.prevOn = on; apply(); } });
  mo.observe(app, { attributes: true, attributeFilter: ['class'] });

  window.LayoutUI = { state: function () { return JSON.parse(JSON.stringify(S)); }, apply: apply, commit: commit, setWorkspace: function (n) { LC.applyWorkspace(S, n); commit(true); }, _tick: tick };
  fillSel(); apply();
  if (S.tab && S.workspace !== 'editing') setTab(S.tab);
})();
