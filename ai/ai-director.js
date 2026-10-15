// Controlador do AI Director: estado, configurações, consentimento, chamadas aos provedores, fluxo
// Foto → Análise → Sugestão → Plano → Prévia → Timeline. Sem DOM aqui (a interface está em ai-director-panel.js).
(function (root) {
  'use strict';
  var Seq = root.Sequence, S = root.AiSchema, VA = root.VisionAnalysis, AP = root.AnimationPlanner, IT = root.ImageTools, Bridge = root.AiTimelineBridge, FX = root.AiEffects, SV = root.ShaderValidator, Prov = root.AiProvider;
  var KEY = 'lenzi-ai', HKEY = 'lenzi-ai-history', SKEY = 'lenzi-ai-shaders';
  var host = null, ui = { confirm: function () { return Promise.resolve(false); } }, subs = [], seqCounter = 0;
  var st = { img: null, analysis: null, source: null, sel: null, mask: null, depth: null, plan: null, planErrors: [], planWarnings: [], beats: null, quads: [], busy: null, error: null, lastBatch: null, ill: { plan: null, errors: [], warnings: [], batch: null, error: null, notice: '' } };
  var settings = load(KEY, { external: false, provider: 'openai', models: {}, consent: {}, maxImage: 1024 });
  var keyState = { secure: false, keys: {} };

  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? Object.assign(d, v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function emit() { subs.forEach(function (f) { try { f(); } catch (e) {} }); }
  function subscribe(f) { subs.push(f); }
  function log(kind, ok, msg, extra) {
    var h = load(HKEY, { items: [] }).items || []; h.unshift(Object.assign({ t: Date.now(), kind: kind, provider: extra && extra.provider || 'local', ok: ok, msg: String(msg || '').slice(0, 200) }, extra && extra.usage ? { usage: extra.usage } : {}));
    save(HKEY, { items: h.slice(0, 50) });
  }
  function history() { return load(HKEY, { items: [] }).items || []; }
  function effectIds() { return FX ? FX.ids : []; }

  function init(h, u) {
    host = h; if (u) ui = u;
    return refreshKeys();
  }
  function setUi(u) { ui = Object.assign(ui, u); }
  function refreshKeys() {
    if (!host || !host.api || !host.api.ai) { keyState = { secure: false, keys: {}, unavailable: true }; return Promise.resolve(keyState); }
    return host.api.ai.status().then(function (s) { keyState = s; emit(); return s; }).catch(function () { return keyState; });
  }
  function available() { return !!(host && host.api && host.api.ai); }
  function mode() {
    if (!settings.external) return 'local';
    if (!available() || !keyState.keys[settings.provider]) return 'local';
    return 'ai';
  }
  function setSettings(patch) { Object.assign(settings, patch); save(KEY, settings); emit(); }
  function setKey(provider, key) {
    if (!available()) return Promise.resolve({ ok: false, error: 'Chaves só podem ser guardadas no app do Mac.' });
    return host.api.ai.setKey(provider, key).then(function (r) { return refreshKeys().then(function () { return r; }); });
  }
  function clearKey(provider) { return available() ? host.api.ai.clearKey(provider).then(function () { return refreshKeys(); }) : Promise.resolve(); }

  // ---- chamada ao provedor (com consentimento, cancelamento e histórico) ----
  async function callAi(kind, req, image) {
    if (mode() !== 'ai') return { ok: false, code: 'disabled', error: Prov.explain(0, settings.external ? 'no-key' : 'disabled') };
    var P = Prov.PROVIDERS[settings.provider];
    if (!settings.consent[settings.provider]) {
      var okc = await ui.confirm('Enviar ' + (image ? 'esta fotografia e o pedido' : 'o seu pedido') + ' para ' + P.name + '?\n\nOs dados saem do seu computador e o provedor pode cobrar pelo uso da sua chave. O LenziMap não guarda nada além do resultado.', P.name);
      if (!okc) return { ok: false, code: 'cancelled', error: Prov.explain(0, 'cancelled') };
      settings.consent[settings.provider] = true; save(KEY, settings);
    }
    var id = 'rq' + (++seqCounter) + Date.now().toString(36);
    st.busy = { id: id, kind: kind }; emit();
    var r;
    try { r = await host.api.ai.request(id, { provider: settings.provider, model: settings.models[settings.provider] || '', system: req.system, prompt: req.prompt, image: image || null }); }
    catch (e) { r = { ok: false, code: 'offline', error: Prov.explain(0, 'offline') }; }
    st.busy = null;
    log(kind, !!r.ok, r.ok ? 'ok' : r.error, { provider: settings.provider, usage: r.usage });
    emit();
    return r;
  }
  function cancel() { if (st.busy && host.api.ai) host.api.ai.cancel(st.busy.id); }

  // ---- imagem ----
  function setImage(canvas) {
    var w = canvas.width, h = canvas.height, k = Math.min(1, 256 / Math.max(w, h)), sc = document.createElement('canvas');
    sc.width = Math.max(2, Math.round(w * k)); sc.height = Math.max(2, Math.round(h * k));
    sc.getContext('2d').drawImage(canvas, 0, 0, sc.width, sc.height);
    var id = sc.getContext('2d').getImageData(0, 0, sc.width, sc.height);
    st.img = { canvas: canvas, w: w, h: h, small: { width: id.width, height: id.height, data: id.data } };
    st.analysis = null; st.source = null; st.sel = null; st.mask = null; st.depth = null; st.quads = []; st.plan = null; st.error = null;
    emit();
  }
  function loadImageUrl(url) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () {
        var k = Math.min(1, settings.maxImage / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.max(2, Math.round(im.naturalWidth * k)); c.height = Math.max(2, Math.round(im.naturalHeight * k));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); setImage(c); res(st.img);
      };
      im.onerror = function () { rej(new Error('Não consegui abrir essa imagem.')); };
      im.src = url;
    });
  }
  function imagePayload() {
    var c = st.img.canvas, url = c.toDataURL('image/jpeg', 0.85);
    return { b64: url.split(',')[1], mime: 'image/jpeg' };
  }

  // ---- análise ----
  async function analyze(opts) {
    opts = opts || {}; st.error = null;
    if (!st.img) { st.error = 'Importe uma fotografia primeiro.'; emit(); return null; }
    if (mode() === 'ai') {
      var req = VA.analysisRequest(effectIds(), opts.hint);
      var r = await callAi('analisar imagem', req, imagePayload());
      if (r.ok) {
        var v = VA.parseAnalysis(r.text, effectIds());
        if (v.ok) { st.analysis = v.value; st.source = 'ai'; st.planWarnings = v.warnings; st.sel = null; emit(); return v; }
        st.error = 'A resposta da IA não passou na validação: ' + v.errors.join(' ') + ' Tente "Regenerar" ou use a análise local.'; log('validar análise', false, v.errors.join(' '), { provider: settings.provider });
      } else st.error = r.error;
      emit(); return null;
    }
    var l = VA.localAnalysis(st.img.small, opts.subject || 'object', opts.count || 4);
    st.analysis = l.value; st.source = 'local'; st.planWarnings = l.warnings; st.sel = null;
    log('análise local', true, 'sem IA'); emit();
    return l;
  }

  // ---- máscara ----
  function objectById(id) { return st.analysis && st.analysis.objects.filter(function (o) { return o.id === id; })[0] || null; }
  function selectObject(id) {
    st.sel = id; var o = objectById(id);
    if (o && st.img) { var s = st.img.small; st.mask = { data: IT.maskFromRegion(s, o.region, 38), w: s.width, h: s.height, invert: false, feather: 0, label: o.label }; }
    emit(); return st.mask;
  }
  function maskBrush(x01, y01, r01, add, quiet) {
    if (!st.mask) return; var m = st.mask; IT.paint(m.data, m.w, m.h, x01 * (m.w - 1), y01 * (m.h - 1), Math.max(1, r01 * Math.max(m.w, m.h)), add); if (!quiet) emit();
  }
  function maskRefine(n) { if (st.mask) { st.mask.data = IT.morph(st.mask.data, st.mask.w, st.mask.h, n); emit(); } }
  function maskFeather(px) { if (st.mask) { st.mask.feather = Math.max(0, Math.min(30, px | 0)); emit(); } }
  function maskInvert() { if (st.mask) { st.mask.invert = !st.mask.invert; emit(); } }
  function maskFinal() {
    var m = st.mask; if (!m) return null;
    var d = m.invert ? IT.invert(m.data) : m.data;
    return m.feather ? IT.feather(d, m.w, m.h, m.feather) : d;
  }
  function maskDataUrl() {
    var m = st.mask; if (!m) return null; var d = maskFinal(), c = document.createElement('canvas'); c.width = m.w; c.height = m.h;
    var id = c.getContext('2d').createImageData(m.w, m.h); id.data.set(IT.maskToRgba(d, m.w, m.h)); c.getContext('2d').putImageData(id, 0, 0);
    return c.toDataURL('image/png');
  }
  // ---- profundidade (heurística local; ver image-tools.js) ----
  function computeDepth(p) {
    if (!st.img) return null; var s = st.img.small;
    st.depth = { data: IT.depthFromLuma(s, p), w: s.width, h: s.height, p: p || {} }; emit(); return st.depth;
  }
  function depthToMask(lo, hi) {
    if (!st.depth) return null; var d = st.depth, m = new Uint8Array(d.data.length);
    for (var i = 0; i < m.length; i++) m[i] = d.data[i] >= lo && d.data[i] <= hi ? 255 : 0;
    st.mask = { data: m, w: d.w, h: d.h, invert: false, feather: 2, label: 'Profundidade ' + lo + '-' + hi }; emit(); return st.mask;
  }

  // ---- planos ----
  function surfaceInfo() { return host.surfaces().map(function (s) { return { key: s.key, name: s.name }; }); }
  function vctx() {
    return { effectIds: effectIds(), surfaceKeys: surfaceInfo().map(function (s) { return s.key; }), validateGlsl: function (src) {
      var v = SV.validate(src); if (!v.ok) return v;
      if (root.GlslFx && root.GlslFx.hasGl()) { var c = root.GlslFx.compile(src); if (!c.ok) return { ok: false, error: c.error }; }
      return { ok: true };
    } };
  }
  function setPlan(raw, extraWarn) {
    var v = S.validatePlan(raw, vctx());
    st.plan = v.ok ? v.value : null; st.planErrors = v.errors; st.planWarnings = (v.warnings || []).concat(extraWarn || []);
    if (v.ok && st.mask) { st.plan.useMask = true; }
    emit(); return v;
  }
  function planFromSuggestion(sg) {
    var many = surfaceInfo().length > 1;
    return setPlan(AP.planFromEffects(sg.effects, { duration: sg.durationSec, target: sg.target || (many && sg.effects.length === 1 ? 'each' : 'all'), title: sg.title, source: st.source === 'ai' ? 'ai' : 'local', notes: sg.description }));
  }
  async function planFromPrompt(text, opts) {
    opts = opts || {}; st.error = null; text = String(text || '').trim();
    if (!text) { st.error = 'Escreva o que você quer ver.'; emit(); return null; }
    var beatWarn = [];
    if (mode() === 'ai' && !opts.forceLocal) {
      var req = AP.planRequest(text, { surfaces: surfaceInfo(), analysis: st.analysis, beats: st.beats && st.beats.beats, bpm: st.beats && st.beats.bpm, duration: opts.duration });
      var r = await callAi('texto para animação', req, null);
      if (!r.ok) { st.error = r.error + ' Você pode usar o planejador local.'; emit(); return null; }
      var pr = AP.parsePlanResponse(r.text, vctx());
      st.plan = pr.ok ? pr.value : null; st.planErrors = pr.errors; st.planWarnings = pr.warnings || [];
      if (!pr.ok) st.error = 'A IA devolveu um plano inválido: ' + pr.errors.join(' ');
      emit(); return pr;
    }
    var raw = AP.planFromPrompt(text, { duration: opts.duration, maskRef: null });
    if (/ritmo|musica|música|batida|beat/i.test(text) && !(st.beats && st.beats.beats.length)) beatWarn.push('O pedido fala de música, mas ainda não há batidas analisadas.');
    var v = setPlan(raw, beatWarn); if (v.ok) st.plan.source = 'local'; emit(); return v;
  }
  // Gerador de shader: com IA gera GLSL (validado); sem IA oferece a biblioteca nativa.
  async function shaderPlan(text, presetId) {
    var code = null, name = 'Shader';
    if (presetId && SV.PRESETS[presetId]) { code = SV.PRESETS[presetId].code; name = SV.PRESETS[presetId].name; }
    else if (mode() === 'ai') {
      var req = { system: 'Você escreve shaders GLSL ES 1.0 para um app de projection mapping. Responda SOMENTE com JSON {"name":str,"glsl":str}. O campo glsl contém APENAS a função  vec4 lenziEffect(vec2 uv)  (e funções auxiliares). Uniforms permitidos (já declarados): float uTime,uP1,uP2,uSpeed,uScale; vec2 uRes; vec3 uColor1,uColor2. uP1 = progresso 0..1, uP2 = intensidade 0..2. Retorne cor RGB e alfa. Laços só como for (int i = 0; i < N; i++) com N constante até 64. Proibido: #, texturas, uniform, while, main, precision.', prompt: 'Efeito desejado: ' + String(text).slice(0, 400) };
      var r = await callAi('gerar shader', req, null);
      if (!r.ok) { st.error = r.error; emit(); return null; }
      var j = S.extractJson(r.text);
      if (!j.ok || typeof j.value.glsl !== 'string') { st.error = 'A IA não devolveu um shader utilizável.'; emit(); return null; }
      code = j.value.glsl; name = String(j.value.name || 'Shader gerado').slice(0, 40);
    } else { st.error = 'Sem IA ativa: escolha um shader da biblioteca nativa.'; emit(); return null; }
    var val = vctx().validateGlsl(code);
    if (!val.ok) { st.plan = null; st.planErrors = []; st.error = 'Shader recusado: ' + val.error; log('validar shader', false, val.error, { provider: settings.provider }); emit(); return { ok: false, errors: [val.error] }; }
    var many = surfaceInfo().length > 1;
    var raw = { title: name, duration: 12, layers: [{ name: name, effect: 'glsl', glsl: code, color: '#ff4fa3', color2: '#2fd8ff', speed: 1, scale: 1, start: 0, duration: 12, target: many ? 'all' : 'all', fadeIn: 0.5, fadeOut: 0.5, keyframes: {} }], source: presetId ? 'local' : 'ai' };
    return setPlan(raw);
  }
  function saveShaderPreset(name) {
    var L = st.plan && st.plan.layers.filter(function (l) { return l.effect === 'glsl'; })[0]; if (!L) return false;
    var list = load(SKEY, { items: [] }).items || []; list.push({ name: String(name || L.name).slice(0, 40), glsl: L.glsl }); save(SKEY, { items: list.slice(-30) }); emit(); return true;
  }
  function shaderPresets() { return load(SKEY, { items: [] }).items || []; }

  // ---- prévia, aplicar, desfazer ----
  function previewSeq() {
    if (!st.plan) return null;
    var seq = Seq.create({ duration: st.plan.duration }), surfs = surfaceInfo();
    var mask = st.plan.useMask ? maskDataUrl() : null;
    Bridge.applyToSeq(seq, st.plan, surfs, { at: 0, beats: st.beats && st.beats.beats, mask: mask });
    return { seq: seq, surfaces: surfs };
  }
  function checks() {
    var out = [], p = st.plan; if (!p) return out; var sm = Bridge.summarize(p, surfaceInfo());
    if (sm.clips > 24) out.push('Muitos clipes (' + sm.clips + '): confira a fluidez no projetor.');
    if (p.layers.some(function (l) { return l.effect === 'glsl'; })) out.push('Usa shader GLSL: o custo depende da GPU. Teste o desempenho antes de projetar.');
    if (p.source === 'ai') out.push('Plano criado por IA (' + Prov.PROVIDERS[settings.provider].name + ').'); else out.push('Plano criado pelo planejador LOCAL (sem IA).');
    if (p.layers.some(function (l) { return l.beatSync; }) && !(st.beats && st.beats.beats.length)) out.push('Há camada no ritmo, mas não há batidas analisadas.');
    if (!sm.surfaces) out.push('O projeto não tem superfícies.');
    return out;
  }
  function apply() {
    if (!st.plan) return null;
    var mask = st.plan.useMask ? maskDataUrl() : null;
    var b = Bridge.apply(st.plan, host.bridgeHost(), { beats: st.beats && st.beats.beats, mask: mask });
    st.lastBatch = b; log('aplicar na timeline', b.clipIds.length > 0, b.clipIds.length + ' clipes', { provider: st.plan.source === 'ai' ? settings.provider : 'local' });
    emit(); return b;
  }
  function undo() { var b = Bridge.undo(host.bridgeHost()); if (b) log('desfazer geração', true, b.title); emit(); return b; }


  // ---- 3D Illusions (3.2): plano validado -> ilusão + clipes + keyframes reais; sem código arbitrário ----
  function illCtx(duration) {
    var ILT = root.IllusionTimeline;
    var seq = host.bridgeHost().seq();
    return { stage: ILT ? ILT.ensureStage(seq) : null, duration: duration };
  }
  async function illusionFromPrompt(text, opts) {
    var AIL = root.AiIllusion;
    opts = opts || {}; var I = st.ill; I.error = null; I.notice = ''; text = String(text || '').trim();
    if (!AIL) { I.error = 'O módulo 3D Illusions não está carregado.'; emit(); return null; }
    if (!text) { I.error = 'Descreva a ilusão que você quer.'; emit(); return null; }
    var ctx = illCtx(opts.duration), res;
    if (mode() === 'ai' && !opts.forceLocal) {
      var rq = AIL.request(text, ctx), r = await callAi('ilusão 3D', rq, null);
      if (!r.ok) { I.error = r.error + ' Você pode usar o planejador local.'; emit(); return null; }
      res = AIL.parseResponse(r.text, ctx);
      if (!res.ok) I.error = 'A IA devolveu uma ilusão inválida: ' + res.errors.join(' ');
    } else res = AIL.planLocal(text, ctx);
    I.plan = res.ok ? res.plan : null; I.errors = res.errors; I.warnings = res.warnings;
    emit(); return res;
  }
  // Liga faces do alvo que ainda não têm superfície às superfícies livres (mesma regra do botão do painel 3D)
  function illBindFree(seq, il) {
    var ILT = root.IllusionTimeline, ILC = root.IllusionCore;
    var stage = ILT.ensureStage(seq), cube = ILC.cubeById(stage, il.target.cube), keys = host.bridgeHost().surfaces().map(function (s) { return s.key; }), used = {}, n = 0;
    if (!cube) return 0;
    stage.cubes.forEach(function (c) { ILC.FACES.forEach(function (f) { if (c.faces[f]) used[c.faces[f]] = 1; }); });
    var free = keys.filter(function (k) { return !used[k]; });
    il.target.faces.forEach(function (f) { if (!cube.faces[f] && free.length) { cube.faces[f] = free.shift(); n++; } });
    return n;
  }
  function applyIllusion() {
    var ILT = root.IllusionTimeline;
    var I = st.ill, p = I.plan; if (!p || !ILT) return null;
    var h = host.bridgeHost(), seq = h.seq(); h.checkpoint('ai-illusion');
    var bound = illBindFree(seq, p.il);
    var b = ILT.apply(p.il, h, { at: h.now ? h.now() : 0, duration: p.duration, keys: p.keys });
    I.batch = b; I.notice = b.ok ? (bound ? bound + ' face(s) foram ligadas automaticamente a superfícies livres. ' : '') + b.clipIds.length + ' clipe(s) criados.' : (b.warnings || []).join(' ') || (b.errors || []).join(' ');
    log('aplicar ilusão 3D', !!b.ok, b.clipIds.length + ' clipes', { provider: p.source === 'ai' ? settings.provider : 'local' });
    emit(); return b;
  }
  function undoIllusion() { var ILT = root.IllusionTimeline, b = ILT && ILT.undo(host.bridgeHost()); if (b) { st.ill.batch = null; st.ill.notice = 'Ilusão "' + b.name + '" desfeita.'; log('desfazer ilusão 3D', true, b.name); } emit(); return b; }

  // ---- áudio ----
  async function analyzeAudio(url) {
    var ab = await (await fetch(url)).arrayBuffer(), AC = root.AudioContext || root.webkitAudioContext, ctx = new AC();
    var buf = await ctx.decodeAudioData(ab), ch = buf.getChannelData(0), mono = new Float32Array(ch.length);
    for (var i = 0; i < ch.length; i++) { var s = ch[i]; for (var c = 1; c < buf.numberOfChannels; c++) s += buf.getChannelData(c)[i]; mono[i] = s / buf.numberOfChannels; }
    try { ctx.close(); } catch (e) {}
    return setBeats(root.AudioAnalysis.analyze(mono, buf.sampleRate));
  }
  function setBeats(r) { st.beats = r; log('analisar áudio', true, r.beats.length + ' batidas, BPM ' + r.bpm); emit(); return r; }
  function beatMarkers() {
    if (!st.beats) return 0; host.bridgeHost().checkpoint('ai-beats'); var seq = host.bridgeHost().seq(), n = 0;
    st.beats.beats.slice(0, 300).forEach(function (t) { Seq.addMarker(seq, t, 'batida'); n++; });
    host.bridgeHost().push(); host.bridgeHost().renderAll(); emit(); return n;
  }

  // ---- assistente de mapeamento: sugere quadriláteros SEM tocar na calibração ----
  function suggestQuads() {
    var a = st.analysis; st.quads = [];
    if (a) a.surfaces.forEach(function (s) { st.quads.push({ id: s.id, label: s.label, quad: s.quad, confidence: s.confidence, state: 'sugerida' }); });
    if (st.mask && st.mask.data) { var q = IT.quadFromMask(maskFinal(), st.mask.w, st.mask.h); if (q) st.quads.push({ id: 'mask', label: 'Contorno da máscara', quad: q, confidence: null, state: 'sugerida' }); }
    emit(); return st.quads;
  }
  function confirmQuad(id) {
    var q = st.quads.filter(function (x) { return x.id === id; })[0]; if (!q || !host.addSurfaceFromQuad) return null;
    var s = host.addSurfaceFromQuad(q.quad, q.label); q.state = 'criada'; log('confirmar superfície', true, q.label); emit(); return s;
  }

  var api = { init: init, setUi: setUi, subscribe: subscribe, state: st, settings: function () { return settings; }, keyState: function () { return keyState; }, setSettings: setSettings, setKey: setKey, clearKey: clearKey, refreshKeys: refreshKeys,
    mode: mode, available: available, cancel: cancel, history: history, loadImageUrl: loadImageUrl, setImage: setImage, analyze: analyze, selectObject: selectObject, objectById: objectById, maskBrush: maskBrush, maskRefine: maskRefine, maskFeather: maskFeather, maskInvert: maskInvert, maskFinal: maskFinal, maskDataUrl: maskDataUrl,
    computeDepth: computeDepth, depthToMask: depthToMask, planFromSuggestion: planFromSuggestion, planFromPrompt: planFromPrompt, shaderPlan: shaderPlan, saveShaderPreset: saveShaderPreset, shaderPresets: shaderPresets,
    illusionFromPrompt: illusionFromPrompt, applyIllusion: applyIllusion, undoIllusion: undoIllusion, previewSeq: previewSeq, checks: checks, apply: apply, undo: undo, analyzeAudio: analyzeAudio, setBeats: setBeats, beatMarkers: beatMarkers, suggestQuads: suggestQuads, confirmQuad: confirmQuad, surfaceInfo: surfaceInfo, imagePayload: imagePayload };
  root.AiDirector = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
