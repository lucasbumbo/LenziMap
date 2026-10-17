(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var api = window.api;
  var M = window.MapMath;
  var FX_KINDS = Renderer.FX_KINDS;
  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage');
  var overlay = $('overlay');
  var listEl = $('list');
  var rend = new Renderer(stage, overlay, { audio: true });
  Renderer.onCamError = function () { say('Não consegui abrir a câmera. Libere o acesso em Ajustes do Sistema, Privacidade e Segurança, Câmera.'); };

  var state = {
    scenes: [{ id: newSceneId(), name: 'Cena 1', surfaces: [], sel: null }],
    scene: 0, surfaces: [], sel: null,
    mode: 'corners', guides: true, playing: true, snap: true,
    solo: null, master: 100, blackout: false
  };
  state.surfaces = state.scenes[0].surfaces;
  // Timeline: sequência (modelo), relógio mestre e estado de edição. Só vale quando tl.on (Modo timeline).
  var Seq = window.Sequence;
  var tl = { on: false, seq: Seq.create(), clock: new Seq.Clock(), lockCal: false, autoKey: false };
  rend.tlClock = tl.clock;
  function isLocked(s) { return !!(s && (s.locked || tl.lockCal)); }
  var uid = 0;
  var displays = [];
  var outOpen = false;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function copyPts(a) { return a.map(function (p) { return [p[0], p[1]]; }); }
  function say(t) { $('status').textContent = t; }
  function setPressed(el, on) {
    el.classList.toggle('on', !!on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function svgEl(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function sel() {
    for (var i = 0; i < state.surfaces.length; i++) if (state.surfaces[i].id === state.sel) return state.surfaces[i];
    return null;
  }
  function isel() {
    var s = sel();
    if (!s || !s.extras || !s.extras.length) return null;
    for (var i = 0; i < s.extras.length; i++) if (s.extras[i].id === s.selItem) return s.extras[i];
    return s.extras[s.extras.length - 1];
  }
  function textSel() { var it = isel(); return it && it.type === 'text' ? it : null; }
  function fxSel() { var it = isel(); return it && it.type === 'fx' ? it : null; }
  function showOf(s) { return s.visible && (state.solo == null || state.solo === s.id); }
  function px(s) {
    var W = stage.clientWidth, H = stage.clientHeight;
    return s.q.map(function (p) { return [p[0] * W, p[1] * H]; });
  }
  // Contorno da superfície na tela: com malha ligada, é o anel externo da malha
  function outline(s) {
    if (!(s.mesh && s.mesh.on)) return px(s);
    var W = stage.clientWidth, H = stage.clientHeight, mp = M.meshPoints(s), n = s.mesh.n, n1 = n + 1, ring = [], i, j;
    function P(ii, jj) { var p = mp[jj * n1 + ii]; ring.push([p[0] * W, p[1] * H]); }
    for (i = 0; i <= n; i++) P(i, 0);
    for (j = 1; j <= n; j++) P(n, j);
    for (i = n - 1; i >= 0; i--) P(i, n);
    for (j = n - 1; j >= 1; j--) P(0, j);
    return ring;
  }
  function getH(s) { return M.homography(s, stage.clientWidth, stage.clientHeight); }
  function insidePoly(P, pt) {
    var inside = false, n = P.length;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
      if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function cloneS(s) {
    var c = {};
    for (var k in s) {
      var v = s[k];
      c[k] = (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v;
    }
    return c;
  }

  function testPattern() {
    var w = 1600, h = 900, x, y;
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">';
    s += '<rect width="' + w + '" height="' + h + '" fill="#12161c"/>';
    for (x = 0; x <= w; x += 100) s += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + h + '" stroke="#3a4350" stroke-width="' + (x % 400 === 0 ? 3 : 1) + '"/>';
    for (y = 0; y <= h; y += 100) s += '<line x1="0" y1="' + y + '" x2="' + w + '" y2="' + y + '" stroke="#3a4350" stroke-width="' + (y % 400 === 0 ? 3 : 1) + '"/>';
    s += '<line x1="0" y1="0" x2="' + w + '" y2="' + h + '" stroke="#ff4fa3" stroke-width="3"/>';
    s += '<line x1="' + w + '" y1="0" x2="0" y2="' + h + '" stroke="#ff4fa3" stroke-width="3"/>';
    s += '<rect x="6" y="6" width="' + (w - 12) + '" height="' + (h - 12) + '" fill="none" stroke="#ff4fa3" stroke-width="12"/>';
    s += '<circle cx="800" cy="450" r="260" fill="none" stroke="#ffffff" stroke-width="4"/>';
    var cols = ['#00bcd4', '#ffd600', '#ff4fa3', '#8bc34a', '#ffffff'];
    cols.forEach(function (c, i) { s += '<rect x="' + (550 + i * 100) + '" y="770" width="100" height="60" fill="' + c + '"/>'; });
    s += '<text x="800" y="440" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="64" font-weight="700" fill="#ffffff">PADRÃO DE TESTE</text>';
    s += '<text x="800" y="505" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="34" fill="#9aa4b2">arraste os cantos pra encaixar</text>';
    s += '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }

  function toUrl(p) {
    if (api.toUrl) return api.toUrl(p);
    if (/^[a-zA-Z]:[\\/]/.test(p)) {
      return 'file:///' + p.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace('%3A', ':');
    }
    return 'file://' + p.split('/').map(encodeURIComponent).join('/');
  }
  function baseName(p) { return p.split(/[\\/]/).pop(); }
  function kindOf(p) {
    var e = p.split('.').pop().toLowerCase();
    if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'aif', 'aiff', 'caf'].indexOf(e) > -1) return { type: 'audio', tag: 'ÁUDIO' };
    if (e === 'gif') return { type: 'img', tag: 'GIF' };
    if (['mp4', 'm4v', 'mov', 'webm'].indexOf(e) > -1) return { type: 'video', tag: 'VÍDEO' };
    if (['png', 'jpg', 'jpeg', 'webp', 'apng', 'heic', 'heif'].indexOf(e) > -1) return { type: 'img', tag: 'FOTO' };
    return null;
  }

  function fitQ(ar, n) {
    var W = stage.clientWidth || 1280, H = stage.clientHeight || 720, sa = W / H, fw, fh;
    if (ar >= sa) { fw = 0.6; fh = 0.6 * sa / ar; } else { fh = 0.6; fw = 0.6 * ar / sa; }
    var o = (n % 6) * 0.025, cx = 0.44 + o, cy = 0.44 + o;
    return [[cx - fw / 2, cy - fh / 2], [cx + fw / 2, cy - fh / 2], [cx + fw / 2, cy + fh / 2], [cx - fw / 2, cy + fh / 2]];
  }

  // Estado que vai pro palco e pra janela de saída
  function view() {
    return {
      playing: state.playing, master: state.master, blackout: state.blackout, flash: !!state.flash, strobe: state.strobe || 0,
      tl: tl.on ? { on: true, seq: tl.seq, tr: tl.clock.transport() } : null,
      surfaces: state.surfaces.map(function (s) {
        var c = {};
        for (var k in s) c[k] = s[k];
        c.show = showOf(s);
        return c;
      })
    };
  }
  var pushQueued = false;
  function push() {
    scheduleAutosave();
    if (pushQueued) return;
    pushQueued = true;
    requestAnimationFrame(function () {
      pushQueued = false;
      api.sendState(view());
    });
  }
  function refresh() {
    rend.sync(view());
    renderOverlay();
    push();
  }
  function renderAll() {
    rend.sync(view());
    renderList(); renderOverlay(); syncControls(); renderScenes();
    if (window.TimelineUI) window.TimelineUI.refresh();
    push();
  }

  // Histórico (desfazer e refazer)
  var undoStack = [], redoStack = [], lastCk = { key: '', t: 0 };
  function syncScene() {
    var sc = state.scenes[state.scene];
    sc.surfaces = state.surfaces;
    sc.sel = state.sel;
  }
  // ID estável de cena (hierarquia, fase 6). Projetos antigos não tinham: ganham ao abrir.
  function newSceneId() { return 'sc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function snap() {
    syncScene();
    return {
      scene: state.scene,
      seq: JSON.parse(JSON.stringify(tl.seq)),
      scenes: state.scenes.map(function (sc) {
        return { id: sc.id, name: sc.name, sel: sc.sel, secs: sc.secs || 0, surfaces: sc.surfaces.map(cloneS) };
      })
    };
  }
  function restore(sn) {
    state.scenes = sn.scenes.map(function (sc) {
      return { id: sc.id || newSceneId(), name: sc.name, sel: sc.sel, secs: sc.secs || 0, surfaces: sc.surfaces.map(cloneS) };
    });
    state.scene = clamp(sn.scene, 0, state.scenes.length - 1);
    state.surfaces = state.scenes[state.scene].surfaces;
    state.sel = state.scenes[state.scene].sel;
    state.solo = null;
    if (sn.seq) { tl.seq = JSON.parse(JSON.stringify(sn.seq)); syncClock(); }
    renderAll();
  }
  function checkpoint(key) {
    var now = Date.now();
    if (key && key === lastCk.key && now - lastCk.t < 700) { lastCk.t = now; return; }
    lastCk = { key: key || '', t: now };
    undoStack.push(snap());
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
    syncUndo();
  }
  function doUndo() {
    if (!undoStack.length) { say('Nada pra desfazer.'); return; }
    redoStack.push(snap());
    restore(undoStack.pop());
    lastCk = { key: '', t: 0 };
    syncUndo();
    say('Desfeito.');
  }
  function doRedo() {
    if (!redoStack.length) { say('Nada pra refazer.'); return; }
    undoStack.push(snap());
    restore(redoStack.pop());
    lastCk = { key: '', t: 0 };
    syncUndo();
    say('Refeito.');
  }
  function syncUndo() {
    $('btn-undo').disabled = !undoStack.length;
    $('btn-redo').disabled = !redoStack.length;
  }

  // Layers
  function mk(o) {
    return {
      id: ++uid, key: o.key || Seq.nid('s'), name: o.name, tag: o.tag, type: o.type, src: o.src || null, path: o.path || null, test: !!o.test,
      w: o.w, h: o.h, q: o.q, text: o.text || null, fx: o.fx || null,
      mask: o.mask || [[0, 0], [1, 0], [1, 1], [0, 1]],
      cuts: Array.isArray(o.cuts) ? JSON.parse(JSON.stringify(o.cuts)) : [],
      opacity: o.opacity == null ? 1 : o.opacity,
      visible: o.visible !== false, locked: !!o.locked, flipX: !!o.flipX, flipY: !!o.flipY, rot: o.rot || 0, extras: o.extras || [], selItem: o.selItem || null, pristine: o.pristine !== false,
      bright: o.bright == null ? 100 : o.bright, contrast: o.contrast == null ? 100 : o.contrast,
      speed: o.speed || 1, blend: o.blend || 'normal',
      radius: o.radius || 0, feather: o.feather || 0, motion: o.motion || 'none', motionAmt: o.motionAmt == null ? 50 : o.motionAmt, sat: o.sat == null ? 100 : o.sat, hue: o.hue || 0, blur: o.blur || 0, cycle: o.cycle || 0,
      invert: !!o.invert, mono: !!o.mono, audio: o.audio || 0, audioTo: o.audioTo === 'opacity' ? 'opacity' : 'bright',
      mesh: o.mesh && o.mesh.n ? JSON.parse(JSON.stringify(o.mesh)) : { on: false, n: 4, off: [] }
    };
  }
  function addSurface(o) {
    checkpoint();
    var s = mk(o);
    state.surfaces.push(s);
    state.sel = s.id;
    renderAll();
    return s;
  }
  function removeSurface(id) {
    var i;
    for (i = 0; i < state.surfaces.length; i++) if (state.surfaces[i].id === id) break;
    if (i === state.surfaces.length) return;
    checkpoint();
    state.surfaces.splice(i, 1);
    if (state.solo === id) state.solo = null;
    if (state.sel === id) {
      var next = state.surfaces[Math.min(i, state.surfaces.length - 1)];
      state.sel = next ? next.id : null;
    }
    renderAll();
  }
  function moveLayer(id, dir) {
    var i;
    for (i = 0; i < state.surfaces.length; i++) if (state.surfaces[i].id === id) break;
    var j = i + dir;
    if (i === state.surfaces.length || j < 0 || j >= state.surfaces.length) return;
    checkpoint();
    var t = state.surfaces[i]; state.surfaces[i] = state.surfaces[j]; state.surfaces[j] = t;
    renderAll();
  }
  function select(id) {
    state.sel = id;
    renderList(); renderOverlay(); syncControls();
  }
  function dupLayer() {
    var s = sel();
    if (!s) return;
    checkpoint();
    var c = cloneS(s);
    c.id = ++uid;
    c.key = Seq.nid('s');
    c.name = s.name + ' cópia';
    var idmap = {};
    (c.extras || []).forEach(function (x) { var n = 'x' + (++uid); idmap[x.id] = n; x.id = n; });
    c.selItem = idmap[s.selItem] || null;
    c.q = c.q.map(function (p) { return [p[0] + 0.03, p[1] + 0.03]; });
    var i = state.surfaces.indexOf(s);
    state.surfaces.splice(i + 1, 0, c);
    state.sel = c.id;
    renderAll();
  }

  var GRID_COLS = ['#a8e6ff', '#ff6bd5', '#8dff6b', '#ffc24d', '#b38cff'];
  function gridItem(n) {
    if (!(Renderer.FX_KINDS || []).some(function (k) { return k.id === 'gradeneon'; })) return null;
    var id = 'x' + (++uid);
    return { id: id, type: 'fx', name: 'Grade neon', tag: 'GRADE', placeholder: true, visible: true, opacity: 1, fit: 'fill', fx: { kind: 'gradeneon', color: GRID_COLS[n % GRID_COLS.length], speed: 1, scale: 1 } };
  }
  function newBox() {
    var g0 = gridItem(state.surfaces.length);
    var s = addSurface({ name: 'Superfície ' + (state.surfaces.length + 1), tag: 'SUPERFÍCIE', type: 'box', w: 1600, h: 900, q: fitQ(16 / 9, state.surfaces.length), extras: g0 ? [g0] : [], selItem: g0 ? g0.id : null });
    say('Superfície criada com a grade neon. Arraste os cantos pra encaixar, depois coloque seu conteúdo (a grade some sozinha).');
    return s;
  }
  // Muda a proporção da superfície. Remonta os cantos como um retângulo dentro da área atual.
  function setAspect(s, aw, ah) {
    var ar = aw / ah, A = outRatio, i;
    if (ar >= 1) { s.w = 1600; s.h = Math.round(1600 / ar); } else { s.h = 1600; s.w = Math.round(1600 * ar); }
    var minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    s.q.forEach(function (p) {
      minx = Math.min(minx, p[0] * A); maxx = Math.max(maxx, p[0] * A);
      miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]);
    });
    var bw = maxx - minx, bh = maxy - miny, cx = (minx + maxx) / 2, cy = (miny + maxy) / 2, nw, nh;
    if (bw / bh > ar) { nh = bh; nw = bh * ar; } else { nw = bw; nh = bw / ar; }
    s.q = [[(cx - nw / 2) / A, cy - nh / 2], [(cx + nw / 2) / A, cy - nh / 2], [(cx + nw / 2) / A, cy + nh / 2], [(cx - nw / 2) / A, cy + nh / 2]];
    s.mask = [[0, 0], [1, 0], [1, 1], [0, 1]];
    s.flipX = false; s.flipY = false; s.rot = 0;
  }
  // Coloca um item (mídia, texto, efeito) dentro da superfície selecionada. Sem superfície, cria uma vazia antes.
  function addItem(it) {
    if (tl.on && window.TimelineUI && !it.placeholder && window.TimelineUI.intercept(it)) { delete it.dims; delete it.duration; return it; }
    delete it.duration;
    var s = sel(), dims = it.dims;
    delete it.dims;
    if (!s) s = newBox(); else checkpoint();
    it.id = 'x' + (++uid);
    it.visible = true;
    it.opacity = 1;
    it.fit = it.fit || 'fill';
    if (it.type === 'media' && it.kind === 'video') it.speed = 1;
    if (it.type === 'media' && it.cover === undefined) it.cover = true;
    var hadGrid = s.extras.some(function (x) { return x.placeholder; });
    if (!it.placeholder) s.extras = s.extras.filter(function (x) { return !x.placeholder; });
    if (!s.extras.length && (s.pristine !== false || hadGrid) && dims) setAspect(s, dims[0], dims[1]);
    s.extras.push(it);
    s.selItem = it.id;
    renderAll();
    return it;
  }
  function addTest() {
    addItem({ type: 'media', kind: 'img', test: true, src: testPattern(), name: 'Padrão de teste', tag: 'TESTE' });
  }
  function addCam() {
    addItem({ type: 'media', kind: 'cam', name: 'Câmera ao vivo', tag: 'CÂMERA', src: null, cover: true });
    say('Câmera ao vivo adicionada. Se pedir permissão, libere.');
  }
  function addText() {
    addItem({
      type: 'text', name: 'Seu texto', tag: 'TEXTO',
      text: { value: 'Seu texto', size: 220, color: '#ffffff', font: Renderer.DEFAULT_FONT, bold: true, align: 'center', outline: 0, outlineColor: '#000000', shadow: false, anim: 'none', speed: 1 }
    });
    say('Texto adicionado dentro da superfície. Edite no painel.');
  }
  var recents = [];
  try { recents = JSON.parse(localStorage.getItem('lenzi-recent') || '[]') || []; } catch (e) { recents = []; }
  function noteRecent(id) {
    var i = recents.indexOf(id); if (i > -1) recents.splice(i, 1);
    recents.unshift(id); recents = recents.slice(0, 24);
    try { localStorage.setItem('lenzi-recent', JSON.stringify(recents)); } catch (e) {}
  }
  function addFx(kind, color) {
    var k = FX_KINDS.filter(function (x) { return x.id === kind; })[0];
    if (!k) return;
    addItem({ type: 'fx', name: k.name, tag: 'EFEITO', fx: { kind: k.id, color: color || '#ff4fa3', speed: 1, scale: 1 } });
    noteRecent(k.id);
    say(k.name + ' adicionado dentro da superfície.');
  }
  function addMedia(path) {
    var k = kindOf(path);
    if (!k) { say('Formato não suportado: ' + baseName(path) + '.'); return; }
    if (k.type === 'audio') {
      if (window.TimelineUI) window.TimelineUI.importAudio(path); else say('Áudio só funciona no Modo timeline.');
      return;
    }
    var url = toUrl(path);
    var el = document.createElement(k.type === 'video' ? 'video' : 'img');
    var done = false;
    function ok(w, h, dur) {
      if (done) return;
      done = true;
      el.removeAttribute('src');
      addItem({ type: 'media', kind: k.type === 'video' ? 'video' : 'img', name: baseName(path), tag: k.tag, path: path, src: url, dims: [w, h], duration: dur });
      say(baseName(path) + ' adicionado dentro da superfície.');
    }
    el.onerror = function () {
      if (done) return;
      done = true;
      say(k.type === 'video'
        ? 'Não consegui abrir ' + baseName(path) + '. Se for MOV em ProRes ou HEVC, exporte em MP4 H.264.'
        : 'Não consegui abrir ' + baseName(path) + '.');
    };
    if (k.type === 'video') {
      el.muted = true; el.preload = 'metadata';
      el.onloadedmetadata = function () { ok(el.videoWidth || 1280, el.videoHeight || 720, el.duration); };
    } else {
      el.onload = function () { ok(el.naturalWidth || 800, el.naturalHeight || 600); };
    }
    el.src = url;
  }

  // Cenas
  function switchScene(i) {
    if (i < 0 || i >= state.scenes.length || i === state.scene) return;
    syncScene();
    state.scene = i;
    var sc = state.scenes[i];
    state.surfaces = sc.surfaces;
    state.sel = sc.sel;
    state.solo = null;
    renderAll();
  }
  function addScene(dup) {
    checkpoint();
    syncScene();
    var cur = state.scenes[state.scene];
    var surfaces = dup ? cur.surfaces.map(function (s) { var c = cloneS(s); c.id = ++uid; c.key = Seq.nid('s'); return c; }) : [];
    state.scenes.push({ id: newSceneId(), name: 'Cena ' + (state.scenes.length + 1), surfaces: surfaces, sel: null });
    state.scene = state.scenes.length - 1;
    state.surfaces = surfaces;
    state.sel = surfaces.length ? surfaces[surfaces.length - 1].id : null;
    state.solo = null;
    renderAll();
  }
  function removeScene() {
    if (state.scenes.length <= 1) { say('Precisa ficar pelo menos uma cena.'); return; }
    checkpoint();
    state.scenes.splice(state.scene, 1);
    state.scene = Math.min(state.scene, state.scenes.length - 1);
    var sc = state.scenes[state.scene];
    state.surfaces = sc.surfaces;
    state.sel = sc.sel;
    state.solo = null;
    renderAll();
  }
  function renderScenes() {
    var box = $('scenes');
    box.textContent = '';
    state.scenes.forEach(function (sc, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn small' + (i === state.scene ? ' on' : '');
      b.textContent = (i + 1) + (i < 9 ? '' : '');
      b.title = sc.name;
      b.setAttribute('aria-label', sc.name);
      b.setAttribute('aria-pressed', i === state.scene ? 'true' : 'false');
      b.addEventListener('click', function () { switchScene(i); });
      box.appendChild(b);
    });
    renderLive();
  }

  function renderList() {
    listEl.textContent = '';
    if (!state.surfaces.length) {
      var li0 = document.createElement('li');
      li0.className = 'empty';
      li0.textContent = 'Nenhuma superfície nesta cena. Clique em Nova superfície.';
      listEl.appendChild(li0);
      return;
    }
    var n = state.surfaces.length;
    state.surfaces.slice().reverse().forEach(function (s, ri) {
      var idx = n - 1 - ri;
      var li = document.createElement('li');
      li.className = 'item';
      li.setAttribute('data-sel', s.id === state.sel ? 'true' : 'false');
      li.setAttribute('data-off', showOf(s) ? 'false' : 'true');
      makeSortable(li, state.surfaces, idx, 'surf', function () { renderAll(); });

      var eye = document.createElement('button');
      eye.type = 'button'; eye.className = 'mini' + (s.visible ? ' on' : '');
      eye.textContent = s.visible ? '●' : '○';
      eye.setAttribute('aria-label', (s.visible ? 'Desligar ' : 'Ligar ') + s.name);
      eye.setAttribute('aria-pressed', s.visible ? 'true' : 'false');
      eye.addEventListener('click', function () {
        checkpoint();
        s.visible = !s.visible;
        renderList(); refresh();
      });

      var main = document.createElement('button');
      main.type = 'button'; main.className = 'item-main';
      main.setAttribute('aria-pressed', s.id === state.sel ? 'true' : 'false');
      var nm = document.createElement('span'); nm.className = 'name'; nm.textContent = s.name;
      var tg = document.createElement('span'); tg.className = 'tag';
      tg.textContent = (s.extras.length ? s.extras.length + (s.extras.length === 1 ? ' item' : ' itens') : 'vazia') + (s.locked ? ' · travada' : '') + (state.solo === s.id ? ' · solo' : '');
      main.appendChild(nm); main.appendChild(tg);
      main.addEventListener('click', function () { select(s.id); });

      var up = document.createElement('button');
      up.type = 'button'; up.className = 'mini'; up.textContent = '↑';
      up.setAttribute('aria-label', 'Subir ' + s.name); up.disabled = idx === n - 1;
      up.addEventListener('click', function () { moveLayer(s.id, 1); });

      var dn = document.createElement('button');
      dn.type = 'button'; dn.className = 'mini'; dn.textContent = '↓';
      dn.setAttribute('aria-label', 'Descer ' + s.name); dn.disabled = idx === 0;
      dn.addEventListener('click', function () { moveLayer(s.id, -1); });

      var rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'mini'; rm.textContent = '×';
      rm.setAttribute('aria-label', 'Remover ' + s.name);
      rm.addEventListener('click', function () { removeSurface(s.id); });

      li.appendChild(eye); li.appendChild(thumbOf(s)); li.appendChild(main); li.appendChild(up); li.appendChild(dn); li.appendChild(rm);
      listEl.appendChild(li);
    });
  }

  function renderOverlayBase() {
    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
    overlay.classList.toggle('off', !state.guides);
    $('badge').hidden = !state.blackout;
    if (!state.guides) return;
    state.surfaces.forEach(function (s) {
      overlay.appendChild(svgEl('polygon', {
        points: outline(s).map(function (p) { return p[0] + ',' + p[1]; }).join(' '),
        'class': s.id === state.sel ? 'q-sel' : (showOf(s) ? 'q-other' : 'q-hidden')
      }));
    });
    state.surfaces.forEach(function (c) {
      if (c.extras.length || !showOf(c)) return;
      if (typeof tl !== 'undefined' && tl && tl.on && tl.seq && tl.seq.tracks.some(function (t) { return t.surfaceId === c.key && t.clips && t.clips.length; })) return;   // tem faixa na timeline: não está vazia
      var P = px(c), cx = 0, cy = 0;
      P.forEach(function (p) { cx += p[0] / P.length; cy += p[1] / P.length; });
      var t = svgEl('text', { x: cx, y: cy, 'class': 'q-empty' });
      t.textContent = c.name + ' (vazia)';
      overlay.appendChild(t);
    });
    if (state.mode === 'clip' && window.TimelineUI) { window.TimelineUI.drawClipOverlay(); return; }
    var s = sel();
    if (!s || isLocked(s)) return;
    if (state.mode === 'mesh' && s.mesh && s.mesh.on) {
      var W0 = stage.clientWidth, H0 = stage.clientHeight, mp = M.meshPoints(s), n1 = s.mesh.n + 1, a, b;
      for (a = 0; a < n1; a++) {
        var row = [], col = [];
        for (b = 0; b < n1; b++) {
          row.push((mp[a * n1 + b][0] * W0) + ',' + (mp[a * n1 + b][1] * H0));
          col.push((mp[b * n1 + a][0] * W0) + ',' + (mp[b * n1 + a][1] * H0));
        }
        overlay.appendChild(svgEl('polyline', { points: row.join(' '), 'class': 'q-mesh' }));
        overlay.appendChild(svgEl('polyline', { points: col.join(' '), 'class': 'q-mesh' }));
      }
      var coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
      mp.forEach(function (p, i) {
        overlay.appendChild(svgEl('circle', { cx: p[0] * W0, cy: p[1] * H0, r: coarse ? 13 : 6, 'class': 'h-mesh', 'data-k': 'g', 'data-i': i }));
      });
    } else if (state.mode === 'xform') {
      var XP = px(s), coarseX = window.matchMedia && matchMedia('(pointer:coarse)').matches, hr = coarseX ? 11 : 7, ci, xc = [0, 0];
      XP.forEach(function (p) { xc[0] += p[0] / 4; xc[1] += p[1] / 4; });
      overlay.appendChild(svgEl('polygon', { points: XP.map(function (p) { return p[0] + ',' + p[1]; }).join(' '), 'class': 'q-x' }));
      for (ci = 0; ci < 4; ci++) {
        var ea = XP[ci], eb = XP[(ci + 1) % 4], em = [(ea[0] + eb[0]) / 2, (ea[1] + eb[1]) / 2], ang = Math.atan2(eb[1] - ea[1], eb[0] - ea[0]) * 180 / Math.PI, pw = coarseX ? 26 : 18, ph = coarseX ? 12 : 8;
        overlay.appendChild(svgEl('rect', { x: em[0] - pw / 2, y: em[1] - ph / 2, width: pw, height: ph, rx: ph / 2, transform: 'rotate(' + ang + ' ' + em[0] + ' ' + em[1] + ')', 'class': 'h-xe', 'data-k': 'xe', 'data-i': ci }));
      }
      XP.forEach(function (p, i) { overlay.appendChild(svgEl('circle', { cx: p[0], cy: p[1], r: hr, 'class': 'h-xc', 'data-k': 'xc', 'data-i': i })); });
      var t0 = XP[0], t1 = XP[1], tm = [(t0[0] + t1[0]) / 2, (t0[1] + t1[1]) / 2], nx0 = tm[0] - xc[0], ny0 = tm[1] - xc[1], nl = Math.hypot(nx0, ny0) || 1, rh = [tm[0] + nx0 / nl * 34, tm[1] + ny0 / nl * 34];
      overlay.appendChild(svgEl('line', { x1: tm[0], y1: tm[1], x2: rh[0], y2: rh[1], 'class': 'q-x' }));
      overlay.appendChild(svgEl('circle', { cx: rh[0], cy: rh[1], r: coarseX ? 15 : 12, 'class': 'h-xr', 'data-k': 'xr' }));
      var gl = svgEl('text', { x: rh[0], y: rh[1], 'class': 'h-xg' }); gl.textContent = '\u21bb'; overlay.appendChild(gl);
    } else if (state.mode === 'corners' || state.mode === 'mesh') {
      px(s).forEach(function (p, i) {
        overlay.appendChild(svgEl('circle', { cx: p[0], cy: p[1], r: (window.matchMedia && matchMedia('(pointer:coarse)').matches ? 16 : 9), 'class': 'h-corner', 'data-k': 'c', 'data-i': i }));
        var t = svgEl('text', { x: p[0] + 13, y: p[1] - 11, 'class': 'h-label' });
        t.textContent = String(i + 1);
        overlay.appendChild(t);
      });
    } else {
      var H = getH(s);
      if (!H) return;
      var pts = s.mask.map(function (m) { return M.proj(H, m[0] * s.w, m[1] * s.h); });
      overlay.appendChild(svgEl('polygon', { points: pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' '), 'class': 'm-poly' }));
      pts.forEach(function (p, i) {
        overlay.appendChild(svgEl('rect', { x: p[0] - 6, y: p[1] - 6, width: 12, height: 12, 'class': 'h-mask', 'data-k': 'm', 'data-i': i, transform: 'rotate(45 ' + p[0] + ' ' + p[1] + ')' }));
      });
      var cs = selCut(s);
      if (cs) {
        var cp = cs.pts.map(function (m) { return M.proj(H, m[0] * s.w, m[1] * s.h); });
        overlay.appendChild(svgEl('polygon', { points: cp.map(function (p) { return p[0] + ',' + p[1]; }).join(' '), 'class': 'm-poly cut' }));
        cp.forEach(function (p, i) {
          overlay.appendChild(svgEl('circle', { cx: p[0], cy: p[1], r: 7, 'class': 'h-cutpt', 'data-k': 'mc', 'data-i': i }));
        });
      }
    }
  }

  function renderOverlay() { renderOverlayBase(); placeToolbar(); }

  // Barra flutuante (estilo Canva) acima da superfície selecionada
  var ftool = $('ftool');
  // Zoom da visualização: roda do mouse com Cmd/Ctrl (ou pinça no trackpad) aproxima, roda comum arrasta quando aproximado, botões + − e 1:1
  var vz = { z: 1, x: 0, y: 0 }, foff = { x: 0, y: 0 };
  try { var fo = JSON.parse(localStorage.getItem('lenzi-ftool-off') || 'null'); if (fo && isFinite(fo.x) && isFinite(fo.y)) foff = { x: fo.x, y: fo.y }; } catch (e) {}
  function applyView() {
    var W0 = stage.clientWidth, H0 = stage.clientHeight;
    vz.z = clamp(vz.z, 1, 6); vz.x = clamp(vz.x, W0 * (1 - vz.z), 0); vz.y = clamp(vz.y, H0 * (1 - vz.z), 0);
    stage.style.transformOrigin = '0 0';
    stage.style.transform = vz.z === 1 && !vz.x && !vz.y ? '' : 'translate(' + vz.x + 'px,' + vz.y + 'px) scale(' + vz.z + ')';
    var zl = $('zoom-lbl'); if (zl) zl.textContent = Math.round(vz.z * 100) + '%';
    try { renderOverlay(); } catch (e) {}
  }
  function zoomBy(f, clientX, clientY) {
    var r = stage.getBoundingClientRect(), k = vz.z, px, py;
    if (clientX == null) { clientX = r.left + r.width / 2; clientY = r.top + r.height / 2; }
    px = (clientX - r.left) / k; py = (clientY - r.top) / k;
    var z2 = clamp(vz.z * f, 1, 6);
    vz.x += px * (vz.z - z2); vz.y += py * (vz.z - z2); vz.z = z2; applyView();
  }
  (function wireZoom() {
    var wrapEl = stage.parentNode;
    wrapEl.addEventListener('wheel', function (e) {
      if (e.target.closest && e.target.closest('.panel,.ftool,.zoombar')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) { e.preventDefault(); zoomBy(Math.exp(-e.deltaY * (e.ctrlKey && !e.metaKey ? 0.012 : 0.004)), e.clientX, e.clientY); }
      else if (vz.z > 1) { e.preventDefault(); vz.x -= e.deltaX; vz.y -= e.deltaY; applyView(); }
    }, { passive: false });
    var zb = $('zoombar');
    if (zb) zb.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button'); if (!b) return;
      var a = b.getAttribute('data-z');
      if (a === 'in') zoomBy(1.4); else if (a === 'out') zoomBy(1 / 1.4); else { vz.z = 1; vz.x = 0; vz.y = 0; applyView(); }
    });
    window.addEventListener('resize', function () { applyView(); });
  })();
  function placeToolbar() {
    var s = sel();
    if (!s || !state.guides || drag) { ftool.hidden = true; ftool.classList.toggle('drag', !!drag); return; }
    ftool.classList.remove('drag');
    ftool.hidden = false;
    var P = outline(s), W = stage.clientWidth, H = stage.clientHeight, minY = Infinity, maxY = -Infinity, cx = 0, i;
    P.forEach(function (p) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; cx += p[0] / P.length; });
    cx = cx * vz.z + vz.x; minY = minY * vz.z + vz.y; maxY = maxY * vz.z + vz.y;
    var coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches, hh = coarse ? 52 : 44, wrap = ftool.parentNode, WW = wrap.clientWidth, WH = wrap.clientHeight, ox = stage.offsetLeft, oy = stage.offsetTop;
    var y = minY + oy - hh - (state.mode === 'xform' ? 34 : 8);
    if (y < 4) y = Math.min(maxY + oy + (state.mode === 'xform' ? 16 : 10), WH - hh - 4);
    if (y < 4) y = 4;
    var half = (ftool.offsetWidth || 220) / 2;
    ftool.style.left = clamp(clamp(cx + ox, half + 4, Math.max(half + 4, WW - half - 4)) + foff.x, half + 4, Math.max(half + 4, WW - half - 4)) + 'px';
    ftool.style.top = clamp(y + foff.y, 4, Math.max(4, WH - hh - 4)) + 'px';
    var lk = ftool.querySelector('[data-a="lock"]');
    lk.classList.toggle('on', !!s.locked); lk.title = s.locked ? 'Destravar' : 'Travar';
    for (i = 0; i < ftool.children.length; i++) { var b = ftool.children[i]; b.style.display = (s.locked && b.getAttribute('data-a') !== 'lock' && b.getAttribute('data-a') !== 'del' && !b.classList.contains('fgrip')) ? 'none' : ''; }
  }
  ftool.addEventListener('pointerdown', function (e) {
    e.stopPropagation();
    var g = e.target.closest && e.target.closest('.fgrip'); if (!g) return;
    e.preventDefault();
    var x0 = e.clientX, y0 = e.clientY, f0 = { x: foff.x, y: foff.y };
    function mv(ev) { foff.x = f0.x + ev.clientX - x0; foff.y = f0.y + ev.clientY - y0; placeToolbar(); }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); try { localStorage.setItem('lenzi-ftool-off', JSON.stringify(foff)); } catch (er) {} }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
  ftool.addEventListener('dblclick', function (e) { if (e.target.closest && e.target.closest('.fgrip')) { foff = { x: 0, y: 0 }; try { localStorage.removeItem('lenzi-ftool-off'); } catch (er) {} placeToolbar(); } });
  ftool.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button');
    if (!b) return;
    var s = sel(), a = b.getAttribute('data-a');
    if (!s) return;
    if (a === 'dup') $('btn-dup').click();
    else if (a === 'fx') $('btn-flipx').click();
    else if (a === 'fy') $('btn-flipy').click();
    else if (a === 'rot') $('btn-rot90').click();
    else if (a === 'lock') $('btn-lock').click();
    else if (a === 'del') removeSurface(s.id);
  });

  // Abas do painel e gaveta no celular
  var panel = document.querySelector('.panel'), ptabs = $('ptabs'), liveGuides = true;
  function setTab(t, open) {
    var ok = ['saida', 'cenas', 'camadas', 'galeria', 'ajustes', 'timeline', 'ia', 'ilusao', 'arvore', 'live'];
    if (ok.indexOf(t) < 0) t = 'camadas';
    var prevTab = panel.getAttribute('data-active');
    panel.setAttribute('data-active', t);
    if (t === 'live' && prevTab !== 'live') { liveGuides = state.guides; state.guides = false; try { renderOverlay(); syncControls(); } catch (e) {} }
    else if (t !== 'live' && prevTab === 'live') { state.guides = liveGuides; try { renderOverlay(); syncControls(); } catch (e) {} }
    [].forEach.call(panel.querySelectorAll('.phead [data-go]'), function (b) { var on = b.getAttribute('data-go') === t; b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    try { localStorage.setItem('lenzi-tab', t === 'live' ? 'camadas' : t); } catch (e) {}
    panel.scrollTop = 0;
    if (open && sheetIsMin()) setSheet('mid');
    if (t === 'galeria') { try { renderGallery(); } catch (e) {} }
  }
  [].forEach.call(panel.querySelectorAll('.phead [data-go]'), function (b) { b.addEventListener('click', function () { setTab(b.getAttribute('data-go'), true); }); });
  var mobileMQ = window.matchMedia ? matchMedia('(max-width:820px) and (orientation:portrait)') : { matches: false };
  function sheetIsMin() { return mobileMQ.matches && panel.getAttribute('data-sheet') === 'min'; }
  function setSheet(n) {
    panel.setAttribute('data-sheet', n); panel.style.height = '';
    document.documentElement.setAttribute('data-sheet', n);
    try { localStorage.setItem('lenzi-sheet', n); } catch (e) {}
    setTimeout(function () { try { rend.sync(view()); renderOverlay(); } catch (e) {} }, 60);
  }
  (function initSheet() {
    var t0 = 'camadas', s0 = 'mid';
    try { t0 = localStorage.getItem('lenzi-tab') || 'camadas'; s0 = localStorage.getItem('lenzi-sheet') || 'mid'; } catch (e) {}
    if (['min', 'mid', 'max'].indexOf(s0) < 0) s0 = 'mid';
    setTab(t0, false); setSheet(s0);
    var grip = $('sheet-grip'), g = null;
    grip.addEventListener('click', function () { if (g && g.moved) return; setSheet(panel.getAttribute('data-sheet') === 'min' ? 'mid' : (panel.getAttribute('data-sheet') === 'mid' ? 'max' : 'min')); });
    grip.addEventListener('pointerdown', function (e) {
      if (!mobileMQ.matches) return;
      g = { y0: e.clientY, h0: panel.getBoundingClientRect().height, moved: false };
      try { grip.setPointerCapture(e.pointerId); } catch (err) {}
    });
    grip.addEventListener('pointermove', function (e) {
      if (!g) return;
      var dy = g.y0 - e.clientY;
      if (Math.abs(dy) > 6) g.moved = true;
      if (g.moved) { var nh = clamp(g.h0 + dy, 90, window.innerHeight * 0.9); panel.style.height = nh + 'px'; }
    });
    function end() {
      if (!g) return;
      if (g.moved) {
        var hpx = panel.getBoundingClientRect().height, vh = window.innerHeight, opts = [['min', 96], ['mid', vh * 0.44], ['max', vh * 0.82]], best = 'mid', bd = 1e9;
        opts.forEach(function (o) { var d = Math.abs(o[1] - hpx); if (d < bd) { bd = d; best = o[0]; } });
        setSheet(best);
      }
      setTimeout(function () { g = null; }, 0);
    }
    grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
  })();


  // Miniatura da superfície na lista
  var thumbMedia = {};
  function thumbOf(s) {
    var cv = document.createElement('canvas'), g = cv.getContext('2d'), it = s.extras && s.extras[0];
    cv.width = 112; cv.height = 64; cv.className = 'thumb'; cv.setAttribute('aria-hidden', 'true');
    g.fillStyle = '#000'; g.fillRect(0, 0, 112, 64);
    if (!it) return cv;
    try {
      if (it.type === 'fx') { Renderer.drawFx(cv, { w: 112, h: 64, fx: it.fx }, 1800); }
      else if (it.type === 'text') { g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Aa', 56, 34); }
      else if (it.type === 'media' && it.src && it.kind !== 'cam') {
        var key = it.src, ent = thumbMedia[key];
        if (!ent) {
          ent = thumbMedia[key] = { ready: false, el: null };
          if (it.kind === 'video') {
            var v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.playsInline = true; v.src = key;
            v.addEventListener('loadeddata', function () { try { v.currentTime = 0.1; } catch (e) {} });
            v.addEventListener('seeked', function () { ent.ready = true; ent.w = v.videoWidth; ent.h = v.videoHeight; renderList(); }, { once: true });
            ent.el = v;
          } else {
            var im = new Image(); im.onload = function () { ent.ready = true; ent.w = im.naturalWidth; ent.h = im.naturalHeight; renderList(); }; im.src = key; ent.el = im;
          }
        } else if (ent.ready && ent.w && ent.h) {
          var r = Math.max(112 / ent.w, 64 / ent.h);
          g.drawImage(ent.el, (112 - ent.w * r) / 2, (64 - ent.h * r) / 2, ent.w * r, ent.h * r);
        }
      }
    } catch (e) {}
    return cv;
  }

  // Posição e tamanho em pixels da tela de saída
  function outW() {
    var sv = $('display') && $('display').value, d = null;
    (displays || []).forEach(function (x) { if (String(x.id) === String(sv)) d = x; });
    return d && d.bounds ? d.bounds.width : 1920;
  }
  function outH() { return outW() * stage.clientHeight / Math.max(1, stage.clientWidth); }
  function nums(s) {
    var OW = outW(), OH = outH(), xs = s.q.map(function (p) { return p[0] * OW; }), ys = s.q.map(function (p) { return p[1] * OH; });
    return {
      x: Math.min.apply(null, xs), y: Math.min.apply(null, ys),
      w: Math.hypot((s.q[1][0] - s.q[0][0]) * OW, (s.q[1][1] - s.q[0][1]) * OH),
      h: Math.hypot((s.q[3][0] - s.q[0][0]) * OW, (s.q[3][1] - s.q[0][1]) * OH),
      a: Math.atan2((s.q[1][1] - s.q[0][1]) * OH, (s.q[1][0] - s.q[0][0]) * OW) * 180 / Math.PI
    };
  }
  function syncNums(s) {
    var n = nums(s), map = { 'n-x': n.x, 'n-y': n.y, 'n-w': n.w, 'n-h': n.h, 'n-a': n.a };
    for (var id in map) if (document.activeElement !== $(id)) $(id).value = String(Math.round(map[id]));
  }
  function scaleAlong(s, from, to, f) {
    var OW = outW(), OH = outH(), q0 = s.q[0], ux = (s.q[to][0] - s.q[from][0]) * OW, uy = (s.q[to][1] - s.q[from][1]) * OH, ul = Math.hypot(ux, uy) || 1;
    ux /= ul; uy /= ul;
    s.q = s.q.map(function (p) {
      var X = p[0] * OW, Y = p[1] * OH, d = (X - q0[0] * OW) * ux + (Y - q0[1] * OH) * uy;
      return [(X + ux * d * (f - 1)) / OW, (Y + uy * d * (f - 1)) / OH];
    });
    if (s.mesh && s.mesh.on) s.mesh.off = s.mesh.off.map(function (o) {
      var ox = o[0] * OW, oy = o[1] * OH, d = ox * ux + oy * uy;
      return [(ox + ux * d * (f - 1)) / OW, (oy + uy * d * (f - 1)) / OH];
    });
  }
  function applyNum(id, v) {
    var s = sel();
    if (!s || isLocked(s) || !isFinite(v)) { syncControls(); return; }
    var n = nums(s), OW = outW(), OH = outH();
    checkpoint(); s.pristine = false;
    if (id === 'n-x' || id === 'n-y') {
      var dx = id === 'n-x' ? (v - n.x) / OW : 0, dy = id === 'n-y' ? (v - n.y) / OH : 0;
      s.q = s.q.map(function (p) { return [p[0] + dx, p[1] + dy]; });
    } else if (id === 'n-w') { if (v >= 4 && n.w > 0) scaleAlong(s, 0, 1, v / n.w); }
    else if (id === 'n-h') { if (v >= 4 && n.h > 0) scaleAlong(s, 0, 3, v / n.h); }
    else if (id === 'n-a') {
      var da = (v - n.a) * Math.PI / 180, co = Math.cos(da), si = Math.sin(da), cx = 0, cy = 0;
      s.q.forEach(function (p) { cx += p[0] * OW / 4; cy += p[1] * OH / 4; });
      s.q = s.q.map(function (p) { var ox = p[0] * OW - cx, oy = p[1] * OH - cy; return [(cx + ox * co - oy * si) / OW, (cy + ox * si + oy * co) / OH]; });
      if (s.mesh && s.mesh.on) s.mesh.off = s.mesh.off.map(function (o) { var ox = o[0] * OW, oy = o[1] * OH; return [(ox * co - oy * si) / OW, (ox * si + oy * co) / OH]; });
    }
    refresh(); syncControls();
  }
  ['n-x', 'n-y', 'n-w', 'n-h', 'n-a'].forEach(function (id) {
    $(id).addEventListener('change', function (e) { applyNum(id, parseFloat(e.target.value)); });
    $(id).addEventListener('keydown', function (e) { if (e.key === 'Enter') e.target.blur(); });
  });

  // Camada: frente e trás
  function layerTo(top) {
    var s = sel();
    if (!s) return;
    checkpoint();
    var i = state.surfaces.indexOf(s);
    state.surfaces.splice(i, 1);
    if (top) state.surfaces.push(s); else state.surfaces.unshift(s);
    renderAll();
  }

  // Menu de clique direito
  var ctx = $('ctx');
  function closeCtx() { ctx.hidden = true; }
  function openCtx(x, y) {
    var s = sel();
    if (!s) return;
    var acts = s.locked
      ? [['Destravar', function () { $('btn-lock').click(); }], ['Apagar', function () { removeSurface(s.id); }]]
      : [['Duplicar', function () { $('btn-dup').click(); }], ['Espelhar na horizontal', function () { $('btn-flipx').click(); }], ['Espelhar na vertical', function () { $('btn-flipy').click(); }],
        ['Girar 90°', function () { $('btn-rot90').click(); }], ['Trazer para a frente', function () { layerTo(true); }], ['Enviar para trás', function () { layerTo(false); }],
        ['Travar', function () { $('btn-lock').click(); }], null, ['Apagar', function () { removeSurface(s.id); }]];
    ctx.textContent = '';
    acts.forEach(function (a) {
      if (!a) { ctx.appendChild(document.createElement('hr')); return; }
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.textContent = a[0];
      b.addEventListener('click', function () { closeCtx(); a[1](); });
      ctx.appendChild(b);
    });
    ctx.hidden = false;
    ctx.style.left = Math.max(4, Math.min(x, window.innerWidth - ctx.offsetWidth - 8)) + 'px';
    ctx.style.top = Math.max(4, Math.min(y, window.innerHeight - ctx.offsetHeight - 8)) + 'px';
  }
  document.addEventListener('pointerdown', function (e) { if (!ctx.hidden && !ctx.contains(e.target)) closeCtx(); }, true);

  // Ao vivo
  function renderLive() {
    var box = $('live-scenes');
    if (!box) return;
    box.textContent = '';
    state.scenes.forEach(function (sc, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn' + (i === state.scene ? ' primary' : '');
      b.textContent = String(i + 1); b.title = sc.name; b.setAttribute('aria-label', sc.name);
      b.setAttribute('aria-pressed', i === state.scene ? 'true' : 'false');
      b.addEventListener('click', function () { switchScene(i); });
      box.appendChild(b);
    });
  }
  $('live-prev').addEventListener('click', function () { switchScene((state.scene - 1 + state.scenes.length) % state.scenes.length); });
  $('live-next').addEventListener('click', function () { switchScene((state.scene + 1) % state.scenes.length); });
  $('live-black').addEventListener('click', function () { toggleBlack(); });
  $('live-out').addEventListener('click', function () { $('btn-out').click(); });
  $('live-master').addEventListener('input', function (e) {
    state.master = +e.target.value; $('master-val').textContent = e.target.value + '%'; $('live-master-val').textContent = e.target.value + '%'; push();
  });

  // Ajuda, atalhos e primeiro uso
  var help = $('help'), tour = $('tour'), tourStep = 0;
  var TOUR = [
    ['Conecte o projetor', 'Ligue o projetor no seu aparelho. Na aba Saída, escolha o monitor do projetor e toque em Enviar pra tela. Só o resultado do mapeamento vai para ele.'],
    ['Crie uma superfície', 'Na aba Camadas, toque em Nova superfície e depois em Mídia, Texto ou Padrão de teste. Na aba Galeria tem mais de 80 animações prontas.'],
    ['Encaixe na parede', 'Arraste os 4 cantos até a parede. Transformar escala e gira como no Canva, Malha serve para superfícies curvas e Máscara recorta a forma. Na aba Ajustes você também digita posição e tamanho.'],
    ['Pronto para o evento', 'Na aba Ao vivo ficam botões grandes para trocar de cena e dar blackout. Aperte ? a qualquer momento para ver os atalhos.']
  ];
  function showTour(i) {
    tourStep = clamp(i, 0, TOUR.length - 1);
    $('tour-n').textContent = 'Passo ' + (tourStep + 1) + ' de ' + TOUR.length;
    $('tour-t').textContent = TOUR[tourStep][0]; $('tour-p').textContent = TOUR[tourStep][1];
    $('tour-back').disabled = tourStep === 0;
    $('tour-next').textContent = tourStep === TOUR.length - 1 ? 'Começar' : 'Próximo';
    tour.hidden = false;
  }
  function endTour() { tour.hidden = true; try { localStorage.setItem('lenzi-onboarded', '1'); } catch (e) {} }
  $('tour-next').addEventListener('click', function () { if (tourStep >= TOUR.length - 1) endTour(); else showTour(tourStep + 1); });
  $('tour-back').addEventListener('click', function () { showTour(tourStep - 1); });
  $('tour-skip').addEventListener('click', endTour);
  $('btn-help').addEventListener('click', function () { help.hidden = false; });
  $('help-close').addEventListener('click', function () { help.hidden = true; });
  $('help-tour').addEventListener('click', function () { help.hidden = true; showTour(0); });
  (function () { var seen = false; try { seen = localStorage.getItem('lenzi-onboarded') === '1'; } catch (e) {} if (!seen) setTimeout(function () { showTour(0); }, 500); })();

  function setRange(id, outId, val, suffix) {
    $(id).value = val;
    $(outId).textContent = val + suffix;
  }

  function syncControls() {
    var s = sel();
    renderCutsSoon();
    ['n-x', 'n-y', 'n-w', 'n-h', 'n-a', 'radius', 'feather', 'motion', 'motion-amt', 'm-xform', 'opacity', 'bright', 'contrast', 'sat', 'hue', 'cycle', 'blur', 'btn-invert', 'btn-mono', 'm-mesh', 'mesh-n', 'mesh-reset', 'mesh-off', 'audio-amt', 'audio-to', 'shape-pick', 'speed', 'reset-corners', 'reset-mask', 'm-corners', 'm-mask',
      'layer-name', 'btn-lock', 'btn-solo', 'btn-dup', 'btn-flipx', 'btn-flipy', 'btn-rot90', 'btn-rotl', 'btn-rotr', 'rot-jog', 'btn-rot-m1', 'btn-rot-p1', 'btn-blend', 'btn-scover', 'aspect'].forEach(function (id) { $(id).disabled = !s; });
    setPressed($('m-corners'), state.mode === 'corners');
    setPressed($('m-mask'), state.mode === 'mask');
    setPressed($('m-xform'), state.mode === 'xform');
    setPressed($('m-mesh'), state.mode === 'mesh');
    var curSc = state.scenes[state.scene];
    if (curSc) $('scene-dur').value = String(curSc.secs || 0);
    setPressed($('m-clip'), state.mode === 'clip');
    if (window.TimelineUI && window.TimelineUI.updateBar) window.TimelineUI.updateBar();
    $('mode-hint').textContent = state.mode === 'clip'
      ? (window.TimelineUI ? window.TimelineUI.toolHint() : 'Edição do clipe. A calibração da superfície não muda.')
      : s && isLocked(s)
      ? (tl.lockCal ? 'Calibração travada pela timeline. Destrave em "Travar calibração" na barra da timeline.' : 'Layer travada. Destrave pra mexer nos cantos.')
      : (state.mode === 'corners'
        ? 'Arraste os 4 cantos até a superfície. Arraste por dentro pra mover a layer inteira. Botão direito e arrastar gira a layer (Shift gira de 15 em 15 graus).'
        : (state.mode === 'xform'
          ? 'Estilo Canva: arraste os cantos brancos pra mudar o tamanho (Alt escala do centro, Shift trava em passos de 5%), as pílulas laterais pra esticar, a bolinha de cima pra girar (Shift gira de 15 em 15 graus) e por dentro pra mover.'
          : state.mode === 'mesh'
          ? 'Arraste os pontos da malha pra encaixar em superfícies curvas ou tortas. Cantos e mover continuam funcionando no modo Cantos.'
          : 'Arraste os pontos pra recortar. Toque duas vezes na área pra criar um ponto, ou duas vezes num ponto pra apagar.'));
    setPressed($('t-guides'), state.guides);
    $('t-play').textContent = state.playing ? 'Pausar vídeos' : 'Tocar vídeos';
    setPressed($('btn-black'), state.blackout);
    setRange('master', 'master-val', state.master, '%');
    setRange('live-master', 'live-master-val', state.master, '%');
    setPressed($('live-black'), state.blackout);
    $('btn-out').textContent = outOpen ? 'Parar saída' : 'Enviar pra tela';
    $('btn-out').classList.toggle('primary', !outOpen);
    $('live-out').textContent = $('btn-out').textContent; $('live-out').classList.toggle('primary', !outOpen);

    if (s) {
      if (document.activeElement !== $('layer-name') && $('layer-name').value !== s.name) $('layer-name').value = s.name;
      setRange('opacity', 'o-val', Math.round(s.opacity * 100), '%');
      setRange('bright', 'b-val', s.bright, '%');
      setRange('contrast', 'c-val', s.contrast, '%');
      setRange('sat', 'sat-val', s.sat, '%');
      setRange('radius', 'radius-val', s.radius || 0, '%');
      setRange('feather', 'feather-val', s.feather || 0, '%');
      $('motion').value = s.motion || 'none';
      setRange('motion-amt', 'motion-amt-val', s.motionAmt == null ? 50 : s.motionAmt, '%');
      syncNums(s);
      setRange('hue', 'hue-val', s.hue, '\u00b0');
      $('cycle').value = s.cycle; $('cycle-val').textContent = s.cycle ? s.cycle + '\u00b0/s' : 'parado';
      setRange('blur', 'blur-val', s.blur, ' px');
      setPressed($('btn-invert'), s.invert);
      setPressed($('btn-mono'), s.mono);
      setRange('audio-amt', 'audio-val', s.audio, '%');
      $('mesh-n').value = String(s.mesh && s.mesh.n || 4);
      $('mesh-off').disabled = !(s.mesh && s.mesh.on);
      $('audio-to').value = s.audioTo;
      var ar = s.w / s.h, ap = '';
      [['16:9', 16 / 9], ['9:16', 9 / 16], ['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4], ['21:9', 21 / 9]].forEach(function (a) {
        if (Math.abs(ar - a[1]) < 0.01) ap = a[0];
      });
      $('aspect').value = ap;
      setPressed($('btn-lock'), s.locked);
      $('btn-lock').textContent = s.locked ? 'Destravar' : 'Travar';
      setPressed($('btn-solo'), state.solo === s.id);
      setPressed($('btn-flipx'), s.flipX);
      setPressed($('btn-flipy'), s.flipY);
      $('btn-rot90').textContent = 'Girar mídia 90° (' + ((s.rot || 0) * 90) + '°)';
      setPressed($('btn-blend'), s.blend === 'screen');
      setPressed($('btn-scover'), !!s.cover);
    } else {
      $('layer-name').value = '';
    }
    var it = isel();
    $('item-ctl').hidden = !it;
    $('items-hint').textContent = s
      ? (s.extras.length ? 'Tudo aqui dentro segue os cantos e a máscara da superfície selecionada.' : 'Superfície vazia. Adicione algo aqui dentro.')
      : 'Nenhuma superfície selecionada. Ao adicionar algo, uma superfície nova é criada.';
    if (it) {
      $('item-name').textContent = it.name;
      setPressed($('btn-cover'), !!it.cover);
      $('item-blend').value = it.blend || 'normal';
      setRange('item-opacity', 'io-val', Math.round((it.opacity == null ? 1 : it.opacity) * 100), '%');
      $('fit-row').hidden = it.type !== 'media';
      $('item-fit').value = it.fit || 'fill';
      var isVid = it.type === 'media' && it.kind === 'video';
      $('speed-row').hidden = !isVid;
      setRange('speed', 's-val', it.speed || 1, 'x');
    }

    var fs = fxSel();
    $('fx-ctl').hidden = !fs;
    if (fs) {
      $('fx-kind').value = fs.fx.kind;
      $('fx-color').value = fs.fx.color;
      setRange('fx-speed', 'fx-speed-val', fs.fx.speed, 'x');
      $('fx-color2').value = fs.fx.color2 || (window.Textures ? Textures.autoColor2(fs.fx.color || '#ff4fa3') : '#ffffff');
      setRange('fx-scale', 'fx-scale-val', fs.fx.scale || 1, 'x');
    }
    var ts = textSel();
    $('text-ctl').hidden = !ts;
    if (ts) {
      var t = Renderer.normText(ts.text);
      if (document.activeElement !== $('text-value') && $('text-value').value !== t.value) $('text-value').value = t.value;
      $('text-font').value = t.font;
      setRange('text-size', 'size-val', t.size, '');
      $('text-color').value = t.color;
      $('text-ocolor').value = t.outlineColor;
      setRange('text-outline', 'outline-val', t.outline, '');
      setPressed($('text-bold'), t.bold);
      setPressed($('text-shadow'), t.shadow);
      $('text-align').value = t.align;
      $('text-anim').value = t.anim;
      setRange('text-speed', 'text-speed-val', t.speed, 'x');
    }
    renderItems();
    syncUndo();
  }

  function hitSurface(x, y) {
    var s = sel();
    if (s && showOf(s) && insidePoly(outline(s), [x, y])) return s;
    for (var i = state.surfaces.length - 1; i >= 0; i--) {
      var c = state.surfaces[i];
      if (showOf(c) && insidePoly(outline(c), [x, y])) return c;
    }
    return null;
  }

  function maskPoint(s, x, y) {
    var H = getH(s);
    if (!H) return null;
    var inv = M.inv3([H[0], H[1], H[2], H[3], H[4], H[5], H[6], H[7], 1]);
    if (!inv) return null;
    var u = M.unproj(inv, x, y);
    return [clamp(u[0] / s.w, 0, 1), clamp(u[1] / s.h, 0, 1)];
  }
  // Máscaras extras (s.cuts)
  function selCut(s) {
    if (!s || !s.cuts || !state.cutSel) return null;
    for (var i = 0; i < s.cuts.length; i++) if (s.cuts[i].id === state.cutSel) return s.cuts[i];
    return null;
  }
  function addCut(kind) {
    var s = sel();
    if (!s || isLocked(s)) return null;
    var poly = shapePoly(kind || 'rect', s.w, s.h);
    if (!poly) return null;
    checkpoint();
    var pts = poly.map(function (p) { return [0.5 + (p[0] - 0.5) * 0.5, 0.5 + (p[1] - 0.5) * 0.5]; });
    var n = (s.cuts || []).length + 1, c = { id: 'c' + Date.now().toString(36) + n, name: 'Máscara ' + n, on: true, inv: false, f: 0, pts: pts };
    s.cuts = (s.cuts || []).concat([c]);
    state.cutSel = c.id; state.mode = 'mask';
    refresh(); renderCuts(); syncControls();
    say('Máscara extra criada. Arraste os pontos azuis; duplo clique no ponto apaga, duplo clique no vazio adiciona.');
    return c;
  }
  function cutById(id) {
    var s = sel(), i;
    if (!s || !s.cuts) return null;
    for (i = 0; i < s.cuts.length; i++) if (s.cuts[i].id === id) return { s: s, c: s.cuts[i] };
    return null;
  }
  function renderCuts() {
    var box = $('cut-list'), s = sel();
    if (!box) return;
    box.innerHTML = '';
    if (!s || !s.cuts || !s.cuts.length) return;
    s.cuts.forEach(function (c0) {
      var id = c0.id;
      var row = document.createElement('div'); row.className = 'cut-row' + (state.cutSel === id ? ' sel' : ''); row.dataset.cut = id;
      var on = document.createElement('input'); on.type = 'checkbox'; on.checked = c0.on !== false; on.id = 'cut-on-' + id; on.title = 'Ligar ou desligar'; on.setAttribute('aria-label', 'Ligar ' + c0.name);
      on.addEventListener('change', function () { var r = cutById(id); if (!r) return; checkpoint(); r.c.on = on.checked; refresh(); });
      var nm = document.createElement('button'); nm.type = 'button'; nm.className = 'btn small'; nm.id = 'cut-sel-' + id; nm.textContent = c0.name;
      nm.addEventListener('click', function () { state.cutSel = id; state.mode = 'mask'; renderOverlay(); renderCuts(); syncControls(); });
      var lbi = document.createElement('label'); var inv = document.createElement('input'); inv.type = 'checkbox'; inv.checked = !!c0.inv; inv.id = 'cut-inv-' + id;
      inv.addEventListener('change', function () { var r = cutById(id); if (!r) return; checkpoint(); r.c.inv = inv.checked; refresh(); });
      lbi.appendChild(inv); lbi.appendChild(document.createTextNode(' Inverter'));
      var f = document.createElement('input'); f.type = 'range'; f.min = 0; f.max = 40; f.step = 1; f.value = c0.f || 0; f.id = 'cut-f-' + id; f.title = 'Suavizar a borda (feather)'; f.setAttribute('aria-label', 'Feather ' + c0.name);
      f.addEventListener('pointerdown', function () { checkpoint(); });
      f.addEventListener('input', function () { var r = cutById(id); if (!r) return; r.c.f = +f.value; refresh(); });
      var del = document.createElement('button'); del.type = 'button'; del.className = 'btn small'; del.id = 'cut-del-' + id; del.textContent = 'Apagar'; del.setAttribute('aria-label', 'Apagar ' + c0.name);
      del.addEventListener('click', function () { var r = cutById(id); if (!r) return; checkpoint(); r.s.cuts = r.s.cuts.filter(function (z) { return z.id !== id; }); if (state.cutSel === id) state.cutSel = null; refresh(); renderCuts(); });
      [on, nm, lbi, f, del].forEach(function (e) { row.appendChild(e); });
      box.appendChild(row);
    });
  }
  var cutsSig = '';
  function renderCutsSoon() { var s = sel(), sg = (s ? s.key : '') + '|' + (state.cutSel || '') + '|' + JSON.stringify((s && s.cuts || []).map(function (z) { return [z.id, z.name, z.on, z.inv, z.f]; })); if (sg !== cutsSig) { cutsSig = sg; var ae = document.activeElement; if (!(ae && ae.type === 'range' && ae.closest && ae.closest('#cut-list'))) renderCuts(); } }
  function addCutPt(s, c, x, y) {
    var u = maskPoint(s, x, y);
    if (!u) return;
    checkpoint();
    var best = 0, bd = Infinity, n = c.pts.length;
    for (var i = 0; i < n; i++) {
      var a = c.pts[i], b = c.pts[(i + 1) % n];
      var ax = a[0] * s.w, ay = a[1] * s.h, bx = b[0] * s.w, by = b[1] * s.h, qx = u[0] * s.w, qy = u[1] * s.h;
      var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      var t = l2 ? clamp(((qx - ax) * dx + (qy - ay) * dy) / l2, 0, 1) : 0;
      var d = Math.hypot(qx - (ax + t * dx), qy - (ay + t * dy));
      if (d < bd) { bd = d; best = i; }
    }
    c.pts.splice(best + 1, 0, u);
    refresh();
  }
  function removeCutPt(c, i) {
    if (c.pts.length <= 3) { say('A máscara precisa de pelo menos 3 pontos.'); return; }
    checkpoint();
    c.pts.splice(i, 1);
    refresh();
  }
  window.__cuts = { add: addCut, sel: function () { return selCut(sel()); } };

  function addMaskPt(s, x, y) {
    var u = maskPoint(s, x, y);
    if (!u) return;
    checkpoint();
    var best = 0, bd = Infinity, n = s.mask.length;
    for (var i = 0; i < n; i++) {
      var a = s.mask[i], b = s.mask[(i + 1) % n];
      var ax = a[0] * s.w, ay = a[1] * s.h, bx = b[0] * s.w, by = b[1] * s.h, qx = u[0] * s.w, qy = u[1] * s.h;
      var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      var t = l2 ? clamp(((qx - ax) * dx + (qy - ay) * dy) / l2, 0, 1) : 0;
      var d = Math.hypot(qx - (ax + t * dx), qy - (ay + t * dy));
      if (d < bd) { bd = d; best = i; }
    }
    s.mask.splice(best + 1, 0, u);
    refresh();
  }
  function removeMaskPt(s, i) {
    if (s.mask.length <= 3) { say('A máscara precisa de pelo menos 3 pontos.'); return; }
    checkpoint();
    s.mask.splice(i, 1);
    refresh();
  }

  // Arrastar na palco
  var drag = null, last = { t: 0, x: 0, y: 0 };
  function local(e) {
    var r = stage.getBoundingClientRect(), k = r.width / Math.max(1, stage.clientWidth) || 1;
    return [(e.clientX - r.left) / k, (e.clientY - r.top) / k];
  }

  overlay.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  overlay.addEventListener('pointerdown', function (e) {
    var pt = local(e), x = pt[0], y = pt[1];
    // Modo clipe: NADA aqui pode mexer na calibração (q). Só alças do clipe ou escolher face/clipe clicando.
    if (state.mode === 'clip' && window.TimelineUI) {
      var k0 = e.target.getAttribute && e.target.getAttribute('data-k');
      if (k0 && k0.indexOf('tl') === 0) window.TimelineUI.overlayDown(e, k0);
      else if (e.button === 0) window.TimelineUI.pickAt(x, y);
      e.preventDefault();
      return;
    }
    if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
      var rs = hitSurface(x, y);
      if (!rs) return;
      if (rs.id !== state.sel) select(rs.id);
      if (isLocked(rs)) { say('Layer travada. Destrave pra girar.'); return; }
      var P = px(rs), cx = 0, cy = 0;
      P.forEach(function (p) { cx += p[0] / P.length; cy += p[1] / P.length; });
      checkpoint(); rs.pristine = false;
      drag = { type: 'rotate', rc: true, moved: false, sx: x, sy: y, cx: cx, cy: cy, a0: Math.atan2(y - cy, x - cx), q0: copyPts(rs.q), off0: rs.mesh && rs.mesh.on ? JSON.parse(JSON.stringify(rs.mesh.off)) : null };
      e.preventDefault();
      try { overlay.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    var kind = e.target.getAttribute && e.target.getAttribute('data-k');
    if (kind && kind.indexOf('tl') === 0 && window.TimelineUI) { window.TimelineUI.overlayDown(e, kind); return; }
    var now = Date.now();
    var dbl = (now - last.t < 350) && Math.hypot(x - last.x, y - last.y) < 12;
    last = { t: now, x: x, y: y };
    var s = sel();
    drag = null;
    if (kind === 'g' && s && !isLocked(s)) {
      checkpoint(); s.pristine = false;
      drag = { type: 'mesh', i: +e.target.getAttribute('data-i') };
    } else if (kind === 'xr' && s && !isLocked(s)) {
      var XQ = px(s), xcx = 0, xcy = 0;
      XQ.forEach(function (p) { xcx += p[0] / 4; xcy += p[1] / 4; });
      checkpoint(); s.pristine = false;
      drag = { type: 'rotate', cx: xcx, cy: xcy, a0: Math.atan2(y - xcy, x - xcx), q0: copyPts(s.q), off0: s.mesh && s.mesh.on ? JSON.parse(JSON.stringify(s.mesh.off)) : null };
    } else if ((kind === 'xc' || kind === 'xe') && s && !isLocked(s)) {
      var P4 = px(s), cc = [0, 0], xi = +e.target.getAttribute('data-i');
      P4.forEach(function (p) { cc[0] += p[0] / 4; cc[1] += p[1] / 4; });
      var hp, an;
      if (kind === 'xc') { hp = P4[xi]; an = P4[(xi + 2) % 4]; }
      else { var a1 = P4[xi], a2 = P4[(xi + 1) % 4], b1 = P4[(xi + 2) % 4], b2 = P4[(xi + 3) % 4]; hp = [(a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2]; an = [(b1[0] + b2[0]) / 2, (b1[1] + b2[1]) / 2]; }
      checkpoint(); s.pristine = false;
      drag = { type: kind, hp: hp, an: an, cc: cc, q0: copyPts(s.q), off0: s.mesh && s.mesh.on ? JSON.parse(JSON.stringify(s.mesh.off)) : null };
    } else if (kind === 'c' && s && !isLocked(s)) {
      checkpoint(); s.pristine = false;
      drag = { type: 'corner', i: +e.target.getAttribute('data-i') };
    } else if (kind === 'mc' && s && !isLocked(s) && selCut(s)) {
      var mci = +e.target.getAttribute('data-i');
      if (dbl) { removeCutPt(selCut(s), mci); last.t = 0; return; }
      checkpoint();
      drag = { type: 'mcut', i: mci, id: state.cutSel };
    } else if (kind === 'm' && s && !isLocked(s)) {
      var mi = +e.target.getAttribute('data-i');
      if (dbl) { removeMaskPt(s, mi); last.t = 0; return; }
      checkpoint();
      drag = { type: 'mask', i: mi };
    } else {
      if (s && !isLocked(s) && state.mode === 'mask' && dbl && insidePoly(px(s), [x, y])) { var cc0 = selCut(s); if (cc0) addCutPt(s, cc0, x, y); else addMaskPt(s, x, y); last.t = 0; return; }
      var hit = hitSurface(x, y);
      if (hit) {
        if (hit.id !== state.sel) select(hit.id);
        if (!isLocked(hit)) {
          checkpoint(); hit.pristine = false;
          drag = { type: 'move', sx: x, sy: y, q0: copyPts(hit.q) };
        }
      }
    }
    if (drag) {
      e.preventDefault();
      try { overlay.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });

  overlay.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var s = sel();
    if (!s) return;
    var pt = local(e), x = pt[0], y = pt[1];
    var W = stage.clientWidth, H = stage.clientHeight;
    if (drag.type === 'corner') {
      var nx = clamp(x / W, -0.5, 1.5), ny = clamp(y / H, -0.5, 1.5);
      if (state.snap && !e.altKey) {
        var tol = 9, bx = null, by = null, dxb = tol, dyb = tol;
        var cand = [[0, 0], [1, 1]];
        state.surfaces.forEach(function (o) {
          if (o === s || !showOf(o)) return;
          o.q.forEach(function (p) { cand.push(p); });
        });
        cand.forEach(function (p) {
          var ddx = Math.abs(p[0] * W - nx * W), ddy = Math.abs(p[1] * H - ny * H);
          if (ddx < dxb) { dxb = ddx; bx = p[0]; }
          if (ddy < dyb) { dyb = ddy; by = p[1]; }
        });
        if (bx !== null) nx = bx;
        if (by !== null) ny = by;
      }
      s.q[drag.i] = [nx, ny];
    } else if (drag.type === 'xc' || drag.type === 'xe') {
      var anc = e.altKey ? drag.cc : drag.an, vx = drag.hp[0] - anc[0], vy = drag.hp[1] - anc[1], vl = Math.hypot(vx, vy) || 1, ux = vx / vl, uy = vy / vl;
      var fct = Math.max(0.05, ((x - anc[0]) * ux + (y - anc[1]) * uy) / vl);
      if (e.shiftKey) fct = Math.round(fct * 20) / 20;
      var ax = anc[0], ay = anc[1];
      var mapP = function (qx, qy) {
        var X = qx * W, Y = qy * H, ox = X - ax, oy = Y - ay;
        if (drag.type === 'xc') return [(ax + ox * fct) / W, (ay + oy * fct) / H];
        var d = ox * ux + oy * uy; return [(X + ux * d * (fct - 1)) / W, (Y + uy * d * (fct - 1)) / H];
      };
      s.q = drag.q0.map(function (p) { return mapP(p[0], p[1]); });
      if (drag.off0 && s.mesh && s.mesh.on) {
        s.mesh.off = drag.off0.map(function (o) {
          var ox = o[0] * W, oy = o[1] * H;
          if (drag.type === 'xc') return [o[0] * fct, o[1] * fct];
          var d = ox * ux + oy * uy; return [(ox + ux * d * (fct - 1)) / W, (oy + uy * d * (fct - 1)) / H];
        });
      }
      say('Tamanho ' + Math.round(fct * 100) + '%');
    } else if (drag.type === 'move') {
      var dx = (x - drag.sx) / W, dy = (y - drag.sy) / H;
      s.q = drag.q0.map(function (p) { return [p[0] + dx, p[1] + dy]; });
    } else if (drag.type === 'rotate') {
      if (drag.rc && !drag.moved) { if (Math.hypot(x - drag.sx, y - drag.sy) < 5) return; drag.moved = true; }
      var da = Math.atan2(y - drag.cy, x - drag.cx) - drag.a0;
      if (e.shiftKey) da = Math.round(da / (Math.PI / 12)) * (Math.PI / 12);
      var co = Math.cos(da), si = Math.sin(da);
      s.q = drag.q0.map(function (p) {
        var ox = p[0] * W - drag.cx, oy = p[1] * H - drag.cy;
        return [(drag.cx + ox * co - oy * si) / W, (drag.cy + ox * si + oy * co) / H];
      });
      if (drag.off0 && s.mesh && s.mesh.on) {
        s.mesh.off = drag.off0.map(function (o) {
          var ox = o[0] * W, oy = o[1] * H;
          return [(ox * co - oy * si) / W, (ox * si + oy * co) / H];
        });
      }
      say('Girando ' + Math.round(da * 180 / Math.PI) + '°');
    } else if (drag.type === 'mesh') {
      if (s.mesh && s.mesh.on) {
        var tb = M.meshBase(s.q, s.mesh.n)[drag.i];
        s.mesh.off[drag.i] = [clamp(x / W, -0.5, 1.5) - tb[0], clamp(y / H, -0.5, 1.5) - tb[1]];
      }
    } else if (drag.type === 'mask') {
      var u = maskPoint(s, x, y);
      if (u) s.mask[drag.i] = u;
    } else if (drag.type === 'mcut') {
      var cu = selCut(s), u2 = maskPoint(s, x, y);
      if (cu && u2) cu.pts[drag.i] = u2;
    }
    refresh();
  });

  function endDrag(e) {
    if (!drag) return;
    var d0 = drag;
    drag = null;
    placeToolbar();
    if (d0.rc && !d0.moved) openCtx(e.clientX, e.clientY);
    try { overlay.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  overlay.addEventListener('pointerup', endDrag);
  overlay.addEventListener('pointercancel', endDrag);

  function toggleGuides() {
    state.guides = !state.guides;
    renderOverlay(); syncControls();
  }
  function toggleBlack() {
    state.blackout = !state.blackout;
    refresh(); syncControls();
  }

  document.addEventListener('keydown', function (e) {
    var tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) doRedo(); else doUndo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); if (sel()) $('btn-dup').click(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { if (!help.hidden) help.hidden = true; else if (!tour.hidden) endTour(); else closeCtx(); return; }
    if (e.key === '?') { help.hidden = !help.hidden; return; }
    if (e.key === 'c' || e.key === 'C') { $('m-corners').click(); return; }
    if (e.key === 'v' || e.key === 'V') { $('m-xform').click(); return; }
    if (e.key === 'm' || e.key === 'M') { $('m-mask').click(); return; }
    if (e.key === 'n' || e.key === 'N') { if (sel()) $('m-mesh').click(); return; }
    if (e.key === 'l' || e.key === 'L') { if (sel()) $('btn-lock').click(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel()) { e.preventDefault(); removeSurface(sel().id); return; }
    if (e.key === 't' || e.key === 'T') { doTap(); return; }
    if (e.key === 'g' || e.key === 'G') { toggleGuides(); return; }
    if (e.key === 'b' || e.key === 'B') { toggleBlack(); return; }
    if (e.key >= '1' && e.key <= '9') { switchScene(+e.key - 1); return; }
    var s = sel();
    if (!s || isLocked(s)) return;
    var step = e.shiftKey ? 10 : 1, dx = 0, dy = 0;
    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else return;
    e.preventDefault();
    checkpoint('nudge:' + s.id); s.pristine = false;
    var W = stage.clientWidth, H = stage.clientHeight;
    s.q = s.q.map(function (p) { return [p[0] + dx / W, p[1] + dy / H]; });
    refresh();
  });

  // Barra de ações
  $('btn-add').addEventListener('click', function () {
    api.openMedia().then(function (paths) { paths.forEach(addMedia); });
  });
  $('btn-text').addEventListener('click', addText);
  $('add-test').addEventListener('click', addTest);
  $('add-cam').addEventListener('click', addCam);
  $('btn-undo').addEventListener('click', doUndo);
  $('btn-redo').addEventListener('click', doRedo);

  // Cenas, blackout e brilho
  $('scene-add').addEventListener('click', function () { addScene(false); });
  $('scene-dup').addEventListener('click', function () { addScene(true); });
  $('scene-del').addEventListener('click', removeScene);
  $('btn-black').addEventListener('click', toggleBlack);
  $('master').addEventListener('input', function (e) {
    state.master = +e.target.value;
    $('master-val').textContent = e.target.value + '%';
    push();
  });

  // Layer selecionada
  $('m-corners').addEventListener('click', function () { state.mode = 'corners'; renderOverlay(); syncControls(); });
  $('m-mask').addEventListener('click', function () { state.mode = 'mask'; renderOverlay(); syncControls(); });
  $('m-xform').addEventListener('click', function () { state.mode = 'xform'; renderOverlay(); syncControls(); });
  $('btn-snap').addEventListener('click', function () { state.snap = !state.snap; setPressed($('btn-snap'), state.snap); say(state.snap ? 'Ímã ligado: os cantos grudam nas bordas e nos cantos das outras superfícies. Segure Alt para soltar.' : 'Ímã desligado.'); });
  function zeroOff(n) { var a = [], k; for (k = 0; k < (n + 1) * (n + 1); k++) a.push([0, 0]); return a; }
  function setMeshN(s, n) {
    var oldN = s.mesh.n, old = M.meshPoints(s), base = M.meshBase(s.q, n), off = [], i, j;
    function at(ii, jj) { return old[jj * (oldN + 1) + ii]; }
    for (j = 0; j <= n; j++) {
      for (i = 0; i <= n; i++) {
        var fu = i / n * oldN, fv = j / n * oldN, i0 = Math.min(oldN - 1, Math.floor(fu)), j0 = Math.min(oldN - 1, Math.floor(fv));
        var tu = fu - i0, tv = fv - j0, p00 = at(i0, j0), p10 = at(i0 + 1, j0), p01 = at(i0, j0 + 1), p11 = at(i0 + 1, j0 + 1);
        var px0 = (p00[0] * (1 - tu) + p10[0] * tu) * (1 - tv) + (p01[0] * (1 - tu) + p11[0] * tu) * tv;
        var py0 = (p00[1] * (1 - tu) + p10[1] * tu) * (1 - tv) + (p01[1] * (1 - tu) + p11[1] * tu) * tv;
        var b = base[j * (n + 1) + i];
        off.push([px0 - b[0], py0 - b[1]]);
      }
    }
    s.mesh = { on: true, n: n, off: off };
  }
  $('m-mesh').addEventListener('click', function () {
    var s = sel();
    state.mode = 'mesh';
    if (s && !isLocked(s) && !(s.mesh && s.mesh.on)) {
      checkpoint();
      s.mesh = { on: true, n: (s.mesh && s.mesh.n) || 4, off: zeroOff((s.mesh && s.mesh.n) || 4) };
      say('Malha ligada. Arraste os pontos para curvar a imagem.');
    }
    refresh(); renderOverlay(); syncControls();
  });
  $('mesh-n').addEventListener('change', function (e) {
    var s = sel();
    if (!s || isLocked(s)) return;
    checkpoint();
    var n = +e.target.value;
    if (s.mesh && s.mesh.on) setMeshN(s, n); else s.mesh = { on: false, n: n, off: zeroOff(n) };
    refresh(); renderOverlay(); syncControls();
  });
  $('mesh-reset').addEventListener('click', function () {
    var s = sel();
    if (!s || isLocked(s) || !s.mesh) return;
    checkpoint();
    s.mesh.off = zeroOff(s.mesh.n);
    refresh(); renderOverlay();
  });
  $('mesh-off').addEventListener('click', function () {
    var s = sel();
    if (!s || !s.mesh) return;
    checkpoint();
    s.mesh.on = false;
    if (state.mode === 'mesh') state.mode = 'corners';
    refresh(); renderOverlay(); syncControls();
  });
  $('layer-name').addEventListener('input', function (e) {
    var s = sel();
    if (!s) return;
    checkpoint('name:' + s.id);
    s.name = e.target.value || 'Layer';
    renderList(); push();
  });
  $('btn-lock').addEventListener('click', function () {
    var s = sel();
    if (!s) return;
    checkpoint();
    s.locked = !s.locked;
    renderList(); renderOverlay(); syncControls();
  });
  $('btn-solo').addEventListener('click', function () {
    var s = sel();
    if (!s) return;
    state.solo = state.solo === s.id ? null : s.id;
    renderList(); refresh(); syncControls();
  });
  $('btn-dup').addEventListener('click', dupLayer);

  function slider(id, outId, suffix, apply) {
    $(id).addEventListener('input', function (e) {
      var s = sel();
      if (!s) return;
      checkpoint(id + ':' + s.id);
      apply(s, +e.target.value);
      $(outId).textContent = e.target.value + suffix;
      refresh();
    });
  }
  slider('opacity', 'o-val', '%', function (s, v) { s.opacity = v / 100; });
  slider('bright', 'b-val', '%', function (s, v) { s.bright = v; });
  slider('contrast', 'c-val', '%', function (s, v) { s.contrast = v; });
  slider('sat', 'sat-val', '%', function (s, v) { s.sat = v; });
  slider('radius', 'radius-val', '%', function (s, v) { s.radius = v; });
  slider('feather', 'feather-val', '%', function (s, v) { s.feather = v; });
  slider('motion-amt', 'motion-amt-val', '%', function (s, v) { s.motionAmt = v; });
  $('motion').addEventListener('change', function (e) { var s = sel(); if (!s) return; checkpoint(); s.motion = e.target.value; refresh(); });
  slider('hue', 'hue-val', '\u00b0', function (s, v) { s.hue = v; });
  slider('blur', 'blur-val', ' px', function (s, v) { s.blur = v; });
  slider('audio-amt', 'audio-val', '%', function (s, v) { s.audio = v; });
  $('cycle').addEventListener('input', function (e) {
    var s = sel();
    if (!s) return;
    checkpoint('cycle:' + s.id);
    s.cycle = +e.target.value;
    $('cycle-val').textContent = s.cycle ? s.cycle + '\u00b0/s' : 'parado';
    refresh();
  });
  $('audio-to').addEventListener('change', function (e) {
    var s = sel();
    if (!s) return;
    checkpoint();
    s.audioTo = e.target.value === 'opacity' ? 'opacity' : 'bright';
    refresh();
  });

  function toggleProp(id, prop, a, b) {
    $(id).addEventListener('click', function () {
      var s = sel();
      if (!s) return;
      checkpoint();
      if (a === undefined) s[prop] = !s[prop]; else s[prop] = s[prop] === a ? b : a;
      refresh(); syncControls();
    });
  }
  toggleProp('btn-invert', 'invert');
  toggleProp('btn-mono', 'mono');
  toggleProp('btn-flipx', 'flipX');
  toggleProp('btn-flipy', 'flipY');
  $('btn-rot90').addEventListener('click', function () {
    var s = sel();
    if (!s) return;
    checkpoint();
    s.rot = ((s.rot || 0) + 1) % 4;
    refresh(); syncControls();
  });
  function spin(deg, key, quiet) {
    var s = sel();
    if (!s || isLocked(s)) return;
    checkpoint(key); s.pristine = false;
    var r = deg * Math.PI / 180, co = Math.cos(r), si = Math.sin(r), A = outRatio;
    var cx = 0, cy = 0;
    s.q.forEach(function (p) { cx += p[0] * A / 4; cy += p[1] / 4; });
    s.q = s.q.map(function (p) {
      var x = p[0] * A - cx, y = p[1] - cy;
      return [(cx + x * co - y * si) / A, cy + x * si + y * co];
    });
    if (s.mesh && s.mesh.on) {
      s.mesh.off = s.mesh.off.map(function (o) {
        var ox = o[0] * A, oy = o[1];
        return [(ox * co - oy * si) / A, ox * si + oy * co];
      });
    }
    refresh();
    if (!quiet) syncControls();
  }
  var jogLast = 0;
  $('rot-jog').addEventListener('input', function (e) {
    var v = +e.target.value;
    var s = sel();
    if (s) spin(v - jogLast, 'jog:' + s.id, true);
    jogLast = v;
    $('rot-val').textContent = v + '°';
  });
  $('rot-jog').addEventListener('change', function (e) {
    jogLast = 0; e.target.value = 0; $('rot-val').textContent = '0°';
  });
  $('btn-rot-m1').addEventListener('click', function () { spin(-1); });
  $('btn-rot-p1').addEventListener('click', function () { spin(1); });
  $('btn-rotl').addEventListener('click', function (e) { spin(e.shiftKey ? -90 : -15); });
  $('btn-rotr').addEventListener('click', function (e) { spin(e.shiftKey ? 90 : 15); });
  toggleProp('btn-blend', 'blend', 'screen', 'normal');
  toggleProp('btn-scover', 'cover');

  $('reset-corners').addEventListener('click', function () {
    var s = sel();
    if (!s) return;
    checkpoint();
    s.q = fitQ(s.w / s.h, 0);
    refresh();
  });
  $('cut-add').addEventListener('click', function () { addCut($('cut-shape').value); });
  $('reset-mask').addEventListener('click', function () {
    var s = sel();
    if (!s) return;
    checkpoint();
    s.mask = [[0, 0], [1, 0], [1, 1], [0, 1]];
    refresh();
  });

  // Formas prontas: viram a máscara da superfície (mantêm a proporção, então o círculo fica redondo)
  function shapePoly(kind, w, h) {
    var m = Math.min(w, h), rx = 0.5 * m / w, ry = 0.5 * m / h, i, a, pts = [];
    function P(x, y) { pts.push([+(0.5 + x * rx * 2).toFixed(4), +(0.5 + y * ry * 2).toFixed(4)]); }
    if (kind === 'rect') return [[0, 0], [1, 0], [1, 1], [0, 1]];
    if (kind === 'circle') { for (i = 0; i < 48; i++) { a = i / 48 * Math.PI * 2; P(Math.cos(a) / 2, Math.sin(a) / 2); } return pts; }
    if (kind === 'triangle') { P(0, -0.5); P(0.5, 0.45); P(-0.5, 0.45); return pts; }
    if (kind === 'diamond') { P(0, -0.5); P(0.5, 0); P(0, 0.5); P(-0.5, 0); return pts; }
    if (kind === 'pentagon' || kind === 'hexagon') {
      var n = kind === 'pentagon' ? 5 : 6;
      for (i = 0; i < n; i++) { a = -Math.PI / 2 + i / n * Math.PI * 2; P(Math.cos(a) / 2, Math.sin(a) / 2); }
      return pts;
    }
    if (kind === 'star') {
      for (i = 0; i < 10; i++) { a = -Math.PI / 2 + i / 10 * Math.PI * 2; var r = i % 2 ? 0.2 : 0.5; P(Math.cos(a) * r, Math.sin(a) * r); }
      return pts;
    }
    if (kind === 'heart') {
      for (i = 0; i < 48; i++) {
        a = i / 48 * Math.PI * 2;
        var hx = 16 * Math.pow(Math.sin(a), 3), hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
        P(hx / 34, hy / 34 + 0.02);
      }
      return pts;
    }
    if (kind === 'arrow') {
      [[0, -0.5], [0.5, 0], [0.18, 0], [0.18, 0.5], [-0.18, 0.5], [-0.18, 0], [-0.5, 0]].forEach(function (p) { P(p[0], p[1]); });
      return pts;
    }
    if (kind === 'cross') {
      [[-0.15, -0.5], [0.15, -0.5], [0.15, -0.15], [0.5, -0.15], [0.5, 0.15], [0.15, 0.15], [0.15, 0.5], [-0.15, 0.5], [-0.15, 0.15], [-0.5, 0.15], [-0.5, -0.15], [-0.15, -0.15]].forEach(function (p) { P(p[0], p[1]); });
      return pts;
    }
    return null;
  }
  $('shape-pick').addEventListener('change', function (e) {
    var s = sel(), k = e.target.value;
    e.target.value = '';
    if (!s || !k) return;
    var poly = shapePoly(k, s.w, s.h);
    if (!poly) return;
    checkpoint();
    s.mask = poly;
    refresh();
    say('Forma aplicada. Dá pra ajustar os pontos no modo Máscara.');
  });

  // Arrastar para reordenar (a lista mostra o de cima primeiro)
  var dragState = null;
  function makeSortable(li, arr, idx, kind, after) {
    li.draggable = true;
    li.title = 'Arraste para mudar a ordem';
    li.addEventListener('dragstart', function (e) {
      dragState = { arr: arr, idx: idx, kind: kind };
      try { e.dataTransfer.setData('text/plain', kind + idx); e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
    });
    li.addEventListener('dragover', function (e) {
      if (!dragState || dragState.kind !== kind) return;
      e.preventDefault();
      li.classList.add('dragover');
    });
    li.addEventListener('dragleave', function () { li.classList.remove('dragover'); });
    li.addEventListener('drop', function (e) {
      li.classList.remove('dragover');
      if (!dragState || dragState.kind !== kind || dragState.arr !== arr) return;
      e.preventDefault();
      var from = dragState.idx;
      dragState = null;
      if (from === idx) return;
      checkpoint();
      var mv = arr.splice(from, 1)[0];
      arr.splice(idx, 0, mv);
      after();
    });
    li.addEventListener('dragend', function () { dragState = null; li.classList.remove('dragover'); });
  }

  // Itens dentro da superfície
  function renderItems() {
    var box = $('items'), s = sel();
    box.textContent = '';
    if (!s) return;
    if (!s.extras.length) {
      var e0 = document.createElement('li');
      e0.className = 'empty';
      e0.textContent = 'Nada dentro desta superfície ainda.';
      box.appendChild(e0);
      return;
    }
    var cur = isel(), n = s.extras.length;
    s.extras.slice().reverse().forEach(function (x, ri) {
      var idx = n - 1 - ri;
      var li = document.createElement('li');
      li.className = 'item';
      li.setAttribute('data-sel', cur && x.id === cur.id ? 'true' : 'false');
      li.setAttribute('data-off', x.visible === false ? 'true' : 'false');
      makeSortable(li, s.extras, idx, 'item', function () { refresh(); renderItems(); });
      var eye = document.createElement('button');
      eye.type = 'button'; eye.className = 'mini' + (x.visible === false ? '' : ' on');
      eye.textContent = x.visible === false ? '○' : '●';
      eye.setAttribute('aria-label', (x.visible === false ? 'Ligar ' : 'Desligar ') + x.name);
      eye.addEventListener('click', function () { checkpoint(); x.visible = x.visible === false; refresh(); renderItems(); });
      var main = document.createElement('button');
      main.type = 'button'; main.className = 'item-main';
      var nm = document.createElement('span'); nm.className = 'name'; nm.textContent = x.name;
      var tg = document.createElement('span'); tg.className = 'tag'; tg.textContent = x.tag || '';
      main.appendChild(nm); main.appendChild(tg);
      main.addEventListener('click', function () { s.selItem = x.id; syncControls(); });
      var up = document.createElement('button');
      up.type = 'button'; up.className = 'mini'; up.textContent = '↑'; up.disabled = idx === n - 1;
      up.setAttribute('aria-label', 'Subir ' + x.name);
      up.addEventListener('click', function () {
        checkpoint();
        var t = s.extras[idx]; s.extras[idx] = s.extras[idx + 1]; s.extras[idx + 1] = t;
        refresh(); renderItems();
      });
      var dn = document.createElement('button');
      dn.type = 'button'; dn.className = 'mini'; dn.textContent = '↓'; dn.disabled = idx === 0;
      dn.setAttribute('aria-label', 'Descer ' + x.name);
      dn.addEventListener('click', function () {
        checkpoint();
        var t = s.extras[idx]; s.extras[idx] = s.extras[idx - 1]; s.extras[idx - 1] = t;
        refresh(); renderItems();
      });
      var rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'mini'; rm.textContent = '×';
      rm.setAttribute('aria-label', 'Remover ' + x.name);
      rm.addEventListener('click', function () {
        checkpoint();
        s.extras.splice(s.extras.indexOf(x), 1);
        if (s.selItem === x.id) s.selItem = null;
        renderAll();
      });
      li.appendChild(eye); li.appendChild(main); li.appendChild(up); li.appendChild(dn); li.appendChild(rm);
      box.appendChild(li);
    });
  }
  function itemEdit(key, fn) {
    var it = isel();
    if (!it) return;
    checkpoint(key + ':' + it.id);
    fn(it);
    refresh();
  }
  $('item-opacity').addEventListener('input', function (e) {
    $('io-val').textContent = e.target.value + '%';
    itemEdit('iop', function (it) { it.opacity = e.target.value / 100; });
  });
  $('item-fit').addEventListener('change', function (e) { itemEdit('ifit', function (it) { it.fit = e.target.value; }); });
  $('speed').addEventListener('input', function (e) {
    $('s-val').textContent = e.target.value + 'x';
    itemEdit('ispd', function (it) { it.speed = +e.target.value; });
  });
  $('btn-cover').addEventListener('click', function () {
    var it = isel();
    if (!it) return;
    checkpoint();
    it.cover = !it.cover;
    refresh(); syncControls();
  });
  $('item-blend').addEventListener('change', function (e) { itemEdit('iblend', function (it) { it.blend = e.target.value; }); });
  function toEdge(front) {
    var s = sel(), it = isel();
    if (!s || !it) return;
    var i = s.extras.indexOf(it);
    if ((front && i === s.extras.length - 1) || (!front && i === 0)) return;
    checkpoint();
    s.extras.splice(i, 1);
    if (front) s.extras.push(it); else s.extras.unshift(it);
    refresh(); renderItems();
  }
  $('btn-front').addEventListener('click', function () { toEdge(true); });
  $('btn-back').addEventListener('click', function () { toEdge(false); });
  $('btn-newbox').addEventListener('click', newBox);
  $('aspect').addEventListener('change', function (e) {
    var s = sel(), v = e.target.value;
    if (!s || !v) { syncControls(); return; }
    checkpoint();
    var p = v.split(':');
    setAspect(s, +p[0], +p[1]);
    say('Proporção ' + v + '. Os cantos voltaram a ser um retângulo, ajuste de novo.');
    refresh(); syncControls();
  });

  // Efeito
  function editFx(key, fn) {
    var s = fxSel();
    if (!s) return;
    checkpoint(key + ':' + s.id);
    fn(s);
    refresh();
  }
  $('fx-kind').addEventListener('change', function (e) {
    editFx('fxkind', function (s) {
      var old = FX_KINDS.filter(function (k) { return k.id === s.fx.kind; })[0];
      var nu = FX_KINDS.filter(function (k) { return k.id === e.target.value; })[0];
      if (old && nu && s.name === old.name) s.name = nu.name;
      s.fx.kind = e.target.value;
    });
    renderItems();
  });
  $('fx-color').addEventListener('input', function (e) { editFx('fxcolor', function (s) { s.fx.color = e.target.value; }); syncControls(); });
  $('fx-color2').addEventListener('input', function (e) { editFx('fxcolor2', function (s) { s.fx.color2 = e.target.value; }); });
  $('fx-color2-auto').addEventListener('click', function () { editFx('fxc2auto' + Date.now(), function (s) { delete s.fx.color2; }); syncControls(); });
  $('fx-scale').addEventListener('input', function (e) {
    $('fx-scale-val').textContent = e.target.value + 'x';
    editFx('fxscale', function (s) { s.fx.scale = +e.target.value; });
  });
  $('fx-speed').addEventListener('input', function (e) {
    $('fx-speed-val').textContent = e.target.value + 'x';
    editFx('fxspeed', function (s) { s.fx.speed = +e.target.value; });
  });

  // Texto
  function editText(key, fn) {
    var s = textSel();
    if (!s) return;
    checkpoint(key + ':' + s.id);
    s.text = Renderer.normText(s.text);
    fn(s);
    refresh();
  }
  $('text-value').addEventListener('input', function (e) {
    editText('tvalue', function (s) {
      s.text.value = e.target.value;
      s.name = (e.target.value.split('\n')[0] || 'Texto').slice(0, 40);
    });
    renderItems();
  });
  $('text-font').addEventListener('change', function (e) { editText('tfont', function (s) { s.text.font = e.target.value; }); });
  $('text-size').addEventListener('input', function (e) {
    $('size-val').textContent = e.target.value;
    editText('tsize', function (s) { s.text.size = +e.target.value; });
  });
  $('text-color').addEventListener('input', function (e) { editText('tcolor', function (s) { s.text.color = e.target.value; }); });
  $('text-ocolor').addEventListener('input', function (e) { editText('tocolor', function (s) { s.text.outlineColor = e.target.value; }); });
  $('text-outline').addEventListener('input', function (e) {
    $('outline-val').textContent = e.target.value;
    editText('toutline', function (s) { s.text.outline = +e.target.value; });
  });
  $('text-bold').addEventListener('click', function () { editText('tbold' + Date.now(), function (s) { s.text.bold = !s.text.bold; }); syncControls(); });
  $('text-shadow').addEventListener('click', function () { editText('tshadow' + Date.now(), function (s) { s.text.shadow = !s.text.shadow; }); syncControls(); });
  $('text-align').addEventListener('change', function (e) { editText('talign', function (s) { s.text.align = e.target.value; }); });
  $('text-anim').addEventListener('change', function (e) { editText('tanim', function (s) { s.text.anim = e.target.value; }); });
  $('text-speed').addEventListener('input', function (e) {
    $('text-speed-val').textContent = e.target.value + 'x';
    editText('tspeed', function (s) { s.text.speed = +e.target.value; });
  });

  // Exibição
  $('t-guides').addEventListener('click', toggleGuides);
  $('t-play').addEventListener('click', function () {
    state.playing = !state.playing;
    syncControls();
    refresh();
  });

  // Saída
  var outRatio = 16 / 9;
  function applyAspect() {
    var id = +$('display').value;
    var d = displays.filter(function (x) { return x.id === id; })[0];
    var ratio = d ? d.bounds.width / d.bounds.height : 16 / 9;
    outRatio = ratio;
    document.documentElement.style.setProperty('--arn', String(ratio));
    refresh();
  }
  function loadDisplays() {
    return api.displays().then(function (list) {
      displays = list;
      var selEl = $('display');
      var keep = selEl.value;
      selEl.textContent = '';
      list.forEach(function (d) {
        var o = document.createElement('option');
        o.value = d.id;
        o.textContent = (d.primary ? 'Principal' : 'Extra') + ', ' + d.bounds.width + 'x' + d.bounds.height + (d.label ? ', ' + d.label : '');
        selEl.appendChild(o);
      });
      var pick = list.filter(function (d) { return String(d.id) === keep; })[0]
        || list.filter(function (d) { return !d.primary; })[0]
        || list[0];
      if (pick) selEl.value = pick.id;
      $('out-hint').textContent = list.length > 1
        ? 'Esc na tela de saída fecha.'
        : 'Só achei uma tela. A saída vai cobrir este painel. Esc na tela de saída fecha.';
      applyAspect();
    });
  }
  $('display').addEventListener('change', function () {
    applyAspect();
    if (outOpen) api.openOutput(+$('display').value).then(function () { say('Saída movida pro monitor escolhido.'); });
  });
  $('btn-refresh').addEventListener('click', function () {
    loadDisplays().then(function () { say('Lista de telas atualizada.'); });
  });
  $('btn-out').addEventListener('click', function () {
    if (outOpen) {
      api.closeOutput();
      outOpen = false;
      syncControls();
      return;
    }
    api.openOutput(+$('display').value).then(function (ok) {
      if (!ok) { say('Não achei esse monitor. Aperte Atualizar telas.'); return; }
      outOpen = true;
      syncControls();
      say('Saída aberta no monitor escolhido.');
    });
  });
  api.onOutputClosed(function () {
    outOpen = false;
    syncControls();
    say('Saída fechada.');
  });
  api.onResend(function () { push(); });

  // Projetos
  var SAVE_KEYS = ['key', 'name', 'tag', 'type', 'w', 'h', 'q', 'mask', 'cuts', 'opacity', 'pristine',
    'visible', 'locked', 'flipX', 'flipY', 'rot', 'bright', 'contrast', 'blend',
    'sat', 'hue', 'blur', 'cycle', 'invert', 'mono', 'audio', 'audioTo', 'mesh', 'radius', 'feather', 'motion', 'motionAmt'];
  function surfaceToData(s) {
    var d = {};
    SAVE_KEYS.forEach(function (k) { d[k] = s[k]; });
    d.extras = s.extras.map(function (x) {
      var y = JSON.parse(JSON.stringify(x));
      delete y.src;
      return y;
    });
    return d;
  }
  function fixItem(x) {
    var y = JSON.parse(JSON.stringify(x));
    y.id = 'x' + (++uid);
    if (y.type === 'media') y.src = y.test ? testPattern() : (y.path ? toUrl(y.path) : null);
    return y;
  }
  function surfaceFromData(d) {
    var o = cloneS(d);
    var items = (d.extras || []).map(fixItem);
    if (d.type && d.type !== 'box') {
      // Projeto antigo: o conteúdo da layer vira o primeiro item dentro da superfície
      var base = { visible: true, opacity: 1, fit: 'fill', name: d.name || 'Item', tag: d.tag || '' };
      if (d.type === 'fx') { base.type = 'fx'; base.fx = d.fx; base.tag = 'EFEITO'; }
      else if (d.type === 'text') { base.type = 'text'; base.text = d.text; base.tag = 'TEXTO'; }
      else {
        base.type = 'media'; base.kind = d.type === 'video' ? 'video' : 'img';
        base.test = !!d.test; base.path = d.path || null; base.speed = d.speed || 1;
      }
      items.unshift(fixItem(base));
      o.pristine = false;
    }
    o.type = 'box'; o.tag = 'SUPERFÍCIE';
    o.extras = items; o.selItem = null;
    o.src = null; o.path = null; o.test = false; o.text = null; o.fx = null;
    return mk(o);
  }
  $('btn-save').addEventListener('click', function () {
    var data = projectData();
    api.saveProject(JSON.stringify(data, null, 1)).then(function (p) {
      if (p) say('Projeto salvo em ' + p + '.');
    });
  });
  function loadProject(data) {
    var scenes = null;
    if (data && Array.isArray(data.scenes) && data.scenes.length) scenes = data.scenes;
    else if (data && Array.isArray(data.surfaces)) scenes = [{ name: 'Cena 1', surfaces: data.surfaces }];
    if (!scenes) return false;
    state.scenes = scenes.map(function (sc, i) {
      var list = (sc.surfaces || []).map(surfaceFromData);
      return { id: typeof sc.id === 'string' && /^[\w-]{1,40}$/.test(sc.id) ? sc.id : newSceneId(), name: sc.name || ('Cena ' + (i + 1)), secs: +sc.secs || 0, surfaces: list, sel: list.length ? list[list.length - 1].id : null };
    });
    // IDs de cena repetidos (arquivo editado à mão) ganham ID novo; projetos antigos sem ID já receberam acima
    (function () { var seen = {}; state.scenes.forEach(function (sc) { if (seen[sc.id]) sc.id = newSceneId(); seen[sc.id] = 1; }); })();
    state.scene = 0;
    state.surfaces = state.scenes[0].surfaces;
    state.sel = state.scenes[0].sel;
    state.solo = null;
    undoStack = []; redoStack = [];
    // Timeline: projetos antigos não têm sequência, então abrem com a timeline desligada e projetam como antes
    tl.seq = Seq.migrate(data.sequence);
    showCompat(Seq.compat());
    resolveAssets();
    tl.on = !!(data.tlOn && data.sequence);
    tl.clock.stop(); syncClock();
    renderAll();
    return true;
  }
  // Cartão visível quando o projeto veio de uma versão mais nova (não some sozinho)
  function showCompat(list) {
    var old = document.getElementById('compat-card'); if (old) old.remove();
    if (!list || !list.length) return;
    var c = document.createElement('div'); c.id = 'compat-card'; c.setAttribute('role', 'alert');
    c.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9998;max-width:560px;background:#2b2210;border:1px solid #b8892b;color:#ffe3a3;border-radius:10px;padding:10px 14px;font-size:13px;display:flex;gap:12px;align-items:flex-start;box-shadow:0 6px 24px #000a';
    var t = document.createElement('div'); t.style.flex = '1';
    var h = document.createElement('b'); h.textContent = 'Projeto de uma versão mais nova'; t.appendChild(h);
    list.forEach(function (m) { var p = document.createElement('div'); p.style.marginTop = '4px'; p.textContent = m; t.appendChild(p); });
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.id = 'compat-ok'; b.textContent = 'Entendi'; b.addEventListener('click', function () { c.remove(); });
    c.appendChild(t); c.appendChild(b); document.body.appendChild(c);
  }
  function resolveAssets() {
    tl.seq.assets.forEach(function (a) {
      if (a.test) a.src = testPattern();
      else if (a.path) a.src = toUrl(a.path);
    });
  }
  function syncClock() {
    tl.clock.duration = Math.max(0.1, tl.seq.duration);
    var lp = tl.seq.settings.loop;
    tl.clock.loop = { on: !!lp.on, in: lp.in || 0, out: lp.out == null ? null : lp.out };
    tl.clock.ver++;
  }
  function seqForSave() {
    var c = JSON.parse(JSON.stringify(tl.seq));
    c.assets.forEach(function (a) { delete a.src; delete a._off; delete a._chk; });
    return c;
  }
  $('btn-open').addEventListener('click', function () {
    api.openProject().then(function (json) {
      if (!json) return;
      var data;
      try { data = JSON.parse(json); } catch (e) { say('Esse arquivo de projeto está com problema.'); return; }
      if (!loadProject(data)) { say('Esse arquivo de projeto está com problema.'); return; }
      say('Projeto aberto. Se alguma mídia sumiu, confira se o arquivo continua no mesmo lugar.');
    });
  });
  var newArmed = 0;
  $('btn-new').addEventListener('click', function () {
    var b = $('btn-new');
    if (!newArmed) {
      b.textContent = 'Confirmar?';
      newArmed = setTimeout(function () { newArmed = 0; b.textContent = 'Novo'; }, 3000);
      return;
    }
    clearTimeout(newArmed); newArmed = 0; b.textContent = 'Novo';
    checkpoint();
    state.scenes = [{ id: newSceneId(), name: 'Cena 1', surfaces: [], sel: null }];
    state.scene = 0; state.surfaces = state.scenes[0].surfaces; state.sel = null; state.solo = null;
    tl.seq = Seq.create(); tl.on = false; tl.clock.stop(); syncClock();
    newBox();
    undoStack.pop();
    syncUndo();
    say('Projeto novo. Dá pra desfazer com Cmd+Z.');
  });

  // Autosave: guarda o projeto sozinho e restaura na próxima abertura
  var autoT = 0;
  function projectData() {
    syncScene();
    return {
      version: 5, tlOn: tl.on, sequence: seqForSave(),
      scenes: state.scenes.map(function (sc) { return { id: sc.id, name: sc.name, secs: sc.secs || 0, surfaces: sc.surfaces.map(surfaceToData) }; })
    };
  }
  function scheduleAutosave() {
    clearTimeout(autoT);
    autoT = setTimeout(function () {
      try { localStorage.setItem('ml-autosave', JSON.stringify(projectData())); } catch (e) {}
    }, 900);
  }

  // Duplicar item
  $('btn-item-dup').addEventListener('click', function () {
    var s = sel(), it = isel();
    if (!s || !it) return;
    checkpoint();
    var cp = JSON.parse(JSON.stringify(it));
    cp.id = 'x' + (++uid);
    cp.name = it.name + ' cópia';
    s.extras.splice(s.extras.indexOf(it) + 1, 0, cp);
    s.selItem = cp.id;
    renderAll();
  });

  // Layouts prontos
  var LAYOUTS = [
    { name: '2 colunas', rects: [[0.03, 0.06, 0.45, 0.88], [0.52, 0.06, 0.45, 0.88]] },
    { name: '3 colunas', rects: [[0.03, 0.06, 0.29, 0.88], [0.355, 0.06, 0.29, 0.88], [0.68, 0.06, 0.29, 0.88]] },
    { name: '2 linhas', rects: [[0.03, 0.04, 0.94, 0.44], [0.03, 0.52, 0.94, 0.44]] },
    { name: '2 x 2', rects: [[0.03, 0.04, 0.46, 0.44], [0.51, 0.04, 0.46, 0.44], [0.03, 0.52, 0.46, 0.44], [0.51, 0.52, 0.46, 0.44]] },
    { name: 'Uma grande + 2 pequenas', rects: [[0.03, 0.06, 0.6, 0.88], [0.67, 0.06, 0.3, 0.42], [0.67, 0.52, 0.3, 0.42]] },
    { name: 'Centro + 2 laterais', rects: [[0.03, 0.1, 0.22, 0.8], [0.29, 0.1, 0.42, 0.8], [0.75, 0.1, 0.22, 0.8]] }
  ];
  function makeLayout(l) {
    checkpoint();
    var A = outRatio, n0 = state.surfaces.length;
    l.rects.forEach(function (r, i) {
      var ar = (r[2] * A) / r[3], w, h;
      if (ar >= 1) { w = 1600; h = Math.round(1600 / ar); } else { h = 1600; w = Math.round(1600 * ar); }
      var s = mk({
        name: 'Superfície ' + (n0 + i + 1), tag: 'SUPERFÍCIE', type: 'box', w: w, h: h,
        q: [[r[0], r[1]], [r[0] + r[2], r[1]], [r[0] + r[2], r[1] + r[3]], [r[0], r[1] + r[3]]]
      });
      var gi = gridItem(n0 + i); if (gi) { s.extras = [gi]; s.selItem = gi.id; }
      state.surfaces.push(s);
      state.sel = s.id;
    });
    renderAll();
    say(l.name + ': superfícies criadas com grade neon. Encaixe os cantos e depois coloque o conteúdo.');
  }
  $('layout-pick').addEventListener('change', function (e) {
    var l = LAYOUTS[+e.target.value];
    e.target.value = '';
    if (l) makeLayout(l);
  });

  // Galeria (texturas animadas + clipes + arquivos do usuário)
  var TEX_COLORS = ['#ff4fa3', '#2dd4ff', '#ffb020', '#7cff6b', '#b36bff'];
  var libApp = [], libUser = [], libDir = null, galTab = 'Tudo', galFavs = [];
  try { galFavs = JSON.parse(localStorage.getItem('lenzi-favs') || '[]') || []; } catch (e) { galFavs = []; }
  function saveFavs() { try { localStorage.setItem('lenzi-favs', JSON.stringify(galFavs)); } catch (e) {} }
  function favKey(e) { return e.t === 'tex' ? 'tex:' + e.id : 'clip:' + baseName(e.path); }
  function galCats() {
    var cats = ['Favoritos', 'Recentes', 'Tudo'];
    FX_KINDS.forEach(function (k) { if (cats.indexOf(k.cat) < 0) cats.push(k.cat); });
    cats.push('Clipes'); cats.push('Meus arquivos');
    return cats;
  }
  function galEntries() {
    var out = [];
    FX_KINDS.forEach(function (k, i) {
      out.push({ t: 'tex', id: k.id, name: k.name, cat: k.cat, col: TEX_COLORS[i % TEX_COLORS.length] });
    });
    libApp.forEach(function (p) { if (kindOf(p)) out.push({ t: 'clip', path: p, name: baseName(p).replace(/^Textura - /, '').replace(/\.[^.]+$/, ''), cat: 'Clipes' }); });
    libUser.forEach(function (p) { if (kindOf(p)) out.push({ t: 'clip', path: p, name: baseName(p).replace(/\.[^.]+$/, ''), cat: 'Meus arquivos' }); });
    return out;
  }
  function lazy(el, fn) {
    if (typeof IntersectionObserver !== 'function') { fn(); return; }
    var io = new IntersectionObserver(function (ents) {
      if (ents.some(function (x) { return x.isIntersecting; })) { io.disconnect(); fn(); }
    }, { rootMargin: '200px' });
    io.observe(el);
  }
  function renderTabs() {
    var box = $('gal-tabs');
    box.textContent = '';
    var cnt = {}, ents = galEntries();
    ents.forEach(function (e) { cnt[e.cat] = (cnt[e.cat] || 0) + 1; });
    cnt['Tudo'] = ents.length; cnt['Favoritos'] = galFavs.length; cnt['Recentes'] = recents.length;
    galCats().forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'tab' + (c === galTab ? ' on' : '');
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', c === galTab ? 'true' : 'false');
      b.textContent = c + (cnt[c] ? ' ' + cnt[c] : '');
      b.addEventListener('click', function () { galTab = c; renderGallery(); });
      box.appendChild(b);
    });
  }
  function renderGallery() {
    renderTabs();
    var grid = $('gal-grid'), q = ($('gal-search').value || '').toLowerCase();
    grid.textContent = '';
    var all = galEntries();
    var list = all.filter(function (e) {
      if (q && e.name.toLowerCase().indexOf(q) < 0) return false;
      if (galTab === 'Tudo') return true;
      if (galTab === 'Favoritos') return galFavs.indexOf(favKey(e)) > -1;
      if (galTab === 'Recentes') return e.t === 'tex' && recents.indexOf(e.id) > -1;
      return e.cat === galTab;
    });
    var info = list.length + (list.length === 1 ? ' item' : ' itens');
    if (galTab === 'Recentes') list.sort(function (a, b) { return recents.indexOf(a.id) - recents.indexOf(b.id); });
    if (galTab === 'Recentes' && !list.length) info = 'Os efeitos que você usar aparecem aqui.';
    if (galTab === 'Favoritos' && !list.length) info = 'Nenhum favorito ainda. Toque na estrela de um item.';
    if (galTab === 'Meus arquivos' && !list.length) info = 'Toque em Escolher minha pasta para trazer os seus arquivos.';
    $('gal-info').textContent = info;
    list.slice(0, 300).forEach(function (e) {
      var wrap = document.createElement('div'); wrap.className = 'gcard';
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'card';
      b.setAttribute('aria-label', 'Adicionar ' + e.name);
      b.title = e.name;
      var nm = document.createElement('span'); nm.className = 'cn'; nm.textContent = e.name;
      var tag = document.createElement('span'); tag.className = 'gtype';
      if (e.t === 'tex') {
        tag.textContent = 'animação';
        var cv = document.createElement('canvas'); cv.width = 192; cv.height = 108;
        b.appendChild(cv); b.appendChild(nm);
        var raf = 0, t0 = 0;
        var paint = function (ms) { Renderer.drawFx(cv, { w: 192, h: 108, fx: { kind: e.id, color: e.col, speed: 1, scale: 1 } }, ms); };
        var loop = function (now) { if (!cv.isConnected) { raf = 0; return; } paint(3500 + now - t0); raf = requestAnimationFrame(loop); };
        var start = function () { if (raf) return; t0 = performance.now(); raf = requestAnimationFrame(loop); };
        var stop = function () { cancelAnimationFrame(raf); raf = 0; paint(3500); };
        lazy(b, function () { paint(3500); });
        b.addEventListener('mouseenter', start); b.addEventListener('focus', start);
        b.addEventListener('mouseleave', stop); b.addEventListener('blur', stop);
        b.addEventListener('click', function () { addFx(e.id, e.col); });
      } else {
        var k = kindOf(e.path), th;
        tag.textContent = k.type === 'video' ? 'clipe' : (k.tag === 'GIF' ? 'gif' : 'foto');
        if (k.type === 'video') {
          th = document.createElement('video');
          th.muted = true; th.loop = true; th.setAttribute('playsinline', ''); th.preload = 'none';
          lazy(b, function () { th.preload = 'metadata'; th.src = toUrl(e.path) + '#t=0.1'; });
          b.addEventListener('mouseenter', function () { var pr = th.play && th.play(); if (pr && pr.catch) pr.catch(function () {}); });
          b.addEventListener('mouseleave', function () { th.pause && th.pause(); });
        } else {
          th = document.createElement('img');
          th.decoding = 'async'; th.alt = '';
          lazy(b, function () { th.src = toUrl(e.path); });
        }
        b.appendChild(th); b.appendChild(nm);
        b.addEventListener('click', function () { addMedia(e.path); });
      }
      var star = document.createElement('button');
      var key = favKey(e);
      star.type = 'button';
      function paintStar() {
        var on = galFavs.indexOf(key) > -1;
        star.className = 'fav' + (on ? ' on' : '');
        star.textContent = on ? '★' : '☆';
        star.setAttribute('aria-label', (on ? 'Tirar dos favoritos: ' : 'Favoritar: ') + e.name);
        star.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      paintStar();
      star.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var i = galFavs.indexOf(key);
        if (i > -1) galFavs.splice(i, 1); else galFavs.push(key);
        saveFavs();
        if (galTab === 'Favoritos') renderGallery(); else paintStar();
      });
      wrap.appendChild(b); wrap.appendChild(tag); wrap.appendChild(star);
      grid.appendChild(wrap);
    });
  }
  function loadAppLib() {
    return api.libraryApp().then(function (list) { libApp = list || []; renderGallery(); });
  }
  function loadFolderLib(dir) {
    return api.libraryFolder(dir).then(function (r) {
      if (!r) return;
      libDir = r.dir; libUser = r.files || [];
      try { localStorage.setItem('ml-libdir', r.dir); } catch (e) {}
      if (libUser.length) galTab = 'Meus arquivos';
      renderGallery();
    });
  }
  $('lib-pick').addEventListener('click', function () { loadFolderLib(null); });
  $('lib-reload').addEventListener('click', function () {
    loadAppLib().then(function () { if (libDir) return loadFolderLib(libDir); });
  });
  $('gal-search').addEventListener('input', renderGallery);

  // Som: o microfone alimenta o brilho/opacidade das superfícies com Reação ao som
  var mic = { on: false, ctx: null, an: null, buf: null, stream: null, level: 0, gain: 1, lastSend: 0 };
  function micLoop(now) {
    if (!mic.on) return;
    mic.an.getByteFrequencyData(mic.buf);
    var sum = 0, n = 6, i;
    for (i = 1; i <= n; i++) sum += mic.buf[i];
    var raw = Math.min(1, (sum / n / 255) * 1.6 * mic.gain);
    mic.level = raw > mic.level ? raw : mic.level * 0.85 + raw * 0.15;
    rend.setLevel(mic.level);
    $('mic-fill').style.width = Math.round(mic.level * 100) + '%';
    if (now - mic.lastSend > 33) { mic.lastSend = now; if (api.sendLevel) api.sendLevel(mic.level); }
    requestAnimationFrame(micLoop);
  }
  function micStop() {
    mic.on = false;
    if (mic.stream) mic.stream.getTracks().forEach(function (t) { t.stop(); });
    if (mic.ctx && mic.ctx.close) mic.ctx.close();
    mic.stream = null; mic.ctx = null;
    rend.setLevel(0);
    if (api.sendLevel) api.sendLevel(0);
    $('mic-fill').style.width = '0';
    setPressed($('btn-mic'), false);
    $('btn-mic').textContent = 'Ligar microfone';
  }
  $('btn-mic').addEventListener('click', function () {
    if (mic.on) { micStop(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { say('Este aparelho não liberou o microfone.'); return; }
    (api.askMedia ? api.askMedia('microphone') : Promise.resolve(true)).then(function (ok) {
      if (!ok) throw new Error('negado');
      return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    }).then(function (st) {
      var AC = window.AudioContext || window.webkitAudioContext;
      mic.ctx = new AC();
      var src = mic.ctx.createMediaStreamSource(st);
      mic.an = mic.ctx.createAnalyser();
      mic.an.fftSize = 512; mic.an.smoothingTimeConstant = 0.6;
      mic.buf = new Uint8Array(mic.an.frequencyBinCount);
      src.connect(mic.an);
      mic.stream = st; mic.on = true;
      setPressed($('btn-mic'), true);
      $('btn-mic').textContent = 'Desligar microfone';
      say('Microfone ligado. Aumente Reação ao som na superfície.');
      requestAnimationFrame(micLoop);
    }).catch(function () {
      say('Não consegui usar o microfone. Libere o acesso em Ajustes do Sistema, Privacidade e Segurança, Microfone.');
    });
  });
  $('mic-gain').addEventListener('input', function (e) {
    mic.gain = (+e.target.value) / 100;
    $('mic-gain-val').textContent = e.target.value + '%';
  });

  // Forma a partir de foto: detecta o contorno do objeto e cria uma superfície com essa máscara
  var photo = { img: null, w: 0, h: 0, sens: 1, invert: false, res: null, small: null };
  function photoRun() {
    if (!photo.img) return;
    var sc = Math.min(1, 320 / Math.max(photo.w, photo.h));
    var cw = Math.max(8, Math.round(photo.w * sc)), ch = Math.max(8, Math.round(photo.h * sc));
    var off = document.createElement('canvas'); off.width = cw; off.height = ch;
    var g = off.getContext('2d');
    g.drawImage(photo.img, 0, 0, cw, ch);
    var data = g.getImageData(0, 0, cw, ch);
    photo.res = window.Silhouette.trace(data.data, cw, ch, { sens: photo.sens, invert: photo.invert });
    var cv = $('photo-cv');
    cv.width = cw; cv.height = ch;
    var d = cv.getContext('2d');
    d.clearRect(0, 0, cw, ch);
    d.globalAlpha = 0.55; d.drawImage(photo.img, 0, 0, cw, ch); d.globalAlpha = 1;
    if (photo.res) {
      d.beginPath();
      photo.res.poly.forEach(function (p, i) { if (i) d.lineTo(p[0] * cw, p[1] * ch); else d.moveTo(p[0] * cw, p[1] * ch); });
      d.closePath();
      d.fillStyle = 'rgba(255,79,163,0.30)'; d.fill();
      d.lineWidth = 2; d.strokeStyle = '#ff4fa3'; d.stroke();
      $('photo-info').textContent = 'Contorno com ' + photo.res.poly.length + ' pontos, cobrindo ' + Math.round(photo.res.ratio * 100) + '% da foto.';
    } else {
      $('photo-info').textContent = 'Não achei um objeto. Aumente a sensibilidade ou tente Inverter.';
    }
    $('photo-make').disabled = !photo.res;
  }
  $('btn-photo').addEventListener('click', function () { $('photo-file').value = ''; $('photo-file').click(); });
  $('photo-file').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function () {
      photo.img = im; photo.w = im.naturalWidth; photo.h = im.naturalHeight;
      photo.sens = 1; photo.invert = false;
      $('photo-sens').value = 100; $('photo-sens-val').textContent = '100%';
      setPressed($('photo-invert'), false);
      $('photo-panel').hidden = false;
      photoRun();
      URL.revokeObjectURL(url);
    };
    im.onerror = function () { say('Não consegui abrir essa foto.'); URL.revokeObjectURL(url); };
    im.src = url;
  });
  $('photo-sens').addEventListener('input', function (e) {
    photo.sens = (+e.target.value) / 100;
    $('photo-sens-val').textContent = e.target.value + '%';
    photoRun();
  });
  $('photo-invert').addEventListener('click', function () {
    photo.invert = !photo.invert;
    setPressed($('photo-invert'), photo.invert);
    photoRun();
  });
  $('photo-cancel').addEventListener('click', function () { $('photo-panel').hidden = true; photo.img = null; });
  $('photo-make').addEventListener('click', function () {
    if (!photo.res) return;
    var s = newBox();
    setAspect(s, photo.w, photo.h);
    s.mask = photo.res.poly.map(function (p) { return [p[0], p[1]]; });
    s.name = 'Forma da foto ' + state.surfaces.length;
    s.pristine = false;
    state.mode = 'corners';
    $('photo-panel').hidden = true;
    photo.img = null;
    renderAll();
    say('Superfície criada com a forma da foto. Adicione conteúdo dentro dela e arraste os cantos até o objeto.');
  });

  // Gravar a saída (Mac): captura a janela de saída e salva em arquivo
  var recSt = { rec: null, chunks: [], t0: 0, timer: 0, mime: '' };
  if (!api.saveRecording) $('rec-row').hidden = true;
  function recStop() { if (recSt.rec && recSt.rec.state !== 'inactive') recSt.rec.stop(); }
  $('btn-rec').addEventListener('click', function () {
    if (recSt.rec) { recStop(); return; }
    if (!outOpen) { say('Abra a saída primeiro (Enviar pra tela). A gravação captura o que vai pro projetor.'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { say('Gravação não disponível aqui.'); return; }
    navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false }).then(function (st) {
      var cands = ['video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
      var mime = cands.filter(function (m) { return window.MediaRecorder && MediaRecorder.isTypeSupported(m); })[0] || '';
      recSt.mime = mime; recSt.chunks = [];
      var mr = new MediaRecorder(st, mime ? { mimeType: mime, videoBitsPerSecond: 16000000 } : { videoBitsPerSecond: 16000000 });
      recSt.rec = mr;
      mr.ondataavailable = function (ev) { if (ev.data && ev.data.size) recSt.chunks.push(ev.data); };
      mr.onstop = function () {
        clearInterval(recSt.timer);
        st.getTracks().forEach(function (t) { t.stop(); });
        var ext = /mp4/.test(recSt.mime) ? 'mp4' : 'webm';
        var blob = new Blob(recSt.chunks, { type: recSt.mime || 'video/webm' });
        recSt.rec = null; recSt.chunks = [];
        setPressed($('btn-rec'), false);
        $('btn-rec').textContent = 'Gravar saída';
        blob.arrayBuffer().then(function (buf) { return api.saveRecording(buf, ext); }).then(function (p) {
          say(p ? 'Gravação salva em ' + p + '.' : 'Gravação descartada.');
        });
      };
      st.getVideoTracks()[0].addEventListener('ended', recStop);
      mr.start(1000);
      recSt.t0 = Date.now();
      setPressed($('btn-rec'), true);
      recSt.timer = setInterval(function () {
        var sec = Math.round((Date.now() - recSt.t0) / 1000);
        $('btn-rec').textContent = 'Parar gravação (' + Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2) + ')';
      }, 500);
      $('btn-rec').textContent = 'Parar gravação (0:00)';
      say('Gravando a saída.');
    }).catch(function () {
      say('Não consegui gravar. No Mac, libere Gravação de Tela para o LenziMap em Ajustes do Sistema, Privacidade e Segurança, e abra o app de novo.');
    });
  });

  // Troca automática de cenas
  var autoScene = { on: false, timer: 0 };
  function sceneSecs() {
    var sc = state.scenes[state.scene];
    return (sc && sc.secs) || (+$('scene-secs').value || 5);
  }
  function autoSceneRestart() {
    clearTimeout(autoScene.timer);
    if (!autoScene.on) return;
    autoScene.timer = setTimeout(function () {
      if (!autoScene.on) return;
      if (state.scenes.length > 1) switchScene((state.scene + 1) % state.scenes.length);
      autoSceneRestart();
    }, sceneSecs() * 1000);
  }
  $('scene-auto').addEventListener('click', function () {
    autoScene.on = !autoScene.on;
    setPressed($('scene-auto'), autoScene.on);
    if (autoScene.on && state.scenes.length < 2) say('Crie pelo menos duas cenas para trocar sozinho.');
    autoSceneRestart();
  });
  $('scene-secs').addEventListener('change', autoSceneRestart);
  $('scene-dur').addEventListener('change', function (e) {
    var sc = state.scenes[state.scene];
    if (!sc) return;
    checkpoint();
    sc.secs = +e.target.value || 0;
    autoSceneRestart();
  });

  // Toque o tempo (tap tempo): define a duração padrão das cenas em batidas
  var tapT = [];
  function doTap() {
    var now = performance.now();
    if (tapT.length && now - tapT[tapT.length - 1] > 2500) tapT = [];
    tapT.push(now);
    if (tapT.length > 8) tapT.shift();
    if (tapT.length < 2) { $('bpm').textContent = '...'; return; }
    var gaps = [];
    for (var i = 1; i < tapT.length; i++) gaps.push(tapT[i] - tapT[i - 1]);
    var avg = gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length;
    applyBpm(Math.round(60000 / avg));
  }
  var lastBpm = 0;
  function applyBpm(bpm) {
    lastBpm = bpm;
    $('bpm').textContent = bpm + ' BPM';
    var secs = Math.max(1, Math.min(120, Math.round((+$('beats').value * 60 / bpm) * 10) / 10));
    var sel2 = $('scene-secs');
    var has = Array.prototype.some.call(sel2.options, function (o) { return +o.value === secs; });
    if (!has) { var op = document.createElement('option'); op.value = secs; op.textContent = secs + ' s'; sel2.appendChild(op); }
    sel2.value = secs;
    autoSceneRestart();
  }
  $('tap').addEventListener('click', doTap);
  $('beats').addEventListener('change', function () { if (lastBpm) applyBpm(lastBpm); });

  // MIDI
  var MIDI_ACTS = [['next', 'Próxima cena'], ['prev', 'Cena anterior'], ['black', 'Blackout'], ['master', 'Brilho geral']];
  var midi = { acc: null, on: false, learn: null, map: { scene0: 36 } };
  try { var mm = JSON.parse(localStorage.getItem('lenzi-midi') || 'null'); if (mm) midi.map = mm; } catch (e) {}
  function midiSave() { try { localStorage.setItem('lenzi-midi', JSON.stringify(midi.map)); } catch (e) {} }
  function midiLabel(a) { var v = midi.map[a]; return v ? (v.t === 'cc' ? 'CC ' + v.n : 'Nota ' + v.n) : 'sem tecla'; }
  function midiRender() {
    var box = $('midi-map'); box.innerHTML = '';
    MIDI_ACTS.forEach(function (a) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn small';
      b.textContent = midi.learn === a[0] ? a[1] + ': mexa no controlador...' : a[1] + ' (' + midiLabel(a[0]) + ')';
      b.addEventListener('click', function () { midi.learn = midi.learn === a[0] ? null : a[0]; midiRender(); });
      box.appendChild(b);
    });
  }
  function midiAct(a, val) {
    if (a === 'next') switchScene((state.scene + 1) % state.scenes.length);
    else if (a === 'prev') switchScene((state.scene - 1 + state.scenes.length) % state.scenes.length);
    else if (a === 'black') toggleBlack();
    else if (a === 'master') { $('master').value = Math.round(val / 127 * 100); $('master').dispatchEvent(new Event('input')); }
  }
  function midiMsg(e) {
    var d = e.data; if (!d || d.length < 3) return;
    var cmd = d[0] & 0xf0, n = d[1], v = d[2];
    var isNote = cmd === 0x90 && v > 0, isCC = cmd === 0xb0;
    if (!isNote && !isCC) return;
    var key = { t: isNote ? 'note' : 'cc', n: n };
    if (midi.learn) {
      if (midi.learn === 'master' && !isCC) return;
      if (midi.learn !== 'master' && !isNote) return;
      midi.map[midi.learn] = key; midi.learn = null; midiSave(); midiRender(); say('Tecla do MIDI salva.'); return;
    }
    for (var i = 0; i < MIDI_ACTS.length; i++) {
      var a = MIDI_ACTS[i][0], m = midi.map[a];
      if (m && m.t === key.t && m.n === n) { midiAct(a, v); return; }
    }
    if (isNote && midi.map.scene0 != null && n >= midi.map.scene0 && n < midi.map.scene0 + 16) { switchScene(n - midi.map.scene0); return; }
    if (isCC && (n === 7 || n === 1) && !midi.map.master) midiAct('master', v);
  }
  function midiStart() {
    if (!navigator.requestMIDIAccess) { $('midi-info').textContent = 'Este aparelho não tem MIDI.'; return; }
    navigator.requestMIDIAccess().then(function (acc) {
      midi.acc = acc; midi.on = true; setPressed($('midi-on'), true); $('midi-on').textContent = 'Desligar MIDI';
      var hook = function () {
        var n = 0;
        acc.inputs.forEach(function (inp) { inp.onmidimessage = midiMsg; n++; });
        $('midi-info').textContent = n ? n + (n === 1 ? ' controlador' : ' controladores') : 'Nenhum controlador. Conecte um por USB.';
      };
      acc.onstatechange = hook; hook(); midiRender();
    }).catch(function () { $('midi-info').textContent = 'Sem permissão de MIDI.'; });
  }
  function midiStop() {
    if (midi.acc) midi.acc.inputs.forEach(function (i) { i.onmidimessage = null; });
    midi.on = false; setPressed($('midi-on'), false); $('midi-on').textContent = 'Ligar MIDI'; $('midi-info').textContent = 'Desligado';
  }
  if (!navigator.requestMIDIAccess) { $('midi-on').disabled = true; $('midi-info').textContent = 'Indisponível neste aparelho'; }
  $('midi-on').addEventListener('click', function () { if (midi.on) midiStop(); else midiStart(); });
  midiRender();

  // Looks prontos (um clique aplica brilho, contraste, cor etc. na superfície)
  var LOOKS = [
    ['Original', { bright: 100, contrast: 100, sat: 100, hue: 0, blur: 0, invert: false, mono: false, cycle: 0 }],
    ['Cinema', { bright: 94, contrast: 120, sat: 88, hue: 0, blur: 0, invert: false, mono: false, cycle: 0 }],
    ['Neon', { bright: 105, contrast: 125, sat: 190, hue: 0, blur: 0, invert: false, mono: false, cycle: 0 }],
    ['Sonho', { bright: 112, contrast: 92, sat: 120, hue: 0, blur: 2, invert: false, mono: false, cycle: 0 }],
    ['Vívido', { bright: 100, contrast: 112, sat: 170, hue: 0, blur: 0, invert: false, mono: false, cycle: 0 }],
    ['Sombrio', { bright: 70, contrast: 130, sat: 85, hue: 0, blur: 0, invert: false, mono: false, cycle: 0 }],
    ['Preto e branco', { bright: 100, contrast: 122, sat: 100, hue: 0, blur: 0, invert: false, mono: true, cycle: 0 }],
    ['Negativo', { bright: 100, contrast: 100, sat: 100, hue: 0, blur: 0, invert: true, mono: false, cycle: 0 }],
    ['Arco-íris', { bright: 100, contrast: 105, sat: 130, hue: 0, blur: 0, invert: false, mono: false, cycle: 60 }],
    ['Fantasma', { bright: 120, contrast: 80, sat: 40, hue: 0, blur: 1, invert: false, mono: false, cycle: 0 }]
  ];
  function applyLook(name) {
    var s = sel(); if (!s) { say('Selecione uma superfície primeiro.'); return; }
    var l = LOOKS.filter(function (x) { return x[0] === name; })[0]; if (!l) return;
    checkpoint();
    for (var k in l[1]) s[k] = l[1][k];
    refresh(); syncControls(); say('Look ' + name + ' aplicado.');
  }
  (function () {
    var box = $('looks');
    LOOKS.forEach(function (l) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.textContent = l[0];
      b.addEventListener('click', function () { applyLook(l[0]); });
      box.appendChild(b);
    });
  })();
  ['looks'].forEach(function () {});

  // Surpreenda-me
  function randomFx() {
    var k = FX_KINDS[Math.floor(Math.random() * FX_KINDS.length)];
    var hh = Math.floor(Math.random() * 360), col = 'hsl(' + hh + ',90%,58%)';
    var cv = document.createElement('canvas'); cv.width = cv.height = 1; var cx = cv.getContext('2d'); cx.fillStyle = col; cx.fillRect(0, 0, 1, 1);
    var d = cx.getImageData(0, 0, 1, 1).data, hex = '#' + [d[0], d[1], d[2]].map(function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
    if (!sel()) newBox();
    addFx(k.id, hex); say('Surpreendi: ' + k.name + '. Clique de novo para outro.');
  }
  $('gal-random').addEventListener('click', randomFx);

  // Flash e strobe (ao vivo)
  state.flash = false; state.strobe = 0;
  var fb = $('live-flash');
  function flash(on) { state.flash = on; push(); rend.sync(view()); }
  fb.addEventListener('mousedown', function () { flash(true); });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(function (ev) { fb.addEventListener(ev, function () { if (state.flash) flash(false); }); });
  fb.addEventListener('touchstart', function (e) { e.preventDefault(); flash(true); }, { passive: false });
  $('live-strobe').addEventListener('change', function (e) { state.strobe = +e.target.value; push(); rend.sync(view()); });

  // Buscar tudo (Cmd+K)
  var pal = { items: [], idx: 0 };
  function nrm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function palCommands() {
    var out = [];
    function A(name, hint, run, kw) { out.push({ name: name, hint: hint, run: run, key: nrm(name + ' ' + (kw || '')) }); }
    A('Ir para Camadas', 'aba', function () { setTab('camadas', true); });
    A('Ir para Galeria', 'aba', function () { setTab('galeria', true); }, 'efeitos animacoes');
    A('Ir para Ajustes', 'aba', function () { setTab('ajustes', true); }, 'cor brilho');
    A('Ir para Árvore (hierarquia)', 'aba', function () { setTab('arvore', true); }, 'arvore hierarquia estrutura cubos grupos camadas cenas');
    A('Ir para 3D Illusion', 'aba', function () { setTab('ilusao', true); }, 'ilusao 3d cubo sala infinita tunel');
    A('Ir para Cenas', 'aba', function () { setTab('cenas', true); });
    A('Ir para Saída', 'aba', function () { setTab('saida', true); }, 'projetor gravar midi');
    A('Modo ao vivo', 'aba', function () { setTab('live', true); }, 'show');
    A('Nova superfície', '', function () { $('btn-newbox').click(); }, 'adicionar caixa');
    A('Adicionar padrão de teste', '', function () { $('add-test').click(); }, 'calibracao grade');
    A('Adicionar texto', '', function () { $('btn-text').click(); });
    A('Modo Cantos', 'C', function () { $('m-corners').click(); });
    A('Modo Transformar', 'V', function () { $('m-xform').click(); });
    A('Modo Máscara', 'M', function () { $('m-mask').click(); });
    A('Modo Malha', 'N', function () { $('m-mesh').click(); }, 'warp curvar');
    A('Desfazer', 'Cmd+Z', doUndo); A('Refazer', 'Shift+Cmd+Z', doRedo);
    A('Blackout', 'B', toggleBlack, 'apagar tela preto');
    A('Mostrar ou esconder guias', 'G', function () { toggleGuides(); });
    A('Nova cena', '', function () { $('scene-add').click(); });
    A('Cena seguinte', '', function () { switchScene((state.scene + 1) % state.scenes.length); });
    A('Cena anterior', '', function () { switchScene((state.scene - 1 + state.scenes.length) % state.scenes.length); });
    A('Trocar cenas sozinho', '', function () { $('scene-auto').click(); }, 'automatico');
    A('Toque o tempo', 'T', doTap, 'bpm batida');
    A('Surpreenda-me', '', randomFx, 'aleatorio sorte');
    A('Enviar para o projetor', '', function () { $('btn-out').click(); }, 'saida tela');
    A('Salvar projeto', '', function () { $('btn-save').click(); });
    A('Abrir projeto', '', function () { $('btn-open').click(); });
    A('Ajuda e atalhos', '?', function () { help.hidden = false; });
    LOOKS.forEach(function (l) { A('Look: ' + l[0], 'aplicar', function () { applyLook(l[0]); }, 'filtro'); });
    state.scenes.forEach(function (sc, i) { A('Ir para cena ' + (i + 1) + ': ' + sc.name, String(i + 1), function () { switchScene(i); }); });
    FX_KINDS.forEach(function (k, i) { A('Efeito: ' + k.name, k.cat, function () { if (!sel()) newBox(); addFx(k.id, TEX_COLORS[i % TEX_COLORS.length]); }, 'adicionar animacao'); });
    return out;
  }
  function palRender() {
    var q = nrm($('pal-q').value).split(/\s+/).filter(Boolean), all = palCommands();
    var list = all.filter(function (c) { return q.every(function (w) { return c.key.indexOf(w) > -1; }); });
    if (q.length) list.sort(function (a, b) { return (nrm(a.name).indexOf(q[0]) === 0 ? 0 : 1) - (nrm(b.name).indexOf(q[0]) === 0 ? 0 : 1); });
    pal.items = list.slice(0, 40); if (pal.idx >= pal.items.length) pal.idx = 0;
    var ul = $('pal-list'); ul.textContent = '';
    pal.items.forEach(function (c, i) {
      var li = document.createElement('li'); li.setAttribute('role', 'option'); li.setAttribute('aria-selected', i === pal.idx ? 'true' : 'false');
      var a = document.createElement('span'); a.textContent = c.name; var b = document.createElement('small'); b.textContent = c.hint;
      li.appendChild(a); li.appendChild(b);
      li.addEventListener('click', function () { palRun(i); });
      ul.appendChild(li);
    });
    if (!pal.items.length) { var e = document.createElement('li'); e.textContent = 'Nada encontrado.'; ul.appendChild(e); }
    var cur = ul.querySelector('[aria-selected="true"]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  function palOpen() { $('pal').hidden = false; $('pal-q').value = ''; pal.idx = 0; palRender(); $('pal-q').focus(); }
  function palClose() { $('pal').hidden = true; }
  function palRun(i) { var c = pal.items[i]; if (!c) return; palClose(); c.run(); }
  $('pal-q').addEventListener('input', function () { pal.idx = 0; palRender(); });
  $('pal-q').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); pal.idx = Math.min(pal.items.length - 1, pal.idx + 1); palRender(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); pal.idx = Math.max(0, pal.idx - 1); palRender(); }
    else if (e.key === 'Enter') { e.preventDefault(); palRun(pal.idx); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); palClose(); }
  });
  $('pal').addEventListener('mousedown', function (e) { if (e.target === $('pal')) palClose(); });
  $('gal-pal').addEventListener('click', palOpen);
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if ($('pal').hidden) palOpen(); else palClose(); }
  });

  // Arrastar arquivos pra janela
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) {
    e.preventDefault();
    var files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
    files.forEach(function (f) {
      var p = api.pathFor(f);
      if (p) addMedia(p);
    });
  });

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(function () { refresh(); }).observe(stage);
  } else {
    window.addEventListener('resize', function () { refresh(); });
  }

  // Timeline: a interface mora em timeline-ui.js; aqui só entregamos as funções que ela precisa
  if (window.TimelineUI) {
    window.TimelineUI.init({
      rend: rend, view: view, state: state, tl: tl, Seq: Seq, M: M, api: api, stage: stage, overlay: overlay, svgEl: svgEl, panel: panel,
      say: say, checkpoint: checkpoint, push: push, clamp: clamp, toUrl: toUrl, baseName: baseName, kindOf: kindOf, FX_KINDS: FX_KINDS,
      switchScene: switchScene, testPattern: testPattern, syncClock: syncClock, resolveAssets: resolveAssets, setTab: setTab, renderOverlay: renderOverlay, syncControls: syncControls,
      surfaces: function () {
        var out = [];
        state.scenes.forEach(function (sc, i) { (i === state.scene ? state.surfaces : sc.surfaces).forEach(function (s) { out.push({ s: s, scene: i, sceneName: sc.name }); }); });
        return out;
      },
      currentSurface: sel,
      // Cria uma superfície vazia nova (4 cantos q em frações 0..1). Sem desfazer próprio: quem chama faz o checkpoint e o renderAll.
      newSurface: function (q, name, w, h) {
        var g1 = gridItem(state.surfaces.length);
        var s = mk({ name: name || 'Camada', tag: 'SUPERFÍCIE', type: 'box', w: w || 1600, h: h || 900, q: q.map(function (p) { return [p[0], p[1]]; }), extras: g1 ? [g1] : [], selItem: g1 ? g1.id : null });
        state.surfaces.push(s); state.sel = s.id; return s;
      },
      hitSurface: hitSurface,
      selectKey: function (key) {
        var hit = null;
        state.scenes.forEach(function (sc, i) { (i === state.scene ? state.surfaces : sc.surfaces).forEach(function (s) { if (s.key === key) hit = { s: s, i: i }; }); });
        if (!hit) return null;
        if (hit.i !== state.scene) switchScene(hit.i);
        select(hit.s.id);
        return hit.s;
      },
      setMode: function (m) { state.mode = m; renderOverlay(); syncControls(); },
      pushTransport: function () { if (api.sendTransport) api.sendTransport(tl.clock.transport()); else push(); },
      setOn: function (on) { tl.on = !!on; syncClock(); renderAll(); },
      isOutOpen: function () { return outOpen; },
      stageSize: function () { return [stage.clientWidth, stage.clientHeight]; },
      renderAll: renderAll
    });
    if (window.HierarchyUI) { try { window.HierarchyUI.init(window.TimelineUI._h); } catch (e) { say('A árvore não abriu: ' + e.message); } }
    if (window.IllusionUI) { try { window.IllusionUI.init(window.TimelineUI._h); } catch (e) { say('O painel 3D não abriu: ' + e.message); } }
  }
  // AI Director (opcional): a interface mora em ai/ai-director-panel.js; aqui só entregamos o acesso ao editor.
  if (window.AiDirectorPanel && document.getElementById('ai-panel')) {
    window.AiDirectorPanel.mount(document.getElementById('ai-panel'), {
      api: api, say: say, toUrl: function (a) { return a && a.src ? a.src : (a && a.path ? toUrl(a.path) : ''); },
      surfaces: function () { return state.surfaces.filter(function (s) { return s.key; }).map(function (s) { return { key: s.key, name: s.name }; }); },
      bridgeHost: function () {
        return { seq: function () { return tl.seq; }, surfaces: function () { return state.surfaces.filter(function (s) { return s.key; }).map(function (s) { return { key: s.key, name: s.name }; }); },
          checkpoint: checkpoint, push: push, syncClock: syncClock, renderAll: renderAll, setOn: function (on) { if (!!on !== tl.on) { tl.on = !!on; syncClock(); } }, now: function () { return tl.clock.now(); } };
      },
      // Cria uma superfície NOVA a partir de um quadrilátero sugerido (frações 0..1). Nunca altera superfícies existentes.
      addSurfaceFromQuad: function (q, name) {
        var g0 = gridItem(state.surfaces.length);
        return addSurface({ name: name || 'Superfície IA', tag: 'SUPERFÍCIE', type: 'box', w: 1600, h: 900, q: q.map(function (p) { return [p[0], p[1]]; }), extras: g0 ? [g0] : [], selItem: g0 ? g0.id : null });
      }
    });
  }
  // Início
  (function fillSelects() {
    var kind = $('fx-kind'), groups = {}, lp = $('layout-pick');
    FX_KINDS.forEach(function (k) {
      var cat = k.cat || 'Outros';
      if (!groups[cat]) { groups[cat] = document.createElement('optgroup'); groups[cat].label = cat; kind.appendChild(groups[cat]); }
      var o = document.createElement('option'); o.value = k.id; o.textContent = k.name; groups[cat].appendChild(o);
    });
    LAYOUTS.forEach(function (l, i) {
      var o = document.createElement('option'); o.value = i; o.textContent = l.name; lp.appendChild(o);
    });
  })();
  renderGallery();
  loadAppLib().catch(function () {});
  (function () {
    var d = null;
    try { d = localStorage.getItem('ml-libdir'); } catch (e) {}
    if (d) loadFolderLib(d).then(function () { if (!libUser.length) { galTab = 'Tudo'; renderGallery(); } }).catch(function () {});
  })();

  var restored = false;
  try {
    var raw = localStorage.getItem('ml-autosave');
    if (raw) {
      var ad = JSON.parse(raw);
      if (ad && ad.scenes && ad.scenes.some(function (sc) { return sc.surfaces && sc.surfaces.length; })) restored = loadProject(ad);
    }
  } catch (e) { restored = false; }
  if (restored) {
    say('Projeto anterior restaurado automaticamente. Use Novo, no topo do painel, para começar do zero.');
  } else {
    newBox();
    say('Pronto. A superfície começa com a grade neon: arraste os cantos pra encaixar no objeto e depois coloque o conteúdo.');
  }
  undoStack = []; redoStack = [];
  syncControls();
  loadDisplays();
})();
