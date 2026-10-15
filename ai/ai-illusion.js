// LenziMap 3.2: categoria "3D Illusions" do AI Director. Puro (sem DOM). O texto vira um plano de dados
// {ilusão, duração, keyframes} que passa por IllusionCore.validate/validateKeys. Nada é executado:
// só presets, enums e números dentro de faixas entram. Campos desconhecidos (inclusive "code", "glsl", "script") são descartados.
(function (root) {
  'use strict';
  var IC = root.IllusionCore || (typeof require !== 'undefined' ? require('../illusion-core.js') : null);
  var S = root.AiSchema || (typeof require !== 'undefined' ? require('./ai-schema.js') : null);
  var TOP = ['preset', 'name', 'cube', 'faces', 'params', 'style', 'light', 'quality', 'duration', 'keys', 'notes'];

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var PRESET_WORDS = [
    ['object-emerging', /emerg|saindo|sair d|sai d|pula pra fora|pop ?out|salta/],
    ['breaking-surface', /quebr|rachad|racha|romp|estilhac|break|crack|shatter/],
    ['opening-cube', /abrind|abre |abrir|abertura|open(ing)? cube|cubo abr/],
    ['mechanical-interior', /mecanic|engrenag|maquina|gear|machinery|industrial/],
    ['infinite-tunnel', /tunel|tunnel|corredor|vortice/],
    ['infinite-room', /sala infinita|infinite room|espelho infinito|infinito|infinity|sala/],
    ['object-inside', /dentro|inside|objeto|esfera|toro|flutuand|levitand/]
  ];
  var COLORS = [['vermelho|red|rubi', '#ff3b3b'], ['laranja|orange', '#ff8a2b'], ['amarelo|yellow|dourado|ouro|gold', '#ffd24a'], ['verde|green|esmeralda', '#2bff88'], ['ciano|cyan|turquesa', '#2fd8ff'], ['azul|blue', '#3b82ff'], ['roxo|violeta|purple|violet', '#9b5cff'], ['rosa|pink|magenta', '#ff4fa3'], ['branco|white', '#ffffff'], ['preto|black', '#222233']];
  var OBJ = [['esfera|bola|sphere|planeta', 'sphere'], ['toro|anel|donut|torus', 'torus'], ['engrenagem|gear', 'gear'], ['cubo pequeno|caixa|box', 'cube']];
  var MAT = [['metal|metalico|cromado|chrome', 'metal'], ['vidro|glass|cristal', 'glass'], ['neon|brilhante|luminoso', 'neon'], ['wire|aramado|grade|wireframe|linhas', 'wire'], ['fosco|matte', 'matte']];
  var WALL = [['painel|panel|placas', 'panel'], ['liso|plain|sem grade', 'plain'], ['grade|grid|quadriculad', 'grid']];
  var FACEW = [['front', /frente|frontal|front/], ['right', /direita|right/], ['left', /esquerda|left/], ['back', /tras|fundo|back|atras/], ['top', /topo|cima|top|teto/]];

  function pick(t, table) { for (var i = 0; i < table.length; i++) if (new RegExp(table[i][0]).test(t)) return table[i][1]; return null; }
  function colorsIn(t) {
    var found = [];
    COLORS.forEach(function (c) { var m = new RegExp(c[0]).exec(t); if (m) found.push({ at: m.index, hex: c[1] }); });
    found.sort(function (a, b) { return a.at - b.at; });
    return found.map(function (f) { return f.hex; });
  }

  // Planejador LOCAL por palavras-chave
  function planLocal(text, ctx) {
    ctx = ctx || {};
    var t = norm(text), warnings = [], preset = null;
    for (var i = 0; i < PRESET_WORDS.length; i++) if (PRESET_WORDS[i][1].test(t)) { preset = PRESET_WORDS[i][0]; break; }
    if (!preset) { preset = 'infinite-room'; warnings.push('Não reconheci o tipo de ilusão no texto, usei Sala Infinita. Palavras: sala infinita, túnel, cubo abrindo, quebrar, objeto dentro, emergindo, mecânico.'); }
    var raw = { preset: preset, params: {}, style: {}, light: {} };
    var m = /cubo\s*([a-d])\b/.exec(t) || /cube\s*([a-d])\b/.exec(t) || /\bcubo\s+(?:grande|maior)\b/.exec(t);
    if (m) raw.cube = m[1] && /^[a-d]$/.test(m[1]) ? m[1].toUpperCase() : 'A';
    var faces = [];
    if (/todas as faces|todas as paredes|all faces|em todas/.test(t)) faces = ['front', 'right', 'back', 'left', 'top'];
    else FACEW.forEach(function (f) { if (f[1].test(t)) faces.push(f[0]); });
    if (faces.length) raw.faces = faces;
    var cols = colorsIn(t); if (cols[0]) raw.style.color1 = cols[0]; if (cols[1]) raw.style.color2 = cols[1];
    var o = pick(t, OBJ); if (o) raw.style.obj = o;
    var mt = pick(t, MAT); if (mt) raw.style.material = mt;
    var w = pick(t, WALL); if (w) raw.style.wall = w;
    if (/escur|dark|sombri|noturn/.test(t)) { raw.light.ambient = 0.15; raw.light.key = 0.5; }
    if (/claro|iluminad|bright/.test(t)) { raw.light.ambient = 0.7; raw.light.key = 1.4; }
    var dur = ctx.duration || 8, md = /(\d+(?:[.,]\d+)?)\s*(s\b|seg)/.exec(t);
    if (md) dur = +md[1].replace(',', '.'); else if (/rapid|veloz|fast|energic/.test(t)) dur = 4; else if (/lent|slow|calm/.test(t)) dur = 14;
    var f = /muito fundo|bem fundo|infinit/.test(t) ? 300 : /raso|pouca profundidade|shallow/.test(t) ? 50 : null;
    if (f) raw.params.depth = f;
    if (/giran|girar|rotac|spin/.test(t)) raw.params.spin = 90;
    if (/qualidade baixa|low quality|leve/.test(t)) raw.quality = 'low'; else if (/qualidade alta|high quality|maxima/.test(t)) raw.quality = 'high';
    raw.duration = dur;
    var keys = /parad|sem animac|estatic|static/.test(t) ? [] : quick(preset, dur);
    raw.keys = keys;
    return build(raw, ctx, 'local', warnings);
  }
  function quick(preset, d) {
    var T = root.IllusionTimeline || (typeof require !== 'undefined' ? safeReq('../illusion-timeline.js') : null);
    var q = T && T.QUICK && T.QUICK[preset] && T.QUICK[preset][0];
    return q ? q.keys(d) : [];
  }
  function safeReq(p) { try { return require(p); } catch (e) { return null; } }

  // Converte um objeto bruto (local ou da IA) em plano validado
  function build(raw, ctx, source, warnings) {
    warnings = (warnings || []).slice();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['A resposta precisa ser um objeto JSON.'], warnings: warnings, plan: null };
    Object.keys(raw).forEach(function (k) { if (TOP.indexOf(k) < 0) warnings.push('Campo ignorado: ' + String(k).slice(0, 30) + '. Só dados do catálogo 3D são aceitos.'); });
    var il = { v: 1, preset: raw.preset, name: raw.name, target: { cube: raw.cube || 'A', faces: raw.faces || ['front'] }, params: raw.params, style: raw.style, light: raw.light, quality: raw.quality };
    var v = IC.validate(il, ctx && ctx.stage || null);
    if (!v.ok) return { ok: false, errors: v.errors, warnings: warnings, plan: null };
    var dur = Number(raw.duration); if (!isFinite(dur) || dur <= 0) dur = ctx && ctx.duration || 8;
    if (dur < 0.5 || dur > 300) { warnings.push('Duração limitada entre 0,5 e 300 s.'); dur = Math.max(0.5, Math.min(300, dur)); }
    var k = IC.validateKeys(raw.keys, dur);
    var plan = { title: v.value.name, il: v.value, duration: dur, keys: k.keys, source: source, notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 200) : '' };
    return { ok: true, plan: plan, errors: [], warnings: warnings.concat(v.warnings, k.warnings) };
  }

  // Pedido para a IA: JSON fechado, sem código
  function request(text, ctx) {
    ctx = ctx || {};
    var system = 'Você planeja ILUSÕES 3D anamórficas para projection mapping em cubos. Responda SOMENTE com JSON, sem texto extra, neste formato:\n' +
      '{"preset":"' + IC.PRESET_ORDER.join('|') + '","name":str,"cube":"A|B|C|D","faces":["front|right|back|left|top"],"duration":segundos,' +
      '"params":{' + IC.KF_PARAMS.concat(['flow', 'spin', 'spacing', 'thick', 'twist', 'sides']).map(function (k) { var P = IC.PARAMS[k]; return '"' + k + '":' + P.min + '..' + P.max; }).join(',') + '},' +
      '"style":{"color1":"#rrggbb","color2":"#rrggbb","obj":"' + IC.OBJECTS.join('|') + '","material":"' + IC.MATERIALS.join('|') + '","wall":"' + IC.WALLS.join('|') + '"},' +
      '"light":{"ambient":0..2,"key":0..3,"core":0..3},"quality":"low|medium|high",' +
      '"keys":[{"param":"nome animável","t":segundos,"v":número,"i":"linear|hold|ease|easein|easeout"}]}\n' +
      'Parâmetros animáveis em keys: ' + IC.KF_PARAMS.join(', ') + '. Unidades em polegadas. Não inclua código, GLSL, URLs nem campos fora deste formato. Omita o que não precisar mudar.';
    var cubes = ctx.stage && ctx.stage.cubes ? ctx.stage.cubes.map(function (c) { return c.id + ' (' + c.size + '")'; }).join(', ') : 'A (16"), B, C, D (8")';
    return { system: system, prompt: 'Cubos: ' + cubes + '. Pedido: ' + String(text).slice(0, 500) };
  }
  function parseResponse(text, ctx) {
    var j = S && S.extractJson ? S.extractJson(text) : null;
    if (!j || !j.ok) return { ok: false, errors: ['A IA não devolveu JSON utilizável.'], warnings: [], plan: null };
    return build(j.value, ctx, 'ai', []);
  }

  var api = { planLocal: planLocal, request: request, parseResponse: parseResponse, build: build };
  root.AiIllusion = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
