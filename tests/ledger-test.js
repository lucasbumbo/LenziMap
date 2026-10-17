// Testa o registro de tarefas de verdade, em pasta temporaria.
const fs = require('fs'), os = require('os'), path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lzai-')); fs.mkdirSync(path.join(tmp, 'ai', 'evidencias'), { recursive: true });
process.env.LENZI_AI_DIR = path.join(tmp, 'ai');
fs.writeFileSync(path.join(tmp, 'ai', 'orcamento.json'), '{"porTarefa":100,"global":150}');
const L = require('../lenzi-ai/ledger.js');
let falhas = 0;
function ok(n, c) { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) falhas++; }
function erra(n, f, re) { try { f(); ok(n, false); } catch (e) { ok(n, re.test(e.message)); } }
const id = L.add('Tarefa teste', 'dev-1');
ok('cria tarefa PENDENTE', L.load().tasks[0].estado === 'PENDENTE');
erra('nao pula direto para APROVADO', () => L.move(id, 'APROVADO', 'auditor-1'), /proibida/);
L.move(id, 'EM_DESENVOLVIMENTO', 'dev-1'); L.move(id, 'EM_TESTE', 'dev-1');
erra('auditoria sem evidencia e recusada', () => L.move(id, 'EM_AUDITORIA', 'dev-1'), /evidencia/);
fs.writeFileSync(path.join(tmp, 'prova.txt'), 'x'); L.evid(id, 'prova.txt');
erra('evidencia inexistente e recusada', () => L.evid(id, 'nao-existe.txt'), /nao existe/);
L.move(id, 'EM_AUDITORIA', 'dev-1');
erra('dono nao audita o proprio trabalho', () => L.move(id, 'APROVADO', 'dev-1'), /proprio|auditor/);
erra('nome sem "audit" nao aprova', () => L.move(id, 'APROVADO', 'revisor-x'), /auditor/);
erra('sem portao, nao aprova', () => L.move(id, 'APROVADO', 'auditor-1'), /portao/);
const g = path.join(tmp, 'ai', 'evidencias', 'gate-ultimo.json');
fs.writeFileSync(g, '{"ok":false}');
erra('portao vermelho nega', () => L.move(id, 'APROVADO', 'auditor-1'), /vermelho/);
fs.writeFileSync(g, '{"ok":true}');
L.move(id, 'APROVADO', 'auditor-1'); ok('auditor independente aprova com portao verde', L.load().tasks[0].estado === 'APROVADO');
erra('APROVADO e final', () => L.move(id, 'EM_DESENVOLVIMENTO', 'dev-1'), /proibida/);
ok('historico registra todas as mudancas', L.load().tasks[0].historico.length === 5);
const b = L.add('Outra', 'dev-2'); erra('bloqueio exige motivo', () => L.move(b, 'BLOQUEADO', 'dev-2'), /motivo/);
L.uso(b, 'dev-2', 60); ok('orcamento ok abaixo do limite', L.orcamento(b).ok);
L.uso(b, 'dev-2', 50); ok('orcamento estoura ao passar do limite da tarefa', !L.orcamento(b).ok);
console.log(falhas ? 'FAIL total ' + falhas : 'ok'); process.exit(falhas ? 1 : 0);
