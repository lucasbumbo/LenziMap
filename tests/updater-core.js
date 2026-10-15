// Testes do núcleo do atualizador com um autoUpdater falso (sem rede, sem Electron).
const EE = require('events');
const C = require('../updater-core.js');
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
function mk(over) {
  const au = new EE(); au.calls = [];
  au.checkForUpdates = () => { au.calls.push('check'); return au.onCheck ? au.onCheck() : Promise.resolve(null); };
  au.downloadUpdate = () => { au.calls.push('download'); return au.onDownload ? au.onDownload() : Promise.resolve([]); };
  au.quitAndInstall = (a, b) => au.calls.push('install:' + a + ',' + b);
  const st = { proj: false, states: [], backup: [], opened: [] };
  const u = C.create(Object.assign({ au, version: '1.0.0', configured: true, minGapMs: 0, afterProjectionMs: 5,
    isProjecting: () => st.proj, emit: (s) => st.states.push(s), log: () => {}, releaseUrl: (v) => 'https://github.com/x/y/releases/tag/v' + v,
    prepareInstall: (v) => st.backup.push(v), openRelease: (u) => st.opened.push(u) }, over || {}));
  return { au, u, st };
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 5));
(async () => {
  assert(C.cmp('1.2.0', '1.0.0') === 1 && C.cmp('1.0.0', '1.0.0') === 0 && C.cmp('1.0.0', '1.0.1') === -1 && C.cmp('1.0.0', '1.0.0-beta') === 1 && C.cmp('abc', '1.0.0') === null, 'comparação semver');
  // 1. sem atualização (manual mostra mensagem; automática fica em silêncio)
  let t = mk(); t.au.onCheck = () => { t.au.emit('update-not-available', {}); return Promise.resolve(); };
  await t.u.check({ manual: true }); assert(t.u.state().status === 'none' && t.u.state().message === "You're running the latest version of LenziMap.", '1. sem atualização: mensagem exata');
  t = mk(); t.au.onCheck = () => { t.au.emit('update-not-available', {}); return Promise.resolve(); };
  await t.u.check({ manual: false }); assert(t.u.state().status === 'idle' && !t.u.state().message, '1b. verificação automática sem novidade fica em silêncio');
  // 2. nova versão
  t = mk(); t.au.onCheck = () => { t.au.emit('update-available', { version: '1.2.0' }); return Promise.resolve(); };
  await t.u.check({ manual: false }); let s = t.u.state();
  assert(s.status === 'available' && s.message === 'LenziMap 1.2.0 is available.' && s.version === '1.2.0', '2. aviso "LenziMap 1.2.0 is available."');
  // 3. download com progresso
  t.au.onDownload = () => { [10, 55, 100].forEach((p) => t.au.emit('download-progress', { percent: p })); t.au.emit('update-downloaded', { version: '1.2.0' }); return Promise.resolve(); };
  await t.u.download(); const pcts = t.st.states.filter((x) => x.status === 'downloading').map((x) => x.percent);
  assert(pcts.join() === '0,10,55,100' && pcts.length === 4, '3. progresso emitido: ' + pcts);
  assert(t.u.state().status === 'ready' && t.u.state().message === 'Update ready to install.', '3b. "Update ready to install."');
  assert(t.st.states.some((x) => x.status === 'downloading' && x.message === 'Downloading update...'), '3c. "Downloading update..."');
  // 5. adiar: continua baixado, só esconde o cartão
  t.u.later(); assert(t.u.state().hidden === true && t.u.state().status === 'ready', '5. Install Later esconde sem perder o download');
  assert(t.au.calls.filter((c) => c.startsWith('install')).length === 0, '5b. nada instalou sozinho');
  // 12. projeção em andamento: instalar é recusado
  t.st.proj = true; let r = t.u.install(); assert(!r.ok && r.reason === 'projecting' && t.au.calls.filter((c) => c.startsWith('install')).length === 0 && t.st.backup.length === 0, '12. instalação recusada com a saída aberta');
  assert(t.u.state().canInstall === false && t.u.state().projecting === true, '12b. estado informa projeção (UI esconde o cartão)');
  t.st.proj = false; r = t.u.install();
  assert(r.ok && t.au.calls.filter((c) => c.startsWith('install')).join() === 'install:false,true' && t.st.backup.join() === '1.2.0', '4. instala só após confirmação, com backup antes e reabrindo o app');
  // 12c. verificação automática adiada durante projeção
  t = mk(); t.st.proj = true; t.au.onCheck = () => { t.au.emit('update-available', { version: '1.1.0' }); return Promise.resolve(); };
  await t.u.check({ manual: false }); assert(t.au.calls.length === 0 && t.u.state().status === 'idle', '12c. sem rede nem aviso durante projeção');
  t.st.proj = false; t.u.projectionChanged(); await tick(40); assert(t.au.calls.length === 1 && t.u.state().status === 'available', '12d. verificação adiada roda depois que a saída fecha');
  t = mk(); t.au.onCheck = () => { t.au.emit('update-available', { version: '1.1.0' }); return Promise.resolve(); }; await t.u.check({ manual: true }); t.st.proj = true;
  assert((await t.u.download()) === false && !t.au.calls.includes('download'), '12e. download recusado durante projeção');
  // 6/11. sem conexão
  t = mk(); t.au.onCheck = () => Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED'));
  await t.u.check({ manual: true }); assert(t.u.state().status === 'error' && t.u.state().message === 'Unable to check for updates. Please try again later.', '6. falha de conexão (manual): mensagem exata');
  t = mk(); t.au.onCheck = () => Promise.reject(new Error('offline'));
  await t.u.check({ manual: false }); assert(t.u.state().status === 'idle' && t.st.states.every((x) => x.status !== 'error'), '11. offline automático: silêncio, app normal');
  // 7. download interrompido, depois tenta de novo
  t = mk(); t.au.onCheck = () => { t.au.emit('update-available', { version: '1.1.0' }); return Promise.resolve(); }; await t.u.check({ manual: true });
  t.au.onDownload = () => { t.au.emit('download-progress', { percent: 40 }); return Promise.reject(new Error('ECONNRESET')); };
  await t.u.download(); assert(t.u.state().status === 'error' && t.u.state().percent === 0, '7. download interrompido vira erro com mensagem');
  t.au.onCheck = () => { t.au.emit('update-available', { version: '1.1.0' }); return Promise.resolve(); }; await t.u.check({ manual: true });
  t.au.onDownload = () => { t.au.emit('update-downloaded', { version: '1.1.0' }); return Promise.resolve(); }; await t.u.download();
  assert(t.u.state().status === 'ready', '7b. recupera na tentativa seguinte');
  // 8. arquivo inválido (checksum)
  t = mk(); t.au.onCheck = () => { t.au.emit('update-available', { version: '1.1.0' }); return Promise.resolve(); }; await t.u.check({ manual: true });
  t.au.onDownload = () => { t.au.emit('error', new Error('sha512 checksum mismatch')); return Promise.reject(new Error('sha512 checksum mismatch')); };
  await t.u.download(); assert(t.u.state().status === 'error' && t.u.install().reason === 'not-ready' && !t.au.calls.some((c) => c.startsWith('install')), '8. checksum inválido: nunca fica "pronto" nem instala');
  // proteção contra versões não autorizadas
  for (const [v, why] of [['1.0.0', 'igual'], ['0.9.0', 'downgrade'], ['2.0.0-beta.1', 'pré-lançamento'], ['lixo', 'inválida'], [undefined, 'ausente']]) {
    t = mk(); t.au.onCheck = () => { t.au.emit('update-available', { version: v }); return Promise.resolve(); }; await t.u.check({ manual: true });
    assert(t.u.state().status === 'none', 'versão recusada (' + why + ')');
  }
  t = mk({ version: '1.0.0-beta.1' }); t.au.onCheck = () => { t.au.emit('update-available', { version: '1.0.0-beta.2' }); return Promise.resolve(); }; await t.u.check({ manual: true });
  assert(t.u.state().status === 'available', 'quem já está em beta recebe beta');
  // não configurado
  t = mk({ configured: false }); await t.u.check({ manual: true }); assert(t.au.calls.length === 0 && t.u.state().message === 'Updates are not configured yet.', 'não configurado: sem rede e com mensagem');
  t = mk({ configured: false }); await t.u.check({ manual: false }); assert(t.au.calls.length === 0 && t.u.state().status === 'idle', 'não configurado: automática não faz nada');
  // modo notify (app sem assinatura Apple): abre a página da release em vez de baixar
  t = mk({ mode: 'notify' }); t.au.onCheck = () => { t.au.emit('update-available', { version: '1.3.0' }); return Promise.resolve(); }; await t.u.check({ manual: true });
  await t.u.download(); assert(!t.au.calls.includes('download') && t.st.opened.join() === 'https://github.com/x/y/releases/tag/v1.3.0', 'modo notify: abre a release no GitHub, sem baixar nem instalar');
  // não sobrepõe verificações
  t = mk(); let n = 0; t.au.onCheck = () => { n++; return new Promise((r) => setTimeout(r, 30)); }; await Promise.all([t.u.check({ manual: true }), t.u.check({ manual: true }), t.u.check({ manual: false })]);
  assert(n === 1, 'verificações simultâneas viram uma só');
  // intervalo mínimo entre verificações automáticas
  t = mk({ minGapMs: 1000 }); t.au.onCheck = () => { t.au.emit('update-not-available', {}); return Promise.resolve(); }; await t.u.check({ manual: false }); await t.u.check({ manual: false });
  assert(t.au.calls.length === 1, 'automática respeita o intervalo mínimo');
})();
