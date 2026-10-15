// Ponte entre um Animation Plan validado e a timeline real. Só usa as funções normais do editor
// (addLayer, addAsset, addClip, setKey): o resultado são faixas, clipes e keyframes comuns, editáveis à mão.
// Não toca em surface.q, máscaras de calibração, Mesh Warp nem em clipes que já existem.
(function (root) {
  'use strict';
  var Seq = root.Sequence || (typeof require !== 'undefined' ? require('../sequence.js') : null);
  var history = [];   // histórico de operações (sem imagens nem chaves)

  function beatKeys(clip, beats, start, dur) {
    var n = 0;
    beats.forEach(function (b) {
      if (b < start || b > start + dur || n > 200) return;
      var cl = b - start;
      Seq.setKey(clip, 'p2', Math.max(0, cl - 0.001), 0, 'linear'); Seq.setKey(clip, 'p2', cl, 1.5, 'linear'); Seq.setKey(clip, 'p2', Math.min(dur, cl + 0.16), 0, 'ease'); n++;
    });
    return n;
  }

  // Aplica o plano em uma sequência. surfaces: [{key,name}]. opts: { at, beats, masks:{ref:dataUrl}, mask }
  function applyToSeq(seq, plan, surfaces, opts) {
    opts = opts || {};
    var at = Math.max(0, opts.at || 0), batch = { id: Seq.nid('ai'), title: plan.title, at: at, trackIds: [], clipIds: [], assetIds: [], warnings: [], t: Date.now() };
    var keys = surfaces.map(function (s) { return s.key; });
    if (!keys.length) { batch.warnings.push('O projeto não tem superfícies.'); return batch; }
    plan.layers.forEach(function (L) {
      var asset = Seq.addAsset(seq, { kind: 'fx', name: 'IA · ' + L.name, fx: (function () {
        var f = { kind: L.effect === 'glsl' ? 'glsl' : L.effect, color: L.color, speed: L.speed, scale: L.scale };
        if (L.color2) f.color2 = L.color2;
        if (L.glsl) f.glsl = L.glsl;
        var m = L.maskRef && opts.masks ? opts.masks[L.maskRef] : (opts.mask || null);
        if (m) { f.mask = m; if (opts.maskInvert) f.maskInvert = true; }
        f.ai = { plan: plan.title, layer: L.name, source: plan.source };
        return f;
      })() });
      batch.assetIds.push(asset.id);
      var list = L.target === 'all' || !L.target ? keys : (L.target === 'each' ? keys : L.target.filter(function (k) { return keys.indexOf(k) >= 0; }));
      list.forEach(function (key, i) {
        var tr = Seq.addLayer(seq, key, 'IA · ' + L.name);
        if (!tr) return;
        batch.trackIds.push(tr.id);
        var start = at + L.start + (L.target === 'each' ? i * (L.stagger || 0) : 0);
        var c = Seq.addClip(seq, tr.id, asset, start, L.duration);
        if (!c) return;
        c.fadeIn = L.fadeIn; c.fadeOut = L.fadeOut; c.opacity = L.opacity;
        Object.keys(L.keyframes || {}).forEach(function (p) { L.keyframes[p].forEach(function (k) { Seq.setKey(c, p, k.t, k.v, k.i); }); });
        if (L.beatSync) {
          if (opts.beats && opts.beats.length) { var n = beatKeys(c, opts.beats, start, L.duration); if (!n && i === 0) batch.warnings.push('Nenhuma batida cai dentro de "' + L.name + '".'); }
          else { Seq.setBase(c, 'p2', 0.5); if (i === 0) batch.warnings.push('"' + L.name + '" pede sincronia com a música, mas não há batidas detectadas. Analise o áudio primeiro.'); }
        }
        batch.clipIds.push(c.id);
      });
    });
    return batch;
  }

  // Aplica no projeto aberto. host: { seq(), surfaces():[{key,name}], checkpoint, push, syncClock, renderAll, setOn?, now() }
  function apply(plan, host, opts) {
    opts = Object.assign({ at: host.now ? host.now() : 0 }, opts || {});
    host.checkpoint('ai-apply');
    var seq = host.seq();
    var b = applyToSeq(seq, plan, host.surfaces(), opts);
    if (b.clipIds.length) { history.push(b); if (host.setOn) host.setOn(true); }
    host.syncClock(); host.push(); host.renderAll();
    return b;
  }
  // Desfaz uma geração (a última por padrão): remove só o que a IA criou, nunca clipes do usuário.
  function undo(host, id) {
    var b = id ? history.filter(function (x) { return x.id === id; })[0] : history[history.length - 1];
    if (!b) return null;
    host.checkpoint('ai-undo');
    var seq = host.seq();
    b.clipIds.forEach(function (cid) { Seq.removeClip(seq, cid); });
    b.trackIds.forEach(function (tid) { var t = Seq.track(seq, tid); if (t && !t.clips.length) Seq.removeTrack(seq, tid); });
    b.assetIds.forEach(function (aid) {
      var used = seq.tracks.some(function (t) { return t.clips.some(function (c) { return c.assetId === aid; }); });
      if (!used) { var i = seq.assets.findIndex(function (a) { return a.id === aid; }); if (i >= 0) seq.assets.splice(i, 1); }
    });
    history.splice(history.indexOf(b), 1);
    host.syncClock(); host.push(); host.renderAll();
    return b;
  }
  // Resumo do que o plano vai mudar na timeline (mostrado antes de aplicar).
  function summarize(plan, surfaces) {
    var n = surfaces.length, tracks = 0, clips = 0;
    plan.layers.forEach(function (L) { var k = L.target === 'all' || L.target === 'each' ? n : (Array.isArray(L.target) ? L.target.length : n); tracks += k; clips += k; });
    return { layers: plan.layers.length, tracks: tracks, clips: clips, duration: plan.duration, surfaces: n };
  }
  // Desenha um quadro da prévia: avalia a sequência no tempo T e pinta os efeitos de uma face. Mesmo caminho do projetor.
  function renderFrame(seq, T, key, canvas) {
    var W = canvas.width, H = canvas.height, ctx = canvas.getContext('2d'), ev = Seq.evaluate(seq, T), list = ev.video[key] || [], tmp = canvas._tmp || (canvas._tmp = document.createElement('canvas'));
    ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, W, H);
    list.forEach(function (e) {
      if (e.asset.kind !== 'fx' || !root.Renderer || !root.Renderer.drawFx) return;
      var fx = Object.assign({}, e.asset.fx, { p1: e.ev.p1, p2: e.ev.p2 });
      root.Renderer.drawFx(tmp, { w: W, h: H, fx: fx }, e.ev.tms);
      ctx.globalAlpha = e.ev.opacity; ctx.drawImage(tmp, 0, 0); ctx.globalAlpha = 1;
    });
  }
  var api = { applyToSeq: applyToSeq, apply: apply, undo: undo, summarize: summarize, renderFrame: renderFrame, history: function () { return history.slice(); } };
  root.AiTimelineBridge = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
