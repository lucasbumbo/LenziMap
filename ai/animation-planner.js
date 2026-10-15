// Planejador de animação. Transforma texto em um Animation Plan (objeto validado por ai-schema), nunca em código solto.
// Dois caminhos: (1) com IA: monta o pedido e valida a resposta; (2) local: regras por palavras-chave (modo demonstração,
// identificado como "local" na interface; não é IA). Os dois produzem o MESMO formato de plano.
(function (root) {
  'use strict';
  var S = root.AiSchema || (typeof require !== 'undefined' ? require('./ai-schema.js') : null);
  var FX = root.AiEffects || null;

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var COLORS = [
    [/\b(ouro|dourad\w*|gold\w*)\b/, '#ffc83a'], [/\b(rosa|pink|magenta)\b/, '#ff4fa3'], [/\b(azul|blue)\b/, '#2f7bff'], [/\b(ciano|cyan|turquesa)\b/, '#2fd8ff'],
    [/\b(verde|green)\b/, '#35f08a'], [/\b(vermelh\w*|red|fogo|fire|lava)\b/, '#ff3b2f'], [/\b(roxo|purple|violeta)\b/, '#9a5cff'], [/\b(laranja|orange)\b/, '#ff8a2a'], [/\b(branc\w*|white)\b/, '#ffffff']
  ];
  var DEFAULT_COLOR = { 'ai-cracks': '#ffb347', 'ai-glow': '#ffe08a', 'ai-gold': '#ffc83a', 'ai-neon-lines': '#00f0ff', 'ai-ocean': '#2f7bff', 'ai-particles': '#ffe08a', 'ai-energy-core': '#9a5cff', 'ai-glitch': '#ff2fd0', 'ai-burst': '#ffffff', 'ai-pulse': '#00f0ff' };
  var DEFAULT_COLOR2 = { 'ai-neon-lines': '#ff2fd0', 'ai-ocean': '#2fd8ff', 'ai-energy-core': '#00f0ff', 'ai-glitch': '#00f0ff', 'ai-burst': '#ffb347' };
  var ONE_SHOT = { 'ai-cracks': 1, 'ai-gold': 1, 'ai-burst': 1 };

  function findColor(t) { for (var i = 0; i < COLORS.length; i++) if (COLORS[i][0].test(t)) return COLORS[i][1]; return null; }
  function k(t, v, i) { return { t: t, v: v, i: i || 'linear' }; }

  // Keyframes e fades típicos para cada efeito dentro de uma camada de duração d.
  function shapeFor(effect, d) {
    if (effect === 'ai-cracks') return { keyframes: { p1: [k(0, 0), k(d * 0.7, 1, 'ease'), k(d, 1)], p2: [k(0, 0.6), k(d * 0.7, 1.4), k(d, 1)] }, fadeIn: Math.min(0.6, d / 4), fadeOut: Math.min(0.8, d / 4) };
    if (effect === 'ai-gold') return { keyframes: { p1: [k(0, 0), k(d * 0.8, 1, 'ease'), k(d, 1)] }, fadeIn: 0.3, fadeOut: Math.min(0.8, d / 4) };
    if (effect === 'ai-burst') return { keyframes: { p1: [k(0, 0), k(d, 1, 'ease')], p2: [k(0, 1.6), k(d, 0.6)] }, fadeIn: 0, fadeOut: Math.min(0.4, d / 4) };
    if (effect === 'ai-glow') return { keyframes: { p2: [k(0, 0), k(d * 0.5, 1.4, 'ease'), k(d, 0.9, 'ease')], p1: [k(0, 0.3), k(d, 1)] }, fadeIn: Math.min(0.5, d / 4), fadeOut: Math.min(0.6, d / 4) };
    return { keyframes: {}, fadeIn: Math.min(0.8, d / 4), fadeOut: Math.min(0.8, d / 4) };
  }

  // Monta um plano a partir de uma lista ordenada de efeitos (usado pelo planejador local e pelas sugestões).
  // opts: { duration, target:'all'|'each'|[keys], stagger, color, maskRef, beats, title }
  function planFromEffects(effects, opts) {
    opts = opts || {};
    var n = Math.max(1, effects.length), dur = opts.duration || 12, overlap = n > 1 ? Math.min(1.5, dur / n * 0.25) : 0;
    var seg = (dur + overlap * (n - 1)) / n, layers = [];
    effects.forEach(function (e, i) {
      var start = i * (seg - overlap), d = Math.min(seg, dur - start), sh = shapeFor(e, d);
      var L = { name: (FX && FX.info[e] ? FX.info[e].name : e), effect: e, color: opts.color || DEFAULT_COLOR[e] || '#ff4fa3', color2: DEFAULT_COLOR2[e] || null, speed: 1, scale: 1,
        start: start, duration: d, target: opts.target || 'all', stagger: opts.target === 'each' ? (opts.stagger == null ? 0.4 : opts.stagger) : 0,
        keyframes: sh.keyframes, fadeIn: sh.fadeIn, fadeOut: sh.fadeOut, maskRef: opts.maskRef || null, beatSync: false };
      if (e === 'ai-gold' && !opts.color) L.color = '#ffc83a';
      layers.push(L);
    });
    return { title: opts.title || 'Animação', duration: dur, layers: layers, notes: opts.notes || '', source: opts.source || 'local' };
  }

  // Planejador local por palavras-chave. Entende ordem ("depois"), duração ("30 segundos"), cor, alvo (cubos) e ritmo.
  function planFromPrompt(prompt, opts) {
    opts = opts || {};
    var t = norm(prompt), dur = opts.duration || 12, m = /(\d+(?:[.,]\d+)?)\s*(?:s\b|seg\w*|sec\w*|second\w*)/.exec(t), mm = /(\d+)\s*min\w*/.exec(t);
    if (m) dur = parseFloat(m[1].replace(',', '.')); else if (mm) dur = +mm[1] * 60;
    dur = Math.max(1, Math.min(300, dur));
    var found = [], warnings = [];
    if (FX) {
      var hits = [];
      FX.ids.forEach(function (id) {
        FX.info[id].words.forEach(function (w) {
          var idx = t.indexOf(norm(w)); if (idx >= 0) hits.push({ id: id, idx: idx });
        });
      });
      hits.sort(function (a, b) { return a.idx - b.idx; });
      hits.forEach(function (h) { if (found.indexOf(h.id) < 0) found.push(h.id); });
    }
    if (/\bdepois\b|\bentao\b|\bthen\b|\bfinalmente\b|\bpor fim\b/.test(t) === false && found.length > 1 && /\bao mesmo tempo\b|\bjunto\b|\bsimultane/.test(t)) { /* simultâneo: tudo começa junto */ }
    var simult = /\bao mesmo tempo\b|\bjunto\b|\bsimultane/.test(t);
    if (!found.length) { found = ['ai-glow', 'ai-particles']; warnings.push('Nenhuma palavra do pedido corresponde a um efeito da biblioteca. Usei brilho e partículas como ponto de partida.'); }
    var target = 'all';
    if (/\b(cubos?|faces?|cada|todas as superficies|quatro|tres|dois|atravess\w*|percorr\w*)\b/.test(t)) target = 'each';
    var color = findColor(t);
    var plan = planFromEffects(found, { duration: dur, target: target, color: color && found.length === 1 ? color : (color && !/ouro|dourad|gold/.test(t) ? color : null), maskRef: opts.maskRef || null, title: opts.title || String(prompt || '').slice(0, 60), source: 'local' });
    if (simult) plan.layers.forEach(function (L) { L.start = 0; L.duration = dur; });
    if (/\b(ritmo|musica|batida|beat|sincroniz\w*)\b/.test(t)) {
      var pulse = plan.layers.filter(function (L) { return L.effect === 'ai-pulse'; })[0];
      if (!pulse) { pulse = planFromEffects(['ai-pulse'], { duration: dur, target: target === 'all' ? 'each' : target, color: color }).layers[0]; plan.layers.push(pulse); }
      pulse.beatSync = true; pulse.stagger = 0;
    }
    plan.notes = warnings.join(' ');
    return plan;
  }

  // ---- Pedidos para IA (texto → plano) ----
  var SYS_PLAN = 'Você é o diretor de animação do LenziMap, um app de projection mapping. Responda SOMENTE com um objeto JSON, sem texto fora dele. ' +
    'Nunca escreva código JavaScript. Use apenas os efeitos listados (campo "effect") ou "glsl" com o contrato descrito. Formato:\n' +
    '{"title":str,"duration":segundos,"notes":str,"layers":[{"name":str,"effect":id,"color":"#rrggbb","color2":"#rrggbb","speed":0.1-6,"scale":0.2-4,"start":s,"duration":s,"target":"all"|"each"|[chaves],"stagger":s,"fadeIn":s,"fadeOut":s,"maskRef":null,"beatSync":bool,"keyframes":{"opacity|scale|x|y|rot|p1|p2":[{"t":s_dentro_da_camada,"v":num,"i":"linear|ease|hold"}]}}]}\n' +
    'p1 = progresso do efeito (0..1) e p2 = intensidade (0..2). Para efeito "glsl" inclua "glsl" com SOMENTE a função vec4 lenziEffect(vec2 uv) usando os uniforms uTime,uRes,uP1,uP2,uColor1,uColor2,uSpeed,uScale; laços só como for (int i = 0; i < N; i++) com N constante até 64; sem #, sem texturas.';
  function planRequest(userPrompt, ctx) {
    ctx = ctx || {};
    var eff = (FX ? FX.ids : []).map(function (id) { return id + ' (' + FX.info[id].name + ')'; }).join('; ');
    var parts = ['Efeitos disponíveis: ' + eff + '.', 'Superfícies do projeto (chave: nome): ' + (ctx.surfaces || []).map(function (s) { return s.key + ': ' + s.name; }).join('; ') + '.'];
    if (ctx.analysis && ctx.analysis.summary) parts.push('Resumo da imagem analisada: ' + ctx.analysis.summary);
    if (ctx.beats && ctx.beats.length) parts.push('Há ' + ctx.beats.length + ' batidas detectadas (BPM ' + (ctx.bpm || '?') + '). Para sincronizar, use beatSync:true; o app coloca os tempos reais.');
    if (ctx.duration) parts.push('Duração desejada: ' + ctx.duration + ' s.');
    parts.push('Pedido do usuário: ' + String(userPrompt || '').slice(0, 800));
    return { system: SYS_PLAN, prompt: parts.join('\n') };
  }
  function parsePlanResponse(text, vctx) {
    var j = S.extractJson(text);
    if (!j.ok) return { ok: false, errors: [j.error], warnings: [] };
    j.value.source = 'ai';
    return S.validatePlan(j.value, vctx);
  }

  var api = { planFromPrompt: planFromPrompt, planFromEffects: planFromEffects, planRequest: planRequest, parsePlanResponse: parsePlanResponse, SYS_PLAN: SYS_PLAN, norm: norm };
  root.AnimationPlanner = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
