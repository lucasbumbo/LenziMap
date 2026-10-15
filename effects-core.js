// LenziMap 3.0 fase 9: Effects Browser. Módulo PURO (sem DOM): catálogo, validação e cálculo da pilha de efeitos de um clipe.
//
// Dois tipos de efeito, sem duplicar o motor existente:
//  - PROCESSAMENTO (pilha do clipe, clip.efx): Glow, Blur, Aberração cromática, Displacement, Pixelate, Noise, Glitch, Strobe.
//    São filtros CSS/SVG aplicados ao próprio clipe (vídeo, imagem, efeito ou texto), calculados a cada quadro a partir do tempo.
//  - GERADORES: Particles, Glitch, Noise, Strobe etc. continuam sendo os efeitos que o app já tinha (Textures e AI Director, via FX_KINDS).
//    O navegador só os lista e cria o clipe de efeito comum na timeline, numa camada acima do clipe selecionado. Nenhum motor novo.
//
// Mesclagem por clipe (clip.blend): Normal, Add, Screen, Multiply, Overlay.
// Tudo é função do tempo (determinístico): o mesmo instante dá sempre o mesmo resultado, no Viewer e na saída externa.
// Nada aqui toca em surface.q. Os efeitos só mudam a imagem do clipe.
(function (root) {
  'use strict';
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function num(v, d) { v = +v; return isFinite(v) ? v : d; }
  var MAX_EFX = 8;

  var BLENDS = [
    { id: 'normal', label: 'Normal', css: 'normal', canvas: 'source-over' },
    { id: 'add', label: 'Add (somar luz)', css: 'plus-lighter', canvas: 'lighter' },
    { id: 'screen', label: 'Screen (clarear)', css: 'screen', canvas: 'screen' },
    { id: 'multiply', label: 'Multiply (escurecer)', css: 'multiply', canvas: 'multiply' },
    { id: 'overlay', label: 'Overlay (contraste)', css: 'overlay', canvas: 'overlay' }
  ];
  function blendOf(id) { for (var i = 0; i < BLENDS.length; i++) if (BLENDS[i].id === id) return BLENDS[i]; return BLENDS[0]; }
  function fixBlend(b) { return blendOf(b).id; }
  // "screen" e "normal" já existiam em itens soltos; aceitamos os nomes CSS antigos também
  function cssBlend(b) { return blendOf(b).css; }
  function canvasBlend(b) { return blendOf(b).canvas; }

  function P(label, min, max, step, def, unit) { return { label: label, min: min, max: max, step: step, def: def, unit: unit || '' }; }
  var TYPES = {
    glow: { name: 'Glow', cat: 'Luz', svg: true, desc: 'Brilho que vaza das áreas claras da imagem (bloom).', params: { amount: P('Intensidade', 0, 1, 0.01, 0.6), size: P('Raio', 1, 60, 1, 16, 'px'), threshold: P('Limiar', 0, 0.95, 0.01, 0.5) } },
    blur: { name: 'Blur', cat: 'Foco', svg: false, desc: 'Desfoque suave. Intensidade 100% = 40 px.', params: { amount: P('Intensidade', 0, 1, 0.01, 0.25) } },
    pixelate: { name: 'Pixelate', cat: 'Foco', svg: true, desc: 'Mosaico de pixels grandes. Intensidade 100% = blocos de 60 px.', params: { amount: P('Intensidade', 0, 1, 0.01, 0.3) } },
    chroma: { name: 'Chromatic Aberration', cat: 'Distorção', svg: true, desc: 'Separa os canais vermelho e azul, como uma lente ruim.', params: { amount: P('Intensidade', 0, 1, 0.01, 0.4), angle: P('Ângulo', 0, 360, 1, 0, '°') } },
    displace: { name: 'Displacement', cat: 'Distorção', svg: true, desc: 'Deforma a imagem com ondas de ruído.', params: { amount: P('Intensidade', 0, 1, 0.01, 0.35), scale: P('Tamanho das ondas', 1, 100, 1, 20), speed: P('Velocidade', 0, 4, 0.1, 1) } },
    glitch: { name: 'Glitch', cat: 'Distorção', svg: true, desc: 'Falhas digitais: faixas deslocadas com separação de cor em surtos.', params: { amount: P('Intensidade', 0, 1, 0.01, 0.5), speed: P('Frequência', 0.2, 4, 0.1, 1) } },
    noise: { name: 'Noise', cat: 'Textura', svg: true, desc: 'Granulação animada sobre a imagem.', params: { amount: P('Intensidade', 0, 1, 0.01, 0.35), speed: P('Velocidade', 0, 4, 0.1, 1) } },
    strobe: { name: 'Strobe', cat: 'Luz', svg: false, desc: 'Pisca o clipe em onda quadrada. Intensidade = profundidade do apagão.', params: { amount: P('Intensidade', 0, 1, 0.01, 0.8), rate: P('Frequência', 0.5, 30, 0.5, 6, 'Hz') } }
  };
  var ORDER = ['glow', 'blur', 'pixelate', 'chroma', 'displace', 'glitch', 'noise', 'strobe'];

  // Geradores já existentes no app (Textures + AI Director). Só são referenciados por id; quem desenha é o motor atual.
  var GENERATORS = [
    { id: 'ai-particles', name: 'Particles · Partículas de luz', group: 'Particles' }, { id: 'faiscas', name: 'Particles · Faíscas', group: 'Particles' },
    { id: 'estrelas', name: 'Particles · Viagem estelar', group: 'Particles' }, { id: 'brilhos', name: 'Particles · Brilhos', group: 'Particles' }, { id: 'vagalumes', name: 'Particles · Vagalumes', group: 'Particles' },
    { id: 'glitchrgb', name: 'Glitch · RGB', group: 'Glitch' }, { id: 'glitchblocos', name: 'Glitch · Blocos digitais', group: 'Glitch' }, { id: 'ai-glitch', name: 'Glitch · IA', group: 'Glitch' },
    { id: 'ruido', name: 'Noise · Ruído', group: 'Noise' }, { id: 'graofilme', name: 'Noise · Grão de filme', group: 'Noise' }, { id: 'estatica', name: 'Noise · Estática de TV', group: 'Noise' },
    { id: 'estrobo', name: 'Strobe · Estrobo', group: 'Strobe' }, { id: 'ai-pulse', name: 'Strobe · Pulso no ritmo', group: 'Strobe' },
    { id: 'ai-glow', name: 'Glow · Brilho (IA)', group: 'Glow' }, { id: 'vazamento', name: 'Glow · Vazamento de luz', group: 'Glow' }
  ];

  function defaults(type) { var t = TYPES[type], o = {}; if (!t) return o; Object.keys(t.params).forEach(function (k) { o[k] = t.params[k].def; }); return o; }
  var seqn = 0;
  function newId() { return 'e' + Date.now().toString(36).slice(-4) + (seqn++).toString(36); }
  function create(type) {
    if (!TYPES[type]) return null;
    var ef = { id: newId(), type: type, on: true }; var d = defaults(type); for (var k in d) ef[k] = d[k]; return ef;
  }
  function sanitizeOne(e) {
    if (!e || !TYPES[e.type]) return null;
    var t = TYPES[e.type], o = { id: typeof e.id === 'string' && /^[\w-]{1,24}$/.test(e.id) ? e.id : newId(), type: e.type, on: e.on !== false };
    Object.keys(t.params).forEach(function (k) { var p = t.params[k]; o[k] = clamp(num(e[k], p.def), p.min, p.max); });
    return o;
  }
  function sanitize(list) {
    if (!Array.isArray(list)) return [];
    var out = [], seen = {};
    list.slice(0, MAX_EFX).forEach(function (e) { var o = sanitizeOne(e); if (!o) return; if (seen[o.id]) o.id = newId(); seen[o.id] = 1; out.push(o); });
    return out;
  }
  function label(e) { return (TYPES[e.type] ? TYPES[e.type].name : e.type); }

  // ---------- cálculo por quadro ----------
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function f(n, d) { return (+n).toFixed(d == null ? 3 : d); }
  function filterTag(id, extra) { return '<filter id="' + id + '" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB"' + (extra || '') + '>'; }
  var CM = function (a, b, c) { return '<feColorMatrix in="SourceGraphic" type="matrix" values="' + a + '" result="' + b + '"/>'; };
  function chanMatrix(r, g, b) { return [r, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0].join(' '); }
  function chromaMarkup(id, off, ang) {
    var dx = Math.cos(ang * Math.PI / 180) * off, dy = Math.sin(ang * Math.PI / 180) * off;
    return filterTag(id) + CM(chanMatrix(1, 0, 0), 'r') + '<feOffset in="r" dx="' + f(dx, 2) + '" dy="' + f(dy, 2) + '" result="r2"/>' + CM(chanMatrix(0, 1, 0), 'g') + CM(chanMatrix(0, 0, 1), 'b') +
      '<feOffset in="b" dx="' + f(-dx, 2) + '" dy="' + f(-dy, 2) + '" result="b2"/><feBlend in="r2" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b2" mode="screen"/></filter>';
  }
  // Devolve { css, def:{id,markup}|null, opacity } de UM efeito. amount já vem avaliado (keyframes).
  function evalOne(e, amount, t, cid) {
    var id = 'lmfx-' + String(cid || 'x').replace(/[^\w-]/g, '') + '-' + e.id, a = clamp(num(amount, e.amount != null ? e.amount : 0), 0, 1), out = { css: '', def: null, opacity: 1 };
    if (!e.on || a <= 0.0005) return out;
    switch (e.type) {
      case 'blur': out.css = 'blur(' + f(a * 40, 2) + 'px)'; break;
      case 'strobe': {
        var hz = clamp(num(e.rate, 6), 0.5, 30), on = Math.floor(t * hz * 2) % 2 === 0; out.opacity = on ? 1 : 1 - a; break;
      }
      case 'glow': {
        var th = clamp(num(e.threshold, 0.5), 0, 0.95), K = 1 / (1 - th), r = clamp(num(e.size, 16), 1, 60) * (0.4 + a), A = a * 2.2;
        out.def = { id: id, markup: filterTag(id) + '<feComponentTransfer in="SourceGraphic" result="hi"><feFuncR type="linear" slope="' + f(K) + '" intercept="' + f(-K * th) + '"/><feFuncG type="linear" slope="' + f(K) + '" intercept="' + f(-K * th) + '"/><feFuncB type="linear" slope="' + f(K) + '" intercept="' + f(-K * th) + '"/></feComponentTransfer>' +
          '<feGaussianBlur in="hi" stdDeviation="' + f(r, 2) + '" result="bl"/><feComponentTransfer in="bl" result="bg"><feFuncR type="linear" slope="' + f(A) + '"/><feFuncG type="linear" slope="' + f(A) + '"/><feFuncB type="linear" slope="' + f(A) + '"/></feComponentTransfer><feBlend in="SourceGraphic" in2="bg" mode="screen"/></filter>' };
        out.css = 'url(#' + id + ')'; break;
      }
      case 'chroma': out.def = { id: id, markup: chromaMarkup(id, a * 24, num(e.angle, 0)) }; out.css = 'url(#' + id + ')'; break;
      case 'displace': {
        var fq = clamp(num(e.scale, 20), 1, 100) / 4000, sp = clamp(num(e.speed, 1), 0, 4), wob = fq * (1 + 0.25 * Math.sin(t * sp * 1.7));
        out.def = { id: id, markup: filterTag(id) + '<feTurbulence type="fractalNoise" baseFrequency="' + f(wob, 5) + ' ' + f(wob * (1 + 0.3 * Math.cos(t * sp)), 5) + '" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="' + f(a * 90, 2) + '" xChannelSelector="R" yChannelSelector="G"/></filter>' };
        out.css = 'url(#' + id + ')'; break;
      }
      case 'pixelate': {
        var S = Math.max(2, Math.round(2 + a * 58)), h = Math.max(1, Math.floor(S / 2));
        out.def = { id: id, markup: '<filter id="' + id + '" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feFlood x="' + (h - 1) + '" y="' + (h - 1) + '" width="2" height="2"/><feComposite width="' + S + '" height="' + S + '"/><feTile result="tl"/><feComposite in="SourceGraphic" in2="tl" operator="in"/><feMorphology operator="dilate" radius="' + h + '"/></filter>' };
        out.css = 'url(#' + id + ')'; break;
      }
      case 'noise': {
        var spn = clamp(num(e.speed, 1), 0, 4), seed = Math.floor(t * spn * 24) % 997;
        out.def = { id: id, markup: filterTag(id) + '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="' + seed + '" result="n"/><feColorMatrix in="n" type="saturate" values="0" result="m"/><feComposite in="SourceGraphic" in2="m" operator="arithmetic" k1="0" k2="1" k3="' + f(a * 0.8) + '" k4="' + f(-a * 0.4) + '"/></filter>' };
        out.css = 'url(#' + id + ')'; break;
      }
      case 'glitch': {
        var spg = clamp(num(e.speed, 1), 0.2, 4), idx = Math.floor(t * spg * 10), r1 = hash(idx), on2 = r1 < 0.15 + a * 0.7;
        if (!on2) { out.def = { id: id, markup: filterTag(id) + '<feOffset dx="0" dy="0"/></filter>' }; }
        else {
          var band = 0.02 + hash(idx + 5) * 0.06, sc = a * 110 * (0.4 + hash(idx + 9)), off = a * 14 * (0.5 + hash(idx + 3)), dx = Math.cos(hash(idx + 1) * 6.28) * off;
          out.def = { id: id, markup: filterTag(id) + '<feTurbulence type="fractalNoise" baseFrequency="0.002 ' + f(band, 4) + '" numOctaves="1" seed="' + (idx % 997) + '" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="' + f(sc, 2) + '" xChannelSelector="R" yChannelSelector="B" result="d"/>' +
            '<feColorMatrix in="d" type="matrix" values="' + chanMatrix(1, 0, 0) + '" result="r"/><feOffset in="r" dx="' + f(dx, 2) + '" dy="0" result="r2"/><feColorMatrix in="d" type="matrix" values="' + chanMatrix(0, 1, 0) + '" result="g"/><feColorMatrix in="d" type="matrix" values="' + chanMatrix(0, 0, 1) + '" result="b"/><feOffset in="b" dx="' + f(-dx, 2) + '" dy="0" result="b2"/><feBlend in="r2" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b2" mode="screen"/></filter>' };
        }
        out.css = 'url(#' + id + ')'; break;
      }
    }
    return out;
  }
  // Pilha inteira: amountOf(effectId) devolve o valor (com keyframe) de cada efeito. skip = { tipo: true } para o modo de desempenho.
  function evalStack(list, amountOf, t, cid, skip) {
    var css = [], defs = [], op = 1;
    (list || []).forEach(function (e) {
      if (skip && skip[e.type]) return;
      var r = evalOne(e, amountOf ? amountOf(e.id) : e.amount, t, cid);
      if (r.css) css.push(r.css); if (r.def) defs.push(r.def); op *= r.opacity;
    });
    return { filter: css.join(' '), defs: defs, opacity: op, active: css.length > 0 || op < 1 };
  }

  var api = {
    MAX_EFX: MAX_EFX, BLENDS: BLENDS, TYPES: TYPES, ORDER: ORDER, GENERATORS: GENERATORS,
    blendOf: blendOf, fixBlend: fixBlend, cssBlend: cssBlend, canvasBlend: canvasBlend,
    defaults: defaults, create: create, sanitize: sanitize, sanitizeOne: sanitizeOne, label: label, evalOne: evalOne, evalStack: evalStack, hash: hash
  };
  root.EffectsCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
