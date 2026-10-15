# LenziMap: Atualização automática (macOS / Electron)

Estado: implementado e testado em Linux (Electron real, electron-updater real, dois pacotes reais).
NÃO TESTADO: Mac real, assinatura Developer ID, notarização, Squirrel.Mac, GitHub Releases real, projetor.

## 1. Resumo para decidir

O app agora verifica sozinho, em segundo plano, se existe versão nova no GitHub Releases. Mostra um cartão discreto no canto da janela de controle, baixa com barra de progresso, confere o checksum e só reinicia quando o Lucas clicar. Nunca age com a janela de saída (projeção) aberta. Também existe Help > Check for Updates.

Dois fatos que mudam o plano e que não dá para contornar:

1. **No macOS a instalação automática só funciona com app assinado por um Apple Developer ID.** O mecanismo do macOS (Squirrel.Mac) recusa atualizar app sem assinatura válida. Sem o plano de desenvolvedor da Apple (US$ 99 por ano), o app entra no "modo aviso": detecta a versão nova e abre a página da release no GitHub para baixar o .dmg. O código decide isso sozinho (lê a assinatura do próprio app), sem desligar nenhuma proteção do macOS.
2. **A primeira instalação com atualizador é manual.** Quem já tem a versão atual (sem atualizador) precisa instalar uma vez o novo .dmg. Dali em diante recebe tudo pelo app.

## 2. Arquivos

Criados:
- `updater-core.js`: máquina de estados pura (sem Electron). Regras de segurança, projeção, versões, erros.
- `updater.js`: liga o núcleo ao Electron e ao electron-updater, menu, IPC, detecção de assinatura, backup antes de instalar.
- `updater-ui.js`: cartão de interface (só aparece no app de Mac; no iOS e no navegador não faz nada).
- `migrate-data.js`: versão dos dados, cópia de segurança e migrações versionadas (hoje nenhuma é necessária).
- `dev-app-update.yml`: só para testes em modo desenvolvimento (não vai no app final).
- `build/entitlements.mac.plist`: permissões do hardened runtime (microfone, câmera, JIT do Electron).
- `.github/workflows/release.yml`: testes, build, assinatura, notarização e release em rascunho.
- `scripts/check-release.js`: barreira antes de publicar (tag = versão, repositório configurado).
- `tests/updater-core.js`, `tests/electron-update.js`, `tests/electron-real-update.js`.

Modificados:
- `main.js`: menu da aplicação (File, Edit, View, Window, Help) com "Check for Updates...", inicia o atualizador sem bloquear a abertura, avisa quando a saída abre ou fecha.
- `preload.js`: expõe `window.api.updater` (state, check, download, install, later, onState).
- `control.html`: carrega `updater-ui.js`.
- `package.json`: versão do electron-updater, alvos dmg + zip (universal), `publish` do GitHub (rascunho), hardened runtime, scripts `dist` e `release`.
- iOS: `build-www.js` remove a tag do updater (o iOS usa a App Store ou TestFlight, fora deste escopo).

Não foram alterados: renderer, Sequence Clock, Sequence Player, timeline, calibração, Mesh Warp, cenas, áudio, MIDI, formato de projeto `.mapa`.

## 3. Dependências

- `electron-updater` ^6.8.9 (dependência de produção, instalada com `npm install`).
- `electron` e `electron-builder` já existiam.
- O `Criar-App.command` continua funcionando para quem quiser gerar o app local (sem publicar).

## 4. Como o atualizador funciona

Fluxo: abrir o app → 15 segundos depois, verificação silenciosa (assíncrona, nunca atrasa a abertura) → se houver versão mais nova, aparece "LenziMap X.Y.Z is available." com **Later** e **Update Now** → "Downloading update..." com barra e porcentagem → "Update ready to install." com **Install Later** e **Restart and Install** → o app reinicia na versão nova. Repete a cada 6 horas e no máximo uma verificação automática a cada 4 horas.

Mensagens exatas implementadas: available, "Downloading update...", "Update ready to install.", "You're running the latest version of LenziMap.", "Unable to check for updates. Please try again later."

Regras de projeção (definição: projeção em andamento = janela de saída aberta):
- Verificação automática é adiada; roda 10 s depois que a saída fecha.
- Nenhum cartão aparece enquanto a saída está aberta.
- Download recusado com a saída aberta.
- "Restart and Install" recusado com a saída aberta (a janela de saída nunca é fechada pelo atualizador).
- O app nunca reinicia sem o clique, e `autoInstallOnAppQuit` está desligado (nada instala ao fechar).
- Offline ou GitHub fora do ar: verificação automática falha em silêncio; o app abre e funciona normal. Só a verificação manual mostra o erro.
- "Later" esconde o cartão; a atualização baixada continua pronta e volta a aparecer em Help > Check for Updates.

Segurança:
- Download por HTTPS do GitHub Releases; o `latest-mac.yml` traz o sha512 do arquivo e o electron-updater recusa arquivo que não confere (testado).
- No Mac, o macOS ainda valida a assinatura do pacote novo (Squirrel.Mac). Nada de Gatekeeper ou verificação desligada.
- Recusa versão igual, menor (downgrade), inválida ou pré-lançamento (beta) quando o app instalado é estável.
- `allowDowngrade` e `allowPrerelease` desligados. Releases em rascunho nunca chegam aos usuários.
- Nenhuma credencial no código. O endereço de teste (`LENZIMAP_UPDATE_URL`) só funciona fora do app empacotado.
- Falha ou queda no download: erro amigável e nova tentativa depois; arquivo parcial não vira "pronto".

## 5. Preservação de projetos e configurações

Onde ficam os dados:
- Autosave, favoritos, mapeamento MIDI, abas, pasta de biblioteca: `localStorage` do Electron em `~/Library/Application Support/LenziMap/` (fora do .app).
- Projetos `.mapa` e mídias: onde o Lucas salvou (fora do app).
- Biblioteca de animações que acompanha o app: dentro do app, é substituída por versões novas (são arquivos do produto, não do usuário).

Atualizar substitui só o `.app`. Para garantir, antes de instalar o atualizador copia `Local Storage`, `IndexedDB`, `Preferences` e `Session Storage` para `backups/pre-update-<de>-to-<para>-<data>` e, ao abrir uma versão diferente da anterior, faz outra cópia `pre-<de>-to-<para>` e roda as migrações versionadas (hoje nenhuma, porque o formato do projeto é compatível desde a 1.0.0). Mantém as 3 cópias mais recentes. Importante: não mudar `appId` (`com.llfilms.lenzimap`) nem `productName`, senão o macOS passa a usar outra pasta de dados.

## 6. Testes

Todos com Node, Chromium e Electron em Linux. Última execução completa: regressão geral 188 verificações sem falha (inclui 31 do núcleo do atualizador), smoke do Electron 12 sem falha, teste do atualizador no Electron real 31 sem falha, e o teste de duas versões empacotadas sem falha.

| Cenário | Como foi testado | Resultado |
|---|---|---|
| 1 Sem atualização | núcleo + Electron real + servidor local | passou |
| 2 Versão nova | idem, incluindo botões Later / Update Now | passou |
| 3 Download com progresso | electron-updater real, arquivo verificado por sha512 | passou |
| 4 Instalar após confirmação | núcleo; real em dois pacotes AppImage 1.0.0 para 1.1.0 | passou |
| 5 Adiar | cartão some, download fica pronto | passou |
| 6 Falha de conexão | servidor devolvendo 503 e porta fechada | passou |
| 7 Download interrompido | servidor corta a conexão no meio; nova tentativa funciona | passou |
| 8 Arquivo inválido | checksum diferente: recusado, nunca fica "pronto" | passou |
| 9 Projetos preservados | dados na pasta de dados e nas cópias de segurança | passou |
| 10 Configurações preservadas | localStorage intacto durante o ciclo e depois da troca de versão | passou |
| 11 Offline | app inteiro funcionando, erro só na verificação manual | passou |
| 12 Projeção em andamento | com saída real aberta: sem download, instalação recusada, saída continua aberta | passou |

Atualização real entre duas versões empacotadas: `tests/electron-real-update.js` gera o app 1.0.0 e 1.1.0 como AppImage (Linux), serve a 1.1.0 num servidor local, o app 1.0.0 detecta, baixa, instala no clique, o arquivo é substituído, o app reabre sozinho em 1.1.0 e os dados ficam. **Isso valida a lógica e o electron-updater, não o macOS.**

NÃO TESTADO: instalação em .app no Mac, Squirrel.Mac, assinatura e notarização, GitHub Releases real, comportamento com projetor e segundo monitor físico, o cartão em tela Retina.

## 7. Configuração necessária (o que falta)

### 7.1 GitHub
1. Criar um repositório (**tem que ser público**: o atualizador lê as releases sem login, então o repositório precisa ser **público**, ou use um repositório público só para as releases. Com repositório privado seria necessário colocar um token dentro do app, o que é inseguro e não foi feito).
2. Em `package.json`, em `build.publish`, JÁ FEITO: owner `lucasbumbo`, repo `LenziMap`. (Texto original: trocar `SEU_USUARIO_GITHUB` pelo seu usuário (ou organização) e conferir `repo`.
3. Enviar o projeto para o repositório (branch `main`).
4. Em Settings > Environments, criar o ambiente **release** e marcar "Required reviewers" com você mesmo. É a sua autorização antes de publicar.
5. Em Settings > Actions > General, deixar "Workflow permissions" em "Read repository contents" (o workflow já pede `contents: write` só no job de publicar).

### 7.2 Apple (para atualização automática de verdade)
1. Entrar no Apple Developer Program (US$ 99 por ano).
2. Criar o certificado **Developer ID Application** no site da Apple, baixar e instalar no Mac, exportar do Acesso às Chaves como `.p12` com senha.
3. Converter para texto: `base64 -i certificado.p12 | pbcopy` (e colar no secret).
4. Criar uma senha específica de app em appleid.apple.com (para a notarização).
5. Em Settings > Secrets and variables > Actions, criar: `CSC_LINK` (o texto base64 do .p12), `CSC_KEY_PASSWORD` (senha do .p12), `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. Nunca colocar nada disso no código nem no chat.

Sem os itens da seção 7.2 o workflow gera o app como arquivo de teste e **não publica**; o app instalado funciona em "modo aviso" (abre a página da release).

## 8. Como publicar uma nova versão

1. Claude (ou você) altera o código e roda `npm test`.
2. Aumentar a versão em `package.json` (por exemplo `1.0.0` para `1.0.1` ou `1.1.0`).
3. Commit e criar a tag igual à versão: `git tag v1.0.1 && git push origin main --tags`.
4. O GitHub Actions roda os testes, gera o app, assina, notariza e pede a sua aprovação no ambiente "release".
5. Depois de aprovado, cria uma release em **rascunho** com `.dmg`, `.zip` e `latest-mac.yml`.
6. Abrir a release no GitHub, conferir e clicar **Publish release**. Só então o app instalado enxerga a atualização.
7. Versões de teste: tag com sufixo (`v1.1.0-beta.1`) e marcar como pré-lançamento; os apps estáveis ignoram.

Builds de branch e pull request nunca são publicados.

## 9. Como testar a primeira atualização real (no Mac)

1. Publicar a versão **1.0.0** completa (passos de 7 e 8) e instalar o `.dmg` no Mac, arrastando para Aplicativos.
2. Abrir o app, criar um projeto e salvar um `.mapa`. Deixar alguma configuração (MIDI, favoritos).
3. Publicar **1.0.1** (passo 8). Não precisa mudar nada além da versão para o teste.
4. Abrir o LenziMap 1.0.0: em até 15 segundos deve aparecer "LenziMap 1.0.1 is available." Ou usar Help > Check for Updates.
5. Update Now, esperar a barra, Restart and Install. O app deve abrir na 1.0.1 (menu LenziMap > About mostra a versão), com o projeto e as configurações no lugar.
6. Teste de projeção: abrir a janela de saída e usar Help > Check for Updates; a instalação deve ser recusada até fechar a saída.
7. Se algo der errado, o log fica em `~/Library/Application Support/LenziMap/logs/updater.log` e as cópias dos dados em `backups/`.

Teste de duas versões no Linux (já executado): gerar dois AppImages com `electron-builder --linux AppImage -c.extraMetadata.version=1.0.0` e `1.1.0` com `publish` genérico apontando para `http://127.0.0.1:8899/`, e rodar `xvfb-run -a node tests/electron-real-update.js`.

## 10. Limites conhecidos

- Sem Developer ID, nada de instalação automática no Mac (modo aviso).
- Repositório precisa ser público (ou usar outro canal de distribuição).
- O app é universal (Intel e Apple Silicon), o que deixa o arquivo maior. Se preferir só Apple Silicon, trocar `arch` em `package.json`.
- Não há botão para cancelar o download em andamento (fechar o app cancela; o arquivo parcial é descartado).
- Atualizações delta (só a diferença) não foram configuradas.
- O iOS fica fora do escopo (App Store ou TestFlight).
