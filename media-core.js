// Media Browser: lógica pura (filtro, ordenação, coleções, uso, relink). Sem DOM, testável em Node.
(function (root) {
  'use strict';
  var KINDS = { video: 'Vídeo', img: 'Imagem', audio: 'Áudio', fx: 'Efeito', text: 'Texto', cam: 'Câmera' };
  var SORTS = { name: 'Nome', kind: 'Tipo', duration: 'Duração', added: 'Mais recentes', usage: 'Uso' };

  function base(p) { return String(p || '').split(/[\\/]/).pop(); }
  function dir(p) { var s = String(p || ''), i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\')); return i < 0 ? '' : s.slice(0, i); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function fileBacked(a) { return !!(a && a.path && !a.test && (a.kind === 'video' || a.kind === 'img' || a.kind === 'audio')); }
  function usage(seq) {                                    // assetId -> quantidade de clipes
    var u = {}; (seq.tracks || []).forEach(function (t) { (t.clips || []).forEach(function (c) { u[c.assetId] = (u[c.assetId] || 0) + 1; }); }); return u;
  }
  function fmtDur(d) { if (d == null || !isFinite(d)) return ''; var m = Math.floor(d / 60), s = d - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(s % 1 ? 1 : 0); }
  function describe(a, uses) {                             // linhas de informação mostradas no cartão
    var p = [KINDS[a.kind] || a.kind];
    if (a.dims && a.dims[0]) p.push(a.dims[0] + '×' + a.dims[1]);
    if (a.meta && a.meta.fps) p.push(Math.round(a.meta.fps * 100) / 100 + ' fps');
    if (a.duration) p.push(fmtDur(a.duration));
    if (a.kind === 'video' && a.meta && a.meta.audio === true) p.push('com áudio'); else if (a.kind === 'video' && a.meta && a.meta.audio === false) p.push('sem áudio');
    if (a.kind === 'audio' && a.meta && a.meta.channels) p.push(a.meta.channels === 1 ? 'mono' : a.meta.channels === 2 ? 'estéreo' : a.meta.channels + ' canais');
    if (uses) p.push('em ' + uses + (uses === 1 ? ' clipe' : ' clipes'));
    return p.join(' · ');
  }
  function collections(assets) { var m = {}; assets.forEach(function (a) { if (a.collection) m[a.collection] = (m[a.collection] || 0) + 1; }); return Object.keys(m).sort().map(function (k) { return { name: k, n: m[k] }; }); }
  function filter(assets, o, uses) {
    o = o || {}; var q = norm(String(o.q || '').trim()); uses = uses || {};
    return assets.filter(function (a) {
      if (o.kind && o.kind !== 'all' && a.kind !== o.kind) return false;
      if (o.collection === '(none)') { if (a.collection) return false; } else if (o.collection && o.collection !== 'all' && a.collection !== o.collection) return false;
      if (o.onlyOffline && !a._off) return false;
      if (o.onlyUnused && uses[a.id]) return false;
      if (q) { var hay = norm(a.name + ' ' + (a.path ? base(a.path) : '') + ' ' + (KINDS[a.kind] || '') + ' ' + (a.collection || '')); if (hay.indexOf(q) < 0) return false; }
      return true;
    });
  }
  function sort(list, key, desc, uses) {
    uses = uses || {}; var ix = {}; list.forEach(function (a, i) { ix[a.id] = i; });
    var f = { name: function (a, b) { return a.name.localeCompare(b.name, 'pt', { numeric: true, sensitivity: 'base' }); },
      kind: function (a, b) { return a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'pt', { numeric: true }); },
      duration: function (a, b) { return (a.duration || 0) - (b.duration || 0); },
      added: function (a, b) { return (b.added || 0) - (a.added || 0); },
      usage: function (a, b) { return (uses[b.id] || 0) - (uses[a.id] || 0); } }[key] || null;
    var out = list.slice(); if (!f) return out;
    out.sort(function (a, b) { var r = f(a, b); return (r || ix[a.id] - ix[b.id]) * (desc ? -1 : 1); });
    return out;
  }
  // Relink em lote: casa ativos offline com arquivos de uma pasta escolhida, pelo nome do arquivo (sem diferenciar maiúsculas).
  function matchRelink(offline, files) {
    var by = {}; files.forEach(function (p) { var k = base(p).toLowerCase(); if (!by[k]) by[k] = p; });
    var hit = [], miss = [];
    offline.forEach(function (a) { var p = by[base(a.path).toLowerCase()]; if (p) hit.push({ asset: a, path: p }); else miss.push(a); });
    return { hit: hit, miss: miss };
  }
  // Troca o arquivo de um ativo preservando todos os clipes. Corta só o que passar do novo comprimento. Devolve o que mudou.
  function relink(seq, asset, path, info) {
    info = info || {}; var r = { clipped: 0, kept: 0 };
    asset.path = path; delete asset.src;
    if (info.duration != null && isFinite(info.duration)) asset.duration = info.duration;
    if (info.dims) asset.dims = info.dims;
    if (info.meta) asset.meta = Object.assign({}, asset.meta || {}, info.meta);
    asset.name = asset.name || base(path);
    var dur = asset.duration;
    (seq.tracks || []).forEach(function (t) { (t.clips || []).forEach(function (c) {
      if (c.assetId !== asset.id) return;
      if ((asset.kind === 'video' || asset.kind === 'audio') && dur && c.inPoint != null && c.outPoint != null) {
        if (c.outPoint > dur + 1e-6) { c.outPoint = dur; c.duration = Math.max(0.04, Math.min(c.duration, dur - (c.inPoint || 0))); r.clipped++; return; }
      }
      r.kept++;
    }); });
    return r;
  }
  function canDelete(seq, id) { return !usage(seq)[id]; }
  function removeAsset(seq, id) { if (!canDelete(seq, id)) return false; var i = seq.assets.findIndex(function (a) { return a.id === id; }); if (i < 0) return false; seq.assets.splice(i, 1); return true; }
  function setCollection(a, name) { name = String(name || '').trim().slice(0, 40); a.collection = name; return name; }

  root.MediaCore = { KINDS: KINDS, SORTS: SORTS, base: base, dir: dir, fileBacked: fileBacked, usage: usage, describe: describe, collections: collections, filter: filter, sort: sort, matchRelink: matchRelink, relink: relink, canDelete: canDelete, removeAsset: removeAsset, setCollection: setCollection, fmtDur: fmtDur };
  if (typeof module !== 'undefined') module.exports = root.MediaCore;
})(typeof window !== 'undefined' ? window : globalThis);
