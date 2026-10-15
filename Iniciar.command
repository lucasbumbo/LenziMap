#!/bin/bash
# Abre o LenziMap. Na primeira vez, baixa o que precisa (precisa de internet).
cd "$(dirname "$0")" || exit 1

if ! command -v npm >/dev/null 2>&1; then
  echo "Não achei o Node.js neste Mac."
  echo "Instale em https://nodejs.org (versão LTS), feche esta janela e abra este arquivo de novo."
  read -r -p "Aperte Enter pra fechar."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Primeira vez: instalando. Pode levar alguns minutos."
  npm install || { echo "A instalação falhou."; read -r -p "Aperte Enter pra fechar."; exit 1; }
fi

npm start
