// Análise de imagem. Com IA: monta o pedido (imagem + instruções) e valida o JSON devolvido (ai-schema).
// Sem IA (modo local): estimativas simples e determinísticas, claramente marcadas como "local", NÃO como reconhecimento por IA.
(function (root) {
  'use strict';
  var S = root.AiSchema || (typeof require !== 'undefined' ? require('./ai-schema.js') : null);
  var IT = root.ImageTools || (typeof require !== 'undefined' ? require('./image-tools.js') : null);
  var CS = root.CreativeSuggestions || (typeof require !== 'undefined' ? require('./creative-suggestions.js') : null);

  var SYS = 'Você analisa fotografias de objetos e cenários para projection mapping. Responda SOMENTE com um objeto JSON. ' +
    'Coordenadas são frações da imagem de 0 a 1 (x,y no canto superior esquerdo). Não afirme com certeza o que é incerto: use "confidence" de 0 a 1. Formato:\n' +
    '{"subject":"statue|building|cubes|wall|object|other","summary":str,"material":str,"dominantColors":["#rrggbb"],' +
    '"objects":[{"id":str,"label":str,"kind":"object|surface|decor|obstacle","region":{"x":0-1,"y":0-1,"w":0-1,"h":0-1},"description":str,"confidence":0-1,"animatable":bool}],' +
    '"surfaces":[{"id":str,"label":str,"quad":[[x,y],[x,y],[x,y],[x,y]],"confidence":0-1}],"difficulties":[str],' +
    '"suggestions":[{"title":str,"description":str,"durationSec":num,"effects":[ids],"sequence":[str],"surfaces":[ids],"complexity":"baixa|média|alta","resources":[str]}]}\n' +
    'quad na ordem: topo-esquerdo, topo-direito, baixo-direito, baixo-esquerdo. Em "effects" use SOMENTE estes ids: ';

  function analysisRequest(effectIds, hint) {
    return { system: SYS + effectIds.join(', ') + '.', prompt: 'Analise esta imagem. ' + (hint ? 'Dica do usuário: ' + String(hint).slice(0, 200) + '. ' : '') + 'Dê de 3 a 5 sugestões de animação específicas para o que aparece.' };
  }
  function parseAnalysis(text, effectIds) {
    var j = S.extractJson(text);
    if (!j.ok) return { ok: false, errors: [j.error], warnings: [] };
    var v = S.validateAnalysis(j.value, { effectIds: effectIds });
    if (v.ok) v.value.source = 'ai';
    return v;
  }

  // Modo local. subject escolhido pelo usuário (a IA local não reconhece objetos). count = nº de superfícies esperadas (cubos).
  function localAnalysis(img, subject, count) {
    var w = img.width, h = img.height, d = img.data, i, x, y;
    // cor de fundo = média das bordas; destaque = pixels bem diferentes dela
    var br = 0, bg = 0, bb = 0, bn = 0;
    function add(px, py) { var k = (py * w + px) * 4; br += d[k]; bg += d[k + 1]; bb += d[k + 2]; bn++; }
    for (x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
    for (y = 0; y < h; y++) { add(0, y); add(w - 1, y); }
    br /= bn; bg /= bn; bb /= bn;
    var m = new Uint8Array(w * h);
    for (i = 0; i < w * h; i++) { var dr = d[i * 4] - br, dg = d[i * 4 + 1] - bg, db = d[i * 4 + 2] - bb; m[i] = dr * dr + dg * dg + db * db > 45 * 45 * 3 ? 255 : 0; }
    // caixa por percentis (2%..98%) para ignorar ruído
    var cx = new Uint32Array(w), cy = new Uint32Array(h), tot = 0;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (m[y * w + x]) { cx[x]++; cy[y]++; tot++; }
    function pct(arr, p) { var a = 0, t = tot * p; for (var k = 0; k < arr.length; k++) { a += arr[k]; if (a >= t) return k; } return arr.length - 1; }
    var objects = [], surfaces = [], warnings = ['Análise LOCAL (sem IA): a região foi estimada por contraste de cor e o tipo foi escolhido por você. Para reconhecer objetos de verdade, ative um provedor de IA.'];
    if (tot > w * h * 0.01) {
      var x0 = pct(cx, 0.02) / w, x1 = (pct(cx, 0.98) + 1) / w, y0 = pct(cy, 0.02) / h, y1 = (pct(cy, 0.98) + 1) / h;
      var reg = { x: x0, y: y0, w: Math.max(0.01, x1 - x0), h: Math.max(0.01, y1 - y0) };
      objects.push({ id: 'destaque', label: 'Região em destaque (contraste)', kind: 'object', region: reg, description: 'Área que se diferencia do fundo pela cor. Estimativa local, sem reconhecimento.', confidence: null, animatable: true });
      if (subject === 'cubes') {
        var n = Math.max(1, Math.min(8, count || 4));
        for (i = 0; i < n; i++) {
          var r = { x: reg.x + reg.w * i / n, y: reg.y, w: reg.w / n, h: reg.h };
          objects.push({ id: 'face' + (i + 1), label: 'Superfície sugerida ' + (i + 1), kind: 'surface', region: r, description: 'Divisão regular da região (estimativa geométrica). Ajuste na calibração.', confidence: null, animatable: true });
          surfaces.push({ id: 'sf' + (i + 1), label: 'Superfície ' + (i + 1), quad: IT.quadFromRegion(r), confidence: null });
        }
      } else surfaces.push({ id: 'sf1', label: 'Região em destaque', quad: IT.quadFromRegion(reg), confidence: null });
    } else warnings.push('Não encontrei uma região que se destaque do fundo. Use a máscara manual.');
    var sugg = CS.forSubject(subject);
    return { ok: true, errors: [], warnings: warnings, value: { subject: subject || 'object', summary: 'Análise local de ' + w + 'x' + h + ' px (tipo escolhido: ' + (subject || 'objeto') + ').', material: '', dominantColors: IT.dominantColors(img, 4),
      objects: objects, surfaces: surfaces, difficulties: [], suggestions: sugg, source: 'local' } };
  }

  var api = { SYS: SYS, analysisRequest: analysisRequest, parseAnalysis: parseAnalysis, localAnalysis: localAnalysis };
  root.VisionAnalysis = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
