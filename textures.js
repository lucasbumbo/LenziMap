// Biblioteca de texturas animadas geradas por código. Originais, sem arquivos e sem direitos autorais.
// Cada textura é uma função do tempo, então funciona em qualquer resolução e nunca repete de forma visível.
(function (root) {
  'use strict';
  var TAU = Math.PI * 2;

  function h1(n) {
    var x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
  function h2(ix, iy) {
    var n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  function vnoise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(x, y, oct) {
    var v = 0, a = 0.5;
    for (var i = 0; i < oct; i++) { v += a * vnoise(x, y); x = x * 2.03 + 11.7; y = y * 2.03 + 3.1; a *= 0.5; }
    return v;
  }
  function clamp01(u) { return u < 0 ? 0 : (u > 1 ? 1 : u); }
  function smooth(a, b, x) { var u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); }

  function hex(c) {
    var m = /^#?([0-9a-f]{6})$/i.exec(c || '');
    var n = m ? parseInt(m[1], 16) : 0xff4fa3;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function fromHsl(h, s, l, o) {
    h = ((h % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    o = o || [0, 0, 0];
    o[0] = (r + m) * 255; o[1] = (g + m) * 255; o[2] = (b + m) * 255;
    return o;
  }
  function toHex(c) {
    function p(v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }
    return '#' + p(c[0]) + p(c[1]) + p(c[2]);
  }
  // Segunda cor automática: mesma cor com o tom girado
  function autoColor2(color) {
    var hs = toHsl(hex(color));
    return toHex(fromHsl(hs[0] + 55, Math.max(hs[1], 0.6), Math.min(Math.max(hs[2], 0.45), 0.6)));
  }
  function mix(a, b, u) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
  function rgba(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a < 0 ? 0 : (a > 1 ? 1 : a)).toFixed(3) + ')'; }

  function makePal(c1, c2) {
    var dark = [c1[0] * 0.06, c1[1] * 0.06, c1[2] * 0.06];
    return function (u, o) {
      u = clamp01(u);
      var a, b, k;
      if (u < 0.5) { a = dark; b = c1; k = u * 2; } else { a = c1; b = c2; k = (u - 0.5) * 2; }
      o[0] = a[0] + (b[0] - a[0]) * k; o[1] = a[1] + (b[1] - a[1]) * k; o[2] = a[2] + (b[2] - a[2]) * k;
      return o;
    };
  }

  // Desenha por pixel numa resolução baixa e estica. Dá aquele visual suave de shader.
  function shade(g, rw, rh, fn) {
    var cache = g.cache;
    var cv = cache.px;
    if (!cv || cv.width !== rw || cv.height !== rh) {
      cv = cache.px = document.createElement('canvas');
      cv.width = rw; cv.height = rh;
      cache.id = null;
    }
    var c2 = cv.getContext('2d');
    var id = cache.id || (cache.id = c2.createImageData(rw, rh));
    var d = id.data, k = 0, x, y, o = [0, 0, 0, 255];
    for (y = 0; y < rh; y++) {
      for (x = 0; x < rw; x++) {
        o[3] = 255;
        fn((x + 0.5) / rw, (y + 0.5) / rh, o);
        d[k++] = o[0]; d[k++] = o[1]; d[k++] = o[2]; d[k++] = o[3];
      }
    }
    c2.putImageData(id, 0, 0);
    g.ctx.imageSmoothingEnabled = true;
    g.ctx.drawImage(cv, 0, 0, g.W, g.H);
  }

  var T = {};

  // ---------- Orgânicas ----------
  T.aurora = function (g) {
    var tt = g.t, k = g.k;
    shade(g, 144, 81, function (u, v, o) {
      var I = 0, r = 0, gg = 0, bb = 0, b, col, w, yc, hh;
      for (b = 0; b < 4; b++) {
        yc = 0.4 + 0.06 * b + Math.sin(u * TAU * 0.9 * k + tt * 0.5 + b * 1.7) * 0.1 + Math.sin(u * TAU * 2.3 * k - tt * 0.8 + b) * 0.04;
        hh = 0.2 + 0.05 * Math.sin(u * 6 * k + tt + b);
        w = (v - yc) / hh;
        w = Math.exp(-w * w * 2.2) * (0.55 + 0.45 * Math.sin(u * 9 * k + tt * 1.3 + b * 2));
        col = mix(g.c1, g.c2, b / 3);
        r += col[0] * w; gg += col[1] * w; bb += col[2] * w; I += w;
      }
      o[0] = I ? r / I : 0; o[1] = I ? gg / I : 0; o[2] = I ? bb / I : 0;
      o[3] = 255 * Math.min(1, I * 0.85);
    });
  };

  T.plasma = function (g) {
    var t = g.t, k = g.k;
    shade(g, 112, 63, function (u, v, o) {
      var x = u * 4.8 * k, y = v * 3 * k;
      var s = Math.sin(x + t) + Math.sin(y * 1.3 - t * 0.7) + Math.sin((x + y) * 0.8 + t * 0.5) + Math.sin(Math.hypot(x - 2.4, y - 1.5) * 1.4 - t);
      g.pal(0.5 + 0.5 * Math.sin(s * 1.25 + t * 0.3), o);
    });
  };

  T.malha = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k, i;
    ctx.fillStyle = rgba(mix(g.c1, [0, 0, 0], 0.9), 1);
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';
    for (i = 0; i < 5; i++) {
      var cx = W * (0.5 + 0.38 * Math.sin(t * 0.35 + i * 1.9)), cy = H * (0.5 + 0.38 * Math.cos(t * 0.29 + i * 2.6));
      var r = Math.max(W, H) * (0.34 + 0.08 * Math.sin(t + i)) * k, col = mix(g.c1, g.c2, i / 4);
      var gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, rgba(col, 0.9));
      gr.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  T.lava = function (g) {
    var t = g.t, k = g.k, bl = [], i;
    for (i = 0; i < 7; i++) {
      bl.push([0.5 + 0.38 * Math.sin(t * 0.37 * (0.6 + h1(i)) + i * 2.1), 0.5 + 0.4 * Math.cos(t * 0.31 * (0.6 + h1(i + 9)) + i * 1.3), (0.1 + 0.07 * h1(i + 3)) * k]);
    }
    shade(g, 128, 72, function (u, v, o) {
      var f = 0, j, dx, dy;
      for (j = 0; j < 7; j++) {
        dx = (u - bl[j][0]) * 1.78; dy = v - bl[j][1];
        f += bl[j][2] * bl[j][2] / (dx * dx + dy * dy + 0.0001);
      }
      var inside = smooth(0.85, 1.15, f);
      g.pal(0.12 + 0.88 * Math.min(1, f * 0.3), o);
      o[0] *= 0.25 + 0.75 * inside; o[1] *= 0.25 + 0.75 * inside; o[2] *= 0.25 + 0.75 * inside;
    });
  };

  T.marmore = function (g) {
    var t = g.t * 0.35, k = g.k;
    shade(g, 112, 63, function (u, v, o) {
      var x = u * 3.2 * k, y = v * 1.8 * k;
      var qx = fbm(x + t * 0.3, y, 3), qy = fbm(x + 5.2, y + 1.3 - t * 0.2, 3);
      var rx = fbm(x + 3.5 * qx + 1.7, y + 3.5 * qy + 9.2 + t * 0.15, 3);
      var f = fbm(x + 4 * rx, y + 4 * qy, 3);
      var bands = 0.5 + 0.5 * Math.sin(f * 16 + t * 2);
      g.pal(f * 1.1 + bands * 0.35, o);
    });
  };

  T.nebulosa = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t * 0.25, k = g.k, i;
    shade(g, 120, 68, function (u, v, o) {
      var x = u * 3.4 * k, y = v * 2 * k;
      var f = fbm(x + t, y - t * 0.6, 4), f2 = fbm(x * 1.5 - 4 + t * 0.4, y * 1.5 + 2, 3);
      var c = Math.pow(f, 2.2) * 2.4 + f2 * 0.35;
      g.pal(c, o);
    });
    for (i = 0; i < 90; i++) {
      var tw = 0.4 + 0.6 * Math.abs(Math.sin(g.t * 0.8 + i));
      ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * tw).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(h1(i) * W, h1(i + 200) * H, (0.5 + h1(i + 400) * 1.6) * H / 540, 0, TAU);
      ctx.fill();
    }
  };

  T.holo = function (g) {
    var t = g.t, k = g.k, h0 = toHsl(g.c1)[0];
    shade(g, 128, 72, function (u, v, o) {
      var a = (u * 1.6 + v * 1.0) * 2.4 * k + t * 0.25 + Math.sin(v * 5 + t * 0.8) * 0.35 + Math.sin(u * 4 - t * 0.6) * 0.3;
      fromHsl(h0 + a * 110, 0.75, 0.62 + 0.12 * Math.sin(a * 6), o);
    });
  };

  // ---------- Geométricas e tecnológicas ----------
  T.tunel = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k, hy = H * 0.5, i, gr;
    gr = ctx.createLinearGradient(0, 0, 0, hy);
    gr.addColorStop(0, rgba(mix(g.c1, [0, 0, 0], 0.92), 1));
    gr.addColorStop(1, rgba(mix(g.c2, [0, 0, 0], 0.45), 1));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, hy);
    ctx.fillStyle = rgba(mix(g.c1, [0, 0, 0], 0.93), 1); ctx.fillRect(0, hy, W, H - hy);
    // sol
    var sr = H * 0.2, sg = ctx.createLinearGradient(0, hy - sr * 1.6, 0, hy);
    sg.addColorStop(0, rgba(g.c2, 1)); sg.addColorStop(1, rgba(g.c1, 1));
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, hy); ctx.clip();
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(W / 2, hy, sr, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.lineWidth = Math.max(1, H / 360 * 2);
    ctx.shadowColor = rgba(g.c1, 1); ctx.shadowBlur = 8 * H / 540;
    ctx.strokeStyle = rgba(g.c1, 0.95);
    ctx.beginPath();
    for (i = -18; i <= 18; i++) { ctx.moveTo(W / 2 + i * W * 0.012 / k, hy); ctx.lineTo(W / 2 + i * W * 0.16 / k, H); }
    ctx.stroke();
    var n = 12;
    for (i = 0; i < n; i++) {
      var z = ((i + (t * 0.5 % 1)) / n), y = hy + (H - hy) * z * z;
      ctx.strokeStyle = rgba(g.c1, 0.2 + 0.8 * z);
      ctx.lineWidth = Math.max(1, (1 + z * 3) * H / 540);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(g.c2, 0.9); ctx.lineWidth = 2 * H / 540;
    ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();
  };

  T.hexagonos = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k;
    var s = H / 9 / k, w = Math.sqrt(3) * s, row, col, i;
    ctx.lineWidth = Math.max(1, H / 270);
    for (row = -1; row < H / (s * 1.5) + 2; row++) {
      for (col = -1; col < W / w + 2; col++) {
        var cx = col * w + (row & 1 ? w / 2 : 0), cy = row * s * 1.5;
        var d = Math.hypot(cx - W / 2, cy - H / 2) / H;
        var a = 0.5 + 0.5 * Math.sin(t * 1.4 - d * 7 + h2(col, row) * 2);
        var a3 = a * a * a;
        ctx.beginPath();
        for (i = 0; i < 6; i++) {
          var an = TAU / 6 * i + TAU / 12;
          var px = cx + Math.cos(an) * (s - 2), py = cy + Math.sin(an) * (s - 2);
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = rgba(g.c2, a3 * a3 * 0.5);
        ctx.fill();
        ctx.strokeStyle = rgba(g.c1, 0.18 + 0.82 * a3);
        ctx.stroke();
      }
    }
  };

  T.radar = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, i;
    var cx = W / 2, cy = H / 2, R = H * 0.46, ang = (t * 1.1) % TAU;
    ctx.lineWidth = Math.max(1, H / 300);
    ctx.strokeStyle = rgba(g.c1, 0.45);
    for (i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, R * i / 4, 0, TAU); ctx.stroke(); }
    ctx.beginPath();
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();
    if (ctx.createConicGradient) {
      var cg = ctx.createConicGradient(ang, cx, cy);
      cg.addColorStop(0, rgba(g.c1, 0));
      cg.addColorStop(0.7, rgba(g.c1, 0));
      cg.addColorStop(1, rgba(g.c1, 0.65));
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = rgba(g.c2, 1); ctx.lineWidth = Math.max(2, H / 200);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); ctx.stroke();
    for (i = 0; i < 7; i++) {
      var ba = h1(i + 1) * TAU, br = R * (0.25 + 0.7 * h1(i + 20));
      var diff = ((ang - ba) % TAU + TAU) % TAU, al = diff < 3.2 ? 1 - diff / 3.2 : 0;
      if (al > 0.02) {
        ctx.fillStyle = rgba(g.c2, al);
        ctx.beginPath(); ctx.arc(cx + Math.cos(ba) * br, cy + Math.sin(ba) * br, H / 90, 0, TAU); ctx.fill();
      }
    }
  };

  T.topo = function (g) {
    var t = g.t, k = g.k, c = g.c1;
    shade(g, 224, 126, function (u, v, o) {
      var f = (fbm(u * 2.3 * k * 1.78 + t * 0.06, v * 2.3 * k - t * 0.04, 3) + 0.09 * Math.sin(t * 0.4)) * 11;
      var d = Math.abs(f - Math.round(f));
      var a = 1 - smooth(0.02, 0.09, d);
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = 255 * a;
    });
  };

  T.aneis = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k, i, n = 8, R = Math.hypot(W, H) / 2;
    var gr = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H * 0.35);
    gr.addColorStop(0, rgba(g.c2, 0.45)); gr.addColorStop(1, rgba(g.c2, 0));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    for (i = 0; i < n; i++) {
      var p = ((t * 0.16 + i / n) % 1), r = p * R * k;
      ctx.strokeStyle = rgba(mix(g.c1, g.c2, p), (1 - p) * 0.95);
      ctx.lineWidth = Math.max(1.5, (3 + 5 * (1 - p)) * H / 540);
      ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, TAU); ctx.stroke();
    }
  };

  T.espiral = function (g) {
    var t = g.t, k = g.k;
    shade(g, 128, 72, function (u, v, o) {
      var dx = (u - 0.5) * 1.78, dy = v - 0.5, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
      var f = Math.sin(a * 6 + Math.log(r + 0.03) * 5 * k - t * 2);
      g.pal(smooth(-0.15, 0.15, f) * 0.85 + 0.1 * (1 - r), o);
    });
  };

  T.caleido = function (g) {
    var t = g.t, k = g.k, seg = TAU / 10;
    shade(g, 128, 72, function (u, v, o) {
      var dx = (u - 0.5) * 1.78, dy = v - 0.5, a = Math.atan2(dy, dx) + t * 0.12, r = Math.hypot(dx, dy);
      a = ((a % seg) + seg) % seg; a = Math.abs(a - seg / 2);
      var x = r * Math.cos(a) * 9 * k, y = r * Math.sin(a) * 9 * k;
      var s = Math.sin(x * 1.4 + t) + Math.sin(y * 2.1 - t * 1.3) + Math.sin((x + y) * 0.9 + t * 0.7);
      g.pal((s + 3) / 6, o);
    });
  };

  T.opart = function (g) {
    var t = g.t, k = g.k;
    shade(g, 256, 144, function (u, v, o) {
      var a = u * 16 * k + Math.sin(v * 5 + t) * 1.6, b = v * 9 * k + Math.sin(u * 5 - t * 0.8) * 1.6;
      var chk = (Math.floor(a) + Math.floor(b)) & 1;
      g.pal(chk ? 0.92 : 0.1, o);
    });
  };

  T.pontos = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k, cols = Math.round(48 * k), s = W / cols, x, y;
    for (y = 0; y * s < H + s; y++) {
      for (x = 0; x < cols + 1; x++) {
        var cx = x * s + (y & 1 ? s / 2 : 0), cy = y * s;
        var d = Math.hypot(cx - W / 2, cy - H / 2) / H;
        var r = s * 0.5 * (0.15 + 0.85 * (0.5 + 0.5 * Math.sin(d * 8 - t * 2)));
        ctx.fillStyle = rgba(mix(g.c1, g.c2, clamp01(d)), 1);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      }
    }
  };

  T.barras = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, n = Math.round(36 * g.k), i, bw = W / n;
    var gr = ctx.createLinearGradient(0, H, 0, 0);
    gr.addColorStop(0, rgba(g.c1, 1)); gr.addColorStop(1, rgba(g.c2, 1));
    ctx.fillStyle = gr;
    for (i = 0; i < n; i++) {
      var a = 0.5 + 0.5 * Math.sin(t * (1.6 + h1(i) * 2.4) + i * 0.9);
      var b = 0.5 + 0.5 * Math.sin(t * (2.3 + h1(i + 40) * 1.7) + i * 1.7);
      var h = H * (0.08 + 0.78 * (a * 0.6 + b * 0.4));
      ctx.fillRect(i * bw + bw * 0.12, H - h, bw * 0.76, h);
    }
  };

  T.linhas = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k, n = Math.round(24 * k), i, x;
    ctx.lineWidth = Math.max(1.5, H / 270 * 2);
    for (i = 0; i < n; i++) {
      var y0 = H * (i + 0.5) / n;
      ctx.strokeStyle = rgba(mix(g.c1, g.c2, i / n), 0.9);
      ctx.beginPath();
      for (x = 0; x <= W; x += 10) {
        var y = y0 + Math.sin(x / W * TAU * 1.5 + t * 0.9 + i * 0.35) * H * 0.04 + Math.sin(x / W * TAU * 3.7 - t * 1.3 + i * 0.2) * H * 0.016;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  };

  T.triangulos = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k, s = H / 8 / k, cols = Math.ceil(W / s) + 1, rows = Math.ceil(H / s) + 1, x, y;
    for (y = 0; y < rows; y++) {
      for (x = 0; x < cols; x++) {
        var x0 = x * s, y0 = y * s, j;
        for (j = 0; j < 2; j++) {
          var a = 0.5 + 0.5 * Math.sin(t * 0.9 + h2(x, y * 2 + j) * 6.28 + x * 0.15);
          ctx.fillStyle = rgba(mix(g.c1, g.c2, h2(x + 7, y + j * 3)), 0.08 + 0.7 * a * a);
          ctx.beginPath();
          if (j === 0) { ctx.moveTo(x0, y0); ctx.lineTo(x0 + s, y0); ctx.lineTo(x0, y0 + s); }
          else { ctx.moveTo(x0 + s, y0); ctx.lineTo(x0 + s, y0 + s); ctx.lineTo(x0, y0 + s); }
          ctx.closePath(); ctx.fill();
        }
      }
    }
  };

  // ---------- Partículas e atmosfera ----------
  T.estrelas = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k, i, R = Math.hypot(W, H) / 2;
    ctx.fillStyle = rgba(mix(g.c1, [0, 0, 0], 0.95), 1);
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round';
    for (i = 0; i < 260; i++) {
      var an = h1(i) * TAU, z = ((h1(i + 77) + t * 0.12 * k) % 1), r = z * z * R, r0 = Math.max(0, z - 0.05) * Math.max(0, z - 0.05) * R;
      ctx.strokeStyle = rgba(mix(g.c1, [255, 255, 255], 0.5 + 0.5 * z), z);
      ctx.lineWidth = Math.max(0.8, (0.6 + z * 2.6) * H / 540);
      ctx.beginPath();
      ctx.moveTo(W / 2 + Math.cos(an) * r0, H / 2 + Math.sin(an) * r0);
      ctx.lineTo(W / 2 + Math.cos(an) * r, H / 2 + Math.sin(an) * r);
      ctx.stroke();
    }
  };

  T.bokeh = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k, i;
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < 28; i++) {
      var r = H * (0.04 + 0.1 * h1(i + 3)) * k;
      var x = h1(i) * W + Math.sin(t * 0.3 + i) * W * 0.03;
      var y = H + r - ((h1(i + 50) + t * 0.025 * (0.5 + h1(i + 9))) % 1) * (H + r * 2);
      var col = mix(g.c1, g.c2, h1(i + 13));
      var gr = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      gr.addColorStop(0, rgba(col, 0.1)); gr.addColorStop(0.85, rgba(col, 0.32)); gr.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  T.chuva = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k, i, n = Math.round(170 * k);
    ctx.lineCap = 'round';
    for (i = 0; i < n; i++) {
      var len = H * (0.03 + 0.07 * h1(i + 5)), x = h1(i) * (W + 80);
      var y = ((h1(i + 7) + t * (0.7 + h1(i + 3) * 0.6)) % 1) * (H + len * 2) - len;
      ctx.strokeStyle = rgba(g.c1, 0.2 + 0.5 * h1(i + 11));
      ctx.lineWidth = Math.max(1, (1 + h1(i + 2) * 1.5) * H / 540);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len * 0.18, y + len); ctx.stroke();
    }
  };

  T.faiscas = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k, i, n = Math.round(110 * k);
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < n; i++) {
      var p = (h1(i + 1) + t * 0.1 * (0.5 + h1(i + 2))) % 1;
      var x = h1(i) * W + Math.sin(t * 1.2 + i) * W * 0.02 * (1 + p * 2), y = H * (1.05 - p * 1.15);
      var r = (2 + h1(i + 4) * 4) * H / 540, col = mix(g.c2, g.c1, p);
      var gr = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      gr.addColorStop(0, rgba(mix(col, [255, 255, 255], 0.6), Math.min(1, (1 - p) * 1.6))); gr.addColorStop(0.25, rgba(col, (1 - p) * 0.8)); gr.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  T.neve = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k, i, n = Math.round(150 * k);
    for (i = 0; i < n; i++) {
      var z = h1(i + 5), r = (1 + z * 3.4) * H / 540;
      var y = ((h1(i + 7) + t * 0.05 * (0.4 + z)) % 1) * (H + 20) - 10;
      var x = h1(i) * W + Math.sin(t * 0.6 + i) * W * 0.015;
      ctx.fillStyle = rgba(mix(g.c1, [255, 255, 255], 0.75), 0.35 + 0.6 * z);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  };

  T.vazamento = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k, i;
    ctx.globalCompositeOperation = 'screen';
    for (i = 0; i < 3; i++) {
      var cx = W * (0.5 + 0.55 * Math.sin(t * 0.18 + i * 2.2)), cy = H * (0.5 + 0.3 * Math.cos(t * 0.23 + i * 1.7));
      var r = H * (0.7 + 0.2 * Math.sin(t * 0.5 + i)) * k, col = mix(g.c1, g.c2, i / 2);
      var gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, rgba(col, 0.95)); gr.addColorStop(0.5, rgba(col, 0.35)); gr.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
    var sx = ((t * 0.07) % 1.4 - 0.2) * W, sg = ctx.createLinearGradient(sx - W * 0.12, 0, sx + W * 0.12, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.28)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  };

  // ---------- Glitch e retrô ----------
  T.glitch = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, j, seed = Math.floor(t * 7);
    for (j = 0; j < 9; j++) {
      if (h1(seed * 13 + j) < 0.3) continue;
      var y = h1(seed * 7 + j * 3) * H, hh = H * (0.006 + 0.07 * h1(seed * 5 + j)), off = (h1(seed * 3 + j * 11) - 0.5) * W * 0.18;
      var w = W * (0.2 + 0.8 * h1(seed + j * 17)), x = h1(seed * 2 + j) * (W - w);
      ctx.fillStyle = rgba(g.c1, 0.85); ctx.fillRect(x + off, y, w, hh);
      ctx.fillStyle = rgba(g.c2, 0.55); ctx.fillRect(x + off * 1.6 + 6, y + hh * 0.2, w, hh * 0.6);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - off * 0.5, y + hh * 0.7, w * 0.6, Math.max(1, hh * 0.15));
    }
  };

  T.vhs = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, y, i, seed = Math.floor(t * 12);
    ctx.fillStyle = rgba(g.c1, 0.07);
    for (y = 0; y < H; y += 4 * H / 540) ctx.fillRect(0, y, W, Math.max(1, 2 * H / 540));
    var by = ((t * 0.12) % 1.3 - 0.15) * H, gr = ctx.createLinearGradient(0, by - H * 0.1, 0, by + H * 0.1);
    gr.addColorStop(0, rgba(g.c1, 0)); gr.addColorStop(0.5, rgba(g.c1, 0.24)); gr.addColorStop(1, rgba(g.c1, 0));
    ctx.fillStyle = gr; ctx.fillRect(0, by - H * 0.1, W, H * 0.2);
    for (i = 0; i < 4; i++) {
      if (h1(seed + i * 5) < 0.5) continue;
      var ty = h1(seed * 3 + i) * H;
      ctx.fillStyle = rgba(g.c2, 0.25);
      ctx.fillRect(h1(seed + i) * W * 0.3, ty, W * (0.2 + 0.5 * h1(seed * 2 + i)), Math.max(1, 3 * H / 540));
    }
    for (i = 0; i < 220; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.1 + 0.25 * h1(seed * 31 + i)).toFixed(2) + ')';
      ctx.fillRect(h1(seed * 17 + i) * W, h1(seed * 23 + i + 400) * H, Math.max(1, H / 360), Math.max(1, H / 360));
    }
  };


  // ---------- Neon (camadas, listras, túnel de quadrados, jaula) ----------
  function neonPal(g) {
    var hs = toHsl(g.c1), c3 = fromHsl(hs[0] + 115, Math.max(hs[1], 0.8), 0.52);
    return [g.c1, g.c2, c3, [g.c1[0] * 0.1, g.c1[1] * 0.1, g.c1[2] * 0.1]];
  }
  // Faixas onduladas que escorrem, com contorno escuro e brilho fino
  function waveLayers(g, vertical, rainbow) {
    var ctx = g.ctx, W = vertical ? g.H : g.W, H = vertical ? g.W : g.H, t = g.t, k = g.k, pal = neonPal(g), dark = pal[3], cols = pal.slice(0, 3), hs0 = toHsl(g.c1)[0];
    if (rainbow) { cols = []; for (var q = 0; q < 6; q++) cols.push(fromHsl(hs0 + q * 60, 1, 0.5)); }
    var nb = Math.max(4, Math.round(7 * k)), sp = t * 0.1, k0 = Math.floor(sp), frac = sp - k0, i, x, band = H / nb, steps = Math.max(40, Math.ceil(W / 8)), dx = W / steps, s;
    ctx.save();
    if (vertical) { ctx.translate(g.W, 0); ctx.rotate(Math.PI / 2); ctx.scale(1, 1); }
    ctx.fillStyle = rgba(dark, 1);
    ctx.fillRect(0, 0, W, H);
    function wy(x, y0, m) {
      return y0 + Math.sin(x / W * TAU * 2.2 * k + t * 0.9 + m * 1.3) * band * 0.32 + Math.sin(x / W * TAU * 5.3 - t * 1.4 + m * 0.7) * band * 0.12;
    }
    for (i = -1; i <= nb + 1; i++) {
      var m = i + k0, y0 = (i + frac) * band + band * 0.5, col = cols[((m % cols.length) + cols.length) % cols.length];
      ctx.beginPath();
      ctx.moveTo(0, H + 10); ctx.lineTo(0, wy(0, y0, m));
      for (s = 0; s <= steps; s++) ctx.lineTo(s * dx, wy(s * dx, y0, m));
      ctx.lineTo(W, H + 10); ctx.closePath();
      ctx.fillStyle = rgba(col, 1); ctx.fill();
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, band * 0.09); ctx.strokeStyle = rgba(dark, 1);
      ctx.beginPath();
      for (s = 0; s <= steps; s++) { var yy = wy(s * dx, y0, m); if (s === 0) ctx.moveTo(0, yy); else ctx.lineTo(s * dx, yy); }
      ctx.stroke();
      ctx.lineWidth = Math.max(1, band * 0.035); ctx.strokeStyle = rgba(mix(col, [255, 255, 255], 0.6), 0.9);
      ctx.beginPath();
      for (s = 0; s <= steps; s++) { x = s * dx; var y2 = wy(x, y0, m) + band * 0.11 + Math.sin(x / W * 40 + t * 2 + m) * band * 0.015; if (s === 0) ctx.moveTo(0, y2); else ctx.lineTo(x, y2); }
      ctx.stroke();
    }
    ctx.restore();
  }
  T.camadas = function (g) { waveLayers(g, false); };
  T.listras = function (g) { waveLayers(g, true); };
  T.arcoiris = function (g) { waveLayers(g, false, true); };

  // Parede de tijolos de luz com uma varredura que passa (bom para calibrar as faces antes do conteúdo)
  // Grade numerada pra calibrar: células numeradas, bordas e diagonais, círculo central
  T.calibracao = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, k = g.k, cols = Math.max(2, Math.round(8 / k)), cw = W / cols;
    var rows = Math.max(2, Math.round(H / cw)), ch = H / rows, r, c, n = 1;
    ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
    var line = rgba(g.c1, 0.9), fs = Math.max(10, Math.min(cw, ch) * 0.28);
    ctx.font = '600 ' + fs + 'px Helvetica,Arial,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++, n++) {
        if ((r + c) % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(c * cw, r * ch, cw, ch); }
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText(String(n), c * cw + cw / 2, r * ch + ch / 2);
      }
    }
    ctx.lineWidth = Math.max(1, W / 640);
    ctx.strokeStyle = line;
    for (c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, H); ctx.stroke(); }
    for (r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * ch); ctx.lineTo(W, r * ch); ctx.stroke(); }
    ctx.strokeStyle = rgba(g.c2, 0.9);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, H); ctx.moveTo(W, 0); ctx.lineTo(0, H); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.4, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(4, W / 160); ctx.strokeStyle = '#fff';
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
    var cs = ['#ff3b3b', '#3bff6b', '#3b7bff', '#ffd23b'], q = Math.max(10, Math.min(W, H) * 0.05);
    [[0, 0], [W - q, 0], [W - q, H - q], [0, H - q]].forEach(function (p, i) { ctx.fillStyle = cs[i]; ctx.fillRect(p[0], p[1], q, q); });
  };

  T.tijolos = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k, bh = H / 12 / k, bw = bh * 2.2, r, c;
    var sw = (t * 0.22) % 1.5 - 0.2, base = mix(g.c1, [255, 255, 255], 0.75);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = rgba(g.c1, 1); ctx.shadowBlur = 6 * H / 540;
    for (r = 0; r * bh < H + bh; r++) {
      var y = r * bh, off = (r & 1) ? bw / 2 : 0;
      for (c = -1; c * bw - off < W + bw; c++) {
        var x = c * bw + off, d = (x / W + y / H * 0.5) / 1.5, gl = Math.exp(-Math.pow((d - sw) * 7, 2));
        var fl = 0.5 + 0.5 * Math.sin(t * 2 + h2(c, r) * 6.28);
        ctx.lineWidth = Math.max(1.5, bh * 0.07 * (1 + gl));
        ctx.strokeStyle = rgba(base, 0.28 + 0.2 * fl + 0.7 * gl);
        ctx.beginPath(); ctx.moveTo(x, y + bh); ctx.lineTo(x, y); ctx.lineTo(x + bw, y); ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
  };

  T.quadrados = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k, pal = neonPal(g), N = Math.round(16 * k), i;
    var sp = t * 0.4, k0 = Math.floor(sp), frac = sp - k0, maxS = Math.max(W, H) * 1.15;
    ctx.fillStyle = rgba(pal[3], 1); ctx.fillRect(0, 0, W, H);
    for (i = 0; i <= N + 1; i++) {
      var p = i - frac, f = 1 - p / N;
      if (f <= 0) continue;
      var s = maxS * Math.pow(f, 1.5), col = pal[(((i + k0) % 4) + 4) % 4];
      ctx.fillStyle = rgba(col, 1);
      ctx.fillRect(W / 2 - s / 2, H / 2 - s / 2, s, s);
      ctx.lineWidth = Math.max(1.5, H / 270 * 2);
      ctx.strokeStyle = rgba(mix(col, [255, 255, 255], 0.55), 0.8);
      ctx.strokeRect(W / 2 - s / 2, H / 2 - s / 2, s, s);
    }
  };

  T.jaula = function (g) {
    var ctx = g.ctx, W = g.W, H = g.H, t = g.t, k = g.k, pal = neonPal(g), n = Math.round(14 * k), i, bw = W / n;
    // fundo de listras finas
    ctx.fillStyle = rgba(mix(pal[3], pal[0], 0.35), 1); ctx.fillRect(0, 0, W, H);
    for (i = 0; i < n * 3; i++) {
      ctx.fillStyle = rgba(i % 2 ? pal[1] : pal[0], 0.75);
      ctx.fillRect(i * bw / 3, 0, bw / 3 * 0.55, H);
    }
    var lw = Math.max(3, H / 90);
    ctx.shadowColor = rgba(pal[2], 1); ctx.shadowBlur = 10 * H / 540;
    for (i = 0; i <= n; i++) {
      var x = i * bw;
      ctx.fillStyle = rgba(pal[2], 1);
      ctx.fillRect(x - lw / 2, 0, lw, H);
      // gotas escorrendo pela barra
      var len = H * (0.12 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.7 + i * 1.7))) * (0.6 + 0.4 * h1(i + 3));
      ctx.fillStyle = rgba(pal[1], 1);
      ctx.beginPath();
      ctx.rect(x - lw * 1.1, 0, lw * 2.2, len);
      ctx.arc(x, len, lw * 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // faíscas brancas
    for (i = 0; i < 14; i++) {
      var yy = ((h1(i + 40) + t * 0.15 * (0.5 + h1(i + 9))) % 1) * H;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(Math.round(h1(i) * n) * bw, yy, H / 160, 0, TAU); ctx.fill();
    }
  };

  var LIST = [
    { id: 'aurora', name: 'Aurora', cat: 'Orgânicas' },
    { id: 'plasma', name: 'Plasma', cat: 'Orgânicas' },
    { id: 'malha', name: 'Gradiente malha', cat: 'Orgânicas' },
    { id: 'lava', name: 'Lava lamp', cat: 'Orgânicas' },
    { id: 'marmore', name: 'Mármore líquido', cat: 'Orgânicas' },
    { id: 'nebulosa', name: 'Nebulosa', cat: 'Orgânicas' },
    { id: 'holo', name: 'Holográfico', cat: 'Orgânicas' },
    { id: 'tunel', name: 'Synthwave', cat: 'Geométricas' },
    { id: 'hexagonos', name: 'Hexágonos', cat: 'Geométricas' },
    { id: 'radar', name: 'Radar', cat: 'Geométricas' },
    { id: 'topo', name: 'Topográfico', cat: 'Geométricas' },
    { id: 'aneis', name: 'Anéis pulsantes', cat: 'Geométricas' },
    { id: 'espiral', name: 'Espiral', cat: 'Geométricas' },
    { id: 'caleido', name: 'Caleidoscópio', cat: 'Geométricas' },
    { id: 'opart', name: 'Op-art xadrez', cat: 'Geométricas' },
    { id: 'pontos', name: 'Pontos meio-tom', cat: 'Geométricas' },
    { id: 'barras', name: 'Equalizador', cat: 'Geométricas' },
    { id: 'linhas', name: 'Linhas em fluxo', cat: 'Geométricas' },
    { id: 'triangulos', name: 'Triângulos', cat: 'Geométricas' },
    { id: 'estrelas', name: 'Viagem estelar', cat: 'Partículas' },
    { id: 'bokeh', name: 'Bokeh', cat: 'Partículas' },
    { id: 'chuva', name: 'Chuva', cat: 'Partículas' },
    { id: 'faiscas', name: 'Faíscas', cat: 'Partículas' },
    { id: 'neve', name: 'Neve', cat: 'Partículas' },
    { id: 'vazamento', name: 'Vazamento de luz', cat: 'Partículas' },
    { id: 'camadas', name: 'Camadas onduladas', cat: 'Neon' },
    { id: 'listras', name: 'Listras onduladas', cat: 'Neon' },
    { id: 'quadrados', name: 'Quadrados em túnel', cat: 'Neon' },
    { id: 'jaula', name: 'Jaula com gotas', cat: 'Neon' },
    { id: 'arcoiris', name: 'Camadas arco-íris', cat: 'Neon' },
    { id: 'tijolos', name: 'Tijolos de luz (calibrar)', cat: 'Neon' },
    { id: 'calibracao', name: 'Grade numerada', cat: 'Calibração' },
    { id: 'glitch', name: 'Glitch', cat: 'Retrô' },
    { id: 'vhs', name: 'VHS', cat: 'Retrô' }
  ];

  // Desenha a textura 'id'. p = { color, color2, speed, scale }. cache = objeto que guarda canvases internos.
  function draw(id, ctx, W, H, timeMs, p, cache) {
    var fn = T[id];
    if (!fn) return false;
    p = p || {};
    var c1 = hex(p.color), c2 = p.color2 ? hex(p.color2) : hex(autoColor2(p.color || '#ff4fa3'));
    var g = {
      ctx: ctx, W: W, H: H, t: (timeMs || 0) / 1000 * (p.speed || 1), k: p.scale || 1,
      p1: p.p1 == null ? 1 : p.p1, p2: p.p2 == null ? 1 : p.p2, c1: c1, c2: c2, pal: makePal(c1, c2), cache: cache || {}
    };
    fn(g);
    return true;
  }

  function register(id, name, cat, fn) {
    T[id] = fn;
    for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) { LIST[i].name = name; LIST[i].cat = cat; return; }
    LIST.push({ id: id, name: name, cat: cat });
  }
  var util = { TAU: TAU, h1: h1, h2: h2, vnoise: vnoise, fbm: fbm, clamp01: clamp01, smooth: smooth, mix: mix, rgba: rgba, shade: shade, hex: hex, toHsl: toHsl, fromHsl: fromHsl };

  root.Textures = { list: LIST, draw: draw, has: function (id) { return !!T[id]; }, autoColor2: autoColor2, register: register, util: util };
})(typeof window !== 'undefined' ? window : globalThis);
