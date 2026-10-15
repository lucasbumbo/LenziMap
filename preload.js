const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  displays: () => ipcRenderer.invoke('displays'),
  openOutput: (id) => ipcRenderer.invoke('open-output', id),
  closeOutput: () => ipcRenderer.invoke('close-output'),
  sendState: (s) => ipcRenderer.send('state', s),
  askMedia: (kind) => ipcRenderer.invoke('ask-media', kind),
  sendLevel: (v) => ipcRenderer.send('level', v),
  sendTransport: (tr) => ipcRenderer.send('transport', tr),
  onTransport: (cb) => ipcRenderer.on('transport', (e, tr) => cb(tr)),
  onLevel: (cb) => ipcRenderer.on('level', (e, v) => cb(v)),
  openMedia: () => ipcRenderer.invoke('open-media'),
  saveProject: (json) => ipcRenderer.invoke('save-project', json),
  saveRecording: (buf, ext) => ipcRenderer.invoke('save-recording', buf, ext),
  openProject: () => ipcRenderer.invoke('open-project'),
  readBytes: (p) => ipcRenderer.invoke('read-bytes', p),
  readImage: (p) => ipcRenderer.invoke('read-image', p),
  libraryApp: () => ipcRenderer.invoke('library-app'),
  libraryFolder: (dir) => ipcRenderer.invoke('library-folder', dir),
  pathFor: (file) => webUtils.getPathForFile(file),
  outputReady: () => ipcRenderer.send('output-ready'),
  onState: (cb) => ipcRenderer.on('state', (e, s) => cb(s)),
  onOutputClosed: (cb) => ipcRenderer.on('output-closed', () => cb()),
  onResend: (cb) => ipcRenderer.on('resend', () => cb()),
  setShowMode: (on) => ipcRenderer.send('show-mode', !!on),
  ai: {
    status: () => ipcRenderer.invoke('ai:status'),
    setKey: (p, k) => ipcRenderer.invoke('ai:set-key', p, k),
    clearKey: (p) => ipcRenderer.invoke('ai:clear-key', p),
    request: (id, o) => ipcRenderer.invoke('ai:request', id, o),
    cancel: (id) => ipcRenderer.invoke('ai:cancel', id)
  },
  updater: {
    state: () => ipcRenderer.invoke('updater:state'),
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    later: () => ipcRenderer.invoke('updater:later'),
    onState: (cb) => ipcRenderer.on('updater:state', (e, s) => cb(s))
  }
});
