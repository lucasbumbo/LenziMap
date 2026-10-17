#!/usr/bin/env node
// LENZI AI: registro de tarefas com maquina de estados. Sem dependencias.
// Regras: (1) quem desenvolveu nao pode auditar; (2) aprovar exige evidencia
// (arquivo existente) e portao de qualidade verde; (3) toda mudanca fica no historico.
const fs = require('fs'), path = require('path');
const DIR = process.env.LENZI_AI_DIR || __dirname;
const FILE = path.join(DIR, 'tasks.json');
const USAGE = path.join(DIR, 'usage.jsonl');
const ESTADOS = ['PENDENTE', 'EM_DESENVOLVIMENTO', 'EM_TESTE', 'EM_AUDITORIA', 'APROVADO', 'REPROVADO', 'BLOQUEADO'];
const PERMITE = {
  PENDENTE: ['EM_DESENVOLVIMENTO', 'BLOQUEADO'],
  EM_DESENVOLVIMENTO: ['EM_TESTE', 'BLOQUEADO'],
  EM_TESTE: ['EM_AUDITORIA', 'EM_DESENVOLVIMENTO', 'BLOQUEADO'],
  EM_AUDITORIA: ['APROVADO', 'REPROVADO'],
  REPROVADO: ['EM_DESENVOLVIMENTO'],
  BLOQUEADO: ['PENDENTE'],
  APROVADO: []
};
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return { tasks: [] }; } }
function save(db) {
  const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, FILE);
}
function now() { return new Date().toISOString(); }
function get(db, id) { const t = db.tasks.find(x => x.id === id); if (!t) throw new Error('tarefa nao existe: ' + id); return t; }
function add(titulo, dono) {
  if (!titulo) throw new Error('titulo obrigatorio');
  const db = load(); const id = 'T' + String(db.tasks.length + 1).padStart(3, '0');
  db.tasks.push({ id, titulo, dono: dono || null, estado: 'PENDENTE', evidencias: [], historico: [{ em: now(), de: null, para: 'PENDENTE', por: dono || 'sistema' }] });
  save(db); return id;
}
function move(id, para, por, opts) {
  opts = opts || {};
  if (!ESTADOS.includes(para)) throw new Error('estado invalido: ' + para);
  if (!por) throw new Error('"por" (quem fez) e obrigatorio');
  const db = load(), t = get(db, id);
  if (!PERMITE[t.estado].includes(para)) throw new Error(`transicao proibida: ${t.estado} -> ${para}`);
  if (para === 'EM_DESENVOLVIMENTO') t.dono = t.dono || por;
  if (para === 'EM_AUDITORIA' && opts.evidencia) t.evidencias.push(opts.evidencia);
  if (para === 'EM_AUDITORIA' && !t.evidencias.length) throw new Error('auditoria exige evidencia registrada (use: evid)');
  if (para === 'APROVADO' || para === 'REPROVADO') {
    if (por === t.dono) throw new Error('o desenvolvedor nao pode auditar o proprio trabalho: ' + por);
    if (!/audit/i.test(por)) throw new Error('apenas um auditor pode aprovar ou reprovar (nome deve conter "audit")');
  }
  if (para === 'APROVADO') {
    for (const ev of t.evidencias) { if (!fs.existsSync(path.resolve(DIR, '..', ev))) throw new Error('evidencia nao existe no disco: ' + ev); }
    const g = path.join(DIR, 'evidencias', 'gate-ultimo.json');
    if (!fs.existsSync(g)) throw new Error('portao de qualidade nunca foi executado');
    const r = JSON.parse(fs.readFileSync(g, 'utf8'));
    if (!r.ok) throw new Error('portao de qualidade esta vermelho; aprovacao negada');
  }
  if (para === 'BLOQUEADO' && !opts.motivo) throw new Error('bloqueio exige motivo');
  t.historico.push({ em: now(), de: t.estado, para, por, motivo: opts.motivo || undefined });
  t.estado = para; save(db); return t;
}
function evid(id, arquivo) {
  const db = load(), t = get(db, id);
  if (!fs.existsSync(path.resolve(DIR, '..', arquivo))) throw new Error('arquivo nao existe: ' + arquivo);
  t.evidencias.push(arquivo); save(db);
}
// Registro de uso e orcamento (tokens). Limite por tarefa e global; passou, bloqueia.
function uso(tarefa, agente, tokens, nota) {
  fs.appendFileSync(USAGE, JSON.stringify({ em: now(), tarefa, agente, tokens: Number(tokens) || 0, nota: nota || '' }) + '\n');
}
function totais() {
  const por = {}; let total = 0;
  if (fs.existsSync(USAGE)) for (const l of fs.readFileSync(USAGE, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(l); por[r.tarefa] = (por[r.tarefa] || 0) + r.tokens; total += r.tokens;
  }
  return { por, total };
}
function orcamento(tarefa) {
  const lim = JSON.parse(fs.readFileSync(path.join(DIR, 'orcamento.json'), 'utf8'));
  const t = totais();
  const usadoT = t.por[tarefa] || 0;
  return { ok: usadoT < lim.porTarefa && t.total < lim.global, usadoTarefa: usadoT, usadoGlobal: t.total, limiteTarefa: lim.porTarefa, limiteGlobal: lim.global };
}
module.exports = { add, move, evid, uso, totais, orcamento, load, ESTADOS, PERMITE };
if (require.main === module) {
  const [cmd, ...a] = process.argv.slice(2);
  try {
    if (cmd === 'add') console.log(add(a[0], a[1]));
    else if (cmd === 'move') { const t = move(a[0], a[1], a[2], { motivo: a[3] }); console.log(t.id, t.estado); }
    else if (cmd === 'evid') { evid(a[0], a[1]); console.log('ok'); }
    else if (cmd === 'uso') { uso(a[0], a[1], a[2], a[3]); console.log('ok'); }
    else if (cmd === 'orcamento') { const o = orcamento(a[0]); console.log(JSON.stringify(o)); process.exit(o.ok ? 0 : 3); }
    else if (cmd === 'lista') for (const t of load().tasks) console.log(t.id, t.estado.padEnd(18), t.dono || '-', t.titulo);
    else console.log('uso: ledger.js add|move|evid|uso|orcamento|lista');
  } catch (e) { console.error('ERRO:', e.message); process.exit(1); }
}
