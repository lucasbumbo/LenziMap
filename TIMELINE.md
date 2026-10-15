# LenziMap: Timeline (manual, esquema, testes e limites)

## Como usar (resumo)
1. Aba **Timeline** no painel > **Ligar timeline**. A barra da timeline aparece embaixo.
2. **Faixa p/ cada face** cria uma faixa de vídeo para cada superfície (ligada pela chave estável `surfaceId`).
3. Arraste mídias da Galeria ou use importar. Vídeo, imagem, GIF, efeito, texto, câmera e áudio viram clipes.
4. Edite: arrastar para mover, bordas para aparar, **S** divide no cursor, **Cmd+C/V/X/D** copia, cola, corta, duplica, **Delete** apaga, **M** marcador, **I/O** entrada e saída do loop, **K** keyframe, setas movem o cursor, **Home/End**, **+/-** zoom, **Espaço** play/pause.
5. Selecione um clipe: o **Inspetor** (aba Timeline) mostra Transform, Distort (4 cantos do conteúdo), Crop, opacidade, fades, velocidade, loop do clipe, ganho de áudio e keyframes (linear ou hold). No Viewer aparece uma barra: **Calibração | Transformar | Distorcer | Cortar | trava**. Ao clicar num clipe a barra entra em modo clipe.

### Viewer (estilo Final Cut)
- **Transformar** (Shift+T): arrastar dentro move (com ímã no centro e nas bordas da face; Alt desliga o ímã). Cantos escalam proporcionalmente. Lados mudam só largura ou só altura. A bolinha acima gira: quanto mais longe do centro, mais fino o ajuste; Shift trava em passos de 15 graus.
- **Distorcer** (Shift+D): 4 cantos independentes do conteúdo.
- **Cortar** (Shift+C): bordas e cantos cortam o conteúdo.
- Setas movem o clipe 1 px, Shift+seta 10 px.
- Nenhuma ferramenta mexe na calibração (`surface.q`, máscara, malha). Clique fora do clipe e botão direito também não.
- Limites: o ponto de âncora fica no centro do quadro (não dá para mover), Mesh Warp é aproximado, corte não tem keyframe. NÃO TESTADO em Mac, projetor ou tela de toque.
6. **Travar calibração** impede qualquer edição dos 4 cantos físicos (`q`) das superfícies.
7. Salvar projeto guarda a sequência junto (arquivo `.mapa`, versão 4). O autosave também.

## Camadas empilhadas por face (estilo Final Cut)
Cada face pode ter quantas faixas de vídeo (camadas) quiser, sem limite. No cabeçalho da faixa: **＋** cria uma camada nova logo acima, **▲ ▼** sobem e descem a camada, o selo **C1, C2...** mostra a posição (C1 é a base). **A faixa que fica em cima na lista aparece por cima na projeção**, como no Final Cut. A ordem vale igual na prévia e na saída e entra no desfazer e no salvar. A interface só avisa quando passa de 4 camadas, porque cada vídeo tocando ao mesmo tempo decodifica mais um arquivo e pode pesar. Não mudou o esquema (continua schema 1): a camada é só uma faixa de vídeo com a mesma `surfaceId`.
Ainda não existe: modo de mistura (blend) entre camadas, nem grupos de cubos.

## Modelo de tempo
Segundos (número decimal). FPS só serve para exibir timecode e para o snap. Keyframes usam segundos dentro de UM ciclo do clipe, então o loop do clipe repete as animações.

## Relógio mestre
Uma referência única `{sid, ver, t0, ref, rate, playing, duration, loop}`. Cada janela calcula `t = t0 + (agora - ref) * rate`. O painel envia o transporte à saída pelo canal IPC `transport` (e no iOS por mensagem `__tr`), com reenvio de 1 s enquanto toca. `sid` e `ver` descartam mensagens atrasadas. Nenhuma janela depende do próprio requestAnimationFrame como fonte de verdade. Vídeo e áudio seguem o relógio com correção (ajuste fino de velocidade acima de 40 ms de desvio, salto acima de 300 ms).

## Esquema (schema 1)
```
sequence { schema, id, name, duration, fps, tracks[], markers[], assets[], settings{snap, loop{on,in,out}, showGridIdle, audioOffset(ms), sink} }
track    { id, type: video|audio, surfaceId, name, enabled, muted, solo, locked, order, clips[] }
clip     { id, assetId, start, duration, inPoint, outPoint, loopMode: none|loop, speed, opacity, fadeIn, fadeOut,
           transform{x,y,scale,rot,opacity,corners[4][2]}, crop, keyframes{prop:[{t,v,interp}]}, audioGain }
```
Projeto `.mapa` versão 4: `{version:4, tlOn, sequence, scenes}`. Cenas, superfícies, `q`, máscaras e `extras[]` continuam iguais; cada superfície ganha uma `key` estável.

## Migração (não destrutiva)
Projetos versão 3 ou anteriores (sem `sequence`) abrem com a timeline desligada e projetam exatamente como antes. Cenas NÃO são convertidas em faixas automaticamente. Um projeto com `schema` maior que o conhecido abre e é marcado como mais novo (campos desconhecidos não são apagados na leitura).

## Calibração x criação
`q` (calibração física) nunca é alterado por keyframes, Distort ou transform de clipe. A transformação do clipe é aplicada ao conteúdo, dentro da superfície.

## Testes executados (neste ambiente de desenvolvimento)
- Unitários (Node): 72 PASS (esquema, migração, edição, keyframes, avaliador, relógio).
- Playwright/Chromium com painel e saída ligados por IPC simulado:
  - 12 superfícies, 12 faixas, clipes em 0, 2, 5 e 10 s: mesmas faces ativas na prévia e na saída em 3,25 s; vídeo em 1,25 s nos dois; `q` intacto.
  - Interface: mover, aparar, dividir, desfazer/refazer, marcador, copiar/colar/apagar, Espaço, Home, tempo digitado, loop.
  - Salvar, Novo, Abrir, recarregar (autosave): sequência idêntica, keyframes, loop, trilhas e calibração preservados. Projeto v3 abre como antes.
  - Keyframes linear e hold; Distort com 4 cantos mudando matrix3d sem tocar `q`.
  - Áudio: música e sfx tocam só na janela de controle, saída sem áudio; 20 play/pause rápidos terminam pausados; mídia ausente, vídeo corrompido, clipes sobrepostos e saída desconectada sem erro de JavaScript.
- jsdom (regressão de recursos antigos): 67 PASS.

## Medidas reais (sandbox de teste: 2 CPUs, render por software, vídeo VP9)
| Cenário | Resultado |
|---|---|
| 1 face com vídeo | 21 a 24 fps, erro de vídeo ~15 ms |
| 3 faces | 10 a 12 fps, erro médio 40 a 45 ms, p95 44 a 86 ms |
| 12 faces com vídeo | 1,5 a 3,6 fps, desvio grande e muitos saltos (limite de CPU deste ambiente) |
| Áudio (música, regime estável) | desvio médio ~0,06 s, máximo ~0,13 s |
| Pré e saída | mesmo tempo dentro de 0,15 s (0 ms após pausa) |
Esses números NÃO representam um Mac real com decodificação H.264 por hardware. Não afirmamos precisão de quadro. Meça no seu Mac.

## Limitações conhecidas
- Nunca testado: Electron real, compilação Swift/iOS, projetor real, câmera, gravação de tela, MIDI, H.264 e desempenho em Mac e iPhone reais.
- Modo malha (mesh): o transform do clipe vira aproximação afim, sem perspectiva.
- GIFs rodam livres (sem seek preciso).
- Com muitos vídeos grandes ao mesmo tempo o desempenho depende do hardware.
- Interpolação de keyframes: linear e hold (curvas suaves só no código, sem interface).
- Teste de sincronia de áudio: indicativo; latência de Bluetooth não é compensada automaticamente (use o ajuste em ms).

## Melhorias futuras
Curvas de easing na interface, transições entre clipes, vários níveis de zoom vertical, exportação de vídeo da sequência, importar EDL/FCPXML, compensação automática de latência, cache de proxy de vídeo para 12 faces.

## AI Director (3.1)

A aba "IA" cria faixas e clipes normais na timeline. Cada camada gerada tem keyframes `p1` (progresso do efeito) e `p2` (intensidade), que aparecem junto com os demais e podem ser editados à mão. As faixas se chamam "IA · nome" e ficam acima das camadas existentes da mesma face. Veja LENZIMAP_3.1_AI_DIRECTOR_IMPLEMENTATION_REPORT.md.
