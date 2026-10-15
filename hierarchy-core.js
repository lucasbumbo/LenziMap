// LenziMap 3.0 fase 6: hierarquia profissional  Biblioteca > Projeto > Cena > [Grupo >] Cubo > Face > Camada > Clipe > Efeito.
// Módulo PURO (sem DOM). A árvore é uma VISÃO montada em cima dos dados reais, com IDs estáveis (os mesmos IDs que já existem):
//   projeto = seq.id, cena = scene.id, grupo = stage.groups[].id, cubo = stage.cubes[].id, face = cubo + face (slot fixo),
//   camada = track.id, clipe = clip.id, efeito = clip.id (o efeito do clipe).
// As operações mexem em seq.stage (palco do 3.2), na ordem das faixas e em propriedades de clipes. Nunca tocam em surface.q.
(function (root) {
  'use strict';
  var Seq = root.Sequence || (typeof require !== 'undefined' ? require('./sequence.js') : null);
  var IC = root.IllusionCore || (typeof require !== 'undefined' ? require('./illusion-core.js') : null);
  var MAX_CUBES = 16;

  var P = { lib: 'lib', prj: 'prj:', sc: 'sc:', grp: 'grp:', cb: 'cb:', fc: 'fc:', fs: 'fs:', free: 'free:', ly: 'ly:', cl: 'cl:', fx: 'fx:', aud: 'aud:' };
  var ids = {
    lib: function () { return 'lib'; }, prj: function (seq) { return 'prj:' + seq.id; }, sc: function (s) { return 'sc:' + s.id; },
    grp: function (g) { return 'grp:' + g.id; }, cb: function (c) { return 'cb:' + c.id; }, fc: function (cid, f) { return 'fc:' + cid + ':' + f; },
    fs: function (key) { return 'fs:' + key; }, free: function (s) { return 'free:' + s.id; }, ly: function (t) { return 'ly:' + t.id; },
    cl: function (c) { return 'cl:' + c.id; }, fx: function (c) { return 'fx:' + c.id; }, aud: function (seq) { return 'aud:' + seq.id; }
  };
  // "cb:A" -> {type:'cb', a:'A'}; "fc:A:front" -> {type:'fc', a:'A', b:'front'}
  function parse(id) {
    id = String(id || '');
    if (id === 'lib') return { type: 'lib' };
    var i = id.indexOf(':'); if (i < 0) return { type: '' };
    var type = id.slice(0, i), rest = id.slice(i + 1);
    if (type === 'fc') { var j = rest.lastIndexOf(':'); return { type: 'fc', a: rest.slice(0, j), b: rest.slice(j + 1) }; }
    return { type: type, a: rest };
  }

  function ensureSceneIds(scenes) {
    var seen = {};
    scenes.forEach(function (sc, i) {
      if (!sc.id || seen[sc.id]) sc.id = 'sc' + Date.now().toString(36) + i + Math.random().toString(36).slice(2, 5);
      seen[sc.id] = 1;
    });
    return scenes;
  }
  function stageOf(seq) {
    if (!seq.stage || !(seq.stage.v >= IC.STAGE_VERSION) || !Array.isArray(seq.stage.groups)) seq.stage = IC.fixStage(seq.stage);
    return seq.stage;
  }
  function cubeOf(stage, id) { return IC.cubeById(stage, id); }
  function trackOf(seq, id) { for (var i = 0; i < seq.tracks.length; i++) if (seq.tracks[i].id === id) return seq.tracks[i]; return null; }
  function clipOf(seq, id) { for (var i = 0; i < seq.tracks.length; i++) for (var j = 0; j < seq.tracks[i].clips.length; j++) if (seq.tracks[i].clips[j].id === id) return { clip: seq.tracks[i].clips[j], track: seq.tracks[i] }; return null; }
  function assetOf(seq, id) { for (var i = 0; i < seq.assets.length; i++) if (seq.assets[i].id === id) return seq.assets[i]; return null; }
  function node(id, type, name, meta) { return { id: id, type: type, name: name, meta: meta || {}, children: [] }; }

  var FX_NAME = { grade: 'Grade', illusion: '3D Illusion' };
  function effectOf(seq, c) {
    var a = assetOf(seq, c.assetId), out = [];
    if (a && a.kind === 'fx' && a.fx) out.push(a.fx.kind === 'illusion' ? '3D Illusion: ' + String(a.fx.illusion && a.fx.illusion.name || 'ilusão').slice(0, 40) : (FX_NAME[a.fx.kind] || a.fx.kind));
    if (c.ill && !(a && a.fx && a.fx.kind === 'illusion')) out.push('Ilusão 3D');
    return out;
  }
  function clipNode(seq, c, track) {
    var a = assetOf(seq, c.assetId), n = node(ids.cl(c), 'clip', c.name || (a && a.name) || 'Clipe', { clipId: c.id, trackId: track.id, start: c.start, duration: c.duration, locked: !!track.locked, kind: a ? a.kind : null });
    effectOf(seq, c).forEach(function (nm) { n.children.push(node(ids.fx(c), 'effect', nm, { clipId: c.id })); });
    return n;
  }
  function layerNode(seq, t, surfName) {
    var n = node(ids.ly(t), 'layer', t.name, { trackId: t.id, enabled: t.enabled, muted: t.muted, locked: t.locked, solo: t.solo, surfaceKey: t.surfaceId || null, audio: t.type === 'audio' });
    t.clips.slice().sort(function (a, b) { return a.start - b.start; }).forEach(function (c) { n.children.push(clipNode(seq, c, t)); });
    return n;
  }

  // ctx = { seq, scenes:[{id,name,surfaces:[{key,name}]}], active: índice da cena ativa, assetsCount?, projectName? }
  function build(ctx) {
    var seq = ctx.seq, stage = stageOf(seq), scenes = ensureSceneIds(ctx.scenes || []), act = ctx.active || 0;
    var lib = node(ids.lib(), 'library', 'Biblioteca', { assets: seq.assets.length });
    var prj = node(ids.prj(seq), 'project', ctx.projectName || seq.name || 'Projeto', { duration: seq.duration });
    lib.children.push(prj);
    var bound = {}; stage.cubes.forEach(function (c) { IC.FACES.forEach(function (f) { if (c.faces[f]) bound[c.faces[f]] = [c.id, f]; }); });
    scenes.forEach(function (sc, si) {
      var sceneNode = node(ids.sc(sc), 'scene', sc.name || ('Cena ' + (si + 1)), { index: si, active: si === act });
      var sk = {}; (sc.surfaces || []).forEach(function (s) { if (s.key) sk[s.key] = s; });
      var cubeNodes = {};
      stage.cubes.forEach(function (c) {
        var cn = node(ids.cb(c), 'cube', c.name, { cubeId: c.id, size: c.size, rotY: c.rotY, pos: c.pos });
        var any = false;
        (c.faceOrder || IC.FACES).forEach(function (f) {
          var key = c.faces[f], inScene = key && sk[key];
          if (key && !inScene) return;                    // face ligada a superfície de outra cena
          if (!key && si !== act) return;                 // slot vazio só aparece na cena ativa
          var fn = node(ids.fc(c.id, f), 'face', IC.FACE_LABEL[f] + (inScene ? ' · ' + (sk[key].name || key) : ' (vazia)'), { cubeId: c.id, face: f, surfaceKey: key || null, empty: !key });
          if (inScene) { any = true; Seq.layersOf(seq, key).forEach(function (t) { fn.children.push(layerNode(seq, t)); }); }
          cn.children.push(fn);
        });
        if (any || si === act) cubeNodes[c.id] = cn;
      });
      var placed = {};
      stage.groups.forEach(function (g) {
        var gn = node(ids.grp(g), 'group', g.name, { groupId: g.id }), n = 0;
        g.cubes.forEach(function (cid) { if (cubeNodes[cid]) { gn.children.push(cubeNodes[cid]); placed[cid] = 1; n++; } });
        if (n || si === act) sceneNode.children.push(gn);
      });
      stage.cubes.forEach(function (c) { if (cubeNodes[c.id] && !placed[c.id]) sceneNode.children.push(cubeNodes[c.id]); });
      var freeKeys = (sc.surfaces || []).filter(function (s) { return s.key && !bound[s.key]; });
      if (freeKeys.length) {
        var fr = node(ids.free(sc), 'free', 'Superfícies sem cubo', { sceneId: sc.id });
        freeKeys.forEach(function (s) { var fn = node(ids.fs(s.key), 'face', s.name || s.key, { surfaceKey: s.key, free: true }); Seq.layersOf(seq, s.key).forEach(function (t) { fn.children.push(layerNode(seq, t)); }); fr.children.push(fn); });
        sceneNode.children.push(fr);
      }
      prj.children.push(sceneNode);
    });
    var au = seq.tracks.filter(function (t) { return t.type === 'audio'; });
    if (au.length) { var an = node(ids.aud(seq), 'audio', 'Áudio', {}); au.forEach(function (t) { an.children.push(layerNode(seq, t)); }); prj.children.push(an); }
    return lib;
  }

  function find(tree, id) {
    if (tree.id === id) return tree;
    for (var i = 0; i < tree.children.length; i++) { var r = find(tree.children[i], id); if (r) return r; }
    return null;
  }
  // Lista plana das linhas visíveis (respeita recolhidos). Um mesmo ID pode aparecer mais de uma vez (cubo em várias cenas): path distingue.
  function flatten(tree, collapsed) {
    var out = []; collapsed = collapsed || {};
    (function walk(n, depth, path) {
      var p = path + '/' + n.id;
      out.push({ node: n, depth: depth, path: p, open: !collapsed[n.id] && n.children.length > 0 });
      if (collapsed[n.id]) return;
      n.children.forEach(function (c) { walk(c, depth + 1, p); });
    })(tree, 0, '');
    return out;
  }
  function allIds(tree) { var s = {}; (function w(n) { s[n.id] = 1; n.children.forEach(w); })(tree); return Object.keys(s); }

  // ---------- operações (todas devolvem {ok, error?, ...}) ----------
  function fail(m) { return { ok: false, error: m }; }
  function nextCubeId(stage) {
    var used = {}; stage.cubes.forEach(function (c) { used[c.id] = 1; });
    for (var i = 0; i < 26; i++) { var l = String.fromCharCode(65 + i); if (!used[l]) return l; }
    for (var k = 1; k < 100; k++) if (!used['C' + k]) return 'C' + k;
    return 'C' + Date.now().toString(36);
  }
  function nextGroupId(stage) { var used = {}; stage.groups.forEach(function (g) { used[g.id] = 1; }); for (var i = 1; i < 100; i++) if (!used['g' + i]) return 'g' + i; return 'g' + Date.now().toString(36); }
  function cleanName(n, max) { n = String(n == null ? '' : n).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 40); return n; }

  function createCube(seq, o) {
    o = o || {}; var st = stageOf(seq);
    if (st.cubes.length >= MAX_CUBES) return fail('Limite de ' + MAX_CUBES + ' cubos no palco.');
    var id = nextCubeId(st), size = Math.max(1, Math.min(200, +o.size || 8)), maxX = st.cubes.reduce(function (m, c) { return Math.max(m, c.pos[0] + c.size / 2); }, -Infinity);
    var cube = { id: id, name: cleanName(o.name, 40) || ('Cubo ' + id), size: size, pos: o.pos && o.pos.length === 3 ? o.pos.map(Number) : [isFinite(maxX) ? maxX + size / 2 + 6 : 0, size / 2, 0], rotY: 0, faces: { front: null, right: null, back: null, left: null, top: null }, faceOrder: IC.FACES.slice() };
    st.cubes.push(cube);
    if (o.group) setGroup(seq, id, o.group);
    seq.stage = IC.fixStage(st);
    return { ok: true, id: id, nodeId: ids.cb(cube) };
  }
  function renameCube(seq, id, name) { var c = cubeOf(stageOf(seq), id); name = cleanName(name, 40); if (!c) return fail('Cubo não encontrado.'); if (!name) return fail('O nome não pode ficar vazio.'); c.name = name; return { ok: true }; }
  function renameGroup(seq, id, name) { var g = stageOf(seq).groups.filter(function (x) { return x.id === id; })[0]; name = cleanName(name, 40); if (!g) return fail('Grupo não encontrado.'); if (!name) return fail('O nome não pode ficar vazio.'); g.name = name; return { ok: true }; }
  function renameScene(ctx, idx, name) { var s = ctx.scenes[idx]; name = cleanName(name, 60); if (!s) return fail('Cena não encontrada.'); if (!name) return fail('O nome não pode ficar vazio.'); s.name = name; return { ok: true }; }
  function renameLayer(seq, id, name) { var t = trackOf(seq, id); name = cleanName(name, 60); if (!t) return fail('Camada não encontrada.'); if (!name) return fail('O nome não pode ficar vazio.'); t.name = name; return { ok: true }; }
  function createGroup(seq, name, cubeIds) {
    var st = stageOf(seq), g = { id: nextGroupId(st), name: cleanName(name, 40) || ('Grupo ' + (st.groups.length + 1)), cubes: [] };
    if (st.groups.length >= 32) return fail('Limite de 32 grupos.');
    st.groups.push(g);
    (cubeIds || []).forEach(function (cid) { setGroup(seq, cid, g.id); });
    return { ok: true, id: g.id, nodeId: ids.grp(g) };
  }
  function setGroup(seq, cubeId, groupId) {
    var st = stageOf(seq); if (!cubeOf(st, cubeId)) return fail('Cubo não encontrado.');
    st.groups.forEach(function (g) { g.cubes = g.cubes.filter(function (x) { return x !== cubeId; }); });
    if (groupId) { var g = st.groups.filter(function (x) { return x.id === groupId; })[0]; if (!g) return fail('Grupo não encontrado.'); g.cubes.push(cubeId); }
    return { ok: true };
  }
  function deleteGroup(seq, groupId) { var st = stageOf(seq), n = st.groups.length; st.groups = st.groups.filter(function (g) { return g.id !== groupId; }); return n === st.groups.length ? fail('Grupo não encontrado.') : { ok: true }; }
  // Apaga o cubo do palco. As superfícies e camadas continuam existindo (viram "sem cubo"). Ilusões que apontavam pro cubo avisam.
  function deleteCube(seq, id) {
    var st = stageOf(seq), c = cubeOf(st, id); if (!c) return fail('Cubo não encontrado.');
    if (st.cubes.length <= 1) return fail('O palco precisa de pelo menos um cubo.');
    var used = 0; seq.assets.forEach(function (a) { if (a.fx && a.fx.illusion && a.fx.illusion.target && a.fx.illusion.target.cube === id) used++; });
    st.cubes = st.cubes.filter(function (x) { return x.id !== id; }); st.groups.forEach(function (g) { g.cubes = g.cubes.filter(function (x) { return x !== id; }); });
    return { ok: true, warnings: used ? [used + ' ilusão(ões) 3D apontavam para este cubo e passam a usar o primeiro cubo.'] : [] };
  }
  function moveCube(seq, id, toIndex) {
    var st = stageOf(seq), i = st.cubes.findIndex(function (c) { return c.id === id; }); if (i < 0) return fail('Cubo não encontrado.');
    toIndex = Math.max(0, Math.min(st.cubes.length - 1, toIndex | 0)); var c = st.cubes.splice(i, 1)[0]; st.cubes.splice(toIndex, 0, c); return { ok: true, index: toIndex };
  }
  function reorderFace(seq, cubeId, face, toIndex) {
    var c = cubeOf(stageOf(seq), cubeId); if (!c) return fail('Cubo não encontrado.');
    var i = c.faceOrder.indexOf(face); if (i < 0) return fail('Face inválida.');
    toIndex = Math.max(0, Math.min(c.faceOrder.length - 1, toIndex | 0)); c.faceOrder.splice(i, 1); c.faceOrder.splice(toIndex, 0, face); return { ok: true };
  }
  // Move (ou troca) a superfície ligada a uma face. Se a face de destino já tem superfície, as duas trocam de lugar.
  function moveFaceBinding(seq, from, to) {
    var st = stageOf(seq), a = cubeOf(st, from.cube), b = cubeOf(st, to.cube);
    if (!a || !b || IC.FACES.indexOf(from.face) < 0 || IC.FACES.indexOf(to.face) < 0) return fail('Face inválida.');
    var ka = a.faces[from.face], kb = b.faces[to.face]; if (!ka && !kb) return { ok: true, noop: true };
    a.faces[from.face] = kb || null; b.faces[to.face] = ka || null; return { ok: true, swapped: !!(ka && kb) };
  }
  function bindFace(seq, cubeId, face, surfaceKey) {
    var st = stageOf(seq), c = cubeOf(st, cubeId); if (!c || IC.FACES.indexOf(face) < 0) return fail('Face inválida.');
    if (surfaceKey) st.cubes.forEach(function (x) { IC.FACES.forEach(function (f) { if (x.faces[f] === surfaceKey) x.faces[f] = null; }); });
    c.faces[face] = surfaceKey || null; return { ok: true };
  }
  // Camada: posição dentro da face (0 = topo da lista = por cima)
  function moveLayerTo(seq, trackId, toIndex) {
    var t = trackOf(seq, trackId); if (!t || t.type !== 'video' || !t.surfaceId) return fail('Camada inválida.');
    var ls = Seq.layersOf(seq, t.surfaceId), i = ls.indexOf(t); toIndex = Math.max(0, Math.min(ls.length - 1, toIndex | 0));
    var dir = toIndex > i ? 1 : -1, guard = 0; while (ls.indexOf(t) !== toIndex && guard++ < 200) { if (!Seq.moveLayer(seq, trackId, dir)) break; ls = Seq.layersOf(seq, t.surfaceId); }
    return { ok: true, index: Seq.layersOf(seq, t.surfaceId).indexOf(t) };
  }
  // Leva a camada para outra superfície (fica por cima). Clipes de ilusão passam a valer para a nova face.
  function moveLayerToSurface(seq, trackId, surfaceKey) {
    var t = trackOf(seq, trackId); if (!t || t.type !== 'video' || !surfaceKey) return fail('Camada ou superfície inválida.');
    if (t.surfaceId === surfaceKey) return { ok: true, noop: true };
    var ls = Seq.layersOf(seq, surfaceKey), at = ls.length ? seq.tracks.indexOf(ls[0]) : seq.tracks.length, cur = seq.tracks.indexOf(t);
    seq.tracks.splice(cur, 1); if (cur < at) at--; seq.tracks.splice(at, 0, t); t.surfaceId = surfaceKey;
    seq.tracks.forEach(function (x, k) { x.order = k; }); return { ok: true };
  }

  // ---------- seleção e propriedades compartilhadas ----------
  var PROPS = {
    cube: [{ p: 'size', label: 'Tamanho (pol)', min: 1, max: 200, step: 0.5 }, { p: 'rotY', label: 'Giro Y (graus)', min: -360, max: 360, step: 1 }],
    layer: [{ p: 'enabled', label: 'Ativa', bool: true }, { p: 'muted', label: 'Silenciada', bool: true }, { p: 'locked', label: 'Travada', bool: true }],
    clip: [{ p: 'opacity', label: 'Opacidade', min: 0, max: 1, step: 0.05 }, { p: 'fadeIn', label: 'Fade in (s)', min: 0, max: 60, step: 0.1 }, { p: 'fadeOut', label: 'Fade out (s)', min: 0, max: 60, step: 0.1 }, { p: 'speed', label: 'Velocidade', min: 0.05, max: 16, step: 0.05 }]
  };
  function target(ctx, id) {
    var q = parse(id), seq = ctx.seq;
    if (q.type === 'cb') { var c = cubeOf(stageOf(seq), q.a); return c ? { kind: 'cube', obj: c } : null; }
    if (q.type === 'ly') { var t = trackOf(seq, q.a); return t ? { kind: 'layer', obj: t } : null; }
    if (q.type === 'cl') { var r = clipOf(seq, q.a); return r ? { kind: 'clip', obj: r.clip, track: r.track } : null; }
    return null;
  }
  // Lista as propriedades que valem para TODOS os selecionados (mesmo tipo). value = valor comum ou null; mixed = valores diferentes.
  function sharedProps(ctx, selIds) {
    var ts = []; (selIds || []).forEach(function (id) { var t = target(ctx, id); if (t) ts.push(t); });
    if (!ts.length) return { kind: null, count: 0, props: [] };
    var kind = ts[0].kind; if (ts.some(function (t) { return t.kind !== kind; })) return { kind: 'misto', count: ts.length, props: [], note: 'A seleção mistura tipos diferentes. Selecione só cubos, só camadas ou só clipes para editar juntos.' };
    var props = PROPS[kind].map(function (d) {
      var vals = ts.map(function (t) { return t.obj[d.p]; }), same = vals.every(function (v) { return v === vals[0]; });
      return Object.assign({}, d, { value: same ? vals[0] : null, mixed: !same });
    });
    return { kind: kind, count: ts.length, props: props };
  }
  function setShared(ctx, selIds, prop, value) {
    var n = 0, skipped = 0, kinds = {}; var sh = sharedProps(ctx, selIds);
    var def = sh.props.filter(function (d) { return d.p === prop; })[0]; if (!def) return fail('Propriedade não compartilhada pela seleção.');
    var v = def.bool ? !!value : Math.max(def.min, Math.min(def.max, +value)); if (!def.bool && !isFinite(v)) return fail('Valor inválido.');
    (selIds || []).forEach(function (id) {
      var t = target(ctx, id); if (!t) return;
      if (t.kind === 'clip' && t.track.locked) { skipped++; return; }               // faixa travada nunca é alterada
      if (t.kind === 'layer' && t.obj.locked && prop !== 'locked') { skipped++; return; }
      t.obj[prop] = v; n++;
    });
    if (sh.kind === 'cube') ctx.seq.stage = IC.fixStage(ctx.seq.stage);
    return { ok: true, changed: n, skipped: skipped };
  }

  // Estado de recolhimento persistido em seq.settings.tree.collapsed
  function collapsedOf(seq) { seq.settings = seq.settings || {}; seq.settings.tree = seq.settings.tree || { collapsed: {} }; return seq.settings.tree.collapsed; }
  function toggle(seq, id, open) { var c = collapsedOf(seq); if (open === undefined) open = !!c[id]; if (open) delete c[id]; else c[id] = 1; return !c[id]; }

  var api = {
    MAX_CUBES: MAX_CUBES, PROPS: PROPS, ids: ids, parse: parse, build: build, find: find, flatten: flatten, allIds: allIds, ensureSceneIds: ensureSceneIds, stageOf: stageOf,
    createCube: createCube, renameCube: renameCube, renameGroup: renameGroup, renameScene: renameScene, renameLayer: renameLayer, createGroup: createGroup, setGroup: setGroup, deleteGroup: deleteGroup, deleteCube: deleteCube,
    moveCube: moveCube, reorderFace: reorderFace, moveFaceBinding: moveFaceBinding, bindFace: bindFace, moveLayerTo: moveLayerTo, moveLayerToSurface: moveLayerToSurface,
    sharedProps: sharedProps, setShared: setShared, collapsedOf: collapsedOf, toggle: toggle
  };
  root.HierarchyCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
