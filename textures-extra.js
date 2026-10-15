// Biblioteca extra: animações originais inspiradas nos estilos mais virais da internet (cromo líquido, óleo, matrix, fogos, laser, etc).
// Tudo é gerado por código na hora. Nada é baixado, nada tem direitos autorais de terceiros.
(function (root) {
  'use strict';
  var X = root.Textures;
  if (!X || !X.register) return;
  var U = X.util, TAU = U.TAU, h1 = U.h1, h2 = U.h2, vn = U.vnoise, fbm = U.fbm, cl = U.clamp01, sm = U.smooth, mix = U.mix, rgba = U.rgba, shade = U.shade;
  var CAT = 'Virais';
  function R(id, name, cat, fn) { X.register(id, name, cat || CAT, fn); }
  function bg(g, a) { g.ctx.fillStyle = rgba(mix(g.c1, [0, 0, 0], a == null ? 0.94 : a), 1); g.ctx.fillRect(0, 0, g.W, g.H); }
  function pk(g, u) { return g.pal(u, [0, 0, 0]); }
  function hueCol(g, dh, s, l) { var hs = U.toHsl(g.c1); return U.fromHsl(hs[0] + dh, s, l, [0, 0, 0]); }

  // ================= Líquidos e brilhos =================
  R('cromo', 'Cromo líquido', 'Líquidos', function (g) {
    var t = g.t * 0.6, k = g.k, asp = g.W / g.H, c1 = g.c1, c2 = g.c2, e = 0.05, dark = mix(c1, [0, 0, 0], 0.93), tint, base;
    function h(x, y) { return Math.sin(x * 2.6 + t) + Math.sin(y * 3.4 - t * 1.3 + Math.sin(x * 1.7 + t * 0.8) * 1.6) + Math.sin((x + y) * 2.1 + t * 0.7) * 0.8 + Math.sin(Math.hypot(x - 1, y + 0.4) * 3 - t) * 0.7; }
    shade(g, 170, 96, function (u, v, o) {
      var x = (u - 0.5) * asp * 2.4 * k, y = (v - 0.5) * 2.4 * k, h0 = h(x, y), nx = h(x + e, y) - h0, ny = h(x, y + e) - h0;
      var r = (nx * 5 + ny * 2.5) * 4, l = sm(0.12, 0.88, 0.5 + 0.5 * Math.sin(r + 1.2));
      tint = mix(c1, c2, 0.5 + 0.5 * Math.sin(r * 0.5 + t));
      base = l < 0.5 ? mix(dark, tint, l * 2) : mix(tint, [255, 255, 255], (l - 0.5) * 1.8);
      o[0] = base[0]; o[1] = base[1]; o[2] = base[2];
    });
  });

  R('oleo', 'Óleo iridescente', 'Líquidos', function (g) {
    var t = g.t * 0.22, k = g.k, asp = g.W / g.H, hs = U.toHsl(g.c1), tmp = [0, 0, 0];
    shade(g, 150, 84, function (u, v, o) {
      var x = (u - 0.5) * asp * 2 * k, y = (v - 0.5) * 2 * k;
      var wx = fbm(x + t, y - t * 0.7, 3), wy = fbm(x - t * 0.6 + 7, y + t * 0.5, 3);
      var f = fbm(x * 1.2 + wx * 2.2, y * 1.2 + wy * 2.2, 4);
      U.fromHsl(hs[0] + f * 440 + t * 25, 0.9, 0.1 + 0.5 * sm(0.1, 0.95, 0.5 + 0.5 * Math.sin(f * 15)), tmp);
      o[0] = tmp[0]; o[1] = tmp[1]; o[2] = tmp[2];
    });
  });

  R('seda', 'Seda', 'Líquidos', function (g) {
    var t = g.t * 0.5, k = g.k, asp = g.W / g.H, c = [0, 0, 0];
    shade(g, 150, 84, function (u, v, o) {
      var x = (u - 0.5) * asp * 2 * k, y = (v - 0.5) * 2 * k, w = fbm(x * 0.8 + t * 0.2, y * 0.8 - t * 0.1, 3);
      var s = Math.sin(x * 3.2 + y * 1.4 + w * 5 + t), sh = 0.5 + 0.5 * s, sp = Math.pow(Math.max(0, s), 14);
      g.pal(0.12 + 0.72 * sh, c);
      o[0] = c[0] + 255 * sp * 0.4; o[1] = c[1] + 255 * sp * 0.4; o[2] = c[2] + 255 * sp * 0.4;
    });
  });

  R('mercurio', 'Mercúrio', 'Líquidos', function (g) {
    var t = g.t * 0.5, k = g.k, asp = g.W / g.H, c1 = g.c1, c2 = g.c2, dark = mix(c1, [0, 0, 0], 0.94), N = 7, bx = [], by = [], br = [], i;
    for (i = 0; i < N; i++) {
      bx.push(Math.sin(t * (0.5 + h1(i) * 0.6) + i * 2.1) * 0.62 * asp);
      by.push(Math.cos(t * (0.45 + h1(i + 9) * 0.6) + i * 1.3) * 0.5);
      br.push((0.2 + 0.1 * h1(i + 4)) * k);
    }
    shade(g, 200, 112, function (u, v, o) {
      var x = (u - 0.5) * asp * 2 * 0.9, y = (v - 0.5) * 2 * 0.9, f = 0, gx = 0, gy = 0, j, dx, dy, d2, r2, q, col;
      for (j = 0; j < N; j++) {
        dx = x - bx[j]; dy = y - by[j]; d2 = dx * dx + dy * dy + 1e-4; r2 = br[j] * br[j];
        f += r2 / d2; q = -2 * r2 / (d2 * d2); gx += q * dx; gy += q * dy;
      }
      if (f < 0.97) { var gl = Math.min(1, f * 0.35); col = mix(dark, c2, gl * 0.45); o[0] = col[0]; o[1] = col[1]; o[2] = col[2]; return; }
      var gm = Math.hypot(gx, gy) + 1e-3, nx = gx / gm, ny = gy / gm, m = cl((f - 1) / 2.5);
      var ex = nx * (1 - m), ey = ny * (1 - m), l = sm(0.1, 0.9, 0.5 + 0.5 * Math.sin((ex * 1.6 + ey * 0.9) * 3.4 + m * 5 + t));
      col = l < 0.5 ? mix(dark, c1, l * 2) : mix(c1, [255, 255, 255], (l - 0.5) * 1.9);
      var a = sm(0.97, 1.04, f);
      o[0] = col[0] * a + dark[0] * (1 - a); o[1] = col[1] * a + dark[1] * (1 - a); o[2] = col[2] * a + dark[2] * (1 - a);
    });
  });

  R('gooey', 'Gota gooey', 'Líquidos', function (g) {
    var t = g.t * 0.45, k = g.k, asp = g.W / g.H, dark = mix(g.c1, [0, 0, 0], 0.9), N = 6, bx = [], by = [], br = [], bc = [], i;
    for (i = 0; i < N; i++) {
      bx.push(Math.sin(t * (0.6 + h1(i) * 0.5) + i * 1.9) * 0.7 * asp); by.push(Math.cos(t * (0.5 + h1(i + 5) * 0.6) + i * 2.7) * 0.55);
      br.push((0.2 + 0.08 * h1(i + 2)) * k); bc.push(pk(g, 0.5 + i / (N - 1) * 0.5));
    }
    shade(g, 190, 107, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, f = 0, r = 0, gg = 0, b = 0, j, d2, w, c;
      for (j = 0; j < N; j++) {
        d2 = (x - bx[j]) * (x - bx[j]) + (y - by[j]) * (y - by[j]) + 1e-4; w = br[j] * br[j] / d2; f += w;
        c = bc[j]; r += c[0] * w; gg += c[1] * w; b += c[2] * w;
      }
      var a = sm(0.9, 1.1, f), hi = sm(1.0, 2.8, f) * 0.35;
      o[0] = dark[0] + (r / f - dark[0]) * a + 255 * hi * a; o[1] = dark[1] + (gg / f - dark[1]) * a + 255 * hi * a; o[2] = dark[2] + (b / f - dark[2]) * a + 255 * hi * a;
    });
  });

  R('caustica', 'Cáustica de piscina', 'Líquidos', function (g) {
    var t = g.t * 0.5 + 23, k = g.k, asp = g.W / g.H, c = [0, 0, 0];
    shade(g, 180, 101, function (u, v, o) {
      var px = ((u * asp * k * TAU * 0.9) % TAU) - 250, py = ((v * k * TAU * 0.9) % TAU) - 250, ix = px, iy = py, cc = 1, n, tt, l;
      for (n = 0; n < 5; n++) {
        tt = t * (1 - 3.5 / (n + 1));
        var nx = px + (Math.cos(tt - ix) + Math.sin(tt + iy)), ny = py + (Math.sin(tt - iy) + Math.cos(tt + ix)); ix = nx; iy = ny;
        cc += 1 / Math.hypot(px / (Math.sin(ix + tt) / 0.005), py / (Math.cos(iy + tt) / 0.005));
      }
      cc /= 5; cc = 1.17 - Math.pow(Math.abs(cc), 1.4); l = cl(Math.pow(Math.abs(cc), 8));
      g.pal(0.22 + 0.5 * l, c);
      o[0] = c[0] + 255 * l * l * 0.5; o[1] = c[1] + 255 * l * l * 0.5; o[2] = c[2] + 255 * l * l * 0.5;
    });
  });

  R('agua', 'Gotas na água', 'Líquidos', function (g) {
    var t = g.t, k = g.k, asp = g.W / g.H, N = 5, sx = [], sy = [], i, c = [0, 0, 0];
    for (i = 0; i < N; i++) { sx.push(Math.sin(t * 0.13 * (1 + i * 0.3) + i * 2) * 0.8 * asp); sy.push(Math.cos(t * 0.11 * (1 + i * 0.2) + i * 1.7) * 0.6); }
    function h(x, y) { var s = 0, j, d; for (j = 0; j < N; j++) { d = Math.hypot(x - sx[j], y - sy[j]); s += Math.sin(d * 9 * k - t * 2.6 + j) / (1 + d * 6); } return s; }
    shade(g, 190, 107, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, h0 = h(x, y), nx = h(x + 0.01, y) - h0, ny = h(x, y + 0.01) - h0;
      var L = 0.5 + (nx * -0.7 + ny * -0.7) * 14, sp = Math.pow(cl(L - 0.5) * 2, 4);
      g.pal(0.3 + 0.45 * cl(L), c);
      o[0] = c[0] + 255 * sp * 0.5; o[1] = c[1] + 255 * sp * 0.5; o[2] = c[2] + 255 * sp * 0.5;
    });
  });

  R('fogo', 'Fogo', 'Elementos', function (g) {
    var t = g.t, k = g.k, c = [0, 0, 0];
    shade(g, 150, 96, function (u, v, o) {
      var n = fbm(u * 7 * k, v * 2.2 - t * 2.3, 4), n2 = fbm(u * 14 * k + 3, v * 4 - t * 4, 3);
      var side = Math.pow(Math.abs(u - 0.5) * 2, 2) * 0.35;
      var hh = cl((n * 0.9 + n2 * 0.3 + Math.pow(v, 1.3) * 1.25 - 0.78 - side) * 1.35);
      g.pal(hh, c);
      var w = sm(0.86, 1.0, hh) * 0.7;
      o[0] = c[0] + (255 - c[0]) * w; o[1] = c[1] + (255 - c[1]) * w; o[2] = c[2] + (255 - c[2]) * w;
    });
  });

  R('fumaca', 'Fumaça', 'Elementos', function (g) {
    var t = g.t * 0.4, k = g.k, asp = g.W / g.H, c = [0, 0, 0];
    shade(g, 150, 84, function (u, v, o) {
      var x = (u - 0.5) * asp * 2.2 * k, y = (v - 0.5) * 2.2 * k, wx = fbm(x + 3, y - t, 3), wy = fbm(x - 5, y - t * 0.8 + 9, 3);
      var d = fbm(x + wx * 1.8, y - t * 0.6 + wy * 1.8, 5), tone = sm(0.25, 0.8, d);
      g.pal(0.12 + tone * 0.6, c);
      o[0] = c[0] + 255 * tone * tone * 0.35; o[1] = c[1] + 255 * tone * tone * 0.35; o[2] = c[2] + 255 * tone * tone * 0.35;
    });
  });

  // ================= Hipnóticas =================
  R('vortice', 'Vórtice', 'Hipnóticas', function (g) {
    var t = g.t, k = g.k, asp = g.W / g.H, arms = Math.max(2, Math.round(5 * k)), c = [0, 0, 0];
    shade(g, 220, 124, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, r = Math.hypot(x, y), a = Math.atan2(y, x);
      var f = sm(0.3, 0.7, 0.5 + 0.5 * Math.sin(a * arms + Math.log(r + 0.03) * 5 - t * 2.2));
      g.pal(f * (0.55 + 0.45 * Math.exp(-r * 1.4)), c);
      var fade = sm(0.0, 0.12, r); o[0] = c[0] * fade; o[1] = c[1] * fade; o[2] = c[2] * fade;
    });
  });

  R('hipnose', 'Espiral hipnótica', 'Hipnóticas', function (g) {
    var t = g.t, k = g.k, asp = g.W / g.H, a1 = g.c1, dk = mix(g.c1, [0, 0, 0], 0.93), c2 = g.c2, col;
    shade(g, 260, 146, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, r = Math.hypot(x, y), a = Math.atan2(y, x);
      var f = sm(-0.15, 0.15, Math.sin(a * 2 + r * 16 * k - t * 3.2));
      col = mix(dk, mix(a1, c2, cl(r * 0.8)), f);
      o[0] = col[0]; o[1] = col[1]; o[2] = col[2];
    });
  });

  R('mandala', 'Mandala', 'Hipnóticas', function (g) {
    var t = g.t * 0.7, k = g.k, asp = g.W / g.H, n = 12, seg = TAU / n, c = [0, 0, 0];
    shade(g, 220, 124, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, r = Math.hypot(x, y), a = Math.atan2(y, x);
      var aa = ((a % seg) + seg) % seg; aa = Math.abs(aa - seg / 2);
      var px = r * Math.cos(aa) * k, py = r * Math.sin(aa) * k;
      var s = Math.sin(px * 18 - t * 2) * Math.sin(py * 18 + t) + Math.sin(r * 22 * k - t * 3) * 0.6;
      g.pal(0.5 + 0.5 * Math.sin(s * 1.6 + r * 3), c);
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    });
  });

  R('conico', 'Gradiente cônico', 'Hipnóticas', function (g) {
    var t = g.t * 0.4, k = g.k, asp = g.W / g.H, c = [0, 0, 0];
    shade(g, 150, 84, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, r = Math.hypot(x, y), a = Math.atan2(y, x) / TAU * Math.max(1, Math.round(k)) + t * 0.2 + r * 0.25;
      var q = Math.abs(((a % 1) + 1) % 1 * 2 - 1);
      g.pal(0.15 + 0.85 * q, c);
      var glow = Math.exp(-r * 2.2) * 80; o[0] = c[0] + glow; o[1] = c[1] + glow; o[2] = c[2] + glow;
    });
  });

  R('tunelxadrez', 'Túnel xadrez', 'Hipnóticas', function (g) {
    var t = g.t, k = g.k, asp = g.W / g.H, c1 = g.c1, c2 = g.c2, dk = mix(g.c1, [0, 0, 0], 0.9), col;
    shade(g, 640, 360, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, r = Math.hypot(x, y) + 1e-4, a = Math.atan2(y, x);
      var uu = a / TAU * 12 * k + t * 0.15, vv = 0.5 / r + t * 1.6, ch = ((Math.floor(uu) + Math.floor(vv)) & 1);
      var fog = sm(0.02, 0.35, r); col = mix(dk, ch ? c1 : c2, fog * (ch ? 1 : 0.85));
      o[0] = col[0]; o[1] = col[1]; o[2] = col[2];
    });
  });

  R('fractal', 'Fractal Julia', 'Hipnóticas', function (g) {
    var t = g.t * 0.25, k = g.k, asp = g.W / g.H, cx = -0.745 + 0.05 * Math.cos(t), cy = 0.115 + 0.05 * Math.sin(t * 1.3), c = [0, 0, 0], zoom = 1.45;
    shade(g, 190, 107, function (u, v, o) {
      var zx = (u - 0.5) * asp * 2 * zoom / k, zy = (v - 0.5) * 2 * zoom / k, i = 0, tx;
      while (i < 34 && zx * zx + zy * zy < 16) { tx = zx * zx - zy * zy + cx; zy = 2 * zx * zy + cy; zx = tx; i++; }
      if (i >= 34) { o[0] = o[1] = o[2] = 4; return; }
      var s = i - Math.log2(Math.log(zx * zx + zy * zy) / 2 + 1e-6);
      g.pal(0.2 + 0.8 * (0.5 + 0.5 * Math.sin(s * 1.1 + t * 2)), c);
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    });
  });

  R('caleidofluxo', 'Caleidoscópio fluido', 'Hipnóticas', function (g) {
    var t = g.t * 0.35, k = g.k, asp = g.W / g.H, n = 8, seg = TAU / n, c = [0, 0, 0];
    shade(g, 150, 84, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, r = Math.hypot(x, y), a = Math.atan2(y, x) + t * 0.3;
      var aa = ((a % seg) + seg) % seg; aa = Math.abs(aa - seg / 2);
      var px = r * Math.cos(aa) * 2.2 * k, py = r * Math.sin(aa) * 2.2 * k;
      var wx = fbm(px + t, py, 3), wy = fbm(px - 4, py + t, 3), f = fbm(px + wx * 2.2, py + wy * 2.2, 4);
      g.pal(0.1 + 0.9 * sm(0.2, 0.85, f), c);
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    });
  });

  R('voronoi', 'Células', 'Hipnóticas', function (g) {
    var t = g.t * 0.5, k = g.k, asp = g.W / g.H, N = Math.round(22 * k), px = [], py = [], i, c = [0, 0, 0];
    for (i = 0; i < N; i++) { px.push((0.5 + 0.5 * Math.sin(t * (0.4 + h1(i) * 0.5) + i * 3.1)) * asp * 2); py.push((0.5 + 0.5 * Math.cos(t * (0.35 + h1(i + 7) * 0.5) + i * 1.7)) * 2); }
    shade(g, 170, 96, function (u, v, o) {
      var x = u * asp * 2, y = v * 2, d1 = 9, d2 = 9, id = 0, j, d;
      for (j = 0; j < N; j++) { d = Math.hypot(x - px[j], y - py[j]); if (d < d1) { d2 = d1; d1 = d; id = j; } else if (d < d2) d2 = d; }
      var edge = 1 - sm(0.0, 0.05, d2 - d1);
      g.pal(0.2 + 0.6 * h1(id * 3.7) + 0.2 * d1, c);
      var e = edge * 255;
      o[0] = c[0] * (1 - edge * 0.6) + e * 0.7; o[1] = c[1] * (1 - edge * 0.6) + e * 0.7; o[2] = c[2] * (1 - edge * 0.6) + e * 0.7;
    });
  });

  R('eclipse', 'Eclipse', 'Hipnóticas', function (g) {
    var t = g.t * 0.5, k = g.k, asp = g.W / g.H, c = [0, 0, 0];
    shade(g, 200, 112, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = (v - 0.5) * 2, r = Math.hypot(x, y), a = Math.atan2(y, x), R0 = 0.36 * k;
      if (r < R0) { o[0] = o[1] = o[2] = 0; return; }
      var ring = Math.exp(-Math.pow((r - R0) * 22, 2)), rays = fbm(Math.cos(a) * 2.5 + t * 0.5, Math.sin(a) * 2.5 + (r - R0) * 4 - t * 0.4, 4);
      var I = ring * 1.2 + Math.exp(-(r - R0) * 4) * rays * 1.1;
      g.pal(cl(I), c); var w = cl(ring * 1.1 - 0.15);
      o[0] = c[0] + (255 - c[0]) * w; o[1] = c[1] + (255 - c[1]) * w; o[2] = c[2] + (255 - c[2]) * w;
    });
    g.ctx.fillStyle = '#000'; g.ctx.beginPath(); g.ctx.arc(g.W / 2, g.H / 2, 0.36 * g.k * g.H / 2, 0, TAU); g.ctx.fill();
  });

  R('cortina', 'Raios de luz', 'Elementos', function (g) {
    var t = g.t, k = g.k, asp = g.W / g.H, c = [0, 0, 0];
    shade(g, 190, 107, function (u, v, o) {
      var x = (u - 0.5) * asp * 2, y = v + 0.25, a = Math.atan2(x, y), r = Math.hypot(x, y), I = 0, b;
      for (b = 0; b < 3; b++) I += Math.pow(0.5 + 0.5 * Math.sin(a * (9 + b * 5) * k + t * (0.6 + b * 0.35) + b * 2), 6) * 0.5;
      I *= Math.exp(-r * 0.9) * 1.6; g.pal(cl(I), c);
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    });
  });

  R('estatica', 'Estática de TV', 'Retrô', function (g) {
    var t = g.t, f = Math.floor(t * 24), k = g.k, tint = mix(g.c1, [255, 255, 255], 0.65), band = (t * 0.22) % 1.4 - 0.2;
    shade(g, 220, 124, function (u, v, o) {
      var n = h2(Math.floor(u * 220), Math.floor(v * 124) + f * 131), sc = 0.82 + 0.18 * Math.sin(v * 124 * Math.PI * 1.0), l = n * sc * 0.9;
      var bb = Math.exp(-Math.pow((v - band) * 9, 2)) * 0.5; l = cl(l + bb);
      o[0] = tint[0] * l; o[1] = tint[1] * l; o[2] = tint[2] * l;
    });
  });

  R('pixel8', 'Plasma 8-bit', 'Retrô', function (g) {
    var t = g.t, k = g.k, c = [0, 0, 0], bay = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    var cv = g.cache.p8 || (g.cache.p8 = document.createElement('canvas')), W = 96, H = 54;
    cv.width = W; cv.height = H;
    var c2 = cv.getContext('2d'), id = c2.createImageData(W, H), d = id.data, x, y, q = 0;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var xx = x / W * 5 * k, yy = y / H * 3 * k;
      var s = 0.5 + 0.25 * Math.sin(xx + t) + 0.25 * Math.sin(yy * 1.6 - t * 0.8) + 0.2 * Math.sin((xx + yy) * 0.9 + t * 0.6) * Math.sin(t * 0.3);
      s = cl(s) * 5 + (bay[(y & 3) * 4 + (x & 3)] / 16 - 0.5);
      s = Math.max(0, Math.min(5, Math.round(s))) / 5; g.pal(s, c);
      d[q++] = c[0]; d[q++] = c[1]; d[q++] = c[2]; d[q++] = 255;
    }
    c2.putImageData(id, 0, 0); g.ctx.imageSmoothingEnabled = false; g.ctx.drawImage(cv, 0, 0, g.W, g.H); g.ctx.imageSmoothingEnabled = true;
  });

  // ================= Elementos e energia (desenhadas em canvas) =================
  function rng(seed) { var s = (Math.floor(seed) * 9301 + 49297) % 233280; if (s <= 0) s += 1000; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function glowOn(ctx, c, b) { ctx.shadowColor = rgba(c, 1); ctx.shadowBlur = b; }
  function glowOff(ctx) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }

  R('raios', 'Relâmpagos', 'Elementos', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, S = H / 540, period = 1.7, idx = Math.floor(g.t / period), ph = g.t / period - idx, i, b;
    bg(g, 0.94);
    var flash = ph < 0.4 ? Math.pow(1 - ph / 0.4, 2) * (0.65 + 0.35 * Math.sin(ph * 95)) : 0;
    if (flash <= 0.01) return;
    ctx.fillStyle = rgba(mix(g.c1, [255, 255, 255], 0.35), flash * 0.38); ctx.fillRect(0, 0, W, H);
    var bolts = 1 + (h1(idx * 3.3) > 0.5 ? 1 : 0);
    for (b = 0; b < bolts; b++) {
      var r = rng(idx * 17 + b * 5 + 3), list = [[W * (0.18 + 0.64 * r()), -10, (r() - 0.5) * 0.3, H * 1.05, 0]], it;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      while (list.length) {
        it = list.pop(); var x = it[0], y = it[1], ang = it[2], len = it[3], depth = it[4], seg = 16 * S, n = Math.floor(len / seg), pts = [[x, y]];
        for (i = 0; i < n; i++) {
          ang += (r() - 0.5) * 0.75; ang *= 0.94; x += Math.sin(ang) * seg; y += Math.cos(ang) * seg; pts.push([x, y]);
          if (depth < 2 && r() < 0.1) list.push([x, y, ang + (r() - 0.5) * 1.6, len * 0.45, depth + 1]);
          if (y > H + 20) break;
        }
        var wd = (3.2 - depth * 1.1) * S;
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        glowOn(ctx, g.c1, 28 * S); ctx.strokeStyle = rgba(g.c1, flash * 0.9); ctx.lineWidth = wd * 3; ctx.stroke();
        glowOff(ctx); ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(1, flash * 1.4).toFixed(3) + ')'; ctx.lineWidth = wd; ctx.stroke();
      }
    }
  });

  R('matrix', 'Chuva digital', 'Retrô', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, fs = Math.max(10, Math.round(H / 34 / g.k)), cols = Math.floor(W / fs), rows = Math.ceil(H / fs), trail = 18, chars = '0123456789ABCDEFGHJKLMNPRSTUVXYZ<>+=*#$%&?', i, j, hs = mix(g.c1, [255, 255, 255], 0.35);
    bg(g, 0.97); ctx.font = 'bold ' + fs + 'px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (i = 0; i < cols; i++) {
      var sp = 4 + h1(i) * 9, head = (t * sp + h1(i + 50) * 200) % (rows + trail * 1.6);
      for (j = 0; j < trail; j++) {
        var row = Math.floor(head) - j; if (row < 0 || row >= rows) continue;
        var a = Math.pow(1 - j / trail, 1.5), ci = Math.floor(h2(i, row) * chars.length + (h2(i + 9, row) > 0.7 ? Math.floor(t * 5) : 0)) % chars.length;
        ctx.fillStyle = j === 0 ? 'rgba(255,255,255,0.97)' : (j === 1 ? rgba(hs, a) : rgba(g.c1, a * 0.9));
        ctx.fillText(chars[ci], i * fs + fs / 2, row * fs);
      }
    }
  });

  R('solretro', 'Sol retrô', 'Retrô', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, hor = H * 0.64, cx = W / 2, cy = H * 0.45, R0 = H * 0.27 * g.k, i;
    var sky = ctx.createLinearGradient(0, 0, 0, hor); sky.addColorStop(0, rgba(mix(g.c1, [0, 0, 0], 0.97), 1)); sky.addColorStop(1, rgba(mix(g.c1, [0, 0, 0], 0.7), 1));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    for (i = 0; i < 60; i++) { var tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.8 + h1(i)) + i)); ctx.fillStyle = 'rgba(255,255,255,' + (tw * 0.8 * (1 - h1(i + 2) * 0.5)).toFixed(2) + ')'; ctx.fillRect(h1(i + 7) * W, h1(i + 3) * hor * 0.8, 1.5 * S, 1.5 * S); }
    var cv = g.cache.sun || (g.cache.sun = document.createElement('canvas'));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    var c2 = cv.getContext('2d'); c2.globalCompositeOperation = 'source-over'; c2.clearRect(0, 0, W, H);
    var gr = c2.createLinearGradient(0, cy - R0, 0, cy + R0); gr.addColorStop(0, rgba(g.c2, 1)); gr.addColorStop(1, rgba(g.c1, 1));
    c2.fillStyle = gr; c2.beginPath(); c2.arc(cx, cy, R0, 0, TAU); c2.fill();
    c2.globalCompositeOperation = 'destination-out';
    var f = (t * 0.18) % 1;
    for (i = 0; i < 9; i++) { var q = (i + f) / 9, y = cy - R0 * 0.1 + q * R0 * 1.15, th = (0.01 + 0.085 * q) * R0; c2.fillRect(cx - R0 - 4, y, R0 * 2 + 8, th); }
    var halo = ctx.createRadialGradient(cx, cy, R0 * 0.8, cx, cy, R0 * 1.7); halo.addColorStop(0, rgba(g.c1, 0.45)); halo.addColorStop(1, rgba(g.c1, 0)); ctx.fillStyle = halo; ctx.fillRect(0, 0, W, hor);
    ctx.drawImage(cv, 0, 0);
    ctx.fillStyle = rgba(mix(g.c1, [0, 0, 0], 0.96), 1); ctx.fillRect(0, hor, W, H - hor);
    ctx.strokeStyle = rgba(g.c1, 0.9); ctx.lineWidth = 1.6 * S;
    var ff = (t * 0.5) % 1;
    for (i = 0; i < 16; i++) { var z = (i + ff) / 16, y2 = hor + (H - hor) * z * z; ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(W, y2); ctx.stroke(); }
    for (i = -14; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(cx + i * W * 0.012, hor); ctx.lineTo(cx + i * W * 0.14, H); ctx.stroke(); }
    var hg = ctx.createLinearGradient(0, hor - 6 * S, 0, hor + 6 * S); hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.5, rgba(mix(g.c2, [255, 255, 255], 0.5), 0.9)); hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, hor - 6 * S, W, 12 * S);
  });

  R('tunelhex', 'Túnel hexagonal', 'Neon', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, cx = W / 2, cy = H / 2, n = 6, N = 15, f = (t * 0.45) % 1, i, k, c;
    bg(g, 0.96); ctx.lineJoin = 'round';
    for (i = 0; i < N; i++) {
      var z = (i + f) / N, rr = Math.pow(z, 2.3) * Math.hypot(W, H) * 0.62 * g.k + 2, rot = z * 1.3 + t * 0.12, al = sm(0, 0.12, z) * (1 - sm(0.88, 1, z));
      c = pk(g, 0.45 + 0.55 * z); ctx.strokeStyle = rgba(c, al); ctx.lineWidth = (1 + z * 5) * S; glowOn(ctx, c, (6 + z * 16) * S);
      ctx.beginPath(); for (k = 0; k <= n; k++) { var a = rot + k / n * TAU; k ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.stroke();
    }
    glowOff(ctx);
  });

  R('cubos', 'Cubos 3D ondulando', 'Geométricas', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, R0 = H / 7 / g.k, w = Math.sqrt(3) * R0, r, c, rows = Math.ceil(H / (R0 * 1.5)) + 4, cols = Math.ceil(W / w) + 3, s3 = Math.sqrt(3) / 2;
    bg(g, 0.9); ctx.lineJoin = 'round';
    for (r = -3; r < rows; r++) for (c = -2; c < cols; c++) {
      var cx = c * w + ((r & 1) ? w / 2 : 0), cy = r * R0 * 1.5, e = R0 * 0.95 * (0.5 + 0.5 * Math.sin(c * 0.55 + r * 0.42 - t * 1.5)), hgt = R0 + e, ty = cy - e;
      var top = pk(g, 0.88 - 0.1 * (e / R0)), left = pk(g, 0.52), right = pk(g, 0.28);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(1, H / 540);
      ctx.fillStyle = rgba(left, 1); ctx.beginPath(); ctx.moveTo(cx - s3 * R0, ty - R0 / 2); ctx.lineTo(cx, ty); ctx.lineTo(cx, ty + hgt); ctx.lineTo(cx - s3 * R0, ty - R0 / 2 + hgt); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = rgba(right, 1); ctx.beginPath(); ctx.moveTo(cx, ty); ctx.lineTo(cx + s3 * R0, ty - R0 / 2); ctx.lineTo(cx + s3 * R0, ty - R0 / 2 + hgt); ctx.lineTo(cx, ty + hgt); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = rgba(top, 1); ctx.beginPath(); ctx.moveTo(cx, ty - R0); ctx.lineTo(cx + s3 * R0, ty - R0 / 2); ctx.lineTo(cx, ty); ctx.lineTo(cx - s3 * R0, ty - R0 / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  });

  // ================= Festa =================
  R('confete', 'Confete', 'Festa', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, N = Math.round(220 * g.k), i, cols = [g.c1, g.c2, [255, 255, 255], hueCol(g, 120, 0.9, 0.55), hueCol(g, 240, 0.9, 0.55), hueCol(g, 60, 0.95, 0.6)];
    bg(g, 0.93);
    for (i = 0; i < N; i++) {
      var sp = 0.1 + 0.16 * h1(i + 3), y = (((h1(i) * 1.15 + t * sp) % 1.15) - 0.07) * H, x = (h1(i + 20) + Math.sin(t * (0.5 + h1(i + 5)) + i) * 0.03) * W;
      var rot = t * (1.5 + h1(i) * 4) + i, sx = Math.abs(Math.cos(t * (2 + h1(i + 8) * 3) + i)), w = (11 + 14 * h1(i + 2)) * S;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx * 0.9 + 0.1, 1);
      ctx.fillStyle = rgba(cols[Math.floor(h1(i + 11) * cols.length)], 1); ctx.fillRect(-w / 2, -w * 0.28, w, w * 0.56); ctx.restore();
    }
  });

  R('fogosart', 'Fogos de artifício', 'Festa', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, P = 3.2, b, p, j;
    bg(g, 0.97); ctx.globalCompositeOperation = 'lighter';
    for (b = 0; b < 5; b++) {
      var tb = t - b * (P / 5), cyc = Math.floor(tb / P), age = tb - cyc * P, seed = cyc * 5 + b + 1;
      if (age < 0) continue;
      var ox = W * (0.14 + 0.72 * h1(seed)), oy = H * (0.16 + 0.34 * h1(seed + 3)), L = 0.8;
      var col = h1(seed + 8) < 0.5 ? g.c1 : (h1(seed + 8) < 0.8 ? g.c2 : [255, 235, 190]);
      if (age < L) {
        var pr = age / L, ry = H - (H - oy) * (1 - Math.pow(1 - pr, 2));
        ctx.fillStyle = 'rgba(255,230,180,0.9)'; ctx.fillRect(ox - S, ry, 2 * S, 14 * S); continue;
      }
      var a2 = age - L, life = 2.0; if (a2 > life) continue;
      var Rr = H * (0.26 + 0.14 * h1(seed + 9)), np = 110, hot = mix(col, [255, 255, 255], 0.35);
      ctx.lineCap = 'round';
      for (p = 0; p < np; p++) {
        var ang = h2(seed, p) * TAU, sp = Math.sqrt(0.3 + 0.7 * h2(seed + 500, p)), px = 0, py = 0, have = false;
        for (j = 0; j < 7; j++) {
          var aa = a2 - j * 0.04; if (aa < 0) break;
          var d = Rr * sp * (1 - Math.exp(-aa * 3.2)), x = ox + Math.cos(ang) * d, y = oy + Math.sin(ang) * d + H * 0.2 * aa * aa;
          var al = Math.pow(1 - aa / life, 1.4) * (1 - j / 7) * (0.8 + 0.2 * Math.sin(t * 30 + p));
          if (have) { ctx.strokeStyle = rgba(j === 1 ? hot : col, al); ctx.lineWidth = (3.6 - j * 0.35) * S; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke(); }
          px = x; py = y; have = true;
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  R('bolhas', 'Bolhas de sabão', 'Festa', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, N = Math.round(16 * g.k), i, hs = U.toHsl(g.c1);
    var gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, rgba(mix(g.c1, [0, 0, 0], 0.9), 1)); gr.addColorStop(1, rgba(mix(g.c2, [0, 0, 0], 0.8), 1)); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    for (i = 0; i < N; i++) {
      var r = (28 + 62 * h1(i + 1)) * S, pr = (t * (0.04 + 0.05 * h1(i + 2)) + h1(i + 3)) % 1, x = (h1(i) + Math.sin(t * 0.5 + i * 2) * 0.04) * W, y = H + r - pr * (H + 2 * r);
      var a = U.fromHsl(hs[0] + t * 30 + i * 47, 0.9, 0.65, [0, 0, 0]), b = U.fromHsl(hs[0] + t * 30 + i * 47 + 140, 0.9, 0.65, [0, 0, 0]);
      var rg = ctx.createRadialGradient(x, y, r * 0.55, x, y, r); rg.addColorStop(0, 'rgba(255,255,255,0.02)'); rg.addColorStop(0.75, rgba(a, 0.14)); rg.addColorStop(0.92, rgba(b, 0.5)); rg.addColorStop(1, rgba(a, 0.08));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2.2 * S; ctx.beginPath(); ctx.arc(x, y, r * 0.8, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(x + r * 0.45, y + r * 0.5, r * 0.07, 0, TAU); ctx.fill();
    }
  });

  R('painelled', 'Painel de LED', 'Festa', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, s = H / (22 * g.k), cols = Math.ceil(W / s), rows = Math.ceil(H / s), x, y, c = [0, 0, 0];
    ctx.fillStyle = '#050507'; ctx.fillRect(0, 0, W, H);
    for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
      var d = Math.hypot(x - cols / 2, (y - rows / 2) * 1.2), v = 0.5 + 0.5 * Math.sin(d * 0.42 - t * 2.4) * 0.7 + 0.25 * Math.sin(x * 0.3 + y * 0.2 + t);
      g.pal(cl(v), c); ctx.fillStyle = rgba(c, 1); var m = s * 0.09; ctx.fillRect(x * s + m, y * s + m, s - 2 * m, s - 2 * m);
    }
  });

  // ================= Linhas e música =================
  R('ondasom', 'Ondas de áudio', 'Música', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, L = 9, l, x, c;
    bg(g, 0.95); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
    for (l = 0; l < L; l++) {
      var amp = H * 0.2 * g.k * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.9 + l * 0.45))); c = pk(g, 0.4 + 0.6 * l / (L - 1));
      ctx.strokeStyle = rgba(c, 0.75); ctx.lineWidth = (1 + (L - l) * 0.35) * S; glowOn(ctx, c, 12 * S); ctx.beginPath();
      for (x = 0; x <= W; x += 4) { var e = Math.pow(Math.sin(Math.PI * x / W), 2), y = H / 2 + amp * e * Math.sin(x / W * TAU * (2 + l * 0.17) + t * (1.4 + l * 0.12) + l); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    glowOff(ctx); ctx.globalCompositeOperation = 'source-over';
  });

  R('eqradial', 'Equalizador circular', 'Música', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, cx = W / 2, cy = H / 2, n = 84, r0 = H * 0.2 * g.k, i, c;
    bg(g, 0.95); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, (TAU * r0 / n) * 0.55);
    var beat = 0.5 + 0.5 * Math.pow(Math.abs(Math.sin(t * 2.2)), 6);
    for (i = 0; i < n; i++) {
      var a = i / n * TAU + t * 0.12, m = (0.5 + 0.5 * Math.sin(i * 0.5 + t * 3)) * 0.45 + vn(i * 0.55, t * 2) * 0.75, len = H * 0.22 * m * (0.6 + 0.4 * beat) + 4 * S;
      c = pk(g, 0.3 + 0.7 * cl(m)); ctx.strokeStyle = rgba(c, 1); glowOn(ctx, c, 10 * S);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); ctx.stroke();
    }
    glowOff(ctx);
    var rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r0 * 0.95); rg.addColorStop(0, rgba(mix(g.c2, [255, 255, 255], 0.4), 0.5 * beat)); rg.addColorStop(1, rgba(g.c1, 0)); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, r0 * 0.95, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(g.c2, 0.8); ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.arc(cx, cy, r0 * 0.9, 0, TAU); ctx.stroke();
  });

  R('ecg', 'Batimento ECG', 'Música', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, rowsN = 3, r, x, i;
    function ga(p, m, s) { return Math.exp(-Math.pow((p - m) / s, 2)); }
    function ecg(p) { return ga(p, 0.14, 0.03) * 0.13 - ga(p, 0.285, 0.007) * 0.14 + ga(p, 0.31, 0.009) * 1 - ga(p, 0.34, 0.01) * 0.3 + ga(p, 0.55, 0.045) * 0.24; }
    bg(g, 0.95); ctx.strokeStyle = rgba(g.c1, 0.12); ctx.lineWidth = S;
    for (i = 0; i < 30; i++) { ctx.beginPath(); ctx.moveTo(i * W / 24, 0); ctx.lineTo(i * W / 24, H); ctx.stroke(); }
    for (i = 0; i < 20; i++) { ctx.beginPath(); ctx.moveTo(0, i * H / 12); ctx.lineTo(W, i * H / 12); ctx.stroke(); }
    ctx.lineJoin = 'round';
    for (r = 0; r < rowsN; r++) {
      var cy = H * (0.25 + 0.25 * r), amp = H * (0.14 + 0.02 * r) * g.k, beats = 2.2 + r * 0.4, sp = 0.5 + r * 0.12, gr = ctx.createLinearGradient(0, 0, W, 0);
      var col = pk(g, 0.55 + 0.2 * r); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.6, rgba(col, 0.9)); gr.addColorStop(1, 'rgba(255,255,255,1)');
      ctx.strokeStyle = gr; ctx.lineWidth = 3 * S; glowOn(ctx, col, 12 * S); ctx.beginPath();
      for (x = 0; x <= W; x += 3) { var p = (((x / W * beats - t * sp * beats * 0.5) % 1) + 1) % 1, y = cy - ecg(p) * amp; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    glowOff(ctx);
  });

  R('setas', 'Setas neon', 'Neon', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, rows = 7, rs = H / rows, sp = H / 3 / g.k, i, x, c;
    bg(g, 0.95); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = rs * 0.2;
    for (i = 0; i < rows; i++) {
      var dir = (i & 1) ? -1 : 1, off = ((t * H * 0.3 * dir) % sp + sp) % sp, y = (i + 0.5) * rs; c = pk(g, 0.4 + 0.6 * i / (rows - 1));
      for (x = -sp * 2; x < W + sp * 2; x += sp) {
        var px = x + off, al = 0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(px / W * TAU - t * 2 * dir), 2), hh = rs * 0.3, a = rs * 0.28 * dir;
        ctx.strokeStyle = rgba(c, al); glowOn(ctx, c, 14 * S);
        ctx.beginPath(); ctx.moveTo(px - a, y - hh); ctx.lineTo(px + a, y); ctx.lineTo(px - a, y + hh); ctx.stroke();
      }
    }
    glowOff(ctx);
  });

  // ================= Espaço e tecnologia =================
  R('galaxia', 'Galáxia', 'Espaço', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, cx = W / 2, cy = H / 2, R0 = H * 0.62 * g.k, N = Math.round(2600 * g.k), i, c;
    bg(g, 0.98);
    for (i = 0; i < 90; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + 0.5 * Math.abs(Math.sin(t * (0.5 + h1(i)) + i))).toFixed(2) + ')'; ctx.fillRect(h1(i + 100) * W, h1(i + 200) * H, 1.4 * S, 1.4 * S); }
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.35); ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < N; i++) {
      var q = Math.pow(h1(i * 1.7), 0.75), rr = q * R0, arm = i % 3, th = arm * TAU / 3 + q * 6 + (h1(i + 3) - 0.5) * 0.9 * (1.1 - q * 0.5) + t * 0.18 * (1.3 - q);
      var x = Math.cos(th) * rr, y = Math.sin(th) * rr * 0.5, sz = (0.7 + 1.6 * h1(i + 9)) * S * (1.2 - q * 0.5);
      c = q < 0.25 ? mix([255, 240, 210], g.c1, q * 4) : mix(g.c1, g.c2, (q - 0.25) / 0.75);
      ctx.fillStyle = rgba(c, 0.25 + 0.6 * h1(i + 5)); ctx.fillRect(x, y, sz, sz);
    }
    var rg = ctx.createRadialGradient(0, 0, 0, 0, 0, R0 * 0.32); rg.addColorStop(0, 'rgba(255,245,225,0.95)'); rg.addColorStop(0.3, rgba(mix(g.c1, [255, 255, 255], 0.3), 0.45)); rg.addColorStop(1, rgba(g.c1, 0));
    ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(0, 0, R0 * 0.34, R0 * 0.2, 0, 0, TAU); ctx.fill();
    ctx.restore();
  });

  R('circuito', 'Circuito pulsante', 'Tecnologia', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, cs = H / 16 / g.k, key = W + 'x' + H + 'x' + g.k, ca = g.cache, i, j;
    if (ca.cirKey !== key) {
      ca.cirKey = key; ca.tr = [];
      var r = rng(77), dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], cols = Math.ceil(W / cs), rows = Math.ceil(H / cs);
      for (i = 0; i < 46; i++) {
        var x = Math.floor(r() * cols), y = Math.floor(r() * rows), d = Math.floor(r() * 8), pts = [[x * cs, y * cs]], tot = 0, steps = 6 + Math.floor(r() * 8);
        for (j = 0; j < steps; j++) {
          var len = 1 + Math.floor(r() * 3); x += dirs[d][0] * len; y += dirs[d][1] * len; var px = pts[pts.length - 1];
          pts.push([x * cs, y * cs]); tot += Math.hypot(x * cs - px[0], y * cs - px[1]); d = (d + (r() < 0.5 ? 1 : 7)) % 8;
        }
        ca.tr.push({ p: pts, L: tot, sp: 0.15 + r() * 0.3, off: r() * 10 });
      }
    }
    bg(g, 0.95); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    function seg(tr, a, b) {
      var acc = 0, started = false, k, p0, p1, sl, u0, u1;
      ctx.beginPath();
      for (k = 1; k < tr.p.length; k++) {
        p0 = tr.p[k - 1]; p1 = tr.p[k]; sl = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        if (acc + sl >= a && acc <= b) {
          u0 = Math.max(0, (a - acc) / sl); u1 = Math.min(1, (b - acc) / sl);
          if (!started) { ctx.moveTo(p0[0] + (p1[0] - p0[0]) * u0, p0[1] + (p1[1] - p0[1]) * u0); started = true; }
          else ctx.lineTo(p0[0], p0[1]);
          ctx.lineTo(p0[0] + (p1[0] - p0[0]) * u1, p0[1] + (p1[1] - p0[1]) * u1);
        }
        acc += sl;
      }
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(g.c1, 0.3); ctx.lineWidth = 2 * S;
    for (i = 0; i < ca.tr.length; i++) { var tr = ca.tr[i]; ctx.beginPath(); ctx.moveTo(tr.p[0][0], tr.p[0][1]); for (j = 1; j < tr.p.length; j++) ctx.lineTo(tr.p[j][0], tr.p[j][1]); ctx.stroke(); ctx.fillStyle = rgba(g.c1, 0.5); ctx.beginPath(); ctx.arc(tr.p[0][0], tr.p[0][1], 4 * S, 0, TAU); ctx.fill(); var e = tr.p[tr.p.length - 1]; ctx.beginPath(); ctx.arc(e[0], e[1], 4 * S, 0, TAU); ctx.fill(); }
    ctx.lineWidth = 3.2 * S;
    for (i = 0; i < ca.tr.length; i++) {
      var q = ca.tr[i], span = q.L + 160 * S, hd = (t * q.sp * 600 * S + q.off * 100 * S) % span, c = pk(g, 0.55 + 0.45 * h1(i));
      glowOn(ctx, c, 12 * S); ctx.strokeStyle = rgba(mix(c, [255, 255, 255], 0.6), 1); seg(q, Math.max(0, hd - 90 * S), Math.min(q.L, hd));
    }
    glowOff(ctx);
  });

  R('plexo', 'Rede de partículas', 'Tecnologia', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, N = Math.round(72 * g.k), xs = [], ys = [], i, j, md = H * 0.22;
    bg(g, 0.95);
    for (i = 0; i < N; i++) { xs.push((0.5 + 0.48 * Math.sin(t * (0.1 + 0.14 * h2(i, 1)) + h2(i, 2) * TAU)) * W); ys.push((0.5 + 0.48 * Math.sin(t * (0.09 + 0.12 * h2(i, 3)) + h2(i, 4) * TAU)) * H); }
    ctx.lineWidth = 1.3 * S;
    for (i = 0; i < N; i++) for (j = i + 1; j < N; j++) {
      var d = Math.hypot(xs[i] - xs[j], ys[i] - ys[j]); if (d > md) continue;
      ctx.strokeStyle = rgba(pk(g, 0.5 + 0.5 * (1 - d / md)), (1 - d / md) * 0.7); ctx.beginPath(); ctx.moveTo(xs[i], ys[i]); ctx.lineTo(xs[j], ys[j]); ctx.stroke();
    }
    glowOn(ctx, g.c2, 10 * S);
    for (i = 0; i < N; i++) { ctx.fillStyle = rgba(mix(g.c2, [255, 255, 255], 0.35), 1); ctx.beginPath(); ctx.arc(xs[i], ys[i], (2 + 2.2 * h1(i + 6)) * S, 0, TAU); ctx.fill(); }
    glowOff(ctx);
  });

  R('dna', 'DNA', 'Tecnologia', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, hx, n = 52, i, items;
    bg(g, 0.95);
    for (hx = 0; hx < 2; hx++) {
      var cy = H * (hx ? 0.74 : 0.27), amp = H * 0.13 * g.k, dir = hx ? -1 : 1; items = [];
      for (i = 0; i < n; i++) {
        var x = i / (n - 1) * W, ph = x / W * TAU * 2 + t * 1.4 * dir + hx * 1.3, s1 = Math.sin(ph), z1 = Math.cos(ph);
        ctx.strokeStyle = rgba(mix(g.c1, g.c2, 0.5), 0.35); ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.moveTo(x, cy + s1 * amp); ctx.lineTo(x, cy - s1 * amp); ctx.stroke();
        items.push([x, cy + s1 * amp, z1, 0]); items.push([x, cy - s1 * amp, -z1, 1]);
      }
      items.sort(function (a, b) { return a[2] - b[2]; });
      for (i = 0; i < items.length; i++) {
        var it = items[i], c = it[3] ? g.c2 : g.c1, r = (7 + 4 * it[2]) * S, a = 0.55 + 0.45 * (it[2] * 0.5 + 0.5);
        glowOn(ctx, c, 14 * S); ctx.fillStyle = rgba(mix(c, [255, 255, 255], 0.2 + 0.2 * it[2]), a); ctx.beginPath(); ctx.arc(it[0], it[1], r, 0, TAU); ctx.fill();
      }
      glowOff(ctx);
    }
  });

  R('terreno', 'Terreno wireframe', 'Tecnologia', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, rows = 30, hor = H * 0.36, sc = t * 0.9, f = sc % 1, base = Math.floor(sc), j, i, nx = 70, bgc = mix(g.c1, [0, 0, 0], 0.95);
    ctx.fillStyle = rgba(bgc, 1); ctx.fillRect(0, 0, W, H);
    var sky = ctx.createLinearGradient(0, 0, 0, hor); sky.addColorStop(0, rgba(bgc, 1)); sky.addColorStop(1, rgba(mix(g.c2, [0, 0, 0], 0.7), 1)); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hor);
    ctx.lineJoin = 'round';
    for (j = 0; j < rows; j++) {
      var zi = (j + (1 - f)) / rows, ys = hor + (H - hor) * Math.pow(zi, 2.2), spread = 0.1 + zi * 1.7, wr = j - base + 1000, pts = [];
      for (i = 0; i <= nx; i++) {
        var xw = i / nx * 2 - 1, amp = (0.1 + Math.pow(Math.abs(xw), 1.3) * 1.1) * H * 0.8 * zi * g.k, hgt = (vn(xw * 2.4 + 5, wr * 0.5) - 0.15) * amp;
        pts.push([W / 2 + xw * W * 0.52 * spread, ys - Math.max(0, hgt)]);
      }
      ctx.beginPath(); ctx.moveTo(pts[0][0], H + 4); for (i = 0; i <= nx; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[nx][0], H + 4); ctx.closePath(); ctx.fillStyle = rgba(bgc, 1); ctx.fill();
      var c = pk(g, 0.4 + 0.6 * zi); ctx.strokeStyle = rgba(c, Math.min(1, 0.15 + zi * 1.2)); ctx.lineWidth = (0.8 + zi * 2.4) * S; glowOn(ctx, c, 6 * S * zi);
      ctx.beginPath(); for (i = 0; i <= nx; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]); ctx.stroke();
    }
    glowOff(ctx);
  });

  R('joy', 'Pulsar (linhas empilhadas)', 'Tecnologia', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, rows = Math.round(34 * g.k), j, i, nx = 180, bgc = mix(g.c1, [0, 0, 0], 0.97), line = mix(g.c1, [255, 255, 255], 0.55);
    ctx.fillStyle = rgba(bgc, 1); ctx.fillRect(0, 0, W, H); ctx.lineJoin = 'round';
    for (j = 0; j < rows; j++) {
      var y = H * 0.14 + j / (rows - 1) * H * 0.74, pts = [];
      for (i = 0; i <= nx; i++) {
        var x = i / nx, env = Math.exp(-Math.pow((x - 0.5) / 0.2, 2)), n = vn(x * 16 + j * 0.37, j * 0.3 - t * 1.1) * 0.8 + vn(x * 31 - t * 0.5, j * 0.7) * 0.4;
        pts.push([W * (0.12 + 0.76 * x), y - env * n * H * 0.14 * g.k]);
      }
      ctx.beginPath(); ctx.moveTo(pts[0][0], y + 3 * S); for (i = 0; i <= nx; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[nx][0], y + 3 * S); ctx.closePath(); ctx.fillStyle = rgba(bgc, 1); ctx.fill();
      ctx.beginPath(); for (i = 0; i <= nx; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.strokeStyle = rgba(mix(line, g.c2, j / rows * 0.6), 1); ctx.lineWidth = 1.8 * S; ctx.stroke();
    }
  });

  R('orbitas', 'Órbitas', 'Espaço', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, cx = W / 2, cy = H / 2, o, s, c;
    bg(g, 0.96); ctx.globalCompositeOperation = 'lighter';
    for (o = 0; o < 5; o++) {
      var rx = H * (0.14 + 0.1 * o) * g.k, ry = rx * 0.4, tilt = o * 0.55 + t * 0.04 * (o & 1 ? 1 : -1), ang = t * (1.5 - 0.22 * o) + o * 1.3; c = pk(g, 0.4 + 0.6 * o / 4);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
      ctx.strokeStyle = rgba(c, 0.22); ctx.lineWidth = 1.5 * S; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.stroke();
      for (s = 0; s < 30; s++) { var a = ang - s * 0.045; ctx.fillStyle = rgba(c, (1 - s / 30) * 0.65); ctx.beginPath(); ctx.arc(Math.cos(a) * rx, Math.sin(a) * ry, (7 - s * 0.19) * S, 0, TAU); ctx.fill(); }
      var hx = Math.cos(ang) * rx, hy = Math.sin(ang) * ry, rg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 22 * S); rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.3, rgba(c, 0.6)); rg.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(hx, hy, 22 * S, 0, TAU); ctx.fill(); ctx.restore();
    }
    var sr = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * 0.12); sr.addColorStop(0, 'rgba(255,255,255,0.95)'); sr.addColorStop(0.25, rgba(g.c2, 0.7)); sr.addColorStop(1, rgba(g.c2, 0));
    ctx.fillStyle = sr; ctx.beginPath(); ctx.arc(cx, cy, H * 0.12, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  });

  R('meteoros', 'Chuva de meteoros', 'Espaço', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, i, N = Math.round(14 * g.k), ang = 0.5;
    var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, rgba(mix(g.c1, [0, 0, 0], 0.97), 1)); sky.addColorStop(1, rgba(mix(g.c1, [0, 0, 0], 0.75), 1)); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    for (i = 0; i < 140; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.6 * Math.abs(Math.sin(t * (0.4 + h1(i)) + i))).toFixed(2) + ')'; ctx.fillRect(h1(i + 300) * W, h1(i + 400) * H, 1.5 * S, 1.5 * S); }
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (i = 0; i < N; i++) {
      var Pm = 2.2 + 3 * h1(i + 1), tt = t + h1(i + 2) * 20, cyc = Math.floor(tt / Pm), age = (tt - cyc * Pm) / Pm; if (age > 0.28) continue;
      var u = age / 0.28, sx = W * (0.2 + 1.0 * h1(cyc * 14 + i)), sy = -H * 0.1 + H * 0.4 * h1(cyc * 7 + i + 3), dist = H * 1.0, dx = -Math.sin(ang), dy = Math.cos(ang);
      var x = sx + dx * dist * u, y = sy + dy * dist * u, len = H * (0.18 + 0.14 * h1(i + 5)), al = Math.sin(u * Math.PI);
      var gr = ctx.createLinearGradient(x, y, x - dx * len, y - dy * len); gr.addColorStop(0, 'rgba(255,255,255,' + al.toFixed(2) + ')'); gr.addColorStop(0.3, rgba(g.c1, al * 0.6)); gr.addColorStop(1, rgba(g.c2, 0));
      ctx.strokeStyle = gr; ctx.lineWidth = 3 * S; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dx * len, y - dy * len); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  R('laser', 'Show de lasers', 'Festa', function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, S = H / 540, i, s, srcs = [[W / 2, H * 1.04, -Math.PI / 2, 1.2], [W * 0.1, H * 1.04, -Math.PI / 2.4, 0.9], [W * 0.9, H * 1.04, -Math.PI / 1.7, 0.9]];
    bg(g, 0.97); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (s = 0; s < srcs.length; s++) {
      var sr = srcs[s], M = s ? 9 : 16 * g.k;
      for (i = 0; i < M; i++) {
        var a = sr[2] + Math.sin(t * (0.7 + 0.1 * s) + i * (0.32 + 0.04 * s) + s * 2) * sr[3] * (0.6 + 0.4 * Math.sin(t * 0.4 + s)), c = pk(g, ((i + s) % 2) ? 0.95 : 0.55);
        ctx.strokeStyle = rgba(c, 0.22); ctx.lineWidth = 9 * S; ctx.beginPath(); ctx.moveTo(sr[0], sr[1]); ctx.lineTo(sr[0] + Math.cos(a) * H * 2, sr[1] + Math.sin(a) * H * 2); ctx.stroke();
        ctx.strokeStyle = rgba(mix(c, [255, 255, 255], 0.5), 0.9); ctx.lineWidth = 2 * S; ctx.stroke();
      }
    }
    for (s = 0; s < srcs.length; s++) { var hz = ctx.createRadialGradient(srcs[s][0], srcs[s][1], 0, srcs[s][0], srcs[s][1], H * 0.35); hz.addColorStop(0, rgba(g.c2, 0.55)); hz.addColorStop(1, rgba(g.c2, 0)); ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H * 1.1); }
    ctx.globalCompositeOperation = 'source-over';
  });
})(typeof window !== 'undefined' ? window : globalThis);
