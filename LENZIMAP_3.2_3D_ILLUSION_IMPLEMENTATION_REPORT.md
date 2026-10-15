# LenziMap 3.2: 3D Illusion Creator. Relatório de implementação

Escopo: Infinite Room primeiro, completo da edição até a saída calibrada, mais os outros seis presets, câmera anamórfica, geometria física dos cubos, timeline, AI Director e base do Stage Preview.

## Leia isto primeiro: o que foi e o que NÃO foi validado

**Validado automaticamente** (Chromium com swiftshader/WebGL por software, jsdom, Node, Electron 33 em Linux/Xvfb): matemática, renderização WebGL, integração com timeline e keyframes, painel, saída calibrada em duas janelas, salvar e reabrir, perda de contexto WebGL, IA simulada.

**NÃO validado em hardware real.** Nenhum teste com projetor, cubo físico, GPU real, iPhone ou iPad. O que isso quer dizer na prática:
- Não sei se a ilusão "fecha" para um espectador real parado no ponto de vista configurado. A matemática (frustum assimétrico passando pelos 4 cantos da face) é testada, a percepção não.
- Desempenho em GPU real e em iOS não foi medido. Os números de ms abaixo são de renderização por software.
- A medida real dos cubos (16" e 8") e a posição do espectador/projetor precisam ser conferidas no local. Os padrões são só um ponto de partida editável.
- A qualidade das cores, brilho e contraste no projetor não foi avaliada.

## Por fase (A a I)

| Fase | Conteúdo | Estado |
|---|---|---|
| A. Núcleo | Geometria física dos cubos, quadro de cada face, câmera por face, projeção ponto-textura, validação | Pronto, testado (95 testes) |
| B. Motor | WebGL1 próprio, contexto único compartilhado, depth buffer, oclusão, clipping no plano da face, névoa, 3 qualidades, fallback 2D | Pronto, testado (42 testes) |
| C. Timeline | Ilusão vira asset + um clipe por face, keyframes `ill.*`, Undo, edição à mão | Pronto, testado (36 testes) |
| D. Painel 3D | Aba "3D": tipo, alvo, geometria, profundidade, câmera, luz, materiais, animação, qualidade, presets | Pronto, testado ponta a ponta (47 testes) |
| E. Presets | Infinite Room (prioridade), Infinite Tunnel, Opening Cube, Breaking Surface, Object Inside, Object Emerging, Mechanical Interior | Pronto. Os 7 renderizam; Infinite Room é o mais testado |
| F. AI Director | Categoria "3D Illusions" com esquema fechado, sem código | Pronto, testado (Node + navegador, 16 testes) |
| G. Câmera | Vista da plateia (enquadra o cubo alvo), câmera livre, saída do projetor | Pronto |
| H. Stage Preview | `drawStage` aceita texturas externas por face, sem ilusão, para a Fase 12 do 3.0 | Base pronta. A interface do Stage Preview completo é a Fase 12 do 3.0 (pendente) |
| I. Qualidade e versão | Low/Medium/High, aviso de quadro lento, migração versionada, falha do WebGL tratada | Pronto |

## Pipeline

Cena virtual → perspectiva da plateia → projeção na superfície → saída calibrada.

Cada face do cubo físico é uma janela para o mundo virtual. A face é renderizada numa textura com a câmera anamórfica (olho no ponto de vista, frustum pelos 4 cantos), e essa textura entra na superfície ligada, que a calibração existente leva ao projetor. A calibração (`surface.q`, máscara, Mesh Warp) **não é alterada** em nenhum ponto: testes comparam antes e depois.

Unidades em polegadas. Eixos: X direita, Y cima, Z para a plateia. Cubos padrão: A 16", B/C/D 8". A geometria fica em `seq.stage`, separada das superfícies, e é salva no projeto.

## Timeline

Hierarquia editável: Ilusão (asset) → clipe por face ligada → keyframes. Parâmetros animáveis: depth, travel, glow, light, open, brk, ox, oy, oz, osize, orot, camx, camy, camz. Não animáveis (valem para o clipe inteiro): flow, spin, spacing, thick, twist, sides, brkdir. O inspetor do clipe tem a seção "Ilusão 3D" com ◆ por parâmetro, e as linhas aparecem no editor de keyframes. A ilusão roda no relógio mestre da sequência.

## AI Director, categoria 3D Illusions

- Sem IA: planejador local por palavras-chave (preset, cores, objeto, material, faces, cubo A a D, duração, "rápido/lento", "parada").
- Com IA: o pedido pede JSON fechado. A resposta passa por `IllusionCore.validate` e `validateKeys`.
- Aceito: preset do catálogo, enums (objeto, material, parede, qualidade), cores `#rrggbb`, números limitados às faixas, keyframes só em parâmetros animáveis.
- Descartado com aviso: qualquer campo fora do esquema (`code`, `glsl`, `script`...), cor inválida, enum desconhecido, parâmetro inexistente, `__proto__`.
- Nada é executado. Testado com uma resposta propositalmente maliciosa.
- "Apply to Timeline" liga automaticamente faces do alvo sem superfície às superfícies livres (e avisa), cria os clipes, e "Undo" remove só o que foi criado. Há também "Abrir no painel 3D" (carrega como rascunho).
- A chamada à IA real **não foi testada** (só um servidor/stub simulado). Depende da sua chave e do provedor.

## Testes

Novos: `illusion-core` (95), `illusion-gl` (42), `illusion-timeline` (36), `ai-illusion` (Node), `t16` (47, ponta a ponta com controle + saída), `t17` (16, AI Director no navegador). Todos entram em `tests/run-all.sh`.

## Pendências e limites conhecidos

- Teste em projetor e cubo reais (o principal).
- Medir desempenho em GPU real, no Mac, e no iPhone/iPad (o WebGL do iOS não foi exercitado).
- Aviso de palco de versão mais nova existe em `IllusionCore.stageVersionWarning`, mas ainda não aparece na interface ao abrir o projeto. O palco é só limitado ao que a versão atual entende.
- Parâmetros não animáveis não têm keyframe (decisão de escopo).
- Sem mapeamento automático de materiais por foto; sem modelos 3D importados (objetos: esfera, cubo, toro, engrenagem).
- Stage Preview 3D completo e navegável: Fase 12 do 3.0.
- O guia de calibração do espectador (como medir a posição real do ponto de vista) ainda não foi escrito.


## Atualização de 15/10/2026: Sala montável, objetos com GIF, ângulo de visão e barra de Projeto

Pedido do Lucas: tornar o 3D mais intuitivo (empurrar uma parede para o fundo, montar sala com laterais e chão, colocar GIF em vez de só esfera, ver de cima).

**Feito e testado (Chromium com swiftshader, Node):**
- Preset novo **room-builder** ("Sala"): cinco paredes ligáveis (fundo, esquerda, direita, chão, teto), cor por parede, recuo das laterais, chão e teto, fundo na profundidade do parâmetro `depth` (animável).
- Editor por vista de cima e de lado: arrastar fundo, laterais, chão, teto e objetos. A mudança vai junto para a ilusão já aplicada na timeline (com Desfazer).
- Mídia (GIF ou imagem) em cada parede e em objetos. Objetos mantêm a proporção, têm transparência (PNG e GIF) e opção de flutuar.
- No Mac a imagem é lida pelo app (`read-image`, só extensões de imagem, até 60 MB) e vira blob, porque o WebGL bloqueia `file://` como textura.
- Validação com lista fechada: `javascript:` e `data:text/html` descartados, no máximo 12 objetos, números limitados.
- Controles de ângulo: botões De frente, Um pouco de cima e De cima, slider de inclinação da prévia e slider de altura do olho do público.
- Barra de Projeto no topo do painel, em todas as abas (Novo, Abrir, Salvar, Desfazer, Refazer). Rola junto com o painel, para não roubar altura do cabeçalho fixo.
- Correção provável da tremedeira do painel 3D: o texto de status mudava a cada quadro e empurrava os controles. Agora atualiza a cada 0,6 s com altura fixa.
- Testes: `t23` (19), `illusion-core` (115, 10 novos), t16 e t17 atualizados para 8 presets.

**Não validado:**
- GIF animado de verdade: o Chromium sem tela não avança os quadros do GIF. Foi testado que o app reenvia o quadro atual para a textura enquanto o GIF existe (e uma vez só para PNG), mas a animação visual depende do navegador do Mac e não foi vista.
- Nada em projetor, cubo real, GPU do Mac ou iOS. A tremedeira: a causa é uma hipótese, não foi reproduzida no Mac.
- Vídeo como textura: não implementado.
- Atualização automática: continua desligada até o `owner` do GitHub em `package.json` ser preenchido.
