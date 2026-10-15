// Dados persistentes do LenziMap ficam em app.getPath('userData') (localStorage do Electron: autosave, favoritos, MIDI, preferências)
// e nos arquivos .mapa e mídias que o usuário escolhe. Nada disso fica dentro do .app, então atualizar o app não apaga nada.
// Este módulo guarda a versão dos dados e faz cópia de segurança ANTES de qualquer migração ou instalação de atualização.
'use strict';
const fs = require('fs');
const path = require('path');

const KEEP = 3;                                   // cópias mantidas
const ITEMS = ['Local Storage', 'IndexedDB', 'Preferences', 'Session Storage'];

// Migrações versionadas: { to: 'X.Y.Z', run(userData) }. Hoje não há nenhuma (os dados são compatíveis desde 1.0.0).
const MIGRATIONS = [];

function backupData(userData, label) {
  const root = path.join(userData, 'backups');
  const dir = path.join(root, 'pre-' + label + '-' + new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  for (const it of ITEMS) {
    const src = path.join(userData, it);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, path.join(dir, it), { recursive: true });
    n++;
  }
  // mantém só as últimas cópias
  const all = fs.readdirSync(root).filter((x) => x.startsWith('pre-')).sort();
  while (all.length > KEEP) fs.rmSync(path.join(root, all.shift()), { recursive: true, force: true });
  return { dir, items: n };
}

function runMigrations(userData, current, log) {
  log = log || function () {};
  const f = path.join(userData, 'lenzimap-data-version.json');
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(f, 'utf8')).appVersion || null; } catch (e) {}
  const pending = MIGRATIONS.filter((m) => !prev || prev !== current);
  if (prev && prev !== current) {
    try { log('cópia de segurança antes de ' + prev + ' -> ' + current + ': ' + JSON.stringify(backupData(userData, prev + '-to-' + current))); } catch (e) { log('backup falhou: ' + e.message); if (pending.length) throw e; }
  }
  for (const m of pending) { log('migração ' + m.to); m.run(userData); }
  try { fs.mkdirSync(userData, { recursive: true }); fs.writeFileSync(f, JSON.stringify({ appVersion: current, at: new Date().toISOString() })); } catch (e) {}
  return { from: prev, to: current };
}

module.exports = { backupData, runMigrations, MIGRATIONS };
