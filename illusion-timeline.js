// LenziMap 3.2: ponte entre uma ilusão 3D validada e a timeline real. Só usa as funções normais da sequência
// (addAsset, addLayer, addClip, setKey), então o resultado é feito de faixas, clipes e keyframes comuns, editáveis à mão.
// Hierarquia: Ilusão (asset compartilhado) -> um clipe por face ligada -> keyframes "ill.<parâmetro>" em cada clipe.
// Nunca mexe em surface.q, máscara, malha nem em clipes que o usuário já tinha.
(function (root) {
  'use strict';
  var Seq = root.Sequence || (typeof require !== 'undefined' ? require('./sequence.js') : null);
  var IC = root.IllusionCore || (typeof require !== 'undefined' ? require('./illusion-core.js') : null);
  var history = [];

  function ensureStage(seq) { seq.stage = IC.fixStage(seq.stage); return seq.stage; }

  // Faces do alvo que têm superfície ligada: [{face, key}]. As sem superfície vão pra warnings.
  function targetKeys(stage, il) {
    var cube = IC.cubeById(stage, il.target.cube), out = [], miss = [];
    if (!cube) return { list: out, missing: il.target.faces.slice(), cube: null };
    il.target.faces.forEach(function (f) { if (cube.faces[f]) out.push({ face: f, key: cube.faces[f] }); else miss.push(f); });
    return { list: out, missing: miss, cube: cube };
  }

  // Aplica a ilusão. opts: { at, duration, keys:[{param,t,v,i}], surfaceKeys (limita às superfícies existentes) }
  function applyToSeq(seq, il, opts) {
    opts = opts || {};
    var v = IC.validate(il, ensureStage(seq));
    if (!v.ok) return { ok: false, errors: v.errors, clipIds: [], trackIds: [], warnings: [] };
    il = v.value;
    var stage = seq.stage, tk = targetKeys(stage, il), warnings = v.warnings.slice();
    var at = Math.max(0, opts.at || 0), dur = Math.max(0.5, opts.duration || 8);
    var batch = { ok: true, id: Seq.nid('il'), assetId: null, clipIds: [], trackIds: [], warnings: warnings, at: at, t: Date.now(), name: il.name };
    var existing = opts.surfaceKeys || null;
    var list = tk.list.filter(function (x) { if (existing && existing.indexOf(x.key) < 0) { warnings.push('A superfície da face ' + IC.FACE_LABEL[x.face] + ' não existe mais, pulei.'); return false; } return true; });
    tk.missing.forEach(function (f) { warnings.push('A face ' + IC.FACE_LABEL[f] + ' do ' + (tk.cube ? tk.cube.name : 'cubo') + ' não tem superfície ligada, pulei.'); });
    if (!list.length) { batch.ok = false; warnings.push('Nenhuma face do alvo tem superfície ligada. Ligue pelo menos uma face no painel 3D.'); return batch; }
    var asset = Seq.addAsset(seq, { kind: 'fx', name: '3D · ' + il.name, fx: { kind: 'illusion', color: il.style.color1, speed: 1, scale: 1, illusion: il } });
    batch.assetId = asset.id;
    var keys = IC.validateKeys(opts.keys || [], dur);
    keys.warnings.forEach(function (w) { warnings.push(w); });
    var usedKey = {};
    list.forEach(function (x) { if (usedKey[x.key]) warnings.push('A face ' + IC.FACE_LABEL[x.face] + ' usa a mesma superfície da face ' + IC.FACE_LABEL[usedKey[x.key]] + '. Ligue superfícies diferentes.'); else usedKey[x.key] = x.face; });
    list.forEach(function (x) {
      try {
        var rf = IC.resolveFace(stage, il, null, x.key, 0), rel = [rf.eye[0] - rf.frame.center[0], rf.eye[1] - rf.frame.center[1], rf.eye[2] - rf.frame.center[2]];
        var dl = Math.sqrt(rel[0] * rel[0] + rel[1] * rel[1] + rel[2] * rel[2]) || 1, el = Math.asin(Math.max(-1, Math.min(1, (rel[0] * rf.frame.n[0] + rel[1] * rf.frame.n[1] + rel[2] * rf.frame.n[2]) / dl))) * 180 / Math.PI;
        if (el > 0 && el < 25 && !(x.face === 'top' && il.camera.assist !== false)) warnings.push('A face ' + IC.FACE_LABEL[x.face] + ' é vista de raspão pelo público (' + Math.round(el) + ' graus). O interior aparece só em uma faixa fina e pisca conforme a animação passa. Suba o ponto de vista do público ou use outro efeito nessa face.');
      } catch (e) {}
      var tr = Seq.addLayer(seq, x.key, '3D · ' + il.name);
      if (!tr) return;
      batch.trackIds.push(tr.id);
      var c = Seq.addClip(seq, tr.id, asset, at, dur);
      if (!c) return;
      c.name = il.name + ' · ' + IC.FACE_LABEL[x.face];
      c.ill = {};
      IC.KF_PARAMS.forEach(function (n) { c.ill[n] = il.params[n]; });
      keys.keys.forEach(function (k) { Seq.setKey(c, 'ill.' + k.param, k.t, k.v, k.i); });
      batch.clipIds.push(c.id);
    });
    history.push(batch);
    return batch;
  }

  function clipsOfAsset(seq, assetId) {
    var out = [];
    seq.tracks.forEach(function (t) { t.clips.forEach(function (c) { if (c.assetId === assetId) out.push({ clip: c, track: t }); }); });
    return out;
  }
  function illusionOf(seq, assetId) {
    var a = Seq.asset(seq, assetId);
    return a && a.fx && a.fx.kind === 'illusion' && a.fx.illusion ? a.fx.illusion : null;
  }
  // Troca a ilusão de um asset (valida de novo). Os valores base animáveis só mudam nos clipes que não têm keyframe naquele parâmetro.
  function update(seq, assetId, next) {
    var a = Seq.asset(seq, assetId);
    if (!a || !a.fx || a.fx.kind !== 'illusion') return { ok: false, errors: ['Esse asset não é uma ilusão 3D.'], warnings: [] };
    var v = IC.validate(next, ensureStage(seq));
    if (!v.ok) return { ok: false, errors: v.errors, warnings: v.warnings };
    var old = a.fx.illusion;
    v.value.id = old && old.id ? old.id : v.value.id;
    a.fx.illusion = v.value; a.fx.color = v.value.style.color1; a.name = '3D · ' + v.value.name;
    clipsOfAsset(seq, assetId).forEach(function (x) {
      x.clip.ill = x.clip.ill || {};
      IC.KF_PARAMS.forEach(function (n) {
        var kfs = x.clip.keyframes['ill.' + n];
        if (kfs && kfs.length) return;
        x.clip.ill[n] = v.value.params[n];
      });
    });
    return { ok: true, value: v.value, warnings: v.warnings };
  }
  // Cria keyframe de um parâmetro em todos os clipes da ilusão, no tempo de sequência T (cada clipe usa seu tempo local).
  function keyAt(seq, assetId, param, T, value, how) {
    if (!IC.PARAMS[param] || !IC.PARAMS[param].kf) return 0;
    var n = 0;
    clipsOfAsset(seq, assetId).forEach(function (x) {
      var c = x.clip, local = T - c.start;
      if (local < 0 || local > c.duration) return;
      Seq.setKey(c, 'ill.' + param, local, Math.max(IC.PARAMS[param].min, Math.min(IC.PARAMS[param].max, value)), how || 'ease');
      n++;
    });
    return n;
  }
  function removeAll(seq, batchOrAsset) {
    var aid = typeof batchOrAsset === 'string' ? batchOrAsset : batchOrAsset.assetId, n = 0;
    clipsOfAsset(seq, aid).forEach(function (x) { Seq.removeClip(seq, x.clip.id); n++; if (!x.track.clips.length) Seq.removeTrack(seq, x.track.id); });
    var i = seq.assets.findIndex(function (a) { return a.id === aid; }); if (i >= 0) seq.assets.splice(i, 1);
    return n;
  }
  // Desfaz uma aplicação da IA (ou do painel): remove só o que ela criou
  function undo(host, id) {
    var b = id ? history.filter(function (x) { return x.id === id; })[0] : history[history.length - 1];
    if (!b) return null;
    host.checkpoint('il-undo');
    removeAll(host.seq(), b);
    history.splice(history.indexOf(b), 1);
    host.syncClock(); host.push(); host.renderAll();
    return b;
  }
  function apply(il, host, opts) {
    opts = Object.assign({ at: host.now ? host.now() : 0 }, opts || {});
    host.checkpoint('il-apply');
    var seq = host.seq();
    if (!opts.surfaceKeys && host.surfaces) opts.surfaceKeys = host.surfaces().map(function (s) { return s.key; });
    var b = applyToSeq(seq, il, opts);
    if (b.clipIds.length && host.setOn) host.setOn(true);
    host.syncClock(); host.push(); host.renderAll();
    return b;
  }

  // Resumo pra mostrar na lista de clipes/IA: ilusões presentes na sequência
  function list(seq) {
    var out = [];
    seq.assets.forEach(function (a) { if (a.fx && a.fx.kind === 'illusion' && a.fx.illusion) out.push({ assetId: a.id, il: a.fx.illusion, clips: clipsOfAsset(seq, a.id).length }); });
    return out;
  }

  // Receitas de keyframe rápidas por preset (valores dentro das faixas, duração em segundos)
  var QUICK = {
    'infinite-room': [{ label: 'Avançar na sala', keys: function (d) { return [{ param: 'travel', t: 0, v: 0 }, { param: 'travel', t: d, v: 160, i: 'linear' }]; } }],
    'infinite-tunnel': [{ label: 'Acelerar o túnel', keys: function (d) { return [{ param: 'travel', t: 0, v: 0, i: 'easein' }, { param: 'travel', t: d, v: 400 }]; } }],
    'opening-cube': [{ label: 'Abrir e fechar', keys: function (d) { return [{ param: 'open', t: 0, v: 0 }, { param: 'open', t: d * 0.4, v: 1 }, { param: 'open', t: d * 0.7, v: 1, i: 'hold' }, { param: 'open', t: d, v: 0 }]; } }],
    'breaking-surface': [{ label: 'Quebrar', keys: function (d) { return [{ param: 'brk', t: 0, v: 0, i: 'easein' }, { param: 'brk', t: d * 0.6, v: 1 }]; } }],
    'object-inside': [{ label: 'Objeto passeia', keys: function (d) { return [{ param: 'ox', t: 0, v: -10 }, { param: 'ox', t: d / 2, v: 10 }, { param: 'ox', t: d, v: -10 }]; } }],
    'object-emerging': [{ label: 'Sair da face', keys: function (d) { return [{ param: 'oz', t: 0, v: -10, i: 'easein' }, { param: 'oz', t: d * 0.6, v: 34 }]; } }],
    'mechanical-interior': [{ label: 'Luz pulsa', keys: function (d) { return [{ param: 'light', t: 0, v: 0.6 }, { param: 'light', t: d / 2, v: 1.6 }, { param: 'light', t: d, v: 0.6 }]; } }]
  };

  root.IllusionTimeline = { ensureStage: ensureStage, targetKeys: targetKeys, applyToSeq: applyToSeq, apply: apply, update: update, keyAt: keyAt, clipsOfAsset: clipsOfAsset, illusionOf: illusionOf, removeAll: removeAll, undo: undo, list: list, QUICK: QUICK, history: history };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.IllusionTimeline;
})(typeof window !== 'undefined' ? window : globalThis);
