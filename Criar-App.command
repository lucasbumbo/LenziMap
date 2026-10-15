#!/bin/bash
# Cria o aplicativo LenziMap.app (e um instalador .dmg) para este Mac.
cd "$(dirname "$0")" || exit 1

if ! command -v npm >/dev/null 2>&1; then
  echo "Não achei o Node.js neste Mac. Instale em https://nodejs.org (versão LTS) e abra este arquivo de novo."
  read -r -p "Aperte Enter pra fechar."
  exit 1
fi

echo "Instalando o que precisa (só demora na primeira vez)..."
npm install || { echo "A instalação falhou."; read -r -p "Aperte Enter pra fechar."; exit 1; }

echo "Criando o app. Pode levar alguns minutos..."
npm run dist || { echo "Não consegui criar o app. Mande o texto acima que eu ajudo."; read -r -p "Aperte Enter pra fechar."; exit 1; }

echo
echo "Pronto. Abrindo a pasta dist: arraste LenziMap para Aplicativos."
echo "Na primeira abertura, clique com o botão direito no LenziMap e escolha Abrir (o app não é assinado pela Apple)."
open dist
