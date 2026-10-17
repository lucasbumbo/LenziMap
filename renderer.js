(function (root) {
  'use strict';

  var DEFAULT_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

  function solveH(src, dst) {
    var A = [], i, k, r, c;
    for (i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], X = dst[i][0], Y = dst[i][1];
      A.push([x, y, 1, 0, 0, 0, -x * X, -y * X, X]);
      A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y, Y]);
    }
    var n = 8;
    for (c = 0; c < n; c++) {
      var p = c;
      for (r = c + 1; r < n; r++) { if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; }
      if (Math.abs(A[p][c]) < 1e-12) return null;
      var t = A[c]; A[c] = A[p]; A[p] = t;
      for (r = 0; r < n; r++) {
        if (r === c) continue;
        var f = A[r][c] / A[c][c];
        for (k = c; k <= n; k++) { A[r][k] -= f * A[c][k]; }
      }
    }
    var h = [];
    for (i = 0; i < n; i++) h.push(A[i][n] / A[i][i]);
    return h;
  }
  function proj(h, x, y) {
    var d = h[6] * x + h[7] * y + 1;
    return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d];
  }
  function inv3(m) {
    var a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5], g = m[6], h = m[7], i = m[8];
    var A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    var det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-12) return null;
    var D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g);
    var G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
    return [A / det, D / det, G / det, B / det, E / det, H / det, C / det, F / det, I / det];
  }
  function unproj(m, x, y) {
    var w = m[6] * x + m[7] * y + m[8];
    return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
  }

  // Homografia da layer: leva o retângulo da mídia pros 4 cantos, respeitando espelhar.
  function homography(s, W, H) {
    var a = s.q.map(function (p) { return [p[0] * W, p[1] * H]; });
    if (s.flipX) a = [a[1], a[0], a[3], a[2]];
    if (s.flipY) a = [a[3], a[2], a[1], a[0]];
    for (var k = (s.rot || 0) % 4; k > 0; k--) a = [a[1], a[2], a[3], a[0]];
    return solveH([[0, 0], [s.w, 0], [s.w, s.h], [0, s.h]], a);
  }

  function isDefaultMask(m) {
    var d = [[0, 0], [1, 0], [1, 1], [0, 1]];
    if (!m || m.length !== 4) return false;
    for (var i = 0; i < 4; i++) if (m[i][0] !== d[i][0] || m[i][1] !== d[i][1]) return false;
    return true;
  }

  // Máscaras extras por superfície (s.cuts): cada uma recorta (ou, invertida, mantém só o seu interior), com feather.
  // Vira uma máscara de alfa pequena (cache por assinatura) usada tanto no modo DOM (mask-image) quanto na malha (destination-in).
  function activeCuts(s) {
    var a = [], l = s && s.cuts || [], i;
    for (i = 0; i < l.length; i++) if (l[i] && l[i].on !== false && l[i].pts && l[i].pts.length >= 3) a.push(l[i]);
    return a;
  }
  var cutCache = {};
  function cutMask(s) {
    var cuts = activeCuts(s);
    if (!cuts.length || !s.w || !s.h) return null;
    var sig = s.w + 'x' + s.h + JSON.stringify(cuts.map(function (c) { return [c.pts, !!c.inv, c.f || 0]; }));
    var hit = cutCache[s.key];
    if (hit && hit.sig === sig) return hit;
    var sc = Math.min(1, 800 / Math.max(s.w, s.h)), w = Math.max(2, Math.round(s.w * sc)), h = Math.max(2, Math.round(s.h * sc));
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var c = cv.getContext('2d');
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    cuts.forEach(function (ct) {
      var t = document.createElement('canvas'); t.width = w; t.height = h;
      var x = t.getContext('2d'), blur = Math.min(w, h) * Math.max(0, Math.min(60, ct.f || 0)) / 100 * 0.5;
      x.fillStyle = '#000';
      if (blur > 0.5) { x.shadowColor = '#000'; x.shadowBlur = blur; x.shadowOffsetX = w * 3; x.translate(-w * 3, 0); }
      x.beginPath();
      ct.pts.forEach(function (p, k) { if (k) x.lineTo(p[0] * w, p[1] * h); else x.moveTo(p[0] * w, p[1] * h); });
      x.closePath(); x.fill();
      c.globalCompositeOperation = ct.inv ? 'destination-in' : 'destination-out';
      c.drawImage(t, 0, 0);
    });
    c.globalCompositeOperation = 'source-over';
    var rec = { sig: sig, canvas: cv, url: cv.toDataURL('image/png') };
    cutCache[s.key] = rec;
    return rec;
  }
  root.RendererCuts = { activeCuts: activeCuts, cutMask: cutMask };

  function hexToRgb(hex) {
    var h = String(hex || '#ffffff').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) n = 0xffffff;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  function hueOf(hex) {
    var c = hexToRgb(hex), r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d === 0) return 0;
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = h * 60;
    return h < 0 ? h + 360 : h;
  }

  var FX_BASE = [
    { id: 'grade', name: 'Grade pulsante', cat: 'Básicos' },
    { id: 'scan', name: 'Linha de scan', cat: 'Básicos' },
    { id: 'gradiente', name: 'Gradiente animado', cat: 'Básicos' },
    { id: 'ruido', name: 'Ruído', cat: 'Básicos' },
    { id: 'estrobo', name: 'Estrobo', cat: 'Básicos' },
    { id: 'contorno', name: 'Contorno neon', cat: 'Básicos' },
    { id: 'ondas', name: 'Ondas', cat: 'Básicos' }
  ];
  var FX_KINDS = FX_BASE.concat(root.Textures ? root.Textures.list : []);

  // Máscara opcional do efeito (PNG pequeno em fx.mask): o efeito só aparece onde a máscara é opaca.
  function applyFxMask(c, ctx, f, W, H) {
    if (!f.mask) return;
    var m = c._mk;
    if (!m || m.src !== f.mask) {
      var im = new Image(); m = c._mk = { src: f.mask, im: im, ok: false };
      im.onload = function () { m.ok = true; }; im.src = f.mask;
    }
    if (!m.ok) return;
    ctx.globalCompositeOperation = f.maskInvert ? 'destination-out' : 'destination-in';
    ctx.drawImage(m.im, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawFx(c, s, time) {
    var f = s.fx || {}, kind = f.kind || 'grade', col = f.color || '#ff4fa3', sp = f.speed || 1, t = (time || 0) / 1000;
    var W = s.w, H = s.h, ctx = c.getContext('2d'), i, x, y;
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (root.Textures && root.Textures.has(kind)) {
      root.Textures.draw(kind, ctx, W, H, time, { color: f.color, color2: f.color2, speed: sp, scale: f.scale, p1: f.p1, p2: f.p2 }, c._tx || (c._tx = {}));
      applyFxMask(c, ctx, f, W, H);
      ctx.restore();
      return;
    }
    if (kind === 'illusion' && root.IllusionGL) {
      root.IllusionGL.draw(c, ctx, W, H, time, f, s.key);
      applyFxMask(c, ctx, f, W, H);
      ctx.restore();
      return;
    }
    if (kind === 'glsl' && root.GlslFx) {
      root.GlslFx.draw(c, ctx, W, H, time, f);
      applyFxMask(c, ctx, f, W, H);
      ctx.restore();
      return;
    }
    var pulse = 0.5 + 0.5 * Math.sin(t * 2 * sp);
    if (kind === 'grade') {
      ctx.lineWidth = 2 + pulse * 3;
      ctx.strokeStyle = rgba(col, 0.35 + 0.65 * pulse);
      ctx.beginPath();
      for (x = 0; x <= W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (y = 0; y <= H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    } else if (kind === 'scan') {
      y = ((t * 0.4 * sp) % 1) * (H + 160) - 80;
      var g = ctx.createLinearGradient(0, y - 80, 0, y + 80);
      g.addColorStop(0, rgba(col, 0));
      g.addColorStop(0.5, rgba(col, 0.9));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 80, W, 160);
    } else if (kind === 'gradiente') {
      var h0 = hueOf(col) + t * 40 * sp, a = t * 0.3 * sp;
      var cx = W / 2, cy = H / 2, r = Math.max(W, H) / 2;
      var g2 = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g2.addColorStop(0, 'hsl(' + (h0 % 360) + ',90%,50%)');
      g2.addColorStop(1, 'hsl(' + ((h0 + 80) % 360) + ',90%,45%)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);
    } else if (kind === 'ruido') {
      var n = c._noise;
      if (!n) { n = c._noise = document.createElement('canvas'); n.width = 96; n.height = 54; }
      var nctx = n.getContext('2d'), id = nctx.createImageData(96, 54), d = id.data, rgb = hexToRgb(col);
      for (i = 0; i < d.length; i += 4) {
        var v = Math.random();
        d[i] = rgb[0] * v; d[i + 1] = rgb[1] * v; d[i + 2] = rgb[2] * v; d[i + 3] = 255 * (0.15 + 0.85 * v);
      }
      nctx.putImageData(id, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(n, 0, 0, W, H);
    } else if (kind === 'estrobo') {
      if (Math.floor(t * 4 * sp) % 2 === 0) { ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); }
    } else if (kind === 'contorno') {
      ctx.lineWidth = 16;
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 24 + 30 * pulse;
      ctx.strokeRect(24, 24, W - 48, H - 48);
    } else if (kind === 'ondas') {
      for (i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = rgba(col, 0.35 + 0.13 * i);
        for (x = 0; x <= W; x += 8) {
          y = H / 2 + Math.sin(x * 0.012 + t * 2 * sp + i * 0.8) * (H * 0.18) * (0.6 + 0.4 * Math.sin(t * sp + i));
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function normText(t) {
    t = t || {};
    return {
      value: t.value == null ? '' : String(t.value),
      size: t.size || 220,
      color: t.color || '#ffffff',
      font: t.font || DEFAULT_FONT,
      bold: t.bold !== false,
      align: t.align || 'center',
      outline: t.outline || 0,
      outlineColor: t.outlineColor || '#000000',
      shadow: !!t.shadow,
      anim: t.anim || 'none',
      speed: t.speed || 1
    };
  }

  function putLine(ctx, t, str, x, y) {
    if (t.outline > 0) {
      ctx.lineWidth = t.outline;
      ctx.strokeStyle = t.outlineColor;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = t.color;
    ctx.fillText(str, x, y);
  }

  function drawText(c, s, time) {
    var t = normText(s.text), ctx = c.getContext('2d'), sec = (time || 0) / 1000, sp = t.speed || 1;
    if (c.width !== s.w) c.width = s.w;
    if (c.height !== s.h) c.height = s.h;
    ctx.clearRect(0, 0, s.w, s.h);
    ctx.save();
    ctx.font = (t.bold ? '700 ' : '400 ') + t.size + 'px ' + t.font;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    var str = t.value;
    if (t.anim === 'piscar') {
      ctx.globalAlpha = Math.sin(sec * Math.PI * 1.6 * sp) > 0 ? 1 : 0.08;
    } else if (t.anim === 'digitar') {
      var total = str.length + 8, n = Math.floor((sec * 6 * sp) % total);
      str = str.slice(0, Math.min(n, str.length));
    }
    if (t.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = t.size * 0.08;
      ctx.shadowOffsetX = t.size * 0.03;
      ctx.shadowOffsetY = t.size * 0.03;
    }
    if (t.anim === 'rolar') {
      var line = t.value.replace(/\n/g, '  ');
      ctx.textAlign = 'left';
      var tw = ctx.measureText(line).width, span = tw + s.w;
      putLine(ctx, t, line, s.w - ((sec * 200 * sp) % span), s.h / 2);
    } else {
      var lines = str.split('\n'), lh = t.size * 1.15, y0 = s.h / 2 - (lines.length - 1) * lh / 2;
      var x = s.w / 2;
      ctx.textAlign = 'center';
      if (t.align === 'left') { x = s.w * 0.05; ctx.textAlign = 'left'; }
      else if (t.align === 'right') { x = s.w * 0.95; ctx.textAlign = 'right'; }
      lines.forEach(function (l, i) { putLine(ctx, t, l, x, y0 + i * lh); });
    }
    ctx.restore();
  }

  // Filtros de cor da superfície. Brilho pode reagir ao som (level 0..1) e a matiz pode girar sozinha.
  function surfFilter(s, now, level) {
    var fl = [], b = s.bright == null ? 100 : s.bright, am = (s.audio || 0) / 100;
    if (am > 0 && s.audioTo !== 'opacity') b = b * (1 - am + am * Math.min(1, level || 0) * 2);
    if (b !== 100) fl.push('brightness(' + (b / 100) + ')');
    if (s.contrast != null && s.contrast !== 100) fl.push('contrast(' + (s.contrast / 100) + ')');
    if (s.sat != null && s.sat !== 100) fl.push('saturate(' + (s.sat / 100) + ')');
    var hue = (s.hue || 0) + ((s.cycle || 0) ? (now / 1000) * s.cycle : 0);
    if (hue) fl.push('hue-rotate(' + (hue % 360).toFixed(1) + 'deg)');
    if (s.blur) fl.push('blur(' + s.blur + 'px)');
    if (s.invert) fl.push('invert(1)');
    if (s.mono) fl.push('grayscale(1)');
    return fl.join(' ');
  }
  function featherMask(s) {
    var f = s.feather || 0;
    if (f <= 0) return '';
    var px = Math.max(1, Math.min(s.w, s.h) * f / 100 * 0.5).toFixed(1);
    var g = function (d) { return 'linear-gradient(' + d + ',transparent 0,#000 ' + px + 'px,#000 calc(100% - ' + px + 'px),transparent 100%)'; };
    return g('to right') + ',' + g('to bottom');
  }
  function motionXf(s, now, level, cx, cy) {
    var m = s.motion, a = (s.motionAmt == null ? 50 : s.motionAmt) / 100, t = now / 1000;
    if (!m || m === 'none') return '';
    var tx = 0, ty = 0, sc = 1, rz = 0;
    if (m === 'flutuar') { ty = Math.sin(t * 1.6) * 40 * a; tx = Math.sin(t * 0.9) * 14 * a; }
    else if (m === 'pulsar') { sc = 1 + Math.sin(t * 3.2) * 0.12 * a; }
    else if (m === 'balancar') { rz = Math.sin(t * 2) * 10 * a; }
    else if (m === 'girar') { rz = (t * 40 * a) % 360; }
    else if (m === 'tremer') { tx = Math.sin(t * 47) * 5 * a; ty = Math.cos(t * 53) * 5 * a; }
    else if (m === 'batida') { sc = 1 + Math.pow(Math.min(1, level || 0), 1.5) * 0.35 * a * 2; }
    else if (m === 'orbita') { tx = Math.cos(t * 1.2) * 50 * a; ty = Math.sin(t * 1.2) * 30 * a; }
    return 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) translate(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px) rotate(' + rz.toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ') translate(' + (-cx).toFixed(1) + 'px,' + (-cy).toFixed(1) + 'px)';
  }
  function surfOpacity(s, level) {
    var am = (s.audio || 0) / 100;
    if (am > 0 && s.audioTo === 'opacity') return s.opacity * (1 - am + am * Math.min(1, level || 0));
    return s.opacity;
  }


  // ---- Malha (mesh warp) ----
  // Pontos-base: grade projetada nos 4 cantos. Cada ponto da malha = base + deslocamento (off).
  function meshBase(q, n) {
    var H = solveH([[0, 0], [1, 0], [1, 1], [0, 1]], q), out = [], i, j;
    for (j = 0; j <= n; j++) {
      for (i = 0; i <= n; i++) {
        var u = i / n, v = j / n;
        if (H) out.push(proj(H, u, v));
        else {
          var tx = q[0][0] * (1 - u) + q[1][0] * u, bx = q[3][0] * (1 - u) + q[2][0] * u;
          var ty = q[0][1] * (1 - u) + q[1][1] * u, by = q[3][1] * (1 - u) + q[2][1] * u;
          out.push([tx * (1 - v) + bx * v, ty * (1 - v) + by * v]);
        }
      }
    }
    return out;
  }
  function meshPoints(s) {
    var n = s.mesh.n, base = meshBase(s.q, n), off = s.mesh.off || [];
    return base.map(function (p, k) { var o = off[k] || [0, 0]; return [p[0] + o[0], p[1] + o[1]]; });
  }
  function meshUV(s) {
    var n = s.mesh.n, out = [], i, j, k;
    for (j = 0; j <= n; j++) {
      for (i = 0; i <= n; i++) {
        var x = i / n, y = j / n, t;
        if (s.flipX) x = 1 - x;
        if (s.flipY) y = 1 - y;
        for (k = (s.rot || 0) % 4; k > 0; k--) { t = y; y = 1 - x; x = t; }
        out.push(x, y);
      }
    }
    return new Float32Array(out);
  }
  function meshIndices(n) {
    var idx = [], i, j, a, b, c, d, w = n + 1;
    for (j = 0; j < n; j++) {
      for (i = 0; i < n; i++) {
        a = j * w + i; b = a + 1; c = a + w; d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    return new Uint16Array(idx);
  }
  function compileGL(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader');
    return sh;
  }
  function makeMesh() {
    var mc = document.createElement('canvas');
    var gl = mc.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false });
    if (!gl || typeof gl.createProgram !== 'function') throw new Error('webgl');
    var vs = compileGL(gl, gl.VERTEX_SHADER, 'attribute vec2 aPos;attribute vec2 aUV;uniform vec2 uRes;varying vec2 vUV;void main(){vUV=aUV;gl_Position=vec4(aPos.x/uRes.x*2.0-1.0,1.0-aPos.y/uRes.y*2.0,0.0,1.0);}');
    var fs = compileGL(gl, gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 vUV;uniform sampler2D uTex;void main(){gl_FragColor=texture2D(uTex,vUV);}');
    var pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(pr);
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    var m = {
      mc: mc, gl: gl, pr: pr, tex: tex, tc: document.createElement('canvas'),
      pb: gl.createBuffer(), ub: gl.createBuffer(), ib: gl.createBuffer(),
      aPos: gl.getAttribLocation(pr, 'aPos'), aUV: gl.getAttribLocation(pr, 'aUV'),
      uRes: gl.getUniformLocation(pr, 'uRes'), sig: '', count: 0
    };
    m.c2 = m.tc.getContext('2d');
    return m;
  }
  function drawFit(c2, el, fit, W, H) {
    var sw = el.videoWidth || el.naturalWidth || el.width, sh = el.videoHeight || el.naturalHeight || el.height;
    if (!sw || !sh) return;
    if (fit === 'contain' || fit === 'cover') {
      var sc = fit === 'contain' ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh);
      var dw = sw * sc, dh = sh * sc;
      c2.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else c2.drawImage(el, 0, 0, W, H);
  }

  // Câmera ao vivo: uma captura só por janela, compartilhada por todos os itens de câmera
  var camPromise = null;
  function camStream() {
    if (!camPromise) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) camPromise = Promise.reject(new Error('sem câmera'));
      else {
        var ask = (root.api && root.api.askMedia) ? root.api.askMedia('camera') : Promise.resolve(true);
        camPromise = ask.then(function (ok) {
          if (!ok) throw new Error('negado');
          return navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        }).catch(function (e) { camPromise = null; throw e; });
      }
    }
    return camPromise;
  }

  var instances = [];
  var looping = false;
  function loop(now) {
    for (var i = 0; i < instances.length; i++) instances[i].tick(now);
    requestAnimationFrame(loop);
  }
  function ensureLoop() {
    if (looping) return;
    looping = true;
    requestAnimationFrame(loop);
  }

  // Desenha as layers de um estado dentro de um palco. A janela de controle e a janela de saída usam este mesmo código.
  function Renderer(stage, anchor, opts) {
    this.stage = stage;
    this.anchor = anchor || null;
    this.opts = opts || {};
    this.recs = {};
    this.order = '';
    instances.push(this);
    ensureLoop();
  }

  Renderer.prototype.make = function (s) {
    var el;
    if (s.type === 'box') {
      el = document.createElement('div');
    } else if (s.type === 'text' || s.type === 'fx') {
      el = document.createElement('canvas');
      el.width = s.w; el.height = s.h;
    } else if (s.type === 'video') {
      el = document.createElement('video');
      el.muted = true; el.loop = true; el.playsInline = true; el.preload = 'auto';
      el.setAttribute('muted', ''); el.setAttribute('playsinline', '');
      el.src = s.src;
    } else {
      el = document.createElement('img');
      el.alt = '';
      el.src = s.src;
    }
    el.className = 'xs';
    el.draggable = false;
    el.style.width = s.w + 'px';
    el.style.height = s.h + 'px';
    return el;
  };

  Renderer.prototype.setLevel = function (v) { this.level = v; };

  Renderer.prototype.tick = function (now) {
    if (this.player && this.player.active) this.player.frame(now);
    if (this.flashEl && this.strobeHz) this.flashEl.style.opacity = (this.flashOn || (Math.floor(now / 1000 * this.strobeHz * 2) % 2 === 0)) ? 1 : 0;
    for (var id in this.recs) {
      var rec = this.recs[id];
      var rs = rec.s;
      if (rs && rec.box && (rs.motion || rec.hadMotion)) {
        if (!rec.meshOn) rec.box.style.transform = (motionXf(rs, now, this.level, rec.cx || 0, rec.cy || 0) + ' ' + (rec.baseXf || '')).trim(); else rec.box.style.transform = motionXf(rs, now, this.level, rec.cx || 0, rec.cy || 0) || 'none';
        rec.hadMotion = !!(rs.motion && rs.motion !== 'none');
      }
      if (rs && (rs.cycle || rs.audio) && rec.visible && rec.box) {
        rec.box.style.filter = surfFilter(rs, now, this.level);
        if (rs.audio && rs.audioTo === 'opacity' && !rec.fading) rec.box.style.opacity = surfOpacity(rs, this.level);
      }
      if (!rec.anim || !rec.visible) continue;
      if (rec.anim === 'fx') drawFx(rec.el, rec.s, now);
      else drawText(rec.el, rec.s, now);
    }
    for (var id2 in this.recs) {
      var r2 = this.recs[id2];
      if (!r2.visible) continue;
      for (var xid in r2.ex) {
        var e2 = r2.ex[xid];
        if (!e2.anim || !e2.shown) continue;
        var et = e2.tms != null ? e2.tms : now;
        if (e2.anim === 'fx') drawFx(e2.el, { w: r2.s.w, h: r2.s.h, fx: e2.x.fx, key: r2.s.key }, et);
        else drawText(e2.el, { w: r2.s.w, h: r2.s.h, text: e2.x.text }, et);
      }
      if (r2.meshOn) this.drawMesh(r2);
    }
  };

  // Compõe os itens da superfície numa tela 2D e desenha ela deformada pela malha (WebGL).
  Renderer.prototype.drawMesh = function (rec) {
    var s = rec.s, m = rec.mesh;
    if (!m || !s.mesh || !s.mesh.on) return;
    var W = this.stage.clientWidth, H = this.stage.clientHeight;
    if (!W || !H) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1), cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    var gl = m.gl, mc = m.mc, tc = m.tc, c2 = m.c2, i;
    if (mc.width !== cw) mc.width = cw;
    if (mc.height !== ch) mc.height = ch;
    if (tc.width !== s.w) tc.width = s.w;
    if (tc.height !== s.h) tc.height = s.h;
    c2.clearRect(0, 0, s.w, s.h);
    if (s.cover) { c2.fillStyle = '#000'; c2.fillRect(0, 0, s.w, s.h); }
    c2.save();
    if (s.radius > 0) {
      var rr = Math.min(s.w, s.h) * s.radius / 100;
      c2.beginPath(); c2.moveTo(rr, 0); c2.arcTo(s.w, 0, s.w, s.h, rr); c2.arcTo(s.w, s.h, 0, s.h, rr); c2.arcTo(0, s.h, 0, 0, rr); c2.arcTo(0, 0, s.w, 0, rr); c2.closePath(); c2.clip();
    }
    if (!isDefaultMask(s.mask)) {
      c2.beginPath();
      s.mask.forEach(function (p, k) { if (k) c2.lineTo(p[0] * s.w, p[1] * s.h); else c2.moveTo(p[0] * s.w, p[1] * s.h); });
      c2.closePath(); c2.clip();
    }
    var list = s.extras || [];
    for (i = 0; i < list.length; i++) {
      var x = list[i], e = rec.ex[x.id];
      if (!e || !e.shown) continue;
      c2.globalAlpha = (x.opacity == null ? 1 : x.opacity) * (x.fxOpacity == null ? 1 : x.fxOpacity);
      c2.globalCompositeOperation = (x.blend && x.blend !== 'normal') ? (root.EffectsCore ? root.EffectsCore.canvasBlend(x.blend) : x.blend) : 'source-over';
      try { if ('filter' in c2) c2.filter = x.fxFilter || 'none'; } catch (e0) {}
      if (x.cover) { c2.save(); c2.globalCompositeOperation = 'source-over'; c2.fillStyle = '#000'; c2.fillRect(0, 0, s.w, s.h); c2.restore(); }
      try {
        if (x.tl && (x.quad || x.cropR)) {
          c2.save();
          var cr = x.cropR;
          if (cr && (cr.l || cr.t || cr.r || cr.b)) { c2.beginPath(); c2.rect(cr.l * s.w, cr.t * s.h, (1 - cr.l - cr.r) * s.w, (1 - cr.t - cr.b) * s.h); c2.clip(); }
          var q = x.quad;
          if (q) c2.transform((q[1][0] - q[0][0]) / s.w, (q[1][1] - q[0][1]) / s.w, (q[3][0] - q[0][0]) / s.h, (q[3][1] - q[0][1]) / s.h, q[0][0], q[0][1]);
          drawFit(c2, e.el, x.type === 'media' ? x.fit : 'fill', s.w, s.h);
          c2.restore();
        } else drawFit(c2, e.el, x.type === 'media' ? x.fit : 'fill', s.w, s.h);
      } catch (err) {}
    }
    c2.restore();
    var cm0 = cutMask(s);
    if (cm0) { c2.save(); c2.globalCompositeOperation = 'destination-in'; c2.globalAlpha = 1; c2.drawImage(cm0.canvas, 0, 0, s.w, s.h); c2.restore(); }
    if (s.feather > 0) {
      var fp = Math.max(1, Math.min(s.w, s.h) * s.feather / 100 * 0.5);
      c2.save(); c2.globalCompositeOperation = 'destination-in'; c2.globalAlpha = 1;
      var gx = c2.createLinearGradient(0, 0, s.w, 0), fx = Math.min(0.5, fp / s.w);
      gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(fx, '#000'); gx.addColorStop(1 - fx, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)');
      c2.fillStyle = gx; c2.fillRect(0, 0, s.w, s.h);
      var gy = c2.createLinearGradient(0, 0, 0, s.h), fy = Math.min(0.5, fp / s.h);
      gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(fy, '#000'); gy.addColorStop(1 - fy, '#000'); gy.addColorStop(1, 'rgba(0,0,0,0)');
      c2.fillStyle = gy; c2.fillRect(0, 0, s.w, s.h);
      c2.restore();
    }
    var n = s.mesh.n, sig = n + ':' + (s.flipX ? 1 : 0) + (s.flipY ? 1 : 0) + ':' + ((s.rot || 0) % 4);
    if (sig !== m.sig) {
      m.sig = sig;
      gl.bindBuffer(gl.ARRAY_BUFFER, m.ub); gl.bufferData(gl.ARRAY_BUFFER, meshUV(s), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, meshIndices(n), gl.STATIC_DRAW);
      m.count = n * n * 6;
    }
    var pts = meshPoints(s), pos = new Float32Array(pts.length * 2);
    for (i = 0; i < pts.length; i++) { pos[i * 2] = pts[i][0] * cw; pos[i * 2 + 1] = pts[i][1] * ch; }
    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(m.pr);
    gl.bindTexture(gl.TEXTURE_2D, m.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc);
    gl.uniform2f(m.uRes, cw, ch);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.pb); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(m.aPos); gl.vertexAttribPointer(m.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.ub);
    gl.enableVertexAttribArray(m.aUV); gl.vertexAttribPointer(m.aUV, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
  };

  // Itens dentro da layer (efeito, mídia, texto): seguem os mesmos cantos e a mesma máscara.
  Renderer.prototype.syncExtras = function (rec, s) {
    var list = s.extras || [], seen = {}, i, x, e, sig = [];
    for (i = 0; i < list.length; i++) sig.push(list[i].id + list[i].type + (list[i].src || ''));
    var order = sig.join('|');
    for (i = 0; i < list.length; i++) {
      x = list[i];
      seen[x.id] = 1;
      e = rec.ex[x.id];
      if (!e) {
        var el;
        if (x.tl && x.kind === 'video' && this.player && (el = this.player.take(x.id.slice(1)))) {
          el.muted = true; el.loop = false; el.draggable = false;   // vídeo reaproveitado da reserva do player
        } else if (x.type === 'media') {
          el = document.createElement(x.kind === 'video' || x.kind === 'cam' ? 'video' : 'img');
          if (x.kind === 'cam') {
            el.muted = true; el.playsInline = true; el.autoplay = true;
            el.setAttribute('muted', ''); el.setAttribute('playsinline', '');
            camStream().then(function (st) {
              el.srcObject = st;
              var pp = el.play(); if (pp && pp.catch) pp.catch(function () {});
            }).catch(function () { el.dataset.camError = '1'; if (Renderer.onCamError) Renderer.onCamError(); });
          } else if (x.kind === 'video') {
            el.muted = true; el.loop = true; el.playsInline = true; el.preload = 'auto';
            el.setAttribute('muted', ''); el.setAttribute('playsinline', '');
          } else el.alt = '';
          if (x.kind !== 'cam') el.src = x.src;
          el.draggable = false;
        } else {
          el = document.createElement('canvas');
          el.width = s.w; el.height = s.h;
        }
        el.className = 'xs';
        el.style.width = s.w + 'px';
        el.style.height = s.h + 'px';
        e = rec.ex[x.id] = { el: el, x: x, anim: null, sig: '', shown: true };
        rec.box.appendChild(el);
        rec.exSig = '';
      }
      e.x = x;
      e.shown = x.visible !== false;
      e.el.style.display = e.shown ? '' : 'none';
      e.el.style.opacity = x.opacity == null ? 1 : x.opacity;
      e.el.style.background = x.cover ? '#000' : '';
      e.el.style.mixBlendMode = x.blend && x.blend !== 'normal' ? (root.EffectsCore ? root.EffectsCore.cssBlend(x.blend) : x.blend) : 'normal';
      if (x.tl) {
        e.el.style.transformOrigin = '0 0';
        e.el.style.transform = x.xf || '';
        e.el.style.clipPath = x.crop || '';
        e.el.__xf = x.xf || ''; e.el.__crop = x.crop || '';
      }
      if (x.type === 'media') {
        e.el.style.objectFit = x.fit === 'cover' ? 'cover' : (x.fit === 'contain' ? 'contain' : 'fill');
        if (e.el.play && e.el.playbackRate !== (x.speed || 1)) e.el.playbackRate = x.speed || 1;
      }
      if (x.type === 'fx') {
        e.anim = 'fx';
      } else if (x.type === 'text') {
        if (normText(x.text).anim !== 'none') e.anim = 'text';
        else {
          e.anim = null;
          var tsig = JSON.stringify(x.text) + s.w + s.h;
          if (tsig !== e.sig) { e.sig = tsig; drawText(e.el, { w: s.w, h: s.h, text: x.text }, 0); }
        }
      }
      if (e.anim && !e.drawn) { e.drawn = true; var t0 = x.tl && e.tms != null ? e.tms : performance.now(); if (e.anim === 'fx') drawFx(e.el, { w: s.w, h: s.h, fx: x.fx, key: s.key }, t0); else drawText(e.el, { w: s.w, h: s.h, text: x.text }, t0); }
    }
    for (var id in rec.ex) {
      if (seen[id]) continue;
      if (rec.ex[id].el.pause) rec.ex[id].el.pause();
      if (rec.ex[id].el.parentNode) rec.ex[id].el.parentNode.removeChild(rec.ex[id].el);
      if (rec.ex[id].x && rec.ex[id].x.tl && rec.ex[id].el.tagName === 'VIDEO' && this.player) this.player.stash(id.slice(1), rec.ex[id].el);
      delete rec.ex[id];
      rec.exSig = '';
    }
    if (order !== rec.exSig) {
      list.forEach(function (it) { rec.box.appendChild(rec.ex[it.id].el); });
      rec.exSig = order;
    }
  };

  Renderer.prototype.sync = function (state) {
    // 3D Illusion: a geometria física dos cubos (palco) vem junto da sequência e não tem relação com surface.q
    if (root.IllusionCore) {
      var sg = state.tl && state.tl.on && state.tl.seq ? state.tl.seq.stage : null, sgs = sg ? JSON.stringify(sg) : '';
      if (sgs !== this._stageSig) { this._stageSig = sgs; root.IllusionCore.setRig(sg); }
    }
    // Modo timeline: o SequencePlayer troca os itens das superfícies ligadas a faixas pelos clipes ativos agora.
    if (state.tl && state.tl.on && state.tl.seq && root.SequencePlayer) {
      if (!this.player) this.player = new root.SequencePlayer(this, { audio: !!this.opts.audio });
      this.player.base = state;
      this.player.update(state.tl);
      state = this.player.compose(state);
    } else if (this.player && this.player.active) {
      this.player.release();
      this.player.base = null;
    }
    var stage = this.stage, self = this;
    var W = stage.clientWidth, H = stage.clientHeight;
    var seen = {}, ids = [];

    if (this.opts.master) {
      var v = state.blackout ? 0 : (state.master == null ? 100 : state.master) / 100;
      stage.style.transition = 'filter .3s';
      stage.style.filter = 'brightness(' + v + ')';
    }

    if (this.opts.master) {
      if (!this.flashEl) {
        this.flashEl = document.createElement('div');
        this.flashEl.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;opacity:0;pointer-events:none;z-index:40';
        stage.appendChild(this.flashEl);
      }
      this.flashOn = !!state.flash; this.strobeHz = state.strobe || 0;
      if (!this.strobeHz) this.flashEl.style.opacity = this.flashOn ? 1 : 0;
    }
    state.surfaces.forEach(function (s) {
      seen[s.id] = 1; ids.push(s.id);
      var rec = self.recs[s.id], fresh = false;
      if (!rec) {
        var box = document.createElement('div');
        box.className = 'surf';
        box.style.width = s.w + 'px';
        box.style.height = s.h + 'px';
        rec = self.recs[s.id] = { box: box, el: self.make(s), sig: '', anim: null, visible: true, fading: false, s: s, ex: {}, exSig: '' };
        box.appendChild(rec.el);
        stage.insertBefore(box, self.anchor);
        self.order = '';
        fresh = true;
      }
      rec.s = s;
      var el = rec.box, base = rec.el, show = s.show !== false;
      rec.visible = show;
      el.style.display = show ? '' : 'none';

      var anim = null;
      if (s.type === 'fx') anim = 'fx';
      else if (s.type === 'text' && normText(s.text).anim !== 'none') anim = 'text';
      rec.anim = anim;
      if (s.type === 'text' && !anim) {
        var sig = JSON.stringify(s.text) + s.w + s.h;
        if (sig !== rec.sig) { rec.sig = sig; drawText(base, s, 0); }
      } else if (anim && fresh) {
        if (anim === 'fx') drawFx(base, s, performance.now()); else drawText(base, s, performance.now());
      }


      rec.cx = (s.q[0][0] + s.q[1][0] + s.q[2][0] + s.q[3][0]) / 4 * W;
      rec.cy = (s.q[0][1] + s.q[1][1] + s.q[2][1] + s.q[3][1]) / 4 * H;
      var meshWant = !!(s.mesh && s.mesh.on && W && H && !rec.meshFail);
      if (meshWant && !rec.mesh) {
        try { rec.mesh = makeMesh(); rec.mc = rec.mesh.mc; rec.mc.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;visibility:visible;pointer-events:none'; rec.box.appendChild(rec.mc); }
        catch (err) { rec.meshFail = true; rec.mesh = null; meshWant = false; }
      }
      rec.meshOn = meshWant;
      if (rec.mc) rec.mc.style.display = meshWant ? '' : 'none';
      if (meshWant) {
        el.style.width = W + 'px'; el.style.height = H + 'px';
        el.style.transform = 'none'; el.style.clipPath = 'none';
        el.style.background = '';
        el.style.borderRadius = ''; el.style.overflow = '';
        el.style.webkitMaskImage = ''; el.style.maskImage = ''; rec.fmStr = null;
      } else {
        el.style.width = s.w + 'px'; el.style.height = s.h + 'px';
        if (W && H) {
          var h = homography(s, W, H);
          if (h) {
            rec.baseXf = 'matrix3d(' + [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1].join(',') + ')';
            el.style.transform = (motionXf(s, performance.now(), self.level, rec.cx || 0, rec.cy || 0) + ' ' + rec.baseXf).trim();
          }
        }
        el.style.clipPath = isDefaultMask(s.mask)
          ? 'none'
          : 'polygon(' + s.mask.map(function (p) { return (p[0] * 100) + '% ' + (p[1] * 100) + '%'; }).join(',') + ')';
        el.style.background = s.cover ? '#000' : '';
        el.style.borderRadius = s.radius > 0 ? (Math.min(s.w, s.h) * s.radius / 100) + 'px' : '';
        el.style.overflow = s.radius > 0 ? 'hidden' : '';
        var fm = featherMask(s), cmk = cutMask(s);
        if (cmk) fm = (fm ? fm + ',' : '') + 'url(' + cmk.url + ')';
        if (rec.fmStr !== fm) {
          rec.fmStr = fm;
          el.style.webkitMaskImage = fm; el.style.maskImage = fm;
          el.style.webkitMaskComposite = fm ? 'source-in' : ''; el.style.maskComposite = fm ? 'intersect' : '';
          el.style.webkitMaskSize = fm ? '100% 100%' : ''; el.style.maskSize = fm ? '100% 100%' : '';
        }
      }
      
      el.style.mixBlendMode = s.blend === 'screen' ? 'screen' : 'normal';
      el.style.filter = surfFilter(s, performance.now(), self.level);

      if (fresh) {
        rec.fading = true;
        el.style.opacity = 0;
        el.style.transition = 'opacity .4s';
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { el.style.opacity = rec.s.opacity; });
        });
        setTimeout(function () {
          rec.fading = false;
          el.style.transition = '';
          el.style.opacity = rec.s.opacity;
        }, 500);
      } else if (!rec.fading) {
        el.style.opacity = s.opacity;
      }

      if (base.play) {
        var sp = s.speed || 1;
        if (base.playbackRate !== sp) base.playbackRate = sp;
      }
      self.syncExtras(rec, s);
      if (rec.meshOn) {
        if (rec.el && rec.el.style) rec.el.style.visibility = 'hidden';
        for (var mk in rec.ex) rec.ex[mk].el.style.visibility = 'hidden';
      } else {
        if (rec.el && rec.el.style) rec.el.style.visibility = '';
        for (var mk2 in rec.ex) rec.ex[mk2].el.style.visibility = '';
      }
    });

    Object.keys(this.recs).forEach(function (id) {
      if (seen[id]) return;
      var r = self.recs[id];
      delete self.recs[id];
      if (r.el.pause) r.el.pause();
      for (var xk in r.ex) if (r.ex[xk].el.pause) r.ex[xk].el.pause();
      r.box.style.transition = 'opacity .4s';
      r.box.style.opacity = 0;
      setTimeout(function () { if (r.box.parentNode) r.box.parentNode.removeChild(r.box); }, 450);
    });

    var order = ids.join(',');
    if (order !== this.order) {
      ids.forEach(function (id) { stage.insertBefore(self.recs[id].box, self.anchor); });
      this.order = order;
    }

    function playPause(el, on) {
      if (!el.play) return;
      if (on) {
        if (el.paused) { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
      } else if (!el.paused) {
        el.pause();
      }
    }
    ids.forEach(function (id) {
      var rec = self.recs[id];
      playPause(rec.el, state.playing && rec.visible);
      for (var xk in rec.ex) { if (rec.ex[xk].x && rec.ex[xk].x.tl) continue; playPause(rec.ex[xk].el, state.playing && rec.visible && rec.ex[xk].shown); }
    });
  };

  root.MapMath = { solveH: solveH, proj: proj, inv3: inv3, unproj: unproj, homography: homography, meshBase: meshBase, meshPoints: meshPoints };
  Renderer.drawFx = drawFx;
  root.Renderer = Renderer;
  Renderer.FX_KINDS = FX_KINDS;
  Renderer.normText = normText;
  Renderer.drawFx = drawFx;
  Renderer.drawText = drawText;
  Renderer.DEFAULT_FONT = DEFAULT_FONT;
})(typeof window !== 'undefined' ? window : globalThis);
