// Schemas do AI Director: tudo que vem de um modelo de IA é tratado como dado não confiável.
// Aqui a resposta vira um objeto limpo, com limites e tipos garantidos, ou é recusada com motivos claros.
// Lógica pura (sem DOM, sem rede), testável em Node.
(function (root) {
  'use strict';
  var LIM = { objects: 24, surfaces: 16, suggestions: 8, layers: 16, keys: 40, str: 400, dur: [1, 300] };
  var KF_ALLOWED = ['opacity', 'scale', 'x', 'y', 'rot', 'p1', 'p2'];
  var KF_RANGE = { opacity: [0, 1], scale: [0.05, 6], x: [-2, 2], y: [-2, 2], rot: [-720, 720], p1: [0, 1], p2: [0, 2] };
  var SUBJECTS = ['statue', 'building', 'cubes', 'wall', 'object', 'other'];

  function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  function str(v, n) { return typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || LIM.str) : ''; }
  function num(v, d) { v = +v; return isFinite(v) ? v : d; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hex(v, d) { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d; }
  function slug(v, d) { var s = str(v, 40).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, ''); return s || d; }

  // Extrai o primeiro objeto JSON de um texto (modelos às vezes cercam o JSON com ```json ... ```).
  function extractJson(text) {
    if (isObj(text)) return { ok: true, value: text };
    if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'A resposta veio vazia.' };
    var t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    try { var v = JSON.parse(t); if (isObj(v)) return { ok: true, value: v }; } catch (e) {}
    var a = t.indexOf('{'), depth = 0, inStr = false, esc = false, i, ch;
    if (a < 0) return { ok: false, error: 'A resposta não tem JSON.' };
    for (i = a; i < t.length; i++) {
      ch = t[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) break; }
    }
    if (depth !== 0) return { ok: false, error: 'O JSON da resposta está incompleto.' };
    try { var w = JSON.parse(t.slice(a, i + 1)); if (isObj(w)) return { ok: true, value: w }; } catch (e) {}
    return { ok: false, error: 'O JSON da resposta é inválido.' };
  }

  function region(r) {
    if (!isObj(r)) return null;
    var x = clamp(num(r.x, NaN), 0, 1), y = clamp(num(r.y, NaN), 0, 1), w = num(r.w, NaN), h = num(r.h, NaN);
    if (!isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return null;
    return { x: x, y: y, w: clamp(w, 0.005, 1 - x), h: clamp(h, 0.005, 1 - y) };
  }
  function quad(q) {
    if (!Array.isArray(q) || q.length !== 4) return null;
    var out = [];
    for (var i = 0; i < 4; i++) {
      if (!Array.isArray(q[i]) || q[i].length < 2 || !isFinite(+q[i][0]) || !isFinite(+q[i][1])) return null;
      out.push([clamp(+q[i][0], 0, 1), clamp(+q[i][1], 0, 1)]);
    }
    return out;
  }
  function conf(v) { v = num(v, null); return v == null ? null : clamp(v, 0, 1); }

  // ---- Análise de imagem ----
  function validateAnalysis(raw, ctx) {
    ctx = ctx || {};
    var errors = [], warnings = [];
    if (!isObj(raw)) return { ok: false, errors: ['A análise não é um objeto.'], warnings: warnings };
    var objects = [], i, o, r;
    (Array.isArray(raw.objects) ? raw.objects : []).slice(0, LIM.objects).forEach(function (x, k) {
      if (!isObj(x)) return;
      r = region(x.region);
      if (!r) { warnings.push('Detecção ' + (k + 1) + ' sem região válida foi ignorada.'); return; }
      objects.push({ id: slug(x.id, 'obj' + (k + 1)), label: str(x.label, 80) || 'Região ' + (k + 1), region: r, description: str(x.description), confidence: conf(x.confidence),
        kind: ['object', 'surface', 'decor', 'obstacle'].indexOf(x.kind) >= 0 ? x.kind : 'object', animatable: x.animatable !== false });
    });
    var seen = {}; objects.forEach(function (ob, k) { if (seen[ob.id]) ob.id = ob.id + '-' + (k + 1); seen[ob.id] = 1; });
    var surfaces = [];
    (Array.isArray(raw.surfaces) ? raw.surfaces : []).slice(0, LIM.surfaces).forEach(function (x, k) {
      if (!isObj(x)) return; var q = quad(x.quad);
      if (!q) { warnings.push('Superfície ' + (k + 1) + ' sem quadrilátero válido foi ignorada.'); return; }
      surfaces.push({ id: slug(x.id, 'sf' + (k + 1)), label: str(x.label, 80) || 'Superfície ' + (k + 1), quad: q, confidence: conf(x.confidence) });
    });
    var effectIds = ctx.effectIds || [];
    var sugg = [];
    (Array.isArray(raw.suggestions) ? raw.suggestions : []).slice(0, LIM.suggestions).forEach(function (x, k) {
      if (!isObj(x)) return;
      var title = str(x.title, 80); if (!title) return;
      var eff = (Array.isArray(x.effects) ? x.effects : []).map(function (e) { return str(e, 40); }).filter(function (e) { return !effectIds.length || effectIds.indexOf(e) >= 0; }).slice(0, 8);
      if (effectIds.length && !eff.length) { warnings.push('Sugestão "' + title + '" sem efeitos disponíveis foi ignorada.'); return; }
      sugg.push({ id: 'sg' + (k + 1), title: title, description: str(x.description), durationSec: clamp(num(x.durationSec, 10), LIM.dur[0], LIM.dur[1]),
        effects: eff, sequence: (Array.isArray(x.sequence) ? x.sequence : []).slice(0, 10).map(function (s) { return str(s, 160); }).filter(Boolean),
        surfaces: (Array.isArray(x.surfaces) ? x.surfaces : []).slice(0, 12).map(function (s) { return str(s, 40); }).filter(Boolean),
        complexity: ['baixa', 'média', 'media', 'alta'].indexOf(x.complexity) >= 0 ? (x.complexity === 'media' ? 'média' : x.complexity) : 'média',
        prompt: str(x.prompt, 300), resources: (Array.isArray(x.resources) ? x.resources : []).slice(0, 8).map(function (s) { return str(s, 80); }).filter(Boolean) });
    });
    var subject = SUBJECTS.indexOf(raw.subject) >= 0 ? raw.subject : 'other';
    if (!objects.length && !surfaces.length && !sugg.length) errors.push('A resposta não trouxe nenhuma detecção, superfície ou sugestão utilizável.');
    var colors = (Array.isArray(raw.dominantColors) ? raw.dominantColors : []).map(function (c) { return hex(c, null); }).filter(Boolean).slice(0, 6);
    return { ok: errors.length === 0, errors: errors, warnings: warnings, value: {
      subject: subject, summary: str(raw.summary), material: str(raw.material, 120), dominantColors: colors, objects: objects, surfaces: surfaces,
      difficulties: (Array.isArray(raw.difficulties) ? raw.difficulties : []).slice(0, 8).map(function (s) { return str(s, 200); }).filter(Boolean), suggestions: sugg } };
  }

  // ---- Plano de animação ----
  function keyframes(kf, dur, errors, where) {
    var out = {};
    if (!isObj(kf)) return out;
    Object.keys(kf).forEach(function (p) {
      if (KF_ALLOWED.indexOf(p) < 0) { errors.push(where + ': propriedade "' + p + '" não é permitida em keyframes.'); return; }
      if (!Array.isArray(kf[p])) return;
      var r = KF_RANGE[p], arr = kf[p].slice(0, LIM.keys).filter(isObj).map(function (k) {
        return { t: clamp(num(k.t, 0), 0, dur), v: clamp(num(k.v, 0), r[0], r[1]), i: k.i === 'hold' || k.i === 'ease' ? k.i : 'linear' };
      }).sort(function (a, b) { return a.t - b.t; });
      if (arr.length) out[p] = arr;
    });
    return out;
  }
  // ctx: { effectIds:[...], validateGlsl(src)->{ok,error}, surfaceKeys:[...] }
  function validatePlan(raw, ctx) {
    ctx = ctx || {};
    var errors = [], warnings = [], effectIds = ctx.effectIds || [];
    if (!isObj(raw)) return { ok: false, errors: ['O plano não é um objeto.'], warnings: warnings };
    var duration = clamp(num(raw.duration, 10), LIM.dur[0], LIM.dur[1]);
    var layers = [];
    (Array.isArray(raw.layers) ? raw.layers : []).slice(0, LIM.layers).forEach(function (L, k) {
      var where = 'Camada ' + (k + 1);
      if (!isObj(L)) { errors.push(where + ' não é um objeto.'); return; }
      var eff = str(L.effect, 40), glsl = null;
      if (eff === 'glsl') {
        glsl = typeof L.glsl === 'string' ? L.glsl : '';
        var v = ctx.validateGlsl ? ctx.validateGlsl(glsl) : { ok: false, error: 'Validador de shader indisponível.' };
        if (!v.ok) { errors.push(where + ': shader recusado (' + (v.error || 'inválido') + ').'); return; }
      } else if (effectIds.indexOf(eff) < 0) { errors.push(where + ': efeito "' + eff + '" não existe na biblioteca.'); return; }
      var start = clamp(num(L.start, 0), 0, duration), d = clamp(num(L.duration, duration - start), 0.1, duration - start || 0.1);
      var target = L.target === 'each' || L.target === 'all' ? L.target : (Array.isArray(L.target) ? L.target.map(function (s) { return str(s, 60); }).filter(Boolean).slice(0, 24) : 'all');
      if (Array.isArray(target) && ctx.surfaceKeys) {
        var ok = target.filter(function (s) { return ctx.surfaceKeys.indexOf(s) >= 0; });
        if (ok.length !== target.length) warnings.push(where + ': alguma superfície do plano não existe no projeto e foi ignorada.');
        target = ok.length ? ok : 'all';
      }
      layers.push({ name: str(L.name, 60) || ('Camada ' + (k + 1)), effect: eff, glsl: glsl, color: hex(L.color, '#ff4fa3'), color2: hex(L.color2, null), speed: clamp(num(L.speed, 1), 0.1, 6), scale: clamp(num(L.scale, 1), 0.2, 4),
        start: start, duration: d, target: target, stagger: clamp(num(L.stagger, 0), 0, 10), opacity: clamp(num(L.opacity, 1), 0, 1), fadeIn: clamp(num(L.fadeIn, 0), 0, d), fadeOut: clamp(num(L.fadeOut, 0), 0, d),
        keyframes: keyframes(L.keyframes, d, errors, where), maskRef: L.maskRef ? str(L.maskRef, 60) : null, beatSync: L.beatSync === true });
    });
    if (!layers.length && !errors.length) errors.push('O plano não tem nenhuma camada.');
    return { ok: errors.length === 0, errors: errors, warnings: warnings, value: { title: str(raw.title, 80) || 'Animação', duration: duration, layers: layers, notes: str(raw.notes), source: raw.source === 'ai' ? 'ai' : 'local' } };
  }

  var api = { LIM: LIM, KF_ALLOWED: KF_ALLOWED, extractJson: extractJson, validateAnalysis: validateAnalysis, validatePlan: validatePlan };
  root.AiSchema = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
