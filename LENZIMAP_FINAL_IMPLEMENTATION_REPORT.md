# LenziMap: relatório de implementação (parcial, interrompido por limite de uso)

Este é um relatório honesto do estado no momento em que a execução foi interrompida a pedido, por causa do limite de uso. A ordem "Finalização 3.0 + 3.2" NÃO foi concluída. As Fases 10 a 15 e o item 12 (projeto demo dos 4 cubos) não foram começados.

Ambiente de teste: Chromium com swiftshader, jsdom, Node e Electron 33 em Linux (Xvfb). NADA foi testado em projetor real, GPU de Mac ou iPhone/iPad.

## 1. Implementado e testado (em Chromium/Node, não em hardware real)
- Pendências do 3.2 (IA para ilusões, assistente de ponto de vista, empacotamento, compatibilidade de projetos): testes ai-illusion, package-check, t17, t18.
- Fase 6, aba Árvore (hierarquia Biblioteca, Projeto, Cena, Grupo, Cubo, Face, Camada, Clipe), arrastar e soltar, seleção múltipla, propriedades compartilhadas, Undo/Redo, salvar/reabrir: hierarchy-core e t19. Arrastar e soltar foi testado com eventos sintéticos, não com o arrasto real.
- Fase 7, clipes conectados e compostos: o filho acompanha o principal (arrastar, setas, campo Início), linhas visuais, ⌘G cria composto, abrir/fechar, separar, duplicar, faixa travada nunca anda, tempo sempre absoluto: compound-core e t20 (30 verificações).
- Fase 8, Viewer avançado: âncora ajustável com compensação (o conteúdo não pula), espelho H/V, Resetar, controles numéricos, grade, réguas, áreas seguras, terços, guias (criar, arrastar, apagar, criar da régua, ímã), trajetória de keyframes com pontos editáveis, corte animável, saída externa idêntica ao Viewer, salvar/reabrir, projeto antigo abre, calibração (surface.q) intacta mesmo com calibração travada: viewer-core e t21.
- Regressões de testes antigos corrigidas: t13 (pincel), t7 (versão 5 e ordem de chaves), t9 (barra do Viewer).

## 2. Implementado, mas não validado em hardware real
- Tudo acima roda em Chromium de teste. Falta validar no Mac (GPU), no projetor (alinhamento real dos cubos) e no iPhone/iPad.
- Efeitos por filtro SVG (Fase 9 parcial) podem pesar em tela cheia na GPU real. Não foi medido.
- Em iOS, o filtro no canvas (superfícies com Mesh Warp) e alguns filtros SVG em vídeo podem não funcionar. Não foi testado.
- IA real (provedor externo): teste "ai-real" fica PENDENTE por falta de chave.

## 3. Parcial
- Fase 9 (efeitos): existe o motor (effects-core.js, effects-dom.js), a pilha de efeitos por clipe (Glow, Blur, Pixelate, Chromatic Aberration, Displacement, Glitch, Noise, Strobe) com intensidade animável por keyframe, as mesclagens Normal, Add, Screen, Multiply e Overlay, a seção "Efeitos e mesclagem" no Inspetor, e a aplicação no Viewer e na saída externa (testes effects-core e t22). FALTA a aba "Efeitos" (navegador com busca e categorias), o botão que cria camada de partículas ou outros geradores existentes a partir do catálogo, e o uso pelo AI Director da pilha nova. Hoje o efeito é adicionado por código ou pelos dados do projeto; o botão provisório "+ Adicionar efeito" foi removido do Inspetor até a aba existir. Os geradores (Particles, Glitch, Noise, Strobe) já existem na Galeria como antes.
- Composto (Fase 7) é um grupo, não um bloco único recolhido, e não há composto dentro de composto.
- Aviso de versão do palco só aparece pelo cartão de compatibilidade.

## 4. Pendente (não começado)
- Fase 10 (color grading), 11 (animação entre superfícies), 12 (Stage Preview 3D com texturas por face e visões), 13 (áudio: ondas, volume por clipe, fades, mute/solo, marcadores de batida), 14 (workspaces e polimento), 15 (diagnósticos e desempenho).
- Item 12: projeto demo com 4 cubos (A 16 pol, B, C, D 8 pol) e as 7 cenas de ilusão, mais o roteiro de teste físico no projetor.
- Reconstrução dos pacotes finais já foi feita no estado atual (ver abaixo), mas os testes do Electron (smoke, update, ai) não foram reexecutados depois da Fase 7.

## Testes
Veja PROGRESSO_E_PENDENCIAS.md. A bateria completa é tests/run-all.sh. Última regressão completa verde: depois da Fase 7. Depois da Fase 8 e do início da Fase 9, a regressão completa rodou até o t16 sem falhas além de duas expectativas do t9 que já foram corrigidas; a rodada final está registrada em tests/ultima-regressao.log se terminou.
