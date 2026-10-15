// LenziMap: operações puras sobre keyframes de UM clipe (seleção, mover, copiar, colar, duplicar, excluir, interpolação).
// Sem DOM. A interface (keyframe-ui.js) e os testes usam as mesmas funções. O motor de avaliação continua em sequence.js.
// Uma "entrada" é {p, t}: propriedade e tempo (segundos dentro do ciclo do clipe). Objetos de keyframe nunca são guardados
// na seleção, porque Desfazer troca a sequência inteira por uma cópia.
(function (root) {
  'use strict';
  var Seq = root.Sequence || (typeof require === 'function' ? require('./sequence.js') : null);
  var EPS = 0.002;

  // Limites de valor por propriedade (o que o motor aceita sem distorcer o resultado)
  var LIM = { opacity: [0, 1], gain: [0, 1], p1: [0, 1], p2: [0, 2], scale: [0.05, 8], sx: [0.05, 8], sy: [0.05, 8], rot: [-3600, 3600] };
  function limOf(p) {
    if (LIM[p]) return LIM[p];
    if (p.indexOf('ef.') === 0) return [0, 1];   // fase 9: intensidade de efeito
    if (p.indexOf('ill.') === 0 && Seq && Seq.KF_LABEL[p]) { var IC = root.IllusionCore || (typeof require === 'function' ? require('./illusion-core.js') : null), d = IC && IC.PARAMS[p.slice(4)]; if (d) return [d.min, d.max]; }
    return [-1e4, 1e4];
  }
  function clampV(p, v) { var l = limOf(p); return Math.max(l[0], Math.min(l[1], v)); }

  function find(c, p, t) {
    var arr = c.keyframes[p];
    if (!arr) return null;
    for (var i = 0; i < arr.length; i++) if (Math.abs(arr[i].t - t) < EPS) return arr[i];
    return null;
  }
  function all(c) {
    var out = [];
    Object.keys(c.keyframes).forEach(function (p) { c.keyframes[p].forEach(function (k) { out.push({ p: p, t: k.t }); }); });
    return out;
  }
  function atTime(c, t) { return all(c).filter(function (e) { return Math.abs(e.t - t) < EPS; }); }
  function resolve(c, entries) { return entries.filter(function (e) { return !!find(c, e.p, e.t); }); }
  function has(entries, p, t) { return entries.some(function (e) { return e.p === p && Math.abs(e.t - t) < EPS; }); }
  function sortArr(c, p) { c.keyframes[p].sort(function (a, b) { return a.t - b.t; }); }

  // Move as entradas por dt segundos. Mantém todas dentro de [0, maxT]; a que cair em cima de uma não selecionada a substitui.
  function move(c, entries, dt, maxT) {
    entries = resolve(c, entries);
    if (!entries.length) return [];
    var lo = Math.min.apply(null, entries.map(function (e) { return e.t; })), hi = Math.max.apply(null, entries.map(function (e) { return e.t; }));
    if (lo + dt < 0) dt = -lo;
    if (maxT != null && hi + dt > maxT) dt = Math.max(-lo, maxT - hi);
    if (Math.abs(dt) < 1e-9) return entries.map(function (e) { return { p: e.p, t: e.t }; });
    var byProp = {}, out = [];
    entries.forEach(function (e) { (byProp[e.p] = byProp[e.p] || []).push(e); });
    Object.keys(byProp).forEach(function (p) {
      var arr = c.keyframes[p], moving = [], stay = [];
      arr.forEach(function (k) { if (has(byProp[p], p, k.t)) moving.push(k); else stay.push(k); });
      moving.forEach(function (k) { k.t = Math.max(0, k.t + dt); });
      // quem está parado e foi coberto por um keyframe movido some
      stay = stay.filter(function (k) { return !moving.some(function (m) { return Math.abs(m.t - k.t) < EPS; }); });
      c.keyframes[p] = stay.concat(moving);
      sortArr(c, p);
      moving.forEach(function (k) { out.push({ p: p, t: k.t }); });
    });
    return out;
  }

  function remove(c, entries) {
    var n = 0;
    resolve(c, entries).forEach(function (e) {
      var arr = c.keyframes[e.p];
      for (var i = 0; i < arr.length; i++) if (Math.abs(arr[i].t - e.t) < EPS) { arr.splice(i, 1); n++; break; }
      if (!arr.length) delete c.keyframes[e.p];
    });
    return n;
  }

  // Área de transferência: guarda valores e tempos relativos ao primeiro keyframe selecionado.
  function copy(c, entries) {
    entries = resolve(c, entries);
    if (!entries.length) return null;
    var t0 = Math.min.apply(null, entries.map(function (e) { return e.t; })), items = [];
    entries.forEach(function (e) { var k = find(c, e.p, e.t); items.push({ p: e.p, dt: k.t - t0, kf: Seq.cpKf(k, -k.t) }); });
    return { items: items, span: Math.max.apply(null, items.map(function (x) { return x.dt; })) };
  }
  // Cola no tempo "at" do ciclo. Propriedades que o clipe não tem (por exemplo canto de fx) são aceitas, o motor decide o uso.
  function paste(c, clip, at, maxT) {
    if (!clip || !clip.items.length) return [];
    var out = [];
    clip.items.forEach(function (x) {
      var t = Math.max(0, at + x.dt);
      if (maxT != null && t > maxT) return;
      var k = Seq.setKey(c, x.p, t, clampV(x.p, x.kf.v), x.kf.i, x.kf.h);
      out.push({ p: x.p, t: k.t });
    });
    return out;
  }
  // Duplica logo depois do grupo (ou 0.5 s depois quando é um keyframe só) e devolve as cópias.
  function duplicate(c, entries, maxT, gap) {
    var cb = copy(c, entries);
    if (!cb) return [];
    var t0 = Math.min.apply(null, resolve(c, entries).map(function (e) { return e.t; }));
    var off = cb.span > 0 ? cb.span + (gap || 1 / 30) : (gap && gap > 0.2 ? gap : 0.5);
    return paste(c, cb, t0 + off, maxT);
  }

  function setInterp(c, entries, mode, h) {
    var n = 0;
    resolve(c, entries).forEach(function (e) { var k = find(c, e.p, e.t); Seq.setInterpOn(k, mode, h); n++; });
    return n;
  }
  function setValue(c, e, v) {
    var k = find(c, e.p, e.t);
    if (!k) return false;
    k.v = clampV(e.p, v);
    return true;
  }
  // Troca o tempo de UM keyframe (campo numérico). Devolve a nova entrada.
  function setTime(c, e, t, maxT) {
    var r = move(c, [e], t - e.t, maxT);
    return r[0] || null;
  }
  // Alças da bezier do segmento que começa em e. Converte o segmento em bezier se ainda não era.
  function setHandles(c, e, h) {
    var k = find(c, e.p, e.t);
    if (!k) return false;
    Seq.setInterpOn(k, 'bezier', h);
    return true;
  }
  function range(c, p) {
    var arr = c.keyframes[p] || [];
    if (!arr.length) return null;
    var lo = Infinity, hi = -Infinity;
    arr.forEach(function (k) { if (k.v < lo) lo = k.v; if (k.v > hi) hi = k.v; });
    return [lo, hi];
  }
  // Próximo/anterior tempo com keyframe (em p, ou em qualquer propriedade quando p é null)
  function step(c, p, t, dir) { return Seq.stepKey(c, p, t, dir); }

  var API = {
    EPS: EPS, LIM: LIM, limOf: limOf, clampV: clampV, find: find, all: all, atTime: atTime, resolve: resolve, has: has,
    move: move, remove: remove, copy: copy, paste: paste, duplicate: duplicate, setInterp: setInterp, setValue: setValue, setTime: setTime,
    setHandles: setHandles, range: range, step: step
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.KeyframeCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
