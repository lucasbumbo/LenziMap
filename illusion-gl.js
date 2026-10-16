// LenziMap 3.2: motor WebGL do 3D Illusion Creator. Um contexto fora da tela, isolado (como o GlslFx), sem dependências.
// Pipeline: cena virtual -> perspectiva do público (câmera de janela por face) -> textura da face -> saída calibrada
// (a textura entra no renderer como qualquer efeito, e a calibração de surface.q/máscara/malha continua igual).
// Tem buffer de profundidade (oclusão correta), recorte pelo plano da face e sombreamento com neblina de profundidade.
// Sem WebGL, ou se o contexto cair, desenha uma versão 2D simples e avisa em IllusionGL.status().
(function (root) {
  'use strict';
  var C = root.IllusionCore;
  var gl = null, cv = null, tried = false, lostAt = 0, prog = null, tprog = null, qprog = null, why = '';
  var geoCache = {}, texPool = {}, faceCv = {}, lastStats = { ms: 0, prims: 0, verts: 0, draws: 0, w: 0, h: 0 }, onStatus = null;
  var FLOATS = 12; // pos3 nor3 col4 mat2

  var VS = 'attribute vec3 aPos;attribute vec3 aNor;attribute vec4 aCol;attribute vec2 aMat;uniform mat4 uVP;' +
    'varying vec3 vN;varying vec3 vW;varying vec4 vC;varying vec2 vM;varying float vD;' +
    'void main(){vec4 p=uVP*vec4(aPos,1.0);gl_Position=p;vN=aNor;vW=aPos;vC=aCol;vM=aMat;vD=max(p.w,0.0);}';
  var FS = 'precision mediump float;varying vec3 vN;varying vec3 vW;varying vec4 vC;varying vec2 vM;varying float vD;' +
    'uniform vec3 uEye;uniform vec3 uAmb;uniform vec3 uKeyDir;uniform vec3 uKeyCol;uniform vec3 uCorePos;uniform vec3 uCoreCol;uniform float uCore;uniform float uFog;uniform float uNear;' +
    'void main(){vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;vec3 v=normalize(uEye-vW);vec3 L=normalize(uKeyDir);' +
    'float kd=max(dot(n,L),0.0);vec3 lc=uCorePos-vW;float dist=max(length(lc),0.001);float cd=max(dot(n,lc/dist),0.0)*uCore/(1.0+0.004*dist*dist);' +
    'vec3 lit=vC.rgb*(uAmb+uKeyCol*kd+uCoreCol*cd);vec3 col=mix(lit,vC.rgb,vM.x);' +
    'if(vM.y>0.0){vec3 h=normalize(L+v);col+=uKeyCol*pow(max(dot(n,h),0.0),40.0)*vM.y*0.6;}' +
    'float f=1.0-exp(-max(vD-uNear,0.0)*uFog);col*=(1.0-f);gl_FragColor=vec4(col*vC.a,vC.a);}';
  var TVS = 'attribute vec3 aPos;attribute vec2 aUv;uniform mat4 uVP;varying vec2 vUv;void main(){vUv=aUv;gl_Position=uVP*vec4(aPos,1.0);}';
  var TFS = 'precision mediump float;varying vec2 vUv;uniform sampler2D uTex;uniform vec3 uBase;uniform float uGain;void main(){vec4 t=texture2D(uTex,vUv);gl_FragColor=vec4(uBase+t.rgb*uGain,1.0);}';

  // Planos com mídia (paredes e objetos da Sala): textura RGBA, alpha pré-multiplicado, neblina leve
  var QVS = 'attribute vec3 aPos;attribute vec2 aUv;uniform mat4 uVP;uniform vec3 uEye;varying vec2 vUv;varying float vD;void main(){vUv=aUv;vD=length(aPos-uEye);gl_Position=uVP*vec4(aPos,1.0);}';
  var QFS = 'precision mediump float;varying vec2 vUv;varying float vD;uniform sampler2D uTex;uniform float uA;uniform float uLight;uniform float uFog;uniform float uNear;void main(){vec4 t=texture2D(uTex,vUv);float f=1.0-exp(-max(vD-uNear,0.0)*uFog);float a=t.a*uA;vec3 c=t.rgb*uLight*(1.0-f);gl_FragColor=vec4(c*a,a);}';

  // ---------- mídia (GIF, imagem) ----------
  // No Mac a imagem é lida pelo app (api.readImage) e vira um blob: assim o navegador não a trata como "de outra origem" e deixa
  // usar como textura. Sem api.readBytes (iOS, navegador) usa o endereço direto. Falhou? Marca e o painel avisa.
  var media = {}, mediaTx = {};
  var MIME = { gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', apng: 'image/apng', svg: 'image/svg+xml', bmp: 'image/bmp' };
  function mediaKey(m) { return m && (m.path || m.src) || ''; }
  // GIF/WebP animado: decodifica os quadros uma vez (ImageDecoder) e escolhe o quadro pelo relógio. Se não der, cai no <img>.
  function decodeFrames(e, url, buf0) {
    if (!e.anim || typeof ImageDecoder === 'undefined' || typeof fetch === 'undefined' || typeof createImageBitmap === 'undefined') return;
    var ty = /\.webp(\?|#|$)/i.test(e.key) ? 'image/webp' : /\.a?png(\?|#|$)/i.test(e.key) ? 'image/apng' : 'image/gif';
    (buf0 ? Promise.resolve(buf0) : fetch(url).then(function (r) { return r.arrayBuffer(); })).then(function (buf) {
      var d = new ImageDecoder({ data: buf, type: ty });
      return d.tracks.ready.then(function () {
        var n = Math.min(d.tracks.selectedTrack.frameCount, 240); if (n < 2) return;
        var list = [], total = 0, bytes = 0, i = 0;
        function next() {
          if (i >= n || bytes > 260e6) { if (list.length > 1) { e.frames = list; e.total = total; } return; }
          return d.decode({ frameIndex: i }).then(function (res) {
            var f = res.image, dur = Math.max(20, (f.duration || 100000) / 1000);
            return createImageBitmap(f, { premultiplyAlpha: 'none' }).then(function (bm) { bytes += bm.width * bm.height * 4; list.push({ bm: bm, end: (total += dur) }); f.close(); i++; return next(); });
          });
        }
        return next();
      });
    }).catch(function () {});
  }
  function getMedia(m) {
    var k = mediaKey(m); if (!k) return null;
    var e = media[k]; if (e) return e;
    e = media[k] = { key: k, ready: false, failed: false, err: '', img: null, anim: !/\.(png|jpe?g|bmp|svg)$/i.test(String(m.name || '').trim()) && !/\.(png|jpe?g|bmp|svg)$/i.test(k.split('?')[0].split('#')[0]), last: 0, w: 0, h: 0, uploads: 0 };
    function useUrl(url) {
      if (typeof document === 'undefined' || typeof Image === 'undefined') { e.failed = true; e.err = 'Sem navegador.'; return; }
      var im = new Image();
      im.onload = function () { e.ready = true; e.w = im.naturalWidth; e.h = im.naturalHeight; };
      im.onerror = function () { e.failed = true; e.err = 'Não consegui abrir a imagem.'; };
      im.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1';
      if (document.body) document.body.appendChild(im);
      e.img = im; im.src = url;
      decodeFrames(e, url, e.buf); e.buf = null;
    }
    var api = root.api;
    if (m.path && api && typeof api.readImage === 'function') {
      var ext = (m.path.split('.').pop() || '').toLowerCase();
      Promise.resolve(api.readImage(m.path)).then(function (buf) {
        if (!buf) throw new Error('arquivo vazio');
        e.url = URL.createObjectURL(new Blob([buf], { type: MIME[ext] || 'image/png' })); e.buf = buf;
        useUrl(e.url);
      }).catch(function (er) { e.failed = true; e.err = 'Não consegui ler o arquivo: ' + String(er && er.message || er).slice(0, 80); });
    } else if (m.src) useUrl(m.src);
    else { e.failed = true; e.err = 'Mídia sem caminho.'; }
    return e;
  }
  function mediaTexture(m, nowMs) {
    var e = getMedia(m); if (!e) return null;
    if (!e.ready || e.failed || !gl) return null;
    var tx = mediaTx[e.key];
    var src = e.img, fi = -1;
    if (e.frames && e.total > 0) { var tm = nowMs % e.total; fi = 0; while (fi < e.frames.length - 1 && e.frames[fi].end <= tm) fi++; src = e.frames[fi].bm; }
    var need = !tx || (fi >= 0 ? fi !== e.fi : (e.anim && nowMs - e.last > 33));
    if (need) {
      try {
        if (!tx) tx = mediaTx[e.key] = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
        var iw = src.naturalWidth || src.width || 0, ih = src.naturalHeight || src.height || 0; e.fi = fi;
        var pot = iw > 1 && ih > 1 && (iw & (iw - 1)) === 0 && (ih & (ih - 1)) === 0, mip = false;
        if (pot) { try { gl.generateMipmap(gl.TEXTURE_2D); mip = true; var an = gl.getExtension('EXT_texture_filter_anisotropic'); if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT))); } catch (e2) { mip = false; } }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        e.last = nowMs; e.uploads++;
      } catch (er) { e.failed = true; e.err = 'O navegador bloqueou a imagem como textura: ' + String(er && er.message || er).slice(0, 80); return null; }
    }
    return tx;
  }
  function mediaStatus() {
    var o = { total: 0, loading: 0, failed: 0, ok: 0, errors: [], items: [] };
    Object.keys(media).forEach(function (k) { var e = media[k]; o.total++; o.items.push({ key: k, anim: e.anim, uploads: e.uploads }); if (e.failed) { o.failed++; o.errors.push((k.split(/[\\/]/).pop()) + ': ' + e.err); } else if (e.ready) o.ok++; else o.loading++; });
    return o;
  }
  var qbuf = null, qdata = new Float32Array(30);
  function drawQuads(r, VP, solid, nowMs, light, fog) {
    var list = (r.scene.quads || []).filter(function (q) { return !!q.solid === solid; });
    if (!list.length) return 0;
    var eye = r.eye, items = [];
    list.forEach(function (q) {
      var tx = mediaTexture(q.m, nowMs);
      if (!tx && !q.solid) return;                       // objeto ainda carregando ou com erro: some, sem quebrar a cena
      var T = C.m.trs(q.p, q.r, q.s), Wm = C.m.mul(r.local.M, T);
      var pts = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(function (v) { return C.m.pt(Wm, [v[0], v[1], 0]); });
      var c = C.m.pt(Wm, [0, 0, 0]);
      items.push({ q: q, tx: tx, pts: pts, d: (c[0] - eye[0]) * (c[0] - eye[0]) + (c[1] - eye[1]) * (c[1] - eye[1]) + (c[2] - eye[2]) * (c[2] - eye[2]) });
    });
    if (!items.length) return 0;
    items.sort(function (a, b) { return b.d - a.d; });
    gl.useProgram(qprog.p);
    gl.uniformMatrix4fv(qprog.u.uVP, false, new Float32Array(VP));
    gl.uniform3f(qprog.u.uEye, eye[0], eye[1], eye[2]);
    gl.uniform1f(qprog.u.uLight, Math.min(1.5, light)); gl.uniform1f(qprog.u.uFog, fog); gl.uniform1f(qprog.u.uNear, r.cam.dist);
    if (!qbuf) qbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qbuf);
    gl.disableVertexAttribArray(2); gl.disableVertexAttribArray(3);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(!!solid);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(qprog.u.uTex, 0);
    var n = 0;
    items.forEach(function (it) {
      var tx = it.tx;
      if (!tx) { tx = mediaTx['_blank'] || (mediaTx['_blank'] = (function () { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([40, 44, 60, 255])); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); return t; })()); }
      gl.bindTexture(gl.TEXTURE_2D, tx);
      var q = it.q, fu = q.flipU ? 1 : 0, fv = q.flipV ? 1 : 0, p = it.pts, uv = [[0, 1], [1, 1], [1, 0], [0, 0]], o = 0, order = [0, 1, 2, 0, 2, 3], j;
      var asp = 1;
      if (q.sprite) { var me = getMedia(q.m); if (me && me.w && me.h) asp = me.w / me.h; }
      if (q.sprite && asp !== 1) {                               // objeto mantém a proporção da imagem
        var cx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4, cy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4, cz = (p[0][2] + p[1][2] + p[2][2] + p[3][2]) / 4;
        p = p.map(function (v) { return [cx + (v[0] - cx) * asp, v[1], cz + (v[2] - cz)]; });
      }
      var arr = new Float32Array(30);
      for (j = 0; j < 6; j++) {
        var k = order[j], u = uv[k][0], v = uv[k][1];
        if (fu) u = 1 - u; if (fv) v = 1 - v;
        arr[o++] = p[k][0]; arr[o++] = p[k][1]; arr[o++] = p[k][2]; arr[o++] = u; arr[o++] = v;
      }
      gl.uniform1f(qprog.u.uA, q.a);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STREAM_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, 6); n++;
    });
    gl.depthMask(true);
    return n;
  }

  function mkProg(vs, fs, attrs) {
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader'); return s; }
    var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    attrs.forEach(function (a, i) { gl.bindAttribLocation(p, i, a); });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return { p: p, u: u };
  }

  function ensureGl() {
    if (gl) return gl;
    if (tried && Date.now() - lostAt < 1500) return null;
    tried = true; vbo = null;
    try {
      cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
      gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, preserveDrawingBuffer: true, failIfMajorPerformanceCaveat: false });
      if (!gl) { why = 'O WebGL não está disponível neste aparelho.'; return null; }
      prog = mkProg(VS, FS, ['aPos', 'aNor', 'aCol', 'aMat']);
      tprog = mkProg(TVS, TFS, ['aPos', 'aUv']);
      qprog = mkProg(QVS, QFS, ['aPos', 'aUv']);
      cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); gl = null; prog = tprog = qprog = null; vbo = null; qbuf = null; geoCache = {}; texPool = {}; mediaTx = {}; lostAt = Date.now(); why = 'O contexto WebGL foi perdido. Tentando de novo.'; if (onStatus) onStatus(status()); }, false);
      why = '';
    } catch (e) { gl = null; why = 'Falha ao iniciar o WebGL: ' + String(e && e.message || e).slice(0, 120); lostAt = Date.now(); }
    return gl;
  }
  function status() { return { ok: !!gl, reason: gl ? '' : (why || 'WebGL ainda não iniciado.'), stats: lastStats }; }

  // ---------- modelos básicos (triângulos soltos, sem índice, pra não ter limite de vértices) ----------
  function tri(pos, nor, a, b, c, n) { [a, b, c].forEach(function (v) { pos.push(v[0], v[1], v[2]); nor.push(n[0], n[1], n[2]); }); }
  function quadTris(pos, nor, a, b, c, d, n) { tri(pos, nor, a, b, c, n); tri(pos, nor, a, c, d, n); }
  function smoothTri(pos, nor, a, b, c, na, nb, nc) { [[a, na], [b, nb], [c, nc]].forEach(function (x) { pos.push(x[0][0], x[0][1], x[0][2]); nor.push(x[1][0], x[1][1], x[1][2]); }); }
  function segs(q) { return q === 'low' ? 8 : (q === 'high' ? 20 : 12); }

  function model(kind, n, ratio, q) {
    var key = kind + ':' + n + ':' + ratio + ':' + (kind === 'sphere' || kind === 'cyl' || kind === 'torus' ? q : '');
    if (geoCache[key]) return geoCache[key];
    var pos = [], nor = [], edges = null, i, j, S = segs(q);
    if (kind === 'quad') {
      quadTris(pos, nor, [-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0], [0, 0, 1]);
    } else if (kind === 'box') {
      var h = 0.5, F = [
        [[h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h], [1, 0, 0]], [[-h, -h, h], [-h, h, h], [-h, h, -h], [-h, -h, -h], [-1, 0, 0]],
        [[-h, h, -h], [-h, h, h], [h, h, h], [h, h, -h], [0, 1, 0]], [[-h, -h, h], [-h, -h, -h], [h, -h, -h], [h, -h, h], [0, -1, 0]],
        [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h], [0, 0, 1]], [[h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h], [0, 0, -1]]
      ];
      F.forEach(function (f) { quadTris(pos, nor, f[0], f[1], f[2], f[3], f[4]); });
      var v = [[-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h], [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]], ed = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      edges = []; ed.forEach(function (e) { edges.push(v[e[0]][0], v[e[0]][1], v[e[0]][2], v[e[1]][0], v[e[1]][1], v[e[1]][2]); });
    } else if (kind === 'sphere') {
      var la = Math.max(5, Math.round(S * 0.7)), lo = S;
      for (i = 0; i < la; i++) for (j = 0; j < lo; j++) {
        var t0 = i / la * Math.PI, t1 = (i + 1) / la * Math.PI, p0 = j / lo * 2 * Math.PI, p1 = (j + 1) / lo * 2 * Math.PI;
        var P = function (t, p) { return [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)]; };
        var a = P(t0, p0), b = P(t1, p0), c = P(t1, p1), d = P(t0, p1);
        smoothTri(pos, nor, a, b, c, a, b, c); smoothTri(pos, nor, a, c, d, a, c, d);
      }
    } else if (kind === 'cyl') {
      for (j = 0; j < S; j++) {
        var q0 = j / S * 2 * Math.PI, q1 = (j + 1) / S * 2 * Math.PI, c0 = Math.cos(q0), s0 = Math.sin(q0), c1 = Math.cos(q1), s1 = Math.sin(q1);
        var A = [c0, -0.5, s0], B = [c1, -0.5, s1], Cc = [c1, 0.5, s1], D = [c0, 0.5, s0];
        smoothTri(pos, nor, A, B, Cc, [c0, 0, s0], [c1, 0, s1], [c1, 0, s1]); smoothTri(pos, nor, A, Cc, D, [c0, 0, s0], [c1, 0, s1], [c0, 0, s0]);
        tri(pos, nor, [0, 0.5, 0], D, Cc, [0, 1, 0]); tri(pos, nor, [0, -0.5, 0], B, A, [0, -1, 0]);
      }
    } else if (kind === 'torus') {
      var M = S + 4, m = Math.max(5, Math.round(S * 0.6)), r = ratio || 0.28;
      var T = function (u, v2) { var cu = Math.cos(u), su = Math.sin(u), cv2 = Math.cos(v2), sv = Math.sin(v2); return { p: [(1 + r * cv2) * cu, r * sv, (1 + r * cv2) * su], n: [cv2 * cu, sv, cv2 * su] }; };
      for (i = 0; i < M; i++) for (j = 0; j < m; j++) {
        var u0 = i / M * 2 * Math.PI, u1 = (i + 1) / M * 2 * Math.PI, w0 = j / m * 2 * Math.PI, w1 = (j + 1) / m * 2 * Math.PI;
        var a1 = T(u0, w0), b1 = T(u1, w0), c2 = T(u1, w1), d1 = T(u0, w1);
        smoothTri(pos, nor, a1.p, b1.p, c2.p, a1.n, b1.n, c2.n); smoothTri(pos, nor, a1.p, c2.p, d1.p, a1.n, c2.n, d1.n);
      }
    } else if (kind === 'gear') {
      var N = Math.max(4, Math.min(40, n || 12)), root2 = 0.78, ring = [], zt = 0.5, zb = -0.5;
      for (i = 0; i < N; i++) {
        var base = i / N * 2 * Math.PI, st = 2 * Math.PI / N;
        [[0.0, root2], [0.18, root2], [0.3, 1], [0.58, 1], [0.7, root2]].forEach(function (pt) { var an = base + pt[0] * st; ring.push([Math.cos(an) * pt[1], Math.sin(an) * pt[1]]); });
      }
      var L = ring.length;
      for (i = 0; i < L; i++) {
        var a2 = ring[i], b2 = ring[(i + 1) % L], dx = b2[0] - a2[0], dy = b2[1] - a2[1], ln = Math.hypot(dx, dy) || 1, nn = [dy / ln, -dx / ln, 0];
        quadTris(pos, nor, [a2[0], a2[1], zb], [b2[0], b2[1], zb], [b2[0], b2[1], zt], [a2[0], a2[1], zt], nn);
        tri(pos, nor, [0, 0, zt], [a2[0], a2[1], zt], [b2[0], b2[1], zt], [0, 0, 1]); tri(pos, nor, [0, 0, zb], [b2[0], b2[1], zb], [a2[0], a2[1], zb], [0, 0, -1]);
      }
      edges = []; for (i = 0; i < L; i++) { var a3 = ring[i], b3 = ring[(i + 1) % L]; edges.push(a3[0], a3[1], zt, b3[0], b3[1], zt, a3[0], a3[1], zb, b3[0], b3[1], zb); }
    }
    var g = { pos: new Float32Array(pos), nor: new Float32Array(nor), count: pos.length / 3, edges: edges ? new Float32Array(edges) : null };
    if (!edges && kind === 'quad') g.edges = null;
    geoCache[key] = g;
    return g;
  }

  // ---------- lote de vértices (todas as primitivas de um grupo viram UMA chamada de desenho) ----------
  function Batch() { this.f = new Float32Array(FLOATS * 4096); this.n = 0; }
  Batch.prototype.reserve = function (v) {
    var need = (this.n + v) * FLOATS;
    if (need > this.f.length) { var nf = new Float32Array(Math.max(need, this.f.length * 2)); nf.set(this.f); this.f = nf; }
  };
  var tmpN = [0, 0, 0];
  Batch.prototype.add = function (g, W, Rm, sc, col, e, a, sh) {
    this.reserve(g.count);
    var f = this.f, o = this.n * FLOATS, i, p = g.pos, nr = g.nor, ix, x, y, z, nx, ny, nz, l;
    var ex = 1 / (sc[0] || 1), ey = 1 / (sc[1] || 1), ez = 1 / (sc[2] || 1);
    for (i = 0; i < g.count; i++) {
      ix = i * 3; x = p[ix]; y = p[ix + 1]; z = p[ix + 2];
      f[o] = W[0] * x + W[4] * y + W[8] * z + W[12]; f[o + 1] = W[1] * x + W[5] * y + W[9] * z + W[13]; f[o + 2] = W[2] * x + W[6] * y + W[10] * z + W[14];
      nx = nr[ix] * ex; ny = nr[ix + 1] * ey; nz = nr[ix + 2] * ez;
      var wx = Rm[0] * nx + Rm[4] * ny + Rm[8] * nz, wy = Rm[1] * nx + Rm[5] * ny + Rm[9] * nz, wz = Rm[2] * nx + Rm[6] * ny + Rm[10] * nz;
      l = Math.sqrt(wx * wx + wy * wy + wz * wz) || 1;
      f[o + 3] = wx / l; f[o + 4] = wy / l; f[o + 5] = wz / l;
      f[o + 6] = col[0]; f[o + 7] = col[1]; f[o + 8] = col[2]; f[o + 9] = a; f[o + 10] = e; f[o + 11] = sh;
      o += FLOATS;
    }
    this.n += g.count;
  };
  Batch.prototype.addLines = function (edges, W, col, a) {
    var cnt = edges.length / 3; this.reserve(cnt);
    var f = this.f, o = this.n * FLOATS, i, x, y, z;
    for (i = 0; i < cnt; i++) {
      x = edges[i * 3]; y = edges[i * 3 + 1]; z = edges[i * 3 + 2];
      f[o] = W[0] * x + W[4] * y + W[8] * z + W[12]; f[o + 1] = W[1] * x + W[5] * y + W[9] * z + W[13]; f[o + 2] = W[2] * x + W[6] * y + W[10] * z + W[14];
      f[o + 3] = 0; f[o + 4] = 0; f[o + 5] = 1; f[o + 6] = col[0]; f[o + 7] = col[1]; f[o + 8] = col[2]; f[o + 9] = a; f[o + 10] = 1; f[o + 11] = 0;
      o += FLOATS;
    }
    this.n += cnt;
  };
  var vbo = null;
  function flush(b, mode) {
    if (!b.n) return 0;
    if (!vbo) vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, b.f.subarray(0, b.n * FLOATS), gl.STREAM_DRAW);
    var st = FLOATS * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, st, 40);
    gl.drawArrays(mode, 0, b.n);
    return 1;
  }

  // Preenche os lotes com as primitivas de uma cena (quadro local -> mundo)
  function fill(scene, localM, eye, q, B) {
    var verts = 0;
    scene.prims.forEach(function (p) {
      var g = model(p.k === 'cyl' ? 'cyl' : p.k, p.n, p.ratio, q);
      if (!g) return;
      var T = C.m.trs(p.p, p.r, p.s), W = C.m.mul(localM, T), Rm = C.m.mul(localM, C.m.rot(p.r[0], p.r[1], p.r[2]));
      if (p.wire && g.edges) { B.lines.addLines(g.edges, W, p.c, p.a); verts += g.edges.length / 3; return; }
      var tgt = p.add ? B.add : (p.a < 0.999 ? B.alpha : B.opaque);
      if (tgt === B.alpha) { var c = C.m.pt(W, [0, 0, 0]); p._d = (c[0] - eye[0]) * (c[0] - eye[0]) + (c[1] - eye[1]) * (c[1] - eye[1]) + (c[2] - eye[2]) * (c[2] - eye[2]); }
      tgt.list = tgt.list || [];
      tgt.list.push({ g: g, W: W, Rm: Rm, s: p.s, c: p.c, e: p.e, a: p.a, sh: p.sh, d: p._d || 0 });
      verts += g.count;
    });
    [B.opaque, B.alpha, B.add].forEach(function (b) {
      if (!b.list) return;
      if (b === B.alpha) b.list.sort(function (x, y) { return y.d - x.d; });
      b.list.forEach(function (it) { b.add(it.g, it.W, it.Rm, it.s, it.c, it.e, it.a, it.sh); });
      b.list = null;
    });
    return verts;
  }

  function hexc(c) { return C.hex(c); }
  var QS = { low: [0.25, 320], medium: [0.5, 640], high: [1, 1280] };
  function sizeFor(W, H, quality) {
    var Q = QS[quality] || QS.medium, k = Math.min(Q[0] * 1, Q[1] / Math.max(W, H));
    if (quality === 'high') k = Math.min(1, Q[1] / Math.max(W, H));
    return [Math.max(16, Math.round(W * k)), Math.max(16, Math.round(H * k))];
  }

  // Desenha UMA face no canvas GL (largura w, altura h). r vem de IllusionCore.resolveFace.
  function renderFaceGL(r, il, ill, w, h) {
    var P = r.scene.params, L = il.light;
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!r.cam) return { prims: 0, verts: 0, draws: 0 };
    var B = { opaque: new Batch(), alpha: new Batch(), add: new Batch(), lines: new Batch() };
    B.opaque.list = []; B.alpha.list = []; B.add.list = [];
    var verts = fill(r.scene, r.local.M, r.eye, il.quality, B);
    var VP = C.m.mul(r.cam.proj, r.cam.view), key = C.v.norm(C.m.dir(r.local.M, L.keyDir)), kc = hexc(L.keyColor), cc = hexc(L.coreColor);
    var lightK = P.light, coreZ = r.scene.scope === 'face' ? -Math.min(P.depth, 120) * 0.5 : 0, cp = C.m.pt(r.local.M, [0, 0, coreZ]);
    gl.useProgram(prog.p);
    gl.uniformMatrix4fv(prog.u.uVP, false, new Float32Array(VP));
    gl.uniform3f(prog.u.uEye, r.eye[0], r.eye[1], r.eye[2]);
    gl.uniform3f(prog.u.uAmb, L.ambient * lightK, L.ambient * lightK, L.ambient * lightK);
    gl.uniform3f(prog.u.uKeyDir, key[0], key[1], key[2]);
    gl.uniform3f(prog.u.uKeyCol, kc[0] * L.key * lightK, kc[1] * L.key * lightK, kc[2] * L.key * lightK);
    gl.uniform3f(prog.u.uCorePos, cp[0], cp[1], cp[2]);
    gl.uniform3f(prog.u.uCoreCol, cc[0] * lightK, cc[1] * lightK, cc[2] * lightK);
    gl.uniform1f(prog.u.uCore, L.core * 6.0);
    var span = r.scene.scope === 'face' ? Math.max(40, P.depth) : 120;
    gl.uniform1f(prog.u.uFog, 2.2 / span); gl.uniform1f(prog.u.uNear, r.cam.dist);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
    var draws = 0;
    gl.disable(gl.BLEND); gl.depthMask(true);
    draws += flush(B.opaque, gl.TRIANGLES) + flush(B.lines, gl.LINES);
    var nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now(), hasQ = r.scene.quads && r.scene.quads.length;
    if (hasQ) { draws += drawQuads(r, VP, true, nowMs, lightK, (2.2 / span) * 0.35); gl.useProgram(prog.p); }   // paredes com mídia (opacas)
    gl.enable(gl.BLEND); gl.depthMask(false);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); draws += flush(B.alpha, gl.TRIANGLES);
    gl.blendFunc(gl.ONE, gl.ONE); draws += flush(B.add, gl.TRIANGLES);
    if (hasQ) draws += drawQuads(r, VP, false, nowMs, lightK, (2.2 / span) * 0.35);                                  // objetos com mídia (transparentes)
    gl.depthMask(true); gl.disable(gl.BLEND);
    return { prims: r.scene.prims.length, verts: verts, draws: draws };
  }

  var normCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function sigOf(il) { try { return JSON.stringify(il); } catch (e) { return ''; } }
  function getIl(il) {
    if (!il) return null;
    var s = sigOf(il), hit = normCache && normCache.get(il);
    if (hit && hit.s === s) return hit.v;
    var r = C.validate(il, null);
    if (!r.ok) return null;
    if (normCache) normCache.set(il, { s: s, v: r.value });
    return r.value;
  }

  // Versão 2D simples (sem WebGL): anéis concêntricos que lembram a profundidade. Não é anamórfica, só evita tela vazia.
  function fallback2d(c, ctx, W, H, t, il) {
    var c1 = il ? il.style.color1 : '#2fd8ff', c2 = il ? il.style.color2 : '#ff4fa3', n = 12, i;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = Math.max(2, W / 200);
    for (i = n; i >= 1; i--) {
      var k = ((i + t * 0.8) % n) / n, s = Math.pow(k, 1.6);
      ctx.strokeStyle = i % 2 ? c1 : c2; ctx.globalAlpha = 0.25 + 0.75 * (1 - s);
      var w = W * (1 - s * 0.95), h = H * (1 - s * 0.95);
      ctx.strokeRect((W - w) / 2, (H - h) / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }

  // Chamado pelo renderer (kind 'illusion'). time em ms (relógio do clipe), f = fx do clipe, key = chave da superfície.
  function draw(c, ctx, W, H, timeMs, f, key) {
    var il = getIl(f && f.illusion), t = (timeMs || 0) / 1000;
    if (!il) { ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(0, 0, W, H); f && (f._error = 'Ilusão inválida ou ausente.'); return; }
    var t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    var rig = C.rig, r = C.resolveFace(rig, il, f.ill, key, t);
    if (!ensureGl()) { f._error = why; fallback2d(c, ctx, W, H, t, il); return; }
    f._error = null;
    ctx.clearRect(0, 0, W, H);
    if (!r.cam) return;
    var sz = sizeFor(W, H, il.quality), s;
    try { s = renderFaceGL(r, il, f.ill, sz[0], sz[1]); } catch (e) { f._error = 'Falha ao desenhar: ' + String(e && e.message || e).slice(0, 100); why = f._error; fallback2d(c, ctx, W, H, t, il); return; }
    ctx.drawImage(cv, 0, 0, W, H);
    lastStats = { ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0, prims: s.prims, verts: s.verts, draws: s.draws, w: sz[0], h: sz[1] };
  }

  // ---------- visão de palco (Audience / Free Camera): a mesma textura de cada face colada nas faces físicas do cubo ----------
  function faceCanvas(id, size) {
    var c = faceCv[id] || (faceCv[id] = document.createElement('canvas'));
    if (c.width !== size) { c.width = size; c.height = size; }
    return c;
  }
  // Textura (canvas 2D) de uma face específica, a mesma que iria pra saída
  function faceTexture(rig, il, ill, cubeId, face, t, size) {
    il = getIl(il); if (!il || !ensureGl()) return null;
    var r = C.resolveFace(rig, il, ill, null, t, { cube: cubeId, face: face });
    var c = faceCanvas(cubeId + ':' + face, size), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    if (!r.cam) return c;
    var s = renderFaceGL(r, il, ill, size, size);
    ctx.drawImage(cv, 0, 0, size, size);
    return c;
  }
  function texOf(id, canvas) {
    var tx = texPool[id];
    if (!tx) { tx = texPool[id] = gl.createTexture(); }
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tx;
  }

  // Desenha o palco inteiro num canvas 2D. opts: {rig, il, ill, t, view:'audience'|'free'|'projector', orbit:{yaw,pitch,dist}, size}
  var lastFaces = [];
  function inPoly(poly, x, y) { var ins = false, i, j; for (i = 0, j = poly.length - 1; i < poly.length; j = i++) { if (((poly[i][1] > y) !== (poly[j][1] > y)) && (x < (poly[j][0] - poly[i][0]) * (y - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0])) ins = !ins; } return ins; }
  // Faces do último desenho do palco, em pixels do canvas, e qual face está embaixo do ponto (x, y)
  function stageFaces() { return lastFaces; }
  function pickFace(x, y) { var best = null; lastFaces.forEach(function (f) { if (f.visible && inPoly(f.poly, x, y) && (!best || f.dist < best.dist)) best = f; }); return best ? { cube: best.cube, face: best.face } : null; }
  function drawStage(target, opts) {
    var W = target.width, H = target.height, tctx = target.getContext('2d'), rig = opts.rig || C.defaultStage(), il = getIl(opts.il), t = opts.t || 0, view = opts.view || 'audience', ext = opts.faceTextures || null;
    // Base compartilhada (Stage Preview 3D, 3.0 fase 12): sem ilusão, desenha só os canvases em opts.faceTextures {'cubo:face': canvas}
    if (!il && ext) il = { target: { cube: null, faces: [] }, camera: { fov: 40 }, quality: 'medium' };
    if (!ensureGl() || !il) { tctx.fillStyle = '#0b0d12'; tctx.fillRect(0, 0, W, H); tctx.fillStyle = '#9aa'; tctx.font = '12px sans-serif'; tctx.fillText(il ? (why || 'WebGL indisponível') : 'Sem ilusão', 10, 20); return false; }
    var tg = C.cubeById(rig, il.target.cube) || (ext && !opts.il ? { id: null, pos: [0, 0, 0], size: 16 } : rig.cubes[0]), faceSize = il.quality === 'low' ? 128 : (il.quality === 'high' ? 512 : 256);
    // 1) texturas de todas as faces visíveis dos cubos do alvo
    var tex = {};
    rig.cubes.forEach(function (cube) {
      C.FACES.forEach(function (fc) {
        var fr = C.faceFrame(cube, fc);
        if (!C.visibleFrom(fr, rig.viewer.pos) && view === 'audience') return;
        if (ext && ext[cube.id + ':' + fc]) { tex[cube.id + ':' + fc] = ext[cube.id + ':' + fc]; return; }
        if (cube.id !== tg.id || il.target.faces.indexOf(fc) < 0) return;
        tex[cube.id + ':' + fc] = faceTexture(rig, il, opts.ill, cube.id, fc, t, faceSize);
      });
    });
    if (view === 'projector') {
      tctx.fillStyle = '#05070c'; tctx.fillRect(0, 0, W, H);
      var keys = Object.keys(tex), cw = Math.floor(W / Math.max(1, keys.length)), i;
      keys.forEach(function (k, ix) { if (tex[k]) tctx.drawImage(tex[k], ix * cw + 4, 4, cw - 8, Math.min(H - 8, cw - 8)); tctx.fillStyle = '#9aa'; tctx.font = '11px sans-serif'; tctx.fillText(k.replace(':', ' · '), ix * cw + 8, H - 8); });
      return true;
    }
    // 2) passe em perspectiva
    if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H;
    gl.viewport(0, 0, W, H); gl.clearColor(0.03, 0.035, 0.05, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var cen = [0, 0, 0], eye, fovV = view === 'free' ? 40 : il.camera.fov;
    rig.cubes.forEach(function (cb) { cen = C.v.add(cen, cb.pos); }); cen = C.v.mul(cen, 1 / rig.cubes.length);
    if (view === 'audience' && tg.id) {
      // Vista da plateia: olha o cubo alvo e fecha o campo de visão em volta dele (cerca de 24 graus pra cubo de 16" a 130").
      var dv = C.v.len(C.v.sub(rig.viewer.pos, tg.pos)) || 1;
      cen = tg.pos.slice(); fovV = Math.max(10, Math.min(60, 2 * Math.atan2(tg.size * 1.5, dv) * 180 / Math.PI));
    }
    if (view === 'free' && opts.focus && tg && tg.pos) cen = tg.pos.slice();
    if (view === 'free') {
      var o = opts.orbit || { yaw: 25, pitch: 20, dist: 150 }, ya = o.yaw * Math.PI / 180, pa = o.pitch * Math.PI / 180;
      eye = [cen[0] + Math.sin(ya) * Math.cos(pa) * o.dist, cen[1] + Math.sin(pa) * o.dist, cen[2] + Math.cos(ya) * Math.cos(pa) * o.dist];
    } else eye = rig.viewer.pos.slice();
    var VP = C.m.mul(C.m.perspective(fovV, W / H, 1, 3000), C.m.lookAt(eye, cen, [0, 1, 0]));
    lastFaces = [];
    rig.cubes.forEach(function (cube) {
      C.FACES.forEach(function (fc) {
        var fr = C.faceFrame(cube, fc), poly = [], ok = true;
        fr.corners.forEach(function (q) {
          var cx = VP[0] * q[0] + VP[4] * q[1] + VP[8] * q[2] + VP[12], cy = VP[1] * q[0] + VP[5] * q[1] + VP[9] * q[2] + VP[13], cw = VP[3] * q[0] + VP[7] * q[1] + VP[11] * q[2] + VP[15];
          if (cw <= 0.01) { ok = false; return; }
          poly.push([(cx / cw * 0.5 + 0.5) * W, (1 - (cy / cw * 0.5 + 0.5)) * H]);
        });
        if (!ok) return;
        lastFaces.push({ cube: cube.id, face: fc, poly: poly, visible: C.visibleFrom(fr, eye), dist: C.v.len(C.v.sub(fr.center, eye)) });
      });
    });
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
    // chão e arestas dos cubos (programa principal, linhas emissivas)
    var L = new Batch(), flr = new Batch(), I = C.m.ident(), g = 40, gi;
    for (gi = -g; gi <= g; gi += 10) { L.addLines(new Float32Array([gi * 3, 0, -g * 3, gi * 3, 0, g * 3]), I, [0.16, 0.2, 0.28], 1); L.addLines(new Float32Array([-g * 3, 0, gi * 3, g * 3, 0, gi * 3]), I, [0.16, 0.2, 0.28], 1); }
    rig.cubes.forEach(function (cb) { var bx = model('box', 0, 0, 'low'); L.addLines(bx.edges, C.m.trs(cb.pos, [0, cb.rotY, 0], [cb.size, cb.size, cb.size]), cb.id === tg.id ? [0.5, 0.7, 1] : [0.35, 0.4, 0.5], 1); });
    // marcador do ponto de vista (cruz)
    var vp = rig.viewer.pos; [[10, 0, 0], [0, 10, 0], [0, 0, 10]].forEach(function (d) { L.addLines(new Float32Array([vp[0] - d[0], vp[1] - d[1], vp[2] - d[2], vp[0] + d[0], vp[1] + d[1], vp[2] + d[2]]), I, [1, 0.8, 0.2], 1); });
    gl.useProgram(prog.p);
    gl.uniformMatrix4fv(prog.u.uVP, false, new Float32Array(VP));
    gl.uniform3f(prog.u.uEye, eye[0], eye[1], eye[2]); gl.uniform3f(prog.u.uAmb, 1, 1, 1); gl.uniform3f(prog.u.uKeyDir, 0, 1, 0); gl.uniform3f(prog.u.uKeyCol, 0, 0, 0);
    gl.uniform3f(prog.u.uCorePos, 0, 0, 0); gl.uniform3f(prog.u.uCoreCol, 0, 0, 0); gl.uniform1f(prog.u.uCore, 0); gl.uniform1f(prog.u.uFog, 0); gl.uniform1f(prog.u.uNear, 0);
    // faces: base escura + textura somada (como a luz do projetor sobre a superfície)
    gl.useProgram(tprog.p);
    gl.uniformMatrix4fv(tprog.u.uVP, false, new Float32Array(VP));
    var qb = gl.createBuffer();
    rig.cubes.forEach(function (cube) {
      C.FACES.forEach(function (fc) {
        var fr = C.faceFrame(cube, fc), co = fr.corners, tx = tex[cube.id + ':' + fc];
        var data = new Float32Array([co[0][0], co[0][1], co[0][2], 0, 0, co[1][0], co[1][1], co[1][2], 1, 0, co[3][0], co[3][1], co[3][2], 0, 1, co[2][0], co[2][1], co[2][2], 1, 1]);
        gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
        gl.disableVertexAttribArray(2); gl.disableVertexAttribArray(3);
        var vis = C.visibleFrom(fr, eye), base = vis ? 0.16 : 0.07;
        gl.uniform3f(tprog.u.uBase, base, base * 1.05, base * 1.2);
        if (tx) { gl.activeTexture(gl.TEXTURE0); texOf(cube.id + fc, tx); gl.uniform1i(tprog.u.uTex, 0); gl.uniform1f(tprog.u.uGain, vis ? 1 : 0); }
        else { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texOf('blank', faceCanvas('blank', 2))); gl.uniform1i(tprog.u.uTex, 0); gl.uniform1f(tprog.u.uGain, 0); }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      });
    });
    gl.deleteBuffer(qb);
    gl.useProgram(prog.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    flush(L, gl.LINES);
    gl.disable(gl.BLEND);
    tctx.clearRect(0, 0, W, H); tctx.drawImage(cv, 0, 0, W, H);
    return true;
  }

  // Lê pixels do canvas GL no último desenho (testes)
  function readPixel(x, y) { var px = new Uint8Array(4); if (!gl) return null; gl.readPixels(x, cv.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return Array.prototype.slice.call(px); }

  root.IllusionGL = {
    draw: draw, drawStage: drawStage, stageFaces: stageFaces, pickFace: pickFace, faceTexture: faceTexture, hasGl: function () { return !!ensureGl(); }, status: status, mediaStatus: mediaStatus,
    setStatusHandler: function (fn) { onStatus = fn; }, readPixel: readPixel, sizeFor: sizeFor, _renderFace: function (r, il, ill, w, h) { if (!ensureGl()) return null; return renderFaceGL(r, getIl(il), ill, w, h); },
    _cv: function () { return cv; }, _forceLoss: function () { if (gl) { var e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } }
  };
})(typeof window !== 'undefined' ? window : globalThis);
