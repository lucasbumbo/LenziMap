// Camada de provedores de IA com visão. Não depende de nenhuma API específica: cada provedor é só um par
// "montar pedido" / "ler resposta". A chave NUNCA passa por aqui na interface: ela vive no processo principal
// (ai-main.js) e é colocada no cabeçalho só na hora de enviar.
(function (root) {
  'use strict';
  var PROVIDERS = {
    openai: { id: 'openai', name: 'OpenAI', model: 'gpt-4o', url: 'https://api.openai.com/v1/chat/completions', vision: true, keyHelp: 'platform.openai.com/api-keys' },
    anthropic: { id: 'anthropic', name: 'Anthropic (Claude)', model: 'claude-sonnet-5-5', url: 'https://api.anthropic.com/v1/messages', vision: true, keyHelp: 'console.anthropic.com/settings/keys' }
  };
  var LIMITS = { imageB64: 5 * 1024 * 1024, prompt: 9000, system: 9000, timeoutMs: 60000, maxTokens: 4096 };

  function buildRequest(provider, o) {
    var P = PROVIDERS[provider];
    if (!P) throw new Error('Provedor desconhecido: ' + provider);
    o = o || {};
    var model = String(o.model || P.model).slice(0, 80), maxTokens = Math.min(LIMITS.maxTokens, o.maxTokens || 2048);
    var img = o.image && o.image.b64 ? o.image : null;
    if (img && img.b64.length > LIMITS.imageB64) throw new Error('Imagem grande demais para enviar (limite ' + Math.round(LIMITS.imageB64 / 1048576) + ' MB).');
    if (String(o.prompt || '').length > LIMITS.prompt) throw new Error('Pedido grande demais.');
    var mime = img && /^image\/(jpeg|png|webp)$/.test(img.mime) ? img.mime : 'image/jpeg';
    if (provider === 'openai') {
      var content = [{ type: 'text', text: String(o.prompt || '') }];
      if (img) content.push({ type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + img.b64, detail: 'low' } });
      return { url: P.url, auth: { header: 'Authorization', prefix: 'Bearer ' }, headers: { 'content-type': 'application/json' },
        body: { model: model, messages: [{ role: 'system', content: String(o.system || '').slice(0, LIMITS.system) }, { role: 'user', content: content }], response_format: { type: 'json_object' }, max_completion_tokens: maxTokens } };
    }
    var cont = [];
    if (img) cont.push({ type: 'image', source: { type: 'base64', media_type: mime, data: img.b64 } });
    cont.push({ type: 'text', text: String(o.prompt || '') });
    return { url: P.url, auth: { header: 'x-api-key', prefix: '' }, headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: { model: model, max_tokens: maxTokens, system: String(o.system || '').slice(0, LIMITS.system), messages: [{ role: 'user', content: cont }] } };
  }
  function parseResponse(provider, j) {
    if (!j || typeof j !== 'object') return null;
    if (provider === 'openai') { var c = j.choices && j.choices[0] && j.choices[0].message; return c && typeof c.content === 'string' ? c.content : null; }
    if (provider === 'anthropic') { var t = (j.content || []).filter(function (b) { return b && b.type === 'text'; }).map(function (b) { return b.text; }).join(''); return t || null; }
    return null;
  }
  function usageOf(provider, j) {
    var u = j && j.usage; if (!u) return null;
    return provider === 'openai' ? { input: u.prompt_tokens || 0, output: u.completion_tokens || 0 } : { input: u.input_tokens || 0, output: u.output_tokens || 0 };
  }
  // Texto amigável para cada tipo de falha (nunca inclui a chave nem o corpo bruto do servidor).
  function explain(status, code) {
    if (code === 'no-key') return 'Nenhuma chave configurada para este provedor. Abra Configurações de IA e cole a sua chave.';
    if (code === 'offline') return 'Sem conexão com o provedor. O LenziMap continua funcionando; tente de novo quando a internet voltar.';
    if (code === 'timeout') return 'O provedor demorou demais para responder (tempo esgotado).';
    if (code === 'cancelled') return 'Operação cancelada.';
    if (code === 'disabled') return 'Serviços externos de IA estão desligados nas configurações.';
    if (code === 'bad-response') return 'O provedor respondeu num formato inesperado.';
    if (status === 401 || status === 403) return 'O provedor recusou a chave (erro ' + status + '). Confira se a chave está certa e tem acesso ao modelo.';
    if (status === 404) return 'Modelo não encontrado neste provedor. Confira o nome do modelo nas configurações.';
    if (status === 413) return 'A imagem ou o pedido é grande demais para o provedor.';
    if (status === 429) return 'Limite de uso do provedor atingido (erro 429). Espere um pouco ou confira o seu plano.';
    if (status >= 500) return 'O provedor está com problema agora (erro ' + status + '). Tente de novo mais tarde.';
    return 'O provedor devolveu o erro ' + status + '.';
  }

  // Executa o pedido. Roda no processo principal (Node/Electron), onde a chave existe.
  // o: { provider, model, key, system, prompt, image, timeoutMs, signal, baseUrl, fetchImpl }
  async function call(o) {
    var f = o.fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!f) return { ok: false, code: 'offline', error: explain(0, 'offline') };
    if (!o.key) return { ok: false, code: 'no-key', error: explain(0, 'no-key') };
    var req;
    try { req = buildRequest(o.provider, o); } catch (e) { return { ok: false, code: 'bad-request', error: e.message }; }
    var url = o.baseUrl ? o.baseUrl.replace(/\/$/, '') + '/' + o.provider : req.url;
    var ctl = new AbortController(), timer = null, timedOut = false;
    if (o.signal) { if (o.signal.aborted) return { ok: false, code: 'cancelled', error: explain(0, 'cancelled') }; o.signal.addEventListener('abort', function () { ctl.abort(); }); }
    timer = setTimeout(function () { timedOut = true; ctl.abort(); }, o.timeoutMs || LIMITS.timeoutMs);
    try {
      var headers = Object.assign({}, req.headers); headers[req.auth.header] = req.auth.prefix + o.key;
      var res = await f(url, { method: 'POST', headers: headers, body: JSON.stringify(req.body), signal: ctl.signal });
      if (!res.ok) return { ok: false, code: 'http', status: res.status, error: explain(res.status) };
      var j; try { j = await res.json(); } catch (e) { return { ok: false, code: 'bad-response', error: explain(0, 'bad-response') }; }
      var text = parseResponse(o.provider, j);
      if (text == null) return { ok: false, code: 'bad-response', error: explain(0, 'bad-response') };
      return { ok: true, text: text, usage: usageOf(o.provider, j) };
    } catch (e) {
      if (timedOut) return { ok: false, code: 'timeout', error: explain(0, 'timeout') };
      if (e && e.name === 'AbortError') return { ok: false, code: 'cancelled', error: explain(0, 'cancelled') };
      return { ok: false, code: 'offline', error: explain(0, 'offline') };
    } finally { clearTimeout(timer); }
  }

  var api = { PROVIDERS: PROVIDERS, LIMITS: LIMITS, buildRequest: buildRequest, parseResponse: parseResponse, explain: explain, call: call };
  root.AiProvider = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
