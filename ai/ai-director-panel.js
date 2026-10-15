// Interface do AI Director (aba "IA" do painel). Só desenha e repassa cliques ao controlador (ai-director.js).
(function (root) {
  'use strict';
  var D = null, Bridge = root.AiTimelineBridge, Prov = root.AiProvider, FX = root.AiEffects, SV = root.ShaderValidator, sec = null, ui = {}, brush = { on: false, add: true, r: 0.04 }, prevT = 0, prevSurf = 0, shown = {};

  var CSS = '.ai-wrap{display:flex;flex-direction:column;gap:10px}.ai-wrap h3{margin:0;font-size:13px;font-weight:600;letter-spacing:.02em}.ai-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}' +
    '.ai-badge{font-size:11px;padding:3px 8px;border-radius:999px;border:1px solid var(--line);background:var(--panel-2);color:var(--muted)}.ai-badge.on{color:#9ff0c4;border-color:#2e7d57}.ai-badge.loc{color:#ffd37a;border-color:#7d6320}' +
    '.ai-box{border:1px solid var(--line);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:8px;background:var(--panel)}.ai-box>summary{cursor:pointer;font-weight:600;font-size:13px}' +
    '.ai-photo{position:relative;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:#05070a;line-height:0}.ai-photo canvas{width:100%;height:auto;display:block;touch-action:none}.ai-photo .ai-ov{position:absolute;left:0;top:0;width:100%;height:100%}' +
    '.ai-rg{position:absolute;border:2px solid #4fc3ff;background:rgba(79,195,255,.12);cursor:pointer;line-height:1.1}.ai-rg.sel{border-color:#ffd24a;background:rgba(255,210,74,.18)}.ai-rg span{position:absolute;left:0;top:0;font-size:10px;background:#000a;color:#fff;padding:1px 4px;white-space:nowrap}' +
    '.ai-list{display:flex;flex-direction:column;gap:4px}.ai-item{font:inherit;text-align:left;border:1px solid var(--line);background:var(--panel-2);color:var(--fg);border-radius:6px;padding:6px 8px;cursor:pointer}.ai-item[aria-pressed="true"]{border-color:#ffd24a}.ai-item small{display:block;color:var(--muted);font-size:11px}' +
    '.ai-sg{border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--panel-2);display:flex;flex-direction:column;gap:4px}.ai-sg b{font-size:13px}.ai-sg p{margin:0;font-size:12px;color:var(--muted)}.ai-tags{display:flex;gap:4px;flex-wrap:wrap}.ai-tags span{font-size:10px;border:1px solid var(--line);border-radius:999px;padding:1px 6px;color:var(--muted)}' +
    '.ai-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.ai-strip canvas{width:100%;height:auto;border:1px solid var(--line);border-radius:4px;background:#05070a}.ai-warn{font-size:12px;color:#ffd37a;margin:0}.ai-err{font-size:12px;color:#ff8f8f;margin:0}.ai-note{font-size:11px;color:var(--muted);margin:0}' +
    '.ai-modal{position:fixed;inset:0;background:#000b;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}.ai-modal>div{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;max-width:440px;display:flex;flex-direction:column;gap:12px;white-space:pre-wrap;font-size:13px}';

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(txt, fn, cls, id) { var b = el('button', 'btn' + (cls ? ' ' + cls : ''), txt); b.type = 'button'; if (id) b.id = id; b.addEventListener('click', fn); return b; }
  function box(title, open) { var d = el('details', 'ai-box'); if (open) d.open = true; var s = el('summary', null, title); d.appendChild(s); d.__t = title; d.addEventListener('toggle', function () { shown[title] = d.open; }); if (shown[title] != null) d.open = shown[title]; return d; }
  function field(label, node) { var f = el('label', 'field'); f.appendChild(el('span', null, label)); f.appendChild(node); return f; }

  function confirmDialog(text) {
    return new Promise(function (res) {
      var m = el('div', 'ai-modal'); m.id = 'ai-consent'; var c = el('div'); c.appendChild(el('div', null, text));
      var r = el('div', 'ai-row');
      r.appendChild(btn('Cancelar', function () { m.remove(); res(false); }, null, 'ai-consent-no'));
      r.appendChild(btn('Enviar', function () { m.remove(); res(true); }, 'primary', 'ai-consent-yes'));
      c.appendChild(r); m.appendChild(c); document.body.appendChild(m);
    });
  }

  // ---------- partes ----------
  function head() {
    var h = el('div', 'ai-row'), mode = D.mode(), P = Prov.PROVIDERS[D.settings().provider];
    h.appendChild(el('h3', null, 'AI Director'));
    var b = el('span', 'ai-badge ' + (mode === 'ai' ? 'on' : 'loc'), mode === 'ai' ? 'IA: ' + P.name : 'Modo local (sem IA)'); b.id = 'ai-mode'; h.appendChild(b);
    return h;
  }
  function settingsBox() {
    var b = box('AI Settings (provedor, chave, privacidade)', false), S = D.settings(), K = D.keyState(), P = Prov.PROVIDERS[S.provider];
    var ext = el('input'); ext.type = 'checkbox'; ext.id = 'ai-ext'; ext.checked = !!S.external; ext.addEventListener('change', function () { D.setSettings({ external: ext.checked }); });
    var l = el('label', 'ai-row'); l.appendChild(ext); l.appendChild(document.createTextNode(' Permitir serviços externos de IA (desligado por padrão)')); b.appendChild(l);
    var sel = el('select', 'pick'); sel.id = 'ai-provider'; Object.keys(Prov.PROVIDERS).forEach(function (k) { var o = el('option', null, Prov.PROVIDERS[k].name); o.value = k; sel.appendChild(o); }); sel.value = S.provider;
    sel.addEventListener('change', function () { D.setSettings({ provider: sel.value }); }); b.appendChild(field('Provedor', sel));
    var mi = el('input'); mi.type = 'text'; mi.id = 'ai-model'; mi.placeholder = P.model; mi.value = S.models[S.provider] || ''; mi.addEventListener('change', function () { var m = Object.assign({}, S.models); m[S.provider] = mi.value.trim().slice(0, 80); D.setSettings({ models: m }); }); b.appendChild(field('Modelo (vazio = ' + P.model + ')', mi));
    var has = !!K.keys[S.provider];
    var ki = el('input'); ki.type = 'password'; ki.id = 'ai-key'; ki.autocomplete = 'off'; ki.placeholder = has ? 'Chave guardada (oculta)' : 'Cole a sua chave de API'; b.appendChild(field('Chave de API', ki));
    var kr = el('div', 'ai-row');
    kr.appendChild(btn('Salvar chave', function () { D.setKey(S.provider, ki.value).then(function (r) { ki.value = ''; ui.msg.textContent = r && r.ok ? (r.secure ? 'Chave guardada no cofre do sistema.' : 'Chave guardada só nesta sessão (o cofre do sistema não está disponível).') : (r && r.error) || 'Falhou.'; }); }, null, 'ai-key-save'));
    if (has) kr.appendChild(btn('Remover chave', function () { D.clearKey(S.provider); }, null, 'ai-key-clear'));
    b.appendChild(kr);
    b.appendChild(el('p', 'ai-note', D.available() ? (K.secure ? 'A chave fica no cofre do sistema (Keychain no Mac). Não vai para projetos .mapa, logs nem para o pacote.' : 'Atenção: este computador não tem cofre de chaves. A chave só fica na memória e some ao fechar o app.') : 'Nesta versão (sem o app do Mac) as chaves não podem ser guardadas: o AI Director funciona só no modo local.'));
    b.appendChild(el('p', 'ai-note', 'Custos: cada análise envia 1 foto (até ' + S.maxImage + ' px) e cada pedido de texto envia só o texto. O provedor cobra pelo uso da SUA chave. Dicas para a chave: ' + P.keyHelp + '.'));
    var mx = el('input'); mx.type = 'number'; mx.min = 256; mx.max = 2048; mx.step = 128; mx.value = S.maxImage; mx.addEventListener('change', function () { D.setSettings({ maxImage: Math.max(256, Math.min(2048, +mx.value || 1024)) }); }); b.appendChild(field('Tamanho máximo da imagem enviada (px)', mx));
    var hist = el('details'); hist.appendChild(el('summary', null, 'Histórico de operações'));
    var hl = el('div', 'ai-list'); hl.id = 'ai-history';
    D.history().slice(0, 12).forEach(function (h) { var d = el('div', 'ai-note', new Date(h.t).toLocaleTimeString() + ' · ' + h.kind + ' · ' + h.provider + ' · ' + (h.ok ? 'ok' : 'falhou: ' + h.msg)); hl.appendChild(d); });
    hist.appendChild(hl); b.appendChild(hist);
    return b;
  }
  function photoBox() {
    var b = box('1. Foto e análise', true), st = D.state;
    var r = el('div', 'ai-row'), fi = el('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.id = 'ai-file'; fi.style.display = 'none';
    fi.addEventListener('change', function () { var f = fi.files && fi.files[0]; if (!f) return; var url = URL.createObjectURL(f); D.loadImageUrl(url).catch(function (e) { st.error = e.message; render(); }).then(function () { URL.revokeObjectURL(url); }); fi.value = ''; });
    r.appendChild(fi); r.appendChild(btn('Import Image', function () { fi.click(); }, 'primary', 'ai-import'));
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) r.appendChild(btn('Capture Image', capture, null, 'ai-capture'));
    b.appendChild(r);
    if (st.img) {
      var ph = el('div', 'ai-photo'); ph.id = 'ai-photo'; var cv = el('canvas'); cv.width = st.img.canvas.width; cv.height = st.img.canvas.height; cv.getContext('2d').drawImage(st.img.canvas, 0, 0); ph.appendChild(cv);
      if (st.mask) { var mc = el('canvas', 'ai-ov'); drawMask(mc); ph.appendChild(mc); attachBrush(mc, ph); }
      var ov = el('div', 'ai-ov'); ov.style.pointerEvents = brush.on ? 'none' : 'auto';
      if (st.analysis) st.analysis.objects.forEach(function (o) {
        var rg = el('div', 'ai-rg' + (st.sel === o.id ? ' sel' : '')); rg.dataset.id = o.id; var q = o.region;
        rg.style.cssText = 'left:' + q.x * 100 + '%;top:' + q.y * 100 + '%;width:' + q.w * 100 + '%;height:' + q.h * 100 + '%'; rg.appendChild(el('span', null, o.label));
        rg.addEventListener('click', function (e) { e.stopPropagation(); D.selectObject(o.id); }); ov.appendChild(rg);
      });
      ph.appendChild(ov); b.appendChild(ph);
      var q = el('div', 'ai-row'), sub = el('select', 'pick'); sub.id = 'ai-subject';
      [['statue', 'Estátua'], ['cubes', 'Cubos'], ['wall', 'Parede'], ['building', 'Prédio'], ['object', 'Objeto']].forEach(function (s) { var o = el('option', null, s[1]); o.value = s[0]; sub.appendChild(o); });
      sub.value = ui.subject || (st.analysis && st.analysis.subject !== 'other' ? st.analysis.subject : 'object'); sub.addEventListener('change', function () { ui.subject = sub.value; });
      var cnt = el('input'); cnt.type = 'number'; cnt.min = 1; cnt.max = 8; cnt.value = ui.count || 4; cnt.style.width = '56px'; cnt.id = 'ai-count'; cnt.addEventListener('change', function () { ui.count = +cnt.value; });
      if (D.mode() === 'local') { q.appendChild(field('Tipo (modo local)', sub)); q.appendChild(field('Superfícies', cnt)); }
      q.appendChild(btn('Analyze Scene', function () { D.analyze({ subject: ui.subject || sub.value, count: +cnt.value }); }, 'primary', 'ai-analyze'));
      if (st.busy) q.appendChild(btn('Cancelar', function () { D.cancel(); }, null, 'ai-cancel'));
      b.appendChild(q);
      if (st.analysis) {
        b.appendChild(el('p', 'ai-note', (st.source === 'ai' ? 'Análise por IA. ' : 'Análise LOCAL (sem IA). ') + (st.analysis.summary || '')));
        if (st.analysis.material) b.appendChild(el('p', 'ai-note', 'Material aparente: ' + st.analysis.material));
        if (st.analysis.dominantColors.length) { var cr = el('div', 'ai-row'); st.analysis.dominantColors.forEach(function (c) { var s = el('span', 'ai-badge', c); s.style.borderColor = c; cr.appendChild(s); }); b.appendChild(cr); }
        st.analysis.difficulties.forEach(function (t) { b.appendChild(el('p', 'ai-warn', 'Dificuldade: ' + t)); });
      }
    } else b.appendChild(el('p', 'ai-note', 'Importe uma fotografia do objeto ou do cenário. Com IA ligada, ela é enviada ao provedor só depois da sua confirmação.'));
    return b;
  }
  function capture() {
    navigator.mediaDevices.getUserMedia({ video: true }).then(function (stream) {
      var v = document.createElement('video'); v.srcObject = stream; v.muted = true; v.playsInline = true;
      v.onloadedmetadata = function () { v.play(); setTimeout(function () { var c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0); stream.getTracks().forEach(function (t) { t.stop(); }); D.setImage(c); }, 600); };
    }).catch(function () { D.state.error = 'Não consegui acessar a câmera.'; render(); });
  }
  function drawMask(cv) {
    var m = D.state.mask, st = D.state; cv.width = m.w; cv.height = m.h; var ctx = cv.getContext('2d'), id = ctx.createImageData(m.w, m.h), d = D.maskFinal();
    for (var i = 0; i < d.length; i++) { id.data[i * 4] = 255; id.data[i * 4 + 1] = 60; id.data[i * 4 + 2] = 120; id.data[i * 4 + 3] = d[i] * 0.55; }
    ctx.putImageData(id, 0, 0);
  }
  function attachBrush(cv, ph) {
    cv.style.pointerEvents = brush.on ? 'auto' : 'none'; cv.style.cursor = 'crosshair';
    var down = false;
    function at(e) { var r = cv.getBoundingClientRect(); D.maskBrush((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, brush.r, brush.add, true); drawMask(cv); }
    cv.addEventListener('pointerdown', function (e) { down = true; cv.setPointerCapture(e.pointerId); at(e); });
    cv.addEventListener('pointermove', function (e) { if (down) at(e); });
    cv.addEventListener('pointerup', function () { down = false; D.maskBrush(0, 0, 0, true, false); });
  }
  function objectsBox() {
    var st = D.state, b = box('2. Detected Objects e máscara', true);
    if (!st.analysis || !st.analysis.objects.length) { b.appendChild(el('p', 'ai-note', 'Nenhuma detecção ainda.')); return b; }
    var l = el('div', 'ai-list'); l.id = 'ai-objects';
    st.analysis.objects.forEach(function (o) {
      var i = el('button', 'ai-item'); i.type = 'button'; i.dataset.id = o.id; i.setAttribute('aria-pressed', st.sel === o.id ? 'true' : 'false');
      i.appendChild(document.createTextNode(o.label + (o.confidence != null ? '  (' + Math.round(o.confidence * 100) + '%)' : '  (sem confiança medida)')));
      if (o.description) i.appendChild(el('small', null, o.description)); i.addEventListener('click', function () { D.selectObject(o.id); }); l.appendChild(i);
    });
    b.appendChild(l);
    b.appendChild(el('p', 'ai-note', 'A máscara é gerada por cor e bordas (crescimento de região), não por um modelo como SAM. Refine com o pincel.'));
    if (st.mask) {
      var r1 = el('div', 'ai-row');
      var tb = btn(brush.on ? 'Pincel: ligado' : 'Pincel', function () { brush.on = !brush.on; render(); }, brush.on ? 'primary' : null, 'ai-brush');
      var ta = btn(brush.add ? 'Adicionar' : 'Remover', function () { brush.add = !brush.add; render(); }, null, 'ai-brush-mode');
      var rg = el('input'); rg.type = 'range'; rg.min = 1; rg.max = 15; rg.value = Math.round(brush.r * 100); rg.title = 'Tamanho do pincel'; rg.addEventListener('input', function () { brush.r = rg.value / 100; });
      r1.appendChild(tb); r1.appendChild(ta); r1.appendChild(rg); b.appendChild(r1);
      var r2 = el('div', 'ai-row');
      r2.appendChild(btn('Expandir', function () { D.maskRefine(2); }, null, 'ai-grow')); r2.appendChild(btn('Contrair', function () { D.maskRefine(-2); }, null, 'ai-shrink')); r2.appendChild(btn('Inverter', function () { D.maskInvert(); }, null, 'ai-invert'));
      b.appendChild(r2);
      var fe = el('input'); fe.type = 'range'; fe.min = 0; fe.max = 20; fe.value = st.mask.feather; fe.id = 'ai-feather'; fe.addEventListener('change', function () { D.maskFeather(+fe.value); }); b.appendChild(field('Feather (suavizar borda): ' + st.mask.feather + ' px', fe));
      var uc = el('input'); uc.type = 'checkbox'; uc.id = 'ai-usemask'; uc.checked = !!ui.useMask; uc.addEventListener('change', function () { ui.useMask = uc.checked; if (st.plan) st.plan.useMask = uc.checked; });
      var ul = el('label', 'ai-row'); ul.appendChild(uc); ul.appendChild(document.createTextNode(' Usar esta máscara nos efeitos gerados')); b.appendChild(ul);
    }
    return b;
  }
  function depthBox() {
    var st = D.state, b = box('Profundidade (estimativa simples)', false); if (!st.img) { b.appendChild(el('p', 'ai-note', 'Importe uma foto.')); return b; }
    b.appendChild(el('p', 'ai-note', 'Estimativa por luminosidade, NÃO é um modelo de profundidade (como Depth Anything) e NÃO substitui a calibração. Um modelo real exige download e ainda não está integrado.'));
    var P = ui.depth || (ui.depth = { invert: false, contrast: 1, blur: 2, near: 0, far: 255 });
    var r = el('div', 'ai-row'), ci = el('input'); ci.type = 'checkbox'; ci.checked = P.invert; ci.id = 'ai-dinv'; ci.addEventListener('change', function () { P.invert = ci.checked; D.computeDepth(P); });
    var cl = el('label', 'ai-row'); cl.appendChild(ci); cl.appendChild(document.createTextNode(' Inverter')); r.appendChild(cl); b.appendChild(r);
    [['contrast', 'Contraste', 0.2, 4, 0.1], ['blur', 'Suavizar', 0, 12, 1], ['near', 'Perto', 0, 254, 1], ['far', 'Longe', 1, 255, 1]].forEach(function (c) {
      var i = el('input'); i.type = 'range'; i.min = c[2]; i.max = c[3]; i.step = c[4]; i.value = P[c[0]]; i.addEventListener('change', function () { P[c[0]] = +i.value; D.computeDepth(P); }); b.appendChild(field(c[1], i));
    });
    var r2 = el('div', 'ai-row'); r2.appendChild(btn('Generate Depth Map', function () { D.computeDepth(P); }, null, 'ai-depth'));
    if (st.depth) {
      r2.appendChild(btn('Usar faixa como máscara', function () { D.depthToMask(P.near, P.far); }, null, 'ai-depth-mask')); b.appendChild(r2);
      var cv = el('canvas'); cv.width = st.depth.w; cv.height = st.depth.h; cv.style.cssText = 'width:100%;border-radius:6px;border:1px solid var(--line)'; var id = cv.getContext('2d').createImageData(cv.width, cv.height);
      for (var i = 0; i < st.depth.data.length; i++) { var v = st.depth.data[i]; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; } cv.getContext('2d').putImageData(id, 0, 0); b.appendChild(cv);
    } else b.appendChild(r2);
    return b;
  }
  function suggBox() {
    var st = D.state, b = box('3. Suggested Animations', true), list = st.analysis ? st.analysis.suggestions : [];
    if (!list.length) { b.appendChild(el('p', 'ai-note', 'As sugestões aparecem depois de "Analyze Scene".')); return b; }
    list.forEach(function (sg) {
      var c = el('div', 'ai-sg'); c.dataset.id = sg.id; c.appendChild(el('b', null, sg.title)); c.appendChild(el('p', null, sg.description));
      var tg = el('div', 'ai-tags'); [sg.durationSec + ' s', 'complexidade ' + sg.complexity].concat(sg.effects.map(function (e) { return FX.info[e] ? FX.info[e].name : e; })).forEach(function (t) { tg.appendChild(el('span', null, t)); }); c.appendChild(tg);
      if (sg.sequence.length) c.appendChild(el('p', null, 'Sequência: ' + sg.sequence.join(' → ')));
      if (sg.resources.length) c.appendChild(el('p', null, 'Recursos: ' + sg.resources.join('; ')));
      c.appendChild(btn('Preview', function () { D.planFromSuggestion(sg); ui.prevFrom = 'sugestão'; }, null, 'ai-sg-' + sg.id)); b.appendChild(c);
    });
    return b;
  }
  function promptBox() {
    var st = D.state, b = box('4. Prompt e shaders', true);
    var ta = el('textarea'); ta.id = 'ai-prompt'; ta.rows = 3; ta.placeholder = 'Ex.: Faça a estátua ganhar olhos brilhantes e depois virar ouro.'; ta.value = ui.prompt || ''; ta.addEventListener('input', function () { ui.prompt = ta.value; }); b.appendChild(field('Descreva a animação', ta));
    var du = el('input'); du.type = 'number'; du.min = 1; du.max = 300; du.placeholder = 'auto'; du.id = 'ai-dur'; du.style.width = '70px'; du.value = ui.dur || '';
    var r = el('div', 'ai-row'); r.appendChild(field('Duração (s)', du));
    r.appendChild(btn('Generate Preview', function () { ui.dur = du.value; D.planFromPrompt(ta.value, { duration: du.value ? +du.value : undefined }); }, 'primary', 'ai-gen'));
    if (D.mode() === 'ai') r.appendChild(btn('Usar planejador local', function () { D.planFromPrompt(ta.value, { forceLocal: true, duration: du.value ? +du.value : undefined }); }, null, 'ai-gen-local'));
    b.appendChild(r);
    b.appendChild(el('p', 'ai-note', D.mode() === 'ai' ? 'A IA converte o texto em um plano estruturado e validado; nada é executado sem validação.' : 'Sem IA ativa: o planejador LOCAL entende palavras-chave (rachadura, brilho, ouro, neon, oceano, partículas, glitch, energia, explosão, ritmo) e a ordem "depois".'));
    var sr = el('div', 'ai-row'), ss = el('select', 'pick'); ss.id = 'ai-shader-pick';
    Object.keys(SV.PRESETS).forEach(function (k) { var o = el('option', null, SV.PRESETS[k].name + ' (GLSL nativo)'); o.value = k; ss.appendChild(o); });
    D.shaderPresets().forEach(function (p, i) { var o = el('option', null, p.name + ' (salvo)'); o.value = 'saved:' + i; ss.appendChild(o); });
    sr.appendChild(ss);
    sr.appendChild(btn('Usar shader', function () { var v = ss.value; if (v.indexOf('saved:') === 0) { var p = D.shaderPresets()[+v.slice(6)]; SV.PRESETS['_saved'] = { name: p.name, code: p.glsl }; D.shaderPlan('', '_saved'); } else D.shaderPlan('', v); }, null, 'ai-shader-use'));
    if (D.mode() === 'ai') sr.appendChild(btn('Gerar shader com IA', function () { D.shaderPlan(ta.value); }, null, 'ai-shader-gen'));
    if (st.plan && st.plan.layers.some(function (l) { return l.effect === 'glsl'; })) sr.appendChild(btn('Salvar preset', function () { D.saveShaderPreset(); }, null, 'ai-shader-save'));
    b.appendChild(sr);
    return b;
  }
  function previewBox() {
    var st = D.state, b = box('5. Prévia e timeline', true), p = st.plan;
    if (st.error) { var e = el('p', 'ai-err', st.error); e.id = 'ai-error'; b.appendChild(e); }
    st.planErrors.forEach(function (t) { b.appendChild(el('p', 'ai-err', t)); });
    if (!p) { b.appendChild(el('p', 'ai-note', 'Escolha uma sugestão ou escreva um prompt e clique em Generate Preview.')); b.appendChild(undoRow()); return b; }
    var sm = Bridge.summarize(p, D.surfaceInfo());
    b.appendChild(el('b', null, p.title));
    b.appendChild(el('p', 'ai-note', sm.duration + ' s · ' + sm.layers + ' camada(s) · ' + sm.clips + ' clipe(s) em ' + sm.surfaces + ' superfície(s) · origem: ' + (p.source === 'ai' ? 'IA' : 'planejador local')));
    var ls = el('div', 'ai-list'); p.layers.forEach(function (L) { ls.appendChild(el('div', 'ai-note', '• ' + L.name + ' (' + (FX.info[L.effect] ? FX.info[L.effect].name : L.effect) + ') ' + L.start.toFixed(1) + ' → ' + (L.start + L.duration).toFixed(1) + ' s · alvo: ' + (Array.isArray(L.target) ? L.target.length + ' superfície(s)' : (L.target === 'each' ? 'cada superfície em cascata' : 'todas')))); }); b.appendChild(ls);
    var pv = D.previewSeq();
    if (pv && pv.surfaces.length) {
      var ss = el('select', 'pick'); ss.id = 'ai-prev-surf'; pv.surfaces.forEach(function (s, i) { var o = el('option', null, s.name); o.value = i; ss.appendChild(o); }); ss.value = Math.min(prevSurf, pv.surfaces.length - 1); ss.addEventListener('change', function () { prevSurf = +ss.value; render(); }); b.appendChild(field('Superfície na prévia', ss));
      var strip = el('div', 'ai-strip'); strip.id = 'ai-strip';
      for (var i = 0; i < 5; i++) { var cv = el('canvas'); cv.width = 160; cv.height = 90; var T = p.duration * (i + 0.5) / 5; cv.title = T.toFixed(1) + ' s'; Bridge.renderFrame(pv.seq, T, pv.surfaces[Math.min(prevSurf, pv.surfaces.length - 1)].key, cv); strip.appendChild(cv); }
      b.appendChild(strip);
    }
    D.checks().concat(p.notes ? [p.notes] : [], st.planWarnings).forEach(function (t) { if (t) b.appendChild(el('p', 'ai-warn', t)); });
    var r = el('div', 'ai-row');
    r.appendChild(btn('Apply to Timeline', function () { var bt = D.apply(); if (bt) host.say(bt.clipIds.length + ' clipes criados na timeline. Eles são normais: mova, apare, edite keyframes ou apague.'); }, 'primary', 'ai-apply'));
    r.appendChild(btn('Regenerate', function () { if (ui.prevFrom === 'sugestão') return; D.planFromPrompt(ui.prompt || '', {}); }, null, 'ai-regen'));
    r.appendChild(btn('Cancel', function () { st.plan = null; st.planErrors = []; st.error = null; render(); }, null, 'ai-cancel-plan'));
    b.appendChild(r); b.appendChild(undoRow());
    return b;
  }

  function illusionBox() {
    var I = D.state.ill, b = box('3D Illusions (Sala Infinita, túnel, cubo abrindo...)', false), C = root.IllusionCore;
    if (!root.AiIllusion || !C) { b.appendChild(el('p', 'ai-note', 'Módulo 3D indisponível.')); return b; }
    var ta = el('textarea'); ta.id = 'ai-ill-prompt'; ta.rows = 2; ta.placeholder = 'Ex.: Sala infinita azul no cubo A, frente e laterais, 10 segundos.'; ta.value = ui.illPrompt || ''; ta.addEventListener('input', function () { ui.illPrompt = ta.value; });
    b.appendChild(field('Descreva a ilusão', ta));
    var q = el('div', 'ai-row');
    C.PRESET_ORDER.forEach(function (k) { q.appendChild(btn(C.PRESETS[k].name, function () { ui.illPrompt = C.PRESETS[k].name; D.illusionFromPrompt(C.PRESETS[k].name, { forceLocal: true }); }, null, 'ai-ill-q-' + k)); });
    b.appendChild(q);
    var r = el('div', 'ai-row');
    r.appendChild(btn('Gerar ilusão', function () { D.illusionFromPrompt(ta.value, {}); }, 'primary', 'ai-ill-gen'));
    if (D.mode() === 'ai') r.appendChild(btn('Usar planejador local', function () { D.illusionFromPrompt(ta.value, { forceLocal: true }); }, null, 'ai-ill-gen-local'));
    b.appendChild(r);
    b.appendChild(el('p', 'ai-note', 'A IA só escolhe preset, cores, objeto, material, faces e números dentro das faixas do catálogo 3D. Nenhum código é aceito ou executado.'));
    if (I.error) { var e = el('p', 'ai-err', I.error); e.id = 'ai-ill-error'; b.appendChild(e); }
    I.errors.forEach(function (t) { b.appendChild(el('p', 'ai-err', t)); });
    var p = I.plan;
    if (p) {
      var c = el('div', 'ai-sg'); c.id = 'ai-ill-plan'; c.appendChild(el('b', null, p.title));
      c.appendChild(el('p', null, C.PRESETS[p.il.preset].name + ' · cubo ' + p.il.target.cube + ' · faces: ' + p.il.target.faces.map(function (f) { return C.FACE_LABEL[f]; }).join(', ') + ' · ' + p.duration + ' s · ' + p.keys.length + ' keyframe(s) · origem: ' + (p.source === 'ai' ? 'IA' : 'planejador local')));
      var tg = el('div', 'ai-tags'); [p.il.style.obj, p.il.style.material, p.il.style.wall, p.il.quality].forEach(function (t) { tg.appendChild(el('span', null, t)); });
      [p.il.style.color1, p.il.style.color2].forEach(function (col) { var s = el('span', null, col); s.style.borderColor = col; tg.appendChild(s); }); c.appendChild(tg); b.appendChild(c);
      I.warnings.forEach(function (t) { b.appendChild(el('p', 'ai-warn', t)); });
      var r2 = el('div', 'ai-row');
      r2.appendChild(btn('Apply to Timeline', function () { var bt = D.applyIllusion(); if (bt) host.say(I.notice); }, 'primary', 'ai-ill-apply'));
      r2.appendChild(btn('Abrir no painel 3D', function () { if (root.IllusionUI && root.IllusionUI.load) { root.IllusionUI.load(p.il); host.say('Ilusão carregada no painel 3D.'); } }, null, 'ai-ill-open'));
      r2.appendChild(btn('Cancel', function () { I.plan = null; I.errors = []; I.warnings = []; I.error = null; render(); }, null, 'ai-ill-cancel'));
      b.appendChild(r2);
    }
    if (I.notice) { var nn = el('p', 'ai-note', I.notice); nn.id = 'ai-ill-notice'; b.appendChild(nn); }
    var r3 = el('div', 'ai-row'); r3.appendChild(btn('Undo (última ilusão)', function () { var x = D.undoIllusion(); host.say(x ? 'Ilusão "' + x.name + '" desfeita.' : 'Nada para desfazer.'); }, null, 'ai-ill-undo')); b.appendChild(r3);
    return b;
  }
  function undoRow() {
    var r = el('div', 'ai-row'); r.appendChild(btn('Undo (última geração)', function () { var b = D.undo(); host.say(b ? 'Geração "' + b.title + '" desfeita.' : 'Nada para desfazer.'); }, null, 'ai-undo'));
    r.appendChild(el('span', 'ai-note', 'Também funciona com Cmd+Z.')); return r;
  }
  function audioBox() {
    var st = D.state, b = box('Áudio e ritmo', false), seq = host.bridgeHost().seq();
    var auds = seq.assets.filter(function (a) { return a.kind === 'audio' || a.kind === 'video'; });
    if (!auds.length) b.appendChild(el('p', 'ai-note', 'Coloque uma música na timeline (faixa de áudio) para analisar as batidas.'));
    else {
      var sel = el('select', 'pick'); sel.id = 'ai-audio'; auds.forEach(function (a) { var o = el('option', null, a.name); o.value = a.id; sel.appendChild(o); }); b.appendChild(sel);
      var r = el('div', 'ai-row');
      r.appendChild(btn('Analisar batidas', function () { var a = seq.assets.filter(function (x) { return x.id === sel.value; })[0]; var url = host.toUrl ? host.toUrl(a) : a.src; ui.msg.textContent = 'Analisando áudio...'; D.analyzeAudio(url).then(function () { ui.msg.textContent = ''; }).catch(function () { ui.msg.textContent = 'Não consegui decodificar esse áudio.'; }); }, null, 'ai-beats'));
      b.appendChild(r);
    }
    if (st.beats) {
      b.appendChild(el('p', 'ai-note', st.beats.beats.length + ' batidas · BPM estimado: ' + (st.beats.bpm || 'incerto') + ' (confiança ' + st.beats.confidence + ') · ' + st.beats.changes.length + ' mudança(s) de intensidade. Medido por análise do áudio, não pela IA.'));
      b.appendChild(btn('Marcar batidas na timeline', function () { host.say(D.beatMarkers() + ' marcadores de batida criados.'); }, null, 'ai-beat-markers'));
    }
    return b;
  }
  function mapBox() {
    var st = D.state, b = box('AI Mapping Assistant', false);
    b.appendChild(el('p', 'ai-note', 'Fluxo: Analyze → Suggest → Preview → Confirm → Calibrate. As sugestões ficam separadas da calibração. Só "Criar superfície" cria uma NOVA superfície (você calibra depois). Nenhuma superfície existente é alterada.'));
    b.appendChild(btn('Suggest', function () { D.suggestQuads(); }, null, 'ai-suggest-quads'));
    if (st.quads.length) {
      var pv = el('div', 'ai-photo'); var cv = el('canvas'); cv.width = st.img.canvas.width; cv.height = st.img.canvas.height; var ctx = cv.getContext('2d'); ctx.drawImage(st.img.canvas, 0, 0);
      ctx.lineWidth = Math.max(2, cv.width / 300); st.quads.forEach(function (q, i) { ctx.strokeStyle = q.state === 'criada' ? '#4ade80' : '#ffd24a'; ctx.beginPath(); q.quad.forEach(function (p, k) { var x = p[0] * cv.width, y = p[1] * cv.height; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke(); });
      pv.appendChild(cv); b.appendChild(pv);
      st.quads.forEach(function (q) { var r = el('div', 'ai-row'); r.appendChild(el('span', 'ai-note', q.label + (q.confidence != null ? ' (' + Math.round(q.confidence * 100) + '%)' : '') + ' · ' + q.state)); if (q.state !== 'criada') r.appendChild(btn('Criar superfície', function () { D.confirmQuad(q.id); host.say('Nova superfície criada. Ajuste os cantos na calibração antes de projetar.'); }, null, 'ai-quad-' + q.id)); b.appendChild(r); });
    }
    return b;
  }

  var host = null;
  function render() {
    if (!sec) return;
    var scroll = sec.closest('.panel') ? sec.closest('.panel').scrollTop : 0, fo = document.activeElement && document.activeElement.id;
    sec.textContent = '';
    var w = el('div', 'ai-wrap'); w.appendChild(head());
    ui.msg = el('p', 'ai-note'); ui.msg.id = 'ai-msg'; w.appendChild(ui.msg);
    w.appendChild(photoBox()); w.appendChild(objectsBox()); w.appendChild(suggBox()); w.appendChild(promptBox()); w.appendChild(previewBox()); w.appendChild(illusionBox()); w.appendChild(depthBox()); w.appendChild(audioBox()); w.appendChild(mapBox()); w.appendChild(settingsBox());
    sec.appendChild(w);
    if (sec.closest('.panel')) sec.closest('.panel').scrollTop = scroll;
    if (fo && fo !== 'ai-prompt' && fo !== 'ai-ill-prompt') { var f = document.getElementById(fo); if (f && f.focus) try { f.focus(); } catch (e) {} }
  }
  var pend = null;
  function schedule() { if (pend) return; pend = setTimeout(function () { pend = null; render(); }, 16); }

  function mount(section, h) {
    host = h; sec = section; D = root.AiDirector;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    D.init({ api: h.api, surfaces: h.surfaces, bridgeHost: h.bridgeHost, addSurfaceFromQuad: h.addSurfaceFromQuad }, { confirm: confirmDialog });
    D.subscribe(schedule); render();
  }
  root.AiDirectorPanel = { mount: mount, render: render, _confirm: confirmDialog };
})(typeof window !== 'undefined' ? window : globalThis);
