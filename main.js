const { app, BrowserWindow, screen, ipcMain, dialog, session, desktopCapturer, systemPreferences, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const updater = require('./updater');
const aiMain = require('./ai/ai-main.js');

let control = null;
let output = null;
let showMode = false;
ipcMain.on('show-mode', (e, on) => { showMode = !!on; try { updater.projectionChanged(); } catch (err) {} });

function createControl() {
  control = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0e1116',
    title: 'LenziMap',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  control.loadFile('control.html');
  control.on('closed', () => {
    control = null;
    if (output) output.close();
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const check = () => updater.menuItems();
  const tpl = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: 'about' }, ...check(), { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: 'File', submenu: [isMac ? { role: 'close' } : { role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }])] },
    { role: 'help', submenu: [...check()] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

function closeOutput() {
  if (output) {
    const o = output;
    output = null;
    if (!o.isDestroyed()) o.close();
  }
}

app.whenReady().then(() => {
  // Microfone (reação ao som): libera só a captura de mídia
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(permission === 'media' || permission === 'midi'));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => permission === 'media' || permission === 'midi');
  // Gravação: o pedido de captura de tela já vem respondido com a janela de saída
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['window', 'screen'] }).then((sources) => {
      const win = output && !output.isDestroyed() ? output : control;
      const id = win && !win.isDestroyed() ? win.getMediaSourceId() : '';
      const src = sources.find((x) => x.id === id) || sources[0];
      callback(src ? { video: src } : {});
    }).catch(() => callback({}));
  });
  buildMenu();
  createControl();
  // Atualizações: assíncrono, nunca bloqueia a abertura e nunca age com a saída de projeção aberta.
  try { aiMain.init(); } catch (e) { console.error('ai', e); }
  try { updater.init({ getControl: () => control, isProjecting: () => showMode || !!(output && !output.isDestroyed()) }); } catch (e) { console.error('updater', e); }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createControl();
  });
});

app.on('window-all-closed', () => app.quit());

ipcMain.handle('displays', () => {
  const primary = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    label: d.label || '',
    bounds: d.bounds,
    primary: d.id === primary
  }));
});

ipcMain.handle('open-output', (e, id) => {
  const d = screen.getAllDisplays().find((x) => x.id === id);
  if (!d) return false;
  closeOutput();
  const win = new BrowserWindow({
    x: d.bounds.x,
    y: d.bounds.y,
    width: d.bounds.width,
    height: d.bounds.height,
    frame: false,
    show: false,
    backgroundColor: '#000000',
    title: 'Saída',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  output = win;
  updater.projectionChanged();
  win.loadFile('output.html');
  win.once('ready-to-show', () => {
    win.show();
    if (process.platform === 'darwin') win.setSimpleFullScreen(true);
    else win.setFullScreen(true);
  });
  win.webContents.on('before-input-event', (ev, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      ev.preventDefault();
      closeOutput();
    }
  });
  win.on('closed', () => {
    if (output === win) output = null;
    updater.projectionChanged();
    if (control && !control.isDestroyed()) control.webContents.send('output-closed');
  });
  return true;
});

ipcMain.handle('close-output', () => {
  closeOutput();
  return true;
});

ipcMain.on('state', (e, s) => {
  if (output && !output.isDestroyed()) output.webContents.send('state', s);
});

ipcMain.handle('ask-media', async (e, kind) => {
  if (process.platform !== 'darwin') return true;
  const type = kind === 'camera' ? 'camera' : 'microphone';
  try {
    const st = systemPreferences.getMediaAccessStatus(type);
    if (st === 'granted') return true;
    if (st === 'not-determined') return await systemPreferences.askForMediaAccess(type);
    return false;
  } catch (err) { return true; }
});

// Transporte da timeline (play, pause, seek, velocidade, loop): mensagem pequena e frequente, separada do estado.
ipcMain.on('transport', (e, tr) => {
  if (output && !output.isDestroyed()) output.webContents.send('transport', tr);
});

ipcMain.on('level', (e, v) => {
  if (output && !output.isDestroyed()) output.webContents.send('level', v);
});

ipcMain.on('output-ready', () => {
  if (control && !control.isDestroyed()) control.webContents.send('resend');
});

ipcMain.handle('open-media', async () => {
  const r = await dialog.showOpenDialog(control, {
    title: 'Adicionar mídia',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Mídia', extensions: ['gif', 'mp4', 'm4v', 'mov', 'webm', 'png', 'jpg', 'jpeg', 'webp', 'apng', 'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'aif', 'aiff'] }
    ]
  });
  return r.canceled ? [] : r.filePaths;
});

const MEDIA_EXT = new Set(['gif', 'mp4', 'm4v', 'mov', 'webm', 'png', 'jpg', 'jpeg', 'webp', 'apng','heic','heif']);
function scanDir(dir, depth, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    if (out.length >= 500) return;
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (depth > 0) scanDir(p, depth - 1, out); }
    else if (MEDIA_EXT.has(path.extname(e.name).slice(1).toLowerCase())) out.push(p);
  }
}
ipcMain.handle('library-app', () => {
  const out = [];
  // No app empacotado, os clipes ficam fora do .asar para o vídeo poder tocar
  scanDir(path.join(__dirname, 'biblioteca').replace('app.asar', 'app.asar.unpacked'), 2, out);
  return out.sort();
});
ipcMain.handle('library-folder', async (e, dir) => {
  if (!dir) {
    const r = await dialog.showOpenDialog(control, { title: 'Escolher pasta de mídias', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths.length) return null;
    dir = r.filePaths[0];
  }
  const out = [];
  scanDir(dir, 3, out);
  return { dir, files: out.sort() };
});

// Waveform: lê os bytes de um arquivo de áudio ou vídeo escolhido pelo usuário (só extensões de mídia, até 300 MB)
const BYTES_EXT = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'aif', 'aiff', 'caf', 'mp4', 'm4v', 'mov', 'webm']);
ipcMain.handle('read-bytes', async (e, p) => {
  try {
    if (typeof p !== 'string' || !BYTES_EXT.has(path.extname(p).slice(1).toLowerCase())) return null;
    const st = fs.statSync(p);
    if (!st.isFile() || st.size > 300 * 1024 * 1024) return null;
    return fs.readFileSync(p);
  } catch (err) { return null; }
});

// 3D Illusion Creator: lê os bytes de uma imagem ou GIF escolhido pelo usuário pra usar como textura (só extensões de imagem, até 60 MB)
const IMG_EXT = new Set(['gif', 'png', 'jpg', 'jpeg', 'webp', 'apng', 'bmp']);
ipcMain.handle('read-image', async (e, p) => {
  try {
    if (typeof p !== 'string' || !IMG_EXT.has(path.extname(p).slice(1).toLowerCase())) return null;
    const st = fs.statSync(p);
    if (!st.isFile() || st.size > 60 * 1024 * 1024) return null;
    return fs.readFileSync(p);
  } catch (err) { return null; }
});
ipcMain.handle('save-project', async (e, json) => {
  const r = await dialog.showSaveDialog(control, {
    title: 'Salvar projeto',
    defaultPath: 'projeto.mapa',
    filters: [{ name: 'Projeto do LenziMap', extensions: ['mapa'] }]
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, json, 'utf8');
  return r.filePath;
});

ipcMain.handle('save-recording', async (e, buf, ext) => {
  const r = await dialog.showSaveDialog(control, {
    title: 'Salvar gravação',
    defaultPath: 'gravacao-lenzimap.' + (ext === 'mp4' ? 'mp4' : 'webm'),
    filters: [{ name: 'Vídeo', extensions: [ext === 'mp4' ? 'mp4' : 'webm'] }]
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, Buffer.from(buf));
  return r.filePath;
});

ipcMain.handle('open-project', async () => {
  const r = await dialog.showOpenDialog(control, {
    title: 'Abrir projeto',
    properties: ['openFile'],
    filters: [{ name: 'Projeto do LenziMap', extensions: ['mapa'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  return fs.readFileSync(r.filePaths[0], 'utf8');
});
