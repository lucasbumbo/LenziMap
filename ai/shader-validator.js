// Validação estática de shaders GLSL gerados por IA. Roda ANTES de qualquer compilação.
// Contrato: o código recebido define apenas  vec4 lenziEffect(vec2 uv)  e usa só os uniforms liberados.
// O LenziMap monta o resto do shader (precision, uniforms, main). Nada de JavaScript, arquivos ou sistema:
// GLSL só calcula cor; o validador ainda barra o que poderia travar a GPU (laços sem limite, texturas, pré-processador).
(function (root) {
  'use strict';
  var MAX_CHARS = 6000, MAX_LINES = 220, MAX_LOOP = 64, MAX_LOOP_PRODUCT = 256, MAX_LOOPS = 4;
  var UNIFORMS = ['uTime', 'uRes', 'uP1', 'uP2', 'uColor1', 'uColor2', 'uSpeed', 'uScale'];
  var FORBIDDEN = ['uniform', 'attribute', 'varying', 'sampler2D', 'samplerCube', 'texture2D', 'texture2DLod', 'textureCube', 'precision', 'main', 'while', 'do', 'goto', 'asm', 'switch', 'struct', 'extension'];

  function stripComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' '); }

  function validate(src) {
    if (typeof src !== 'string' || !src.trim()) return { ok: false, error: 'O shader está vazio.' };
    if (src.length > MAX_CHARS) return { ok: false, error: 'O shader passa de ' + MAX_CHARS + ' caracteres.' };
    if (src.split('\n').length > MAX_LINES) return { ok: false, error: 'O shader passa de ' + MAX_LINES + ' linhas.' };
    if (/[^\x09\x0a\x0d\x20-\x7e]/.test(src)) return { ok: false, error: 'O shader tem caracteres fora de ASCII.' };
    var code = stripComments(src);
    if (code.indexOf('#') >= 0) return { ok: false, error: 'Diretivas com # (define, extension, version) não são permitidas.' };
    if (/\bgl_(?!FragCoord\b)\w*/.test(code)) return { ok: false, error: 'Variáveis gl_ não são permitidas (só gl_FragCoord).' };
    for (var i = 0; i < FORBIDDEN.length; i++) {
      if (new RegExp('\\b' + FORBIDDEN[i] + '\\b').test(code)) return { ok: false, error: '"' + FORBIDDEN[i] + '" não é permitido em shaders gerados.' };
    }
    var u = code.match(/\bu[A-Z]\w*/g) || [];
    for (var j = 0; j < u.length; j++) if (UNIFORMS.indexOf(u[j]) < 0) return { ok: false, error: 'Uniform "' + u[j] + '" não existe. Liberados: ' + UNIFORMS.join(', ') + '.' };
    if (!/\bvec4\s+lenziEffect\s*\(\s*vec2\s+\w+\s*\)/.test(code)) return { ok: false, error: 'Falta a função  vec4 lenziEffect(vec2 uv).' };
    var depthOk = (code.match(/\{/g) || []).length === (code.match(/\}/g) || []).length;
    if (!depthOk) return { ok: false, error: 'Chaves { } desbalanceadas.' };
    var fors = code.match(/\bfor\b/g) || [];
    if (fors.length > MAX_LOOPS) return { ok: false, error: 'Mais de ' + MAX_LOOPS + ' laços for.' };
    var good = code.match(/\bfor\s*\(\s*int\s+(\w+)\s*=\s*(\d+)\s*;\s*\1\s*<=?\s*(\d+)\s*;\s*(?:\1\+\+|\+\+\1)\s*\)/g) || [];
    if (good.length !== fors.length) return { ok: false, error: 'Todo laço for precisa ser  for (int i = 0; i < N; i++)  com N constante.' };
    var prod = 1;
    for (var k = 0; k < good.length; k++) {
      var m = /=\s*(\d+)\s*;\s*\w+\s*(<=?)\s*(\d+)/.exec(good[k]), n = +m[3] - +m[1] + (m[2] === '<=' ? 1 : 0);
      if (n > MAX_LOOP) return { ok: false, error: 'Laço com mais de ' + MAX_LOOP + ' passos.' };
      prod *= Math.max(1, n);
    }
    if (prod > MAX_LOOP_PRODUCT) return { ok: false, error: 'Laços somados passam de ' + MAX_LOOP_PRODUCT + ' passos por pixel.' };
    return { ok: true, error: null };
  }

  // Monta o fragment shader completo (o código do usuário fica entre o cabeçalho fixo e o main fixo).
  function wrap(src) {
    return 'precision mediump float;\nuniform float uTime; uniform float uP1; uniform float uP2; uniform float uSpeed; uniform float uScale;\n' +
      'uniform vec2 uRes; uniform vec3 uColor1; uniform vec3 uColor2; varying vec2 vUv;\n' + src +
      '\nvoid main(){ vec4 c = lenziEffect(vUv); float a = clamp(c.a, 0.0, 1.0); gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0) * a, a); }\n';
  }

  // Shaders nativos de referência (passam pelo mesmo validador): servem de base, de exemplo e de fallback.
  var PRESETS = {
    'lava': { name: 'Lava', code: 'vec4 lenziEffect(vec2 uv) {\n  float t = uTime * uSpeed * 0.4;\n  float v = 0.0;\n  for (int i = 0; i < 4; i++) {\n    float f = float(i) + 1.0;\n    v += sin(uv.x * 6.0 * f * uScale + t * f) * cos(uv.y * 5.0 * f * uScale - t * 0.7 * f) / f;\n  }\n  float h = smoothstep(-0.2, 1.0, v * 0.5 + 0.5);\n  vec3 col = mix(uColor2, uColor1, h);\n  return vec4(col * (0.5 + 0.8 * h * uP2), 0.35 + 0.6 * h * uP1);\n}' },
    'plasma': { name: 'Plasma', code: 'vec4 lenziEffect(vec2 uv) {\n  float t = uTime * uSpeed;\n  float a = sin(uv.x * 10.0 * uScale + t) + sin(uv.y * 8.0 * uScale - t * 1.3) + sin((uv.x + uv.y) * 6.0 * uScale + t * 0.7);\n  float h = 0.5 + 0.5 * sin(a);\n  return vec4(mix(uColor1, uColor2, h) * uP2, 0.8 * uP1);\n}' },
    'scanline-energy': { name: 'Energia varrendo', code: 'vec4 lenziEffect(vec2 uv) {\n  float y = fract(uTime * uSpeed * 0.3);\n  float d = abs(uv.y - y);\n  float band = smoothstep(0.12, 0.0, d);\n  float lines = 0.5 + 0.5 * sin(uv.x * 80.0 * uScale);\n  return vec4(mix(uColor1, uColor2, lines) * (0.4 + band), band * uP1 * uP2);\n}' }
  };

  var api = { validate: validate, wrap: wrap, PRESETS: PRESETS, UNIFORMS: UNIFORMS, MAX_CHARS: MAX_CHARS };
  root.ShaderValidator = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
