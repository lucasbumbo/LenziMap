(function () {
  'use strict';
  var stage = document.getElementById('stage');
  var rend = new Renderer(stage, null, { master: true });
  window.__rend = rend;
  var last = null;

  window.api.onState(function (s) {
    last = s;
    rend.sync(s);
  });
  if (window.api.onLevel) window.api.onLevel(function (v) { rend.setLevel(v); });
  // Transporte da timeline: a saída recebe a referência de tempo e calcula o próprio tempo a partir dela
  if (window.api.onTransport) window.api.onTransport(function (tr) { if (rend.player) rend.player.transport(tr); });
  window.addEventListener('resize', function () {
    if (last) rend.sync(last);
  });
  window.api.outputReady();
})();
