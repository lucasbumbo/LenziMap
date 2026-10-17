#!/bin/bash
# Roda o E2E do projeto no Electron (nao empacotado e, se existir, empacotado). Guarda evidencia e frames.
cd "$(dirname "$0")/.."
EV=lenzi-ai/evidencias; mkdir -p $EV; : > $EV/e2e-ultimo.txt; ok=0
echo "== Electron (codigo-fonte)" | tee -a $EV/e2e-ultimo.txt
OUT=$EV/frames-fonte xvfb-run -a node tests/electron-e2e-projeto.js 2>&1 | tee -a $EV/e2e-ultimo.txt | tail -3; [ ${PIPESTATUS[0]} = 0 ] || ok=1
if [ -n "$PACKAGED_BIN" ] && [ -x "$PACKAGED_BIN" ]; then
  echo "== Electron (empacotado)" | tee -a $EV/e2e-ultimo.txt
  ELECTRON_BIN=$PACKAGED_BIN PACKAGED=1 OUT=$EV/frames-empacotado xvfb-run -a node tests/electron-e2e-projeto.js 2>&1 | tee -a $EV/e2e-ultimo.txt | tail -3; [ ${PIPESTATUS[0]} = 0 ] || ok=1
else echo "empacotado: PULADO (defina PACKAGED_BIN)" | tee -a $EV/e2e-ultimo.txt; fi
exit $ok
