// LenziMap 3.0 fase 7: Connected Clips e Compound Clips. Módulo PURO (sem DOM).
//
// Connected Clip: um clipe (filho) fica ligado a outro (principal) com clip.conn = { to: idDoPrincipal }. Quando o principal se
// move (arrastar, setas, campo Início, ripple...), os filhos acompanham. Mover só o filho muda o deslocamento dele em relação ao principal.
// Compound Clip: um GRUPO nomeado de clipes (de várias camadas/faces) marcados com clip.cg = idDoComposto. Fechado, comporta-se como
// uma unidade (seleciona, move, duplica e apaga junto). Aberto, os clipes são editáveis um a um. "Separar" desfaz o grupo.
//
// TEMPO ABSOLUTO: nenhum clipe guarda tempo relativo ao composto ou ao principal. clip.start é SEMPRE tempo da sequência (relógio mestre),
// então o mapeamento de projeção continua correto em qualquer face. Os grupos só dizem quem anda junto.
// Não toca em surface.q, faixas travadas nem nos keyframes (que seguem relativos ao próprio clipe).
(function (root) {
  'use strict';
  var Seq = root.Sequence || (typeof require !== 'undefined' ? require('./sequence.js') : null);
  var EPS = 1e-6;
  var COLORS = ['#4fc3ff', '#ffb347', '#7bed9f', '#ff6b9d', '#c792ea', '#ffd24a', '#5eead4', '#fb7185'];

  function all(seq) { var out = []; seq.tracks.forEach(function (t) { t.clips.forEach(function (c) { out.push({ clip: c, track: t }); }); }); return out; }
  function byId(seq) { var m = {}; all(seq).forEach(function (x) { m[x.clip.id] = x; }); return m; }
  function fail(m) { return { ok: false, error: m }; }
  function comps(seq) { if (!Array.isArray(seq.compounds)) seq.compounds = []; return seq.compounds; }
  function compById(seq, id) { var l = comps(seq); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function nextColor(seq) { return COLORS[comps(seq).length % COLORS.length]; }

  // ---------- conexões ----------
  function parentOf(seq, id) { var x = byId(seq)[id]; return x && x.clip.conn ? x.clip.conn.to : null; }
  function childrenOf(seq, id, deep) {
    var m = byId(seq), out = [], seen = {}; seen[id] = 1;
    (function walk(pid) { all(seq).forEach(function (x) { if (x.clip.conn && x.clip.conn.to === pid && !seen[x.clip.id]) { seen[x.clip.id] = 1; out.push(x.clip.id); if (deep) walk(x.clip.id); } }); })(id);
    return out;
  }
  function isDescendant(seq, anc, id) { return childrenOf(seq, anc, true).indexOf(id) >= 0; }
  // Liga os clipes filhos ao principal. Recusa ciclos, auto-conexão e principal inexistente.
  function connect(seq, childIds, parentId) {
    var m = byId(seq), P = m[parentId]; if (!P) return fail('O clipe principal não existe.');
    var kids = (childIds || []).filter(function (id) { return id !== parentId && m[id]; });
    if (!kids.length) return fail('Selecione pelo menos um clipe além do principal.');
    var done = [], skipped = [];
    kids.forEach(function (id) {
      if (isDescendant(seq, id, parentId)) { skipped.push(m[id].clip.name || id); return; }        // evitaria um ciclo
      if (m[id].clip.cg && m[id].clip.cg !== P.clip.cg) { /* clipe de composto pode se conectar; o grupo segue junto */ }
      m[id].clip.conn = { to: parentId, off: round(m[id].clip.start - P.clip.start) }; done.push(id);
    });
    if (!done.length) return fail('Essa ligação criaria um ciclo (o principal já depende de um dos clipes).');
    return { ok: true, connected: done, skipped: skipped };
  }
  function disconnect(seq, ids) { var m = byId(seq), n = 0; (ids || []).forEach(function (id) { if (m[id] && m[id].clip.conn) { delete m[id].clip.conn; n++; } }); return { ok: true, count: n }; }
  function round(v) { return Math.round(v * 1000) / 1000; }
  // Atualiza o deslocamento informativo (off) de todas as conexões
  function syncOffsets(seq) { var m = byId(seq); all(seq).forEach(function (x) { var c = x.clip; if (c.conn && m[c.conn.to]) c.conn.off = round(c.start - m[c.conn.to].clip.start); }); }

  // ---------- seguir o principal (qualquer edição) ----------
  // mark() guarda o início de todos os clipes antes de uma edição; follow() depois move quem estava ligado a quem se mexeu.
  var marks = null;
  function mark(seq) { var s = {}; all(seq).forEach(function (x) { s[x.clip.id] = x.clip.start; }); marks = s; return s; }
  function follow(seq, before) {
    before = before || marks; marks = null; if (!before) return { moved: [] };
    var m = byId(seq), moved = [], delta = {};
    // 1) deslocamento de cada clipe que mudou por conta própria
    Object.keys(m).forEach(function (id) { if (before[id] != null) { var d = m[id].clip.start - before[id]; if (Math.abs(d) > EPS) delta[id] = d; } });
    var touched = {}; Object.keys(delta).forEach(function (id) { touched[id] = 1; });
    // 2) compostos FECHADOS: os membros que não se moveram acompanham o primeiro que se moveu
    comps(seq).forEach(function (g) {
      if (g.open) return;
      var mem = all(seq).filter(function (x) { return x.clip.cg === g.id; }), lead = null;
      mem.forEach(function (x) { if (lead == null && delta[x.clip.id] != null) lead = delta[x.clip.id]; });
      if (lead == null) return;
      mem.forEach(function (x) { if (touched[x.clip.id] || x.track.locked) return; x.clip.start = Math.max(0, x.clip.start + lead); delta[x.clip.id] = lead; touched[x.clip.id] = 1; moved.push(x.clip.id); });
    });
    // 3) filhos conectados acompanham o principal (em cadeia, do principal para baixo)
    var queue = Object.keys(delta);
    while (queue.length) {
      var pid = queue.shift(), d = delta[pid];
      all(seq).forEach(function (x) {
        var c = x.clip; if (!c.conn || c.conn.to !== pid || touched[c.id]) return;
        if (x.track.locked) { touched[c.id] = 1; return; }                       // faixa travada nunca anda
        c.start = Math.max(0, c.start + d); delta[c.id] = d; touched[c.id] = 1; moved.push(c.id); queue.push(c.id);
      });
    }
    var maxEnd = 0; all(seq).forEach(function (x) { maxEnd = Math.max(maxEnd, x.clip.start + x.clip.duration); });
    if (maxEnd > seq.duration) seq.duration = Math.ceil(maxEnd);
    syncOffsets(seq);
    return { moved: moved };
  }
  // Conjunto de clipes que andam junto num arrasto: seleção + membros de compostos fechados + filhos conectados (em cadeia). Sem faixas travadas.
  function dragSet(seq, ids) {
    var m = byId(seq), set = {}, order = [];
    function add(id) { if (!set[id] && m[id] && !m[id].track.locked) { set[id] = 1; order.push(id); return true; } return false; }
    (ids || []).forEach(add);
    var grew = true;
    while (grew) {
      grew = false;
      order.slice().forEach(function (id) {
        var c = m[id].clip, g = c.cg && compById(seq, c.cg);
        if (g && !g.open) all(seq).forEach(function (x) { if (x.clip.cg === g.id && add(x.clip.id)) grew = true; });
        all(seq).forEach(function (x) { if (x.clip.conn && x.clip.conn.to === id && add(x.clip.id)) grew = true; });
      });
    }
    return order;
  }
  // Seleção "fechada": clicar num membro de composto fechado seleciona todos os membros
  function selectionClosure(seq, ids) {
    var m = byId(seq), set = {}, out = [];
    (ids || []).forEach(function (id) {
      if (!m[id]) return; if (!set[id]) { set[id] = 1; out.push(id); }
      var g = m[id].clip.cg && compById(seq, m[id].clip.cg);
      if (g && !g.open) all(seq).forEach(function (x) { if (x.clip.cg === g.id && !set[x.clip.id]) { set[x.clip.id] = 1; out.push(x.clip.id); } });
    });
    return out;
  }

  // ---------- compostos ----------
  function membersOf(seq, gid) { return all(seq).filter(function (x) { return x.clip.cg === gid; }).map(function (x) { return x.clip.id; }); }
  function compoundOf(seq, clipId) { var x = byId(seq)[clipId]; return x && x.clip.cg ? compById(seq, x.clip.cg) : null; }
  function info(seq, gid) {
    var mem = all(seq).filter(function (x) { return x.clip.cg === gid; }); if (!mem.length) return null;
    var s = Infinity, e = 0, tr = {}, sf = {};
    mem.forEach(function (x) { s = Math.min(s, x.clip.start); e = Math.max(e, x.clip.start + x.clip.duration); tr[x.track.id] = 1; if (x.track.surfaceId) sf[x.track.surfaceId] = 1; });
    return { id: gid, start: s, end: e, duration: e - s, clips: mem.length, tracks: Object.keys(tr).length, surfaces: Object.keys(sf) };
  }
  function makeCompound(seq, ids, name) {
    var m = byId(seq), mem = []; (ids || []).forEach(function (id) { if (m[id] && mem.indexOf(id) < 0) mem.push(id); });
    if (mem.length < 2) return fail('Selecione pelo menos 2 clipes para criar um clipe composto.');
    if (mem.some(function (id) { return m[id].clip.cg; })) return fail('Algum clipe já faz parte de um composto. Separe-o antes (compostos dentro de compostos ainda não são suportados).');
    if (mem.some(function (id) { return m[id].track.locked; })) return fail('Há clipe em faixa travada. Destrave para agrupar.');
    var g = { id: Seq.nid('cg'), name: String(name || '').trim().slice(0, 60) || ('Composto ' + (comps(seq).length + 1)), color: nextColor(seq), open: false };
    comps(seq).push(g); mem.forEach(function (id) { m[id].clip.cg = g.id; });
    return { ok: true, id: g.id, compound: g, members: mem };
  }
  function setOpen(seq, gid, open) { var g = compById(seq, gid); if (!g) return fail('Composto não encontrado.'); g.open = !!open; return { ok: true, open: g.open }; }
  function breakApart(seq, gid) {
    var g = compById(seq, gid); if (!g) return fail('Composto não encontrado.');
    var n = 0; all(seq).forEach(function (x) { if (x.clip.cg === gid) { delete x.clip.cg; n++; } });
    seq.compounds = comps(seq).filter(function (c) { return c.id !== gid; });
    return { ok: true, released: n };
  }
  function renameCompound(seq, gid, name) { var g = compById(seq, gid); name = String(name || '').trim().slice(0, 60); if (!g) return fail('Composto não encontrado.'); if (!name) return fail('O nome não pode ficar vazio.'); g.name = name; return { ok: true }; }
  // Duplica o composto inteiro: clipes novos (IDs novos), mesmas camadas, conexões internas refeitas, começando em "at" (padrão: logo depois do original).
  function duplicateCompound(seq, gid, at) {
    var g = compById(seq, gid), inf = info(seq, gid); if (!g || !inf) return fail('Composto não encontrado.');
    var mem = all(seq).filter(function (x) { return x.clip.cg === gid; }), start = at == null ? inf.end : Math.max(0, at), shift = start - inf.start, map = {};
    var ng = { id: Seq.nid('cg'), name: g.name + ' cópia', color: nextColor(seq), open: g.open };
    comps(seq).push(ng);
    mem.forEach(function (x) { var n = Seq.cloneClip(x.clip); n.start = Math.max(0, x.clip.start + shift); n.cg = ng.id; delete n.conn; map[x.clip.id] = n; x.track.clips.push(n); });
    mem.forEach(function (x) { var c = x.clip; if (c.conn && map[c.conn.to]) map[c.id].conn = { to: map[c.conn.to].id, off: c.conn.off }; });   // só ligações internas
    var maxEnd = 0; Object.keys(map).forEach(function (k) { maxEnd = Math.max(maxEnd, map[k].start + map[k].duration); }); if (maxEnd > seq.duration) seq.duration = Math.ceil(maxEnd);
    return { ok: true, id: ng.id, clips: Object.keys(map).map(function (k) { return map[k].id; }), start: start };
  }
  // Move o composto inteiro para um novo início (todos os clipes mantêm o deslocamento entre si; tempo continua absoluto)
  function moveCompound(seq, gid, newStart) {
    var inf = info(seq, gid); if (!inf) return fail('Composto não encontrado.');
    var mem = all(seq).filter(function (x) { return x.clip.cg === gid; });
    if (mem.some(function (x) { return x.track.locked; })) return fail('Há clipe do composto em faixa travada.');
    var d = Math.max(0, newStart) - inf.start; mem.forEach(function (x) { x.clip.start += d; });
    var maxEnd = 0; mem.forEach(function (x) { maxEnd = Math.max(maxEnd, x.clip.start + x.clip.duration); }); if (maxEnd > seq.duration) seq.duration = Math.ceil(maxEnd);
    return { ok: true, delta: d };
  }
  function deleteCompound(seq, gid) {
    var mem = all(seq).filter(function (x) { return x.clip.cg === gid; }); if (mem.some(function (x) { return x.track.locked; })) return fail('Há clipe do composto em faixa travada.');
    mem.forEach(function (x) { Seq.removeClip(seq, x.clip.id); });
    seq.compounds = comps(seq).filter(function (c) { return c.id !== gid; }); sanitize(seq);
    return { ok: true, removed: mem.length };
  }

  // Limpa referências quebradas (clipe apagado, composto com menos de 2 membros). Roda depois de qualquer edição e ao abrir.
  function sanitize(seq) {
    var m = byId(seq), fixed = 0;
    all(seq).forEach(function (x) { var c = x.clip; if (c.conn && (!m[c.conn.to] || c.conn.to === c.id)) { delete c.conn; fixed++; } });
    // ciclos (arquivo editado à mão): quebra a ligação que fecha o ciclo
    all(seq).forEach(function (x) { var c = x.clip, seen = {}, cur = c; while (cur && cur.conn) { if (seen[cur.id]) { delete cur.conn; fixed++; break; } seen[cur.id] = 1; cur = m[cur.conn.to] && m[cur.conn.to].clip; } });
    var counts = {}; all(seq).forEach(function (x) { if (x.clip.cg) counts[x.clip.cg] = (counts[x.clip.cg] || 0) + 1; });
    all(seq).forEach(function (x) { if (x.clip.cg && !compById(seq, x.clip.cg)) { delete x.clip.cg; fixed++; } });
    seq.compounds = comps(seq).filter(function (g) { if ((counts[g.id] || 0) < 2) { all(seq).forEach(function (x) { if (x.clip.cg === g.id) delete x.clip.cg; }); fixed++; return false; } return true; });
    return fixed;
  }

  var api = { COLORS: COLORS, parentOf: parentOf, childrenOf: childrenOf, connect: connect, disconnect: disconnect, syncOffsets: syncOffsets, mark: mark, follow: follow, dragSet: dragSet, selectionClosure: selectionClosure,
    membersOf: membersOf, compoundOf: compoundOf, compById: compById, info: info, makeCompound: makeCompound, setOpen: setOpen, breakApart: breakApart, renameCompound: renameCompound, duplicateCompound: duplicateCompound, moveCompound: moveCompound, deleteCompound: deleteCompound, sanitize: sanitize };
  root.CompoundCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
