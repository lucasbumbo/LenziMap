// Análise musical determinística: batidas, BPM e mudanças de intensidade a partir das amostras do áudio.
// Mesmo áudio, mesmo resultado. A IA só interpreta o estilo; os tempos de sincronia vêm daqui.
(function (root) {
  'use strict';
  // samples: Float32Array mono (ou já misturado). Retorna tempos em segundos.
  function analyze(samples, sr, o) {
    o = o || {};
    var hop = Math.max(64, Math.round(sr * 0.010)), win = hop * 2, n = Math.floor((samples.length - win) / hop), i, j;
    if (n < 8) return { beats: [], bpm: null, changes: [], duration: samples.length / sr, confidence: 0 };
    // filtro passa-baixa simples (realça bumbo/baixo) e energia por janela
    var lp = 0, a = 0.08, energy = new Float32Array(n);
    var low = new Float32Array(samples.length);
    for (i = 0; i < samples.length; i++) { lp += a * (samples[i] - lp); low[i] = lp; }
    for (i = 0; i < n; i++) { var s = 0, b = i * hop; for (j = 0; j < win; j++) { var v = low[b + j]; s += v * v; } energy[i] = Math.sqrt(s / win); }
    // fluxo positivo e limiar adaptativo
    var flux = new Float32Array(n);
    for (i = 1; i < n; i++) flux[i] = Math.max(0, energy[i] - energy[i - 1]);
    var half = Math.round(0.5 / (hop / sr)), beats = [], last = -1e9, minGap = o.minGap || 0.25;
    for (i = 1; i < n - 1; i++) {
      var lo = Math.max(0, i - half), hi = Math.min(n, i + half), m = 0;
      for (j = lo; j < hi; j++) m += flux[j];
      m /= (hi - lo);
      var thr = m * 1.8 + 0.0025;
      if (flux[i] > thr && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]) {
        var t = (i * hop + win / 2) / sr;
        if (t - last >= minGap) { beats.push(+t.toFixed(3)); last = t; }
      }
    }
    // BPM: intervalo mais comum entre batidas, dobrado/dividido para a faixa 70..180
    var bpm = null, conf = 0;
    if (beats.length >= 4) {
      var bins = {}, best = 0, bestK = null;
      for (i = 1; i < beats.length; i++) {
        var d = beats[i] - beats[i - 1]; if (d <= 0) continue;
        var bp = 60 / d; while (bp < 70) bp *= 2; while (bp > 180) bp /= 2;
        var key = Math.round(bp); bins[key] = (bins[key] || 0) + 1;
      }
      Object.keys(bins).forEach(function (kk) { var c = bins[kk] + (bins[+kk - 1] || 0) + (bins[+kk + 1] || 0); if (c > best) { best = c; bestK = +kk; } });
      if (bestK) { bpm = bestK; conf = Math.min(1, best / (beats.length - 1)); }
    }
    // mudanças de intensidade: RMS de 1 s comparado ao anterior
    var w1 = Math.round(1 / (hop / sr)), changes = [], prev = null;
    for (i = 0; i + w1 <= n; i += w1) {
      var e = 0; for (j = 0; j < w1; j++) e += energy[i + j];
      e /= w1;
      if (prev != null && prev > 0.0008 && (e / prev > 1.7 || e / prev < 0.55)) changes.push({ t: +(i * hop / sr).toFixed(2), kind: e > prev ? 'sobe' : 'cai' });
      prev = e;
    }
    return { beats: beats, bpm: bpm, changes: changes, duration: samples.length / sr, confidence: +conf.toFixed(2) };
  }
  var api = { analyze: analyze };
  root.AudioAnalysis = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
