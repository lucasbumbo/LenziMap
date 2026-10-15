// Detecta a silhueta de um objeto numa foto e devolve o contorno como polígono (0 a 1).
// Ideia: o fundo é a cor da borda da foto. O que destoa do fundo é o objeto.
(function (root) {
  'use strict';

  function median(arr) {
    arr.sort(function (a, b) { return a - b; });
    return arr[arr.length >> 1] || 0;
  }

  function otsu(hist, total) {
    var sum = 0, i;
    for (i = 0; i < 256; i++) sum += i * hist[i];
    var sumB = 0, wB = 0, best = 0, thr = 0;
    for (i = 0; i < 256; i++) {
      wB += hist[i];
      if (!wB) continue;
      var wF = total - wB;
      if (!wF) break;
      sumB += i * hist[i];
      var mB = sumB / wB, mF = (sum - sumB) / wF;
      var between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = i; }
    }
    return thr;
  }

  function majority(m, w, h) {
    var out = new Uint8Array(m.length), x, y, dx, dy;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var c = 0;
        for (dy = -1; dy <= 1; dy++) {
          for (dx = -1; dx <= 1; dx++) {
            var xx = x + dx, yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx]) c++;
          }
        }
        out[y * w + x] = c >= 5 ? 1 : 0;
      }
    }
    return out;
  }

  function largest(m, w, h) {
    var lab = new Int32Array(m.length), best = 0, bestId = 0, id = 0, stack = new Int32Array(m.length), i;
    for (i = 0; i < m.length; i++) {
      if (!m[i] || lab[i]) continue;
      id++;
      var sp = 0, n = 0;
      stack[sp++] = i; lab[i] = id;
      while (sp) {
        var p = stack[--sp], px = p % w, py = (p - px) / w;
        n++;
        if (px > 0 && m[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack[sp++] = p - 1; }
        if (px < w - 1 && m[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack[sp++] = p + 1; }
        if (py > 0 && m[p - w] && !lab[p - w]) { lab[p - w] = id; stack[sp++] = p - w; }
        if (py < h - 1 && m[p + w] && !lab[p + w]) { lab[p + w] = id; stack[sp++] = p + w; }
      }
      if (n > best) { best = n; bestId = id; }
    }
    var out = new Uint8Array(m.length);
    if (!bestId) return out;
    for (i = 0; i < m.length; i++) if (lab[i] === bestId) out[i] = 1;
    return out;
  }

  // Preenche buracos: tudo que o fundo não alcança pela borda vira objeto
  function fillHoles(m, w, h) {
    var seen = new Uint8Array(m.length), stack = new Int32Array(m.length), sp = 0, i, x, y;
    function push(p) { if (!m[p] && !seen[p]) { seen[p] = 1; stack[sp++] = p; } }
    for (x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (sp) {
      var p = stack[--sp], px = p % w, py = (p - px) / w;
      if (px > 0) push(p - 1);
      if (px < w - 1) push(p + 1);
      if (py > 0) push(p - w);
      if (py < h - 1) push(p + w);
    }
    var out = new Uint8Array(m.length);
    for (i = 0; i < m.length; i++) out[i] = seen[i] ? 0 : 1;
    return out;
  }

  // Contorno por Moore-neighbor
  function contour(m, w, h) {
    var start = -1, i;
    for (i = 0; i < m.length; i++) if (m[i]) { start = i; break; }
    if (start < 0) return [];
    var dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    function at(x, y) { return x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1; }
    var sx = start % w, sy = (start - sx) / w;
    var pts = [[sx, sy]], cx = sx, cy = sy, back = 4, guard = 0, limit = w * h * 4;
    var first = true, firstDir = -1;
    while (guard++ < limit) {
      var found = false, k;
      for (k = 0; k < 8; k++) {
        var d = (back + 1 + k) % 8, nx = cx + dirs[d][0], ny = cy + dirs[d][1];
        if (at(nx, ny)) {
          if (first) { first = false; firstDir = d; }
          else if (nx === sx && ny === sy && d === firstDir) return pts;
          back = (d + 4) % 8;
          cx = nx; cy = ny;
          if (!(cx === sx && cy === sy)) pts.push([cx, cy]);
          found = true;
          break;
        }
      }
      if (!found) break;
      if (cx === sx && cy === sy && !first) {
        // voltou ao início
        return pts;
      }
    }
    return pts;
  }

  function perpDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
    if (!l) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    var t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }
  function dpOpen(pts, eps) {
    if (pts.length < 3) return pts.slice();
    var keep = new Uint8Array(pts.length), stack = [[0, pts.length - 1]];
    keep[0] = keep[pts.length - 1] = 1;
    while (stack.length) {
      var seg = stack.pop(), a = seg[0], b = seg[1], idx = -1, md = 0, i;
      for (i = a + 1; i < b; i++) {
        var d = perpDist(pts[i], pts[a], pts[b]);
        if (d > md) { md = d; idx = i; }
      }
      if (idx > -1 && md > eps) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
    }
    return pts.filter(function (p, i) { return keep[i]; });
  }
  function simplifyClosed(pts, eps) {
    if (pts.length < 4) return pts;
    // parte no ponto mais distante do primeiro
    var far = 0, md = 0, i;
    for (i = 1; i < pts.length; i++) {
      var d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
      if (d > md) { md = d; far = i; }
    }
    var a = dpOpen(pts.slice(0, far + 1), eps);
    var b = dpOpen(pts.slice(far).concat([pts[0]]), eps);
    return a.concat(b.slice(1, -1));
  }

  // data: Uint8ClampedArray RGBA, w x h. opts: { sens (0.3 a 3, padrão 1), invert }
  function trace(data, w, h, opts) {
    opts = opts || {};
    var sens = opts.sens || 1, n = w * h, i, x, y;
    var b = Math.max(2, Math.round(Math.min(w, h) * 0.04)), R = [], G = [], B = [];
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        if (x < b || y < b || x >= w - b || y >= h - b) {
          var p = (y * w + x) * 4;
          R.push(data[p]); G.push(data[p + 1]); B.push(data[p + 2]);
        }
      }
    }
    var br = median(R), bg = median(G), bb = median(B);
    var D = new Float32Array(n), hist = new Uint32Array(256);
    for (i = 0; i < n; i++) {
      var q = i * 4;
      var dr = data[q] - br, dg = data[q + 1] - bg, db = data[q + 2] - bb;
      var d = Math.sqrt(dr * dr + dg * dg + db * db);
      D[i] = d;
      hist[Math.min(255, Math.round(d * 255 / 441.7))]++;
    }
    var thr = otsu(hist, n) * 441.7 / 255 / sens;
    thr = Math.max(14, thr);
    var m = new Uint8Array(n), cnt = 0;
    for (i = 0; i < n; i++) { m[i] = D[i] > thr ? 1 : 0; cnt += m[i]; }
    if (opts.invert) { for (i = 0; i < n; i++) m[i] = m[i] ? 0 : 1; }
    m = majority(majority(m, w, h), w, h);
    m = largest(m, w, h);
    m = fillHoles(m, w, h);
    var area = 0;
    for (i = 0; i < n; i++) area += m[i];
    if (area < n * 0.003) return null;
    var c = contour(m, w, h);
    if (c.length < 3) return null;
    var eps = 0.004 * Math.max(w, h), poly = simplifyClosed(c, eps), guard = 0;
    while (poly.length > 72 && guard++ < 20) { eps *= 1.25; poly = simplifyClosed(c, eps); }
    if (poly.length < 3) return null;
    return {
      poly: poly.map(function (p) { return [+((p[0] + 0.5) / w).toFixed(4), +((p[1] + 0.5) / h).toFixed(4)]; }),
      ratio: area / n, mask: m, w: w, h: h
    };
  }

  root.Silhouette = { trace: trace };
})(typeof window !== 'undefined' ? window : globalThis);
