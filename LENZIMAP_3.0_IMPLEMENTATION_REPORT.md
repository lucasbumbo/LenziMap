# LenziMap 3.0: relatório de implementação (parcial)

Data: 15/10/2026. Este relatório cobre a especificação "LenziMap 3.0, interface profissional e timeline avançada". Ela tem 15 fases. As fases 1, 2 e 3 estão concluídas. As fases 4 a 15 NÃO foram implementadas. Nada aqui foi testado em Mac real, com projetor, câmera, MIDI ou GPU do Mac. Os testes rodaram em Chromium (Playwright), jsdom e Electron 33 no Linux (Xvfb). O iOS não foi compilado.

## Resumo por fase

| Fase | Assunto | Estado |
|---|---|---|
| 1 | Auditoria e regressão | Concluída |
| 2 | Interface profissional, painéis redimensionáveis, workspaces | Concluída |
| 3 | Media Browser e Inspector | Media Browser concluído; Inspector parcial |
| 4 | Keyframes visuais e editor de curvas | Pendente |
| 5 | Ferramentas avançadas de timeline | Pendente |
| 6 | Hierarquia Library, Project, Scene, Cube, Face, Layer, Clip, Effect | Pendente |
| 7 | Connected Clips e Compound Clips | Pendente |
| 8 | Viewer avançado (anchor point, Motion Paths, overlays) | Pendente |
| 9 | Effects Browser e blend modes | Pendente |
| 10 | Color Grading | Pendente |
| 11 | Cross-Surface Animation | Pendente |
| 12 | Stage Preview 3D | Pendente |
| 13 | Ferramentas de áudio | Pendente |
| 14 | Workspaces e Show Mode (polimento) | Parcial (base feita na Fase 2) |
| 15 | Otimização, diagnóstico, testes finais | Pendente |

## Implementado

**Fase 1, auditoria e regressão.** A arquitetura foi inspecionada e a bateria de testes foi ampliada. Dois problemas foram corrigidos: o teste de girar do Viewer falhava porque a bolinha de rotação saía da área do palco com a timeline mais baixa (a bolinha agora é limitada à área visível e o teste volta a escala antes de girar), e o teste de reabrir projeto comparava campos temporários que não são gravados (`_chk`, `_off`, `src`).

**Fase 2, interface profissional.**
- Painel direito redimensionável (280 a 640 px) e timeline redimensionável (190 px até 72% da janela), com divisores arrastáveis.
- Maximizar o Viewer ou a timeline, mostrar e esconder painel e timeline.
- Cinco workspaces: Editing, Mapping, Animation, Audio e Show. Layouts personalizados (até 12) salvos e restaurados. Estado guardado e saneado ao ler (valores fora do limite voltam ao seguro).
- Modo Show: bloqueia setas, Delete, atalhos de edição e cliques no overlay, mostra um transporte mínimo e avisa o processo principal.
- Desligado em tela de toque e em retrato estreito (iOS).
- Arquivos: `layout-core.js` (lógica pura), `layout-ui.js` (interface).

**Fase 3, Media Browser.**
- "Mídia do projeto" no inspetor: miniaturas, tipo, resolução, fps medido de verdade, áudio, tamanho e uso por clipe.
- Busca sem distinção de acento, filtros, ordenação e coleções.
- Detecção de mídia ausente (offline), relink (inclusive em lote por nome), substituir mídia e excluir só quando não está em uso.
- Arrastar da biblioteca para a timeline.
- Campos opcionais novos nos assets (`added`, `collection`, `meta`); campos temporários (`_off`, `_chk`, `src`) não são salvos. Projetos antigos abrem sem mudança.
- Arquivos: `media-core.js` (lógica pura), `media-browser.js` (interface).

## Parcial

- **Inspector:** o inspetor de clipe que já existia segue funcionando. Faltam controles numéricos adicionais, reset de transformação e flip no inspetor, e proxies.
- **Miniaturas e waveforms:** miniaturas existem no Media Browser; thumbnails de vídeo e waveform dentro dos clipes da timeline continuam como antes.
- **Show Mode e workspaces (Fase 14):** a base existe; o polimento previsto na especificação não foi feito.

## Pendente

Fases 4 a 13 e 15, conforme a tabela. O ponto de partida natural é a Fase 4: losangos de keyframe na timeline, seleção múltipla, copiar e colar keyframes, interpolação Linear, Hold, Ease In, Ease Out, Ease In/Out pela interface e editor de curvas com alças Bezier. Hoje o motor já aceita keyframes lineares, hold e ease, e as propriedades x, y, scale, sx, sy, rot, opacity, cantos e volume, mais p1 e p2 (efeitos, criados na versão 3.1).

## Arquivos

Novos: `layout-core.js`, `layout-ui.js`, `media-core.js`, `media-browser.js`, `tests/layout-core.js`, `tests/media-core.js`, `tests/t11.js`, `tests/t12.js`.
Modificados: `control.html`, `control.js` (guardas de overlay, `seqForSave` sem campos temporários), `timeline-ui.js` (ponto de montagem do Media Browser, clipes offline, correção da bolinha de rotação), `sequence.js` (campos opcionais dos assets), `main.js` e `preload.js` (Modo Show), `package.json` (lista de arquivos), `tests/run-all.sh`, `tests/t7.js`, `tests/t9.js`.
Dependências adicionadas nesta especificação: nenhuma.

## Mudanças na estrutura do projeto

Nenhuma mudança de versão. O arquivo de projeto continua na versão 4 (`{version:4, tlOn, sequence, scenes}`) e o schema da sequência continua 1. Só houve campos opcionais novos nos assets, sem migração necessária. `surface.q`, máscaras, Mesh Warp, IDs e calibrações não foram tocados.

## Testes

- `layout-core`: 26 verificações. `t11` (layout com mouse real): 42.
- `media-core`: 24 verificações. `t12` (Media Browser com mouse real): 39.
- `t9` (Viewer): 32. Smoke jsdom: 67.
- Regressão completa (`tests/run-all.sh`), smoke do Electron e teste de atualização: sem falhas na última rodada. O teste de deriva de áudio (t8) é sensível à carga da máquina: uma vez deu 0,158 s (limite 0,15) e passou na repetição.

## Desempenho

Nenhuma medição de desempenho em hardware real foi feita. Não há resultado de FPS ou de uso de CPU/GPU para apresentar. Os instrumentos de desempenho da Fase 15 não foram implementados.

## Limitações conhecidas

- Interface de painéis e workspaces não foi avaliada em tela de toque real nem em iOS.
- O fps do Media Browser é medido pelo navegador e pode divergir do fps original do arquivo.
- Relink em lote depende de nomes iguais.

## Recomendações

1. Validar a Fase 2 (painéis, workspaces, Modo Show) no Mac com o projetor ligado antes de seguir.
2. Prosseguir pela Fase 4 e depois pela Fase 5, porque as demais dependem de edição de keyframes e de seleção múltipla.
3. Só depois atacar hierarquia, compound clips e Stage Preview 3D, que mexem na estrutura do projeto e exigem migração versionada.

## Relação com a versão 3.1

O AI Director (3.1) foi implementado antes das fases 4 a 15 e está documentado em `LENZIMAP_3.1_AI_DIRECTOR_IMPLEMENTATION_REPORT.md`.
