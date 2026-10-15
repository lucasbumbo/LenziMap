// Layout profissional: estado, limites, workspaces e layouts salvos. Lógica pura (sem DOM), testável em Node.
(function (root) {
  'use strict';
  var KEY = 'lenzi-layout';
  var LIM = { panelW: [280, 640], tlH: [190, 0.72] };      // tlH máximo é fração da altura da janela

  // Workspaces: foco da interface. tab = aba do painel direito, vTool = ferramenta do Viewer.
  var WORKSPACES = {
    editing:   { label: 'Editing',   panelW: 360, tlH: 360, showPanel: true,  showTimeline: true,  max: null, tab: 'timeline' },
    mapping:   { label: 'Mapping',   panelW: 400, tlH: 220, showPanel: true,  showTimeline: false, max: null, tab: 'camadas' },
    animation: { label: 'Animation', panelW: 360, tlH: 460, showPanel: true,  showTimeline: true,  max: null, tab: 'timeline' },
    audio:     { label: 'Audio',     panelW: 340, tlH: 420, showPanel: true,  showTimeline: true,  max: null, tab: 'timeline' },
    show:      { label: 'Show',      panelW: 360, tlH: 240, showPanel: false, showTimeline: false, max: 'viewer', tab: 'saida', locked: true }
  };
  var ORDER = ['editing', 'mapping', 'animation', 'audio', 'show'];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function defaults() {
    var w = WORKSPACES.editing;
    return { v: 1, workspace: 'editing', panelW: w.panelW, tlH: w.tlH, showPanel: true, showTimeline: true, max: null, tab: w.tab, show: false, custom: {} };
  }
  // Normaliza qualquer coisa lida do disco: valores fora do limite, tipos errados e campos ausentes viram valores seguros.
  function sanitize(x, winH) {
    var d = defaults(); if (!x || typeof x !== 'object') return d;
    var maxH = Math.round((winH || 900) * LIM.tlH[1]);
    var s = {
      v: 1,
      workspace: ORDER.indexOf(x.workspace) >= 0 || x.workspace === 'custom' ? x.workspace : d.workspace,
      panelW: clamp(+x.panelW || d.panelW, LIM.panelW[0], LIM.panelW[1]),
      tlH: clamp(+x.tlH || d.tlH, LIM.tlH[0], Math.max(LIM.tlH[0], maxH)),
      showPanel: x.showPanel !== false, showTimeline: x.showTimeline !== false,
      max: x.max === 'viewer' || x.max === 'timeline' ? x.max : null,
      tab: typeof x.tab === 'string' ? x.tab : d.tab, show: !!x.show, custom: {}
    };
    if (x.custom && typeof x.custom === 'object') Object.keys(x.custom).slice(0, 12).forEach(function (k) {
      var c = x.custom[k]; if (!c || typeof c !== 'object') return;
      s.custom[String(k).slice(0, 24)] = { panelW: clamp(+c.panelW || d.panelW, LIM.panelW[0], LIM.panelW[1]), tlH: clamp(+c.tlH || d.tlH, LIM.tlH[0], Math.max(LIM.tlH[0], maxH)), showPanel: c.showPanel !== false, showTimeline: c.showTimeline !== false, tab: typeof c.tab === 'string' ? c.tab : d.tab };
    });
    return s;
  }
  function applyWorkspace(s, name) {
    var w = WORKSPACES[name]; if (!w) return s;
    s.workspace = name; s.panelW = w.panelW; s.tlH = w.tlH; s.showPanel = w.showPanel; s.showTimeline = w.showTimeline; s.max = w.max; s.tab = w.tab; s.show = !!w.locked;
    return s;
  }
  function saveCustom(s, name) {
    name = String(name || '').trim().slice(0, 24); if (!name) return null;
    s.custom[name] = { panelW: s.panelW, tlH: s.tlH, showPanel: s.showPanel, showTimeline: s.showTimeline, tab: s.tab }; s.workspace = 'custom';
    return name;
  }
  function recallCustom(s, name) {
    var c = s.custom[name]; if (!c) return false;
    s.panelW = c.panelW; s.tlH = c.tlH; s.showPanel = c.showPanel; s.showTimeline = c.showTimeline; s.tab = c.tab; s.max = null; s.show = false; s.workspace = 'custom';
    return true;
  }
  function deleteCustom(s, name) { if (!s.custom[name]) return false; delete s.custom[name]; return true; }
  function reset(s) { var c = s.custom; var d = defaults(); d.custom = c; return d; }
  // Maximizar alterna: pedir o mesmo modo de novo restaura.
  function toggleMax(s, which) { s.max = s.max === which ? null : which; return s; }
  // Classes CSS derivadas do estado (o DOM só aplica).
  function classes(s, tlOn) {
    var c = [];
    if (!s.showPanel || s.max) c.push('lay-nopanel');
    if (!tlOn || !s.showTimeline || s.max === 'viewer') c.push('lay-notl');
    if (s.max === 'timeline' && tlOn) c.push('lay-maxtl');
    if (s.max === 'viewer') c.push('lay-maxv');
    if (s.show) c.push('lay-show');
    return c;
  }

  root.LayoutCore = { KEY: KEY, LIM: LIM, WORKSPACES: WORKSPACES, ORDER: ORDER, defaults: defaults, sanitize: sanitize, applyWorkspace: applyWorkspace, saveCustom: saveCustom, recallCustom: recallCustom, deleteCustom: deleteCustom, reset: reset, toggleMax: toggleMax, classes: classes, clamp: clamp };
  if (typeof module !== 'undefined') module.exports = root.LayoutCore;
})(typeof window !== 'undefined' ? window : globalThis);
