// Media Browser: biblioteca de mídia do projeto dentro da aba Timeline. Miniaturas, metadados, busca, ordenação,
// coleções, mídia offline, relink e substituição. Usa o Sequence existente (assets), sem esquema novo obrigatório.
(function () {
  'use strict';
  var MC = window.MediaCore; if (!MC) return;
  var host = null, box = null, listEl = null, infoEl = null, ctl = {};
  var Q = { q: '', kind: 'all', collection: 'all', sort: 'added', desc: false, onlyOffline: false, onlyUnused: false };
  var thumbs = {}, thumbQ = [], thumbBusy = false, inspQ = [], inspBusy = false, lastSig = '';

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function seq() { return host.seq(); }
  function urlOf(a) { return a.src || (a.path ? host.toUrl(a.path) : ''); }

  // ---- miniaturas (só em memória; nunca vão para o projeto)
  function thumbOf(a, cb) {
    var key = a.id + '|' + (a.path || ''), t = thumbs[key];
    if (t) { if (t.cv) cb(t.cv); return; }
    thumbs[key] = { pending: true };
    var done = function (cv) { thumbs[key] = cv ? { cv: cv } : { fail: true }; if (cv) cb(cv); };
    function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    if (a.kind === 'img') {
      var im = new Image(); im.onload = function () { var c = mk(160, Math.max(1, Math.round(160 * im.naturalHeight / im.naturalWidth))); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); done(c); }; im.onerror = function () { done(null); }; im.src = urlOf(a);
    } else if (a.kind === 'video') { thumbQ.push([a, done]); nextThumb(); }
    else if (a.kind === 'fx' && a.fx && window.Renderer && Renderer.drawFx) { var c2 = mk(160, 90); try { Renderer.drawFx(c2, { w: 160, h: 90, fx: a.fx }, 3500); done(c2); } catch (e) { done(null); } }
    else if (a.kind === 'text') { var c3 = mk(160, 90), g = c3.getContext('2d'); g.fillStyle = '#10151c'; g.fillRect(0, 0, 160, 90); g.fillStyle = (a.text && a.text.color) || '#fff'; g.font = '600 20px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String((a.text && (a.text.t || a.text.text)) || 'Texto').slice(0, 14), 80, 45); done(c3); }
    else done(null);
  }
  function nextThumb() {
    if (thumbBusy || !thumbQ.length) return; thumbBusy = true;
    var it = thumbQ.shift(), a = it[0], done = it[1], v = document.createElement('video'), fin = false;
    function end(ok) { if (fin) return; fin = true; var cv = null; if (ok) { try { cv = document.createElement('canvas'); cv.width = 160; cv.height = Math.max(1, Math.round(160 * (v.videoHeight || 90) / (v.videoWidth || 160))); cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height); } catch (e) { cv = null; } } v.removeAttribute('src'); try { v.load(); } catch (e) {} done(cv); thumbBusy = false; nextThumb(); }
    v.muted = true; v.preload = 'auto';
    v.onloadedmetadata = function () { try { v.currentTime = Math.min(1, (v.duration || 2) / 3); } catch (e) { end(false); } };
    v.onseeked = function () { end(true); }; v.onerror = function () { end(false); };
    setTimeout(function () { end(false); }, 6000); v.src = urlOf(a);
  }

  // ---- metadados (fps e áudio), uma mídia por vez, só se ainda não existirem
  function nearFps(x) { var c = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60], b = c[0]; c.forEach(function (k) { if (Math.abs(k - x) < Math.abs(b - x)) b = k; }); return Math.abs(b - x) / b < 0.06 ? b : Math.round(x * 100) / 100; }
  function inspectNext() {
    if (inspBusy || !inspQ.length) return; inspBusy = true;
    var a = inspQ.shift(), v = document.createElement('video'), fin = false, frames = [], hadRVFC = typeof v.requestVideoFrameCallback === 'function';
    function end() { if (fin) return; fin = true; var m = { fps: null, audio: null, channels: null, size: null };
      if (frames.length > 6) { var d = []; for (var i = 1; i < frames.length; i++) if (frames[i] > frames[i - 1]) d.push(frames[i] - frames[i - 1]); d.sort(function (x, y) { return x - y; }); if (d.length) m.fps = nearFps(1 / d[Math.floor(d.length / 2)]); }
      if (typeof v.webkitAudioDecodedByteCount === 'number') m.audio = v.webkitAudioDecodedByteCount > 0;
      v.pause(); v.removeAttribute('src'); try { v.load(); } catch (e) {}
      a.meta = Object.assign({}, a.meta || {}, { fps: m.fps, audio: m.audio }); inspBusy = false; render(); inspectNext(); }
    v.muted = false; v.volume = 0; v.preload = 'auto';
    v.onerror = function () { end(); };
    v.onloadedmetadata = function () { v.play().then(function () { if (hadRVFC) { var cb = function (now, md) { frames.push(md.mediaTime); if (frames.length < 24 && !fin) v.requestVideoFrameCallback(cb); }; v.requestVideoFrameCallback(cb); } setTimeout(end, 1400); }).catch(function () { end(); }); };
    setTimeout(end, 5000); v.src = urlOf(a);
  }
  function scan() {                                            // offline + metadados; cada arquivo é verificado uma vez
    seq().assets.forEach(function (a) {
      if (!MC.fileBacked(a)) { a._off = false; return; }
      if (a._chk !== a.path) {
        a._chk = a.path;
        host.probe(a.path, a.kind === 'img' ? 'img' : a.kind, function (ok, dur, w, h) {
          var was = !!a._off; a._off = !ok;
          if (ok) { if (a.duration == null && dur && isFinite(dur)) a.duration = dur; if (!a.dims && w) a.dims = [w, h]; if (a.kind === 'video' && !a.meta) inspQ.push(a); inspectNext(); }
          if (was !== a._off) { host.refreshTimeline(); } render();
        });
      }
    });
  }

  // ---- relink / substituição
  function afterRelink(a, path, info) {
    host.checkpoint();
    var r = MC.relink(seq(), a, path, info); a.src = host.toUrl(path); a._off = false; a._chk = path;
    Object.keys(thumbs).forEach(function (k) { if (k.indexOf(a.id + '|') === 0) delete thumbs[k]; });
    if (a.kind === 'video') { a.meta = null; delete a.meta; inspQ.push(a); inspectNext(); }
    host.changed(); render(); return r;
  }
  function pickFile(a, replace) {
    host.api.openMedia().then(function (paths) {
      var p = paths && paths[0]; if (!p) return;
      var k = host.kindOf(p), kind = k ? (k.type === 'audio' ? 'audio' : (k.type === 'video' ? 'video' : 'img')) : null;
      if (kind !== a.kind) { host.say('Esse arquivo é ' + (MC.KINDS[kind] || 'de outro tipo') + ' e a mídia original é ' + MC.KINDS[a.kind] + '. Escolha um arquivo do mesmo tipo.'); return; }
      host.probe(p, kind, function (ok, dur, w, h) {
        if (!ok) { host.say('Não consegui abrir ' + MC.base(p) + '.'); return; }
        var r = afterRelink(a, p, { duration: dur && isFinite(dur) ? dur : null, dims: w ? [w, h] : null });
        host.say((replace ? 'Mídia substituída' : 'Mídia reconectada') + ': ' + MC.base(p) + '. ' + r.kept + ' clipe(s) mantido(s)' + (r.clipped ? ', ' + r.clipped + ' cortado(s) no fim porque o arquivo novo é mais curto.' : '.'));
      });
    });
  }
  function relinkFolder() {
    var off = seq().assets.filter(function (a) { return a._off; }); if (!off.length) { host.say('Nenhuma mídia offline.'); return; }
    host.api.libraryFolder().then(function (r) {
      if (!r || !r.files) return;
      var m = MC.matchRelink(off, r.files), left = m.hit.length, okN = 0;
      if (!m.hit.length) { host.say('Nenhum dos ' + off.length + ' arquivos offline foi encontrado nessa pasta.'); return; }
      m.hit.forEach(function (h) {
        host.probe(h.path, h.asset.kind === 'img' ? 'img' : h.asset.kind, function (ok, dur, w, hh) {
          if (ok) { afterRelink(h.asset, h.path, { duration: dur && isFinite(dur) ? dur : null, dims: w ? [w, hh] : null }); okN++; }
          if (--left === 0) host.say(okN + ' mídia(s) reconectada(s)' + (m.miss.length ? ', ' + m.miss.length + ' ainda offline.' : '.'));
        });
      });
    });
  }

  // ---- interface
  function mount(container, h) {
    host = h; box = container; box.textContent = '';
    var top = el('div', 'mb-top');
    ctl.q = el('input'); ctl.q.type = 'search'; ctl.q.placeholder = 'Buscar mídia'; ctl.q.setAttribute('aria-label', 'Buscar mídia'); ctl.q.value = Q.q;
    ctl.q.addEventListener('keydown', function (e) { e.stopPropagation(); }); ctl.q.addEventListener('input', function () { Q.q = ctl.q.value; render(); });
    ctl.kind = sel('Tipo', [['all', 'Todos os tipos']].concat(Object.keys(MC.KINDS).map(function (k) { return [k, MC.KINDS[k]]; })), 'kind');
    ctl.col = sel('Coleção', [], 'collection');
    ctl.sort = sel('Ordenar', Object.keys(MC.SORTS).map(function (k) { return [k, MC.SORTS[k]]; }), 'sort');
    ctl.dir = el('button', 'mb-b', Q.desc ? '↓' : '↑'); ctl.dir.type = 'button'; ctl.dir.title = 'Inverter a ordem'; ctl.dir.setAttribute('aria-label', 'Inverter a ordem'); ctl.dir.addEventListener('click', function () { Q.desc = !Q.desc; ctl.dir.textContent = Q.desc ? '↓' : '↑'; render(); });
    var r1 = el('div', 'mb-row'); r1.appendChild(ctl.q); top.appendChild(r1);
    var r2 = el('div', 'mb-row'); [ctl.kind, ctl.col, ctl.sort].forEach(function (x) { r2.appendChild(x); }); r2.appendChild(ctl.dir); top.appendChild(r2);
    var r3 = el('div', 'mb-row mb-chk');
    ctl.off = chk('Só offline', 'onlyOffline'); ctl.unused = chk('Só não usadas', 'onlyUnused'); r3.appendChild(ctl.off.l); r3.appendChild(ctl.unused.l);
    var imp = el('button', 'mb-b mb-primary', 'Importar'); imp.type = 'button'; imp.title = 'Importar mídia (ou arraste arquivos para a timeline)'; imp.addEventListener('click', function () { host.importDialog(); }); r3.appendChild(imp);
    ctl.rel = el('button', 'mb-b', 'Reconectar pasta…'); ctl.rel.type = 'button'; ctl.rel.title = 'Escolha a pasta onde os arquivos estão agora'; ctl.rel.addEventListener('click', relinkFolder); r3.appendChild(ctl.rel);
    top.appendChild(r3); box.appendChild(top);
    infoEl = el('p', 'tl-note mb-info'); box.appendChild(infoEl);
    listEl = el('div', 'mb-grid'); listEl.setAttribute('role', 'list'); box.appendChild(listEl);
    scan(); render();
  }
  function sel(label, opts, key) {
    var s = el('select'); s.setAttribute('aria-label', label); s.title = label;
    opts.forEach(function (o) { var x = el('option', null, o[1]); x.value = o[0]; s.appendChild(x); }); s.value = Q[key];
    s.addEventListener('change', function () { Q[key] = s.value; render(); }); return s;
  }
  function chk(label, key) { var l = el('label', 'mb-chk1'), i = el('input'); i.type = 'checkbox'; i.checked = !!Q[key]; i.addEventListener('change', function () { Q[key] = i.checked; render(); }); l.appendChild(i); l.appendChild(document.createTextNode(' ' + label)); return { l: l, i: i }; }

  function card(a, uses) {
    var c = el('div', 'mb-card' + (a._off ? ' off' : '')); c.setAttribute('role', 'listitem'); c.draggable = true; c.tabIndex = 0; c.dataset.id = a.id;
    c.title = a.name + (a.path ? '\n' + a.path : '');
    var th = el('div', 'mb-th'), cv = el('canvas'); cv.width = 160; cv.height = 90; th.appendChild(cv);
    var glyph = { audio: '♪', cam: '◉', fx: '✦', text: 'T' }[a.kind];
    if (glyph && !(a.kind === 'fx' || a.kind === 'text')) th.appendChild(el('span', 'mb-gl', glyph));
    if (a.kind === 'audio') { th.classList.add('aud'); }
    thumbOf(a, function (src) { var g = cv.getContext('2d'); g.fillStyle = '#0b0e13'; g.fillRect(0, 0, 160, 90); var h = 90, w = Math.min(160, Math.round(src.width * h / src.height)); g.drawImage(src, (160 - w) / 2, 0, w, h); });
    if (a._off) th.appendChild(el('span', 'mb-badge', 'OFFLINE'));
    c.appendChild(th);
    var nm = el('div', 'mb-nm', a.name); c.appendChild(nm);
    c.appendChild(el('div', 'mb-meta', MC.describe(a, uses[a.id] || 0)));
    if (a.collection) c.appendChild(el('div', 'mb-col', '▪ ' + a.collection));
    var row = el('div', 'mb-act');
    function ab(label, title, fn, dis) { var b = el('button', 'mb-b', label); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.disabled = !!dis; b.addEventListener('click', function (e) { e.stopPropagation(); fn(); }); row.appendChild(b); return b; }
    ab('＋', 'Colocar no playhead', function () { if (a._off) { host.say('A mídia está offline. Use Localizar para reconectar.'); return; } host.placeAsset(a); }, false).dataset.k = 'add';
    if (MC.fileBacked(a)) {
      if (a._off) ab('Localizar', 'Reconectar esta mídia a um arquivo', function () { pickFile(a, false); }).dataset.k = 'relink';
      else ab('Trocar', 'Substituir pelo arquivo de outra mídia mantendo os clipes', function () { pickFile(a, true); }).dataset.k = 'replace';
    }
    ab('▪', 'Definir a coleção', function () { var n = window.prompt ? window.prompt('Nome da coleção (vazio tira da coleção):', a.collection || '') : null; if (n == null) return; host.checkpoint(); MC.setCollection(a, n); host.changed(); render(); }).dataset.k = 'col';
    ab('✎', 'Renomear', function () { var n = window.prompt ? window.prompt('Novo nome:', a.name) : null; if (!n || !n.trim()) return; host.checkpoint(); a.name = n.trim().slice(0, 80); host.changed(); render(); }).dataset.k = 'ren';
    var used = !!uses[a.id];
    ab('🗑', used ? 'Em uso: remova os clipes antes' : 'Apagar da biblioteca (não apaga o arquivo)', function () { if (!MC.canDelete(seq(), a.id)) return; host.checkpoint(); MC.removeAsset(seq(), a.id); host.changed(); render(); }, used).dataset.k = 'del';
    c.appendChild(row);
    c.addEventListener('dragstart', function (e) { e.dataTransfer.setData('application/x-lenzi-asset', a.id); e.dataTransfer.effectAllowed = 'copy'; });
    c.addEventListener('dblclick', function () { if (!a._off) host.placeAsset(a); });
    c.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter' && !a._off) host.placeAsset(a); });
    return c;
  }
  function render() {
    if (!listEl || !host) return;
    var s = seq(), uses = MC.usage(s), all = s.assets.slice();
    // coleções
    var cols = MC.collections(all), cur = Q.collection;
    ctl.col.textContent = ''; [['all', 'Todas as coleções'], ['(none)', 'Sem coleção']].concat(cols.map(function (c) { return [c.name, c.name + ' (' + c.n + ')']; })).forEach(function (o) { var x = el('option', null, o[1]); x.value = o[0]; ctl.col.appendChild(x); });
    if (cur !== 'all' && cur !== '(none)' && !cols.some(function (c) { return c.name === cur; })) { Q.collection = 'all'; cur = 'all'; } ctl.col.value = cur;
    var nOff = all.filter(function (a) { return a._off; }).length; ctl.rel.style.display = nOff ? '' : 'none';
    var list = MC.sort(MC.filter(all, Q, uses), Q.sort, Q.desc, uses);
    infoEl.textContent = all.length ? (list.length + ' de ' + all.length + ' mídias' + (nOff ? ' · ' + nOff + ' offline' : '')) : 'Nenhuma mídia ainda. Clique em Importar, arraste arquivos para a timeline ou use a Galeria.';
    listEl.textContent = '';
    list.slice(0, 200).forEach(function (a) { listEl.appendChild(card(a, uses)); });
    lastSig = sig();
  }
  function sig() { var s = seq(); return s.assets.map(function (a) { return a.id + a.name + (a._off ? 1 : 0) + (a.collection || '') + a.path + (a.duration || '') + (a.meta ? 1 : 0); }).join('|') + '#' + JSON.stringify(MC.usage(s)) + Q.q + Q.kind + Q.collection + Q.sort + Q.desc + Q.onlyOffline + Q.onlyUnused; }
  function refresh() { if (!host || !listEl || !listEl.isConnected) return; scan(); if (sig() !== lastSig) render(); }

  var css = document.createElement('style');
  css.textContent = [
    '.mb-top{display:flex;flex-direction:column;gap:6px}.mb-row{display:flex;gap:6px;align-items:center}.mb-row>input[type=search],.mb-row>select{flex:1;min-width:0;font:inherit;font-size:12px;color:var(--fg);background:var(--panel-2);border:1px solid var(--line);border-radius:6px;padding:5px 7px}',
    '.mb-chk{flex-wrap:wrap}.mb-chk1{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:3px}',
    '.mb-b{font:inherit;font-size:12px;min-width:26px;height:26px;padding:0 7px;border:1px solid var(--line);background:var(--panel-2);color:var(--fg);border-radius:6px;cursor:pointer}.mb-b:hover:not(:disabled){border-color:var(--accent)}.mb-b:disabled{opacity:.4;cursor:not-allowed}.mb-primary{background:var(--accent);color:var(--accent-ink);border-color:transparent;font-weight:600}',
    '.mb-info{margin:6px 0}.mb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:420px;overflow:auto;padding-right:2px}',
    '.mb-card{display:flex;flex-direction:column;gap:3px;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--panel-2);min-width:0;cursor:grab}.mb-card:focus-visible{outline:2px solid var(--accent)}.mb-card.off{border-color:#c0392b}',
    '.mb-th{position:relative;border-radius:5px;overflow:hidden;background:#0b0e13;aspect-ratio:16/9}.mb-th canvas{width:100%;height:100%;display:block}.mb-gl{position:absolute;inset:0;display:grid;place-items:center;font-size:26px;color:var(--muted)}',
    '.mb-th.aud{background:repeating-linear-gradient(90deg,#16202b 0 3px,#0b0e13 3px 6px)}',
    '.mb-badge{position:absolute;left:4px;top:4px;font:700 10px/1 ui-monospace,monospace;letter-spacing:.06em;background:#c0392b;color:#fff;padding:3px 5px;border-radius:3px}',
    '.mb-nm{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mb-meta{font-size:11px;color:var(--muted);line-height:1.3}.mb-col{font-size:11px;color:var(--accent)}',
    '.mb-act{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}',
    '.tl-clip.off{background-image:repeating-linear-gradient(135deg,rgba(192,57,43,.55) 0 6px,rgba(0,0,0,.35) 6px 12px)!important;border-color:#c0392b!important}'
  ].join('\n');
  document.head.appendChild(css);

  window.MediaBrowser = { mount: mount, refresh: refresh, render: render, query: Q, _scan: scan, _thumbs: thumbs };
})();
