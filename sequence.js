// LenziMap: modelo de sequência, relógio mestre e avaliador (lógica pura, sem DOM).
// Roda igual na janela de controle, na janela de saída e em testes no Node.
//
// UNIDADE DE TEMPO: segundos (número com fração). O fps só serve pra exibir timecode e encaixar (snap).
// SCHEMA: sequence { schema, id, name, duration, fps, tracks[], assets[], markers[], settings }
//   track { id, name, type:'video'|'audio', surfaceId, enabled, muted, solo, locked, order, clips[] }
//     surfaceId = chave estável da superfície (campo "key" da superfície), nunca o id temporário.
//   clip  { id, assetId, name, start, duration, inPoint, outPoint, loopMode:'none'|'loop', loopLen, speed,
//           opacity, fit, transform{x,y,scale,sx,sy,rot,crop{l,t,r,b},corners[4][dx,dy]}, keyframes{prop:[{t,v,i}]},
//           audioGain, fadeIn, fadeOut }
//   asset { id, kind:'video'|'img'|'fx'|'text'|'audio'|'cam', name, path, duration, dims, fx, text }
// Tempo dos keyframes: segundos dentro de UM ciclo do clipe (por isso o loop do clipe repete os keyframes).
(function (root) {
  'use strict';

  var SCHEMA = 1;
  var uidc = 0;
  function nid(p) {
    uidc++;
    return (p || 'i') + Date.now().toString(36) + uidc.toString(36) + Math.floor(Math.random() * 46656).toString(36);
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function num(v, d) { v = +v; return isFinite(v) ? v : d; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // 3D Illusion Creator: parâmetros animáveis entram como propriedades "ill.<nome>" (o valor base fica em clip.ill)
  var IC = root.IllusionCore || (typeof require === 'function' ? (function () { try { return require('./illusion-core.js'); } catch (e) { return null; } })() : null);
  var VC = root.ViewerCore || (typeof require === 'function' ? (function () { try { return require('./viewer-core.js'); } catch (e) { return null; } })() : null);
  var EC = root.EffectsCore || (typeof require === 'function' ? (function () { try { return require('./effects-core.js'); } catch (e) { return null; } })() : null);
  var ILL_NAMES = IC ? IC.KF_PARAMS : [];
  var KF_PROPS = ['x', 'y', 'scale', 'sx', 'sy', 'rot', 'ax', 'ay', 'cl', 'ct', 'cr', 'cb', 'opacity', 'c0x', 'c0y', 'c1x', 'c1y', 'c2x', 'c2y', 'c3x', 'c3y', 'gain', 'p1', 'p2'].concat(ILL_NAMES.map(function (n) { return 'ill.' + n; }));
  var KF_LABEL = { x: 'Posição X', y: 'Posição Y', scale: 'Escala', sx: 'Largura', sy: 'Altura', rot: 'Rotação', ax: 'Âncora X', ay: 'Âncora Y', cl: 'Corte esquerdo', ct: 'Corte topo', cr: 'Corte direito', cb: 'Corte base', opacity: 'Opacidade', c0x: 'Canto 1 X', c0y: 'Canto 1 Y', c1x: 'Canto 2 X', c1y: 'Canto 2 Y', c2x: 'Canto 3 X', c2y: 'Canto 3 Y', c3x: 'Canto 4 X', c3y: 'Canto 4 Y', gain: 'Volume', p1: 'Progresso do efeito', p2: 'Intensidade do efeito' };
  ILL_NAMES.forEach(function (n) { KF_LABEL['ill.' + n] = 'Ilusão: ' + IC.PARAMS[n].label; });

  // ---------- criação e migração ----------
  function newSettings() { return { snap: true, loop: { on: false, in: 0, out: null }, showGridIdle: true }; }
  function create(o) {
    o = o || {};
    return {
      schema: SCHEMA, id: nid('seq'), name: o.name || 'Sequência 1',
      duration: num(o.duration, 30) > 0 ? num(o.duration, 30) : 30,
      fps: num(o.fps, 30) > 0 ? num(o.fps, 30) : 30,
      tracks: [], assets: [], markers: [], settings: newSettings()
    };
  }
  function newTransform() {
    return { x: 0, y: 0, scale: 1, sx: 1, sy: 1, rot: 0, ax: 0, ay: 0, flipH: false, flipV: false, crop: { l: 0, t: 0, r: 0, b: 0 }, corners: [[0, 0], [0, 0], [0, 0], [0, 0]] };
  }
  // Interpolação do segmento que COMEÇA neste keyframe: linear, hold, ease (entrada e saída), easein, easeout, bezier (alças em h).
  var INTERP = ['linear', 'hold', 'ease', 'easein', 'easeout', 'bezier'];
  var PRESET_H = { ease: [1 / 3, 0, 2 / 3, 1], easein: [0.42, 0, 1, 1], easeout: [0, 0, 0.58, 1], linear: [1 / 3, 1 / 3, 2 / 3, 2 / 3] };
  function fixH(h) {
    if (!Array.isArray(h) || h.length !== 4) return null;
    var a = h.map(function (x) { return num(x, 0); });
    return [clamp(a[0], 0, 1), clamp(a[1], -3, 4), clamp(a[2], 0, 1), clamp(a[3], -3, 4)];
  }
  function fixKf(kf) {
    var o = { t: Math.max(0, num(kf.t, 0)), v: num(kf.v, 0), i: INTERP.indexOf(kf.i) >= 0 ? kf.i : 'linear' };
    if (o.i === 'bezier') o.h = fixH(kf.h) || PRESET_H.ease.slice();
    return o;
  }
  // Resolve x -> t em uma bezier cubica (0,0)(x1,y1)(x2,y2)(1,1) e devolve y. Newton com bisseção de reserva.
  function bez(h, u) {
    var x1 = h[0], y1 = h[1], x2 = h[2], y2 = h[3];
    if (u <= 0) return 0; if (u >= 1) return 1;
    function cx(t) { var m = 1 - t; return 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t; }
    function cy(t) { var m = 1 - t; return 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t; }
    var t = u, i, lo = 0, hi = 1;
    for (i = 0; i < 8; i++) {
      var x = cx(t) - u;
      if (Math.abs(x) < 1e-6) return cy(t);
      var dx = 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
      if (Math.abs(dx) < 1e-6) break;
      t -= x / dx;
    }
    t = u;
    for (i = 0; i < 40; i++) {
      var xx = cx(t);
      if (Math.abs(xx - u) < 1e-6) break;
      if (xx < u) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return cy(t);
  }
  // Curva normalizada (0..1 -> valor relativo) de um keyframe, usada pelo avaliador e pelo editor de curvas.
  function curveOf(kf, u) {
    switch (kf.i) {
      case 'hold': return 0;
      case 'ease': return u * u * (3 - 2 * u);
      case 'easein': return bez(PRESET_H.easein, u);
      case 'easeout': return bez(PRESET_H.easeout, u);
      case 'bezier': return bez(kf.h || PRESET_H.ease, u);
      default: return u;
    }
  }
  function handlesOf(kf) { return kf.i === 'bezier' && kf.h ? kf.h.slice() : (PRESET_H[kf.i] || PRESET_H.linear).slice(); }
  function fixClip(c) {
    c = c || {};
    var t = c.transform || {}, d = newTransform(), k, i;
    var out = {
      id: c.id || nid('c'), assetId: c.assetId || null, name: c.name || '',
      start: Math.max(0, num(c.start, 0)), duration: Math.max(0.04, num(c.duration, 2)),
      inPoint: Math.max(0, num(c.inPoint, 0)), outPoint: c.outPoint == null ? null : num(c.outPoint, null),
      loopMode: c.loopMode === 'loop' ? 'loop' : 'none', loopLen: c.loopLen == null ? null : Math.max(0.05, num(c.loopLen, 2)),
      speed: clamp(num(c.speed, 1), 0.05, 16), opacity: clamp(num(c.opacity, 1), 0, 1),
      fit: c.fit === 'fill' || c.fit === 'contain' ? c.fit : 'cover',
      transform: d, keyframes: {}, audioGain: clamp(num(c.audioGain, 1), 0, 1),
      fadeIn: Math.max(0, num(c.fadeIn, 0)), fadeOut: Math.max(0, num(c.fadeOut, 0)),
      fxp: { p1: clamp(num(c.fxp && c.fxp.p1, 1), 0, 1), p2: clamp(num(c.fxp && c.fxp.p2, 1), 0, 2) }
    };
    out.transform.x = num(t.x, 0); out.transform.y = num(t.y, 0);
    out.transform.scale = num(t.scale, 1); out.transform.sx = num(t.sx, 1); out.transform.sy = num(t.sy, 1);
    out.transform.rot = num(t.rot, 0);
    out.transform.ax = clamp(num(t.ax, 0), -5, 5); out.transform.ay = clamp(num(t.ay, 0), -5, 5);   // fase 8: âncora (fração de W e H a partir do centro)
    out.transform.flipH = !!t.flipH; out.transform.flipV = !!t.flipV;
    var cr = t.crop || {};
    out.transform.crop = { l: clamp(num(cr.l, 0), 0, 0.95), t: clamp(num(cr.t, 0), 0, 0.95), r: clamp(num(cr.r, 0), 0, 0.95), b: clamp(num(cr.b, 0), 0, 0.95) };
    for (i = 0; i < 4; i++) {
      var cc = t.corners && t.corners[i] ? t.corners[i] : [0, 0];
      out.transform.corners[i] = [num(cc[0], 0), num(cc[1], 0)];
    }
    // fase 7: conexão com outro clipe e participação em composto (só ids; a validade é conferida por CompoundCore.sanitize)
    if (typeof c.cg === 'string' && /^[\w-]{1,40}$/.test(c.cg)) out.cg = c.cg;
    if (c.conn && typeof c.conn.to === 'string' && /^[\w-]{1,40}$/.test(c.conn.to)) out.conn = { to: c.conn.to, off: num(c.conn.off, 0) };
    if (c.ill && typeof c.ill === 'object' && IC) {
      out.ill = {};
      ILL_NAMES.forEach(function (n) { if (c.ill[n] != null && isFinite(+c.ill[n])) out.ill[n] = clamp(+c.ill[n], IC.PARAMS[n].min, IC.PARAMS[n].max); });
    }
    // fase 9: pilha de efeitos de processamento e modo de mesclagem do clipe
    if (EC && Array.isArray(c.efx)) { var efl = EC.sanitize(c.efx); if (efl.length) { out.efx = efl; efl.forEach(function (e) { KF_LABEL['ef.' + e.id] = 'Efeito: ' + EC.label(e); }); } }
    if (EC && c.blend) { var bl = EC.fixBlend(c.blend); if (bl !== 'normal') out.blend = bl; }
    for (k in (c.keyframes || {})) {
      var isEf = /^ef\.[\w-]{1,24}$/.test(k) && out.efx && out.efx.some(function (e) { return 'ef.' + e.id === k; });
      if ((KF_PROPS.indexOf(k) < 0 && !isEf) || !Array.isArray(c.keyframes[k])) continue;
      var arr = c.keyframes[k].map(fixKf);
      arr.sort(function (a, b) { return a.t - b.t; });
      if (arr.length) out.keyframes[k] = arr;
    }
    return out;
  }
  // Opções do encaixe (Imã): o que atrai, a grade opcional e a distância em pixels
  function fixSnapOpts(o) {
    o = o || {};
    return { playhead: o.playhead !== false, markers: o.markers !== false, clips: o.clips !== false, frames: o.frames !== false, grid: Math.max(0, num(o.grid, 0)), px: clamp(num(o.px, 8), 3, 30) };
  }
  function fixTrack(t, idx) {
    t = t || {};
    return {
      id: t.id || nid('t'), name: t.name || ('Faixa ' + (idx + 1)), type: t.type === 'audio' ? 'audio' : 'video',
      surfaceId: t.surfaceId || null, enabled: t.enabled !== false, muted: !!t.muted, solo: !!t.solo, locked: !!t.locked,
      order: num(t.order, idx), clips: (t.clips || []).map(fixClip)
    };
  }
  function fixAsset(a) {
    a = a || {};
    var k = ['video', 'img', 'fx', 'text', 'audio', 'cam'].indexOf(a.kind) > -1 ? a.kind : 'img';
    var f = { id: a.id || nid('a'), kind: k, name: a.name || 'Mídia', path: a.path || null, duration: a.duration == null ? null : num(a.duration, null), dims: a.dims || null, fx: a.fx ? clone(a.fx) : null, text: a.text ? clone(a.text) : null, test: !!a.test };
    if (f.fx && f.fx.kind === 'illusion') {
      var vr = IC && f.fx.illusion ? IC.validate(f.fx.illusion, null) : null;
      if (vr && vr.ok) f.fx.illusion = vr.value; else delete f.fx.illusion;
    }
    // Campos do Media Browser (opcionais; projetos antigos continuam iguais)
    if (a.added) f.added = num(a.added, 0);
    if (a.collection) f.collection = String(a.collection).slice(0, 40);
    if (a.meta && typeof a.meta === 'object') f.meta = { fps: a.meta.fps == null ? null : num(a.meta.fps, null), audio: a.meta.audio === true ? true : (a.meta.audio === false ? false : null), channels: a.meta.channels == null ? null : num(a.meta.channels, null), size: a.meta.size == null ? null : num(a.meta.size, null) };
    return f;
  }
  // Migra qualquer objeto (ou nada) para o schema atual, sem perder o que já existe.
  // Avisos de compatibilidade da última migração (dados salvos por versão mais nova). A interface mostra um cartão.
  var lastCompat = [];
  function compat() { return lastCompat.slice(); }
  function migrate(o) {
    lastCompat = [];
    if (!o || typeof o !== 'object') return create();
    if ((o.schema || 0) > SCHEMA) lastCompat.push('Este projeto foi salvo por uma versão mais nova do LenziMap (schema ' + o.schema + '). Abri o que esta versão entende; salvar por cima pode perder recursos novos. Faça uma cópia antes.');
    if (IC && o.stage && IC.stageVersionWarning(o.stage)) lastCompat.push(IC.stageVersionWarning(o.stage) + ' Os cubos e o ponto de vista foram limitados ao que esta versão entende.');
    var newerIl = 0; (o.assets || []).forEach(function (a) { var v = a && a.fx && a.fx.illusion && Number(a.fx.illusion.v); if (IC && v > IC.VERSION) newerIl++; });
    if (newerIl) lastCompat.push(newerIl + ' ilusão(ões) 3D foram criadas por uma versão mais nova do LenziMap. Li só o que esta versão entende; revise antes de projetar.');
    var s = create({ duration: o.duration, fps: o.fps, name: o.name });
    s.id = o.id || s.id;
    s.tracks = (o.tracks || []).map(fixTrack);
    s.assets = (o.assets || []).map(fixAsset);
    s.markers = (o.markers || []).map(function (m) { return { id: m.id || nid('m'), t: Math.max(0, num(m.t, 0)), name: String(m.name || '').slice(0, 120), color: /^#[0-9a-fA-F]{6}$/.test(m.color || '') ? m.color : '#ffd23d' }; });
    s.markers.sort(function (a, b) { return a.t - b.t; });
    var st = o.settings || {}, lp = st.loop || {};
    s.settings = { snap: st.snap !== false, loop: { on: !!lp.on, in: Math.max(0, num(lp.in, 0)), out: lp.out == null ? null : num(lp.out, null) }, showGridIdle: st.showGridIdle !== false };
    s.settings.snapOpts = fixSnapOpts(st.snapOpts);
    if (st.audioOffset != null) s.settings.audioOffset = num(st.audioOffset, 0);
    if (st.view && typeof st.view === 'object') s.settings.view = VC ? VC.sanitizeView(st.view) : st.view;   // fase 8: grade, réguas, guias, áreas seguras
    if (st.sink) s.settings.sink = String(st.sink);
    if (st.tree && st.tree.collapsed && typeof st.tree.collapsed === 'object') {   // hierarquia: nós recolhidos (fase 6)
      var cl = {}, n = 0; Object.keys(st.tree.collapsed).forEach(function (k) { if (n < 1000 && st.tree.collapsed[k] && /^[\w:.\-]{1,80}$/.test(k)) { cl[k] = 1; n++; } });
      s.settings.tree = { collapsed: cl };
    }
    if (o.stage && IC) s.stage = IC.fixStage(o.stage);
    if ((o.schema || 0) > SCHEMA) s._newer = true;
    s.compounds = (Array.isArray(o.compounds) ? o.compounds : []).slice(0, 200).map(function (g) { g = g || {}; return { id: String(g.id || '').slice(0, 40), name: String(g.name || 'Composto').slice(0, 60), color: /^#[0-9a-fA-F]{6}$/.test(g.color || '') ? g.color : '#4fc3ff', open: !!g.open }; }).filter(function (g) { return /^[\w-]{1,40}$/.test(g.id); });
    reorder(s);
    if (root.CompoundCore) root.CompoundCore.sanitize(s);
    return s;
  }
  function reorder(seq) {
    seq.tracks.sort(function (a, b) { return a.order - b.order; });
    seq.tracks.forEach(function (t, i) { t.order = i; });
  }

  // ---------- consultas ----------
  function asset(seq, id) { for (var i = 0; i < seq.assets.length; i++) if (seq.assets[i].id === id) return seq.assets[i]; return null; }
  function findClip(seq, id) {
    for (var i = 0; i < seq.tracks.length; i++) {
      var cl = seq.tracks[i].clips;
      for (var j = 0; j < cl.length; j++) if (cl[j].id === id) return { track: seq.tracks[i], clip: cl[j], index: j };
    }
    return null;
  }
  function track(seq, id) { for (var i = 0; i < seq.tracks.length; i++) if (seq.tracks[i].id === id) return seq.tracks[i]; return null; }
  function isMedia(a) { return !!a && (a.kind === 'video' || a.kind === 'audio'); }
  function endOf(c) { return c.start + c.duration; }
  function seqEnd(seq) {
    var e = 0;
    seq.tracks.forEach(function (t) { t.clips.forEach(function (c) { e = Math.max(e, endOf(c)); }); });
    return e;
  }
  // Tamanho do trecho de origem usado (segundos da mídia). Só faz sentido pra vídeo e áudio.
  function segLen(c, a) {
    if (!isMedia(a)) return c.loopLen || c.duration;
    var out = c.outPoint != null ? c.outPoint : (a.duration || (c.inPoint + c.duration * c.speed));
    return Math.max(0.01, out - c.inPoint);
  }
  // Duração (na linha do tempo) de um ciclo do clipe. Infinity = o clipe não cicla.
  function cycleLen(c, a) {
    if (isMedia(a)) return segLen(c, a) / c.speed;
    if (c.loopMode === 'loop') return c.loopLen || 2;
    return Infinity;
  }
  function conflicts(tr) {
    var bad = {}, i, j, a, b;
    for (i = 0; i < tr.clips.length; i++) {
      for (j = i + 1; j < tr.clips.length; j++) {
        a = tr.clips[i]; b = tr.clips[j];
        if (a.start < endOf(b) - 1e-6 && b.start < endOf(a) - 1e-6) { bad[a.id] = 1; bad[b.id] = 1; }
      }
    }
    return bad;
  }

  // ---------- keyframes ----------
  var CROPK = { cl: 'l', ct: 't', cr: 'r', cb: 'b' };
  function efOf(c, id) { var l = c.efx || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function baseValue(c, p) {
    if (p.indexOf('ill.') === 0) { var nm = p.slice(4); return c.ill && c.ill[nm] != null ? c.ill[nm] : (IC && IC.PARAMS[nm] ? IC.PARAMS[nm].def : 0); }
    var t = c.transform, m = /^c([0-3])([xy])$/.exec(p);
    if (m) return t.corners[+m[1]][m[2] === 'x' ? 0 : 1];
    if (p.indexOf('ef.') === 0) { var ee = efOf(c, p.slice(3)); return ee ? ee.amount : 0; }
    if (CROPK[p]) return (t.crop && t.crop[CROPK[p]]) || 0;
    if (p === 'ax' || p === 'ay') return t[p] || 0;
    if (p === 'opacity') return c.opacity;
    if (p === 'gain') return c.audioGain;
    if (p === 'p1' || p === 'p2') return c.fxp ? c.fxp[p] : 1;
    return t[p];
  }
  function setBase(c, p, v) {
    if (p.indexOf('ill.') === 0) { var nm = p.slice(4), L = IC && IC.PARAMS[nm]; c.ill = c.ill || {}; c.ill[nm] = L ? clamp(v, L.min, L.max) : v; return; }
    var t = c.transform, m = /^c([0-3])([xy])$/.exec(p);
    if (m) t.corners[+m[1]][m[2] === 'x' ? 0 : 1] = v;
    else if (p.indexOf('ef.') === 0) { var e2 = efOf(c, p.slice(3)); if (e2) e2.amount = clamp(v, 0, 1); }
    else if (CROPK[p]) { t.crop = t.crop || { l: 0, t: 0, r: 0, b: 0 }; t.crop[CROPK[p]] = clamp(v, 0, 0.95); }
    else if (p === 'opacity') c.opacity = clamp(v, 0, 1);
    else if (p === 'gain') c.audioGain = clamp(v, 0, 1);
    else if (p === 'p1' || p === 'p2') { c.fxp = c.fxp || { p1: 1, p2: 1 }; c.fxp[p] = clamp(v, 0, p === 'p1' ? 1 : 2); }
    else t[p] = v;
  }
  function interp(arr, t) {
    var n = arr.length;
    if (!n) return null;
    if (t <= arr[0].t) return arr[0].v;
    if (t >= arr[n - 1].t) return arr[n - 1].v;
    for (var i = 0; i < n - 1; i++) {
      var a = arr[i], b = arr[i + 1];
      if (t >= a.t && t < b.t) {
        if (a.i === 'hold') return a.v;
        var u = (t - a.t) / (b.t - a.t);
        return a.v + (b.v - a.v) * curveOf(a, u);
      }
    }
    return arr[n - 1].v;
  }
  function valueAt(c, p, cl) {
    var arr = c.keyframes[p];
    return arr && arr.length ? interp(arr, cl) : baseValue(c, p);
  }
  function setInterpOn(kf, how, h) {
    if (INTERP.indexOf(how) < 0) how = 'linear';
    var prev = handlesOf(kf);
    kf.i = how;
    if (how === 'bezier') kf.h = fixH(h) || fixH(kf.h) || (kf.__noPrev ? PRESET_H.ease.slice() : prev); else delete kf.h;
    delete kf.__noPrev;
    return kf;
  }
  function setKey(c, p, t, v, how, h) {
    var arr = c.keyframes[p] || (c.keyframes[p] = []), i;
    t = Math.max(0, t);
    for (i = 0; i < arr.length; i++) {
      if (Math.abs(arr[i].t - t) < 0.002) { arr[i].v = v; if (how) setInterpOn(arr[i], how, h); return arr[i]; }
    }
    var k = { t: t, v: v, i: 'linear', __noPrev: true };
    setInterpOn(k, how || 'linear', h);
    arr.push(k);
    arr.sort(function (a, b) { return a.t - b.t; });
    return k;
  }
  function removeKey(c, p, t) {
    var arr = c.keyframes[p];
    if (!arr) return false;
    for (var i = 0; i < arr.length; i++) {
      if (Math.abs(arr[i].t - t) < 0.002) { arr.splice(i, 1); if (!arr.length) delete c.keyframes[p]; return true; }
    }
    return false;
  }
  function hasKey(c, p, t) {
    var arr = c.keyframes[p];
    if (!arr) return false;
    for (var i = 0; i < arr.length; i++) if (Math.abs(arr[i].t - t) < 0.002) return true;
    return false;
  }
  // Próximo (dir>0) ou anterior (dir<0) tempo com keyframe em qualquer propriedade (ou só em p)
  function stepKey(c, p, t, dir) {
    var best = null;
    var props = p ? [p] : Object.keys(c.keyframes);
    props.forEach(function (k) {
      (c.keyframes[k] || []).forEach(function (kf) {
        if (dir > 0 && kf.t > t + 0.002 && (best == null || kf.t < best)) best = kf.t;
        if (dir < 0 && kf.t < t - 0.002 && (best == null || kf.t > best)) best = kf.t;
      });
    });
    return best;
  }

  // ---------- avaliação ----------
  function fadeFactor(c, local) {
    var f = 1;
    if (c.fadeIn > 0 && local < c.fadeIn) f = Math.min(f, local / c.fadeIn);
    if (c.fadeOut > 0 && local > c.duration - c.fadeOut) f = Math.min(f, (c.duration - local) / c.fadeOut);
    return clamp(f, 0, 1);
  }
  // Estado de UM clipe no tempo T da sequência (ou null se não está ativo).
  function evalClip(c, a, T) {
    var local = T - c.start;
    if (local < 0 || local >= c.duration) return null;
    var cyc = cycleLen(c, a), cl = local, cycle = 0, ended = false, media = isMedia(a);
    if (isFinite(cyc) && cyc > 0) {
      if (c.loopMode === 'loop') { cycle = Math.floor(local / cyc); cl = local - cycle * cyc; }
      else if (local > cyc && media) { cl = cyc; ended = true; }
    }
    var srcTime = media ? c.inPoint + Math.min(cl * c.speed, segLen(c, a)) : cl;
    var ff = fadeFactor(c, local);
    var P = {
      x: valueAt(c, 'x', cl), y: valueAt(c, 'y', cl), scale: valueAt(c, 'scale', cl), rot: valueAt(c, 'rot', cl),
      sx: valueAt(c, 'sx', cl), sy: valueAt(c, 'sy', cl),
      ax: valueAt(c, 'ax', cl), ay: valueAt(c, 'ay', cl), flipH: !!c.transform.flipH, flipV: !!c.transform.flipV,
      corners: [[valueAt(c, 'c0x', cl), valueAt(c, 'c0y', cl)], [valueAt(c, 'c1x', cl), valueAt(c, 'c1y', cl)], [valueAt(c, 'c2x', cl), valueAt(c, 'c2y', cl)], [valueAt(c, 'c3x', cl), valueAt(c, 'c3y', cl)]]
    };
    var ill = null;
    if (c.ill && IC) { ill = {}; ILL_NAMES.forEach(function (n) { if (c.ill[n] != null || (c.keyframes['ill.' + n] && c.keyframes['ill.' + n].length)) ill[n] = valueAt(c, 'ill.' + n, cl); }); }
    return {
      ill: ill, local: local, cl: cl, cycle: cycle, ended: ended, srcTime: srcTime, tms: cl * 1000,
      opacity: clamp(valueAt(c, 'opacity', cl) * ff, 0, 1), gain: clamp(valueAt(c, 'gain', cl) * ff, 0, 1),
      p1: clamp(valueAt(c, 'p1', cl), 0, 1), p2: clamp(valueAt(c, 'p2', cl), 0, 2),
      p: P, crop: cropAt(c, cl), speed: c.speed, fit: c.fit,
      blend: c.blend || 'normal', efx: c.efx && c.efx.length ? c.efx.map(function (e) { return { id: e.id, type: e.type, on: e.on, amount: clamp(valueAt(c, 'ef.' + e.id, cl), 0, 1), p: e }; }) : null
    };
  }
  // Corte do clipe no instante cl: se houver keyframe de corte, calcula (clampado e sem passar de 95% somados); senão devolve o valor fixo.
  function cropAt(c, cl) {
    var k = c.keyframes;
    if (!k || !(k.cl || k.ct || k.cr || k.cb)) return c.transform.crop;
    var o = { l: clamp(valueAt(c, 'cl', cl), 0, 0.95), t: clamp(valueAt(c, 'ct', cl), 0, 0.95), r: clamp(valueAt(c, 'cr', cl), 0, 0.95), b: clamp(valueAt(c, 'cb', cl), 0, 0.95) };
    if (o.l + o.r > 0.95) { var f = 0.95 / (o.l + o.r); o.l *= f; o.r *= f; } if (o.t + o.b > 0.95) { var g = 0.95 / (o.t + o.b); o.t *= g; o.b *= g; }
    return o;
  }
  // Avalia a sequência toda no tempo T. Determinístico: mesmo T e mesma sequência dão o mesmo resultado.
  function evaluate(seq, T) {
    var out = { t: T, video: {}, audio: [] };
    var vSolo = seq.tracks.some(function (t) { return t.type === 'video' && t.solo; });
    var aSolo = seq.tracks.some(function (t) { return t.type === 'audio' && t.solo; });
    // Ordem de composição: a faixa de CIMA na lista fica por cima na imagem (como no Final Cut).
    // Por isso as faixas são percorridas de baixo pra cima; o que entra por último no vetor é pintado por último.
    seq.tracks.slice().reverse().forEach(function (t) {
      var clips = t.clips.slice().sort(function (a, b) { return a.start - b.start; });
      if (t.type === 'video') {
        if (!t.enabled || (vSolo && !t.solo) || !t.surfaceId) return;
        var list = out.video[t.surfaceId] || (out.video[t.surfaceId] = []);
        clips.forEach(function (c) {
          var a = asset(seq, c.assetId);
          if (!a || a.kind === 'audio') return;
          var ev = evalClip(c, a, T);
          if (ev) list.push({ clip: c, asset: a, track: t, ev: ev });
        });
      } else {
        if (t.muted || (aSolo && !t.solo)) return;
        clips.forEach(function (c) {
          var a = asset(seq, c.assetId);
          if (!a || a.kind !== 'audio') return;
          var ev = evalClip(c, a, T);
          if (ev) out.audio.push({ clip: c, asset: a, track: t, ev: ev });
        });
      }
    });
    return out;
  }
  // Quadrilátero final do conteúdo dentro da superfície (px locais W x H) e a matriz CSS que leva o retângulo até ele.
  function quadOf(W, H, p) {
    // fase 8: a rotação, a escala e o flip acontecem em torno da ÂNCORA (p.ax, p.ay = fração de W e H a partir do centro). Sem âncora = centro (idêntico ao modelo antigo).
    var cx = W / 2 + (p.ax || 0) * W, cy = H / 2 + (p.ay || 0) * H, a = p.rot * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
    var fx = p.flipH ? -1 : 1, fy = p.flipV ? -1 : 1;
    var base = [[0, 0], [W, 0], [W, H], [0, H]];
    return base.map(function (pt, i) {
      var dx = (pt[0] - cx) * p.scale * p.sx * fx, dy = (pt[1] - cy) * p.scale * p.sy * fy;
      return [cx + dx * co - dy * si + p.x * W + p.corners[i][0] * W, cy + dx * si + dy * co + p.y * H + p.corners[i][1] * H];
    });
  }
  function isIdentity(p) {
    if (Math.abs(p.x) > 1e-6 || Math.abs(p.y) > 1e-6 || Math.abs(p.rot) > 1e-6) return false;
    if (Math.abs(p.scale * p.sx - 1) > 1e-6 || Math.abs(p.scale * p.sy - 1) > 1e-6) return false;
    if (p.flipH || p.flipV) return false;
    for (var i = 0; i < 4; i++) if (Math.abs(p.corners[i][0]) > 1e-6 || Math.abs(p.corners[i][1]) > 1e-6) return false;
    return true;
  }
  function xformOf(W, H, p, solveH) {
    if (isIdentity(p)) return { xf: '', quad: null };
    var q = quadOf(W, H, p);
    var h = solveH([[0, 0], [W, 0], [W, H], [0, H]], q);
    if (!h) return { xf: '', quad: q };
    return { xf: 'matrix3d(' + [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1].map(function (n) { return +n.toFixed(7); }).join(',') + ')', quad: q };
  }
  function cropOf(cr) {
    if (!cr || (!cr.l && !cr.t && !cr.r && !cr.b)) return '';
    return 'inset(' + [cr.t, cr.r, cr.b, cr.l].map(function (v) { return (v * 100).toFixed(3) + '%'; }).join(' ') + ')';
  }

  // ---------- edição (funções que mudam a sequência) ----------
  function addTrack(seq, type, surfaceId, name) {
    var t = fixTrack({ type: type, surfaceId: surfaceId || null, name: name || null, order: seq.tracks.length }, seq.tracks.length);
    if (!name) t.name = (type === 'audio' ? 'Áudio ' : 'Faixa ') + (seq.tracks.filter(function (x) { return x.type === type; }).length + 1);
    seq.tracks.push(t);
    return t;
  }
  // ---------- camadas por face ----------
  // Camada = faixa de vídeo ligada à mesma superfície. Na lista, quem está em cima fica por cima na projeção.
  var MAX_LAYERS = Infinity;   // sem limite fixo; a interface só avisa quando passa de SOFT_LAYERS
  var SOFT_LAYERS = 4;
  function layersOf(seq, key) {
    return key ? seq.tracks.filter(function (t) { return t.type === 'video' && t.surfaceId === key; }) : [];
  }
  function renumber(seq) { seq.tracks.forEach(function (x, k) { x.order = k; }); }
  function addLayer(seq, key, name) {
    var ls = layersOf(seq, key);
    if (!key || ls.length >= MAX_LAYERS) return null;
    var t = fixTrack({ type: 'video', surfaceId: key, name: name || ('Camada ' + (ls.length + 1)) }, seq.tracks.length);
    var at = ls.length ? seq.tracks.indexOf(ls[0]) : seq.tracks.length;   // logo acima da camada mais alta da face
    seq.tracks.splice(at, 0, t); renumber(seq);
    return t;
  }
  // dir -1 sobe a camada (passa a ficar por cima), +1 desce
  function moveLayer(seq, id, dir) {
    var t = track(seq, id); if (!t || t.type !== 'video' || !t.surfaceId) return false;
    var ls = layersOf(seq, t.surfaceId), i = ls.indexOf(t), j = i + dir;
    if (j < 0 || j >= ls.length) return false;
    var a = seq.tracks.indexOf(ls[i]), b = seq.tracks.indexOf(ls[j]);
    var tmp = seq.tracks[a]; seq.tracks[a] = seq.tracks[b]; seq.tracks[b] = tmp; renumber(seq);
    return true;
  }
  // posição da camada na face, de baixo pra cima (1 = base) e total
  function layerInfo(seq, id) {
    var t = track(seq, id); if (!t || t.type !== 'video' || !t.surfaceId) return null;
    var ls = layersOf(seq, t.surfaceId);
    return { n: ls.length - ls.indexOf(t), total: ls.length, soft: SOFT_LAYERS };
  }
  function removeTrack(seq, id) {
    var i = seq.tracks.findIndex(function (t) { return t.id === id; });
    if (i < 0) return false;
    seq.tracks.splice(i, 1); reorder(seq);
    return true;
  }
  function moveTrack(seq, id, dir) {
    var i = seq.tracks.findIndex(function (t) { return t.id === id; }), j = i + dir;
    if (i < 0 || j < 0 || j >= seq.tracks.length) return false;
    var t = seq.tracks[i]; seq.tracks[i] = seq.tracks[j]; seq.tracks[j] = t;
    seq.tracks.forEach(function (x, k) { x.order = k; });
    return true;
  }
  function addAsset(seq, a) {
    var f = fixAsset(a);
    seq.assets.push(f);
    return f;
  }
  // Tamanho padrão de um clipe novo, conforme a mídia
  function defaultDuration(a) {
    if (a.kind === 'video' || a.kind === 'audio') return a.duration && a.duration > 0 ? a.duration : 5;
    if (a.kind === 'cam') return 10;
    return 5;
  }
  function addClip(seq, trackId, a, start, duration) {
    var t = track(seq, trackId);
    if (!t) return null;
    var c = fixClip({ assetId: a.id, name: a.name, start: start, duration: duration || defaultDuration(a) });
    if (isMedia(a) && a.duration) c.outPoint = a.duration;
    t.clips.push(c);
    if (endOf(c) > seq.duration) seq.duration = Math.ceil(endOf(c));
    return c;
  }
  function removeClip(seq, id) {
    var f = findClip(seq, id);
    if (!f) return false;
    f.track.clips.splice(f.index, 1);
    return true;
  }
  function moveClip(seq, id, start, toTrackId) {
    var f = findClip(seq, id);
    if (!f) return false;
    f.clip.start = Math.max(0, start);
    if (toTrackId && toTrackId !== f.track.id) {
      var to = track(seq, toTrackId);
      if (to && to.type === f.track.type) { f.track.clips.splice(f.index, 1); to.clips.push(f.clip); }
    }
    if (endOf(f.clip) > seq.duration) seq.duration = Math.ceil(endOf(f.clip));
    return true;
  }
  // Trim: mexe na borda esquerda (side 'l') ou direita ('r') pra chegar no tempo t da sequência.
  function trimClip(seq, id, side, t) {
    var f = findClip(seq, id);
    if (!f) return false;
    var c = f.clip, a = asset(seq, c.assetId), e = endOf(c), media = isMedia(a);
    if (side === 'l') {
      t = clamp(t, 0, e - 0.04);
      var d = t - c.start;
      if (media && c.loopMode !== 'loop') {
        var ni = c.inPoint + d * c.speed;
        if (ni < 0) { d = -c.inPoint / c.speed; ni = 0; t = c.start + d; }
        c.inPoint = ni;
      }
      c.start = t; c.duration = e - t;
    } else {
      t = Math.max(t, c.start + 0.04);
      if (media && c.loopMode !== 'loop' && a.duration) {
        var maxD = (a.duration - c.inPoint) / c.speed;
        t = Math.min(t, c.start + maxD);
      }
      c.duration = t - c.start;
      if (endOf(c) > seq.duration) seq.duration = Math.ceil(endOf(c));
    }
    return true;
  }
  function cloneClip(c) { var n = clone(c); n.id = nid('c'); return n; }
  function splitClip(seq, id, t) {
    var f = findClip(seq, id);
    if (!f) return null;
    var c = f.clip, a = asset(seq, c.assetId);
    if (t <= c.start + 0.04 || t >= endOf(c) - 0.04) return null;
    var ls = t - c.start, n = cloneClip(c), media = isMedia(a);
    n.start = t; n.duration = c.duration - ls; c.duration = ls;
    if (media) {
      var cyc = cycleLen(c, a), off = ls;
      if (c.loopMode === 'loop' && isFinite(cyc)) off = ls % cyc;
      n.inPoint = c.inPoint + off * c.speed;
      if (c.loopMode === 'loop') { n.outPoint = c.outPoint; n.inPoint = c.inPoint; }
    }
    if (c.loopMode !== 'loop') {
      // keyframes seguem a linha do tempo do clipe: o pedaço novo recomeça em 0
      KF_PROPS.forEach(function (p) {
        var arr = c.keyframes[p];
        if (!arr || !arr.length) return;
        var vAt = interp(arr, ls), first = [], second = [];
        arr.forEach(function (k) { if (k.t < ls - 1e-6) first.push(cpKf(k, 0)); if (k.t > ls + 1e-6) second.push(cpKf(k, -ls)); });
        first.push({ t: ls, v: vAt, i: 'linear' });
        second.unshift({ t: 0, v: vAt, i: 'linear' });
        c.keyframes[p] = first; n.keyframes[p] = second;
      });
      if (c.fadeOut) { n.fadeOut = c.fadeOut; c.fadeOut = 0; }
      n.fadeIn = 0;
    }
    f.track.clips.splice(f.index + 1, 0, n);
    return n;
  }
  function cpKf(k, dt) { var o = { t: k.t + (dt || 0), v: k.v, i: k.i }; if (k.h) o.h = k.h.slice(); return o; }
  function duplicateClip(seq, id) {
    var f = findClip(seq, id);
    if (!f) return null;
    var n = cloneClip(f.clip);
    n.start = endOf(f.clip);
    f.track.clips.push(n);
    if (endOf(n) > seq.duration) seq.duration = Math.ceil(endOf(n));
    return n;
  }
  function addMarker(seq, t, name) {
    var m = { id: nid('m'), t: Math.max(0, t), name: name || '', color: '#ffd23d' };
    seq.markers.push(m);
    seq.markers.sort(function (a, b) { return a.t - b.t; });
    return m;
  }
  // Encaixe: procura o ponto mais perto (playhead, marcadores, bordas de clipes, 0, fim, grade de quadros)
  function snapTime(seq, t, thr, playhead, skipClipId, skipMarkerId) {
    var o = fixSnapOpts(seq.settings && seq.settings.snapOpts), best = null, bd = thr;
    function tryp(p) { var d = Math.abs(p - t); if (d <= bd) { bd = d; best = p; } }
    tryp(0); tryp(seq.duration);
    if (playhead != null && o.playhead) tryp(playhead);
    if (o.markers) seq.markers.forEach(function (m) { if (m.id !== skipMarkerId) tryp(m.t); });
    if (o.clips) seq.tracks.forEach(function (tr) {
      tr.clips.forEach(function (c) { if (c.id === skipClipId) return; tryp(c.start); tryp(endOf(c)); });
    });
    if (o.grid > 0) tryp(Math.round(t / o.grid) * o.grid);
    return best == null ? t : best;
  }
  function quant(t, fps) { return Math.round(t * fps) / fps; }

  // Texto de tempo: 00:03.250 (min:seg.milésimos) e timecode 00:00:03:08 (h:m:s:quadros)
  function fmt(t) {
    t = Math.max(0, t || 0);
    var m = Math.floor(t / 60), s = t - m * 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s.toFixed(3);
  }
  function timecode(t, fps) {
    fps = Math.round(fps || 30);
    var total = Math.round(Math.max(0, t) * fps), f = total % fps, secs = Math.floor(total / fps);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(Math.floor(secs / 3600)) + ':' + p(Math.floor(secs / 60) % 60) + ':' + p(secs % 60) + ':' + p(f);
  }
  function parseTime(str, fps) {
    str = String(str || '').trim();
    if (!str) return null;
    var m;
    if ((m = /^(\d+):(\d+):(\d+):(\d+)$/.exec(str))) return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / (fps || 30);
    if ((m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(str))) return (+m[1]) * 60 + parseFloat(m[2]);
    var v = parseFloat(str.replace(',', '.'));
    return isFinite(v) ? v : null;
  }

  // ---------- relógio mestre ----------
  // O relógio guarda UMA referência: "no instante de parede W, o tempo da sequência era T0, andando à taxa R".
  // Qualquer janela que receber essa referência calcula o mesmo tempo, sem depender do requestAnimationFrame dela.
  function Clock(o) {
    o = o || {};
    this.wall = o.wall || function () { return Date.now(); };
    this.t0 = 0; this.ref = this.wall(); this.rate = 1; this.playing = false;
    this.duration = o.duration || 30;
    this.loop = { on: false, in: 0, out: null };
    this.ver = 0;
    this.sid = nid('clk');   // identifica quem manda o transporte; o receptor ignora mensagens velhas do mesmo remetente
    this.rsid = null;
    this.ended = false;
  }
  Clock.prototype._raw = function () {
    return this.playing ? this.t0 + (this.wall() - this.ref) / 1000 * this.rate : this.t0;
  };
  Clock.prototype.loopRange = function () {
    var out = this.loop.out == null ? this.duration : this.loop.out;
    var inn = clamp(this.loop.in, 0, this.duration);
    out = clamp(out, 0, this.duration);
    return out > inn + 0.01 ? [inn, out] : [0, this.duration];
  };
  // Tempo atual da sequência. Com loop ligado dá a volta; sem loop trava no fim.
  Clock.prototype.now = function () {
    var t = this._raw();
    if (this.loop.on) {
      var r = this.loopRange(), len = r[1] - r[0];
      if (this.rate >= 0) { if (t >= r[1]) t = r[0] + ((t - r[0]) % len); else if (t < 0) t = 0; }
      else if (t < r[0]) t = r[1] - ((r[0] - t) % len);
      return t;
    }
    if (t >= this.duration) { this.ended = this.playing; return this.duration; }
    if (t < 0) return 0;
    return t;
  };
  Clock.prototype._rebase = function (t) { this.t0 = t; this.ref = this.wall(); this.ver++; };
  Clock.prototype.play = function () {
    if (this.playing) return;
    var t = this.now();
    if (!this.loop.on && t >= this.duration - 1e-3) t = 0;
    this.ended = false;
    this._rebase(t); this.playing = true; this.ver++;
  };
  Clock.prototype.pause = function () {
    if (!this.playing) return;
    var t = this.now();
    this.playing = false; this._rebase(t);
  };
  Clock.prototype.stop = function () { this.playing = false; this.ended = false; this._rebase(this.loop.on ? this.loopRange()[0] : 0); };
  Clock.prototype.seek = function (t) { this._rebase(clamp(t, 0, this.duration)); this.ended = false; };
  Clock.prototype.setRate = function (r) {
    r = clamp(+r || 1, 0.1, 4);
    var t = this.now();
    this.rate = r; this._rebase(t);
  };
  Clock.prototype.setLoop = function (on, inn, out) {
    var t = this.now();
    this.loop = { on: !!on, in: inn == null ? 0 : inn, out: out == null ? null : out };
    this._rebase(t);
  };
  Clock.prototype.setDuration = function (d) { var t = this.now(); this.duration = Math.max(0.1, d); this._rebase(Math.min(t, this.duration)); };
  // Mensagem de transporte: é isso que vai pra janela de saída (e re-enviada de tempos em tempos pra corrigir deriva).
  Clock.prototype.transport = function () {
    return { sid: this.sid, ver: this.ver, t0: this.t0, ref: this.ref, rate: this.rate, playing: this.playing, duration: this.duration, loop: { on: this.loop.on, in: this.loop.in, out: this.loop.out } };
  };
  Clock.prototype.apply = function (tr) {
    if (!tr) return false;
    // mensagem atrasada (versão menor que a já aplicada, do mesmo remetente) não pode desfazer um seek novo
    if (tr.sid && tr.sid === this.rsid && (tr.ver || 0) < this.ver) return false;
    this.rsid = tr.sid || null;
    this.t0 = +tr.t0 || 0; this.ref = +tr.ref || this.wall(); this.rate = +tr.rate || 1; this.playing = !!tr.playing;
    this.duration = +tr.duration || this.duration;
    this.loop = tr.loop ? { on: !!tr.loop.on, in: +tr.loop.in || 0, out: tr.loop.out == null ? null : +tr.loop.out } : this.loop;
    this.ver = tr.ver || 0; this.ended = false;
    return true;
  };

  root.Sequence = {
    SCHEMA: SCHEMA, KF_PROPS: KF_PROPS, KF_LABEL: KF_LABEL, Clock: Clock,
    nid: nid, create: create, migrate: migrate, compat: compat, fixClip: fixClip, newTransform: newTransform,
    asset: asset, findClip: findClip, track: track, isMedia: isMedia, endOf: endOf, seqEnd: seqEnd, segLen: segLen, cycleLen: cycleLen, conflicts: conflicts,
    baseValue: baseValue, setBase: setBase, valueAt: valueAt, setKey: setKey, setInterpOn: setInterpOn, INTERP: INTERP, PRESET_H: PRESET_H, curveOf: curveOf, handlesOf: handlesOf, bez: bez, cpKf: cpKf, fixKf: fixKf, removeKey: removeKey, hasKey: hasKey, stepKey: stepKey, interp: interp,
    evalClip: evalClip, evaluate: evaluate, quadOf: quadOf, cropAt: cropAt, efOf: efOf, xformOf: xformOf, cropOf: cropOf, isIdentity: isIdentity,
    addTrack: addTrack, layersOf: layersOf, addLayer: addLayer, moveLayer: moveLayer, layerInfo: layerInfo, MAX_LAYERS: MAX_LAYERS, SOFT_LAYERS: SOFT_LAYERS, removeTrack: removeTrack, moveTrack: moveTrack, addAsset: addAsset, addClip: addClip, removeClip: removeClip,
    moveClip: moveClip, trimClip: trimClip, splitClip: splitClip, duplicateClip: duplicateClip, cloneClip: cloneClip, addMarker: addMarker, fixSnapOpts: fixSnapOpts,
    snapTime: snapTime, quant: quant, fmt: fmt, timecode: timecode, parseTime: parseTime, defaultDuration: defaultDuration, reorder: reorder
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Sequence;
})(typeof window !== 'undefined' ? window : globalThis);
