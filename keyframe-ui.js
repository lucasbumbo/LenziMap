// LenziMap: editor visual de keyframes (Dopesheet + Editor de curvas) acoplado à timeline.
// Só desenha e edita o modelo via KeyframeCore. A reprodução continua sendo do SequencePlayer / Sequence.evalClip.
// Seleção guarda {p, t}: Desfazer troca a sequência inteira, então nunca guardamos objetos de keyframe.
(function (root) {
  'use strict';
  var Seq = null, K = null, Hh = null;
  var S = { open: false, view: 'sheet', sel: [], clipId: null, curveProp: null, rowSel: null, defI: 'linear', clipboard: null, focus: false, panelH: 210, anchor: null };
  var panel, barEl, bodyEl, infoEl, tField, vField, ctl = {}, menuEl = null, phEl = null;

  var ROWS = [
    { p: 'x', k: 100, u: '%' }, { p: 'y', k: 100, u: '%' }, { p: 'scale', k: 100, u: '%' }, { p: 'sx', k: 100, u: '%' }, { p: 'sy', k: 100, u: '%' },
    { p: 'rot', k: 1, u: '°' }, { p: 'opacity', k: 100, u: '%' }, { p: 'p1', k: 100, u: '%' }, { p: 'p2', k: 100, u: '%' }, { p: 'gain', k: 100, u: '%' }
  ];
  var BASIC = ['x', 'y', 'scale', 'rot', 'opacity'];
  var MODES = [['linear', 'Linear', 'Velocidade constante até o próximo keyframe'], ['hold', 'Hold', 'Mantém o valor e salta no próximo keyframe'], ['easein', 'Ease In', 'Começa devagar'], ['easeout', 'Ease Out', 'Termina devagar'], ['ease', 'Ease In/Out', 'Começa e termina devagar'], ['bezier', 'Bézier', 'Curva livre com alças (use a aba Curvas)']];
  var MODE_LABEL = {}; MODES.forEach(function (m) { MODE_LABEL[m[0]] = m[1]; });

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function svgEl(tag, attrs) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); return e; }
  // O painel se redesenha a cada clique, então o evento dblclick do navegador se perde: detectamos o duplo clique na mão.
  function isDouble(key, e) {
    var n = Date.now(), lc = S.lc, d = !!(!(e.shiftKey || e.metaKey || e.ctrlKey) && lc && lc.key === key && n - lc.t < 380 && Math.abs(e.clientX - lc.x) < 6 && Math.abs(e.clientY - lc.y) < 6);
    S.lc = d ? null : { key: key, t: n, x: e.clientX, y: e.clientY };
    return d;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rowDef(p) {
    if (p.indexOf('ill.') === 0) return { p: p, k: 1, u: '', label: Seq.KF_LABEL[p] || p };
    var r = null; ROWS.forEach(function (x) { if (x.p === p) r = x; });
    if (r) return { p: p, k: r.k, u: r.u, label: Seq.KF_LABEL[p] || p };
    return { p: p, k: 100, u: '%', label: Seq.KF_LABEL[p] || p };
  }
  function fmtV(p, v) { var d = rowDef(p), x = v * d.k; return (Math.round(x * 100) / 100) + d.u; }

  // ---------- acesso ao clipe selecionado ----------
  function cur() {
    var f = Hh.selectedClip();
    if (!f) return null;
    if (S.clipId !== f.clip.id) { S.clipId = f.clip.id; S.sel = []; S.curveProp = null; S.rowSel = null; }
    return f.clip;
  }
  function maxT(c) { return c.duration; }
  function localNow(c) { return Hh.curCl(c); }
  function rowsFor(c) {
    var a = Seq.asset(Hh.seq(), c.assetId), out = [];
    ROWS.forEach(function (r) {
      var show = BASIC.indexOf(r.p) >= 0 || !!c.keyframes[r.p] || (r.p === 'sx' || r.p === 'sy') ||
        ((r.p === 'p1' || r.p === 'p2') && a && a.kind === 'fx') || (r.p === 'gain' && a && (a.kind === 'audio' || a.kind === 'video'));
      if (show) out.push(rowDef(r.p));
    });
    if (c.ill && window.IllusionCore) IllusionCore.KF_PARAMS.forEach(function (n) { out.push(rowDef('ill.' + n)); });
    Object.keys(c.keyframes).forEach(function (p) { if (!out.some(function (x) { return x.p === p; })) out.push(rowDef(p)); });
    return out;
  }
  function selValid(c) { S.sel = c ? K.resolve(c, S.sel) : []; return S.sel; }
  function isSel(p, t) { return K.has(S.sel, p, t); }
  function setSel(list) { S.sel = list; }
  function toggleSel(list, add) {
    list.forEach(function (e) {
      if (add && K.has(S.sel, e.p, e.t)) S.sel = S.sel.filter(function (x) { return !(x.p === e.p && Math.abs(x.t - e.t) < K.EPS); });
      else if (!K.has(S.sel, e.p, e.t)) S.sel.push({ p: e.p, t: e.t });
    });
  }

  // ---------- aplicar mudança ----------
  function commit() { Hh.apply(); render(); }
  function afterEdit() { Hh.apply(); Hh.refresh(); render(); }
  function say(m) { Hh.say(m); }

  // ---------- operações de alto nível (botões, menu, teclado) ----------
  function doDelete() {
    var c = cur(); if (!c || !selValid(c).length) return;
    Hh.checkpoint(); var n = K.remove(c, S.sel); S.sel = []; afterEdit(); say(n + ' keyframe(s) excluído(s).');
  }
  function doCopy() {
    var c = cur(); if (!c || !selValid(c).length) { say('Selecione keyframes pra copiar.'); return; }
    S.clipboard = K.copy(c, S.sel); say(S.clipboard.items.length + ' keyframe(s) copiado(s). Cmd+V cola no playhead.');
  }
  function doPaste(at) {
    var c = cur(); if (!c || !S.clipboard) { say('Nada copiado.'); return; }
    Hh.checkpoint(); var t = at == null ? localNow(c) : at;
    S.sel = K.paste(c, S.clipboard, t, maxT(c)); afterEdit(); say(S.sel.length + ' keyframe(s) colado(s).');
  }
  function doDuplicate() {
    var c = cur(); if (!c || !selValid(c).length) return;
    Hh.checkpoint(); S.sel = K.duplicate(c, S.sel, maxT(c), 1 / Hh.fps()); afterEdit(); say(S.sel.length + ' keyframe(s) duplicado(s).');
  }
  function doMode(mode) {
    var c = cur(); if (!c) return;
    if (!selValid(c).length) { S.defI = mode; say('Interpolação padrão dos próximos keyframes: ' + MODE_LABEL[mode] + '.'); render(); return; }
    Hh.checkpoint(); K.setInterp(c, S.sel, mode); afterEdit();
  }
  function doAdd(props) {
    var c = cur(); if (!c) { say('Selecione um clipe.'); return; }
    var t = localNow(c);
    if (t < 0 || t > c.duration + 1e-6) { say('O playhead está fora do clipe.'); return; }
    var ps = props || (S.view === 'curve' && S.curveProp ? [S.curveProp] : (S.rowSel && S.rowSel !== '*' ? [S.rowSel] : BASIC.slice()));
    Hh.checkpoint(); var made = [];
    ps.forEach(function (p) { var v = Seq.valueAt(c, p, t); var k = Seq.setKey(c, p, t, v, K.find(c, p, t) ? undefined : S.defI); made.push({ p: p, t: k.t }); });
    S.sel = made; afterEdit();
  }
  function doStep(dir, anyProp) {
    var c = cur(); if (!c) return;
    var p = !anyProp && S.view === 'curve' && S.curveProp ? S.curveProp : (S.rowSel || null);
    var t = K.step(c, p, localNow(c), dir);
    if (t == null) t = K.step(c, null, localNow(c), dir);
    if (t == null) { say(dir > 0 ? 'Não há keyframe depois do playhead.' : 'Não há keyframe antes do playhead.'); return; }
    Hh.seek(c.start + t);
  }
  function doSelectAll() { var c = cur(); if (!c) return; S.sel = K.all(c); render(); }
  function nudge(dt) {
    var c = cur(); if (!c || !selValid(c).length) return false;
    Hh.checkpoint('kfn'); S.sel = K.move(c, S.sel, dt, maxT(c)); afterEdit(); return true;
  }

  // ---------- menu de contexto (módulo compartilhado tl-menu.js) ----------
  function showMenu(x, y, items) { if (window.TlMenu) window.TlMenu.show(x, y, items); }
  function closeMenu() { if (window.TlMenu) window.TlMenu.close(); }
  function kfMenu(e, entry) {
    e.preventDefault();
    var c = cur(); if (!c) return;
    if (entry && !K.has(S.sel, entry.p, entry.t)) { S.sel = [{ p: entry.p, t: entry.t }]; render(); }
    var uni = uniformMode(c);
    var items = MODES.map(function (m) { return { label: m[1], on: uni === m[0], disabled: !S.sel.length, fn: function () { doMode(m[0]); } }; });
    items.push('-');
    items.push({ label: 'Editar curva...', disabled: !S.sel.length, fn: function () { S.curveProp = S.sel[0].p; setView('curve'); } });
    items.push({ label: 'Ir para este keyframe', disabled: !S.sel.length, fn: function () { Hh.seek(c.start + S.sel[0].t); } });
    items.push('-');
    items.push({ label: 'Copiar', disabled: !S.sel.length, fn: doCopy });
    items.push({ label: 'Colar no playhead', disabled: !S.clipboard, fn: function () { doPaste(); } });
    items.push({ label: 'Duplicar', disabled: !S.sel.length, fn: doDuplicate });
    items.push({ label: 'Excluir', disabled: !S.sel.length, fn: doDelete });
    showMenu(e.clientX, e.clientY, items);
  }
  function laneMenu(e, p, t) {
    e.preventDefault();
    var c = cur(); if (!c) return;
    var items = [
      { label: 'Criar keyframe aqui', disabled: p === '*', fn: function () { Hh.checkpoint(); var k = Seq.setKey(c, p, t, Seq.valueAt(c, p, t), S.defI); S.sel = [{ p: p, t: k.t }]; afterEdit(); } },
      { label: 'Colar aqui', disabled: !S.clipboard, fn: function () { doPaste(t); } },
      '-', { label: 'Selecionar todos', fn: doSelectAll }
    ];
    showMenu(e.clientX, e.clientY, items);
  }
  function uniformMode(c) {
    var m = null, ok = true;
    S.sel.forEach(function (e) { var k = K.find(c, e.p, e.t); if (!k) return; if (m == null) m = k.i; else if (m !== k.i) ok = false; });
    return ok ? m : null;
  }

  // ---------- arrastar keyframes (Dopesheet, barra do clipe e curvas) ----------
  // opts.withValue: arrasto também muda o valor (editor de curvas). pxPerSec e xOfT vêm do chamador.
  function startDrag(e, c, pxPerSec, opts) {
    opts = opts || {};
    if (!S.sel.length) return;
    var x0 = e.clientX, y0 = e.clientY, moved = false, a0 = S.sel[0].t, total = 0, dvDone = 0;
    if (opts.axis) S.axis = opts.axis;
    function minT(list) { return Math.min.apply(null, list.map(function (en) { return en.t; })); }
    function mv(ev) {
      if (!moved) { if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 3) return; moved = true; Hh.checkpoint(); }
      var cc = Hh.clipById(c.id); if (!cc) return;
      var lock = opts.withValue && ev.shiftKey ? (Math.abs(ev.clientX - x0) >= Math.abs(ev.clientY - y0) ? 'x' : 'y') : null;
      if (lock !== 'y') {
        var target = a0 + (ev.clientX - x0) / pxPerSec;
        if (!ev.altKey) target = snapLocal(cc, target, pxPerSec);
        var dt = (target - a0) - total;
        if (Math.abs(dt) > 1e-9) {
          var before = minT(S.sel);
          S.sel = K.move(cc, S.sel, dt, maxT(cc));
          total += minT(S.sel) - before;
        }
      }
      if (opts.withValue && lock !== 'x') {
        var dv = opts.dvOf(ev.clientY - y0), inc = dv - dvDone;
        if (Math.abs(inc) > 1e-12) {
          S.sel.forEach(function (en) { if (en.p === (opts.prop || en.p)) { var k = K.find(cc, en.p, en.t); if (k) K.setValue(cc, en, k.v + inc); } });
          dvDone = dv;
        }
      }
      afterEditLive();
    }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); S.axis = null; if (moved) afterEdit(); else render(); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function afterEditLive() { Hh.apply(); Hh.refresh(); renderLive(); }
  function snapLocal(c, t, pxPerSec) {
    var abs = c.start + t, ph = Hh.now();
    if (Hh.snapOn()) {
      if (Math.abs(abs - ph) * pxPerSec < 8) return clamp(ph - c.start, 0, maxT(c));
      return clamp(Seq.quant(abs, Hh.fps()) - c.start, 0, maxT(c));
    }
    return clamp(t, 0, maxT(c));
  }

  // ---------- montagem ----------
  var CSS = [
    '.kfp{display:none;flex-direction:column;border-top:1px solid var(--line);background:var(--panel);height:var(--kfh,210px);min-height:90px;position:relative;outline:none}',
    '.kfp.open{display:flex}',
    '.kfp-grip{position:absolute;left:0;right:0;top:-3px;height:6px;cursor:ns-resize;z-index:30}',
    '.kfp-bar{display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding:5px 8px;border-bottom:1px solid var(--line)}',
    '.kfp-bar .tl-btn{padding:3px 7px;font-size:11px}',
    '.kfp-bar .kfm.on{border-color:#ffd23d;color:#ffd23d}',
    '.kfp-bar input{font:inherit;font-size:12px;width:76px;color:var(--fg);background:var(--panel-2);border:1px solid var(--line);border-radius:4px;padding:2px 4px}',
    '.kfp-info{margin-left:auto;font:11px var(--font-mono);color:var(--muted)}',
    '.kfp-body{flex:1;min-height:0;position:relative}',
    '.kfp-sheet{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;display:grid;grid-template-columns:236px minmax(0,1fr);align-content:start}',
    '.kfp-labels{border-right:1px solid var(--line);background:var(--panel-2)}',
    '.kfp-lab{height:22px;display:flex;align-items:center;gap:6px;padding:0 8px;font-size:12px;color:var(--muted);border-bottom:1px solid var(--line);cursor:pointer;white-space:nowrap;overflow:hidden}',
    '.kfp-lab.sel{color:var(--fg);background:rgba(255,210,61,.12)}.kfp-lab b{margin-left:auto;font:11px var(--font-mono);color:#ffd23d;font-weight:400}',
    '.kfp-scroll{overflow:hidden;position:relative}',
    '.kfp-lanes{position:relative}',
    '.kfp-row{position:absolute;left:0;right:0;height:22px;border-bottom:1px solid var(--line)}',
    '.kfp-row.alt{background:rgba(255,255,255,.02)}.kfp-row.all{background:rgba(255,210,61,.05)}',
    '.kfp-clipband{position:absolute;top:0;bottom:0;background:rgba(120,160,255,.08);border-left:1px solid rgba(120,160,255,.5);border-right:1px solid rgba(120,160,255,.5);pointer-events:none}',
    '.kfp-ph{position:absolute;top:0;bottom:0;width:0;border-left:2px solid var(--accent);pointer-events:none;z-index:6}',
    '.kfd{position:absolute;top:4px;width:12px;height:12px;margin-left:-6px;background:#ffd23d;border:1px solid #000;transform:rotate(45deg) scale(.78);cursor:ew-resize;z-index:3;box-sizing:border-box}',
    '.kfd[data-i="hold"]{transform:scale(.8);border-radius:1px}.kfd[data-i="ease"],.kfd[data-i="easein"],.kfd[data-i="easeout"]{border-radius:50%;transform:scale(.85)}',
    '.kfd[data-i="bezier"]{background:#ff9f43;box-shadow:0 0 0 2px rgba(255,159,67,.4)}',
    '.kfd.sel{background:#fff;border-color:#ff4f4f;box-shadow:0 0 0 2px #ff4f4f}',
    '.kfd.out{opacity:.35}.kfd.sum{background:#c9a227}',
    '.kfp-marq{position:fixed;border:1px dashed #fff;background:rgba(255,255,255,.12);pointer-events:none;z-index:50}',
    '.kfp-curve{position:absolute;inset:0;display:grid;grid-template-columns:236px minmax(0,1fr)}',
    '.kfp-chips{border-right:1px solid var(--line);overflow-y:auto;background:var(--panel-2)}',
    '.kfp-chip{display:flex;align-items:center;gap:6px;padding:4px 8px;font-size:12px;color:var(--muted);cursor:pointer;border-bottom:1px solid var(--line)}',
    '.kfp-chip.sel{color:var(--fg);background:rgba(255,210,61,.14)}.kfp-chip b{margin-left:auto;font:11px var(--font-mono);color:#ffd23d;font-weight:400}',
    '.kfp-svgw{position:relative;overflow:hidden}.kfp-svgw svg{position:absolute;left:0;top:0;display:block;width:100%;height:100%;touch-action:none;user-select:none}',
    '.kfp-empty{padding:14px;font-size:12px;color:var(--muted)}',
    '.tl-clip .kf{pointer-events:auto;cursor:ew-resize;width:9px;height:9px;transform:translateX(-4px) rotate(45deg);z-index:5}',
    '.tl-clip .kf.sel{background:#fff;border-color:#ff4f4f}'
  ].join('\n');

  function btn(label, title, fn, cls) {
    var b = el('button', 'tl-btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
    b.addEventListener('click', fn); return b;
  }

  function build() {
    var st = el('style'); st.textContent = CSS; document.head.appendChild(st);
    panel = el('section', 'kfp'); panel.tabIndex = -1; panel.id = 'kfp'; panel.setAttribute('aria-label', 'Editor de keyframes');
    var grip = el('div', 'kfp-grip'); panel.appendChild(grip);
    grip.addEventListener('pointerdown', function (e) {
      e.preventDefault(); var y0 = e.clientY, h0 = S.panelH;
      function mv(ev) { var nh = clamp(h0 + (y0 - ev.clientY), 100, 480); Hh.growDock(nh - S.panelH); S.panelH = nh; panel.style.setProperty('--kfh', nh + 'px'); }
      function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); render(); }
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    barEl = el('div', 'kfp-bar'); panel.appendChild(barEl);
    bodyEl = el('div', 'kfp-body'); panel.appendChild(bodyEl);
    buildBar();
    panel.addEventListener('pointerdown', function () { S.focus = true; }, true);
    document.addEventListener('pointerdown', function (e) { if (!panel.contains(e.target)) S.focus = false; }, true);
    Hh.mount(panel);
  }
  function buildBar() {
    barEl.textContent = '';
    ctl.sheet = btn('Dopesheet', 'Linhas por propriedade com losangos de keyframe', function () { setView('sheet'); });
    ctl.curve = btn('Curvas', 'Editor de curvas com alças Bézier', function () { setView('curve'); });
    var sep = function () { return el('span', 'tl-sep'); };
    ctl.prev = btn('◀', 'Keyframe anterior (Alt+←)', function () { doStep(-1); });
    ctl.add = btn('◆ Criar', 'Criar keyframe no playhead (na linha selecionada ou em posição, escala, rotação e opacidade)', function () { doAdd(); });
    ctl.next = btn('▶', 'Próximo keyframe (Alt+→)', function () { doStep(1); });
    barEl.appendChild(ctl.sheet); barEl.appendChild(ctl.curve); barEl.appendChild(sep()); barEl.appendChild(ctl.prev); barEl.appendChild(ctl.add); barEl.appendChild(ctl.next); barEl.appendChild(sep());
    ctl.modes = {};
    MODES.forEach(function (m) { var b = btn(m[1], m[2], function () { doMode(m[0]); }, 'kfm'); b.dataset.mode = m[0]; ctl.modes[m[0]] = b; barEl.appendChild(b); });
    barEl.appendChild(sep());
    barEl.appendChild(btn('Copiar', 'Copiar keyframes selecionados (Cmd+C)', doCopy));
    barEl.appendChild(btn('Colar', 'Colar no playhead (Cmd+V)', function () { doPaste(); }));
    barEl.appendChild(btn('Duplicar', 'Duplicar logo depois (Cmd+D)', doDuplicate));
    barEl.appendChild(btn('Excluir', 'Excluir selecionados (Delete)', doDelete));
    barEl.appendChild(sep());
    tField = el('input'); tField.type = 'number'; tField.step = 0.01; tField.title = 'Tempo do keyframe selecionado (s, dentro do clipe)'; tField.setAttribute('aria-label', 'Tempo do keyframe');
    vField = el('input'); vField.type = 'number'; vField.step = 0.1; vField.title = 'Valor do keyframe selecionado'; vField.setAttribute('aria-label', 'Valor do keyframe');
    [tField, vField].forEach(function (i) { i.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') i.blur(); }); });
    tField.addEventListener('change', function () {
      var c = cur(); if (!c || S.sel.length !== 1) return; var v = parseFloat(tField.value); if (!isFinite(v)) return;
      Hh.checkpoint(); var r = K.setTime(c, S.sel[0], clamp(v, 0, maxT(c)), maxT(c)); if (r) S.sel = [r]; afterEdit();
    });
    vField.addEventListener('change', function () {
      var c = cur(); if (!c || S.sel.length !== 1) return; var v = parseFloat(vField.value); if (!isFinite(v)) return;
      Hh.checkpoint(); K.setValue(c, S.sel[0], v / rowDef(S.sel[0].p).k); afterEdit();
    });
    barEl.appendChild(el('span', 'tl-tc', 't')); barEl.appendChild(tField); barEl.appendChild(el('span', 'tl-tc', 'v')); barEl.appendChild(vField);
    infoEl = el('span', 'kfp-info', ''); barEl.appendChild(infoEl);
  }
  function setView(v) { S.view = v; render(); }

  function toggle(on) {
    if (on == null) on = !S.open;
    if (on === S.open) return;
    S.open = on; panel.classList.toggle('open', on);
    panel.style.setProperty('--kfh', S.panelH + 'px');
    Hh.growDock(on ? S.panelH : -S.panelH);
    render();
    if (Hh.onToggle) Hh.onToggle(on);
  }

  // ---------- render ----------
  function render() {
    if (!panel) return;
    if (!S.open) return;
    var c = cur();
    ctl.sheet.classList.toggle('on', S.view === 'sheet'); ctl.curve.classList.toggle('on', S.view === 'curve');
    bodyEl.textContent = ''; phEl = null;
    if (!c) { bodyEl.appendChild(el('div', 'kfp-empty', 'Clique num clipe da timeline pra editar os keyframes dele aqui.')); updateBar(null); return; }
    selValid(c);
    if (S.view === 'curve') renderCurve(c); else renderSheet(c);
    updateBar(c);
  }
  function renderLive() { if (S.open) { var c = cur(); if (!c) return; selValid(c); if (S.view === 'curve') renderCurve(c, true); else renderSheet(c, true); updateBar(c); } }

  function updateBar(c) {
    var uni = c ? uniformMode(c) : null;
    Object.keys(ctl.modes).forEach(function (m) { ctl.modes[m].classList.toggle('on', S.sel.length ? uni === m : S.defI === m); });
    if (c && S.sel.length === 1) {
      var k = K.find(c, S.sel[0].p, S.sel[0].t), d = rowDef(S.sel[0].p);
      if (k) { if (document.activeElement !== tField) tField.value = (Math.round(k.t * 1000) / 1000).toString(); if (document.activeElement !== vField) vField.value = (Math.round(k.v * d.k * 100) / 100).toString(); }
      tField.disabled = vField.disabled = false;
    } else { tField.disabled = vField.disabled = true; if (document.activeElement !== tField) tField.value = ''; if (document.activeElement !== vField) vField.value = ''; }
    infoEl.textContent = !c ? '' : (S.sel.length ? S.sel.length + ' selecionado(s)' : K.all(c).length + ' keyframe(s)') + (c.loopMode === 'loop' ? ' · clipe em loop: repetem a cada ciclo' : '');
  }

  // ---------- Dopesheet ----------
  function renderSheet(c, live) {
    var host = bodyEl;
    host.textContent = '';
    var sheet = el('div', 'kfp-sheet'), labels = el('div', 'kfp-labels'), scroll = el('div', 'kfp-scroll'), lanes = el('div', 'kfp-lanes');
    var zoom = Hh.zoom(), rows = rowsFor(c), W = Hh.lanesWidth();
    lanes.style.width = W + 'px'; lanes.style.height = ((rows.length + 1) * 22) + 'px';
    var all = { p: '*', label: 'Todos os keyframes' };
    var list = [all].concat(rows);
    list.forEach(function (r, i) {
      var n = r.p === '*' ? K.all(c).length : (c.keyframes[r.p] || []).length;
      var lab = el('div', 'kfp-lab' + (S.rowSel === r.p ? ' sel' : ''));
      lab.dataset.p = r.p; lab.appendChild(el('span', null, r.label)); if (n) lab.appendChild(el('b', null, String(n)));
      lab.addEventListener('click', function () { S.rowSel = S.rowSel === r.p ? null : r.p; if (r.p !== '*') S.curveProp = r.p; render(); });
      labels.appendChild(lab);
      var row = el('div', 'kfp-row' + (r.p === '*' ? ' all' : (i % 2 ? ' alt' : ''))); row.style.top = (i * 22) + 'px'; row.dataset.p = r.p;
      lanes.appendChild(row);
      row.addEventListener('contextmenu', function (e) { if (e.target.classList.contains('kfd')) return; laneMenu(e, r.p, localFromClient(c, e.clientX, lanes)); });
      row.addEventListener('pointerdown', function (e) {
        if (e.target.classList.contains('kfd') || e.button !== 0) return;
        if (r.p !== '*' && isDouble('row:' + r.p, e)) {
          var t = clamp(localFromClient(c, e.clientX, lanes), 0, maxT(c)); t = snapLocal(c, t, zoom);
          Hh.checkpoint(); var k = Seq.setKey(c, r.p, t, Seq.valueAt(c, r.p, t), K.find(c, r.p, t) ? undefined : S.defI); S.sel = [{ p: r.p, t: k.t }]; S.rowSel = r.p; afterEdit(); return;
        }
        marquee(e, c, lanes, e.shiftKey || e.metaKey || e.ctrlKey);
      });
      if (r.p === '*') {
        var seen = {};
        K.all(c).forEach(function (en) { var key = en.t.toFixed(3); if (seen[key]) return; seen[key] = 1; row.appendChild(diamond(c, '*', en.t, zoom, true)); });
      } else (c.keyframes[r.p] || []).forEach(function (kf) { row.appendChild(diamond(c, r.p, kf.t, zoom, false, kf.i)); });
    });
    var band = el('div', 'kfp-clipband'); band.style.left = (c.start * zoom) + 'px'; band.style.width = Math.max(2, c.duration * zoom) + 'px'; lanes.insertBefore(band, lanes.firstChild);
    phEl = el('div', 'kfp-ph'); lanes.appendChild(phEl); phEl.style.left = (Hh.now() * zoom) + 'px';
    scroll.appendChild(lanes); sheet.appendChild(labels); sheet.appendChild(scroll); host.appendChild(sheet);
    scroll.scrollLeft = Hh.scrollLeft();
    scroll.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); Hh.zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, Hh.now()); return; }
      var dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
      if (dx) { e.preventDefault(); Hh.setScrollLeft(Hh.scrollLeft() + dx); }
    }, { passive: false });
  }
  function localFromClient(c, cx, lanes) { var r = lanes.getBoundingClientRect(); return (cx - r.left) / Hh.zoom() - c.start; }
  function diamond(c, p, t, zoom, summary, mode) {
    var d = el('div', 'kfd' + (summary ? ' sum' : '')); d.style.left = ((c.start + t) * zoom) + 'px';
    d.dataset.p = p; d.dataset.t = t.toFixed(4); d.dataset.i = summary ? 'linear' : (mode || 'linear');
    var entries = function () { return p === '*' ? K.atTime(c, t) : [{ p: p, t: t }]; };
    var sel = entries().length && entries().every(function (en) { return isSel(en.p, en.t); });
    if (sel) d.classList.add('sel');
    if (t > c.duration + 1e-6) d.classList.add('out');
    d.title = (summary ? 'Todos em ' : (rowDef(p).label + ' em ')) + Seq.fmt(t) + (summary ? '' : ' · ' + (MODE_LABEL[mode] || 'Linear'));
    d.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      if (isDouble('kf:' + p + ':' + t.toFixed(3), e)) { Hh.seek(c.start + t); return; }
      var add = e.shiftKey || e.metaKey || e.ctrlKey, en = entries();
      if (add) toggleSel(en, true);
      else if (!en.every(function (x) { return isSel(x.p, x.t); })) S.sel = en.map(function (x) { return { p: x.p, t: x.t }; });
      if (S.sel.length === 0) { render(); return; }
      // âncora = o keyframe clicado, para o encaixe valer pra ele
      var idx = S.sel.findIndex(function (x) { return Math.abs(x.t - t) < K.EPS && (p === '*' || x.p === p); });
      if (idx > 0) { var a = S.sel.splice(idx, 1)[0]; S.sel.unshift(a); }
      if (p !== '*') S.curveProp = p;
      render();
      startDrag(e, c, Hh.zoom());
    });
    d.addEventListener('contextmenu', function (e) { e.stopPropagation(); kfMenu(e, entries()[0]); });
    return d;
  }
  function marquee(e, c, lanes, additive) {
    var x0 = e.clientX, y0 = e.clientY, box = null, moved = false, base = additive ? S.sel.slice() : [];
    function mv(ev) {
      if (!moved && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 4) return;
      moved = true;
      if (!box) { box = el('div', 'kfp-marq'); document.body.appendChild(box); }
      var l = Math.min(x0, ev.clientX), t = Math.min(y0, ev.clientY), w = Math.abs(ev.clientX - x0), h = Math.abs(ev.clientY - y0);
      box.style.left = l + 'px'; box.style.top = t + 'px'; box.style.width = w + 'px'; box.style.height = h + 'px';
      var picked = base.slice();
      [].forEach.call(lanes.querySelectorAll('.kfd'), function (d) {
        var r = d.getBoundingClientRect();
        if (r.right < l || r.left > l + w || r.bottom < t || r.top > t + h) return;
        var p = d.dataset.p, tt = parseFloat(d.dataset.t);
        (p === '*' ? K.atTime(c, tt) : [{ p: p, t: tt }]).forEach(function (en) { if (!K.has(picked, en.p, en.t)) picked.push({ p: en.p, t: en.t }); });
      });
      S.sel = picked; renderLiveSelOnly(lanes);
    }
    function up(ev) {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      if (box) box.remove();
      if (!moved) { if (!additive) S.sel = []; Hh.seek(clamp(localFromClient(c, ev.clientX, lanes) + c.start, 0, Hh.duration())); }
      render();
    }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function renderLiveSelOnly(lanes) {
    var c = cur(); if (!c) return;
    [].forEach.call(lanes.querySelectorAll('.kfd'), function (d) {
      var p = d.dataset.p, t = parseFloat(d.dataset.t), en = p === '*' ? K.atTime(c, t) : [{ p: p, t: t }];
      d.classList.toggle('sel', en.length > 0 && en.every(function (x) { return isSel(x.p, x.t); }));
    });
  }

  // ---------- Editor de curvas ----------
  function renderCurve(c, live) {
    var host = bodyEl; host.textContent = '';
    var wrap = el('div', 'kfp-curve'), chips = el('div', 'kfp-chips'), sw = el('div', 'kfp-svgw');
    var props = Object.keys(c.keyframes).filter(function (p) { return c.keyframes[p].length; });
    props.sort(function (a, b) { return Seq.KF_PROPS.indexOf(a) - Seq.KF_PROPS.indexOf(b); });
    if (!props.length) {
      chips.appendChild(el('div', 'kfp-empty', 'Este clipe ainda não tem keyframes. Volte ao Dopesheet e dê duplo clique numa linha, ou use ◆ Criar.'));
      wrap.appendChild(chips); wrap.appendChild(sw); host.appendChild(wrap); return;
    }
    if (!S.curveProp || props.indexOf(S.curveProp) < 0) S.curveProp = props[0];
    props.forEach(function (p) {
      var ch = el('div', 'kfp-chip' + (p === S.curveProp ? ' sel' : '')); ch.dataset.p = p; ch.appendChild(el('span', null, rowDef(p).label)); ch.appendChild(el('b', null, String(c.keyframes[p].length)));
      ch.addEventListener('click', function () { S.curveProp = p; S.rowSel = p; render(); }); chips.appendChild(ch);
    });
    wrap.appendChild(chips); wrap.appendChild(sw); host.appendChild(wrap);
    var p = S.curveProp, arr = c.keyframes[p], Wd = Math.max(200, sw.clientWidth || 600), Ht = Math.max(80, sw.clientHeight || 140);
    var padL = 46, padR = 12, padT = 10, padB = 18;
    var tmax = Math.max(c.duration, arr[arr.length - 1].t, 0.1);
    var rg = K.range(c, p), lo = rg[0], hi = rg[1];
    var fz = S.axis && S.axis.p === p ? S.axis : null;
    // inclui o overshoot das alças na escala vertical
    arr.forEach(function (k, i) { if (k.i === 'bezier' && k.h && arr[i + 1]) { var dv = arr[i + 1].v - k.v; [k.h[1], k.h[3]].forEach(function (y) { var vv = k.v + y * dv; if (vv < lo) lo = vv; if (vv > hi) hi = vv; }); } });
    if (hi - lo < 1e-6) { lo -= 0.5; hi += 0.5; }
    var pad = (hi - lo) * 0.14; lo -= pad; hi += pad;
    if (p === 'opacity' || p === 'gain' || p === 'p1') { lo = Math.min(lo, 0); hi = Math.max(hi, 1); }
    if (fz) { lo = fz.lo; hi = fz.hi; tmax = fz.tmax; }
    function tx(t) { return padL + (t / tmax) * (Wd - padL - padR); }
    function ty(v) { return padT + (1 - (v - lo) / (hi - lo)) * (Ht - padT - padB); }
    function tOf(x) { return (x - padL) / (Wd - padL - padR) * tmax; }
    function vOf(y) { return lo + (1 - (y - padT) / (Ht - padT - padB)) * (hi - lo); }
    var svg = svgEl('svg', { viewBox: '0 0 ' + Wd + ' ' + Ht, preserveAspectRatio: 'none', 'data-curve': p }); sw.appendChild(svg);
    svg.__g = { tx: tx, ty: ty, invT: tOf, invV: vOf, tmax: tmax, lo: lo, hi: hi, p: p };
    var d = rowDef(p), i;
    // grade
    for (i = 0; i <= 4; i++) {
      var v = lo + (hi - lo) * i / 4, y = ty(v);
      svg.appendChild(svgEl('line', { x1: padL, x2: Wd - padR, y1: y, y2: y, stroke: 'rgba(255,255,255,.1)' }));
      var tt = svgEl('text', { x: padL - 4, y: y + 3, 'text-anchor': 'end', fill: '#8a93a6', 'font-size': 10 }); tt.textContent = String(Math.round(v * d.k * 10) / 10); svg.appendChild(tt);
    }
    var step = tmax > 20 ? 5 : tmax > 8 ? 2 : tmax > 3 ? 1 : 0.5;
    for (var tk = 0; tk <= tmax + 1e-6; tk += step) {
      var x = tx(tk); svg.appendChild(svgEl('line', { x1: x, x2: x, y1: padT, y2: Ht - padB, stroke: 'rgba(255,255,255,.06)' }));
      var tl2 = svgEl('text', { x: x, y: Ht - 4, 'text-anchor': 'middle', fill: '#8a93a6', 'font-size': 10 }); tl2.textContent = (Math.round(tk * 10) / 10) + 's'; svg.appendChild(tl2);
    }
    // limites do clipe
    svg.appendChild(svgEl('line', { x1: tx(c.duration), x2: tx(c.duration), y1: padT, y2: Ht - padB, stroke: 'rgba(120,160,255,.5)', 'stroke-dasharray': '4 3' }));
    // curva avaliada pelo mesmo motor da reprodução
    var pts = [], N = 220;
    for (i = 0; i <= N; i++) { var t = tmax * i / N, vv = Seq.interp(arr, t); pts.push(tx(t).toFixed(1) + ',' + ty(vv).toFixed(1)); }
    svg.appendChild(svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: '#6fb1ff', 'stroke-width': 2, 'data-role': 'curve' }));
    // playhead
    var lt = Hh.curClRaw(c);
    var ph = svgEl('line', { x1: tx(clamp(lt, 0, tmax)), x2: tx(clamp(lt, 0, tmax)), y1: padT, y2: Ht - padB, stroke: 'var(--accent, #ff4fa3)', 'stroke-width': 1.5, 'data-role': 'ph', style: 'pointer-events:none' }); svg.appendChild(ph);
    // alças dos segmentos que partem de keyframes selecionados (ou que chegam neles)
    arr.forEach(function (k, ix) {
      var nx = arr[ix + 1]; if (!nx) return;
      var ends = isSel(p, k.t) || isSel(p, nx.t);
      if (!ends || k.i === 'hold') return;
      var h = Seq.handlesOf(k), dt = nx.t - k.t, dv = nx.v - k.v;
      var p1 = { x: tx(k.t + h[0] * dt), y: ty(k.v + h[1] * dv) }, p2 = { x: tx(k.t + h[2] * dt), y: ty(k.v + h[3] * dv) };
      var a = { x: tx(k.t), y: ty(k.v) }, b = { x: tx(nx.t), y: ty(nx.v) };
      // alça colada no próprio ponto (Ease In/Out nas pontas) fica por baixo, senão esconderia o ponto
      var near1 = Math.hypot(p1.x - a.x, p1.y - a.y) < 10, near2 = Math.hypot(p2.x - b.x, p2.y - b.y) < 10;
      svg.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: p1.x, y2: p1.y, stroke: '#ff9f43', 'stroke-width': 1 }));
      svg.appendChild(svgEl('line', { x1: b.x, y1: b.y, x2: p2.x, y2: p2.y, stroke: '#ff9f43', 'stroke-width': 1 }));
      [[p1, 1, near1], [p2, 2, near2]].forEach(function (hp) {
        if (hp[2]) return;
        var g = svgEl('rect', { x: hp[0].x - 4, y: hp[0].y - 4, width: 8, height: 8, fill: '#ff9f43', stroke: '#000', 'data-role': 'handle', 'data-ix': ix, 'data-h': hp[1], style: 'cursor:grab' });
        g.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); handleDrag(e, c, p, k.t, hp[1], tx, ty, svg); });
        svg.appendChild(g);
      });
    });
    // pontos
    arr.forEach(function (k) {
      var sel = isSel(p, k.t);
      var cir = svgEl('circle', { cx: tx(k.t), cy: ty(k.v), r: sel ? 6 : 5, fill: sel ? '#fff' : '#ffd23d', stroke: sel ? '#ff4f4f' : '#000', 'stroke-width': sel ? 2 : 1, 'data-role': 'point', 'data-t': k.t.toFixed(4), style: 'cursor:move' });
      cir.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
        if (isDouble('pt:' + p + ':' + k.t.toFixed(3), e)) { Hh.seek(c.start + k.t); return; }
        var add = e.shiftKey || e.metaKey || e.ctrlKey;
        if (add) toggleSel([{ p: p, t: k.t }], true); else if (!isSel(p, k.t)) S.sel = [{ p: p, t: k.t }];
        var ix = S.sel.findIndex(function (x) { return x.p === p && Math.abs(x.t - k.t) < K.EPS; });
        if (ix > 0) { var a0 = S.sel.splice(ix, 1)[0]; S.sel.unshift(a0); }
        var pxPerSec = (Wd - padL - padR) / tmax, vpp = (hi - lo) / (Ht - padT - padB);
        render();
        startDrag(e, c, pxPerSec, { withValue: true, prop: p, axis: { p: p, lo: lo, hi: hi, tmax: tmax }, dvOf: function (dy) { return -dy * vpp; } });
      });
      cir.addEventListener('contextmenu', function (e) { e.stopPropagation(); kfMenu(e, { p: p, t: k.t }); });
      var title = svgEl('title'); title.textContent = d.label + ' ' + Seq.fmt(k.t) + ' = ' + fmtV(p, k.v) + ' · ' + (MODE_LABEL[k.i] || 'Linear'); cir.appendChild(title);
      svg.appendChild(cir);
    });
    function ptr(e) { var r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left) * (Wd / r.width), y: (e.clientY - r.top) * (Ht / r.height) }; }
    svg.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target !== svg && e.target.getAttribute('data-role') && e.target.getAttribute('data-role') !== 'curve') return;
      var q = ptr(e), t = clamp(tOf(q.x), 0, tmax);
      if (isDouble('curve:' + p, e)) {
        var t2 = snapLocal(c, clamp(t, 0, maxT(c)), (Wd - padL - padR) / tmax), v = K.clampV(p, vOf(q.y));
        Hh.checkpoint(); var k = Seq.setKey(c, p, t2, v, K.find(c, p, t2) ? undefined : S.defI); S.sel = [{ p: p, t: k.t }]; afterEdit(); return;
      }
      if (!(e.shiftKey || e.metaKey || e.ctrlKey)) S.sel = [];
      Hh.seek(c.start + t); render();
    });
    svg.addEventListener('contextmenu', function (e) {
      if (e.target.getAttribute('data-role') === 'point') return;
      var q = ptr(e); laneMenu(e, p, clamp(tOf(q.x), 0, maxT(c)));
    });
  }
  // arrastar uma alça: x em 0..1 do segmento, y relativo à diferença de valores (permite overshoot)
  function handleDrag(e, c, p, t0, which, tx, ty, svg0) {
    var moved = false, g0 = svg0.__g;
    S.axis = { p: p, lo: g0.lo, hi: g0.hi, tmax: g0.tmax };
    function mv(ev) {
      var cc = Hh.clipById(c.id); if (!cc) return;
      var svg = bodyEl.querySelector('svg'); if (!svg) return;
      var arr = cc.keyframes[p] || [], ix = -1, i;
      for (i = 0; i < arr.length; i++) if (Math.abs(arr[i].t - t0) < K.EPS) ix = i;
      if (ix < 0 || !arr[ix + 1]) return;
      var a = arr[ix], b = arr[ix + 1], dt = b.t - a.t, dv = b.v - a.v;
      if (!moved) { moved = true; Hh.checkpoint(); }
      var r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, x = (ev.clientX - r.left) * (vb.width / r.width), y = (ev.clientY - r.top) * (vb.height / r.height);
      var t = g0.invT(x), v = g0.invV(y), h = Seq.handlesOf(a);
      var nx = clamp((t - a.t) / dt, 0, 1), ny = Math.abs(dv) < 1e-9 ? (which === 1 ? h[1] : h[3]) : (v - a.v) / dv;
      ny = clamp(ny, -3, 4);
      if (ev.shiftKey) ny = which === 1 ? h[1] : h[3];
      if (which === 1) { h[0] = nx; h[1] = ny; } else { h[2] = nx; h[3] = ny; }
      K.setHandles(cc, { p: p, t: a.t }, h);
      afterEditLive();
    }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); S.axis = null; if (moved) afterEdit(); else render(); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }

  // ---------- teclado ----------
  function key(e) {
    if (!S.open) return false;
    var cmd = e.metaKey || e.ctrlKey, k = e.key;
    if (e.altKey && !cmd && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); e.stopImmediatePropagation(); doStep(k === 'ArrowLeft' ? -1 : 1, true); return true; }
    if (!S.focus) return false;
    function eat() { e.preventDefault(); e.stopImmediatePropagation(); }
    if (cmd && (k === 'c' || k === 'C')) { eat(); doCopy(); return true; }
    if (cmd && (k === 'v' || k === 'V')) { eat(); doPaste(); return true; }
    if (cmd && (k === 'x' || k === 'X')) { eat(); doCopy(); doDelete(); return true; }
    if (cmd && (k === 'd' || k === 'D')) { eat(); doDuplicate(); return true; }
    if (cmd && (k === 'a' || k === 'A')) { eat(); doSelectAll(); return true; }
    if (cmd) return false;
    if ((k === 'Delete' || k === 'Backspace') && S.sel.length) { eat(); doDelete(); return true; }
    if ((k === 'ArrowLeft' || k === 'ArrowRight') && S.sel.length) { eat(); nudge((k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 10 : 1) / Hh.fps()); return true; }
    if (k === 'Escape' && S.sel.length) { eat(); S.sel = []; render(); return true; }
    return false;
  }

  // ---------- integração com a barra do clipe ----------
  function barDown(e, clipId, t) {
    var f = Hh.findClip(clipId); if (!f) return false;
    var c = f.clip;
    var en = K.atTime(c, t);
    if (!en.length) return false;
    if (S.clipId !== c.id) { S.clipId = c.id; S.sel = []; }
    var add = e.shiftKey || e.metaKey || e.ctrlKey;
    if (add) toggleSel(en, true); else if (!en.every(function (x) { return isSel(x.p, x.t); })) S.sel = en.map(function (x) { return { p: x.p, t: x.t }; });
    var idx = S.sel.findIndex(function (x) { return Math.abs(x.t - t) < K.EPS; });
    if (idx > 0) { var a = S.sel.splice(idx, 1)[0]; S.sel.unshift(a); }
    S.focus = true;
    render(); Hh.refresh();
    startDrag(e, c, Hh.zoom());
    return true;
  }
  function selAt(clipId, t) { return S.clipId === clipId && K.atTime(Hh.clipById(clipId) || { keyframes: {} }, t).some(function (e) { return isSel(e.p, e.t); }); }

  function updatePlayhead() {
    if (!S.open) return;
    if (phEl) phEl.style.left = (Hh.now() * Hh.zoom()) + 'px';
    if (S.view === 'curve') {
      var c = cur(); if (!c) return;
      var ln = bodyEl.querySelector('[data-role="ph"]'), svg = bodyEl.querySelector('svg');
      if (ln && svg && svg.__g) { var x = svg.__g.tx(clamp(Hh.curClRaw(c), 0, svg.__g.tmax)); ln.setAttribute('x1', x); ln.setAttribute('x2', x); }
    }
  }
  function syncScroll() { var s = bodyEl && bodyEl.querySelector('.kfp-scroll'); if (s) s.scrollLeft = Hh.scrollLeft(); }

  function init(host) {
    Hh = host; Seq = host.Seq; K = host.K;
    build();
  }

  root.KeyframeUI = {
    init: init, toggle: toggle, render: render, key: key, barDown: barDown, selAt: selAt, updatePlayhead: updatePlayhead, syncScroll: syncScroll,
    isOpen: function () { return S.open; }, defInterp: function () { return S.defI; }, showMenu: showMenu, closeMenu: closeMenu,
    _state: S
  };
})(typeof window !== 'undefined' ? window : globalThis);
