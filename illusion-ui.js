// LenziMap 3.2: painel "3D" (3D Illusion Creator). Só desenha a interface e chama o núcleo (illusion-core.js),
// o motor (illusion-gl.js) e a ponte da timeline (illusion-timeline.js). A geometria física dos cubos mora em seq.stage,
// separada de surface.q: calibrar o projetor nunca muda a geometria do palco e o contrário também vale.
(function (root) {
  'use strict';
  var C = root.IllusionCore, G = root.IllusionGL, T = root.IllusionTimeline, Seq = root.Sequence;
  var H = null, sec = null;
  var PRESETS_KEY = 'lenzi-illusion-presets';
  var S = { il: null, assetId: null, view: 'audience', orbit: { yaw: 30, pitch: 22, dist: 90 }, playing: true, t0: 0, tFree: 0, dur: 8, quick: true, msg: '', cv: null, raf: 0, lastSel: null, open: { ilusao: true, alvo: true, prof: true, sala: true, facil: true, vista: true, prof2: true }, adv: false };
  try { S.adv = localStorage.getItem('lenzi-il-adv') === '1'; } catch (e) {}

  var CSS = '.il-wrap{display:flex;flex-direction:column;gap:10px}.il-wrap h2{margin:0}.il-box{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:8px;display:flex;flex-direction:column;gap:8px}' +
    '.il-box>summary{cursor:pointer;font-weight:600;font-size:13px}.il-cards{display:grid;grid-template-columns:1fr 1fr;gap:6px}.il-card{font:inherit;text-align:left;border:1px solid var(--line);background:var(--panel-2);color:var(--fg);border-radius:8px;padding:8px;cursor:pointer;display:flex;flex-direction:column;gap:2px}' +
    '.il-card b{font-size:13px}.il-card span{font-size:11px;color:var(--muted)}.il-card.on{border-color:var(--accent)}.il-card.first{grid-column:1/3}' +
    '.il-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.il-row label{display:flex;gap:4px;align-items:center;font-size:12px}.il-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}' +
    '.il-grid3 input,.il-box input[type=number],.il-box input[type=text],.il-box select{font:inherit;color:var(--fg);background:var(--panel-2);border:1px solid var(--line);border-radius:6px;padding:5px 6px;width:100%;min-width:0}' +
    '.il-sl{display:grid;grid-template-columns:1fr 64px auto;gap:6px;align-items:center;font-size:12px}.il-sl>span{grid-column:1/4;color:var(--muted)}.il-sl input[type=range]{width:100%}' +
    '.il-cv{width:100%;height:auto;aspect-ratio:8/5;background:#05070a;border:1px solid var(--line);border-radius:6px;display:block;touch-action:none}.il-note{font-size:12px;color:var(--muted);margin:0}.il-warn{font-size:12px;color:#ffcf6b;margin:0}' +
    '.il-kf{font:inherit;border:1px solid var(--line);background:var(--panel-2);color:var(--fg);border-radius:6px;padding:2px 6px;cursor:pointer;font-size:12px}.il-kf.has{color:#ffd23d}.il-ok{color:#9ff0c4}';

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(txt, fn, cls, id) { var b = el('button', 'btn small' + (cls ? ' ' + cls : ''), txt); b.type = 'button'; if (id) b.id = id; b.addEventListener('click', fn); return b; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function seq() { return H.tl.seq; }
  function stage() { return seq().stage || C.defaultStage(); }
  function fixed(v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toString(); }
  function box(id, title) {
    var d = el('details', 'il-box'); d.dataset.sec = id; if (S.open[id] === undefined ? false : S.open[id]) d.open = true;
    d.appendChild(el('summary', null, title)); d.addEventListener('toggle', function () { S.open[id] = d.open; }); return d;
  }

  // ---------- estado ----------
  function newIllusion(preset) {
    var cur = S.il, il = C.defaultIllusion(preset);
    if (cur) { il.target = clone(cur.target); il.style.color1 = cur.style.color1; il.style.color2 = cur.style.color2; il.quality = cur.quality; il.camera = clone(cur.camera); }
    S.il = il; S.assetId = null; S.msg = 'Nova ilusão: ' + il.name + '. Ligue as faces às superfícies e aperte Aplicar na Timeline.';
  }
  function hostObj() {
    return { seq: seq, checkpoint: H.checkpoint, push: H.push, syncClock: H.syncClock, renderAll: H.renderAll, setOn: H.setOn, now: function () { return H.tl.clock.now(); }, surfaces: function () { return H.surfaces().map(function (x) { return x.s; }); } };
  }
  function syncOut() { try { H.rend.sync(H.view()); } catch (e) {} H.push(); }
  // Mudança na ilusão de trabalho: se já está na timeline, vai junto (com Desfazer); senão só a prévia muda.
  function changed(key, structural) {
    if (S.assetId) {
      var cur = T.illusionOf(seq(), S.assetId);
      if (!cur) { S.assetId = null; }
      else { H.checkpoint(key || 'il-edit'); var r = T.update(seq(), S.assetId, S.il); if (r.ok) S.il = clone(r.value); H.syncClock(); syncOut(); }
    }
    if (structural) render();
  }
  function editStage(fn, key) {
    H.checkpoint(key || 'il-stage');
    T.ensureStage(seq()); fn(seq().stage); seq().stage = C.fixStage(seq().stage);
    syncOut(); render();
  }

  // ---------- peças de interface ----------
  function slider(host, label, get, set, min, max, step, opts) {
    opts = opts || {};
    var w = el('div', 'il-sl'), lab = el('span', null, label), r = el('input'), n = el('input');
    r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = get(); n.type = 'number'; n.min = min; n.max = max; n.step = step; n.value = fixed(get(), 2);
    r.setAttribute('aria-label', label); n.setAttribute('aria-label', label + ' valor');
    w.appendChild(lab); w.appendChild(r); w.appendChild(n);
    function put(v) { v = Math.max(min, Math.min(max, v)); if (!isFinite(v)) return; set(v); r.value = v; n.value = fixed(v, 2); }
    r.addEventListener('input', function () { put(+r.value); });
    n.addEventListener('change', function () { put(parseFloat(n.value)); });
    n.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') n.blur(); });
    if (opts.kf) {
      var k = el('button', 'il-kf', '◆'); k.type = 'button'; k.title = 'Criar keyframe deste parâmetro no playhead (em todos os clipes da ilusão)';
      k.addEventListener('click', function () {
        if (!S.assetId) { S.msg = 'Aplique a ilusão na timeline primeiro. Depois cada parâmetro com ◆ pode receber keyframes.'; render(); return; }
        H.checkpoint('il-key'); var cnt = T.keyAt(seq(), S.assetId, opts.kf, H.tl.clock.now(), +r.value, 'ease');
        H.syncClock(); syncOut(); H.renderAll(); S.msg = cnt ? 'Keyframe criado em ' + cnt + ' clipe(s). Edite na aba Timeline, botão Keyframes.' : 'O playhead está fora dos clipes da ilusão.'; render();
      });
      var has = false; if (S.assetId) T.clipsOfAsset(seq(), S.assetId).forEach(function (x) { if (x.clip.keyframes['ill.' + opts.kf] && x.clip.keyframes['ill.' + opts.kf].length) has = true; });
      if (has) k.classList.add('has');
      w.appendChild(k);
    } else w.appendChild(el('span'));
    host.appendChild(w); return w;
  }
  function selectRow(label, opts, get, set, id) {
    var l = el('label', 'field'), s = el('select'); l.appendChild(el('span', null, label)); if (id) s.id = id;
    opts.forEach(function (o) { var x = el('option', null, o[1]); x.value = o[0]; s.appendChild(x); });
    s.value = get(); s.addEventListener('change', function () { set(s.value); }); l.appendChild(s); return l;
  }
  function colorRow(label, get, set, id) {
    var l = el('label', 'il-row'), i = el('input'); i.type = 'color'; i.value = get(); if (id) i.id = id; i.setAttribute('aria-label', label);
    i.addEventListener('input', function () { set(i.value); }); l.appendChild(i); l.appendChild(document.createTextNode(' ' + label)); return l;
  }

  // ---------- seções ----------
  function secIllusion() {
    var b = box('ilusao', 'Nova ilusão e tipo');
    var cards = el('div', 'il-cards');
    ['room-builder'].concat(C.PRESET_ORDER.filter(function (x) { return x !== 'room-builder'; })).forEach(function (p, i) {
      var d = C.PRESETS[p], c = el('button', 'il-card' + (i === 0 ? ' first' : '') + (S.il.preset === p ? ' on' : '')); c.type = 'button'; c.dataset.preset = p;
      c.appendChild(el('b', null, d.name + (i === 0 ? '  (monte do seu jeito)' : ''))); c.appendChild(el('span', null, d.desc));
      c.addEventListener('click', function () { if (S.assetId) { S.assetId = null; } newIllusion(p); render(); });
      cards.appendChild(c);
    });
    b.appendChild(cards);
    var nm = el('input'); nm.type = 'text'; nm.id = 'il-name'; nm.value = S.il.name; nm.maxLength = 60; nm.setAttribute('aria-label', 'Nome da ilusão');
    nm.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') nm.blur(); });
    nm.addEventListener('change', function () { S.il.name = nm.value.trim() || C.PRESETS[S.il.preset].name; changed('il-name'); });
    var l = el('label', 'field'); l.appendChild(el('span', null, 'Nome')); l.appendChild(nm); b.appendChild(l);
    return b;
  }
  function surfaceOptions() {
    var o = [['', '(sem superfície)']];
    H.surfaces().forEach(function (x) { if (x.s.key) o.push([x.s.key, x.s.name + (x.scene !== H.state.scene ? ' · ' + x.sceneName : '')]); });
    return o;
  }
  function bindSurface(cubeId, face, key) {
    editStage(function (stg) {
      if (key) stg.cubes.forEach(function (c2) { C.FACES.forEach(function (g) { if (c2.faces[g] === key) c2.faces[g] = null; }); });
      C.cubeById(stg, cubeId).faces[face] = key || null;
    }, 'il-bind');
  }
  function surfName(key) { var r = ''; H.surfaces().forEach(function (x) { if (x.s.key === key) r = x.s.name; }); return r; }
  // avisos que explicam por que uma face sairia errada ou vazia
  function faceWarnings(b, st) {
    var seenK = {}, dupK = {};
    st.cubes.forEach(function (c3) { C.FACES.forEach(function (g) { var k3 = c3.faces[g]; if (!k3) return; if (seenK[k3]) dupK[k3] = (dupK[k3] || [seenK[k3]]).concat([c3.name + ' ' + C.FACE_LABEL[g]]); else seenK[k3] = c3.name + ' ' + C.FACE_LABEL[g]; }); });
    Object.keys(dupK).forEach(function (k3) { b.appendChild(el('p', 'il-warn', 'A mesma superfície está ligada a mais de uma face (' + dupK[k3].join(' e ') + '). Escolha outra superfície para uma delas, senão as duas desenham no mesmo lugar.')); });
    var hid = [];
    S.il.target.faces.forEach(function (g) { try { var rr = C.resolveFace(st, S.il, null, null, 0, { cube: S.il.target.cube, face: g }); if (!rr.cam) hid.push(C.FACE_LABEL[g]); } catch (e) {} });
    if (hid.length) b.appendChild(el('p', 'il-warn', 'Do ponto de vista do público não dá para ver a face: ' + hid.join(', ') + '. Ela fica vazia. Mude o Olho X, Y ou Z do público (opções avançadas, Câmera) ou gire o cubo.'));
  }
  // ---------- modo fácil: 1) escolher a face  2) empurrar o fundo  3) paredes ----------
  function selectFace(cubeId, f) {
    var st = stage(), cube = C.cubeById(st, cubeId) || st.cubes[0];
    S.il.target.cube = cube.id; S.il.target.faces = [f];
    if (!cube.faces[f]) {
      var used = {}; st.cubes.forEach(function (c) { C.FACES.forEach(function (g) { if (c.faces[g]) used[c.faces[g]] = 1; }); });
      var free = H.surfaces().map(function (z) { return z.s.key; }).filter(function (kk) { return kk && !used[kk]; });
      if (free.length) { S.msg = 'Liguei a ' + surfName(free[0]) + ' na face ' + C.FACE_LABEL[f] + '.'; bindSurface(cube.id, f, free[0]); return; }
      S.msg = 'Não tem tela livre. Crie uma superfície nova (botão de nova caixa) e escolha de novo.';
    } else S.msg = 'Face ' + C.FACE_LABEL[f] + ' escolhida.';
    changed('il-faces', true);
  }
  // Por cima do cubo 3D: nome da tela em cada face, face escolhida em rosa, face sob o mouse com contorno
  function overlayFaces() {
    var ctx = S.cv.getContext('2d'), fs = G.stageFaces ? G.stageFaces() : [], st = stage();
    ctx.save(); ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    fs.forEach(function (f) {
      if (!f.visible) return;
      var cube = C.cubeById(st, f.cube); if (!cube) return;
      var isT = f.cube === S.il.target.cube && S.il.target.faces.indexOf(f.face) >= 0, isH = S.hover && S.hover.cube === f.cube && S.hover.face === f.face;
      ctx.beginPath(); f.poly.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath();
      if (isT) { ctx.fillStyle = 'rgba(255,79,163,.30)'; ctx.fill(); }
      if (isT || isH) { ctx.lineWidth = isT ? 3 : 2; ctx.strokeStyle = isT ? '#ff4fa3' : '#ffffff'; ctx.stroke(); }
      if (f.cube === S.il.target.cube || isH) {
        var cx = 0, cy = 0; f.poly.forEach(function (q) { cx += q[0] / 4; cy += q[1] / 4; });
        var k = cube.faces[f.face], txt = C.FACE_LABEL[f.face] + ' · ' + (k ? (surfName(k) || 'tela') : 'sem tela');
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(txt, cx, cy); ctx.fillStyle = k ? '#fff' : '#ffd36b'; ctx.fillText(txt, cx, cy);
      }
    });
    ctx.restore();
  }
  // ---------- ponto de vista do público por ângulo (quina, frente) ----------
  function viewerPolar(cube) {
    var v = stage().viewer.pos, dx = v[0] - cube.pos[0], dz = v[2] - cube.pos[2], yaw = Math.atan2(dx, dz) * 180 / Math.PI - (cube.rotY || 0);
    yaw = ((yaw % 360) + 540) % 360 - 180;
    return { yaw: yaw, dist: Math.sqrt(dx * dx + dz * dz), h: v[1] };
  }
  function viewerFromPolar(cube, yaw, dist, h) { var a = ((cube.rotY || 0) + yaw) * Math.PI / 180; return [cube.pos[0] + Math.sin(a) * dist, h, cube.pos[2] + Math.cos(a) * dist]; }
  function freeSurfaceKey() {
    var used = {}; stage().cubes.forEach(function (c) { C.FACES.forEach(function (g) { if (c.faces[g]) used[c.faces[g]] = 1; }); });
    var free = H.surfaces().map(function (z) { return z.s.key; }).filter(function (kk) { return kk && !used[kk]; });
    return free[0] || null;
  }
  // Projetor apontado para a quina: as duas faces da quina usam o mesmo ponto de vista, a 45 graus
  function setCorner(side) {
    var cube = C.cubeById(stage(), S.il.target.cube) || stage().cubes[0], fs = side === 'right' ? ['front', 'right'] : ['left', 'front'], miss = [];
    S.il.target.cube = cube.id; S.il.target.faces = fs.slice();
    fs.forEach(function (f) { var c2 = C.cubeById(stage(), cube.id); if (!c2.faces[f]) { var k = freeSurfaceKey(); if (k) bindSurface(cube.id, f, k); else miss.push(C.FACE_LABEL[f]); } });
    var pv = viewerPolar(cube), p2 = viewerFromPolar(cube, side === 'right' ? 45 : -45, Math.max(60, pv.dist), pv.h);
    editStage(function (s2) { s2.viewer.pos = p2; }, 'il-view');
    S.msg = 'Quina ' + (side === 'right' ? 'direita' : 'esquerda') + ': faces ' + fs.map(function (f) { return C.FACE_LABEL[f]; }).join(' e ') + ', público a 45 graus.' + (miss.length ? ' Falta tela livre para: ' + miss.join(', ') + '.' : '');
    changed('il-faces', true);
  }
  function secEasyView() {
    var b = box('vista', '2. De onde o público vê (perspectiva)'), st = stage(), cube = C.cubeById(st, S.il.target.cube) || st.cubes[0];
    b.appendChild(el('p', 'il-note', 'A animação é desenhada para um ponto de vista só. Se o projetor aponta para a quina do cubo, use uma das quinas: as duas faces ficam na mesma perspectiva e a animação continua de uma face para a outra.'));
    var row = el('div', 'il-row'); row.style.flexWrap = 'wrap';
    row.appendChild(btn('De frente', function () { var pv = viewerPolar(cube); S.il.target.faces = ['front']; editStage(function (s2) { s2.viewer.pos = viewerFromPolar(C.cubeById(s2, cube.id), 0, Math.max(60, pv.dist), pv.h); }, 'il-view'); changed('il-faces', true); }, null, 'il-vw-front'));
    row.appendChild(btn('Quina direita (Frente + Direita)', function () { setCorner('right'); }, null, 'il-vw-cr'));
    row.appendChild(btn('Quina esquerda (Esquerda + Frente)', function () { setCorner('left'); }, null, 'il-vw-cl'));
    b.appendChild(row);
    function setV(yaw, dist, h) { H.checkpoint('il-view'); T.ensureStage(seq()); seq().stage.viewer.pos = viewerFromPolar(C.cubeById(seq().stage, cube.id) || cube, yaw, dist, h); seq().stage = C.fixStage(seq().stage); syncOut(); }
    slider(b, 'Ângulo do público (graus: 0 = de frente, 45 = quina direita, -45 = quina esquerda)', function () { return Math.round(viewerPolar(cube).yaw); }, function (v) { var pv = viewerPolar(cube); setV(v, pv.dist, pv.h); }, -85, 85, 1);
    slider(b, 'Distância do público (pol, mais perto = perspectiva mais forte)', function () { return Math.round(viewerPolar(cube).dist); }, function (v) { var pv = viewerPolar(cube); setV(pv.yaw, v, pv.h); }, 30, 400, 1);
    slider(b, 'Altura do olho (pol)', function () { return Math.round(viewerPolar(cube).h); }, function (v) { var pv = viewerPolar(cube); setV(pv.yaw, pv.dist, v); }, 0, 200, 1);
    return b;
  }
  function secEasy() {
    var b = box('facil', '1. Escolha a face (clique nela no cubo 3D acima)'), st = stage();
    b.appendChild(selectRow('Cubo', st.cubes.map(function (c) { return [c.id, c.name + ' (' + c.size + ' pol)']; }), function () { return S.il.target.cube; }, function (v) { S.il.target.cube = v; changed('il-target', true); }, 'il-cube'));
    var cube = C.cubeById(st, S.il.target.cube) || st.cubes[0], cur = S.il.target.faces[0] || 'front', row = el('div', 'il-row'); row.style.flexWrap = 'wrap';
    C.FACES.forEach(function (f) {
      var k = cube.faces[f], x = btn(C.FACE_LABEL[f] + (k ? '' : ' (sem tela)'), function () {
        selectFace(cube.id, f);
      }, S.il.target.faces.indexOf(f) >= 0 ? 'on' : '', 'il-pick-' + f);
      x.setAttribute('aria-pressed', S.il.target.faces.indexOf(f) >= 0 ? 'true' : 'false'); row.appendChild(x);
    });
    b.appendChild(row);
    b.appendChild(selectRow('Tela (superfície) desta face', surfaceOptions(), function () { return cube.faces[cur] || ''; }, function (v) { bindSurface(cube.id, cur, v); }, 'il-bind-' + cur));
    faceWarnings(b, st);
    return b;
  }
  function secEasyDepth() {
    var b = box('prof2', '3. Empurre o fundo'), P = C.PARAMS.depth;
    b.appendChild(el('p', 'il-note', 'Quanto maior, mais longe fica a parede do fundo. Você também pode arrastar o fundo na vista de cima, abaixo.'));
    slider(b, 'Distância do fundo (pol)', function () { return S.il.params.depth; }, function (v) { S.il.params.depth = v; changed('il-p:depth'); drawRoomCv(); }, P.min, P.max, P.step, { kf: 'depth' });
    return b;
  }
  function secTarget() {
    var b = box('alvo', 'Alvo: cubo, faces e superfícies'), st = stage();
    b.appendChild(selectRow('Cubo alvo', st.cubes.map(function (c) { return [c.id, c.name + ' (' + c.size + ' pol)']; }), function () { return S.il.target.cube; }, function (v) { S.il.target.cube = v; changed('il-target', true); }, 'il-cube'));
    var cube = C.cubeById(st, S.il.target.cube) || st.cubes[0], opts = surfaceOptions();
    C.FACES.forEach(function (f) {
      var r = el('div', 'il-row'), cb = el('input'); cb.type = 'checkbox'; cb.id = 'il-face-' + f; cb.checked = S.il.target.faces.indexOf(f) >= 0; cb.setAttribute('aria-label', 'Usar a face ' + C.FACE_LABEL[f]);
      cb.addEventListener('change', function () {
        var fs = S.il.target.faces.filter(function (x) { return x !== f; }); if (cb.checked) fs.push(f); S.il.target.faces = fs.length ? fs : ['front']; changed('il-faces', true);
      });
      var lb = el('label', null); lb.appendChild(cb); lb.appendChild(document.createTextNode(' ' + C.FACE_LABEL[f])); lb.style.minWidth = '74px'; r.appendChild(lb);
      var s = el('select'); s.id = 'il-bind-' + f; s.setAttribute('aria-label', 'Superfície da face ' + C.FACE_LABEL[f]); s.style.flex = '1';
      opts.forEach(function (o) { var x = el('option', null, o[1]); x.value = o[0]; s.appendChild(x); });
      s.value = cube.faces[f] || '';
      s.addEventListener('change', function () { bindSurface(cube.id, f, s.value); });
      r.appendChild(s); b.appendChild(r);
    });
    var r2 = el('div', 'il-row');
    r2.appendChild(btn('Ligar superfícies na ordem', function () {
      var keys = H.surfaces().map(function (x) { return x.s.key; }).filter(Boolean), used = {};
      editStage(function (stg) {
        stg.cubes.forEach(function (c) { C.FACES.forEach(function (f) { if (c.faces[f]) used[c.faces[f]] = 1; }); });
        var c = C.cubeById(stg, S.il.target.cube) || stg.cubes[0], order = ['front', 'left', 'right', 'top', 'back'], free = keys.filter(function (k) { return !used[k]; });
        order.forEach(function (f) { if (!c.faces[f] && free.length) c.faces[f] = free.shift(); });
      }, 'il-bind');
    }, null, 'il-autobind'));
    b.appendChild(r2);
    b.appendChild(el('p', 'il-note', 'Cada face do cubo físico vira uma janela pro mundo virtual e é projetada na superfície que você ligou. A calibração da superfície (cantos, máscara, malha) não muda.'));
    var tk = T.targetKeys(st, S.il);
    faceWarnings(b, st);
    if (tk.missing.length) b.appendChild(el('p', 'il-warn', 'Faces marcadas sem superfície ligada: ' + tk.missing.map(function (f) { return C.FACE_LABEL[f]; }).join(', ') + '. Elas ficam de fora até você ligar.'));
    return b;
  }
  function secGeometry() {
    var b = box('geo', 'Geometria física do palco'), st = stage();
    b.appendChild(el('p', 'il-note', 'Medidas em polegadas. Posição do centro do cubo: X direita, Y pra cima, Z em direção ao público.'));
    st.cubes.forEach(function (cube, ci) {
      var g = el('div', 'il-box'); g.appendChild(el('b', null, cube.name));
      var row = el('div', 'il-grid3');
      [['Tamanho', 'size', function () { return cube.size; }, function (v) { C.cubeById(seq().stage, cube.id).size = v; }], ['Giro Y (°)', 'rotY', function () { return cube.rotY; }, function (v) { C.cubeById(seq().stage, cube.id).rotY = v; }]].forEach(function (f) { row.appendChild(numField(f[0], f[2](), function (v) { editStage(function () { f[3](v); }, 'il-geo'); }, 'il-c' + ci + '-' + f[1])); });
      ['X', 'Y', 'Z'].forEach(function (ax, i) { row.appendChild(numField('Pos ' + ax, cube.pos[i], function (v) { editStage(function (s2) { C.cubeById(s2, cube.id).pos[i] = v; }, 'il-geo'); }, 'il-c' + ci + '-p' + ax.toLowerCase())); });
      g.appendChild(row); b.appendChild(g);
    });
    var vb = el('div', 'il-box'); vb.appendChild(el('b', null, 'Ponto de vista do público'));
    var vr = el('div', 'il-grid3'); ['X', 'Y', 'Z'].forEach(function (ax, i) { vr.appendChild(numField('Olho ' + ax, st.viewer.pos[i], function (v) { editStage(function (s2) { s2.viewer.pos[i] = v; }, 'il-view'); }, 'il-v' + ax.toLowerCase())); });
    vb.appendChild(vr); b.appendChild(vb);
    // Assistente: medidas com trena -> posição do olho (usa o cubo alvo da ilusão)
    var wz = el('details', 'il-box'); wz.id = 'il-wizard'; wz.open = !!S.open.wiz; wz.addEventListener('toggle', function () { S.open.wiz = wz.open; });
    wz.appendChild(el('summary', null, 'Assistente do espectador (medir com trena)'));
    var tc = C.cubeById(st, S.il.target.cube) || st.cubes[0], cur = C.measuresFromViewer(tc, st.viewer.pos), W = S.wiz || (S.wiz = {}); 
    if (W.cube !== tc.id) { W.cube = tc.id; W.dist = Math.round(cur.dist * 2) / 2; W.height = Math.round(cur.height * 2) / 2; W.lateral = Math.round(cur.lateral * 2) / 2; }
    var ol = el('ol', 'il-note'); ['Fique de pé no lugar onde o público vai olhar (o ponto "bom" da ilusão). Marque esse ponto no chão com fita.',
      'Distância: meça com a trena, no chão, da fita até o PLANO da face frontal do ' + tc.name + ' (não até o centro do cubo).',
      'Altura: meça do chão até o seu olho (em pé, perto de 60 pol; sentado, perto de 45 pol).',
      'Lado: se a fita não está na frente do centro do cubo, meça quantas polegadas à direita (+) ou à esquerda (-) do centro ela está.',
      'Digite abaixo em polegadas (1 pol = 2,54 cm) e aplique. Depois confira a vista "Plateia" e ajuste fino no projetor.'].forEach(function (t) { ol.appendChild(el('li', null, t)); });
    wz.appendChild(ol);
    var wr = el('div', 'il-grid3');
    [['Distância (pol)', 'dist', 'il-wz-dist'], ['Altura do olho (pol)', 'height', 'il-wz-height'], ['Lado (pol, + direita)', 'lateral', 'il-wz-lateral']].forEach(function (f) { wr.appendChild(numField(f[0], W[f[1]], function (v) { W[f[1]] = v; render(); }, f[2])); });
    wz.appendChild(wr);
    var pos = C.viewerFromMeasures(tc, W);
    wz.appendChild(el('p', 'il-note', 'Olho resultante: X ' + fixed(pos[0], 1) + ', Y ' + fixed(pos[1], 1) + ', Z ' + fixed(pos[2], 1) + ' pol.'));
    C.viewerAdvice(tc, W).forEach(function (t) { var w = el('p', 'il-warn', t); w.className = 'il-warn il-wz-advice'; wz.appendChild(w); });
    wz.appendChild(btn('Aplicar ao ponto de vista', function () { var p2 = C.viewerFromMeasures(tc, W); editStage(function (s2) { s2.viewer.pos = p2; }, 'il-view'); S.msg = 'Ponto de vista atualizado pelas medidas.'; }, 'primary', 'il-wz-apply'));
    wz.appendChild(el('p', 'il-note', 'Isto só muda onde o "olho" virtual está. A calibração das superfícies (cantos, máscara, malha) não é tocada. Guia completo: GUIA_CALIBRACAO_ESPECTADOR.md.'));
    vb.appendChild(wz);
    var pb = el('div', 'il-box'); pb.appendChild(el('b', null, 'Projetor (só referência)'));
    var pr = el('div', 'il-grid3'); ['X', 'Y', 'Z'].forEach(function (ax, i) { pr.appendChild(numField('Proj ' + ax, st.projector.pos[i], function (v) { editStage(function (s2) { s2.projector.pos[i] = v; }, 'il-proj'); }, 'il-p' + ax.toLowerCase())); });
    pb.appendChild(pr); b.appendChild(pb);
    b.appendChild(btn('Restaurar cubos padrão (A 16, B C D 8)', function () { editStage(function (s2) { var d = C.defaultStage(); d.cubes.forEach(function (dc) { var cc = C.cubeById(s2, dc.id); if (cc) { cc.size = dc.size; cc.pos = dc.pos.slice(); cc.rotY = 0; } }); }, 'il-geo'); }, null, 'il-geo-reset'));
    return b;
  }
  function numField(label, v, set, id) {
    var l = el('label', 'field'), i = el('input'); l.appendChild(el('span', null, label)); i.type = 'number'; i.step = 0.5; i.value = fixed(v, 2); if (id) i.id = id; i.setAttribute('aria-label', label);
    i.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') i.blur(); });
    i.addEventListener('change', function () { var x = parseFloat(i.value); if (isFinite(x)) set(x); });
    l.appendChild(i); return l;
  }

  // ---------- Sala: montar paredes e objetos (preset room-builder) ----------
  var IMG_RE = /\.(gif|png|jpe?g|webp|apng|bmp)$/i;
  function projectImages() {
    var out = [];
    try { (seq().assets || []).forEach(function (a) { if (a && a.kind === 'img' && a.path && IMG_RE.test(a.path) && !a.test) out.push({ path: a.path, src: a.src || (H.toUrl ? H.toUrl(a.path) : ''), name: a.name || (H.baseName ? H.baseName(a.path) : a.path) }); }); } catch (e) {}
    return out;
  }
  function pickImage(cb) {
    var api = root.api;
    if (api && typeof api.openMedia === 'function') {
      Promise.resolve(api.openMedia()).then(function (paths) {
        if (!paths || !paths.length) return;
        var p = paths.filter(function (x) { return IMG_RE.test(x); })[0];
        if (!p) { S.msg = 'No 3D, por enquanto, só funciona GIF ou imagem (PNG, JPG, WEBP). Vídeo ainda não.'; render(); return; }
        cb({ path: p, src: H.toUrl ? H.toUrl(p) : '', name: H.baseName ? H.baseName(p) : p });
      });
    } else {
      var inp = el('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.addEventListener('change', function () { var f = inp.files && inp.files[0]; if (f) cb({ src: URL.createObjectURL(f), name: f.name }); });
      inp.click();
    }
  }
  function mediaPicker(cur, onSet, idBase) {
    var sel = el('select'); sel.id = idBase; sel.setAttribute('aria-label', 'Imagem ou GIF'); sel.style.flex = '1';
    var imgs = projectImages(), o = el('option', null, '(sem imagem)'); o.value = ''; sel.appendChild(o);
    imgs.forEach(function (m, i) { var x = el('option', null, m.name); x.value = 'p' + i; sel.appendChild(x); });
    var f = el('option', null, 'Escolher arquivo…'); f.value = 'file'; sel.appendChild(f);
    var found = -1; if (cur) imgs.forEach(function (m, i) { if ((m.path && m.path === cur.path) || (!m.path && m.src === cur.src)) found = i; });
    if (cur && found < 0) { var c = el('option', null, cur.name || 'imagem'); c.value = 'cur'; sel.appendChild(c); sel.value = 'cur'; } else sel.value = found >= 0 ? 'p' + found : '';
    sel.addEventListener('change', function () {
      if (sel.value === '') onSet(null);
      else if (sel.value === 'file') pickImage(function (m) { onSet(m); });
      else if (sel.value === 'cur') return;
      else onSet(imgs[+sel.value.slice(1)]);
    });
    return sel;
  }
  function roomView() { return S.roomView || 'top'; }
  function secRoom() {
    var b = box('sala', S.adv ? 'Montar a sala: paredes, fundo e objetos' : '4. Paredes e objetos');
    var R = S.il.room, st = stage(), cube = C.cubeById(st, S.il.target.cube) || st.cubes[0], h = cube.size / 2;
    b.appendChild(el('p', 'il-note', 'Marque as paredes que quer. Cada uma pode ter cor e uma imagem ou GIF. Na vista abaixo, arraste as paredes para mudar o tamanho da sala.'));
    C.ROOM_WALLS.forEach(function (k) {
      var w = R.walls[k], row = el('div', 'il-row'); row.dataset.wall = k;
      var cb = el('input'); cb.type = 'checkbox'; cb.checked = w.on; cb.id = 'il-wall-' + k; cb.setAttribute('aria-label', C.WALL_LABEL[k]);
      cb.addEventListener('change', function () { w.on = cb.checked; changed('il-room', true); });
      var lb = el('label'); lb.appendChild(cb); lb.appendChild(document.createTextNode(' ' + C.WALL_LABEL[k])); lb.style.minWidth = '112px'; row.appendChild(lb);
      var col = el('input'); col.type = 'color'; col.value = w.color; col.id = 'il-wallc-' + k; col.title = 'Cor da parede'; col.setAttribute('aria-label', 'Cor: ' + C.WALL_LABEL[k]);
      col.addEventListener('input', function () { w.color = col.value; changed('il-room-c'); });
      row.appendChild(col);
      row.appendChild(mediaPicker(w.media, function (m) { w.media = m; changed('il-room', true); }, 'il-wallm-' + k));
      b.appendChild(row);
    });
    // vista de edição
    var vr = el('div', 'il-row');
    [['top', 'Vista de cima'], ['side', 'Vista de lado']].forEach(function (v) { vr.appendChild(btn(v[1], function () { S.roomView = v[0]; render(); }, roomView() === v[0] ? 'on' : '', 'il-rv-' + v[0])); });
    b.appendChild(vr);
    var cv = el('canvas', 'il-cv il-rcv'); cv.id = 'il-room-cv'; cv.width = 560; cv.height = 360; cv.style.cursor = 'grab'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Vista para empurrar as paredes e mover objetos');
    b.appendChild(cv); S.rcv = cv;
    b.appendChild(el('p', 'il-note', roomView() === 'top' ? 'De cima: a janela (face) fica embaixo. Arraste o fundo (linha de cima) para trás e para frente, as paredes laterais para dentro, e os objetos onde quiser.' : 'De lado: a janela fica à esquerda. Arraste o fundo para a direita, o chão e o teto para cima ou para baixo, e os objetos onde quiser.'));
    wireRoomCanvas(cv, R, h);
    drawRoomCv();
    // objetos
    var ob = el('div', 'il-box'); ob.appendChild(el('b', null, 'Objetos com GIF ou imagem'));
    var addRow = el('div', 'il-row');
    addRow.appendChild(btn('+ Objeto', function () {
      if (R.sprites.length >= C.MAX_SPRITES) { S.msg = 'Máximo de ' + C.MAX_SPRITES + ' objetos por sala.'; render(); return; }
      pickImage(function (m) { addSprite(m); });
    }, null, 'il-add-sprite'));
    var imgs = projectImages();
    if (imgs.length) { var sel = el('select'); sel.id = 'il-add-from-project'; sel.style.flex = '1'; var o0 = el('option', null, 'ou escolha da biblioteca do projeto…'); o0.value = ''; sel.appendChild(o0); imgs.forEach(function (m, i) { var x = el('option', null, m.name); x.value = i; sel.appendChild(x); }); sel.addEventListener('change', function () { if (sel.value !== '') addSprite(imgs[+sel.value]); }); addRow.appendChild(sel); }
    ob.appendChild(addRow);
    function addSprite(m) {
      if (R.sprites.length >= C.MAX_SPRITES) return;
      var id = 'sp' + Math.random().toString(36).slice(2, 7);
      R.sprites.push({ id: id, name: m.name ? String(m.name).replace(/\.[^.]+$/, '').slice(0, 30) : 'Objeto', x: 0, y: -h * 0.3, z: -Math.max(10, S.il.params.depth * 0.4), size: Math.max(2, h * 0.9), media: m, fx: '' });
      changed('il-room', true);
    }
    R.sprites.forEach(function (q, i) {
      var g = el('div', 'il-box'); g.dataset.sprite = q.id;
      var top = el('div', 'il-row'); var nm = el('input'); nm.type = 'text'; nm.value = q.name; nm.maxLength = 40; nm.style.flex = '1'; nm.setAttribute('aria-label', 'Nome do objeto');
      nm.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') nm.blur(); });
      nm.addEventListener('change', function () { q.name = nm.value.trim().slice(0, 40) || 'Objeto'; changed('il-room'); });
      top.appendChild(nm); top.appendChild(mediaPicker(q.media, function (m) { q.media = m; changed('il-room', true); }, 'il-spm-' + i));
      top.appendChild(btn('Remover', function () { R.sprites.splice(i, 1); changed('il-room', true); }, null, 'il-sp-del-' + i)); g.appendChild(top);
      var gr = el('div', 'il-grid3');
      [['X', 'x'], ['Y', 'y'], ['Z (fundo -)', 'z']].forEach(function (f) { gr.appendChild(numField(f[0], q[f[1]], function (v) { q[f[1]] = Math.max(f[1] === 'z' ? -600 : -60, Math.min(f[1] === 'z' ? 60 : 60, v)); changed('il-room', true); }, 'il-sp' + i + '-' + f[1])); });
      g.appendChild(gr);
      slider(g, 'Tamanho (pol)', function () { return q.size; }, function (v) { q.size = v; changed('il-room-sz'); drawRoomCv(); }, 0.5, 40, 0.5);
      var fl = el('label'), fc = el('input'); fc.type = 'checkbox'; fc.checked = q.fx === 'float'; fc.addEventListener('change', function () { q.fx = fc.checked ? 'float' : ''; changed('il-room'); }); fl.appendChild(fc); fl.appendChild(document.createTextNode(' Flutuar de leve')); g.appendChild(fl);
      ob.appendChild(g);
    });
    var ms = G && G.mediaStatus ? G.mediaStatus() : null;
    if (ms && ms.failed) ob.appendChild(el('p', 'il-warn', 'Alguma imagem não carregou: ' + ms.errors.slice(0, 2).join(' | ')));
    if (!R.sprites.length) ob.appendChild(el('p', 'il-note', 'Sem objetos ainda. Um GIF com fundo transparente (um bichinho, por exemplo) funciona bem.'));
    ob.appendChild(el('p', 'il-note', 'O objeto fica sempre virado para a frente da face. Vídeo ainda não vale como textura no 3D, só GIF e imagem.'));
    b.appendChild(ob);
    return b;
  }
  // mapeamento das vistas (x, y, u = profundidade positiva) para pixels
  function roomMap(cv) {
    var R = S.il.room, st = stage(), cube = C.cubeById(st, S.il.target.cube) || st.cubes[0], h = cube.size / 2, D = Math.max(8, S.il.params.depth);
    var W = cv.width, Hh = cv.height, m = 22, back = h * 0.7, view = roomView(), k;
    if (view === 'top') { k = Math.min((W - 2 * m) / (2 * h * 1.8), (Hh - 2 * m) / (D * 1.1 + back)); return { view: view, h: h, D: D, k: k, W: W, H: Hh, px: function (x) { return W / 2 + x * k; }, py: function (u) { return Hh - m - (u + back) * k; }, ix: function (X) { return (X - W / 2) / k; }, iu: function (Y) { return (Hh - m - Y) / k - back; } }; }
    k = Math.min((W - 2 * m) / (D * 1.1 + back), (Hh - 2 * m) / (2 * h * 1.8));
    return { view: view, h: h, D: D, k: k, W: W, H: Hh, px: function (u) { return m + (u + back) * k; }, py: function (y) { return Hh / 2 - y * k; }, iu: function (X) { return (X - m) / k - back; }, iy: function (Y) { return (Hh / 2 - Y) / k; } };
  }
  function drawRoomCv() {
    var cv = S.rcv; if (!cv || !cv.isConnected || !S.il || !S.il.room) return;
    var R = S.il.room, M = roomMap(cv), ctx = cv.getContext('2d'), h = M.h, D = M.D, W = R.walls;
    ctx.clearRect(0, 0, cv.width, cv.height); ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.lineWidth = 2; ctx.font = '12px system-ui,sans-serif'; ctx.textBaseline = 'middle';
    function line(x1, y1, x2, y2, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w || 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    function dot(x, y, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.2832); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
    function lab(t, x, y, col) { ctx.fillStyle = col || '#9aa4b2'; ctx.fillText(t, x, y); }
    if (M.view === 'top') {
      line(M.px(-h), M.py(0), M.px(h), M.py(0), '#ff4fa3', 4); lab('janela (face)', M.px(-h) + 4, M.py(0) + 12, '#ff9ccb');
      if (W.back.on) { line(M.px(-h), M.py(D), M.px(h), M.py(D), '#2fd8ff', 3); dot(M.px(0), M.py(D), '#2fd8ff'); lab('fundo ' + Math.round(D) + ' pol', M.px(0) + 10, M.py(D) - 10, '#7fe3ff'); }
      [['left', -1], ['right', 1]].forEach(function (a) { var w = W[a[0]]; if (!w.on) return; var x = a[1] * (h - w.d); line(M.px(x), M.py(0), M.px(x), M.py(D), '#7aa2ff', 3); dot(M.px(x), M.py(D / 2), '#7aa2ff'); });
      R.sprites.forEach(function (q) { dot(M.px(q.x), M.py(-q.z), q.media ? '#ffd23d' : '#bbb'); lab(q.name, M.px(q.x) + 9, M.py(-q.z), '#ffe28a'); });
    } else {
      line(M.px(0), M.py(-h), M.px(0), M.py(h), '#ff4fa3', 4); lab('janela', M.px(0) + 6, M.py(-h) + 12, '#ff9ccb');
      if (W.back.on) { line(M.px(D), M.py(-h), M.px(D), M.py(h), '#2fd8ff', 3); dot(M.px(D), M.py(0), '#2fd8ff'); lab('fundo ' + Math.round(D) + ' pol', M.px(D) - 70, M.py(h) - 12, '#7fe3ff'); }
      [['floor', -1], ['ceiling', 1]].forEach(function (a) { var w = W[a[0]]; if (!w.on) return; var y = a[1] * (h - w.d); line(M.px(0), M.py(y), M.px(D), M.py(y), '#7aa2ff', 3); dot(M.px(D / 2), M.py(y), '#7aa2ff'); });
      R.sprites.forEach(function (q) { dot(M.px(-q.z), M.py(q.y), q.media ? '#ffd23d' : '#bbb'); lab(q.name, M.px(-q.z) + 9, M.py(q.y) - 10, '#ffe28a'); });
    }
  }
  function wireRoomCanvas(cv, R, h) {
    var drag = null, TOL = 14;
    function pos(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; }
    function hit(p) {
      var M = roomMap(cv), W = R.walls, best = null, bd = TOL * (cv.width / Math.max(1, cv.getBoundingClientRect().width));
      function cand(id, d, extra) { if (d < bd) { bd = d; best = { id: id, extra: extra }; } }
      R.sprites.forEach(function (q, i) { var x = M.view === 'top' ? M.px(q.x) : M.px(-q.z), y = M.view === 'top' ? M.py(-q.z) : M.py(q.y); cand('sp:' + i, Math.hypot(p[0] - x, p[1] - y)); });
      if (M.view === 'top') {
        if (W.back.on && Math.abs(p[0] - M.px(0)) < M.px(h) - M.px(0)) cand('back', Math.abs(p[1] - M.py(M.D)));
        [['left', -1], ['right', 1]].forEach(function (a) { if (W[a[0]].on && p[1] < M.py(0) && p[1] > M.py(M.D)) cand(a[0], Math.abs(p[0] - M.px(a[1] * (h - W[a[0]].d)))); });
      } else {
        if (W.back.on && Math.abs(p[1] - M.py(0)) < M.py(-h) - M.py(0)) cand('back', Math.abs(p[0] - M.px(M.D)));
        [['floor', -1], ['ceiling', 1]].forEach(function (a) { if (W[a[0]].on && p[0] > M.px(0) && p[0] < M.px(M.D)) cand(a[0], Math.abs(p[1] - M.py(a[1] * (h - W[a[0]].d)))); });
      }
      return best;
    }
    function snap(v) { return Math.round(v * 2) / 2; }
    function apply(p) {
      var M = roomMap(cv), id = drag.id;
      if (id === 'back') { S.il.params.depth = Math.max(8, Math.min(600, snap(M.view === 'top' ? M.iu(p[1]) : M.iu(p[0])))); }
      else if (id === 'left') R.walls.left.d = Math.max(0, Math.min(14, snap(h + M.ix(p[0]))));
      else if (id === 'right') R.walls.right.d = Math.max(0, Math.min(14, snap(h - M.ix(p[0]))));
      else if (id === 'floor') R.walls.floor.d = Math.max(0, Math.min(14, snap(h + M.iy(p[1]))));
      else if (id === 'ceiling') R.walls.ceiling.d = Math.max(0, Math.min(14, snap(h - M.iy(p[1]))));
      else if (id.indexOf('sp:') === 0) {
        var q = R.sprites[+id.slice(3)]; if (!q) return;
        if (M.view === 'top') { q.x = Math.max(-60, Math.min(60, snap(M.ix(p[0])))); q.z = -Math.max(-60, Math.min(600, snap(M.iu(p[1])))); }
        else { q.z = -Math.max(-60, Math.min(600, snap(M.iu(p[0])))); q.y = Math.max(-60, Math.min(60, snap(M.iy(p[1])))); }
      }
      changed('il-room-drag'); drawRoomCv();
    }
    cv.addEventListener('pointerdown', function (e) { var p = pos(e), hh = hit(p); if (!hh) return; drag = { id: hh.id }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) { var p = pos(e); if (drag) apply(p); else cv.style.cursor = hit(p) ? 'grab' : 'default'; });
    function end() { if (!drag) return; drag = null; cv.style.cursor = 'grab'; render(); }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }

  function secParams() {
    var b = box('prof', 'Profundidade virtual e parâmetros'), pr = C.PRESETS[S.il.preset];
    pr.uses.filter(function (n) { return !/^cam[xyz]$/.test(n); }).forEach(function (n) {
      var P = C.PARAMS[n];
      slider(b, P.label, function () { return S.il.params[n]; }, function (v) { S.il.params[n] = (n === 'sides' || n === 'brkdir') ? Math.round(v) : v; changed('il-p:' + n); }, P.min, P.max, P.step, P.kf ? { kf: n } : null);
    });
    return b;
  }
  function secCamera() {
    var b = box('cam', 'Câmera e visualização');
    var r = el('div', 'il-row');
    [['audience', 'Audience View'], ['free', 'Free Camera'], ['projector', 'Projector Output']].forEach(function (v) { var x = btn(v[1], function () { S.view = v[0]; S.il.camera.view = v[0]; render(); }, S.view === v[0] ? 'on' : '', 'il-view-' + v[0]); x.setAttribute('aria-pressed', S.view === v[0] ? 'true' : 'false'); r.appendChild(x); });
    b.appendChild(r);
    b.appendChild(el('p', 'il-note', S.view === 'audience' ? 'Como o público vê, do ponto de vista que você definiu.' : (S.view === 'free' ? 'Câmera livre pra conferir os cubos. Arraste na prévia pra girar, role pra aproximar.' : 'As texturas planas que saem pro projetor, uma por face.')));
    // Ângulo de visão da prévia: ver os cubos mais de cima (só a prévia; não muda o que sai no projetor)
    var ar = el('div', 'il-row'); ar.appendChild(el('span', 'il-note', 'Ver de: '));
    [['De frente', 4], ['Um pouco de cima', 30], ['De cima', 70]].forEach(function (a2) { ar.appendChild(btn(a2[0], function () { S.view = 'free'; S.il.camera.view = 'free'; S.orbit.pitch = a2[1]; render(); }, Math.abs(S.orbit.pitch - a2[1]) < 3 && S.view === 'free' ? 'on' : '', 'il-ang-' + a2[1])); });
    b.appendChild(ar);
    slider(b, 'Inclinação da prévia (°, 0 = de frente, 85 = de cima)', function () { return S.orbit.pitch; }, function (v) { S.orbit.pitch = v; if (S.view !== 'free') { S.view = 'free'; S.il.camera.view = 'free'; } }, -10, 85, 1);
    b.appendChild(el('p', 'il-note', 'Isso muda só como você vê o palco aqui. Para mudar a perspectiva de verdade nos cubos, ajuste a altura do olho do público:'));
    var eyeY = stage().viewer.pos[1];
    slider(b, 'Altura do olho do público (pol)', function () { return stage().viewer.pos[1]; }, function (v) { H.checkpoint('il-view'); T.ensureStage(seq()); seq().stage.viewer.pos[1] = v; seq().stage = C.fixStage(seq().stage); syncOut(); }, 0, 200, 1);
    var al = el('label'), ac = el('input'); ac.type = 'checkbox'; ac.id = 'il-assist'; ac.checked = S.il.camera.assist !== false; ac.addEventListener('change', function () { S.il.camera.assist = ac.checked; changed('il-assist'); }); al.appendChild(ac); al.appendChild(document.createTextNode(' Cada face com a própria perspectiva (Direita, Esquerda, Trás e Topo vistas de frente)')); b.appendChild(al);
    slider(b, 'Abertura da lente (°)', function () { return S.il.camera.fov; }, function (v) { S.il.camera.fov = v; changed('il-fov'); }, 10, 90, 1);
    ['camx', 'camy', 'camz'].forEach(function (n) { var P = C.PARAMS[n]; slider(b, P.label.replace('Olhar', 'Deslocar o olho'), function () { return S.il.params[n]; }, function (v) { S.il.params[n] = v; changed('il-p:' + n); }, P.min, P.max, P.step, { kf: n }); });
    return b;
  }
  function secLight() {
    var b = box('luz', 'Iluminação'), L = S.il.light;
    slider(b, 'Luz ambiente', function () { return L.ambient; }, function (v) { L.ambient = v; changed('il-l'); }, 0, 2, 0.05);
    slider(b, 'Luz principal', function () { return L.key; }, function (v) { L.key = v; changed('il-l'); }, 0, 3, 0.05);
    slider(b, 'Luz do núcleo', function () { return L.core; }, function (v) { L.core = v; changed('il-l'); }, 0, 3, 0.05);
    var P = C.PARAMS.light; slider(b, 'Intensidade geral (animável)', function () { return S.il.params.light; }, function (v) { S.il.params.light = v; changed('il-p:light'); }, P.min, P.max, P.step, { kf: 'light' });
    ['X', 'Y', 'Z'].forEach(function (ax, i) { slider(b, 'Direção da luz ' + ax, function () { return L.keyDir[i]; }, function (v) { L.keyDir[i] = v; var d = C.v.norm(L.keyDir); if (C.v.len(L.keyDir) < 1e-3) L.keyDir = [0, 1, 0]; changed('il-l'); }, -1, 1, 0.05); });
    b.appendChild(colorRow('Cor da luz principal', function () { return L.keyColor; }, function (v) { L.keyColor = v; changed('il-l'); }));
    b.appendChild(colorRow('Cor do núcleo', function () { return L.coreColor; }, function (v) { L.coreColor = v; changed('il-l'); }));
    return b;
  }
  function secMaterial() {
    var b = box('mat', 'Materiais e cores'), st = S.il.style;
    b.appendChild(colorRow('Cor 1', function () { return st.color1; }, function (v) { st.color1 = v; changed('il-c'); }, 'il-color1'));
    b.appendChild(colorRow('Cor 2', function () { return st.color2; }, function (v) { st.color2 = v; changed('il-c'); }, 'il-color2'));
    b.appendChild(selectRow('Objeto', [['cube', 'Cubo'], ['sphere', 'Esfera'], ['torus', 'Anel'], ['gear', 'Engrenagem']], function () { return st.obj; }, function (v) { st.obj = v; changed('il-m'); }, 'il-obj'));
    b.appendChild(selectRow('Material', [['matte', 'Fosco'], ['metal', 'Metal'], ['glass', 'Vidro'], ['neon', 'Neon'], ['wire', 'Aramado']], function () { return st.material; }, function (v) { st.material = v; changed('il-m'); }, 'il-material'));
    b.appendChild(selectRow('Paredes', [['grid', 'Com linhas de grade'], ['panel', 'Painéis'], ['plain', 'Lisas']], function () { return st.wall; }, function (v) { st.wall = v; changed('il-m'); }, 'il-wall'));
    return b;
  }
  function secAnim() {
    var b = box('anim', 'Animação'), pr = C.PRESETS[S.il.preset];
    var r = el('div', 'il-row');
    r.appendChild(btn(S.playing ? 'Pausar prévia' : 'Tocar prévia', function () { S.playing = !S.playing; if (S.playing) S.t0 = performance.now() - S.tFree * 1000; render(); }, null, 'il-play'));
    b.appendChild(r);
    ['flow', 'spin'].forEach(function (n) { if (pr.uses.indexOf(n) >= 0) { var P = C.PARAMS[n]; slider(b, P.label, function () { return S.il.params[n]; }, function (v) { S.il.params[n] = v; changed('il-p:' + n); }, P.min, P.max, P.step); } });
    var q = T.QUICK[S.il.preset] || [];
    q.forEach(function (x) {
      b.appendChild(btn('Animar: ' + x.label, function () {
        if (!S.assetId) { S.msg = 'Aplique a ilusão na timeline primeiro.'; render(); return; }
        H.checkpoint('il-quick'); var cs = T.clipsOfAsset(seq(), S.assetId), n = 0;
        cs.forEach(function (c) { var ks = x.keys(c.clip.duration); ks.forEach(function (k) { Seq.setKey(c.clip, 'ill.' + k.param, k.t, k.v, k.i || 'ease'); }); n++; });
        H.syncClock(); syncOut(); H.renderAll(); S.msg = 'Keyframes criados em ' + n + ' clipe(s). Dá pra editar na aba Timeline.'; render();
      }, null, 'il-quick-' + S.il.preset));
    });
    b.appendChild(el('p', 'il-note', 'Os parâmetros com ◆ viram keyframes comuns da timeline (curvas, copiar, colar, tudo igual). O relógio é o mesmo da sequência: a saída do projetor e esta prévia mostram o mesmo instante.'));
    return b;
  }
  function secQuality() {
    var b = box('q', 'Qualidade');
    b.appendChild(selectRow('Qualidade de render', [['low', 'Low (mais leve)'], ['medium', 'Medium'], ['high', 'High (mais nítido)']], function () { return S.il.quality; }, function (v) { S.il.quality = v; changed('il-q'); }, 'il-quality'));
    b.appendChild(el('p', 'il-note', 'Low usa até 320 px no lado maior, Medium 640 e High 1280, esticados pra superfície. Se o computador engasgar, desça um nível.'));
    return b;
  }
  function loadPresets() { try { var a = JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function savePresets(a) { try { localStorage.setItem(PRESETS_KEY, JSON.stringify(a.slice(0, 40))); } catch (e) {} }
  function secPresets() {
    var b = box('pre', 'Presets salvos'), list = loadPresets();
    var r = el('div', 'il-row'), nm = el('input'); nm.type = 'text'; nm.id = 'il-preset-name'; nm.placeholder = 'Nome do preset'; nm.maxLength = 40; nm.style.flex = '1';
    nm.addEventListener('keydown', function (e) { e.stopPropagation(); });
    r.appendChild(nm);
    r.appendChild(btn('Salvar preset', function () {
      var name = (nm.value || S.il.name).trim().slice(0, 40), a = loadPresets().filter(function (p) { return p.name !== name; });
      var il = clone(S.il); delete il.id; a.unshift({ name: name, il: il }); savePresets(a); S.msg = 'Preset "' + name + '" salvo neste computador.'; render();
    }, null, 'il-save-preset'));
    b.appendChild(r);
    list.forEach(function (p, i) {
      var row = el('div', 'il-row'); row.dataset.name = p.name;
      row.appendChild(btn(p.name, function () {
        var v = C.validate(p.il, stage());
        if (!v.ok) { S.msg = 'Esse preset está inválido: ' + v.errors[0]; render(); return; }
        S.il = v.value; S.assetId = null; S.msg = 'Preset "' + p.name + '" carregado' + (v.warnings.length ? ' (' + v.warnings.length + ' ajuste(s) automático(s))' : '') + '.'; render();
      }, null, 'il-load-' + i));
      row.appendChild(btn('Excluir', function () { savePresets(loadPresets().filter(function (x) { return x.name !== p.name; })); render(); }));
      b.appendChild(row);
    });
    if (!list.length) b.appendChild(el('p', 'il-note', 'Nenhum preset salvo ainda.'));
    return b;
  }

  // ---------- prévia ----------
  function previewTimes() {
    var out = { t: S.tFree, ill: null, bound: false };
    if (S.assetId) {
      var cs = T.clipsOfAsset(seq(), S.assetId);
      if (cs.length) {
        var now = H.tl.clock.now(), pick = cs[0];
        cs.forEach(function (x) { if (now >= x.clip.start && now < x.clip.start + x.clip.duration) pick = x; });
        var a = Seq.asset(seq(), pick.clip.assetId), ev = Seq.evalClip(pick.clip, a, now);
        out.bound = true;
        if (ev) { out.t = ev.cl; out.ill = ev.ill; } else out.ill = pick.clip.ill || null;
      }
    }
    return out;
  }
  function paint() {
    if (!S.cv || !S.cv.isConnected) return;
    var pt = previewTimes();
    var t = pt.bound && pt.ill ? pt.t : S.tFree;
    try { G.drawStage(S.cv, { rig: stage(), il: S.il, ill: pt.ill, t: t, view: S.view, orbit: S.orbit, focus: !S.adv }); if (!S.adv && S.view === 'free') overlayFaces(); } catch (e) { /* o status mostra o motivo */ }
    var nowT = Date.now();
    if (S.lastStatus && nowT - S.lastStatus < 600) return;   // o texto de status só muda a cada 0,6 s: evita o painel tremer
    S.lastStatus = nowT;
    var st = G.status(), s = document.getElementById('il-status');
    if (s) s.textContent = st.ok ? 'WebGL ativo · ' + (st.stats.w ? st.stats.w + 'x' + st.stats.h + ' px, ' + st.stats.ms.toFixed(1) + ' ms por face, ' + st.stats.prims + ' objetos' + (st.stats.ms > 40 && S.il && S.il.quality !== 'low' ? '. Está lento: tente a qualidade Baixa ou Média.' : '') : 'pronto') : 'WebGL indisponível: ' + st.reason + ' A saída usa uma versão 2D simples e o resto do app segue funcionando.';
  }
  function loop(now) {
    S.raf = requestAnimationFrame(loop);
    if (!sec) return;
    if (!S.lastPoll || now - S.lastPoll > 350) { S.lastPoll = now; pollSelection(); }
    // superfícies criadas, apagadas ou renomeadas depois de abrir o painel: atualiza as listas de ligação das faces
    if (!S.lastSurfPoll || now - S.lastSurfPoll > 500) {
      S.lastSurfPoll = now;
      try { var sg = H.surfaces().map(function (x) { return x.s.key + ':' + x.s.name; }).join('|'); if (S.surfSig == null) S.surfSig = sg; else if (sg !== S.surfSig && sec.offsetParent) { S.surfSig = sg; render(); } } catch (e) {}
    }
    if (!sec.offsetParent) return;
    if (S.playing) S.tFree = (now - S.t0) / 1000;
    paint();
  }
  // Se o usuário seleciona um clipe de ilusão na timeline, o painel passa a editar aquela ilusão
  function pollSelection() {
    try {
      var ids = root.TimelineUI && root.TimelineUI.api ? root.TimelineUI.api.selected() : [];
      var key = ids && ids.length ? ids[0] : null;
      if (key !== S.lastSel) {
        S.lastSel = key;
        if (key) {
          var f = Seq.findClip(seq(), key), a = f ? Seq.asset(seq(), f.clip.assetId) : null;
          if (a && a.fx && a.fx.kind === 'illusion' && a.fx.illusion && a.id !== S.assetId) { S.il = clone(a.fx.illusion); S.assetId = a.id; S.msg = 'Editando a ilusão do clipe selecionado.'; render(); }
        }
      }
      if (S.assetId && !T.illusionOf(seq(), S.assetId)) { S.assetId = null; S.msg = 'A ilusão saiu da timeline. Ela virou rascunho.'; render(); }
    } catch (e) {}
  }

  function applyNow() {
    var keys = [];
    if (S.quick && T.QUICK[S.il.preset]) keys = T.QUICK[S.il.preset][0].keys(S.dur);
    var b = T.apply(S.il, hostObj(), { duration: S.dur, keys: keys });
    if (b.ok) { S.assetId = b.assetId; S.il = clone(T.illusionOf(seq(), b.assetId) || S.il); S.msg = 'Aplicado: ' + b.clipIds.length + ' clipe(s) na timeline, começando em ' + b.at.toFixed(2) + ' s.' + (b.warnings.length ? ' Avisos: ' + b.warnings.join(' ') : ''); }
    else S.msg = (b.errors && b.errors[0]) || b.warnings.join(' ') || 'Não consegui aplicar.';
    render();
  }

  function render() {
    if (!sec || !S.il) return;
    var keep = sec.querySelector('details[open]') ? null : null, scroll = sec.parentNode ? sec.parentNode.scrollTop : 0;
    sec.textContent = ''; S.lastStatus = 0;
    var w = el('div', 'il-wrap');
    var head = el('div', 'il-row'); head.appendChild(el('h2', null, '3D Illusion Creator')); w.appendChild(head);
    var cv = el('canvas', 'il-cv'); cv.id = 'il-canvas'; cv.width = 560; cv.height = 350; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Prévia da ilusão 3D'); S.cv = cv; w.appendChild(cv);
    if (!S.adv) {
      cv.style.cursor = 'grab'; cv.style.touchAction = 'none';
      var vr0 = el('div', 'il-row'); vr0.style.flexWrap = 'wrap';
      [['De frente', 0, 8], ['De canto', 35, 22], ['De cima', 20, 70]].forEach(function (a3) { vr0.appendChild(btn(a3[0], function () { S.view = 'free'; S.il.camera.view = 'free'; S.orbit.yaw = a3[1]; S.orbit.pitch = a3[2]; }, null, 'il-ang-' + a3[2])); });
      w.appendChild(vr0);
      w.appendChild(el('p', 'il-note', 'Arraste para girar o cubo, role para aproximar e clique numa face para escolher.'));
    }
    var stt = el('p', 'il-note'); stt.id = 'il-status'; stt.style.cssText = 'min-height:34px;overflow:hidden;font-variant-numeric:tabular-nums'; w.appendChild(stt);
    var msg = el('p', 'il-note il-ok'); msg.id = 'il-msg'; msg.textContent = S.msg; msg.setAttribute('role', 'status'); w.appendChild(msg);
    var ar = el('div', 'il-row');
    var dl = el('label', null, 'Duração (s) '), dn = el('input'); dn.type = 'number'; dn.min = 1; dn.max = 600; dn.step = 1; dn.value = S.dur; dn.id = 'il-dur'; dn.style.width = '64px'; dn.addEventListener('change', function () { S.dur = Math.max(1, Math.min(600, +dn.value || 8)); });
    dn.addEventListener('keydown', function (e) { e.stopPropagation(); });
    dl.appendChild(dn); ar.appendChild(dl);
    var ql = el('label'), qc = el('input'); qc.type = 'checkbox'; qc.checked = S.quick; qc.id = 'il-quick-on'; qc.addEventListener('change', function () { S.quick = qc.checked; }); ql.appendChild(qc); ql.appendChild(document.createTextNode(' Incluir animação do preset')); ar.appendChild(ql);
    w.appendChild(ar);
    var ar2 = el('div', 'il-row');
    ar2.appendChild(btn(S.assetId ? 'Aplicar de novo (nova camada)' : 'Aplicar na Timeline', applyNow, 'primary', 'il-apply'));
    if (S.assetId) ar2.appendChild(btn('Desfazer aplicação', function () { var asset = S.assetId; H.checkpoint('il-remove'); T.removeAll(seq(), asset); S.assetId = null; H.syncClock(); H.renderAll(); S.msg = 'Ilusão removida da timeline. Ela voltou a ser rascunho.'; render(); }, null, 'il-remove'));
    w.appendChild(ar2);
    var easy = !S.adv && S.il.preset === 'room-builder';
    (easy ? [secEasy, secEasyView, secEasyDepth, secRoom] : [secIllusion, secTarget].concat(S.il.preset === 'room-builder' ? [secRoom] : [], [secGeometry, secParams, secCamera, secLight, secMaterial, secAnim, secQuality, secPresets])).forEach(function (f) { w.appendChild(f()); });
    var al = el('label', 'il-note'), ac = el('input'); ac.type = 'checkbox'; ac.id = 'il-adv'; ac.checked = S.adv;
    ac.addEventListener('change', function () { S.adv = ac.checked; try { localStorage.setItem('lenzi-il-adv', S.adv ? '1' : '0'); } catch (e) {} render(); });
    al.appendChild(ac); al.appendChild(document.createTextNode(' Mostrar opções avançadas (tipos de ilusão, câmera, luz, geometria do palco)')); w.appendChild(al);
    if (!S.adv && S.il.preset !== 'room-builder') { var back = el('div', 'il-row'); back.appendChild(el('span', 'il-note', 'Esta ilusão não é a Sala de paredes.')); back.appendChild(btn('Voltar para a Sala de paredes', function () { newIllusion('room-builder'); render(); }, null, 'il-back-room')); w.insertBefore(back, w.firstChild.nextSibling); }
    sec.appendChild(w);
    if (sec.parentNode) sec.parentNode.scrollTop = scroll;
    // câmera livre: arrastar gira, rolar aproxima
    var drag = null;
    function cpos(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / Math.max(1, r.width), (e.clientY - r.top) * cv.height / Math.max(1, r.height)]; }
    cv.addEventListener('pointerdown', function (e) { if (S.view !== 'free') return; drag = { x: e.clientX, y: e.clientY, yaw: S.orbit.yaw, pitch: S.orbit.pitch, moved: false }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', function (e) {
      if (!drag) { if (!S.adv && S.view === 'free' && G.pickFace) { var h = G.pickFace.apply(null, cpos(e)); S.hover = h; cv.style.cursor = h ? 'pointer' : 'grab'; } return; }
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 5) drag.moved = true;
      S.orbit.yaw = drag.yaw - (e.clientX - drag.x) * 0.4; S.orbit.pitch = Math.max(-10, Math.min(85, drag.pitch + (e.clientY - drag.y) * 0.4));
    });
    cv.addEventListener('pointerleave', function () { S.hover = null; });
    cv.addEventListener('pointerup', function (e) {
      var was = drag; drag = null;
      if (was && !was.moved && !S.adv && S.view === 'free' && G.pickFace) { var h = G.pickFace.apply(null, cpos(e)); if (h) selectFace(h.cube, h.face); }
    });
    cv.addEventListener('wheel', function (e) { if (S.view !== 'free') return; e.preventDefault(); S.orbit.dist = Math.max(30, Math.min(400, S.orbit.dist * (e.deltaY > 0 ? 1.08 : 0.92))); }, { passive: false });
    paint();
  }

  function init(host) {
    H = host; sec = document.getElementById('il-panel');
    if (!sec || !C || !G || !T) return;
    if (!document.getElementById('il-css')) { var st = el('style'); st.id = 'il-css'; st.textContent = CSS; document.head.appendChild(st); }
    newIllusion(S.adv ? 'infinite-room' : 'room-builder'); S.msg = '';
    if (!S.adv) { S.view = 'free'; S.il.camera.view = 'free'; S.orbit = { yaw: 30, pitch: 24, dist: 38 }; }
    S.t0 = performance.now();
    render();
    if (!S.raf) S.raf = requestAnimationFrame(loop);
  }

  // Carrega uma ilusão (ex.: vinda da IA) no painel como rascunho, sem aplicar
  function load(il) { var v = C.validate(il, H && H.seq ? seq().stage : null); if (!v.ok) return false; S.il = clone(v.value); S.assetId = null; S.msg = 'Ilusão carregada: ' + v.value.name + '. Aplique na timeline quando quiser.'; render(); return true; }
  root.IllusionUI = { _roomMap: function () { return S.rcv ? roomMap(S.rcv) : null; }, init: init, load: load, render: render, apply: applyNow, state: S, _newIllusion: newIllusion };
})(typeof window !== 'undefined' ? window : globalThis);
