// Atualização automática do LenziMap (macOS/Electron) via electron-updater + GitHub Releases.
// Módulo independente: main.js só chama init() e usa menuItems(). Nada aqui toca no renderizador de projeção.
'use strict';
const { app, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const core = require('./updater-core');
const data = require('./migrate-data');

const PLACEHOLDER = 'SEU_USUARIO_GITHUB';       // trocar em package.json > build.publish.owner (ver LENZIMAP_AUTO_UPDATE_IMPLEMENTATION.md)
const DAY6 = 6 * 3600 * 1000;

let api = null, logFile = null;

function log(msg) {
  const line = new Date().toISOString() + ' ' + msg + '\n';
  try { if (!logFile) { const d = path.join(app.getPath('userData'), 'logs'); fs.mkdirSync(d, { recursive: true }); logFile = path.join(d, 'updater.log'); } fs.appendFileSync(logFile, line); } catch (e) {}
}

function publishInfo() {
  // App empacotado: o electron-builder grava a configuração real em resources/app-update.yml.
  try {
    const f = path.join(process.resourcesPath || '', 'app-update.yml');
    if (app.isPackaged && fs.existsSync(f)) {
      const t = fs.readFileSync(f, 'utf8'), get = (k) => { const m = new RegExp('^' + k + ':\\s*(.+)$', 'm').exec(t); return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : ''; };
      return { provider: get('provider'), owner: get('owner'), repo: get('repo'), url: get('url') };
    }
  } catch (e) { log('app-update.yml: ' + e.message); }
  try {
    const pkg = require('./package.json');
    const p = pkg.build && pkg.build.publish;
    return (Array.isArray(p) ? p[0] : p) || null;
  } catch (e) { return null; }
}

// Código assinado pela Apple? Sem Developer ID o macOS recusa instalar a atualização sozinho: nesse caso o modo é "notify".
function detectMode() {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') return resolve('auto');
    if (!app.isPackaged && process.env.LENZIMAP_UPDATE_MODE) return resolve(process.env.LENZIMAP_UPDATE_MODE === 'notify' ? 'notify' : 'auto');
    const bundle = path.resolve(process.execPath, '..', '..', '..');
    execFile('codesign', ['-dv', '--verbose=4', bundle], { timeout: 8000 }, (err, so, se) => {
      const out = String(se || '') + String(so || '');
      resolve(!err && /Authority=Developer ID Application/.test(out) && !/Signature=adhoc/.test(out) ? 'auto' : 'notify');
    });
  });
}

function init(o) {
  // o: { getControl(): BrowserWindow|null, isProjecting(): boolean }
  const send = (s) => { const w = o.getControl && o.getControl(); if (w && !w.isDestroyed()) w.webContents.send('updater:state', s); };
  const version = app.getVersion();
  const testUrl = !app.isPackaged ? process.env.LENZIMAP_UPDATE_URL : '';
  const pub = publishInfo();
  const pubOk = !!pub && (pub.provider === 'github' ? !!pub.owner && pub.owner !== PLACEHOLDER && !!pub.repo : pub.provider === 'generic' ? /^https?:\/\//.test(pub.url || '') : false);
  const configured = !!testUrl || (app.isPackaged && pubOk);

  // Cópia de segurança dos dados + migração versionada (hoje sem migrações). Nunca impede o app de abrir.
  try { data.runMigrations(app.getPath('userData'), version, log); } catch (e) { log('migração falhou: ' + e.message); }

  let au = null;
  if (configured) {
    try {
      au = require('electron-updater').autoUpdater;
      au.autoDownload = false;                 // baixa só depois do "Update Now"
      au.autoInstallOnAppQuit = false;         // nunca instala sozinho ao fechar
      au.autoRunAppAfterInstall = true;
      au.allowDowngrade = false;
      au.allowPrerelease = false;
      au.logger = { info: log, warn: log, error: log, debug: () => {} };
      if (testUrl) { au.forceDevUpdateConfig = true; au.setFeedURL({ provider: 'generic', url: testUrl }); }
    } catch (e) { log('electron-updater indisponível: ' + e.message); au = null; }
  }
  if (!au) { // sem atualizador real: estado "não configurado", app segue normal
    const EE = require('events'); au = new EE(); au.checkForUpdates = () => Promise.resolve(null); au.downloadUpdate = () => Promise.resolve(); au.quitAndInstall = () => {};
  }
  const ok = configured && !!au.setFeedURL;

  const releaseUrl = (v) => pub && pub.provider === 'github' && pub.owner && pub.repo ? 'https://github.com/' + pub.owner + '/' + pub.repo + '/releases/tag/v' + v : '';
  const up = core.create({
    au, version, configured: ok, mode: 'auto', log,
    isProjecting: o.isProjecting, emit: send, releaseUrl,
    openRelease: (u) => { if (/^https:\/\/github\.com\//.test(u || '')) shell.openExternal(u); },
    prepareInstall: (v) => { const r = data.backupData(app.getPath('userData'), 'update-' + version + '-to-' + v); log('backup antes de instalar: ' + JSON.stringify(r)); }
  });
  api = up;

  ipcMain.handle('updater:state', () => up.state());
  ipcMain.handle('updater:check', () => up.check({ manual: true }));
  ipcMain.handle('updater:download', () => up.download());
  ipcMain.handle('updater:install', () => up.install());
  ipcMain.handle('updater:later', () => up.later());

  // Verificação automática, sempre assíncrona e sem travar a abertura (offline ou GitHub fora do ar = silêncio).
  if (ok) {
    detectMode().then((m) => { log('modo: ' + m); up.setMode(m); }).catch(() => {});
    setTimeout(() => up.check({ manual: false }), 15000);
    setInterval(() => up.check({ manual: false }), DAY6);
  }
  return up;
}

// Itens de menu: Help > Check for Updates
function menuItems() {
  return [{ label: 'Check for Updates...', click: () => { if (api) api.check({ manual: true }); } }];
}
function projectionChanged() { if (api) api.projectionChanged(); }

module.exports = { init, menuItems, projectionChanged, _core: core };
