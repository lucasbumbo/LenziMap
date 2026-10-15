// Ferramentas de imagem locais, determinísticas e sem rede: cores dominantes, máscara assistida, mapa de profundidade
// por heurística e quadrilátero sugerido. IMPORTANTE: a segmentação aqui é por cor/bordas (crescimento de região), NÃO é
// SAM, e o mapa de profundidade é uma estimativa por luminosidade, NÃO um modelo de profundidade. A interface diz isso.
// Entrada: img = { width, height, data: Uint8ClampedArray RGBA }. Máscara: Uint8Array w*h (0..255).
(function (root) {
  'use strict';
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lum(d, i) { return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; }

  function dominantColors(img, n) {
    var d = img.data, bins = {}, step = Math.max(1, Math.floor(Math.sqrt(img.width * img.height / 4000))), x, y, i;
    for (y = 0; y < img.height; y += step) for (x = 0; x < img.width; x += step) {
      i = (y * img.width + x) * 4; if (d[i + 3] < 128) continue;
      var k = ((d[i] >> 5) << 6) | ((d[i + 1] >> 5) << 3) | (d[i + 2] >> 5);
      var b = bins[k] || (bins[k] = { n: 0, r: 0, g: 0, b: 0 }); b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
    }
    return Object.keys(bins).map(function (k) { return bins[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, n || 4).map(function (b) {
      function h(v) { v = Math.round(v / b.n); return (v < 16 ? '0' : '') + v.toString(16); }
      return '#' + h(b.r) + h(b.g) + h(b.b);
    });
  }

  // Crescimento de região a partir de um ponto. tol = distância máxima de cor (0..255) em relação à média local da semente.
  function regionGrow(img, sx, sy, tol, limit) {
    var w = img.width, h = img.height, d = img.data, mask = new Uint8Array(w * h), stack = [], seed = (sy * w + sx) * 4;
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return mask;
    // cor de referência = média de uma vizinhança 5x5 da semente (evita semente em ruído)
    var r = 0, g = 0, b = 0, c = 0, xx, yy;
    for (yy = Math.max(0, sy - 2); yy <= Math.min(h - 1, sy + 2); yy++) for (xx = Math.max(0, sx - 2); xx <= Math.min(w - 1, sx + 2); xx++) { var q = (yy * w + xx) * 4; r += d[q]; g += d[q + 1]; b += d[q + 2]; c++; }
    r /= c; g /= c; b /= c;
    var t2 = tol * tol * 3, seen = new Uint8Array(w * h), cnt = 0, max = limit || w * h;
    stack.push(sy * w + sx); seen[sy * w + sx] = 1;
    while (stack.length && cnt < max) {
      var p = stack.pop(), px = p % w, py = (p - px) / w, i = p * 4;
      var dr = d[i] - r, dg = d[i + 1] - g, db = d[i + 2] - b;
      if (dr * dr + dg * dg + db * db > t2) continue;
      mask[p] = 255; cnt++;
      if (px > 0 && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
      if (px < w - 1 && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
      if (py > 0 && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
      if (py < h - 1 && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
    }
    return mask;
  }
  // Máscara inicial para uma região detectada (fração 0..1): usa o centro da região como semente e limita ao retângulo.
  function maskFromRegion(img, reg, tol) {
    var w = img.width, h = img.height, x0 = Math.floor(reg.x * w), y0 = Math.floor(reg.y * h), x1 = Math.min(w, Math.ceil((reg.x + reg.w) * w)), y1 = Math.min(h, Math.ceil((reg.y + reg.h) * h));
    var cx = clamp(Math.floor((x0 + x1) / 2), 0, w - 1), cy = clamp(Math.floor((y0 + y1) / 2), 0, h - 1);
    var grown = regionGrow(img, cx, cy, tol == null ? 38 : tol), m = new Uint8Array(w * h), x, y, any = 0;
    for (y = y0; y < y1; y++) for (x = x0; x < x1; x++) { var p = y * w + x; if (grown[p]) { m[p] = 255; any++; } }
    if (any < (x1 - x0) * (y1 - y0) * 0.04) { // cresceu pouco (textura): cai para o retângulo inteiro, que o usuário refina
      for (y = y0; y < y1; y++) for (x = x0; x < x1; x++) m[y * w + x] = 255;
    }
    return m;
  }
  function paint(mask, w, h, cx, cy, radius, value) {
    var x0 = Math.max(0, Math.floor(cx - radius)), x1 = Math.min(w - 1, Math.ceil(cx + radius)), y0 = Math.max(0, Math.floor(cy - radius)), y1 = Math.min(h - 1, Math.ceil(cy + radius)), r2 = radius * radius;
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) mask[y * w + x] = value ? 255 : 0;
    return mask;
  }
  function invert(mask) { var o = new Uint8Array(mask.length); for (var i = 0; i < mask.length; i++) o[i] = 255 - mask[i]; return o; }
  // Refinar borda: n > 0 expande, n < 0 contrai (n passos de 1 px).
  function morph(mask, w, h, n) {
    var cur = mask, grow = n > 0, steps = Math.abs(n | 0);
    for (var s = 0; s < steps; s++) {
      var o = new Uint8Array(cur.length);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var p = y * w + x, v = cur[p];
        var l = x > 0 ? cur[p - 1] : (grow ? 0 : 255), r = x < w - 1 ? cur[p + 1] : (grow ? 0 : 255), u = y > 0 ? cur[p - w] : (grow ? 0 : 255), dn = y < h - 1 ? cur[p + w] : (grow ? 0 : 255);
        o[p] = grow ? Math.max(v, l, r, u, dn) : Math.min(v, l, r, u, dn);
      }
      cur = o;
    }
    return cur;
  }
  // Feather = desfoque de caixa separável (raio em px). Produz bordas suaves em 0..255.
  function feather(mask, w, h, radius) {
    radius = Math.round(radius); if (radius < 1) return mask;
    var tmp = new Float32Array(mask.length), out = new Uint8Array(mask.length), x, y, k, win = radius * 2 + 1;
    for (y = 0; y < h; y++) { var acc = 0; for (k = -radius; k <= radius; k++) acc += mask[y * w + clamp(k, 0, w - 1)];
      for (x = 0; x < w; x++) { tmp[y * w + x] = acc / win; acc += mask[y * w + clamp(x + radius + 1, 0, w - 1)] - mask[y * w + clamp(x - radius, 0, w - 1)]; } }
    for (x = 0; x < w; x++) { var a2 = 0; for (k = -radius; k <= radius; k++) a2 += tmp[clamp(k, 0, h - 1) * w + x];
      for (y = 0; y < h; y++) { out[y * w + x] = Math.round(a2 / win); a2 += tmp[clamp(y + radius + 1, 0, h - 1) * w + x] - tmp[clamp(y - radius, 0, h - 1) * w + x]; } }
    return out;
  }
  function area(mask) { var n = 0; for (var i = 0; i < mask.length; i++) if (mask[i] > 127) n++; return n / mask.length; }

  // Quadrilátero que aproxima uma máscara (pontos extremos nas diagonais). Em frações 0..1: [TL, TR, BR, BL].
  function quadFromMask(mask, w, h) {
    var best = [null, null, null, null], sc = [1e9, -1e9, -1e9, 1e9], x, y; // min(x+y)=TL, max(x-y)=TR, max(x+y)=BR, min(x-y)=BL
    var keep = [1e9, -1e9, -1e9, 1e9];
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (mask[y * w + x] < 128) continue;
      var s = x + y, d = x - y;
      if (s < keep[0]) { keep[0] = s; best[0] = [x, y]; }
      if (d > keep[1]) { keep[1] = d; best[1] = [x, y]; }
      if (s > keep[2]) { keep[2] = s; best[2] = [x, y]; }
      if (d < keep[3]) { keep[3] = d; best[3] = [x, y]; }
    }
    if (!best[0]) return null;
    return best.map(function (p) { return [+(p[0] / (w - 1)).toFixed(4), +(p[1] / (h - 1)).toFixed(4)]; });
  }
  function quadFromRegion(r) { return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]; }

  // Profundidade por heurística (luminosidade suavizada). p: { invert, near, far, contrast, blur }
  function depthFromLuma(img, p) {
    p = p || {}; var w = img.width, h = img.height, d = img.data, g = new Uint8Array(w * h), i;
    for (i = 0; i < w * h; i++) g[i] = lum(d, i * 4);
    if (p.blur) g = feather(g, w, h, p.blur);
    var near = p.near == null ? 0 : p.near, far = p.far == null ? 255 : p.far, c = p.contrast == null ? 1 : p.contrast, out = new Uint8Array(w * h);
    for (i = 0; i < out.length; i++) {
      var v = (g[i] - near) / Math.max(1, far - near); v = clamp((v - 0.5) * c + 0.5, 0, 1); out[i] = Math.round((p.invert ? 1 - v : v) * 255);
    }
    return out;
  }
  // Máscara em RGBA (branco com alfa = máscara) para virar PNG no navegador.
  function maskToRgba(mask, w, h) { var o = new Uint8ClampedArray(w * h * 4); for (var i = 0; i < mask.length; i++) { o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = 255; o[i * 4 + 3] = mask[i]; } return o; }

  var api = { dominantColors: dominantColors, regionGrow: regionGrow, maskFromRegion: maskFromRegion, paint: paint, invert: invert, morph: morph, feather: feather, area: area, quadFromMask: quadFromMask, quadFromRegion: quadFromRegion, depthFromLuma: depthFromLuma, maskToRgba: maskToRgba };
  root.ImageTools = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
