// Núcleo do atualizador: máquina de estados pura (sem Electron), testável com um autoUpdater falso.
// Regras de segurança e de projeção ficam aqui. A ligação com o Electron fica em updater.js.
'use strict';

var MSG = {
  available: function (v) { return 'LenziMap ' + v + ' is available.'; },
  downloading: 'Downloading update...',
  ready: 'Update ready to install.',
  none: "You're running the latest version of LenziMap.",
  error: 'Unable to check for updates. Please try again later.',
  unconfigured: 'Updates are not configured yet.',
  projecting: 'Close the output window before installing the update.'
};

// Versão semântica simples: X.Y.Z[-pre]. Retorna -1, 0, 1 ou null se inválida.
function parse(v) {
  var m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(v || '').trim());
  if (!m) return null;
  return { n: [+m[1], +m[2], +m[3]], pre: m[4] || '' };
}
function cmp(a, b) {
  var x = parse(a), y = parse(b);
  if (!x || !y) return null;
  for (var i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] > y.n[i] ? 1 : -1;
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;           // 1.0.0 > 1.0.0-beta
  if (!y.pre) return -1;
  return x.pre > y.pre ? 1 : -1;
}

// opts: au (autoUpdater), version, isProjecting(), emit(state), log(msg), mode ('auto' | 'notify'),
//       openRelease(url), prepareInstall() (cópia de segurança), configured (bool), allowPrerelease
function create(opts) {
  var au = opts.au, log = opts.log || function () {};
  var st = { status: 'idle', version: null, percent: 0, message: '', manual: false, projecting: false, mode: opts.mode || 'auto', releaseUrl: '', current: opts.version, canInstall: true };
  var busy = false, pendingAuto = false, lastAuto = 0, minGap = opts.minGapMs != null ? opts.minGapMs : 4 * 3600 * 1000;

  function projecting() { try { return !!opts.isProjecting(); } catch (e) { return false; } }
  function publish() { st.projecting = projecting(); st.canInstall = !st.projecting; try { opts.emit(snapshot()); } catch (e) {} }
  function snapshot() { return JSON.parse(JSON.stringify(st)); }
  function set(patch) { if (patch.status && patch.status !== st.status && patch.hidden === undefined) st.hidden = false; for (var k in patch) st[k] = patch[k]; publish(); }
  function fail(err, manual) {
    log('erro: ' + (err && err.message || err));
    busy = false;
    // Falha silenciosa quando foi uma verificação automática: nada de aviso no meio do trabalho.
    if (manual || st.status === 'downloading') set({ status: 'error', message: MSG.error, percent: 0 });
    else set({ status: 'idle', message: '' });
  }

  function bind() {
    au.on('error', function (err) { fail(err, st.manual); });
    au.on('update-not-available', function () {
      busy = false;
      set({ status: st.manual ? 'none' : 'idle', message: st.manual ? MSG.none : '' });
    });
    au.on('update-available', function (info) {
      var v = info && info.version;
      var c = cmp(v, st.current);
      // Proteção: só aceita versão válida, estritamente mais nova, e pré-lançamento apenas se já estiver em um.
      if (c === null || c <= 0) { log('versão recusada: ' + v); busy = false; set({ status: st.manual ? 'none' : 'idle', message: st.manual ? MSG.none : '' }); return; }
      var pv = parse(v);
      if (pv.pre && !opts.allowPrerelease && !parse(st.current).pre) { log('pré-lançamento recusado: ' + v); busy = false; set({ status: st.manual ? 'none' : 'idle', message: st.manual ? MSG.none : '' }); return; }
      busy = false;
      set({ status: 'available', version: v, message: MSG.available(v), percent: 0, releaseUrl: typeof opts.releaseUrl === 'function' ? opts.releaseUrl(v) : (opts.releaseUrl || '') });
    });
    au.on('download-progress', function (p) {
      set({ status: 'downloading', message: MSG.downloading, percent: Math.max(0, Math.min(100, Math.round((p && p.percent) || 0))) });
    });
    au.on('update-downloaded', function (info) {
      busy = false;
      set({ status: 'ready', version: (info && info.version) || st.version, message: MSG.ready, percent: 100 });
    });
  }
  bind();

  function check(o) {
    o = o || {};
    if (!opts.configured) { if (o.manual) set({ status: 'error', message: MSG.unconfigured, manual: true }); return Promise.resolve(false); }
    if (o.manual) st.hidden = false;
    if (busy || st.status === 'downloading' || st.status === 'ready') { if (o.manual) publish(); return Promise.resolve(false); }
    if (!o.manual) {
      if (projecting()) { pendingAuto = true; log('verificação adiada: projeção em andamento'); return Promise.resolve(false); }
      if (Date.now() - lastAuto < minGap) return Promise.resolve(false);
      lastAuto = Date.now();
    }
    busy = true; pendingAuto = false;
    set({ status: 'checking', manual: !!o.manual, message: '', percent: 0 });
    return Promise.resolve().then(function () { return au.checkForUpdates(); }).then(function () { return true; }, function (e) { fail(e, !!o.manual); return false; });
  }

  function download() {
    if (st.status !== 'available') return Promise.resolve(false);
    if (st.mode === 'notify') {
      try { opts.openRelease && opts.openRelease(st.releaseUrl); } catch (e) {}
      set({ status: 'idle', message: '' });
      return Promise.resolve(true);
    }
    if (projecting()) { log('download recusado durante projeção'); return Promise.resolve(false); }
    busy = true;
    set({ status: 'downloading', message: MSG.downloading, percent: 0 });
    return Promise.resolve().then(function () { return au.downloadUpdate(); }).then(function () { return true; }, function (e) { fail(e, true); return false; });
  }

  function install() {
    if (st.status !== 'ready') return { ok: false, reason: 'not-ready' };
    if (projecting()) { set({ message: MSG.projecting }); return { ok: false, reason: 'projecting' }; }
    try { opts.prepareInstall && opts.prepareInstall(st.version); } catch (e) { log('backup falhou: ' + e.message); return { ok: false, reason: 'backup-failed' }; }
    au.quitAndInstall(false, true);
    return { ok: true };
  }

  // "Later" / "Install Later": esconde o aviso, mas a atualização continua baixada e pode ser instalada pelo menu depois.
  function later() { if (st.status === 'none' || st.status === 'error') set({ status: 'idle', message: '', hidden: false }); else set({ hidden: true }); return true; }

  // A saída foi fechada: libera a verificação que tinha sido adiada.
  function projectionChanged() { publish(); if (!projecting() && pendingAuto) setTimeout(function () { check({ manual: false }); }, opts.afterProjectionMs != null ? opts.afterProjectionMs : 10000); }

  function setMode(m) { st.mode = m === 'notify' ? 'notify' : 'auto'; publish(); }

  return { setMode: setMode, check: check, download: download, install: install, later: later, state: snapshot, projectionChanged: projectionChanged, MSG: MSG };
}

module.exports = { create: create, cmp: cmp, parse: parse, MSG: MSG };
