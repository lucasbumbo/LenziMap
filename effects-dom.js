// LenziMap 3.0 fase 9: aplica a pilha de efeitos (EffectsCore) nos elementos do Renderer. Usa filtros CSS e SVG do próprio documento.
// O Viewer e a saída externa rodam este mesmo código: cada página mantém seus filtros SVG. Sem rede, sem canvas extra, sem motor novo.
(function (root) {
  'use strict';
  var EC = root.EffectsCore;
  var NS = 'http://www.w3.org/2000/svg';
  var holders = [];   // um por documento
  function holderFor(doc) {
    for (var i = 0; i < holders.length; i++) if (holders[i].doc === doc) return holders[i];
    var div = doc.createElement('div'); div.id = 'lm-fx-defs'; div.setAttribute('aria-hidden', 'true');
    div.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;opacity:0';
    (doc.body || doc.documentElement).appendChild(div);
    var h = { doc: doc, div: div, nodes: {}, used: {}, frame: 0 };
    holders.push(h); return h;
  }
  function upsert(h, def) {
    var n = h.nodes[def.id];
    if (!n) { var svg = h.doc.createElementNS(NS, 'svg'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); h.div.appendChild(svg); n = h.nodes[def.id] = { svg: svg, markup: '' }; }
    if (n.markup !== def.markup) { n.svg.innerHTML = def.markup; n.markup = def.markup; }
    h.used[def.id] = h.frame;
  }
  // Remove filtros que não são usados há um tempo (clipes que saíram do ar)
  function prune(h) {
    h.frame++;
    if (h.frame % 120) return;
    Object.keys(h.nodes).forEach(function (id) { if (h.frame - (h.used[id] || 0) > 240) { var n = h.nodes[id]; if (n.svg.parentNode) n.svg.parentNode.removeChild(n.svg); delete h.nodes[id]; delete h.used[id]; } });
  }
  // Calcula e aplica. ev = resultado de Sequence.evalClip. Devolve { filter, opacity } para quem desenha em canvas.
  function frameOf(ev, clipId, opts) {
    if (!EC || !ev || !ev.efx || !ev.efx.length) return null;
    var amt = {}; ev.efx.forEach(function (e) { amt[e.id] = e.amount; });
    return EC.evalStack(ev.efx.map(function (e) { return e.p; }), function (id) { return amt[id]; }, ev.local || 0, clipId, opts && opts.skip);
  }
  function apply(el, ev, clipId, opts) {
    if (!el || !el.ownerDocument) return null;
    var fr = frameOf(ev, clipId, opts), doc = el.ownerDocument, h = holderFor(doc);
    if (fr) {
      fr.defs.forEach(function (d) { upsert(h, d); });
      if (el.__fxf !== fr.filter) { el.style.filter = fr.filter; el.__fxf = fr.filter; }
    } else if (el.__fxf) { el.style.filter = ''; el.__fxf = ''; }
    var bl = EC ? EC.cssBlend(ev && ev.blend) : 'normal';
    if (el.__bl !== bl) { el.style.mixBlendMode = bl; el.__bl = bl; }
    prune(h);
    return fr;
  }
  root.EffectsDom = { apply: apply, frameOf: frameOf, _holders: holders };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.EffectsDom;
})(typeof window !== 'undefined' ? window : globalThis);
