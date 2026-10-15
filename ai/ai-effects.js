// Biblioteca nativa de efeitos do AI Director. Código próprio, sem GLSL de terceiros, sem rede.
// Serve de base confiável e de fallback quando um shader gerado falha.
// Contrato: cada efeito recebe g {ctx,W,H,t,k,p1,p2,c1,c2,pal}. p1 = progresso 0..1, p2 = intensidade 0..2.
// Tudo é função do tempo e do progresso (determinístico): o mesmo quadro sempre sai igual.
(function (root) {
  'use strict';
  var T = root.Textures;
  if (!T || !T.register) return;
  var u = T.util, TAU = Math.PI * 2;
  function rgb(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + Math.max(0, Math.min(1, a)) + ')'; }
  function glowLine(ctx, pts, col, w, a) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = rgb(col, a * 0.25); ctx.lineWidth = w * 4; strokePts(ctx, pts);
    ctx.strokeStyle = rgb(col, a * 0.6); ctx.lineWidth = w * 2; strokePts(ctx, pts);
    ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(1, a) + ')'; ctx.lineWidth = Math.max(1, w * 0.6); strokePts(ctx, pts);
  }
  function strokePts(ctx, pts) { ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke(); }

  // Rachaduras luminosas que crescem a partir do centro conforme p1.
  function cracks(g) {
    var ctx = g.ctx, W = g.W, H = g.H, R = Math.hypot(W, H) * 0.55, n = 9, i, j, a;
    var grow = g.p1, inten = 0.5 + 0.5 * g.p2;
    for (i = 0; i < n; i++) {
      var ang = (i / n) * TAU + u.h2(i, 7) * 0.6, len = R * (0.45 + 0.55 * u.h2(i, 3)) * grow, x = W / 2 + (u.h2(i, 5) - 0.5) * W * 0.2, y = H / 2 + (u.h2(i, 9) - 0.5) * H * 0.2;
      var pts = [[x, y]], steps = 14;
      for (j = 1; j <= steps; j++) {
        if (j / steps > 1) break;
        a = ang + (u.h2(i * 31 + j, 11) - 0.5) * 0.9;
        x += Math.cos(a) * len / steps; y += Math.sin(a) * len / steps; pts.push([x, y]);
        if (j === 6 || j === 10) { // ramo
          var b = a + (u.h2(i, j) > 0.5 ? 0.7 : -0.7), bx = x, by = y, bp = [[bx, by]];
          for (var q = 0; q < 4; q++) { bx += Math.cos(b + (u.h2(q, i) - 0.5) * 0.6) * len / steps; by += Math.sin(b) * len / steps; bp.push([bx, by]); }
          glowLine(ctx, bp, g.c1, 1.4, inten * 0.8);
        }
      }
      glowLine(ctx, pts, g.c1, 2.2, inten);
    }
  }
  // Brilho pulsante vindo do centro (olhos, núcleo, destaque).
  function glow(g) {
    var ctx = g.ctx, W = g.W, H = g.H, pulse = 0.75 + 0.25 * Math.sin(g.t * 3), r = Math.min(W, H) * (0.25 + 0.35 * g.p1) * pulse;
    var gr = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, r * 1.6);
    gr.addColorStop(0, rgb([255, 255, 255], 0.9 * Math.min(1, g.p2))); gr.addColorStop(0.25, rgb(g.c1, 0.75 * Math.min(1, g.p2))); gr.addColorStop(1, rgb(g.c1, 0));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  // Transformação em ouro: uma faixa de luz varre a superfície e deixa metal dourado atrás (p1 = quanto já virou ouro).
  function gold(g) {
    var ctx = g.ctx, W = g.W, H = g.H, cov = g.p1, diag = W + H, edge = (cov * (diag + 300)) - 150;
    var gr = ctx.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#7a5300'); gr.addColorStop(0.3, '#e8b923'); gr.addColorStop(0.5, '#fff3b0'); gr.addColorStop(0.7, '#d99a12'); gr.addColorStop(1, '#6b4700');
    ctx.save();
    // varredura em diagonal: tudo que está antes da frente de luz vira ouro
    var mx = edge * (W / diag), my = edge * (H / diag);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(mx + 150 * (W / diag), 0); ctx.lineTo(0, my + 150 * (H / diag)); ctx.lineTo(0, 0); ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = Math.min(1, 0.85 * g.p2); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.25 * g.p2;
    for (var i = 0; i < 40; i++) { var x = u.h2(i, 1) * W, y = u.h2(i, 2) * H, tw = 0.5 + 0.5 * Math.sin(g.t * 2 + i); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 2 + 3 * tw, 2 + 3 * tw); }
    ctx.restore();
    var fl = ctx.createLinearGradient(mx - 60, my - 60, mx + 60, my + 60); // frente de luz
    fl.addColorStop(0, 'rgba(255,240,160,0)'); fl.addColorStop(0.5, 'rgba(255,250,210,' + (0.9 * Math.min(1, g.p2) * (cov > 0 && cov < 1 ? 1 : 0)) + ')'); fl.addColorStop(1, 'rgba(255,240,160,0)');
    ctx.fillStyle = fl; ctx.fillRect(0, 0, W, H);
  }
  // Linhas neon que percorrem a superfície (circuito).
  function neonLines(g) {
    var ctx = g.ctx, W = g.W, H = g.H, n = 7, i, inten = Math.min(1, 0.4 + 0.6 * g.p2);
    for (i = 0; i < n; i++) {
      var y = (i + 0.5) / n * H, ph = (g.t * 0.35 + u.h2(i, 4)) % 1, x0 = ph * (W + 400) - 200, len = 260 + 140 * u.h2(i, 6);
      var pts = [[x0 - len, y], [x0 - len * 0.45, y], [x0 - len * 0.35, y + (u.h2(i, 8) > 0.5 ? 18 : -18)], [x0, y + (u.h2(i, 8) > 0.5 ? 18 : -18)]];
      glowLine(ctx, pts, i % 2 ? g.c1 : g.c2, 2, inten * g.p1);
    }
  }
  // Oceano digital: ondas com cristas luminosas.
  function ocean(g) {
    var ctx = g.ctx, W = g.W, H = g.H, i, x;
    for (i = 0; i < 6; i++) {
      var pts = [], base = H * (0.25 + 0.14 * i);
      for (x = 0; x <= W; x += 10) pts.push([x, base + Math.sin(x * 0.01 + g.t * 1.6 + i * 1.1) * H * 0.05 * (0.6 + 0.4 * Math.sin(g.t * 0.7 + i))]);
      glowLine(ctx, pts, i % 2 ? g.c1 : g.c2, 1.6, (0.35 + 0.4 * g.p2) * g.p1);
    }
  }
  // Partículas de luz subindo.
  function particles(g) {
    var ctx = g.ctx, W = g.W, H = g.H, n = Math.round(60 * Math.min(2, g.p2 + 0.3)), i;
    for (i = 0; i < n; i++) {
      var sp = 0.04 + 0.1 * u.h2(i, 2), ph = (g.t * sp + u.h2(i, 1)) % 1, x = u.h2(i, 3) * W + Math.sin(g.t + i) * 20, y = H * (1 - ph), a = Math.sin(ph * Math.PI) * g.p1, r = 2 + 4 * u.h2(i, 5);
      var gr = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      gr.addColorStop(0, rgb([255, 255, 255], a)); gr.addColorStop(0.4, rgb(g.c1, a * 0.7)); gr.addColorStop(1, rgb(g.c1, 0));
      ctx.fillStyle = gr; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    }
  }
  // Núcleo de energia: anéis que irradiam do centro.
  function energyCore(g) {
    var ctx = g.ctx, W = g.W, H = g.H, i, R = Math.min(W, H) * 0.5;
    var gr = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R * 0.5);
    gr.addColorStop(0, rgb([255, 255, 255], 0.95 * g.p1)); gr.addColorStop(1, rgb(g.c1, 0)); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    for (i = 0; i < 4; i++) {
      var ph = (g.t * 0.4 + i / 4) % 1;
      ctx.strokeStyle = rgb(g.c2, (1 - ph) * 0.8 * Math.min(1, g.p2) * g.p1); ctx.lineWidth = 3 + 6 * (1 - ph);
      ctx.beginPath(); ctx.arc(W / 2, H / 2, ph * R, 0, TAU); ctx.stroke();
    }
  }
  // Glitch: faixas deslocadas coloridas.
  function glitch(g) {
    var ctx = g.ctx, W = g.W, H = g.H, i, fr = Math.floor(g.t * 12);
    for (i = 0; i < 12; i++) {
      if (u.h2(fr, i) > 0.35 * g.p2) continue;
      var y = u.h2(fr, i + 50) * H, h = 6 + u.h2(fr, i + 90) * H * 0.08, dx = (u.h2(fr, i + 120) - 0.5) * W * 0.2;
      ctx.fillStyle = rgb(i % 2 ? g.c1 : g.c2, 0.55 * g.p1); ctx.fillRect(dx, y, W, h);
    }
  }
  // Explosão de luz (p1 = tempo da explosão, 0 = início).
  function burst(g) {
    var ctx = g.ctx, W = g.W, H = g.H, R = Math.hypot(W, H) * 0.7 * g.p1, a = (1 - g.p1) * Math.min(1, g.p2);
    var gr = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(1, R));
    gr.addColorStop(0, rgb([255, 255, 255], a)); gr.addColorStop(0.5, rgb(g.c1, a * 0.8)); gr.addColorStop(1, rgb(g.c1, 0));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < 24; i++) { var ang = i / 24 * TAU, r0 = R * 0.2, r1 = R; glowLine(ctx, [[W / 2 + Math.cos(ang) * r0, H / 2 + Math.sin(ang) * r0], [W / 2 + Math.cos(ang) * r1, H / 2 + Math.sin(ang) * r1]], g.c2, 1.5, a * 0.8); }
  }
  // Pulso: a superfície toda acende conforme p2 (usado para piscar no ritmo).
  function pulse(g) {
    var ctx = g.ctx; ctx.fillStyle = rgb(g.c1, Math.min(1, g.p2 * g.p1)); ctx.fillRect(0, 0, g.W, g.H);
  }
  var LIB = [
    ['ai-cracks', 'Rachaduras luminosas', cracks, ['rach', 'rachadura', 'rachaduras', 'crack', 'quebr', 'fissura']],
    ['ai-glow', 'Brilho', glow, ['brilh', 'glow', 'olhos', 'luz suave', 'acende']],
    ['ai-gold', 'Transformação em ouro', gold, ['ouro', 'dourad', 'gold', 'golden']],
    ['ai-neon-lines', 'Linhas neon', neonLines, ['neon', 'linhas', 'circuito', 'circuit']],
    ['ai-ocean', 'Oceano digital', ocean, ['oceano', 'ondas', 'onda', 'agua', 'água', 'water', 'ocean', 'wave']],
    ['ai-particles', 'Partículas de luz', particles, ['particula', 'partícula', 'particle', 'fagulha', 'brasas']],
    ['ai-energy-core', 'Núcleo de energia', energyCore, ['energia', 'energy', 'nucleo', 'núcleo', 'core']],
    ['ai-glitch', 'Glitch', glitch, ['glitch', 'falha digital', 'defeito']],
    ['ai-burst', 'Explosão de luz', burst, ['explos', 'burst', 'estoura', 'explode']],
    ['ai-pulse', 'Pulso no ritmo', pulse, ['pisc', 'pulso', 'ritmo', 'batida', 'strobe', 'flash']]
  ];
  var info = {};
  LIB.forEach(function (e) { T.register(e[0], e[1], 'IA', e[2]); info[e[0]] = { id: e[0], name: e[1], words: e[3] }; });
  root.AiEffects = { ids: LIB.map(function (e) { return e[0]; }), info: info, has: function (id) { return !!info[id]; } };
  if (typeof module !== 'undefined') module.exports = root.AiEffects;
})(typeof window !== 'undefined' ? window : globalThis);
