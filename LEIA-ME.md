# LenziMap (app de Mac)

Projection mapping com GIF, vídeo, foto e texto. Sem marca d'água. Você escolhe qual monitor recebe a imagem, como no MadMapper.

## Como abrir

1. Instale o Node.js em https://nodejs.org (versão LTS). Só na primeira vez.
2. Descompacte esta pasta.
3. Dê dois cliques em `Iniciar.command`.
   - Se o Mac não deixar abrir, clique com o botão direito no arquivo, escolha Abrir e confirme.
   - Na primeira vez ele baixa o que precisa. Precisa de internet e leva alguns minutos.

Se preferir o Terminal: entre na pasta, rode `npm install` e depois `npm start`.

## Como usar

O app trabalha com **superfícies**. Uma superfície é só a área onde a imagem cai (4 cantos e máscara). Ela começa vazia. Tudo o que você quer projetar entra **dentro** dela.

1. Em Ajustes do Sistema, Telas, deixe o monitor da HDMI como tela estendida.
2. Em Conteúdo da superfície, adicione mídia (foto, GIF, vídeo), texto, efeito ou o padrão de teste. Pode colocar vários itens na mesma superfície. Se não houver superfície, o app cria uma.
3. Use Nova superfície para criar outras áreas (cada uma com seus cantos).
4. Arraste os 4 cantos até a parede. Arraste por dentro pra mover. Botão direito e arrastar gira (Shift de 15 em 15 graus; no trackpad, Ctrl + clique).
5. No modo Máscara, arraste os pontos pra recortar. Toque duas vezes na área pra criar um ponto e duas vezes num ponto pra apagar.
6. Em Saída, escolha o monitor e clique em Enviar pra tela. Esc na tela de saída fecha.
7. **Novo, Abrir, Salvar, Desfazer e Refazer** ficam numa barra no topo do painel, em todas as abas (ela rola junto com o painel). Salvar guarda tudo. As mídias continuam nos lugares de origem, então não mova nem apague os arquivos.

## Formatos

GIF, PNG, JPG, WebP, MP4 (H.264), M4V, MOV (H.264) e WebM.
Vídeos MOV em ProRes ou HEVC podem não tocar. Se não tocar, exporte em MP4 H.264.

## Hierarquia (como no Canva)

Dentro de uma superfície, o item de cima fica na frente do de baixo. A lista mostra o de cima primeiro.

- **Ordem:** arraste os itens na lista para mudar a ordem. Também tem as setas, Para frente e Para trás. Vale igual para a lista de superfícies.
- **Cobrir o que está abaixo:** pinta de preto o fundo do item. Aí o que está embaixo some atrás dele, em vez de aparecer misturado. Mídia nova já entra com isso ligado. Texto e efeito entram desligados, para poder sobrepor.
- **Mistura:** por item você escolhe Normal (cobre), Somar luz, Subtrair luz ou Diferença.
- **Cobrir superfícies abaixo:** o mesmo, mas para a superfície inteira, quando duas superfícies se sobrepõem.

Lembrete: no projetor, preto é "sem luz". Cobrir com preto apaga a área, e não mostra a parede de cor.

## Galeria

Fica no painel, logo abaixo de Conteúdo da superfície. Reúne tudo num lugar só:

- **77 animações originais** geradas por código, sendo 43 no estilo dos visuais mais virais da internet (cromo líquido, óleo iridescente, mercúrio, fogo, relâmpagos, chuva digital estilo Matrix, sol retrô, túnel hexagonal, fogos de artifício, confete, bolhas, laser show, galáxia, circuito, DNA, terreno wireframe, pulsar de linhas, eclipse, vórtice hipnótico, painel de LED, equalizador circular, batimento ECG e outras). As mais antigas: neon ( camadas onduladas, camadas arco-íris, tijolos de luz, listras, quadrados em túnel, jaula com gotas; e aurora, plasma, mármore líquido, nebulosa, synthwave, hexágonos, radar, topográfico, caleidoscópio, bokeh, chuva, faíscas, glitch, VHS e outras), mais 7 efeitos básicos e a **Grade numerada** para calibrar.
- **33 clipes em loop (MP4) e 5 GIFs** na pasta `biblioteca` do app, todos renderizados das animações, sem direitos autorais.
- **Pacote extra de vídeos:** o arquivo `LenziMap-Biblioteca-Extra.zip` traz 86 clipes MP4 em loop (cada animação nova em 2 paletas de cor) e 37 GIFs. Descompacte, clique em Escolher minha pasta e aponte para ela. Tudo aparece em Meus arquivos.
- **Meus arquivos:** clique em Escolher minha pasta para trazer os seus GIFs, vídeos e fotos. O app lembra a pasta. Também dá para jogar arquivos na pasta `biblioteca` e clicar em Atualizar.

Use as abas (Favoritos, Tudo, Líquidos, Elementos, Hipnóticas, Festa, Música, Tecnologia, Espaço, Neon, Orgânicas, Geométricas, Partículas, Retrô, Calibração, Clipes, Meus arquivos) e a busca por nome. A estrela guarda o item nos Favoritos. Clique num item para colocar dentro da superfície selecionada. Passe o mouse para ver animando. No item você muda cor, cor 2, velocidade e escala.

## Novidades do LenziMap

Escolhidas depois de comparar o que os apps mais usados oferecem (MadMapper, Resolume, HeavyM, Lazy Lighting). Veja `PESQUISA-E-PONTUACAO.md`.

- **Galeria** com abas, busca e favoritos (acima).
- **Formas prontas:** em Superfície selecionada, escolha círculo, triângulo, losango, pentágono, hexágono, estrela, coração, seta ou cruz. A forma vira a máscara e você ainda pode ajustar os pontos.
- **Cor e efeitos por superfície:** saturação, matiz, ciclo de cores (a cor gira sozinha), desfoque, inverter cores e preto e branco.
- **Reação ao som:** em Som, clique em Ligar microfone (o Mac pede permissão). Em cada superfície, aumente Reação ao som e escolha se o som mexe no brilho ou na opacidade. Ele acompanha os graves. A Sensibilidade ajusta para o ambiente.
- **Trocar cenas sozinho:** em Cenas, ligue e escolha o tempo (3 a 30 segundos).
- **Grade numerada:** na aba Calibração. Coloque dentro de uma superfície e alinhe os cantos pelas células e pelo círculo.

## Ímã nos cantos

Ao arrastar um canto, ele gruda nas bordas da tela e nos cantos das outras superfícies (para encostar duas superfícies sem fresta). Segure **Alt** para soltar, ou desligue em Ímã nos cantos.

## Malha (superfícies curvas ou tortas)

Em Superfície selecionada, clique em **Malha**. Aparece uma grade de pontos em cima da superfície. Arraste cada ponto para encaixar a imagem em colunas, cantos arredondados, cilindros e paredes irregulares. Escolha a quantidade de pontos (2 x 2 até 8 x 8) e use Redefinir malha para voltar ao reto. Desligar malha volta ao modo normal de 4 cantos. Mover, girar e espelhar continuam funcionando (girar leva a deformação junto); a máscara também.

A malha usa a placa de vídeo (WebGL). Se o Mac não conseguir usar WebGL, a superfície continua no modo de 4 cantos.

## Forma a partir de uma foto

Em Superfícies, clique em **Forma a partir de uma foto**. Escolha uma foto do objeto, da porta, da janela ou da parede (no Mac, uma foto do iPhone que você passou por AirDrop serve). O app acha o contorno sozinho e mostra em rosa. Ajuste a **Sensibilidade** ou use **Inverter** se o objeto for mais claro que o fundo. Depois clique em **Criar superfície com essa forma**: nasce uma superfície com a máscara no formato do objeto. Coloque o conteúdo dentro dela e arraste os cantos até o objeto real.

Funciona melhor com o objeto de cor bem diferente do fundo e a foto tirada de frente.

## Câmera ao vivo

Em Conteúdo da superfície, **+ Câmera ao vivo** coloca a câmera do aparelho dentro da superfície (o Mac pede permissão na primeira vez). Funciona com forma, máscara, malha, cor e efeitos como qualquer item.

## Gravar a saída

Com a saída aberta, clique em **Gravar saída**. Ao parar, escolha onde salvar. Gera MP4 quando o app consegue, ou WebM. Na primeira vez, o Mac pede para liberar **Gravação de Tela** para o LenziMap (Ajustes do Sistema, Privacidade e Segurança). Depois de liberar, feche e abra o app. Se o arquivo for WebM e o QuickTime não abrir, use o VLC ou converta em um editor.

## Cenas em sequência

Em Cenas, ligue **Trocar cenas sozinho** e escolha o tempo padrão. Cada cena pode ter o seu próprio tempo em **Esta cena dura**. É uma sequência simples, não uma linha do tempo completa.

## Criar o aplicativo (LenziMap.app)

Dê dois cliques em `Criar-App.command`. Ele cria o `LenziMap.app` e um instalador `.dmg` na pasta `dist`. Arraste o LenziMap para Aplicativos e abra como qualquer app. Na primeira abertura, clique com o botão direito e escolha Abrir, porque o app não é assinado pela Apple. Se o Mac disser que o app está danificado, abra o Terminal e rode `xattr -cr /Applications/LenziMap.app`. Precisa de internet e leva alguns minutos.

## Novidades da versão 2

- Olho liga e desliga sem apagar, tanto nas superfícies quanto nos itens. Cadeado trava a superfície, Solo mostra só ela.
- Duplicar e renomear superfícies. A proporção da superfície (16:9, 9:16, 1:1...) muda no painel; ao colocar a primeira mídia numa superfície nova, ela adota a proporção da mídia.
- Desfazer e refazer (Cmd+Z e Shift+Cmd+Z).
- Cenas: cada cena tem suas layers. Troca com fade pelas teclas 1 a 9.
- Brilho geral da saída e Blackout (tecla B).
- Efeitos gerados no app, sem arquivo: grade, scan, gradiente, ruído, estrobo, contorno neon e ondas.
- Texto animado (piscar, digitar, rolar), com contorno, sombra, alinhamento e 7 fontes.
- Por layer: espelhar, brilho, contraste, modo de mistura Screen e velocidade do vídeo.
- Girar: botão Girar mídia 90° (vira o conteúdo dentro da camada) e Girar camada ↺ ↻ (gira a camada inteira de 15 em 15 graus, com Shift de 90 em 90).
- Giro manual: o controle "Girar camada (manual)" funciona como um botão de ajuste. Arraste pra um lado e a camada gira junto; ao soltar, ele volta ao centro e você pode arrastar de novo. Os botões ↺ 1° e ↻ 1° dão o ajuste fino.
- Girar com o mouse: clique com o botão direito dentro da layer e arraste. Ela gira em volta do centro. Com Shift, gira de 15 em 15 graus. No trackpad, use Ctrl + clique e arraste.
- Itens dentro da superfície: cada item tem olho, ordem (sobe e desce), opacidade e encaixe (esticar, preencher ou inteiro). Vídeo tem velocidade. Texto e efeito têm todos os ajustes.
- Projetos antigos (.mapa) abrem normalmente: cada layer antiga vira uma superfície com o conteúdo dentro.

## Atalhos

- G mostra ou esconde as guias.
- B liga e desliga o blackout.
- 1 a 9 trocam de cena.
- Cmd+Z desfaz, Shift+Cmd+Z refaz.
- Setas movem a layer 1 px, com Shift 10 px.

## Cantos arredondados e modo Transformar

- **Cantos arredondados:** na superfície selecionada, o controle Cantos arredondados vai de 0 a 50%. Funciona em Cantos, Máscara e Malha, e acompanha a perspectiva.
- **Transformar (estilo Canva):** os cantos brancos mudam o tamanho mantendo a proporção. Alt escala a partir do centro. As pílulas laterais esticam só um lado. A bolinha de cima gira (Shift gira de 15 em 15 graus). Arrastar por dentro move.

## Painel em abas, barra flutuante e gaveta no iPhone

- O painel tem as abas Camadas, Galeria, Ajustes, Timeline, IA, 3D, Árvore, Cenas e Saída. O app lembra a última aba usada. A linha de status fica sempre visível no topo.
- **Barra flutuante:** aparece acima da superfície selecionada com Duplicar, Espelhar (horizontal e vertical), Girar 90°, Travar e Apagar.
- **iPhone e iPad em pé:** o painel é uma gaveta inferior. Arraste a alça para deixar fechada (só as abas), no meio ou cheia. Tocar numa aba abre a gaveta.

## Mais melhorias de uso

- **Miniatura na lista de superfícies:** cada superfície mostra uma prévia do conteúdo.
- **Posição e tamanho em números:** na aba Ajustes, X, Y, Largura, Altura e Ângulo, em pixels da tela de saída. Digite e aperte Enter.
- **Menu de clique direito:** clique com o botão direito numa superfície, sem arrastar, para duplicar, espelhar, girar, trazer para a frente, enviar para trás, travar ou apagar. Arrastar com o botão direito continua girando.
- **Atalhos:** C Cantos, V Transformar, M Máscara, N Malha, L Travar, Delete Apagar, Cmd+D Duplicar. Aperte ? para ver todos.
- **Ao vivo:** o botão vermelho Ao vivo esconde as guias e mostra botões grandes de cena, anterior, próxima, blackout, enviar pra tela e brilho.
- **Primeiro uso:** um guia de 4 passos aparece na primeira vez. Dá para rever em ? e Ver o passo a passo.

## Novidades (rodada 3)
- **Borda suave**: esmaece as bordas da superfície (útil pra fundir projeções lado a lado). Funciona em Cantos e em Malha.
- **Movimento**: Flutuar, Pulsar, Balançar, Girar, Tremer, Órbita e Pular na batida (reage ao microfone). Em Ajustes, escolha o movimento e a força. Vale pra superfície inteira, com a perspectiva mantida.
- **Toque o tempo**: em Cenas, toque o botão (ou a tecla T) no ritmo da música. O LenziMap calcula o BPM e ajusta o tempo de troca automática para N batidas.
- **MIDI**: em Saída, Controle MIDI. Notas a partir de C2 trocam de cena, o knob CC 7 ou CC 1 controla o brilho geral, e você pode ensinar teclas para Próxima, Anterior, Blackout e Brilho. Só no Mac (no iPhone o MIDI web não existe).

## Novidades (rodada 4)
- **Buscar tudo (Cmd+K)**: digite e ache qualquer ação, aba, cena, look ou efeito. Enter executa.
- **Looks prontos** (Ajustes): Cinema, Neon, Sonho, Vívido, Sombrio, Preto e branco, Negativo, Arco-íris, Fantasma. Um clique, e desfaz com Cmd+Z.
- **Surpreenda-me** (Galeria): escolhe um efeito e uma cor ao acaso e coloca na superfície.
- **Recentes** na Galeria, e contagem de itens em cada categoria.
- **Flash e Strobe** (Ao vivo): Flash branco enquanto você segura o botão, Strobe a 2, 4 ou 8 Hz. O Flash e o Strobe aparecem na saída do projetor (a prévia do painel não pisca, de propósito). Cuidado: luz piscando pode fazer mal a pessoas sensíveis.
- **50 efeitos novos** (agora 127 no total): Synthwave, Glitch RGB, Hiperespaço, Holofotes de show, Câmera térmica, Explosões, Olho hipnótico, Cometas, Tornado, Bolhas de sabão, Serpentinas, Barras de TV, Equalizador de barras, Radar HUD, Moiré e mais. Categorias novas: Natureza, Glitch, Abstratas.

## Grade neon de alinhamento
Toda superfície nova já começa com uma grade branca neon (como nos apps de referência). Arraste os cantos até a grade encaixar no objeto (parede, caixa, fachada). Quando você colocar qualquer conteúdo (mídia, texto, efeito), a grade some sozinha. Para voltar a ela a qualquer hora, use Galeria, Calibração, Grade neon de alinhamento (ou Cmd+K e digite "grade"). Os Layouts prontos também criam as superfícies com a grade, cada uma com uma cor de brilho diferente para você distinguir.


## Timeline
Veja TIMELINE.md (manual rápido, esquema, migração, testes e limitações).


## 3D: montar a sala (novo)

Na aba **3D**, o primeiro cartão é **Sala (montar paredes)**. A face do cubo vira uma janela para dentro:

1. Em **Alvo**, escolha o cubo e as faces e ligue cada face a uma superfície (ou use Ligar superfícies na ordem).
2. Em **Montar a sala**, ligue ou desligue **Fundo, Parede esquerda, Parede direita, Chão e Teto** e escolha a cor de cada um.
3. Na vista **de cima** ou **de lado**, arraste a linha do fundo para empurrá-lo para trás ou para frente, e as laterais, o chão e o teto para dentro. A profundidade do fundo é o parâmetro Profundidade, então aceita keyframe na Timeline.
4. Em cada parede, escolha uma **imagem ou GIF** (da biblioteca do projeto ou **Escolher arquivo**). Fica como textura da parede.
5. Em **Objetos com GIF ou imagem**, clique em **+ Objeto** e escolha um GIF (um bichinho com fundo transparente funciona bem). Arraste o ponto dele na vista para posicioná-lo. Ele fica sempre virado para a frente da face.
6. Aperte **Aplicar na Timeline**. Daí em diante, tudo que você mexer vai junto.

**Ver de cima:** em **Câmera e visualização**, os botões De frente, Um pouco de cima e De cima inclinam a prévia do palco. Isso só muda o que você vê no painel. A perspectiva real nos cubos muda com a **Altura do olho do público** (mesma seção) e com o Assistente do espectador.

**Limites desta versão:** vídeo ainda não funciona como textura no 3D (só GIF e imagem). Em iPhone e iPad a imagem entra pelo endereço direto, não foi testada. Se uma imagem não carregar, o painel avisa em Objetos.


## 1.0.1: face de cima na ilusão 3D
A face de cima é vista de raspão pelo público e o interior quase não aparecia (a ilusão piscava). Agora, no painel 3D, a opção "Face de cima: mostrar inteira" vem ligada: a face é desenhada como se o público estivesse a ~50 graus acima dela. Desligue para voltar ao cálculo exato. Não testado em projetor nem em cubos reais.

## 1.0.2: ligação de faces
- Uma superfície agora só fica ligada a uma face. Se você escolher uma superfície que já estava em outra face, ela sai da outra (antes as duas desenhavam no mesmo lugar e a ilusão aparecia errada).
- O painel 3D avisa quando a mesma superfície está em duas faces (projetos antigos) e quando uma face marcada não pode ser vista do ponto de vista do público (fica vazia). Nesse caso, mude o Olho X, Y ou Z do público ou gire o cubo.
- A lista de superfícies nas faces atualiza sozinha quando você cria ou apaga superfícies com o painel já aberto.

## 1.0.3: paredes em 3 passos (modo fácil)
Na aba **3D** agora abre direto o modo fácil:
1. **Escolha a face do cubo**: clique em Frente, Direita, Trás, Esquerda ou Topo. Se a face não tem tela, o app liga uma superfície livre sozinho. Dá para trocar a tela no seletor logo abaixo.
2. **Empurre o fundo**: o controle Distância do fundo (ou arraste o fundo na vista de cima).
3. **Paredes e objetos**: marque Fundo, Parede esquerda, Parede direita, Chão e Teto, escolha cor e imagem ou GIF de cada uma, e adicione objetos (um bichinho em GIF, por exemplo).
Depois, **Aplicar na Timeline**. Os tipos de ilusão, câmera, luz e geometria do palco ficam em **Mostrar opções avançadas** (no fim do painel). A escolha fica guardada.
