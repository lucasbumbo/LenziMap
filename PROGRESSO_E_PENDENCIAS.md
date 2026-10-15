# LenziMap: onde paramos e o que falta (14/10/2026, 15:10)

## Como retomar numa nova sessão
1. Descompacte LenziMap-Mac.zip. Tudo que foi feito está nele (pasta `tests/` incluída).
2. Peça ao Claude: "leia PROGRESSO_E_PENDENCIAS.md e continue a Timeline 2.0 da Fase 3".
3. A especificação completa das fases (a mensagem do ChatGPT) deve ser colada de novo, porque ela não fica no zip.
4. Testes: `bash tests/run-all.sh` (precisa de Node, Playwright e jsdom). Electron real: `xvfb-run -a node tests/electron-smoke.js` (Linux) com Electron instalado.

## Já feito
**Timeline 1.0 (fases A a F do pedido anterior)**: relógio mestre, esquema, edição, Viewer, inspetor, áudio, salvar/abrir, projeto antigo compatível. Detalhes em `TIMELINE.md` e em `LENZIMAP_TIMELINE_STATUS_AND_ROADMAP.md`.

**Timeline 2.0, Fase 1 (validação e proteção): CONCLUÍDA**
- Backup verificável: `backup/pre-timeline2-20261014-1503.tar.gz` com checksum SHA-256 conferido (arquivo `.sha256` ao lado). Está no ambiente de desenvolvimento, não no zip.
- Testes incorporados ao projeto em `tests/` (unit, smoke jsdom, t2, t6, t7, t8, t9, electron-smoke, `run-all.sh`, mídias de teste). Caminhos agora relativos.
- Regressão completa rodada: unit 72 PASS, jsdom 67 PASS, t2, t6, t7, t8 todos PASS (`TUDO OK`).
- **Electron real (v33, Linux com tela virtual Xvfb) testado**: preload e `window.api` carregam, nodeIntegration desligado, IPC `displays`, `read-bytes`, `open-output`, `transport` e `close-output` funcionam, painel e saída ficam no mesmo tempo (diferença de 0,003 s), vídeo H.264 e VP9 carregam e tocam na saída, sem erros de JS.
  - NÃO TESTADO: Mac, projetor ou segundo monitor físico, diálogos nativos de abrir e salvar, gravação de tela, iOS, desempenho com 12 vídeos no hardware real.

## Feito depois (16:45): camadas empilhadas por face
Pedido do Lucas: a timeline não empilhava camadas como no Final Cut. Agora empilha: botões ＋ ▲ ▼ e selo C1..C4 no cabeçalho de cada faixa de face, faixa de cima fica por cima na projeção, sem limite por face (aviso de peso acima de 4). Arquivos: `sequence.js` (`addLayer`, `moveLayer`, `layersOf`, `layerInfo`, ordem de pintura em `evaluate`), `timeline-ui.js` (cabeçalhos). Testes: unit 81 PASS, `tests/t10.js` (clique real, ordem na prévia e na saída, desfazer, limite, salvar e reabrir, `q` intacto). Captura: `shots/camadas.png`. Isso adianta parte da Fase 5 (camadas por face); faltam grupos de cubos e blend.

## Achado novo (Fase 3)
O botão de modo **Conteúdo** (`#m-clip`) fica dentro da aba **Ajustes** do painel. Quem está na aba Timeline não enxerga o botão. Precisa de uma barra de modos no próprio Viewer (Calibração | Clipe) e indicação visual de calibração travada.

## Em andamento
- `tests/t9.js` (alças do Viewer com movimento real do mouse: tlm, tlc, tlr, tls, e conferência de `q`, `mask` e `mesh`) está escrito, mas ainda NÃO foi executado com sucesso. A última alteração do teste (trocar o clique no botão por `setMode('clip')`) foi interrompida antes de rodar.

## O que falta (ordem de prioridade do pedido)
1. **Fase 3, Viewer**: rodar e corrigir t9; barra de modos no Viewer; contorno da superfície selecionada; bounding box do clipe; guias de alinhamento e snapping; ajuste fino com setas; feedback durante o arraste; seleção de superfície clicando no Viewer; teste com superfície em Mesh Warp (hoje é só aproximação afim, sem perspectiva).
2. **Fase 4, keyframes visuais**: diamantes na timeline, expandir propriedades, arrastar, seleção múltipla, copiar e colar, escolher Linear/Hold/Ease (hoje a interface só cria linear), navegação, undo e persistência.
3. **Fase 2, edição**: seleção múltipla de clipes e mover em conjunto, arrastar da Galeria para a timeline (existe o drop, falta testar), marcadores editáveis, snapping configurável, ripple opcional.
4. **Fase 5, grupos de cubos** (schema 2 com migração): grupos, nomes, expandir e recolher, selecionar o cubo, mover em conjunto, camadas extras por face com ordem e limite.
5. **Fase 6, biblioteca**: painel de assets, mídia ausente, relink, substituir mantendo ajustes, arrastar para uma face no Viewer, duração e resolução.
6. **Fase 7, desempenho**: painel de diagnóstico (fps médio, p95, seek, desvio, pool, memória), depois otimizações medidas (prévia leve, pausar clipes invisíveis, menos seeks, requestVideoFrameCallback, proxies se necessário). Meta de 24 fps com 12 faces só vale após medição num Mac real.
7. **Fase 8, efeito atravessando faces**: coordenadas compartilhadas entre superfícies, keyframes de posição global, teste visual com padrão atravessando faces vizinhas.
8. **Fase 9, áudio**: automação de volume por keyframe, marcadores de batida, recuperação de mídia, sincronia após seek, pause e loop. Sem afirmar sincronia profissional sem medir com dispositivo real.
9. **Fase 10**: testes de drag-and-drop, grupos, camadas, troca de cenas, uso prolongado; atualizar `TIMELINE.md` e os manuais; refazer os zips (Mac e iOS); relatório por fase.

## Limitações conhecidas que continuam valendo
Interface de keyframes só linear; sequência única por projeto (não por cena); GIF sem seek exato; clipe em Mesh sem perspectiva; sem proxies; decodificação duplicada entre painel e saída; nada validado em Mac, projetor ou iOS.


## Atualização: Viewer estilo Final Cut
Implementado: barra Transformar/Distorcer/Cortar, alças de canto (escala proporcional), lados (largura/altura, sx/sy com keyframe), rotação por ângulo (Shift 15 graus), mover com ímã, setas, HUD, trava de calibração. Teste: tests/t9.js (mouse real, 30 verificações, q/mask/mesh intactos). Pendente: ponto de âncora móvel, teste em Mac real.

## Atualização 3.0 e 3.1 (14/10/2026)

3.0 concluído: auditoria e regressão, painéis redimensionáveis com workspaces e Modo Show, Media Browser (offline, relink, coleções).
3.0 pendente (retomar da Fase 4): keyframes visuais e editor de curvas, ferramentas avançadas de timeline, hierarquia e grupos, compound clips, Viewer avançado, Effects Browser e blend modes, color grading, cross-surface animation, Stage Preview 3D, ferramentas de áudio, polimento de workspaces, instrumentos de desempenho.

3.1 AI Director: fluxo foto, análise, sugestão, shader/efeito, prévia, timeline funcionando (modo local e modo IA testado só contra servidor falso). Detalhes, limites e pendências em LENZIMAP_3.1_AI_DIRECTOR_IMPLEMENTATION_REPORT.md.
Ponto de continuidade: testar com chave real, integrar modelos de segmentação e profundidade, depois retomar a 3.0 pela Fase 4.

## Checkpoint Fase 4 (keyframes visuais e editor de curvas)
- Motor: sequence.js ganhou interpolação linear, hold, ease (in/out, igual ao antigo), easein, easeout e bezier com alças (h). Projetos antigos abrem iguais.
- Núcleo puro: keyframe-core.js (mover, copiar, colar, duplicar, excluir, interpolação, alças). Interface: keyframe-ui.js (Dopesheet, Curvas, menu de contexto, teclado, losangos na barra do clipe).
- Testes: keyframe-core 35 PASS, t14 64 PASS (Chromium). Regressão completa (run-all) sem falhas.
- Snapshot: /home/claude/checkpoints/fase-04.tar.gz

## Checkpoint Fase 5 (timeline avançada)
Feito: ferramenta Trim (ripple, roll, slip, slide), seleção por faixa/intervalo/marquee, pontos de edição (setas), fechar espaços, alinhar, igualar duração, juntar, opções de snap, marcadores coloridos na régua, menus de contexto, ajuda de atalhos, miniaturas em filmstrip e waveform com mais detalhe.
Arquivos: sequence.js, timeline-edit-core.js, tl-menu.js, timeline-ui.js, control.html, package.json, ios build-www.js.
Testes: tests/timeline-edit-core.js (64) e tests/t15.js (e2e), ambos em tests/run-all.sh. Regressão completa: ver LENZIMAP_3.0_IMPLEMENTATION_REPORT.md.
Não validado em hardware real: arrastes com trackpad/Magic Mouse, desempenho de filmstrip com vídeos 4K longos.
Backup: /home/claude/checkpoints/fase-05.tar.gz

## 3.2 3D Illusion Creator (concluído, validação automática)
- Feito: núcleo, motor WebGL, timeline, painel 3D, 7 presets, AI Director "3D Illusions", inspetor "Ilusão 3D", vista da plateia enquadrada, aviso de quadro lento, migração versionada, base `faceTextures` do Stage Preview.
- Testes: ai-illusion, illusion-core (95), illusion-gl (42), illusion-timeline (36), t16 (47), t17 (16). Regressão completa: tudo verde; t2 falhou uma vez sob carga (vídeo em swiftshader) e passou 2 de 2 isoladamente (instável por tempo, não por regressão).
- Não validado: projetor real, cubo físico, GPU real, iOS.
- Relatório: LENZIMAP_3.2_3D_ILLUSION_IMPLEMENTATION_REPORT.md. Checkpoint: /home/claude/checkpoints/fase-3.2.tar.gz
- Próxima ação: 3.0 Fase 6 (hierarquia de projeto), conforme a ordem de continuação.

## Finalização: pendências do 3.2 resolvidas
- Aviso de versão mais nova: cartão #compat-card na abertura (schema, palco, ilusões). Teste t18.
- Assistente do espectador (medidas -> olho) + GUIA_CALIBRACAO_ESPECTADOR.md. Testes illusion-core (100) e t18.
- IA real: tests/ai-real.js. SEM CHAVE neste ambiente: execução real PENDENTE (script pronto; o caminho de integração é validado).
- electron-updater: está em "dependencies"; conferido empacotando com electron-builder --linux dir (app.asar contém electron-updater e app-update.yml). tests/package-check.js confere os arquivos de control/output.html.
- t2: causa real era espera com every() em lista vazia (passava antes do vídeo existir). Agora espera condição positiva (vídeo presente, sem seeking, no tempo certo). Passa sob carga (2 núcleos, 4 processos ocupados).
- iOS: dist/iOS-partes (2 partes de 25 MB + COMO-JUNTAR.txt + sha256). Reconstrução e unzip -t verificados.


## Fase 6 (hierarquia) e Fase 7 (clipes conectados e compostos): concluídas
Fase 6: aba Árvore (Biblioteca, Projeto, Cena, Grupo, Cubo, Face, Camada, Clipe), arrastar e soltar, seleção múltipla, propriedades compartilhadas, Undo/Redo, salvar/reabrir (testes t19 e hierarchy-core).
Fase 7: Connected Clips (o filho acompanha o principal em arrastar, setas e campo Início; linhas visuais na timeline), Compound Clips (⌘G cria, fechado anda como unidade, "Abrir composto" edita um a um, ⇧⌘G separa, duplicar leva o grupo todo), tudo com tempo absoluto, faixas travadas nunca se movem, Undo/Redo, salvar/reabrir (tests/compound-core.js e t20, 30 verificações no navegador).
Parcial (declarado): o composto é um GRUPO fechado, não um bloco único recolhido na timeline; não há composto dentro de composto.
Teste ajustado: t13 (pincel) passou a pintar na metade inferior da foto porque a aba extra "Árvore" aumentou o cabeçalho fixo do painel e ele cobria o canto superior; t7 compara a sequência com chaves ordenadas.
Regressão completa depois da Fase 7: tudo verde (run-all, 33 arquivos), exceto o item de ordem de chaves do t7, corrigido e reexecutado.
Checkpoint: checkpoints/fase-07.tar.gz


## Fase 8 (Viewer avançado): concluída
Âncora, espelho H/V, Resetar, numéricos, grade, réguas, áreas seguras, terços, guias com ímã, trajetória editável, corte animável. Testes: tests/viewer-core.js e t21. Ajuste: a barra de ajudas do Viewer ficou no topo para não cobrir as alças de baixo (t9 atualizado).

## Fase 9 (efeitos): PARCIAL, interrompida pelo limite de uso
Pronto: effects-core.js, effects-dom.js, pilha por clipe (Glow, Blur, Pixelate, Chromatic Aberration, Displacement, Glitch, Noise, Strobe), intensidade animável, mesclagem Normal/Add/Screen/Multiply/Overlay, seção no Inspetor, Viewer e saída externa. Testes: tests/effects-core.js e t22.
Falta: aba "Efeitos" (navegador), criar camada de gerador a partir do catálogo, integração com AI Director, medir desempenho.

## Como continuar
Próximo passo: criar effects-ui.js (aba Efeitos, registrar em control.html, control.js setTab 'efeitos', package.json, build-www.js do iOS), depois Fases 10 a 15, item 12 (demo dos 4 cubos) e relatório final. Checkpoint: checkpoints/fase-09-parcial.tar.gz
