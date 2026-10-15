// LenziMap 3.0 fase 6: painel "Árvore" (Biblioteca > Projeto > Cena > Grupo > Cubo > Face > Camada > Clipe > Efeito).
// A lógica está em hierarchy-core.js; aqui só desenha, seleciona, arrasta e repassa para as operações (cada ação grava um ponto de Undo).
(function (root) {
  'use strict';
  var HC = root.HierarchyCore, IC = root.IllusionCore, Seq = root.Sequence, H = null, sec = null, tree = null;
  var S = { sel: [], anchor: null, rename: null, drag: null, msg: '', sig: '', rows: [] };
  var GLYPH = { library: '▣', project: '◫', scene: '▤', group: '▦', cube: '◼', face: '▭', layer: '≡', clip: '▬', effect: '✦', audio: '♪', free: '◌' };
  var TYPE_NAME = { library: 'Biblioteca', project: 'Projeto', scene: 'Cena', group: 'Grupo', cube: 'Cubo', face: 'Face', layer: 'Camada', clip: 'Clipe', effect: 'Efeito', audio: 'Áudio', free: 'Sem cubo' };
  var CSS = '.hr-wrap{display:flex;flex-direction:column;gap:8px}.hr-bar{display:flex;gap:6px;flex-wrap:wrap}.hr-tree{border:1px solid var(--line);border-radius:8px;background:var(--panel);max-height:48vh;overflow:auto;padding:4px;outline:none}' +
    '.hr-row{display:flex;align-items:center;gap:4px;padding:3px 6px;border-radius:5px;cursor:pointer;font-size:12px;border:1px solid transparent;min-height:24px}.hr-row:hover{background:var(--panel-2)}.hr-row.sel{background:#2a3a55;border-color:#4a7bd0}.hr-row.drop{border-color:#ffd24a;background:#3a3320}' +
    '.hr-chev{width:16px;border:0;background:none;color:var(--muted);cursor:pointer;padding:0;font-size:11px}.hr-ic{color:var(--muted);width:14px;text-align:center}.hr-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hr-meta{font-size:10px;color:var(--muted)}' +
    '.hr-row[data-type="face"][data-empty="1"] .hr-name{color:var(--muted);font-style:italic}.hr-row[data-type="scene"].active .hr-name{font-weight:700}.hr-rn{flex:1;font:inherit;background:#0b0d12;color:var(--fg);border:1px solid #4a7bd0;border-radius:4px;padding:1px 4px}' +
    '.hr-box{border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--panel);display:flex;flex-direction:column;gap:6px}.hr-prop{display:grid;grid-template-columns:1fr 90px 64px;gap:6px;align-items:center;font-size:12px}.hr-note{font-size:11px;color:var(--muted);margin:0}.hr-warn{font-size:12px;color:#ffd37a;margin:0}';
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function btn(txt, fn, id, title) { var b = el('button', 'btn', txt); b.type = 'button'; if (id) b.id = id; if (title) b.title = title; b.addEventListener('click', fn); return b; }
  function seq() { return H.tl.seq; }
  function ctx() { return { seq: seq(), scenes: H.state.scenes, active: H.state.scene }; }
  function say(t) { S.msg = t; var m = document.getElementById('hr-msg'); if (m) m.textContent = t; }
  function syncOut() { try { H.rend.sync(H.view()); } catch (e) {} H.syncClock(); H.push(); H.renderAll(); }
  // Roda uma operação com ponto de Undo, refaz tudo e mostra o resultado
  function act(label, fn) {
    H.checkpoint(/^shared-/.test(label) ? 'hr-' + label : undefined);   // ações discretas sempre criam ponto de Undo; só ajuste contínuo agrupa
    var r = fn();
    if (r && r.ok === false) { say(r.error || 'Não deu.'); return r; }
    syncOut(); S.sig = ''; refresh();
    if (r && r.warnings && r.warnings.length) say(r.warnings.join(' '));
    return r;
  }

  // ---------- seleção ----------
  function rowsOf() { return S.rows; }
  function isSel(id) { return S.sel.indexOf(id) >= 0; }
  function select(id, how) {
    var rows = rowsOf();
    if (how === 'toggle') { var i = S.sel.indexOf(id); if (i >= 0) S.sel.splice(i, 1); else S.sel.push(id); S.anchor = id; }
    else if (how === 'range' && S.anchor) {
      var a = rows.findIndex(function (r) { return r.node.id === S.anchor; }), b = rows.findIndex(function (r) { return r.node.id === id; });
      if (a >= 0 && b >= 0) { var lo = Math.min(a, b), hi = Math.max(a, b); S.sel = []; for (var k = lo; k <= hi; k++) if (S.sel.indexOf(rows[k].node.id) < 0) S.sel.push(rows[k].node.id); }
    } else { S.sel = [id]; S.anchor = id; }
  }
  // Ao clicar, o resto do app acompanha: cena, superfície, clipe
  function follow(n) {
    try {
      if (n.type === 'scene' && n.meta.index !== H.state.scene && H.switchScene) { H.switchScene(n.meta.index); }
      else if (n.type === 'face' && n.meta.surfaceKey && H.selectKey) H.selectKey(n.meta.surfaceKey);
      else if (n.type === 'clip' && root.TimelineUI && root.TimelineUI.api) root.TimelineUI.api.select(n.meta.clipId);
    } catch (e) {}
  }

  // ---------- desenho ----------
  function rowEl(r) {
    var n = r.node, row = el('div', 'hr-row'); row.dataset.id = n.id; row.dataset.path = r.path; row.dataset.type = n.type; if (n.meta.empty) row.dataset.empty = '1';
    row.setAttribute('role', 'treeitem'); row.setAttribute('aria-level', r.depth + 1); row.setAttribute('aria-selected', isSel(n.id) ? 'true' : 'false'); row.tabIndex = -1;
    if (n.children.length) row.setAttribute('aria-expanded', r.open ? 'true' : 'false');
    row.setAttribute('aria-label', TYPE_NAME[n.type] + ' ' + n.name);
    if (isSel(n.id)) row.classList.add('sel'); if (n.type === 'scene' && n.meta.active) row.classList.add('active');
    row.style.paddingLeft = (6 + r.depth * 14) + 'px';
    var ch = el('button', 'hr-chev', n.children.length ? (r.open ? '▾' : '▸') : ''); ch.type = 'button'; ch.tabIndex = -1; ch.dataset.chev = '1'; if (!n.children.length) ch.style.visibility = 'hidden'; row.appendChild(ch);
    row.appendChild(el('span', 'hr-ic', GLYPH[n.type] || '•'));
    if (S.rename && S.rename.path === r.path) {
      var inp = el('input', 'hr-rn'); inp.value = n.name; inp.id = 'hr-rename-input'; inp.setAttribute('aria-label', 'Novo nome'); row.appendChild(inp);
      setTimeout(function () { inp.focus(); inp.select(); }, 0);
      var done = false;
      function commit(ok) { if (done) return; done = true; var v = inp.value; S.rename = null; if (ok && v.trim() && v !== n.name) doRename(n, v); else refresh(true); }
      inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') commit(true); else if (e.key === 'Escape') commit(false); });
      inp.addEventListener('blur', function () { commit(true); });
    } else row.appendChild(el('span', 'hr-name', n.name));
    var meta = [];
    if (n.type === 'cube') meta.push(n.meta.size + '"');
    if (n.type === 'layer') { if (n.meta.locked) meta.push('🔒'); if (n.meta.muted) meta.push('mudo'); if (!n.meta.enabled) meta.push('off'); }
    if (n.type === 'clip') meta.push(n.meta.start.toFixed(1) + 's');
    if (n.type === 'library') meta.push(n.meta.assets + ' mídias');
    if (meta.length) row.appendChild(el('span', 'hr-meta', meta.join(' ')));
    if (canDrag(n)) row.draggable = true;
    return row;
  }
  function canDrag(n) { return n.type === 'cube' || (n.type === 'face' && (n.meta.cubeId || n.meta.surfaceKey)) || (n.type === 'layer' && !n.meta.audio); }
  function sigOf(rows) { return rows.map(function (r) { var n = r.node; return r.path + '|' + n.name + '|' + (r.open ? 1 : 0) + '|' + (n.meta.locked ? 1 : 0) + (n.meta.muted ? 1 : 0) + (n.meta.enabled === false ? 1 : 0); }).join('\n') + '#' + (S.rename ? S.rename.path : '') + '#' + JSON.stringify(HC.stageOf(seq()).cubes.map(function (c) { return [c.size, c.rotY]; })); }
  function refresh(force) {
    if (!sec || !tree) return;
    var t = HC.build(ctx()), rows = HC.flatten(t, HC.collapsedOf(seq()));
    S.tree = t; S.rows = rows;
    var sg = sigOf(rows), ids = {}; rows.forEach(function (r) { ids[r.node.id] = 1; });
    var keep = S.sel.filter(function (i) { return ids[i]; }); if (keep.length !== S.sel.length) { S.sel = keep; S.selSig = null; }
    if (!force && sg === S.sig) { paintSel(); return; }
    S.sig = sg;
    var st = tree.scrollTop, hadFocus = tree.contains(document.activeElement) && !(document.activeElement && document.activeElement.id === 'hr-rename-input');
    tree.textContent = '';
    rows.forEach(function (r) { tree.appendChild(rowEl(r)); });
    tree.scrollTop = st; if (hadFocus && !S.rename) tree.focus();
    S.selSig = null; paintSel();
  }
  // Seleção muda só as classes das linhas (sem refazer o DOM, senão o duplo clique perde o alvo)
  function paintSel() {
    var sg = S.sel.join('|'); if (sg === S.selSig && !S.forceShared) return; S.selSig = sg; S.forceShared = false;
    [].forEach.call(tree.querySelectorAll('.hr-row'), function (r) { var on = S.sel.indexOf(r.dataset.id) >= 0; r.classList.toggle('sel', on); r.setAttribute('aria-selected', on ? 'true' : 'false'); });
    renderShared();
    var cnt = document.getElementById('hr-count'); if (cnt) cnt.textContent = S.sel.length ? S.sel.length + ' selecionado(s)' : 'Nada selecionado';
  }

  // ---------- ações ----------
  function nodeOf(id) { return S.tree ? HC.find(S.tree, id) : null; }
  function startRename() {
    var id = S.sel[0], n = id && nodeOf(id); if (!n) return;
    if (['scene', 'group', 'cube', 'layer'].indexOf(n.type) < 0) { say('Só cenas, grupos, cubos e camadas podem ser renomeados.'); return; }
    var row = tree.querySelector('.hr-row[data-id="' + cssEsc(id) + '"]'); S.rename = { path: row ? row.dataset.path : null }; S.sig = ''; refresh(true);
  }
  function cssEsc(s) { return String(s).replace(/(["\\])/g, '\\$1'); }
  function doRename(n, v) {
    act('rename', function () {
      if (n.type === 'cube') return HC.renameCube(seq(), n.meta.cubeId, v);
      if (n.type === 'group') return HC.renameGroup(seq(), n.meta.groupId, v);
      if (n.type === 'scene') return HC.renameScene(ctx(), n.meta.index, v);
      if (n.type === 'layer') return HC.renameLayer(seq(), n.meta.trackId, v);
      return { ok: false, error: 'Não dá pra renomear isto.' };
    });
  }
  function newCube() { var r = act('newcube', function () { return HC.createCube(seq(), { name: '' }); }); if (r && r.ok) { S.sel = [r.nodeId]; S.anchor = r.nodeId; say('Cubo criado. Ajuste o tamanho nas propriedades abaixo e ligue as faces.'); S.sig = ''; refresh(true); } }
  function selCubes() { return S.sel.map(nodeOf).filter(function (n) { return n && n.type === 'cube'; }); }
  function newGroup() {
    var cubes = selCubes().map(function (n) { return n.meta.cubeId; });
    var r = act('newgroup', function () { return HC.createGroup(seq(), '', cubes); });
    if (r && r.ok) { S.sel = [r.nodeId]; say('Grupo criado' + (cubes.length ? ' com ' + cubes.length + ' cubo(s).' : '. Arraste cubos para dentro dele.')); S.sig = ''; refresh(true); }
  }
  function ungroup() { var cs = selCubes(); if (!cs.length) { say('Selecione cubos para tirar do grupo.'); return; } act('ungroup', function () { cs.forEach(function (n) { HC.setGroup(seq(), n.meta.cubeId, null); }); return { ok: true }; }); }
  function del() {
    var ns = S.sel.map(nodeOf).filter(Boolean); if (!ns.length) { say('Nada selecionado.'); return; }
    var msgs = [];
    act('delete', function () {
      var done = 0;
      ns.forEach(function (n) {
        var r = null;
        if (n.type === 'cube') r = HC.deleteCube(seq(), n.meta.cubeId);
        else if (n.type === 'group') r = HC.deleteGroup(seq(), n.meta.groupId);
        else if (n.type === 'layer') { var t = seq().tracks.filter(function (x) { return x.id === n.meta.trackId; })[0]; if (t && t.locked) r = { ok: false, error: 'Camada travada não é apagada.' }; else r = { ok: Seq.removeTrack(seq(), n.meta.trackId) }; }
        else r = { ok: false, error: 'Use a timeline para apagar clipes.' };
        if (r.ok) done++; else if (r.error) msgs.push(r.error);
        if (r.warnings) msgs = msgs.concat(r.warnings);
      });
      S.sel = [];
      return { ok: true, warnings: msgs.length ? msgs : [done + ' item(ns) apagado(s). Dá pra desfazer com Cmd+Z.'] };
    });
  }
  function bump(dir) {
    var n = S.sel.length === 1 && nodeOf(S.sel[0]); if (!n) { say('Selecione um item.'); return; }
    act('bump', function () {
      var st = HC.stageOf(seq());
      if (n.type === 'cube') { var i = st.cubes.findIndex(function (c) { return c.id === n.meta.cubeId; }); return HC.moveCube(seq(), n.meta.cubeId, i + dir); }
      if (n.type === 'face' && n.meta.cubeId) { var c = IC.cubeById(st, n.meta.cubeId); return HC.reorderFace(seq(), n.meta.cubeId, n.meta.face, c.faceOrder.indexOf(n.meta.face) + dir); }
      if (n.type === 'layer') { var ls = Seq.layersOf(seq(), n.meta.surfaceKey), j = ls.findIndex(function (t) { return t.id === n.meta.trackId; }); return HC.moveLayerTo(seq(), n.meta.trackId, j + dir); }
      return { ok: false, error: 'Este item não tem ordem para mudar.' };
    });
  }
  function setAll(open) {
    var c = HC.collapsedOf(seq());
    if (open) Object.keys(c).forEach(function (k) { delete c[k]; });
    else HC.allIds(S.tree).forEach(function (id) { var n = nodeOf(id); if (n && n.children.length && n.type !== 'library' && n.type !== 'project') c[id] = 1; });
    S.sig = ''; refresh(true);
  }

  // ---------- propriedades compartilhadas ----------
  function renderShared() {
    var box = document.getElementById('hr-shared'); if (!box) return;
    box.textContent = '';
    var sp = HC.sharedProps(ctx(), S.sel);
    if (!sp.count) { box.appendChild(el('p', 'hr-note', 'Selecione cubos, camadas ou clipes (Ctrl/Cmd+clique ou Shift+clique para vários) para editar juntos.')); return; }
    box.appendChild(el('b', null, 'Propriedades compartilhadas · ' + sp.count + ' ' + (sp.kind === 'misto' ? 'itens' : TYPE_NAME[sp.kind === 'cube' ? 'cube' : sp.kind === 'layer' ? 'layer' : 'clip'].toLowerCase() + '(s)')));
    if (sp.note) { box.appendChild(el('p', 'hr-warn', sp.note)); return; }
    sp.props.forEach(function (d) {
      var row = el('div', 'hr-prop'); row.appendChild(el('span', null, d.label));
      if (d.bool) {
        var cb = el('input'); cb.type = 'checkbox'; cb.id = 'hr-p-' + d.p; cb.checked = !!d.value; cb.indeterminate = d.mixed; cb.setAttribute('aria-label', d.label);
        cb.addEventListener('change', function () { apply(d.p, cb.checked); }); row.appendChild(cb); row.appendChild(el('span', 'hr-meta', d.mixed ? 'misto' : ''));
      } else {
        var rg = el('input'); rg.type = 'range'; rg.min = d.min; rg.max = d.max; rg.step = d.step; rg.value = d.mixed ? d.min : d.value; rg.setAttribute('aria-label', d.label); rg.id = 'hr-r-' + d.p;
        var nu = el('input'); nu.type = 'number'; nu.min = d.min; nu.max = d.max; nu.step = d.step; nu.id = 'hr-p-' + d.p; nu.setAttribute('aria-label', d.label + ' valor'); if (d.mixed) { nu.value = ''; nu.placeholder = 'misto'; } else nu.value = Math.round(d.value * 1000) / 1000;
        nu.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') nu.blur(); });
        nu.addEventListener('change', function () { var v = parseFloat(nu.value); if (isFinite(v)) apply(d.p, v); });
        rg.addEventListener('change', function () { apply(d.p, parseFloat(rg.value)); });
        row.appendChild(nu); row.appendChild(rg);
      }
      box.appendChild(row);
    });
  }
  function apply(p, v) {
    var r = act('shared-' + p, function () { return HC.setShared(ctx(), S.sel, p, v); });
    if (r && r.ok) say(r.changed + ' item(ns) alterado(s)' + (r.skipped ? ', ' + r.skipped + ' pulado(s) por estarem em camada travada.' : '.'));
    S.sig = ''; S.forceShared = true; refresh(true);
  }

  // ---------- arrastar e soltar ----------
  function dropOk(src, dst) {
    if (!src || !dst) return false;
    if (src.type === 'cube') return dst.type === 'cube' || dst.type === 'group' || dst.type === 'scene';
    if (src.type === 'face') return dst.type === 'face' && !dst.meta.free && (src.meta.cubeId ? true : !!src.meta.surfaceKey);
    if (src.type === 'layer') return (dst.type === 'face' && dst.meta.surfaceKey) || (dst.type === 'layer' && !dst.meta.audio && dst.meta.surfaceKey);
    return false;
  }
  function doDrop(src, dst) {
    if (src.type === 'cube') {
      var movers = S.sel.indexOf(src.id) >= 0 ? selCubes() : [src];
      act('dropcube', function () {
        var st = HC.stageOf(seq());
        movers.forEach(function (m) {
          if (dst.type === 'group') HC.setGroup(seq(), m.meta.cubeId, dst.meta.groupId);
          else if (dst.type === 'scene') HC.setGroup(seq(), m.meta.cubeId, null);
          else if (dst.type === 'cube' && dst.meta.cubeId !== m.meta.cubeId) {
            var gi = st.groups.filter(function (g) { return g.cubes.indexOf(dst.meta.cubeId) >= 0; })[0]; HC.setGroup(seq(), m.meta.cubeId, gi ? gi.id : null);
            HC.moveCube(seq(), m.meta.cubeId, st.cubes.findIndex(function (c) { return c.id === dst.meta.cubeId; }));
          }
        });
        return { ok: true };
      });
    } else if (src.type === 'face') {
      act('dropface', function () {
        if (src.meta.cubeId) return HC.moveFaceBinding(seq(), { cube: src.meta.cubeId, face: src.meta.face }, { cube: dst.meta.cubeId, face: dst.meta.face });
        return HC.bindFace(seq(), dst.meta.cubeId, dst.meta.face, src.meta.surfaceKey);
      });
    } else if (src.type === 'layer') {
      var movers2 = S.sel.indexOf(src.id) >= 0 ? S.sel.map(nodeOf).filter(function (n) { return n && n.type === 'layer' && !n.meta.audio; }) : [src];
      act('droplayer', function () {
        movers2.forEach(function (m) {
          if (dst.meta.surfaceKey !== m.meta.surfaceKey) HC.moveLayerToSurface(seq(), m.meta.trackId, dst.meta.surfaceKey);
          if (dst.type === 'layer') { var ls = Seq.layersOf(seq(), dst.meta.surfaceKey), j = ls.findIndex(function (t) { return t.id === dst.meta.trackId; }); HC.moveLayerTo(seq(), m.meta.trackId, j); }
        });
        return { ok: true };
      });
    }
  }

  // ---------- eventos ----------
  function rowOf(e) { return e.target.closest ? e.target.closest('.hr-row') : null; }
  function onClick(e) {
    var row = rowOf(e); if (!row || S.rename) return;
    var id = row.dataset.id, n = nodeOf(id);
    if (e.target.dataset && e.target.dataset.chev) { HC.toggle(seq(), id); S.sig = ''; refresh(true); return; }
    select(id, e.shiftKey ? 'range' : (e.metaKey || e.ctrlKey ? 'toggle' : 'one'));
    paintSel();
    if (n && !e.shiftKey && !(e.metaKey || e.ctrlKey)) follow(n);
  }
  function onDbl(e) { var row = rowOf(e); if (!row) return; var n = nodeOf(row.dataset.id); if (!n) return; if (['scene', 'group', 'cube', 'layer'].indexOf(n.type) >= 0) { S.sel = [n.id]; startRename(); } }
  function onKey(e) {
    if (S.rename) return;
    var rows = rowsOf(), cur = S.sel.length ? S.sel[S.sel.length - 1] : null, i = rows.findIndex(function (r) { return r.node.id === cur; });
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); var j = Math.max(0, Math.min(rows.length - 1, (i < 0 ? 0 : i) + (e.key === 'ArrowDown' ? 1 : -1)));
      if (e.shiftKey && S.anchor) select(rows[j].node.id, 'range'); else select(rows[j].node.id, 'one');
      paintSel(); if (!e.shiftKey) follow(rows[j].node);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault(); if (i < 0) return; var r = rows[i], coll = HC.collapsedOf(seq());
      if (e.key === 'ArrowRight' && r.node.children.length && coll[r.node.id]) { HC.toggle(seq(), r.node.id, true); S.sig = ''; refresh(true); }
      else if (e.key === 'ArrowLeft' && r.node.children.length && !coll[r.node.id]) { HC.toggle(seq(), r.node.id, false); S.sig = ''; refresh(true); }
    } else if (e.key === 'F2' || e.key === 'Enter') { e.preventDefault(); startRename(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del(); }
    else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); S.sel = rows.map(function (r) { return r.node.id; }).filter(function (id, k, a) { return a.indexOf(id) === k; }); paintSel(); }
  }
  function build() {
    sec.textContent = '';
    if (!document.getElementById('hr-css')) { var st = el('style'); st.id = 'hr-css'; st.textContent = CSS; document.head.appendChild(st); }
    var w = el('div', 'hr-wrap'); w.appendChild(el('b', null, 'Estrutura do projeto'));
    w.appendChild(el('p', 'hr-note', 'Biblioteca > Projeto > Cena > Grupo > Cubo > Face > Camada > Clipe > Efeito. Arraste faces, camadas e cubos para reorganizar. Duplo clique renomeia. Tudo desfaz com Cmd+Z.'));
    var bar = el('div', 'hr-bar');
    bar.appendChild(btn('+ Cubo', newCube, 'hr-new-cube', 'Cria um cubo no palco')); bar.appendChild(btn('+ Grupo', newGroup, 'hr-new-group', 'Cria um grupo (com os cubos selecionados)'));
    bar.appendChild(btn('Renomear', startRename, 'hr-rename')); bar.appendChild(btn('Apagar', del, 'hr-delete'));
    bar.appendChild(btn('▲', function () { bump(-1); }, 'hr-up', 'Sobe na ordem')); bar.appendChild(btn('▼', function () { bump(1); }, 'hr-down', 'Desce na ordem'));
    bar.appendChild(btn('Sem grupo', ungroup, 'hr-ungroup', 'Tira os cubos selecionados do grupo'));
    bar.appendChild(btn('Expandir tudo', function () { setAll(true); }, 'hr-expand-all')); bar.appendChild(btn('Recolher tudo', function () { setAll(false); }, 'hr-collapse-all'));
    w.appendChild(bar);
    tree = el('div', 'hr-tree'); tree.id = 'hr-tree'; tree.setAttribute('role', 'tree'); tree.setAttribute('aria-label', 'Hierarquia do projeto'); tree.tabIndex = 0;
    tree.addEventListener('click', onClick); tree.addEventListener('dblclick', onDbl); tree.addEventListener('keydown', onKey);
    tree.addEventListener('dragstart', function (e) { var row = rowOf(e); if (!row) return; var n = nodeOf(row.dataset.id); if (!n || !canDrag(n)) { e.preventDefault(); return; } S.drag = n; try { e.dataTransfer.setData('text/plain', n.id); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} });
    tree.addEventListener('dragover', function (e) { var row = rowOf(e); if (!row || !S.drag) return; var dst = nodeOf(row.dataset.id); if (dropOk(S.drag, dst)) { e.preventDefault(); tree.querySelectorAll('.drop').forEach(function (x) { x.classList.remove('drop'); }); row.classList.add('drop'); } });
    tree.addEventListener('dragleave', function (e) { var row = rowOf(e); if (row) row.classList.remove('drop'); });
    tree.addEventListener('drop', function (e) { var row = rowOf(e); tree.querySelectorAll('.drop').forEach(function (x) { x.classList.remove('drop'); }); if (!row || !S.drag) return; e.preventDefault(); var dst = nodeOf(row.dataset.id), src = S.drag; S.drag = null; if (dropOk(src, dst)) doDrop(src, dst); });
    tree.addEventListener('dragend', function () { S.drag = null; tree.querySelectorAll('.drop').forEach(function (x) { x.classList.remove('drop'); }); });
    w.appendChild(tree);
    var cnt = el('p', 'hr-note'); cnt.id = 'hr-count'; w.appendChild(cnt);
    var sh = el('div', 'hr-box'); sh.id = 'hr-shared'; w.appendChild(sh);
    var m = el('p', 'hr-note'); m.id = 'hr-msg'; m.setAttribute('role', 'status'); w.appendChild(m);
    sec.appendChild(w);
  }
  function init(host) {
    H = host; sec = document.getElementById('hr-panel'); if (!sec || !HC) return;
    build(); refresh(true);
    setInterval(function () { if (sec.offsetParent && !S.rename && !S.drag) { try { refresh(); } catch (e) {} } }, 400);
  }
  root.HierarchyUI = { init: init, refresh: refresh, state: S, select: select };
})(typeof window !== 'undefined' ? window : globalThis);
