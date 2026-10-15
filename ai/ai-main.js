// Processo principal: guarda chaves de API com o cofre do sistema (Keychain no Mac) e faz as chamadas aos provedores.
// A chave nunca vai para a janela de controle, para arquivos .mapa, para logs ou para o pacote.
const { ipcMain, safeStorage, app } = require('electron');
const fs = require('fs');
const path = require('path');
const Provider = require('./ai-provider.js');

let session = {};           // chaves só desta sessão (quando o cofre do sistema não está disponível)
const running = new Map();  // id -> AbortController
function file() { return path.join(app.getPath('userData'), 'ai-keys.json'); }
function readStore() { try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch (e) { return {}; } }
function secure() { try { return !!safeStorage.isEncryptionAvailable(); } catch (e) { return false; } }
function getKey(p) {
  if (session[p]) return session[p];
  const b = readStore()[p];
  if (!b || !secure()) return null;
  try { return safeStorage.decryptString(Buffer.from(b, 'base64')); } catch (e) { return null; }
}
function status() {
  const st = readStore(), out = {};
  Object.keys(Provider.PROVIDERS).forEach((p) => { out[p] = !!(session[p] || st[p]); });
  return { secure: secure(), keys: out };
}
function baseUrl() { return (!app.isPackaged && process.env.LENZIMAP_AI_URL) ? process.env.LENZIMAP_AI_URL : null; }

function init() {
  ipcMain.handle('ai:status', () => status());
  ipcMain.handle('ai:set-key', (e, p, key) => {
    if (!Provider.PROVIDERS[p]) return { ok: false, error: 'Provedor desconhecido.' };
    key = String(key || '').trim();
    if (key.length < 8 || key.length > 400 || /\s/.test(key)) return { ok: false, error: 'Essa chave não parece válida.' };
    if (secure()) {
      const st = readStore(); st[p] = safeStorage.encryptString(key).toString('base64');
      try { fs.writeFileSync(file(), JSON.stringify(st), { mode: 0o600 }); delete session[p]; return { ok: true, secure: true }; } catch (err) { return { ok: false, error: 'Não consegui gravar a chave com segurança.' }; }
    }
    session[p] = key; // sem cofre: só na memória, some ao fechar o app
    return { ok: true, secure: false };
  });
  ipcMain.handle('ai:clear-key', (e, p) => {
    delete session[p]; const st = readStore(); delete st[p];
    try { fs.writeFileSync(file(), JSON.stringify(st), { mode: 0o600 }); } catch (err) {}
    return status();
  });
  ipcMain.handle('ai:request', async (e, id, o) => {
    o = o || {};
    if (!Provider.PROVIDERS[o.provider]) return { ok: false, code: 'bad-request', error: 'Provedor desconhecido.' };
    const key = getKey(o.provider);
    const ctl = new AbortController(); running.set(id, ctl);
    try {
      return await Provider.call({ provider: o.provider, model: o.model, key, system: o.system, prompt: o.prompt, image: o.image, maxTokens: o.maxTokens, signal: ctl.signal, baseUrl: baseUrl(), timeoutMs: o.timeoutMs && o.timeoutMs < 120000 ? o.timeoutMs : undefined });
    } finally { running.delete(id); }
  });
  ipcMain.handle('ai:cancel', (e, id) => { const c = running.get(id); if (c) c.abort(); return !!c; });
}
module.exports = { init, status, _getKey: getKey };
