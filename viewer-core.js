// LenziMap 3.0 fase 8: Viewer avançado. Módulo PURO (sem DOM).
// Âncora ajustável, Flip H/V, Reset Transform, Grade, Réguas, Áreas seguras, Guias, Motion Paths e Crop animável.
//
// Tudo aqui é VISUAL ou transforma só o CONTEÚDO do clipe. Nada toca em surface.q (a calibração) nem nos cantos da superfície.
// As preferências de visualização (grade, réguas, guias...) ficam em seq.settings.view, em frações (0 a 1) da superfície, então não dependem
// da resolução e sobrevivem a salvar/reabrir. Projeto sem seq.settings.view abre normalmente (usa os padrões, tudo desligado).
(function (root) {
  'use strict';
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function num(v, d) { v = +v; return isFinite(v) ? v : d; }
  var MAX_GUIDES = 40;
  var CROP_KEYS = ['l', 't', 'r', 'b'];

  // ---------- preferências de visualização ----------
  function defaultView() { return { grid: { on: false, div: 10 }, rulers: false, safe: { on: false, action: 0.93, title: 0.8 }, guides: [], snapGuides: true, paths: true, thirds: false }; }
  function sanitizeView(v) {
    var d = defaultView(); if (!v || typeof v !== 'object') return d;
    var g = v.grid || {}, s = v.safe || {};
    d.grid = { on: !!g.on, div: clamp(Math.round(num(g.div, 10)), 2, 64) };
    d.rulers = !!v.rulers;
    d.safe = { on: !!s.on, action: clamp(num(s.action, 0.93), 0.5, 1), title: clamp(num(s.title, 0.8), 0.4, 1) };
    d.snapGuides = v.snapGuides !== false; d.paths = v.paths !== false; d.thirds = !!v.thirds;
    var seen = {};
    (Array.isArray(v.guides) ? v.guides : []).slice(0, MAX_GUIDES).forEach(function (q, i) {
      if (!q || (q.axis !== 'v' && q.axis !== 'h')) return;
      var id = typeof q.id === 'string' && /^[\w-]{1,30}$/.test(q.id) && !seen[q.id] ? q.id : 'g' + i + Math.floor(Math.abs(num(q.pos, 0)) * 1000);
      seen[id] = 1; d.guides.push({ id: id, axis: q.axis, pos: clamp(num(q.pos, 0.5), 0, 1) });
    });
    return d;
  }
  var gseq = 0;
  function addGuide(view, axis, pos) {
    if (axis !== 'v' && axis !== 'h') return { ok: false, error: 'Eixo inválido.' };
    if (view.guides.length >= MAX_GUIDES) return { ok: false, error: 'Limite de ' + MAX_GUIDES + ' guias.' };
    var g = { id: 'g' + Date.now().toString(36) + (gseq++).toString(36), axis: axis, pos: clamp(num(pos, 0.5), 0, 1) };
    view.guides.push(g); return { ok: true, guide: g };
  }
  function moveGuide(view, id, pos) { var g = view.guides.filter(function (x) { return x.id === id; })[0]; if (!g) return { ok: false }; g.pos = clamp(num(pos, g.pos), 0, 1); return { ok: true, guide: g }; }
  function removeGuide(view, id) { var n = view.guides.length; view.guides = view.guides.filter(function (x) { return x.id !== id; }); return { ok: view.guides.length < n }; }
  function clearGuides(view) { var n = view.guides.length; view.guides = []; return { ok: true, count: n }; }

  // ---------- geometria das ajudas visuais (em pixels da superfície, W x H) ----------
  function gridLines(view, W, H) {
    var n = view.grid && view.grid.div ? view.grid.div : 10, v = [], h = [], i;
    for (i = 1; i < n; i++) { v.push(W * i / n); h.push(H * i / n); }
    return { v: v, h: h };
  }
  function thirdsLines(W, H) { return { v: [W / 3, 2 * W / 3], h: [H / 3, 2 * H / 3] }; }
  function safeRects(view, W, H) {
    var s = view.safe || {}, out = [];
    function r(name, k) { return { name: name, x: W * (1 - k) / 2, y: H * (1 - k) / 2, w: W * k, h: H * k }; }
    out.push(r('Ação segura', s.action == null ? 0.93 : s.action)); out.push(r('Título seguro', s.title == null ? 0.8 : s.title));
    return out;
  }
  // Marcas de régua: passo "bonito" (1, 2, 5 x 10^n) com pelo menos minPx pixels de tela entre marcas.
  function niceStep(minUnits) {
    if (!(minUnits > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(minUnits))), m = minUnits / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }
  function rulerTicks(len, screenLen, minPx) {
    minPx = minPx || 48; if (!(len > 0) || !(screenLen > 0)) return [];
    var step = niceStep(minPx * len / screenLen), minor = step / 5, out = [], k;
    for (k = 0; k * minor <= len + 1e-9; k++) { var v = +(k * minor).toFixed(6); out.push({ v: v, major: k % 5 === 0 }); }
    return out;
  }
  // Alvos de ímã (em pixels da superfície): bordas, centro, guias, grade, áreas seguras
  function snapTargets(view, W, H) {
    var x = [0, W / 2, W], y = [0, H / 2, H];
    (view.guides || []).forEach(function (g) { if (g.axis === 'v') x.push(g.pos * W); else y.push(g.pos * H); });
    if (view.grid && view.grid.on) { var gl = gridLines(view, W, H); x = x.concat(gl.v); y = y.concat(gl.h); }
    if (view.safe && view.safe.on) safeRects(view, W, H).forEach(function (r) { x.push(r.x, r.x + r.w); y.push(r.y, r.y + r.h); });
    if (view.thirds) { var t = thirdsLines(W, H); x = x.concat(t.v); y = y.concat(t.h); }
    return { x: x, y: y };
  }
  function nearest(list, v, tol) { var best = null, bd = tol; list.forEach(function (c) { var d = Math.abs(c - v); if (d <= bd) { bd = d; best = c; } }); return best; }

  // ---------- âncora ----------
  // A âncora é um deslocamento a partir do centro do quadro, em fração de W e H (0,0 = centro, comportamento antigo).
  function anchorOf(p) { return [num(p && p.ax, 0), num(p && p.ay, 0)]; }
  // Quando o usuário move a âncora, o conteúdo NÃO pode pular: a posição é compensada para o quadro ficar onde estava.
  // Q(pt) = A + pos + R S (pt - A)  =>  pos' = pos + (I - R S)(A - A')
  function compensateAnchor(p, W, H, a2) {
    var a = anchorOf(p), rad = num(p.rot, 0) * Math.PI / 180, co = Math.cos(rad), si = Math.sin(rad);
    var fx = p.flipH ? -1 : 1, fy = p.flipV ? -1 : 1, kx = num(p.scale, 1) * num(p.sx, 1) * fx, ky = num(p.scale, 1) * num(p.sy, 1) * fy;
    var dx = (a[0] - a2[0]) * W, dy = (a[1] - a2[1]) * H;
    var rx = (dx * kx) * co - (dy * ky) * si, ry = (dx * kx) * si + (dy * ky) * co;      // R S d
    return { x: num(p.x, 0) + (dx - rx) / W, y: num(p.y, 0) + (dy - ry) / H, ax: a2[0], ay: a2[1] };
  }
  // posição da âncora no palco da superfície (px)
  function anchorPoint(p, W, H) { var a = anchorOf(p); return [W / 2 + a[0] * W + num(p.x, 0) * W, H / 2 + a[1] * H + num(p.y, 0) * H]; }

  // ---------- Reset Transform ----------
  var TRANSFORM_KEYS = ['x', 'y', 'scale', 'sx', 'sy', 'rot', 'ax', 'ay', 'c0x', 'c0y', 'c1x', 'c1y', 'c2x', 'c2y', 'c3x', 'c3y', 'cl', 'ct', 'cr', 'cb'];
  // Zera posição, escala, rotação, âncora, flips, distorção e corte do CLIPE. Não mexe em opacidade, efeito, áudio nem na calibração.
  // keepKeyframes=false (padrão) também remove os keyframes dessas propriedades.
  function resetTransform(c, keepKeyframes) {
    var t = c.transform; t.x = 0; t.y = 0; t.scale = 1; t.sx = 1; t.sy = 1; t.rot = 0; t.ax = 0; t.ay = 0; t.flipH = false; t.flipV = false;
    t.crop = { l: 0, t: 0, r: 0, b: 0 }; t.corners = [[0, 0], [0, 0], [0, 0], [0, 0]];
    var n = 0; if (!keepKeyframes) TRANSFORM_KEYS.forEach(function (k) { if (c.keyframes && c.keyframes[k]) { delete c.keyframes[k]; n++; } });
    return { ok: true, keysRemoved: n };
  }
  function toggleFlip(c, axis) { var t = c.transform; if (axis === 'h') t.flipH = !t.flipH; else t.flipV = !t.flipV; return { ok: true, flipH: !!t.flipH, flipV: !!t.flipV }; }

  // ---------- Motion Path ----------
  // Trajetória da âncora do clipe na superfície (px), amostrada ao longo da duração. Os pontos-chave são os keyframes de x/y.
  function motionPath(Seq, c, W, H, samples) {
    var dur = c.duration, N = clamp(Math.round(samples || 64), 8, 400), pts = [], i;
    var kx = (c.keyframes && c.keyframes.x) || [], ky = (c.keyframes && c.keyframes.y) || [];
    var has = kx.length || ky.length || (c.keyframes && (c.keyframes.ax || c.keyframes.ay));
    function at(cl) { var p = { x: Seq.valueAt(c, 'x', cl), y: Seq.valueAt(c, 'y', cl), ax: Seq.valueAt(c, 'ax', cl), ay: Seq.valueAt(c, 'ay', cl) }; return anchorPoint(p, W, H); }
    if (!has) return { animated: false, pts: [], keys: [] };
    var cyc = c.loopMode === 'loop' && c.loopLen ? Math.min(dur, c.loopLen) : dur;
    for (i = 0; i <= N; i++) pts.push(at(cyc * i / N));
    var times = {}; kx.concat(ky).forEach(function (k) { times[k.t.toFixed(4)] = k.t; });
    var keys = Object.keys(times).map(function (k) { return times[k]; }).sort(function (a, b) { return a - b; }).map(function (t) { var q = at(t); return { t: t, x: q[0], y: q[1], hasX: kx.some(function (k) { return Math.abs(k.t - t) < 1e-4; }), hasY: ky.some(function (k) { return Math.abs(k.t - t) < 1e-4; }) }; });
    return { animated: true, pts: pts, keys: keys, cycle: cyc };
  }

  var api = {
    MAX_GUIDES: MAX_GUIDES, CROP_KEYS: CROP_KEYS, TRANSFORM_KEYS: TRANSFORM_KEYS,
    defaultView: defaultView, sanitizeView: sanitizeView, addGuide: addGuide, moveGuide: moveGuide, removeGuide: removeGuide, clearGuides: clearGuides,
    gridLines: gridLines, thirdsLines: thirdsLines, safeRects: safeRects, niceStep: niceStep, rulerTicks: rulerTicks, snapTargets: snapTargets, nearest: nearest,
    anchorOf: anchorOf, compensateAnchor: compensateAnchor, anchorPoint: anchorPoint, resetTransform: resetTransform, toggleFlip: toggleFlip, motionPath: motionPath
  };
  root.ViewerCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
