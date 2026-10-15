// Biblioteca extra 2: mais 42 animações originais (aurora, synthwave, glitch, neve, hiperespaço, radar, malha de cor e mais).
// Tudo é gerado por código na hora. Nada é baixado, nada tem direitos autorais de terceiros.
(function (root) {
  'use strict';
  var X = root.Textures;
  if (!X || !X.register) return;
  var U = X.util, TAU = U.TAU, h1 = U.h1, h2 = U.h2, vn = U.vnoise, fbm = U.fbm, cl = U.clamp01, sm = U.smooth, mix = U.mix, rgba = U.rgba, shade = U.shade;
  function R(id, name, cat, fn) { X.register(id, name, cat, fn); }
  function bg(g, a) { g.ctx.fillStyle = rgba(mix(g.c1, [0, 0, 0], a == null ? 0.94 : a), 1); g.ctx.fillRect(0, 0, g.W, g.H); }
  function hueCol(g, dh, s, l) { var hs = U.toHsl(g.c1); return U.fromHsl(hs[0] + dh, s, l, [0, 0, 0]); }
  function glowOn(ctx, c, b) { ctx.shadowColor = rgba(c, 1); ctx.shadowBlur = b; }
  function glowOff(ctx) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
  function put(o, c) { o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; }

  // ================= Natureza =================
  R('oceano', 'Oceano', 'Natureza', function (g) {
    var t = g.t * 0.6, k = g.k, c = [0, 0, 0];
    shade(g, 170, 96, function (u, v, o) {
      var y = v * 2.2 * k, w = 0, i;
      for (i = 0; i < 4; i++) w += Math.sin(u * (3 + i * 2.3) * k + t * (0.8 + i * 0.35) + i * 1.7 + y * 1.2) * (0.5 / (i + 1));
      var h = y + w * 0.35, line = Math.pow(0.5 + 0.5 * Math.sin(h * 9 - t * 1.2), 6);
      g.pal(0.15 + 0.6 * (0.5 + 0.5 * Math.sin(h * 3.1 - t * 0.3)), c);
      o[0] = c[0] * (0.55 + 0.45 * v) + line * 120; o[1] = c[1] * (0.55 + 0.45 * v) + line * 120; o[2] = c[2] * (0.55 + 0.45 * v) + line * 120;
    });
  });

  R('petalas', 'Pétalas ao vento', 'Natureza', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, N = Math.round(60 * g.k), i, pc = mix(g.c2, [255, 255, 255], 0.35);
    bg(g, 0.93);
    for (i = 0; i < N; i++) {
      var z = 0.4 + 0.6 * h1(i + 3), sp = 0.07 + 0.07 * z, ph = (h1(i) + t * sp) % 1.2, x = ((h1(i + 20) * 1.3 - 0.15 + ph * 0.55) % 1.2 - 0.1) * W, y = (ph - 0.1) * H + Math.sin(t * 1.3 + i) * 20 * S;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * (0.8 + h1(i + 9)) + i); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(t * 1.5 + i)));
      ctx.fillStyle = rgba(mix(g.c1, pc, h1(i + 7)), 0.9); ctx.beginPath();
      var s = (10 + 10 * z) * S; ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.9, -s * 0.2, 0, s); ctx.quadraticCurveTo(-s * 0.9, -s * 0.2, 0, -s); ctx.fill(); ctx.restore();
    }
  });

  R('vagalumes', 'Vagalumes', 'Natureza', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, N = Math.round(46 * g.k), i;
    bg(g, 0.96); ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < N; i++) {
      var x = (0.5 + 0.48 * Math.sin(t * (0.15 + h1(i) * 0.25) + i * 3.1) * Math.cos(t * 0.07 + i)) * W, y = (0.5 + 0.45 * Math.cos(t * (0.12 + h1(i + 5) * 0.25) + i * 1.7)) * H;
      var b = Math.pow(0.5 + 0.5 * Math.sin(t * (1 + h1(i + 8) * 2) + i * 5), 2), r = (8 + 22 * h1(i + 3)) * S;
      var gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(mix(g.c2, [255, 255, 255], 0.5), b)); gr.addColorStop(1, rgba(g.c1, 0));
      ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  R('ripple', 'Ondas de gota', 'Líquidos', function (g) {
    var t = g.t * 0.7, k = g.k, asp = g.W / g.H, c = [0, 0, 0], N = 6, px = [], py = [], pt = [], i;
    for (i = 0; i < N; i++) { var cyc = Math.floor(t / 3 + i * 0.37), ph = (t / 3 + i * 0.37) - cyc; px.push(h1(cyc * 7 + i) * asp * 2 - asp); py.push(h1(cyc * 3 + i + 9) * 2 - 1); pt.push(ph * 3); }
    shade(g, 170, 96, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, h = 0, j, d, a;
      for (j = 0; j < N; j++) { d = Math.hypot(x - px[j], y - py[j]); a = pt[j]; h += Math.sin((d - a * 0.5) * 38 * k) * Math.exp(-Math.pow((d - a * 0.5) * 6, 2)) * Math.max(0, 1 - a / 3); }
      g.pal(0.3 + 0.3 * h + 0.25 * v, c);
      var hl = Math.pow(Math.max(0, h), 2) * 200;
      o[0] = c[0] + hl; o[1] = c[1] + hl; o[2] = c[2] + hl;
    });
  });

  R('lavalamp', 'Lâmpada de lava', 'Líquidos', function (g) {
    var t = g.t * 0.25, k = g.k, c = [0, 0, 0], N = 6, bx = [], by = [], br = [], i;
    for (i = 0; i < N; i++) { bx.push(0.5 + 0.28 * Math.sin(t * (0.6 + h1(i) * 0.5) + i * 2)); by.push(0.5 + 0.42 * Math.sin(t * (0.5 + h1(i + 4) * 0.7) + i * 1.3)); br.push((0.1 + 0.07 * h1(i + 8)) * k); }
    shade(g, 150, 96, function (u, v, o) {
      var f = 0, j, dx, dy;
      for (j = 0; j < N; j++) { dx = (u - bx[j]) * 0.75; dy = v - by[j]; f += br[j] * br[j] / (dx * dx + dy * dy + 1e-4); }
      var e = sm(0.9, 1.15, f), glow = Math.min(1, f * 0.35);
      g.pal(0.1 + 0.8 * glow, c);
      var dark = mix(g.c1, [0, 0, 0], 0.88);
      o[0] = dark[0] + (c[0] - dark[0]) * e + 30 * glow; o[1] = dark[1] + (c[1] - dark[1]) * e + 18 * glow; o[2] = dark[2] + (c[2] - dark[2]) * e;
    });
  });

  R('malhacor', 'Malha de gradiente', 'Abstratas', function (g) {
    var t = g.t * 0.35, k = g.k, asp = g.W / g.H, N = 5, px = [], py = [], cc = [], i;
    for (i = 0; i < N; i++) { px.push(0.5 + 0.45 * Math.sin(t * (0.5 + h1(i) * 0.6) + i * 2.4)); py.push(0.5 + 0.45 * Math.cos(t * (0.4 + h1(i + 3) * 0.6) + i * 1.9)); cc.push(g.pal(i / (N - 1), [0, 0, 0]).slice()); }
    shade(g, 130, 74, function (u, v, o) {
      var sw = 0, r = 0, gg = 0, b = 0, j, d, w;
      for (j = 0; j < N; j++) { d = Math.pow(u - px[j], 2) * asp + Math.pow(v - py[j], 2); w = 1 / (d * 9 * k + 0.02); sw += w; r += cc[j][0] * w; gg += cc[j][1] * w; b += cc[j][2] * w; }
      o[0] = r / sw; o[1] = gg / sw; o[2] = b / sw;
    });
  });

  R('hiperespaco', 'Hiperespaço', 'Espaço', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, N = Math.round(260 * g.k), i, cx = W / 2, cy = H / 2, R0 = Math.hypot(W, H) / 2;
    bg(g, 0.97); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (i = 0; i < N; i++) {
      var a = h1(i) * TAU, z = (h1(i + 50) + t * 0.45) % 1, r0 = z * z * R0, r1 = Math.min(R0 * 1.1, r0 + 8 * S + z * z * z * 160 * S);
      ctx.strokeStyle = rgba(mix(g.c1, [255, 255, 255], h1(i + 9) * 0.7), Math.min(1, z * 1.4)); ctx.lineWidth = (0.6 + 2.2 * z) * S;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  // ================= Retrô e Glitch =================
  R('synthwave', 'Pôr do sol synthwave', 'Retrô', function (g) {
    var t = g.t, k = g.k, c = [0, 0, 0], hz = 0.52;
    shade(g, 200, 112, function (u, v, o) {
      if (v < hz) {
        var sy = v / hz, sun = Math.hypot((u - 0.5) * 1.78, v - 0.3 * hz - 0.12), bandsMask = sy > 0.5 ? (Math.sin((sy - 0.5) * 60 - t * 1.5) > -0.2 + (sy - 0.5) * 1.6 ? 1 : 0) : 1;
        var s = sun < 0.2 ? bandsMask : 0;
        g.pal(0.1 + 0.2 * sy, c); var sk = mix(mix(g.c1, [0, 0, 0], 0.85), mix(g.c2, [0, 0, 0], 0.4), sy * sy);
        var sc = g.pal(0.95 - sun * 2, [0, 0, 0]);
        o[0] = sk[0] * (1 - s) + sc[0] * s + Math.exp(-sun * 7) * 60; o[1] = sk[1] * (1 - s) + sc[1] * s + Math.exp(-sun * 7) * 20; o[2] = sk[2] * (1 - s) + sc[2] * s;
      } else {
        var d = (v - hz) / (1 - hz), z = 1 / (d + 0.03), x = (u - 0.5) * z * 3 * k, zz = z * 0.45 + t * 1.2 * k;
        var lx = sm(0.43, 0.5, Math.abs(((x % 1) + 1) % 1 - 0.5)), lz = sm(0.43, 0.5, Math.abs(((zz % 1) + 1) % 1 - 0.5));
        var gl = Math.max(lx, lz) * sm(0, 0.12, d), col = mix(mix(g.c1, [0, 0, 0], 0.9), g.pal(0.85, [0, 0, 0]), gl);
        put(o, col);
      }
    });
  });

  R('glitchrgb', 'Glitch RGB', 'Glitch', function (g) {
    var t = g.t, k = g.k, c = [0, 0, 0], fr = Math.floor(t * 9), c1 = [0, 0, 0];
    shade(g, 170, 96, function (u, v, o) {
      var row = Math.floor(v * 24), sh = h1(row * 7 + fr * 3) > 0.84 ? (h1(row + fr) - 0.5) * 0.35 : 0, uu = u + sh, base = 0.5 + 0.5 * Math.sin(uu * 6 * k + t) * Math.cos(v * 4 + t * 0.7);
      g.pal(0.2 + 0.6 * base, c);
      var rs = h1(row * 5 + fr) > 0.9 ? 0.02 : 0.004, r = 0.5 + 0.5 * Math.sin((uu + rs) * 6 * k + t) * Math.cos(v * 4 + t * 0.7), b = 0.5 + 0.5 * Math.sin((uu - rs) * 6 * k + t) * Math.cos(v * 4 + t * 0.7);
      var scan = 0.88 + 0.12 * Math.sin(v * 380);
      o[0] = (c[0] * 0.5 + r * 170) * scan; o[1] = c[1] * 0.7 * scan; o[2] = (c[2] * 0.5 + b * 170) * scan;
    });
  });

  R('glitchblocos', 'Blocos digitais', 'Glitch', function (g) {
    var t = g.t, fr = Math.floor(t * 8), c = [0, 0, 0], cols = 16 * Math.max(1, Math.round(g.k)), rows = 9 * Math.max(1, Math.round(g.k));
    shade(g, 160, 90, function (u, v, o) {
      var cx = Math.floor(u * cols), cy = Math.floor(v * rows), n = h2(cx + fr * 3.1, cy + fr * 1.7), on = n > 0.62;
      g.pal(h2(cx, cy + Math.floor(t * 2)), c);
      var dark = mix(g.c1, [0, 0, 0], 0.92), e = on ? 1 : 0.05;
      o[0] = dark[0] + (c[0] - dark[0]) * e; o[1] = dark[1] + (c[1] - dark[1]) * e; o[2] = dark[2] + (c[2] - dark[2]) * e;
    });
  });

  R('plasmaretro', 'Plasma retrô', 'Retrô', function (g) {
    var t = g.t * 0.7, k = g.k, c = [0, 0, 0];
    shade(g, 140, 80, function (u, v, o) {
      var x = u * 6 * k, y = v * 4 * k, f = Math.sin(x + t) + Math.sin(y * 1.3 - t * 1.2) + Math.sin((x + y) * 0.8 + t * 0.6) + Math.sin(Math.hypot(x - 3, y - 2) * 1.4 - t);
      g.pal(0.5 + 0.5 * Math.sin(f * 1.3), c); put(o, c);
    });
  });

  R('pontilhado', 'Pontilhado (halftone)', 'Retrô', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t * 0.6, S = H / 540, step = 22 * S / Math.max(0.5, g.k), cols = Math.ceil(W / step) + 1, rows = Math.ceil(H / step) + 1, i, j;
    ctx.fillStyle = rgba(mix(g.c1, [0, 0, 0], 0.9), 1); ctx.fillRect(0, 0, W, H);
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      var x = i * step, y = j * step, a = 0.5 + 0.5 * Math.sin(i * 0.35 + t * 1.4) * Math.cos(j * 0.3 - t) , r = step * 0.52 * (0.1 + 0.9 * a);
      ctx.fillStyle = rgba(g.pal((i + j) / (cols + rows) + t * 0.1, [0, 0, 0]), 1); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  });

  R('graofilme', 'Grão de filme', 'Retrô', function (g) {
    var t = g.t, k = g.k, fr = Math.floor(t * 18), c = [0, 0, 0];
    shade(g, 220, 124, function (u, v, o) {
      var n = h2(Math.floor(u * 220) + fr * 17.3, Math.floor(v * 124) + fr * 9.1), vig = 1 - 0.7 * Math.pow(Math.hypot(u - 0.5, v - 0.5) * 1.3, 2);
      g.pal(0.2 + 0.4 * v + 0.1 * Math.sin(t * 0.4), c);
      var f = (0.55 + (n - 0.5) * 0.7 * k) * vig;
      o[0] = c[0] * f * 0.9; o[1] = c[1] * f * 0.9; o[2] = c[2] * f * 0.9;
    });
  });

  R('barrastv', 'Barras de TV', 'Retrô', function (g) {
    var t = g.t, c = [0, 0, 0], cols = [[235, 235, 235], [235, 235, 16], [16, 235, 235], [16, 235, 16], [235, 16, 235], [235, 16, 16], [16, 16, 235]];
    shade(g, 140, 80, function (u, v, o) {
      var i = Math.floor(((u + t * 0.04) % 1) * 7), col = v < 0.7 ? cols[i] : (v < 0.82 ? cols[6 - i] : mix(g.c1, [0, 0, 0], 0.7)), sc = 0.9 + 0.1 * Math.sin(v * 200 + t * 20), roll = Math.exp(-Math.pow(((v + t * 0.35) % 1 - 0.5) * 9, 2)) * 40;
      o[0] = col[0] * sc + roll; o[1] = col[1] * sc + roll; o[2] = col[2] * sc + roll;
    });
  });

  R('tetris', 'Blocos caindo', 'Retrô', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, cs = 36 * S / Math.max(0.6, g.k), cols = Math.ceil(W / cs), i;
    bg(g, 0.94);
    for (i = 0; i < cols; i++) {
      var n = 3, j;
      for (j = 0; j < n; j++) {
        var sp = 0.5 + h1(i * 3 + j) * 1.1, y = ((t * sp * cs * 1.8 + h1(i + j * 17) * H * 2) % (H + cs * 3)) - cs;
        y = Math.floor(y / cs) * cs; ctx.fillStyle = rgba(g.pal(h1(i * 5 + j * 11), [0, 0, 0]), 0.95); ctx.fillRect(i * cs + 1, y + 1, cs - 2, cs - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(i * cs + 3, y + 3, cs - 6, 4 * S);
      }
    }
  });

  // ================= Hipnóticas e Geométricas =================
  R('moire', 'Moiré', 'Hipnóticas', function (g) {
    var t = g.t * 0.4, k = g.k, asp = g.W / g.H, c = [0, 0, 0];
    shade(g, 190, 108, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, d1 = Math.hypot(x - 0.25 * Math.sin(t), y - 0.2 * Math.cos(t * 0.8)), d2 = Math.hypot(x + 0.25 * Math.cos(t * 0.7), y + 0.2 * Math.sin(t));
      var f = 0.5 + 0.5 * Math.sin(d1 * 60 * k) * Math.sin(d2 * 60 * k);
      g.pal(f * 0.9, c); var s = sm(0.35, 0.65, f); o[0] = c[0] * s; o[1] = c[1] * s; o[2] = c[2] * s;
    });
  });

  R('xadrezonda', 'Xadrez ondulado', 'Hipnóticas', function (g) {
    var t = g.t * 0.7, k = g.k, asp = g.W / g.H, c = [0, 0, 0];
    shade(g, 190, 108, function (u, v, o) {
      var x = (u - 0.5) * asp * 2 * k * 3, y = (v - 0.5) * 2 * k * 3, wx = x + Math.sin(y * 1.3 + t) * 0.45, wy = y + Math.sin(x * 1.1 - t) * 0.45, ch = ((Math.floor(wx) + Math.floor(wy)) & 1);
      g.pal(0.15 + 0.7 * (0.5 + 0.5 * Math.sin(wx * 0.5 + wy * 0.4 + t * 0.5)), c);
      var s = ch ? 1 : 0.07; o[0] = c[0] * s; o[1] = c[1] * s; o[2] = c[2] * s;
    });
  });

  R('espiralcor', 'Espiral de cores', 'Hipnóticas', function (g) {
    var t = g.t * 0.5, k = g.k, asp = g.W / g.H, c = [0, 0, 0];
    shade(g, 190, 108, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, r = Math.hypot(x, y), a = Math.atan2(y, x), f = a / TAU * 3 * k + Math.log(r + 0.02) * 1.6 * k - t;
      g.pal(((f % 1) + 1) % 1, c); var s = 0.25 + 0.75 * sm(0, 0.12, Math.abs(((f % 1) + 1) % 1 - 0.5)) ; o[0] = c[0] * s; o[1] = c[1] * s; o[2] = c[2] * s;
    });
  });

  R('listrasop', 'Listras op-art', 'Hipnóticas', function (g) {
    var t = g.t * 0.6, k = g.k, asp = g.W / g.H, c = [0, 0, 0];
    shade(g, 190, 108, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, f = (x * 0.8 + y * 0.6) * 9 * k + Math.sin(y * 3 + t) * 1.2 + Math.sin(x * 2.5 - t) * 0.9 - t * 2;
      var s = sm(0.42, 0.58, Math.abs(((f % 1) + 1) % 1 - 0.5) * 2 - 0.0); g.pal(0.2 + 0.6 * (0.5 + 0.5 * Math.sin(f * 0.2)), c);
      var q = 0.04 + 0.96 * s; o[0] = c[0] * q; o[1] = c[1] * q; o[2] = c[2] * q;
    });
  });

  R('raiosol', 'Raios de sol', 'Geométricas', function (g) {
    var t = g.t * 0.3, k = g.k, asp = g.W / g.H, c = [0, 0, 0];
    shade(g, 190, 108, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, a = Math.atan2(y, x) + t, r = Math.hypot(x, y), s = sm(0.4, 0.6, 0.5 + 0.5 * Math.sin(a * 12 * k)), core = Math.exp(-r * 2.2);
      g.pal(0.15 + 0.8 * (1 - r * 0.5), c); var dark = mix(g.c1, [0, 0, 0], 0.88);
      o[0] = dark[0] + (c[0] - dark[0]) * (s * 0.8 + core); o[1] = dark[1] + (c[1] - dark[1]) * (s * 0.8 + core); o[2] = dark[2] + (c[2] - dark[2]) * (s * 0.8 + core);
    });
  });

  R('mosaicotri', 'Mosaico de triângulos', 'Geométricas', function (g) {
    var t = g.t * 0.5, k = g.k, asp = g.W / g.H, c = [0, 0, 0], n = 9 * k;
    shade(g, 190, 108, function (u, v, o) {
      var x = u * asp * n, y = v * n, row = Math.floor(y), fx = x + row * 0.5, col = Math.floor(fx), fu = fx - col, fv = y - row, up = fv > fu ? 0 : 1, id = col * 2 + up + row * 57;
      var f = 0.5 + 0.5 * Math.sin(t * (1 + h1(id) * 1.5) + h1(id + 3) * 6);
      g.pal(h1(id + 9) * 0.6 + 0.2 * Math.sin(t * 0.3), c); var e = 0.12 + 0.88 * f; o[0] = c[0] * e; o[1] = c[1] * e; o[2] = c[2] * e;
    });
  });

  R('colmeia', 'Bolinhas pulsantes', 'Geométricas', function (g) {
    var t = g.t * 0.8, k = g.k, asp = g.W / g.H, c = [0, 0, 0], n = 8 * k;
    shade(g, 190, 108, function (u, v, o) {
      var x = u * asp * n * 1.1547, y = v * n, r = 1.7320508, ax = (x % r + r) % r - r / 2, ay = (y % 1 + 1) % 1 - 0.5; // aproximação hexagonal em duas grades
      var bx = ((x + r / 2) % r + r) % r - r / 2, by = (((y + 0.5) % 1) + 1) % 1 - 0.5, d1 = Math.hypot(ax * 0.6, ay), d2 = Math.hypot(bx * 0.6, by), d = Math.min(d1, d2), id = d1 < d2 ? Math.floor(x / r) * 31 + Math.floor(y) : Math.floor((x + r / 2) / r) * 31 + Math.floor(y + 0.5) + 977;
      var pulse = 0.5 + 0.5 * Math.sin(t * 2 + h1(id) * 6.28), edge = sm(0.34, 0.26, d);
      g.pal(h1(id + 5) * 0.8, c); var e = (0.15 + 0.85 * pulse) * edge + 0.03; o[0] = c[0] * e; o[1] = c[1] * e; o[2] = c[2] * e;
    });
  });

  R('tunelaneis', 'Túnel de anéis', 'Hipnóticas', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, i, N = 18;
    bg(g, 0.96); ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < N; i++) {
      var z = ((i / N + t * 0.12) % 1), r = Math.pow(z, 2.2) * Math.hypot(W, H) * 0.6, cx = W / 2 + Math.sin(t * 0.6 + z * 3) * 40 * S * z, cy = H / 2 + Math.cos(t * 0.5 + z * 3) * 30 * S * z;
      ctx.strokeStyle = rgba(g.pal((i % 6) / 6, [0, 0, 0]), z); ctx.lineWidth = (1 + 7 * z) * S; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  R('quadradosneon', 'Quadrados girando neon', 'Neon', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, i, N = 16;
    bg(g, 0.96); ctx.globalCompositeOperation = 'lighter'; glowOn(ctx, g.c1, 10 * S);
    for (i = 0; i < N; i++) {
      var z = ((i / N + t * 0.1) % 1), s = Math.pow(z, 2.2) * Math.hypot(W, H) * 0.7;
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(z * 1.4 + t * 0.3); ctx.strokeStyle = rgba(g.pal(z, [0, 0, 0]), Math.min(1, z * 1.6)); ctx.lineWidth = (1 + 5 * z) * S; ctx.strokeRect(-s / 2, -s / 2, s, s); ctx.restore();
    }
    glowOff(ctx); ctx.globalCompositeOperation = 'source-over';
  });

  R('esferawire', 'Esfera de arame', 'Geométricas', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t * 0.5, S = H / 540, R0 = Math.min(W, H) * 0.34 * g.k, i, j;
    bg(g, 0.95); glowOn(ctx, g.c1, 8 * S); ctx.lineWidth = 1.6 * S; ctx.strokeStyle = rgba(mix(g.c1, [255, 255, 255], 0.25), 0.95);
    function P(lat, lon) { var x = Math.cos(lat) * Math.cos(lon + t), z = Math.cos(lat) * Math.sin(lon + t), y = Math.sin(lat), tl = 0.45, y2 = y * Math.cos(tl) - z * Math.sin(tl), z2 = y * Math.sin(tl) + z * Math.cos(tl); return [W / 2 + x * R0, H / 2 + y2 * R0, z2]; }
    for (i = -3; i <= 3; i++) { ctx.beginPath(); for (j = 0; j <= 48; j++) { var p = P(i * 0.38, j / 48 * TAU); j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke(); }
    for (i = 0; i < 12; i++) { ctx.beginPath(); for (j = 0; j <= 32; j++) { var q = P(-Math.PI / 2 + j / 32 * Math.PI, i / 12 * TAU); j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke(); }
    glowOff(ctx);
  });

  R('cubogiro', 'Cubo girando', 'Geométricas', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t * 0.6, S = H / 540, s = Math.min(W, H) * 0.26 * g.k, v = [], i;
    for (i = 0; i < 8; i++) { var x = (i & 1 ? 1 : -1), y = (i & 2 ? 1 : -1), z = (i & 4 ? 1 : -1); var x1 = x * Math.cos(t) - z * Math.sin(t), z1 = x * Math.sin(t) + z * Math.cos(t), y1 = y * Math.cos(t * 0.7) - z1 * Math.sin(t * 0.7), z2 = y * Math.sin(t * 0.7) + z1 * Math.cos(t * 0.7), f = 1 / (1 + z2 * 0.1); v.push([W / 2 + x1 * s * f, H / 2 + y1 * s * f]); }
    bg(g, 0.95); glowOn(ctx, g.c2, 10 * S); ctx.strokeStyle = rgba(mix(g.c2, [255, 255, 255], 0.3), 1); ctx.lineWidth = 2.4 * S; ctx.lineJoin = 'round';
    [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(function (e) { ctx.beginPath(); ctx.moveTo(v[e[0]][0], v[e[0]][1]); ctx.lineTo(v[e[1]][0], v[e[1]][1]); ctx.stroke(); });
    glowOff(ctx);
  });

  // ================= Neon e Música =================
  R('neonlinhas', 'Linhas de neon', 'Neon', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, i, x, N = 7;
    bg(g, 0.96); ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < N; i++) {
      ctx.strokeStyle = rgba(g.pal(i / N, [0, 0, 0]), 0.9); ctx.lineWidth = 3 * S; glowOn(ctx, g.pal(i / N, [0, 0, 0]), 16 * S); ctx.beginPath();
      for (x = 0; x <= W; x += 6) { var u = x / W, y = H * (0.5 + 0.28 * Math.sin(u * (3 + i * 0.5) * g.k + t * (0.8 + i * 0.12) + i) * Math.sin(u * 2 - t * 0.4 + i * 0.7)); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    glowOff(ctx); ctx.globalCompositeOperation = 'source-over';
  });

  R('chuvaneon', 'Chuva de neon', 'Neon', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, N = Math.round(90 * g.k), i;
    bg(g, 0.96); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (i = 0; i < N; i++) {
      var sp = 0.35 + h1(i + 4) * 0.7, y = (((h1(i) + t * sp) % 1.2) - 0.1) * H, x = h1(i + 30) * W, L = (40 + 120 * h1(i + 8)) * S, c = g.pal(h1(i + 12), [0, 0, 0]);
      var gr = ctx.createLinearGradient(x, y - L, x, y); gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(1, rgba(c, 1));
      ctx.strokeStyle = gr; ctx.lineWidth = (1.5 + 2 * h1(i + 2)) * S; ctx.beginPath(); ctx.moveTo(x, y - L); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  R('barraseq', 'Equalizador de barras', 'Música', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t * 1.4, S = H / 540, n = Math.round(32 * g.k), bw = W / n, i, j;
    bg(g, 0.95);
    for (i = 0; i < n; i++) {
      var a = 0.5 + 0.5 * Math.sin(t * (1.5 + h1(i) * 2) + i * 0.7) * Math.sin(t * 0.7 + i * 0.25), hgt = H * (0.1 + 0.8 * a * a), segs = Math.floor(hgt / (14 * S));
      for (j = 0; j < segs; j++) { ctx.fillStyle = rgba(g.pal(j / Math.max(10, segs), [0, 0, 0]), 1); ctx.fillRect(i * bw + bw * 0.1, H - (j + 1) * 14 * S, bw * 0.8, 11 * S); }
    }
  });

  R('fitas', 'Fitas de luz', 'Líquidos', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t * 0.5, S = H / 540, i, j, N = 9;
    bg(g, 0.96); ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < N; i++) {
      var c = g.pal(i / N, [0, 0, 0]); ctx.strokeStyle = rgba(c, 0.55); ctx.lineWidth = (2 + 3 * h1(i)) * S; glowOn(ctx, c, 12 * S); ctx.beginPath();
      for (j = 0; j <= 90; j++) { var u = j / 90, x = W * (0.5 + 0.46 * Math.sin(u * TAU * 1 + t + i * 0.5) * Math.sin(u * 2.2 + t * 0.6)), y = H * (0.5 + 0.42 * Math.sin(u * TAU * 2 * g.k + t * 1.1 + i * 0.35)); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    glowOff(ctx); ctx.globalCompositeOperation = 'source-over';
  });

  // ================= Festa =================
  R('coracoes', 'Corações flutuando', 'Festa', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, N = Math.round(36 * g.k), i;
    bg(g, 0.93);
    for (i = 0; i < N; i++) {
      var z = 0.4 + 0.6 * h1(i + 2), sp = 0.06 + 0.1 * z, y = H * (1.1 - ((h1(i) + t * sp) % 1.25)), x = (h1(i + 20) + Math.sin(t * 0.8 + i) * 0.03) * W, s = (10 + 22 * z) * S;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t + i) * 0.3); ctx.fillStyle = rgba(mix(g.pal(h1(i + 9), [0, 0, 0]), [255, 255, 255], 0.1), 0.35 + 0.6 * z); ctx.beginPath();
      ctx.moveTo(0, s * 0.35); ctx.bezierCurveTo(-s, -s * 0.5, -s * 0.5, -s * 1.1, 0, -s * 0.45); ctx.bezierCurveTo(s * 0.5, -s * 1.1, s, -s * 0.5, 0, s * 0.35); ctx.fill(); ctx.restore();
    }
  });

  R('brilhos', 'Brilhos (glitter)', 'Festa', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, N = Math.round(140 * g.k), i;
    bg(g, 0.96); ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < N; i++) {
      var x = h1(i) * W, y = h1(i + 77) * H, ph = (t * (0.5 + h1(i + 3)) + h1(i + 9) * 5) % 1, a = Math.pow(Math.sin(ph * Math.PI), 3), r = (6 + 16 * h1(i + 5)) * S * a;
      var c = mix(g.pal(h1(i + 13), [0, 0, 0]), [255, 255, 255], 0.5); ctx.fillStyle = rgba(c, a);
      ctx.beginPath(); ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  R('discoteca', 'Globo de espelhos', 'Festa', function (g) {
    var t = g.t, k = g.k, c = [0, 0, 0], cols = Math.round(26 * k), rows = Math.round(15 * k);
    shade(g, 160, 90, function (u, v, o) {
      var cx = Math.floor(u * cols), cy = Math.floor(v * rows), fu = u * cols - cx, fv = v * rows - cy, gap = (fu < 0.08 || fv < 0.08) ? 0 : 1;
      var sp = 0, i;
      for (i = 0; i < 3; i++) { var a = t * (0.6 + i * 0.25) + i * 2.1, px = 0.5 + 0.45 * Math.cos(a), py = 0.5 + 0.4 * Math.sin(a * 1.3); sp += Math.pow(Math.max(0, 1 - Math.hypot((u - px) * 1.8, v - py) * 2.2), 2) * (0.6 + 0.4 * h2(cx + i * 9, cy + Math.floor(t * 6 + i)));  }
      var tw = h2(cx, cy + Math.floor(t * 4)) > 0.82 ? 0.7 : 0;
      g.pal(h2(cx, cy), c); var e = gap * (0.06 + sp * 1.1 + tw);
      o[0] = Math.min(255, c[0] * e + 255 * Math.max(0, e - 1)); o[1] = Math.min(255, c[1] * e + 255 * Math.max(0, e - 1)); o[2] = Math.min(255, c[2] * e + 255 * Math.max(0, e - 1));
    });
  });

  // ================= Tecnologia =================
  R('hud', 'Painel HUD', 'Tecnologia', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, cx = W / 2, cy = H / 2, m = Math.min(W, H), i;
    bg(g, 0.95); glowOn(ctx, g.c1, 8 * S); ctx.lineCap = 'butt';
    var rings = [[0.42, 5, 1], [0.35, 12, -1.4], [0.28, 3, 2], [0.2, 20, -0.7]];
    rings.forEach(function (r, k) {
      ctx.strokeStyle = rgba(k % 2 ? g.c2 : g.c1, 0.9); ctx.lineWidth = (3 + k) * S;
      var segs = r[1], a0 = t * r[2];
      for (i = 0; i < segs; i++) { var s0 = a0 + i / segs * TAU, ln = TAU / segs * (0.55 + 0.25 * Math.sin(t + i)); ctx.beginPath(); ctx.arc(cx, cy, m * r[0] * Math.min(1.25, g.k), s0, s0 + ln); ctx.stroke(); }
    });
    ctx.fillStyle = rgba(g.c2, 0.9); ctx.font = (16 * S) + 'px monospace'; ctx.textAlign = 'center';
    ctx.fillText(String(Math.floor(((t * 13) % 100))).padStart(2, '0') + '%', cx, cy + 6 * S); glowOff(ctx);
  });

  R('scanner', 'Scanner', 'Tecnologia', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, step = 30 * S / Math.min(1.5, Math.max(0.5, g.k)), x, y, p = ((t * 0.35) % 1);
    bg(g, 0.95); ctx.strokeStyle = rgba(g.c1, 0.25); ctx.lineWidth = 1;
    for (x = 0; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (y = 0; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    var yy = p * H, gr = ctx.createLinearGradient(0, yy - 120 * S, 0, yy); gr.addColorStop(0, rgba(g.c2, 0)); gr.addColorStop(1, rgba(g.c2, 0.45)); ctx.fillStyle = gr; ctx.fillRect(0, yy - 120 * S, W, 120 * S);
    glowOn(ctx, g.c2, 14 * S); ctx.fillStyle = rgba(mix(g.c2, [255, 255, 255], 0.5), 1); ctx.fillRect(0, yy - 2 * S, W, 4 * S); glowOff(ctx);
    ctx.fillStyle = rgba(g.c2, 0.8); for (x = 0; x < 40; x++) { var px = h1(x) * W, py = h1(x + 40) * H; if (py < yy && py > yy - 200 * S) ctx.fillRect(px, py, 4 * S, 4 * S); }
  });

  R('pulsocardio', 'Batimento', 'Música', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, x, n = 0;
    bg(g, 0.96); ctx.strokeStyle = rgba(g.c1, 0.12); ctx.lineWidth = 1; for (x = 0; x < W; x += 40 * S) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    glowOn(ctx, g.c2, 14 * S); ctx.strokeStyle = rgba(mix(g.c2, [255, 255, 255], 0.3), 1); ctx.lineWidth = 3 * S; ctx.beginPath();
    for (x = 0; x <= W; x += 3) {
      var u = (x / W) * 3 - t * 0.7, ph = ((u % 1) + 1) % 1, y = 0;
      if (ph > 0.38 && ph < 0.44) y = -0.1 * Math.sin((ph - 0.38) / 0.06 * Math.PI); else if (ph > 0.46 && ph < 0.5) y = 0.12 * ((ph - 0.46) / 0.04) ; else if (ph >= 0.5 && ph < 0.54) y = 0.12 - 1.0 * ((ph - 0.5) / 0.04); else if (ph >= 0.54 && ph < 0.58) y = -0.88 + 1.0 * ((ph - 0.54) / 0.04); else if (ph > 0.66 && ph < 0.76) y = -0.16 * Math.sin((ph - 0.66) / 0.1 * Math.PI);
      var px = x, py = H * (0.55 + y * 0.35 * g.k); x ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke(); glowOff(ctx);
  });

  R('globodados', 'Globo de pontos', 'Tecnologia', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t * 0.4, S = H / 540, R0 = Math.min(W, H) * 0.36 * g.k, N = 420, i;
    bg(g, 0.95); ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < N; i++) {
      var y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), th = i * 2.399963 + t, x = Math.cos(th) * r, z = Math.sin(th) * r, f = 1 / (1 - z * 0.3);
      ctx.fillStyle = rgba(g.pal(0.5 + 0.5 * y, [0, 0, 0]), 0.25 + 0.6 * (z * 0.5 + 0.5)); ctx.beginPath(); ctx.arc(W / 2 + x * R0 * f, H / 2 + y * R0 * f, (1.2 + 1.8 * (z * 0.5 + 0.5)) * S, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  R('chamaneon', 'Pulso de energia', 'Elementos', function (g) {
    var t = g.t * 0.8, k = g.k, asp = g.W / g.H, c = [0, 0, 0];
    shade(g, 170, 96, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, r = Math.hypot(x, y), a = Math.atan2(y, x), w = fbm(Math.cos(a) * 1.6 + t * 0.3, Math.sin(a) * 1.6 + r * 2 - t, 3);
      var f = Math.exp(-Math.pow((r - (0.45 + 0.1 * Math.sin(t * 2)) * k - w * 0.28) * 7, 2)) + 0.25 * Math.exp(-r * 3);
      g.pal(0.25 + 0.7 * cl(f), c); var s = cl(f * 1.1); o[0] = c[0] * s + 255 * Math.pow(s, 4) * 0.5; o[1] = c[1] * s + 255 * Math.pow(s, 4) * 0.5; o[2] = c[2] * s + 255 * Math.pow(s, 4) * 0.5;
    });
  });

  R('prisma', 'Prisma de luz', 'Abstratas', function (g) {
    var t = g.t * 0.4, k = g.k, asp = g.W / g.H, c = [0, 0, 0];
    shade(g, 190, 108, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, a = x * Math.cos(t) + y * Math.sin(t), b = -x * Math.sin(t) + y * Math.cos(t), f = 0;
      f = Math.sin(a * 6 * k + Math.sin(b * 4 + t)) * 0.5 + 0.5 * Math.sin(b * 5 * k - t) ;
      g.pal(0.5 + 0.5 * Math.sin(f * 2.2 + a * 1.5), c); var edge = Math.pow(Math.abs(Math.sin(a * 6 * k)), 14) * 80;
      o[0] = c[0] * (0.35 + 0.5 * f) + edge; o[1] = c[1] * (0.35 + 0.5 * f) + edge; o[2] = c[2] * (0.35 + 0.5 * f) + edge;
    });
  });


  // ================= Grade de alinhamento (ponto de partida das superfícies) =================
  R('gradeneon', 'Grade neon de alinhamento', 'Calibração', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, S = H / 540, rows = Math.max(3, Math.round(9 * g.k)), cols = Math.max(3, Math.round(rows * W / H)), cw = W / cols, ch = H / rows, i, pulse = 0.85 + 0.15 * Math.sin(g.t * 1.6);
    ctx.fillStyle = '#04060a'; ctx.fillRect(0, 0, W, H);
    var glow = rgba(g.c1, 0.95), lw = Math.max(1.2, 2.2 * S);
    function lines(width, blur, alpha) {
      ctx.lineWidth = width; ctx.shadowColor = glow; ctx.shadowBlur = blur; ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
      ctx.beginPath();
      for (i = 1; i < cols; i++) { ctx.moveTo(i * cw, 0); ctx.lineTo(i * cw, H); }
      for (i = 1; i < rows; i++) { ctx.moveTo(0, i * ch); ctx.lineTo(W, i * ch); }
      ctx.stroke();
    }
    lines(lw * 2.4, 16 * S * pulse, 0.35); lines(lw, 8 * S * pulse, 0.95);
    // borda externa mais forte, com cruz no centro e quatro marcas de canto
    var m = lw * 1.5; ctx.shadowBlur = 18 * S * pulse; ctx.lineWidth = lw * 2.2; ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.strokeRect(m, m, W - m * 2, H - m * 2);
    ctx.lineWidth = lw * 1.6; ctx.beginPath();
    ctx.moveTo(W / 2 - cw * 0.35, H / 2); ctx.lineTo(W / 2 + cw * 0.35, H / 2); ctx.moveTo(W / 2, H / 2 - ch * 0.35); ctx.lineTo(W / 2, H / 2 + ch * 0.35); ctx.stroke();
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    var r = Math.max(4, 7 * S); ctx.fillStyle = '#fff';
    [[m, m], [W - m, m], [W - m, H - m], [m, H - m]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill(); });
  });

  // ================= Pack final =================
  R('cometas', 'Cometas', 'Espaço', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, N = Math.round(9 * g.k), i, j;
    bg(g, 0.96); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (i = 0; i < N; i++) {
      var sp = 0.12 + 0.1 * h1(i), ph = (t * sp + h1(i + 5)) % 1.3, a = -0.45 - 0.35 * h1(i + 2), x0 = W * (1.15 * h1(i + 9) + 0.2 * ph) , x = (W * (1.2 * h1(i + 9)) + ph * W * 1.1) % (W * 1.3) - W * 0.15, y = H * (-0.2 + ph * 1.1 * (0.6 + 0.5 * h1(i + 3)) ) ;
      var L = (120 + 160 * h1(i + 7)) * S, dx = Math.cos(a) * -1, dy = Math.sin(a) * -1; // cauda para trás
      var c = g.pal(h1(i + 11), [0, 0, 0]), gr = ctx.createLinearGradient(x, y, x + dx * L, y + dy * L);
      gr.addColorStop(0, rgba(mix(c, [255, 255, 255], 0.6), 1)); gr.addColorStop(1, rgba(c, 0)); ctx.strokeStyle = gr; ctx.lineWidth = (3 + 4 * h1(i)) * S; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * L, y + dy * L); ctx.stroke();
      glowOn(ctx, c, 14 * S); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 3.5 * S, 0, TAU); ctx.fill(); glowOff(ctx);
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  R('bolhasabao', 'Bolhas de sabão', 'Líquidos', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, N = Math.round(16 * g.k), i;
    bg(g, 0.92);
    for (i = 0; i < N; i++) {
      var sp = 0.03 + 0.05 * h1(i + 2), y = H * (1.15 - ((h1(i) + t * sp) % 1.3)), x = W * (h1(i + 15) + Math.sin(t * 0.6 + i * 2) * 0.03), r = (22 + 60 * h1(i + 6)) * S;
      var gr = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.03)'); gr.addColorStop(0.75, rgba(g.pal((i % 5) / 5, [0, 0, 0]), 0.12)); gr.addColorStop(0.93, rgba(g.pal(((i + 2) % 5) / 5 + 0.2, [0, 0, 0]), 0.55)); gr.addColorStop(1, 'rgba(255,255,255,0.7)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(x - r * 0.4, y - r * 0.45, r * 0.18, r * 0.09, -0.7, 0, TAU); ctx.fill();
    }
  });

  R('tornado', 'Tornado', 'Elementos', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, N = Math.round(520 * g.k), i;
    bg(g, 0.95); ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < N; i++) {
      var u = (h1(i) + t * 0.12 * (0.6 + h1(i + 3))) % 1, y = H * (0.95 - u * 0.9), rad = (0.04 + u * 0.34) * W * 0.5 * (0.7 + 0.6 * h1(i + 8)), a = t * (2.2 - u * 1.2) + h1(i + 5) * TAU, x = W / 2 + Math.cos(a) * rad + Math.sin(t * 0.5) * 20 * S * u, z = Math.sin(a);
      ctx.fillStyle = rgba(g.pal(0.2 + 0.7 * u, [0, 0, 0]), 0.25 + 0.4 * (z * 0.5 + 0.5)); ctx.beginPath(); ctx.arc(x, y + z * rad * 0.12, (1.2 + 2.2 * (1 - u)) * S, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  R('pinceladas', 'Pinceladas', 'Abstratas', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t * 0.5, S = H / 540, N = Math.round(14 * g.k), i, j;
    ctx.fillStyle = rgba(mix(g.c1, [0, 0, 0], 0.93), 1); ctx.fillRect(0, 0, W, H); ctx.lineCap = 'round';
    for (i = 0; i < N; i++) {
      var ph = (t * (0.25 + 0.2 * h1(i)) + h1(i + 4)) % 1, y0 = H * (0.08 + 0.84 * h1(i + 9)), th = (30 + 60 * h1(i + 2)) * S, len = Math.min(1, ph * 1.6);
      ctx.strokeStyle = rgba(g.pal(h1(i + 13), [0, 0, 0]), (1 - Math.max(0, ph - 0.75) * 4) * 0.9); ctx.lineWidth = th; ctx.beginPath();
      for (j = 0; j <= 30 * len; j++) { var u = j / 30, x = W * (-0.1 + 1.2 * u), y = y0 + Math.sin(u * 5 + i) * H * 0.07 + Math.sin(u * 17 + i * 3) * 4 * S; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
  });

  R('cortinaonda', 'Cortina de ondas', 'Hipnóticas', function (g) {
    var t = g.t * 0.6, k = g.k, c = [0, 0, 0];
    shade(g, 190, 108, function (u, v, o) {
      var cols = 28 * k, cx = Math.floor(u * cols) / cols, w = Math.sin(cx * 9 + t) + Math.sin(cx * 4.3 - t * 1.3), edge = 0.5 + 0.25 * w, d = v - edge, band = Math.exp(-Math.pow(d * 3.2, 2));
      var fu = (u * cols) % 1, sep = sm(0, 0.12, fu) * sm(1, 0.88, fu);
      g.pal(0.1 + 0.8 * cx + 0.2 * Math.sin(t), c); var e = band * sep * (0.35 + 0.65 * Math.pow(cl(1 - Math.abs(d) * 2), 2)) + 0.04;
      o[0] = c[0] * e; o[1] = c[1] * e; o[2] = c[2] * e;
    });
  });

  R('holofotes', 'Holofotes de show', 'Festa', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, N = 6, i;
    bg(g, 0.97); ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < N; i++) {
      var bx = W * (i + 0.5) / N, ang = Math.sin(t * (0.6 + 0.12 * i) + i * 1.7) * 0.7 * Math.min(1.2, g.k), L = H * 1.3, w = (40 + 20 * Math.sin(t + i)) * S, c = g.pal(i / N, [0, 0, 0]);
      ctx.save(); ctx.translate(bx, H + 10 * S); ctx.rotate(ang);
      var gr = ctx.createLinearGradient(0, 0, 0, -L); gr.addColorStop(0, rgba(mix(c, [255, 255, 255], 0.4), 0.75)); gr.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-6 * S, 0); ctx.lineTo(6 * S, 0); ctx.lineTo(w, -L); ctx.lineTo(-w, -L); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  R('serpentinas', 'Serpentinas', 'Festa', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, N = Math.round(26 * g.k), i, j;
    bg(g, 0.94); ctx.lineCap = 'round';
    for (i = 0; i < N; i++) {
      var sp = 0.1 + 0.12 * h1(i + 2), x0 = W * h1(i + 20), y0 = H * (((h1(i) + t * sp) % 1.3) - 0.2), c = g.pal(h1(i + 9), [0, 0, 0]);
      ctx.strokeStyle = rgba(c, 0.95); ctx.lineWidth = (5 + 4 * h1(i + 6)) * S; ctx.beginPath();
      for (j = 0; j <= 16; j++) { var y = y0 - j * 9 * S, x = x0 + Math.sin(j * 0.6 + t * 3 + i) * (10 + j * 1.2) * S; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
  });

  R('termica', 'Câmera térmica', 'Abstratas', function (g) {
    var t = g.t * 0.4, k = g.k, asp = g.W / g.H, c = [0, 0, 0];
    shade(g, 150, 84, function (u, v, o) {
      var x = (u - 0.5) * asp * 2 * k, y = (v - 0.5) * 2 * k, f = fbm(x * 1.1 + t, y * 1.1 - t * 0.7, 4) + 0.35 * Math.sin(x * 2 + t * 2) * Math.cos(y * 2 - t);
      var q = Math.floor(cl(f * 0.9 + 0.1) * 9) / 9; g.pal(q, c); var s = 0.25 + 0.75 * q; o[0] = c[0] * s + q * 50; o[1] = c[1] * s + q * 20; o[2] = c[2] * s;
    });
  });

  R('explosao', 'Explosões', 'Elementos', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, P = 1.6, i, b;
    bg(g, 0.97); ctx.globalCompositeOperation = 'lighter';
    for (b = 0; b < 3; b++) {
      var tb = t - b * (P / 3), cyc = Math.floor(tb / P), age = (tb - cyc * P) / P, seed = cyc * 3 + b + 1;
      if (tb < 0) continue;
      var cx = W * (0.2 + 0.6 * h1(seed)), cy = H * (0.25 + 0.5 * h1(seed + 4)), R0 = Math.max(W, H) * 0.32 * g.k, e = 1 - Math.pow(1 - age, 3);
      ctx.strokeStyle = rgba(mix(g.c2, [255, 255, 255], 0.5), (1 - age)); ctx.lineWidth = (14 - 12 * age) * S; ctx.beginPath(); ctx.arc(cx, cy, R0 * e, 0, TAU); ctx.stroke();
      var fl = Math.max(0, 1 - age * 5); if (fl) { var gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, R0 * 0.5 * (0.3 + age)); gr.addColorStop(0, rgba([255, 240, 200], fl)); gr.addColorStop(1, rgba(g.c1, 0)); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
      for (i = 0; i < 46; i++) { var a = h1(seed * 7 + i) * TAU, d = R0 * e * (0.4 + 0.7 * h1(seed + i + 3)); ctx.fillStyle = rgba(g.pal(h1(i + seed), [0, 0, 0]), 1 - age); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d + age * age * 40 * S, (3.5 - 2.5 * age) * S, 0, TAU); ctx.fill(); }
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  R('olho', 'Olho hipnótico', 'Abstratas', function (g) {
    var t = g.t * 0.5, k = g.k, asp = g.W / g.H, c = [0, 0, 0];
    shade(g, 190, 108, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, r = Math.hypot(x, y), a = Math.atan2(y, x), pr = 0.16 + 0.05 * Math.sin(t * 2);
      var fib = 0.5 + 0.5 * Math.sin(a * 36 * k + Math.sin(r * 9 - t * 2) * 1.4), iris = sm(0.9, 0.5, r), ring = Math.exp(-Math.pow((r - 0.62) * 11, 2));
      g.pal(0.2 + 0.7 * fib * iris + 0.15 * r, c); var pup = sm(pr, pr + 0.03, r), e = pup * (0.2 + 0.8 * iris * (0.4 + 0.6 * fib)) + ring * 0.6;
      o[0] = c[0] * e + 255 * Math.exp(-Math.pow((r - pr - 0.04) * 30, 2)) * 0.3; o[1] = c[1] * e; o[2] = c[2] * e;
    });
  });

  R('pixelturbilhao', 'Redemoinho de pixels', 'Retrô', function (g) {
    var t = g.t * 0.6, k = g.k, asp = g.W / g.H, c = [0, 0, 0], n = 36 + 24 * Math.sin(t * 0.6);
    shade(g, 190, 108, function (u, v, o) {
      var cx = Math.floor(u * n * asp) / (n * asp), cy = Math.floor(v * n) / n, x = (cx - 0.5) * asp * 2, y = (cy - 0.5) * 2, r = Math.hypot(x, y), a = Math.atan2(y, x) + r * 3 * k - t * 2;
      var f = 0.5 + 0.5 * Math.sin(a * 3 + r * 8 * k - t * 3); g.pal(f, c); var s = 0.15 + 0.85 * f * Math.min(1, 1.4 - r * 0.6); o[0] = c[0] * s; o[1] = c[1] * s; o[2] = c[2] * s;
    });
  });
})(typeof window !== 'undefined' ? window : this);
