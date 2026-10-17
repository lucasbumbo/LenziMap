# LENZI AI DEVELOPMENT: como funciona (fase 1)

Tudo vive neste repositorio. Nada e instalado fora dele.

## Agentes (`.claude/agents/`)
diretor, arquiteto, dev, qa, auditor, seguranca, documentador. Cada um tem ferramentas limitadas
(auditor e seguranca nao editam codigo; arquiteto so le). Validados com `claude plugin validate .claude/agents`.

## Registro de tarefas (`lenzi-ai/ledger.js`)
Estados: PENDENTE, EM_DESENVOLVIMENTO, EM_TESTE, EM_AUDITORIA, APROVADO, REPROVADO, BLOQUEADO.
Regras impostas por codigo (e testadas em `tests/ledger-test.js`):
- quem desenvolveu nao aprova o proprio trabalho;
- so um auditor (nome com "audit") aprova ou reprova;
- aprovar exige evidencia existente no disco e portao verde;
- bloquear exige motivo; tudo fica no historico.

## Portao rapido (`node lenzi-ai/gate.js`)
Sintaxe de todos os .js, teste do registro e 12 testes de nucleo. Escreve `evidencias/gate-ultimo.json`.
Roda tambem no GitHub Actions (`.github/workflows/testes.yml`).

## E2E (`lenzi-ai/e2e.sh`)
Cria superficies, cantos e mascara, salva um .mapa real, fecha o app, abre de novo, reabre o arquivo,
confere integridade e imagem na saida. Gera frames. Para incluir o app empacotado: `PACKAGED_BIN=/caminho/lenzimap`.

## Orcamento (`lenzi-ai/orcamento.json`, `usage.jsonl`)
`node lenzi-ai/ledger.js uso <tarefa> <agente> <tokens>` registra. `orcamento <tarefa>` sai com erro 3 se passou do limite.
Atencao: os tokens sao informados pelo agente, nao medidos automaticamente.

## Limites conhecidos
- Nao testado no seu Mac, projetor, cubo fisico ou iOS.
- Sem painel visual ainda (fase futura).
- Sem varias IAs de fornecedores diferentes: so Claude (sonnet, opus, haiku). Outros modelos exigiriam chaves e custo, sem autorizacao.
