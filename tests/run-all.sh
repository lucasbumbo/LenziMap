#!/bin/bash
# Roda toda a bateria automatizada (Node + Playwright + jsdom). Uso: bash tests/run-all.sh
cd "$(dirname "$0")"
fail=0
for t in unit updater-core layout-core media-core keyframe-core timeline-edit-core ai-core ai-provider ai-illusion ai-real package-check hierarchy-core compound-core viewer-core effects-core illusion-core illusion-gl illusion-timeline smoke t2 t6 t7 t8 t9 t10 t11 t12 t13 t14 t15 t16 t17 t18 t19 t20 t21 t22 t23 t24 t25 t26 t27 t28 t29 t30 t31 t32 t33 t34 t35 t36 t37 t38; do
  echo "=== $t"
  out=$(timeout 280 node $t.js 2>&1); echo "$out" | grep -E "^(PASS|FAIL)|ok$" | sed 's/^/  /' | awk '/FAIL/{f=1} {print} END{exit f}' || fail=1
  echo "$out" | grep -q FAIL && fail=1
done
[ $fail = 0 ] && echo "TUDO OK" || echo "HA FALHAS"
exit $fail
