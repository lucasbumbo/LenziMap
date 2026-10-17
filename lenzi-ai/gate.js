#!/usr/bin/env node
// Portao de qualidade rapido (sem navegador). Escreve evidencias/gate-ultimo.json.
// Verde so se TODAS as verificacoes passarem. Nao substitui a suite completa nem o teste E2E.
const { spawnSync } = require('child_process'); const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const checks = [];
function run(nome, cmd, args, cwd) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: cwd || ROOT, encoding: 'utf8', timeout: 240000 });
  const saida = (r.stdout || '') + (r.stderr || '');
  const falhou = r.status !== 0 || /(^|\n)FAIL/.test(saida);
  checks.push({ nome, ok: !falhou, ms: Date.now() - t0, resumo: saida.split('\n').filter(l => /FAIL|ERRO|Error/.test(l)).slice(0, 5) });
}
const raiz = fs.readdirSync(ROOT).filter(f => f.endsWith('.js'));
for (const f of raiz) run('sintaxe ' + f, process.execPath, ['--check', f]);
run('ledger', process.execPath, ['tests/ledger-test.js']);
for (const t of ['unit', 'updater-core', 'layout-core', 'media-core', 'keyframe-core', 'timeline-edit-core', 'package-check', 'hierarchy-core', 'compound-core', 'viewer-core', 'effects-core', 'illusion-core'])
  run('teste ' + t, process.execPath, [t + '.js'], path.join(ROOT, 'tests'));
const ok = checks.every(c => c.ok);
const rel = { em: new Date().toISOString(), hash: require('./ledger.js').hashFontes(), ok, total: checks.length, falhas: checks.filter(c => !c.ok), checks };
fs.mkdirSync(path.join(__dirname, 'evidencias'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'evidencias', 'gate-ultimo.json'), JSON.stringify(rel, null, 2));
console.log(ok ? `PORTAO VERDE (${checks.length} verificacoes)` : `PORTAO VERMELHO: ${rel.falhas.map(f => f.nome).join(', ')}`);
process.exit(ok ? 0 : 1);
