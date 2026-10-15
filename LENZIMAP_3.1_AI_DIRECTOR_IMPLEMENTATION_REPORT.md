# LenziMap 3.1: AI Director, relatório de implementação

Data: 14/10/2026. Trabalho feito dentro do projeto existente (Mac/Electron + iOS/Capacitor). Nenhum app novo foi criado.

## Leia primeiro: o que NÃO foi testado

- Nenhuma chamada a um provedor de IA real (OpenAI ou Anthropic) foi feita. Todo o código de chamada, erros, timeout e cancelamento foi testado contra um servidor falso local. A integração real depende da sua chave e pode exigir ajuste de nome de modelo.
- Nada foi testado em Mac real, com projetor, câmera, MIDI ou GPU do Mac. Os testes rodaram em Chromium (Playwright), jsdom e Electron 33 no Linux (Xvfb).
- O iOS não foi compilado (sem Swift/Xcode aqui). No iOS o AI Director abre só no modo local.
- O cofre de chaves do sistema (Keychain no Mac) não existe no ambiente de teste Linux. Lá o app guardou a chave só na memória e avisou. No Mac o código usa `safeStorage`, que não pôde ser exercitado aqui.

## Fluxo principal (critério de aceitação)

Foto → Análise → Sugestão → Efeito/Shader → Prévia → Timeline → Projeção. Esse fluxo funciona de ponta a ponta no modo local e no modo IA (com servidor falso), com testes automáticos no Chromium real.

## Implementado

**Fase A, infraestrutura de IA**
- `ai/ai-provider.js`: camada de provedores (OpenAI e Anthropic) com pedido de visão, leitura da resposta, limites (imagem 5 MB, tempo 60 s), timeout, cancelamento e mensagens de erro claras (chave recusada, limite, sem conexão, resposta inválida).
- `ai/ai-main.js`: processo principal. Guarda a chave com `safeStorage` (Keychain), faz a chamada e nunca devolve a chave para a janela. Sem cofre, a chave vive só na memória.
- A janela do app tem CSP que bloqueia rede na página, então só o processo principal fala com os provedores (testado).
- `ai/ai-schema.js`: valida a análise e o plano. Resposta de IA é dado não confiável: limites, tipos, efeitos permitidos, keyframes só em propriedades liberadas.
- `ai/vision-analysis.js`: pede análise em JSON (objetos, regiões, confiança, materiais, cores, superfícies candidatas, dificuldades, sugestões) e valida.

**Fase B, painel AI Director** (aba "IA" do painel, a timeline e o Viewer continuam visíveis)
Import Image, Capture Image (se houver câmera), Analyze Scene, Detected Objects (clique no objeto ou na caixa sobre a foto), Suggested Animations (cards com título, descrição, duração, efeitos, sequência, complexidade e recursos), prompt de texto, Generate Preview, Apply to Timeline, Regenerate, Cancel, Undo, AI Settings, histórico de operações.

**Fase C, máscara e profundidade (versão local)**
- Máscara por crescimento de região a partir do objeto detectado, com pincel (adicionar e remover), expandir, contrair, feather, inverter, visualização sobre a foto, exportar PNG e aplicar a máscara aos efeitos gerados (`fx.mask`).
- Mapa de profundidade por luminosidade, com inverter, contraste, suavizar, faixa perto/longe e uso da faixa como máscara.
- Isso NÃO é SAM nem Depth Anything. A interface diz isso. Um modelo real exige download e não foi integrado.

**Fase D, shaders**
- 10 efeitos nativos (rachaduras, brilho, ouro, linhas neon, oceano digital, partículas, núcleo de energia, glitch, explosão de luz, pulso), todos com progresso (p1) e intensidade (p2) animáveis.
- GLSL: contrato `vec4 lenziEffect(vec2 uv)` com uniforms controlados. `ai/shader-validator.js` barra `#`, texturas, `while`, uniforms desconhecidos, laços sem limite constante, tamanho e caracteres estranhos. Depois o WebGL compila de verdade. Falha de compilação mostra a linha e o motivo; o clipe já salvo com shader quebrado cai no brilho nativo e o editor continua funcionando.
- 3 shaders GLSL nativos (lava, plasma, energia varrendo) e salvar presets.

**Fase E, planejador**
- `ai/animation-planner.js`: com IA, pede um plano JSON validado. Sem IA, planejador LOCAL por palavras-chave (ordem "depois", duração em segundos, cor, cubos/faces, ritmo). O plano diz de onde veio (IA ou local).

**Fase F, timeline**
- `ai/ai-timeline-bridge.js`: o plano vira faixas, clipes, fades e keyframes normais, usando só as funções do editor. Faixas novas ficam acima das existentes, nomeadas "IA · nome". Nenhum clipe existente é movido (testado comparando o clipe antes e depois). `surface.q`, máscara de calibração e Mesh Warp ficam idênticos (testado).
- Undo remove só o que a IA criou; Cmd+Z global também funciona.
- Dois campos novos nos clipes: `fxp {p1,p2}` e keyframes `p1` (progresso) e `p2` (intensidade). Projetos antigos abrem com valores neutros.

**Fase G, assistente de mapeamento**: Analyze → Suggest → Preview → Confirm. As sugestões ficam separadas de `surface.q`. "Criar superfície" cria uma superfície NOVA (você calibra depois). Superfícies existentes não mudam (testado).

**Fase H, cena completa**: o planejador monta sequências com várias camadas e distribui entre superfícies (alvo "cada superfície" cria cascata de tempo). A cena fica no mesmo relógio da timeline.

**Fase I, áudio**: análise determinística (batidas, BPM, mudanças de intensidade) a partir do áudio do projeto. A camada "no ritmo" usa os tempos medidos. Sem batidas analisadas, o app avisa e não inventa tempos. Marcadores de batida na timeline.

**Privacidade**: serviços externos desligados por padrão; consentimento antes de enviar foto, citando provedor e custo; limite de tamanho; timeout; cancelamento; histórico sem imagens nem chaves; a chave não vai para `.mapa`, localStorage, logs nem pacote.

## Parcial ou pendente

- Segmentação com modelo (SAM) e profundidade com modelo (Depth Anything): pendente. Só versões heurísticas.
- Aplicar profundidade como textura dentro do shader (deslocamento, relevo): pendente. Hoje a profundidade serve como máscara.
- Prévia no palco: a prévia é uma tira de 5 quadros, calculada pelo mesmo caminho do projetor. Prévia ao vivo dentro do Viewer sem aplicar: pendente (aplicar e desfazer cumpre esse papel).
- Capture Image só aparece quando há câmera; não foi testado com câmera real.
- Modo demonstração sem IA usa tipo escolhido por você e contraste de cor. Não reconhece objetos de verdade.
- Sugestões de transição por mudança de intensidade do áudio: a análise detecta, mas não gera plano automático a partir delas.
- Keyframes de parâmetros próprios de cada efeito além de p1 e p2: pendente.
- iOS: painel funciona só no modo local; chave de API e chamadas à IA só no Mac.
- LenziMap 3.0 (spec anterior): fases 1 a 3 concluídas (auditoria, painéis/workspaces, Media Browser). Fases 4 a 15 (keyframes visuais, curvas, ferramentas avançadas de timeline, hierarquia, compound clips etc.) continuam pendentes.

## Arquivos

Novos: `ai/ai-effects.js`, `ai-schema.js`, `shader-validator.js`, `glsl-fx.js`, `animation-planner.js`, `image-tools.js`, `creative-suggestions.js`, `vision-analysis.js`, `audio-analysis.js`, `ai-provider.js`, `ai-main.js`, `ai-timeline-bridge.js`, `ai-director.js`, `ai-director-panel.js`; testes `tests/ai-core.js`, `ai-provider.js`, `t13.js`, `electron-ai.js`.

Modificados: `sequence.js` (fxp, p1, p2), `sequence-player.js` (repassa p1/p2), `renderer.js` (máscara de efeito, GLSL, `Renderer.drawFx`), `textures.js` (p1/p2), `control.html` (aba IA, scripts, abas em duas linhas), `control.js` (aba "ia" e integração), `output.html` (efeitos IA e GLSL na saída), `main.js`, `preload.js` (`window.api.ai`), `package.json` (inclui `ai/*.js`), `tests/run-all.sh`.

Dependências adicionadas: nenhuma.

## Modelos e configuração

Modelos padrão (editáveis em AI Settings): OpenAI `gpt-4o`, Anthropic `claude-sonnet-5-5`. Nenhum foi testado de verdade.

Como configurar: aba IA → AI Settings → marcar "Permitir serviços externos", escolher o provedor, colar a chave, Salvar chave. Na primeira análise o app pede confirmação antes de enviar a foto.

Custos: cada análise envia 1 foto (até 1024 px) e cada pedido de texto envia só texto. Quem cobra é o provedor, pela SUA chave. O LenziMap não cobra nada.

## Testes (todos automáticos, ambiente Linux)

- `ai-core`: 58 verificações (respostas inválidas, schema, 11 shaders recusados, planejador, ponte, undo, projeto antigo, áudio, máscara, profundidade).
- `ai-provider`: 22 (formato dos pedidos, 401/429/500, resposta quebrada, timeout, cancelamento, sem conexão, sem chave, imagem grande, chave fora do corpo e das mensagens de erro).
- `t13` (Chromium real, mouse real): 78 verificações do fluxo completo: estátua, quatro cubos, prompt livre, shaders GLSL reais, consentimento, JSON quebrado, chave recusada, falha de rede, mapeamento, salvar e reabrir `.mapa`, `surface.q` intacto, funcionamento sem internet.
- `electron-ai` (Electron 33 real): 17 verificações do canal seguro (chave nunca volta à página, nada em texto puro no disco, CSP bloqueia rede da página, cancelamento).
- Regressão completa (`tests/run-all.sh`) e smoke do Electron e do updater: sem falhas. O teste de deriva de áudio (t8) é sensível à carga da máquina: uma rodada deu 0,158 s (limite 0,15) e a repetição deu 0,129 s.

## Limitações conhecidas

- A qualidade da análise por IA depende do modelo e da foto. O app marca confiança quando o modelo informa e não trata palpite como fato.
- GLSL gerado: o validador barra os casos perigosos conhecidos, mas desempenho depende da GPU. Teste no projetor antes do show.
- A prévia usa o motor do projetor, mas a velocidade real depende do hardware.
- Projeção mapeada sobre objeto real e calibração continuam manuais, como antes.

## Compatibilidade

Projetos `.mapa` antigos abrem sem mudança (versão do projeto continua 4; clipes antigos ganham `fxp` neutro). Calibração, `surface.q`, máscaras, Mesh Warp, camadas, timeline, áudio, MIDI, Viewer, saída externa e sistema de atualização continuam como antes. A IA é opcional e o app funciona sem internet.

## Resultado da integração com a timeline

Aplicar "estátua rache, brilhe e depois vire ouro" cria 3 camadas por superfície (rachaduras, brilho, ouro) com keyframes de progresso e intensidade e fades. Tudo pode ser movido, aparado, ter keyframes editados, trocar de efeito ou ser apagado. Aplicar "neon atravessando quatro cubos" cria uma faixa de linhas neon em cada cubo, em cascata de 0,4 s.

## Ponto de continuidade

Próximos passos naturais: (1) testar com sua chave real e ajustar nomes de modelo; (2) integrar um modelo de segmentação e um de profundidade (exige download e decisão de onde rodar); (3) textura de profundidade dentro dos shaders; (4) retomar a spec 3.0 a partir da Fase 4 (keyframes visuais e curvas).
