# Falhas encontradas e corrigidas nesta rodada

Como foi a auditoria: testei no Chromium (a mesma base do Electron) a malha contra o modo normal em 16 combinações de espelho e giro, rodei todas as animações em 6 tamanhos e 3 escalas, e li o código nativo do iPhone linha por linha.

**Corrigidas**
- **Clipes do app dentro do app de Mac empacotado:** o vídeo podia não tocar por estar dentro do pacote .asar. Agora os clipes ficam fora dele (asarUnpack) e o app aponta para o lugar certo.
- **Permissão do microfone ao abrir o app:** o Mac pedia o microfone logo na abertura, mesmo sem usar. Agora só pede quando você liga o microfone ou adiciona a câmera.
- **Câmera e microfone negados:** o app agora avisa o que fazer em vez de ficar parado.
- **Girar uma superfície com malha:** a deformação não girava junto. Agora gira.
- **Clicar numa superfície com malha:** só reagia dentro do retângulo original. Agora vale o contorno real da malha.
- **Animações da galeria:** ao trocar de aba com o mouse em cima de um cartão, uma animação ficava rodando escondida. Agora para.
- **iPhone, quando o plugin nativo falha:** a lista de telas e a biblioteca quebravam o painel inteiro. Agora o painel abre mesmo assim.

**Conferido e sem falha**
- Malha igual ao modo normal em todas as 16 combinações de espelho e giro, com máscara.
- Todas as animações, em tamanhos de 8 x 8 até 1600 x 1600, sem erro e abaixo de 45 ms por quadro no teste.
- Projetos antigos sem malha, sem campos de cor e sem tempo de cena abrem normalmente.

**Limites que continuam**
- Não consegui rodar o app Electron num Mac nem o código nativo num iPhone. A gravação de tela e a tela externa do iPhone são as partes de maior risco.
- A malha usa pontos de controle com triângulos. Em deformações muito fortes pode aparecer um leve efeito de dobra na diagonal. Use 6 x 6 ou 8 x 8 nesses casos.
- A sequência de cenas não é uma linha do tempo completa.
