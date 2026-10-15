// Executa shaders GLSL validados num contexto WebGL isolado (canvas fora da tela) e entrega o resultado como imagem 2D.
// O shader só calcula cor. Se não compila ou o WebGL não existe, o efeito cai no brilho nativo e o editor segue funcionando.
(function (root) {
  'use strict';
  var V = root.ShaderValidator;
  var gl = null, cv = null, progs = {}, failed = {}, glTried = false;
  var VERT = 'attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }';

  function ensureGl() {
    if (gl || glTried) return gl;
    glTried = true;
    try {
      cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
      gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true, antialias: false, failIfMajorPerformanceCaveat: false });
      if (gl) {
        var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      }
    } catch (e) { gl = null; }
    return gl;
  }
  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { var log = gl.getShaderInfoLog(s) || 'erro de compilação'; gl.deleteShader(s); return { err: log }; }
    return { s: s };
  }
  // Traduz o log do compilador pra algo legível e ajusta o número da linha (o cabeçalho fixo ocupa 4 linhas).
  function friendly(log) {
    var m = /ERROR:\s*\d+:(\d+):\s*(.*)/.exec(log || '');
    if (!m) return String(log || 'erro de compilação').slice(0, 200);
    return 'linha ' + Math.max(1, +m[1] - 4) + ': ' + m[2].slice(0, 160);
  }
  // Compila (e guarda em cache). Devolve {ok,error}.
  function compile(src) {
    var v = V.validate(src);
    if (!v.ok) return { ok: false, error: v.error };
    if (!ensureGl()) return { ok: false, error: 'WebGL indisponível neste dispositivo.', noGl: true };
    if (progs[src]) return { ok: true };
    if (failed[src]) return { ok: false, error: failed[src] };
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, V.wrap(src));
    if (vs.err || fs.err) { failed[src] = friendly(fs.err || vs.err); return { ok: false, error: failed[src] }; }
    var p = gl.createProgram(); gl.attachShader(p, vs.s); gl.attachShader(p, fs.s); gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { failed[src] = friendly(gl.getProgramInfoLog(p)); return { ok: false, error: failed[src] }; }
    var loc = {}; V.UNIFORMS.forEach(function (n) { loc[n] = gl.getUniformLocation(p, n); });
    progs[src] = { p: p, loc: loc };
    return { ok: true };
  }
  function rgb(h) { var m = /^#?([0-9a-f]{6})$/i.exec(h || ''), n = m ? parseInt(m[1], 16) : 0xff4fa3; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
  var MAXPX = 512;
  function draw(c, ctx, W, H, timeMs, f) {
    var src = f.glsl, r = src ? compile(src) : { ok: false, error: 'sem código' };
    if (!r.ok) {
      f._error = r.error; // o editor mostra o motivo; o clipe continua tocando com o brilho nativo
      if (root.Textures) root.Textures.draw('ai-glow', ctx, W, H, timeMs, { color: f.color, speed: 1, p1: 0.5, p2: 0.6 }, c._tx || (c._tx = {}));
      return;
    }
    f._error = null;
    var k = Math.min(1, MAXPX / Math.max(W, H)), w = Math.max(2, Math.round(W * k)), h = Math.max(2, Math.round(H * k));
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
    var P = progs[src];
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(P.p); gl.bindBuffer(gl.ARRAY_BUFFER, gl.getParameter(gl.ARRAY_BUFFER_BINDING));
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    var L = P.loc, c1 = rgb(f.color), c2 = rgb(f.color2 || '#2fd8ff');
    gl.uniform1f(L.uTime, (timeMs || 0) / 1000); gl.uniform1f(L.uP1, f.p1 == null ? 1 : f.p1); gl.uniform1f(L.uP2, f.p2 == null ? 1 : f.p2);
    gl.uniform1f(L.uSpeed, f.speed || 1); gl.uniform1f(L.uScale, f.scale || 1); gl.uniform2f(L.uRes, w, h);
    gl.uniform3f(L.uColor1, c1[0], c1[1], c1[2]); gl.uniform3f(L.uColor2, c2[0], c2[1], c2[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    ctx.drawImage(cv, 0, 0, W, H);
  }
  root.GlslFx = { compile: compile, draw: draw, hasGl: function () { return !!ensureGl(); } };
})(typeof window !== 'undefined' ? window : globalThis);
