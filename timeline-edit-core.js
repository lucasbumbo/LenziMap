// LenziMap: edições avançadas da timeline (lógica pura, sem DOM). Ripple, Roll, Slip, Slide, seleção por intervalo, alinhamento e marcadores.
// REGRA DE OURO: nenhuma operação mexe em outra faixa além das que o usuário escolheu. Ripple e Close Gaps só deslocam clipes
// da MESMA faixa, e faixas travadas nunca são alteradas. O modo de tempo absoluto continua sendo o padrão.
(function (root) {
  'use strict';
  var Seq = root.Sequence || (typeof require === 'function' ? require('./sequence.js') : null);
  var EPS = 0.001, MIN = 0.04;

  function isMedia(a) { return !!a && (a.kind === 'video' || a.kind === 'audio'); }
  function end(c) { return c.start + c.duration; }
  function info(seq, id) { var f = Seq.findClip(seq, id); return f ? { clip: f.clip, track: f.track, asset: Seq.asset(seq, f.clip.assetId), index: f.index } : null; }
  function sorted(tr) { return tr.clips.slice().sort(function (a, b) { return a.start - b.start; }); }
  function fail(why) { return { ok: false, reason: why, moved: [] }; }
  function ok(moved, extra) { var r = { ok: true, moved: moved || [] }; for (var k in (extra || {})) r[k] = extra[k]; return r; }

  // ---------- seleção ----------
  function trackIndex(seq, id) { for (var i = 0; i < seq.tracks.length; i++) if (seq.tracks[i].id === id) return i; return -1; }
  // Retângulo de seleção: clipes que cruzam [t0,t1] nas faixas entre os índices ia e ib (inclusive)
  function selectRect(seq, t0, t1, ia, ib) {
    var lo = Math.min(t0, t1), hi = Math.max(t0, t1), a = Math.min(ia, ib), b = Math.max(ia, ib), ids = [];
    seq.tracks.forEach(function (tr, i) { if (i < a || i > b) return; tr.clips.forEach(function (c) { if (end(c) > lo + EPS && c.start < hi - EPS) ids.push(c.id); }); });
    return ids;
  }
  // Seleção por intervalo (Shift+clique): do clipe âncora até o clicado, nas faixas entre os dois
  function selectRange(seq, anchorId, targetId) {
    var A = info(seq, anchorId), T = info(seq, targetId);
    if (!A || !T) return T ? [targetId] : [];
    var ia = trackIndex(seq, A.track.id), ib = trackIndex(seq, T.track.id);
    if (ia === ib) {
      var lo = Math.min(A.clip.start, T.clip.start), hi = Math.max(A.clip.start, T.clip.start);
      return A.track.clips.filter(function (c) { return c.start >= lo - EPS && c.start <= hi + EPS; }).map(function (c) { return c.id; });
    }
    var t0 = Math.min(A.clip.start, T.clip.start), t1 = Math.max(end(A.clip), end(T.clip));
    return selectRect(seq, t0, t1, ia, ib);
  }
  // Tudo que começa em t ou depois (numa faixa, ou em todas quando trackId é null). Faixas travadas ficam de fora.
  function selectForward(seq, t, trackId) {
    var ids = [];
    seq.tracks.forEach(function (tr) {
      if (trackId && tr.id !== trackId) return;
      tr.clips.forEach(function (c) { if (end(c) > t + EPS) ids.push(c.id); });
    });
    return ids;
  }
  function selectTrack(seq, trackId) { var tr = Seq.track(seq, trackId); return tr ? tr.clips.map(function (c) { return c.id; }) : []; }
  function bounds(seq, ids) {
    var lo = Infinity, hi = -Infinity;
    ids.forEach(function (id) { var i = info(seq, id); if (i) { lo = Math.min(lo, i.clip.start); hi = Math.max(hi, end(i.clip)); } });
    return lo === Infinity ? null : { start: lo, end: hi };
  }

  // ---------- pontos de edição ----------
  function editPoints(seq, includeMarkers) {
    var set = {};
    seq.tracks.forEach(function (tr) { tr.clips.forEach(function (c) { set[c.start.toFixed(4)] = c.start; set[end(c).toFixed(4)] = end(c); }); });
    if (includeMarkers) seq.markers.forEach(function (m) { set[m.t.toFixed(4)] = m.t; });
    return Object.keys(set).map(function (k) { return set[k]; }).sort(function (a, b) { return a - b; });
  }
  function nextEdit(seq, t, dir, includeMarkers) {
    var pts = editPoints(seq, includeMarkers), i;
    if (dir > 0) { for (i = 0; i < pts.length; i++) if (pts[i] > t + 0.002) return pts[i]; return null; }
    for (i = pts.length - 1; i >= 0; i--) if (pts[i] < t - 0.002) return pts[i];
    return null;
  }

  // ---------- Ripple ----------
  // Ripple Trim: mexe na borda e desloca só os clipes seguintes DA MESMA FAIXA pela diferença de duração.
  function rippleTrim(seq, id, side, t) {
    var I = info(seq, id); if (!I) return fail('clipe não encontrado');
    if (I.track.locked) return fail('faixa travada');
    var c = I.clip, oldStart = c.start, oldEnd = end(c), oldDur = c.duration;
    var followers = I.track.clips.filter(function (x) { return x !== c && x.start >= oldEnd - EPS; });
    if (side === 'r') Seq.trimClip(seq, id, 'r', t);
    else { Seq.trimClip(seq, id, 'l', t); c.start = oldStart; }
    var delta = c.duration - oldDur;
    followers.forEach(function (x) { x.start = Math.max(0, x.start + delta); });
    var last = end(c); followers.forEach(function (x) { last = Math.max(last, end(x)); });
    if (last > seq.duration) seq.duration = Math.ceil(last);
    return ok([c.id].concat(followers.map(function (x) { return x.id; })), { delta: delta });
  }
  // Ripple Delete: apaga clipes e fecha o buraco só na faixa de cada um.
  function rippleDelete(seq, ids) {
    var moved = [], removed = 0, byTrack = {};
    ids.forEach(function (id) { var I = info(seq, id); if (I && !I.track.locked) (byTrack[I.track.id] = byTrack[I.track.id] || []).push(I.clip); });
    Object.keys(byTrack).forEach(function (tid) {
      var tr = Seq.track(seq, tid), gone = byTrack[tid].slice().sort(function (a, b) { return a.start - b.start; });
      // da direita pra esquerda para os tempos antigos continuarem valendo
      gone.slice().reverse().forEach(function (g) {
        var s = g.start, e = end(g), len = g.duration;
        tr.clips = tr.clips.filter(function (x) { return x !== g; }); removed++;
        tr.clips.forEach(function (x) { if (gone.indexOf(x) < 0 && x.start >= e - EPS) { x.start = Math.max(0, x.start - len); if (moved.indexOf(x.id) < 0) moved.push(x.id); } });
      });
    });
    return ok(moved, { removed: removed });
  }
  // Fecha os buracos de UMA faixa. O primeiro clipe fica onde está.
  function closeGaps(seq, trackId) {
    var tr = Seq.track(seq, trackId); if (!tr) return fail('faixa não encontrada');
    if (tr.locked) return fail('faixa travada');
    var list = sorted(tr), moved = [], at = list.length ? end(list[0]) : 0;
    for (var i = 1; i < list.length; i++) {
      var c = list[i];
      if (c.start > at + EPS) { c.start = at; moved.push(c.id); }
      at = Math.max(at, end(c));
    }
    return ok(moved);
  }

  // ---------- Roll ----------
  // Roll: move o corte entre A e B (A termina onde B começa). A duração total das duas não muda.
  function rollEdit(seq, idA, idB, t) {
    var A = info(seq, idA), B = info(seq, idB);
    if (!A || !B) return fail('clipe não encontrado');
    if (A.track !== B.track) return fail('clipes em faixas diferentes');
    if (A.track.locked) return fail('faixa travada');
    if (Math.abs(end(A.clip) - B.clip.start) > 0.01) return fail('os clipes não são vizinhos');
    var a = A.clip, b = B.clip, cut0 = b.start, aOld = { dur: a.duration }, bOld = { start: b.start, dur: b.duration, inP: b.inPoint };
    var lo = a.start + MIN, hi = end(b) - MIN;
    // limite de B pra trás: não pode voltar antes do começo da mídia
    if (isMedia(B.asset) && b.loopMode !== 'loop') lo = Math.max(lo, b.start - b.inPoint / b.speed);
    // limite de A pra frente: não passa do fim da mídia
    if (isMedia(A.asset) && a.loopMode !== 'loop' && A.asset.duration) hi = Math.min(hi, a.start + (A.asset.duration - a.inPoint) / a.speed);
    t = Math.max(lo, Math.min(hi, t));
    if (lo > hi) return fail('sem folga');
    var d = t - cut0;
    a.duration = t - a.start;
    b.start = t; b.duration = bOld.dur - d;
    if (isMedia(B.asset) && b.loopMode !== 'loop') b.inPoint = Math.max(0, bOld.inP + d * b.speed);
    return ok([a.id, b.id], { cut: t, delta: d });
  }

  // ---------- Slip ----------
  // Slip: muda QUAL pedaço da mídia aparece, sem mexer em início nem duração do clipe.
  function slipClip(seq, id, deltaSrc) {
    var I = info(seq, id); if (!I) return fail('clipe não encontrado');
    if (I.track.locked) return fail('faixa travada');
    var c = I.clip, a = I.asset;
    if (!isMedia(a)) return fail('slip só vale pra vídeo e áudio');
    if (c.loopMode === 'loop') return fail('clipe em loop não tem folga pra slip');
    var span = c.duration * c.speed, maxIn = Math.max(0, (a.duration || 0) - span), cur = c.inPoint;
    var ni = Math.max(0, Math.min(maxIn, cur + deltaSrc));
    if (a.duration && a.duration > 0 && maxIn <= 0 && cur <= 0) return fail('o clipe já usa a mídia inteira');
    c.inPoint = ni;
    if (c.outPoint != null) c.outPoint = Math.min(a.duration || ni + span, ni + span);
    return ok([c.id], { inPoint: ni, applied: ni - cur });
  }

  // ---------- Slide ----------
  // Slide: move o clipe e ajusta os vizinhos (anterior termina e seguinte começa junto), mantendo o tempo total.
  function slideClip(seq, id, newStart) {
    var I = info(seq, id); if (!I) return fail('clipe não encontrado');
    if (I.track.locked) return fail('faixa travada');
    var c = I.clip, tr = I.track, list = sorted(tr), i = list.indexOf(c);
    var prev = i > 0 && Math.abs(end(list[i - 1]) - c.start) < 0.01 ? list[i - 1] : null;
    var next = i < list.length - 1 && Math.abs(end(c) - list[i + 1].start) < 0.01 ? list[i + 1] : null;
    var d = Math.max(0, newStart) - c.start;
    var pa = prev ? Seq.asset(seq, prev.assetId) : null, na = next ? Seq.asset(seq, next.assetId) : null;
    if (prev) {
      d = Math.max(d, -(prev.duration - MIN));
      if (isMedia(pa) && prev.loopMode !== 'loop' && pa.duration) d = Math.min(d, (pa.duration - prev.inPoint) / prev.speed - prev.duration);
    }
    if (next) {
      d = Math.min(d, next.duration - MIN);
      if (isMedia(na) && next.loopMode !== 'loop') {
        d = Math.max(d, -next.inPoint / next.speed);
        if (na.duration) d = Math.min(d, (na.duration - next.inPoint) / next.speed);
      }
    }
    if (c.start + d < 0) d = -c.start;
    if (Math.abs(d) < 1e-9) return ok([], { delta: 0 });
    c.start += d;
    var moved = [c.id];
    if (prev) { prev.duration += d; moved.push(prev.id); }
    if (next) {
      next.start += d; next.duration -= d;
      if (isMedia(na) && next.loopMode !== 'loop') next.inPoint = Math.max(0, next.inPoint + d * next.speed);
      moved.push(next.id);
    }
    var last = end(c); if (next) last = Math.max(last, end(next)); if (last > seq.duration) seq.duration = Math.ceil(last);
    return ok(moved, { delta: d });
  }

  // ---------- operações em vários clipes ----------
  function editable(seq, ids) { var out = []; ids.forEach(function (id) { var I = info(seq, id); if (I && !I.track.locked) out.push(I); }); return out; }
  function nudge(seq, ids, dt) {
    var L = editable(seq, ids); if (!L.length) return fail('nada editável');
    var lo = Math.min.apply(null, L.map(function (x) { return x.clip.start; }));
    if (lo + dt < 0) dt = -lo;
    L.forEach(function (x) { x.clip.start += dt; if (end(x.clip) > seq.duration) seq.duration = Math.ceil(end(x.clip)); });
    return ok(L.map(function (x) { return x.clip.id; }), { delta: dt });
  }
  // Alinha começo ('start') ou fim ('end') de todos ao tempo t
  function alignTo(seq, ids, t, edge) {
    var L = editable(seq, ids); if (!L.length) return fail('nada editável');
    L.forEach(function (x) { x.clip.start = Math.max(0, edge === 'end' ? t - x.clip.duration : t); if (end(x.clip) > seq.duration) seq.duration = Math.ceil(end(x.clip)); });
    return ok(L.map(function (x) { return x.clip.id; }));
  }
  // Todos ficam com a duração do primeiro (limitado pela mídia quando é vídeo/áudio sem loop)
  function equalLength(seq, ids) {
    var L = editable(seq, ids); if (L.length < 2) return fail('selecione pelo menos 2 clipes');
    var ref = L[0].clip.duration, moved = [];
    L.slice(1).forEach(function (x) {
      var c = x.clip, d = ref;
      if (isMedia(x.asset) && c.loopMode !== 'loop' && x.asset.duration) d = Math.min(d, (x.asset.duration - c.inPoint) / c.speed);
      c.duration = Math.max(MIN, d); moved.push(c.id);
      if (end(c) > seq.duration) seq.duration = Math.ceil(end(c));
    });
    return ok(moved);
  }
  // Emenda os clipes selecionados de cada faixa um depois do outro, começando no primeiro. Não toca em clipes não selecionados.
  function joinSelected(seq, ids) {
    var L = editable(seq, ids), by = {}, moved = [];
    L.forEach(function (x) { (by[x.track.id] = by[x.track.id] || []).push(x.clip); });
    Object.keys(by).forEach(function (tid) {
      var list = by[tid].sort(function (a, b) { return a.start - b.start; }), at = end(list[0]);
      for (var i = 1; i < list.length; i++) { if (Math.abs(list[i].start - at) > EPS) { list[i].start = at; moved.push(list[i].id); } at = end(list[i]); }
    });
    return ok(moved);
  }
  // Duração e posição de um intervalo (para "marcar o clipe": X)
  function rangeOf(seq, ids) { return bounds(seq, ids); }

  // ---------- marcadores ----------
  function markerById(seq, id) { for (var i = 0; i < seq.markers.length; i++) if (seq.markers[i].id === id) return seq.markers[i]; return null; }
  function moveMarker(seq, id, t) { var m = markerById(seq, id); if (!m) return false; m.t = Math.max(0, t); seq.markers.sort(function (a, b) { return a.t - b.t; }); return true; }
  function renameMarker(seq, id, name) { var m = markerById(seq, id); if (!m) return false; m.name = String(name || '').slice(0, 120); return true; }
  function colorMarker(seq, id, color) { var m = markerById(seq, id); if (!m || !/^#[0-9a-fA-F]{6}$/.test(color || '')) return false; m.color = color; return true; }
  function removeMarker(seq, id) { var i = seq.markers.findIndex(function (m) { return m.id === id; }); if (i < 0) return false; seq.markers.splice(i, 1); return true; }
  function nextMarker(seq, t, dir) {
    var ms = seq.markers.slice().sort(function (a, b) { return a.t - b.t; }), i;
    if (dir > 0) { for (i = 0; i < ms.length; i++) if (ms[i].t > t + 0.002) return ms[i]; return null; }
    for (i = ms.length - 1; i >= 0; i--) if (ms[i].t < t - 0.002) return ms[i];
    return null;
  }

  var API = {
    selectRect: selectRect, selectRange: selectRange, selectForward: selectForward, selectTrack: selectTrack, bounds: bounds, trackIndex: trackIndex,
    editPoints: editPoints, nextEdit: nextEdit, rippleTrim: rippleTrim, rippleDelete: rippleDelete, closeGaps: closeGaps, rollEdit: rollEdit,
    slipClip: slipClip, slideClip: slideClip, nudge: nudge, alignTo: alignTo, equalLength: equalLength, joinSelected: joinSelected, rangeOf: rangeOf,
    markerById: markerById, moveMarker: moveMarker, renameMarker: renameMarker, colorMarker: colorMarker, removeMarker: removeMarker, nextMarker: nextMarker
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.TlEdit = API;
})(typeof window !== 'undefined' ? window : globalThis);
