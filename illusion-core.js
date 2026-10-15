// LenziMap 3.2: núcleo puro do 3D Illusion Creator (sem DOM, sem WebGL). Serve ao motor, ao painel, ao AI Director e aos testes.
// Tudo aqui é dado e matemática: geometria física dos cubos, câmera de janela (off-axis) por face, parâmetros, presets,
// validação com lista fechada (nada de código vindo de fora) e migração de versão.
// Unidades: polegadas. Eixos do mundo: X direita, Y pra cima, Z em direção ao público.
// Quadro de uma face ("local"): origem no centro da face, X pra direita, Y pra cima, Z pra fora da face (pro público).
// O interior do cubo é Z negativo. O quadro de um cubo ("cube"): origem no centro do cubo, eixos alinhados ao cubo.
(function (root) {
  'use strict';
  var VERSION = 1;          // versão do formato da ilusão
  var STAGE_VERSION = 2;    // versão do palco: v2 acrescenta grupos de cubos e ordem das faces (a v1 migra sem perda)
  var FACES = ['front', 'right', 'back', 'left', 'top'];
  var FACE_LABEL = { front: 'Frente', right: 'Direita', back: 'Trás', left: 'Esquerda', top: 'Topo' };
  var D2R = Math.PI / 180;

  function num(v, d) { v = +v; return isFinite(v) ? v : d; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // ---------- vetores e matrizes (matriz 4x4 em coluna, como o WebGL) ----------
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function norm(a) { var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function ident() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function m4mul(a, b) {
    var o = new Array(16), i, j, k;
    for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) { var s = 0; for (k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; }
    return o;
  }
  function m4pt(m, p) {
    var x = p[0], y = p[1], z = p[2];
    return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]];
  }
  function m4dir(m, v) { return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]]; }
  // Rotação por Euler em graus: R = Ry * Rx * Rz
  function rotM(rx, ry, rz) {
    var a = rx * D2R, b = ry * D2R, c = rz * D2R, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
    var X = [1, 0, 0, 0, 0, ca, sa, 0, 0, -sa, ca, 0, 0, 0, 0, 1], Y = [cb, 0, -sb, 0, 0, 1, 0, 0, sb, 0, cb, 0, 0, 0, 0, 1], Z = [cc, sc, 0, 0, -sc, cc, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    return m4mul(Y, m4mul(X, Z));
  }
  // Translação * Rotação * Escala
  function trs(p, r, s) {
    var R = rotM(r[0], r[1], r[2]);
    return [R[0] * s[0], R[1] * s[0], R[2] * s[0], 0, R[4] * s[1], R[5] * s[1], R[6] * s[1], 0, R[8] * s[2], R[9] * s[2], R[10] * s[2], 0, p[0], p[1], p[2], 1];
  }
  function frustum(l, r, b, t, n, f) {
    return [2 * n / (r - l), 0, 0, 0, 0, 2 * n / (t - b), 0, 0, (r + l) / (r - l), (t + b) / (t - b), -(f + n) / (f - n), -1, 0, 0, -2 * f * n / (f - n), 0];
  }
  function perspective(fovDeg, aspect, n, f) {
    var t = n * Math.tan(fovDeg * D2R / 2), r = t * aspect;
    return frustum(-r, r, -t, t, n, f);
  }
  // Câmera olhando de eye para target (visão normal, usada nas prévias)
  function lookAt(eye, target, up) {
    var z = norm(sub(eye, target)), x = norm(cross(up || [0, 1, 0], z)), y = cross(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
  }

  // ---------- geometria física ----------
  // Cubos padrão do palco do Lucas: A 16 pol, B, C e D 8 pol. Tudo editável e salvo no projeto, separado de surface.q.
  function defaultStage() {
    return {
      v: STAGE_VERSION, unit: 'in', groups: [],
      cubes: [
        { id: 'A', name: 'Cubo A', size: 16, pos: [0, 8, 0], rotY: 0, faces: { front: null, right: null, back: null, left: null, top: null }, faceOrder: FACES.slice() },
        { id: 'B', name: 'Cubo B', size: 8, pos: [-22, 4, 4], rotY: 0, faces: { front: null, right: null, back: null, left: null, top: null }, faceOrder: FACES.slice() },
        { id: 'C', name: 'Cubo C', size: 8, pos: [22, 4, 4], rotY: 0, faces: { front: null, right: null, back: null, left: null, top: null }, faceOrder: FACES.slice() },
        { id: 'D', name: 'Cubo D', size: 8, pos: [0, 4, 24], rotY: 0, faces: { front: null, right: null, back: null, left: null, top: null }, faceOrder: FACES.slice() }
      ],
      viewer: { pos: [0, 40, 130] },
      projector: { pos: [0, 60, 150] }
    };
  }
  function fixStage(s) {
    var d = defaultStage();
    if (!s || typeof s !== 'object') return d;
    var out = { v: STAGE_VERSION, unit: 'in', groups: [], cubes: [], viewer: { pos: fixVec(s.viewer && s.viewer.pos, d.viewer.pos, 600) }, projector: { pos: fixVec(s.projector && s.projector.pos, d.projector.pos, 1200) } };
    var seen = {};
    (Array.isArray(s.cubes) ? s.cubes : d.cubes).slice(0, 16).forEach(function (c, i) {
      c = c || {};
      var id = String(c.id || String.fromCharCode(65 + i)).slice(0, 12);
      if (seen[id]) id = id + i;
      seen[id] = 1;
      var faces = {};
      FACES.forEach(function (f) { var k = c.faces && c.faces[f]; faces[f] = typeof k === 'string' && k ? k.slice(0, 60) : null; });
      var fo = Array.isArray(c.faceOrder) ? c.faceOrder.filter(function (f, k) { return FACES.indexOf(f) >= 0 && c.faceOrder.indexOf(f) === k; }) : [];
      FACES.forEach(function (f) { if (fo.indexOf(f) < 0) fo.push(f); });
      out.cubes.push({ id: id, name: String(c.name || ('Cubo ' + id)).slice(0, 40), size: clamp(num(c.size, 8), 1, 200), pos: fixVec(c.pos, [0, 4, 0], 2000), rotY: clamp(num(c.rotY, 0), -360, 360), faces: faces, faceOrder: fo });
    });
    if (!out.cubes.length) out.cubes = d.cubes.map(function (c) { c.faceOrder = FACES.slice(); return c; });
    // grupos de cubos (v2): só ids de cubos que existem; um cubo pertence a no máximo um grupo
    var used = {}, gseen = {};
    (Array.isArray(s.groups) ? s.groups : []).slice(0, 32).forEach(function (g, i) {
      g = g || {};
      var gid = String(g.id || ('g' + (i + 1))).slice(0, 16); if (gseen[gid]) gid = gid + '_' + i; gseen[gid] = 1;
      var ids = (Array.isArray(g.cubes) ? g.cubes : []).filter(function (cid) { return seen[cid] && !used[cid]; });
      ids.forEach(function (cid) { used[cid] = 1; });
      out.groups.push({ id: gid, name: String(g.name || ('Grupo ' + (i + 1))).slice(0, 40), cubes: ids });
    });
    return out;
  }
  // Assistente do espectador: medidas feitas com trena -> posição do olho no mundo do palco.
  // dist = distância horizontal do olho até o PLANO da face frontal do cubo; height = altura do olho em relação ao chão;
  // lateral = deslocamento do olho para a direita (+) ou esquerda (-) do centro do cubo. Tudo em polegadas.
  function viewerFromMeasures(cube, m) {
    var rot = (cube.rotY || 0) * Math.PI / 180, half = cube.size / 2;
    var n = [Math.sin(rot), 0, Math.cos(rot)], r = [Math.cos(rot), 0, -Math.sin(rot)];
    var d = clamp(num(m.dist, 130), 0, 600) + half, l = clamp(num(m.lateral, 0), -300, 300);
    return [cube.pos[0] + n[0] * d + r[0] * l, clamp(num(m.height, 60), 0, 200), cube.pos[2] + n[2] * d + r[2] * l];
  }
  function measuresFromViewer(cube, pos) {
    var rot = (cube.rotY || 0) * Math.PI / 180, n = [Math.sin(rot), 0, Math.cos(rot)], r = [Math.cos(rot), 0, -Math.sin(rot)];
    var dx = pos[0] - cube.pos[0], dz = pos[2] - cube.pos[2];
    return { dist: dx * n[0] + dz * n[2] - cube.size / 2, lateral: dx * r[0] + dz * r[2], height: pos[1] };
  }
  // Avisos de bom senso sobre a posição (não bloqueiam)
  function viewerAdvice(cube, m) {
    var out = [], mm = { dist: num(m.dist, 0), height: num(m.height, 0), lateral: num(m.lateral, 0) };
    if (mm.dist < cube.size * 2) out.push('Muito perto do cubo (menos de 2 vezes o lado): a distorção fica forte e o efeito é sensível a qualquer movimento da cabeça.');
    if (mm.dist > cube.size * 20) out.push('Muito longe: o cubo fica pequeno e a ilusão de profundidade perde força.');
    if (Math.abs(mm.lateral) > mm.dist * 0.6) out.push('Muito deslocado pro lado: a face frontal aparece de muito lado e as faces laterais podem ficar escondidas ou esticadas.');
    if (mm.height < 30 || mm.height > 80) out.push('Altura do olho fora da faixa comum de 30 a 80 pol (pessoa em pé ou sentada). Confira a medida.');
    return out;
  }
  function fixVec(v, d, lim) {
    var o = [0, 0, 0];
    for (var i = 0; i < 3; i++) o[i] = clamp(num(v && v[i], d[i]), -lim, lim);
    return o;
  }
  function cubeById(stage, id) { for (var i = 0; i < stage.cubes.length; i++) if (stage.cubes[i].id === id) return stage.cubes[i]; return null; }

  var FACE_AXES = {
    front: { n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0] },
    right: { n: [1, 0, 0], r: [0, 0, -1], u: [0, 1, 0] },
    back: { n: [0, 0, -1], r: [-1, 0, 0], u: [0, 1, 0] },
    left: { n: [-1, 0, 0], r: [0, 0, 1], u: [0, 1, 0] },
    top: { n: [0, 1, 0], r: [1, 0, 0], u: [0, 0, -1] }
  };
  function rotYv(v, deg) { var a = deg * D2R, c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; }
  // Quadro da face: eixos, centro, meia-largura e os 4 cantos na ordem do conteúdo (topo-esq, topo-dir, base-dir, base-esq).
  function faceFrame(cube, face) {
    var ax = FACE_AXES[face]; if (!ax) return null;
    var s = cube.size / 2, n = rotYv(ax.n, cube.rotY), r = rotYv(ax.r, cube.rotY), u = rotYv(ax.u, cube.rotY);
    var c = add(cube.pos, mul(n, s));
    return {
      cube: cube.id, face: face, n: n, r: r, u: u, center: c, half: s,
      corners: [add(sub(c, mul(r, s)), mul(u, s)), add(add(c, mul(r, s)), mul(u, s)), sub(add(c, mul(r, s)), mul(u, s)), sub(sub(c, mul(r, s)), mul(u, s))],
      // matriz quadro-local -> mundo
      M: [r[0], r[1], r[2], 0, u[0], u[1], u[2], 0, n[0], n[1], n[2], 0, c[0], c[1], c[2], 1]
    };
  }
  function cubeFrame(cube) {
    var r = rotYv([1, 0, 0], cube.rotY), u = [0, 1, 0], n = rotYv([0, 0, 1], cube.rotY);
    return { cube: cube.id, face: null, n: n, r: r, u: u, center: cube.pos.slice(), half: cube.size / 2, M: [r[0], r[1], r[2], 0, 0, 1, 0, 0, n[0], n[1], n[2], 0, cube.pos[0], cube.pos[1], cube.pos[2], 1] };
  }
  function visibleFrom(frame, eye) { return dot(frame.n, sub(eye, frame.center)) > 1e-6; }
  // Acha qual face do projeto está ligada a uma superfície (chave).
  function findFace(stage, surfaceKey) {
    if (!stage || !surfaceKey) return null;
    for (var i = 0; i < stage.cubes.length; i++) {
      var c = stage.cubes[i];
      for (var j = 0; j < FACES.length; j++) if (c.faces[FACES[j]] === surfaceKey) return { cube: c, face: FACES[j] };
    }
    return null;
  }

  // Câmera de janela: o olho fica no ponto de vista do público e a face é a "janela". As bordas do frustum passam pelos 4 cantos da face.
  // clip=true: o plano próximo é a própria face (nada fora do cubo aparece). clip=false: o plano próximo chega perto do olho (objetos podem sair da face).
  function faceCamera(frame, eye, clip, far) {
    var rel = sub(eye, frame.center), d = dot(frame.n, rel);
    if (d <= 1e-4) return null;
    var ex = dot(rel, frame.r), ey = dot(rel, frame.u), s = frame.half;
    var nr = clip ? d : Math.max(0.25, d * 0.02), k = nr / d;
    var f = far || Math.max(400, d * 6);
    var proj = frustum((-s - ex) * k, (s - ex) * k, (-s - ey) * k, (s - ey) * k, nr, f);
    var r = frame.r, u = frame.u, n = frame.n;
    var view = [r[0], u[0], n[0], 0, r[1], u[1], n[1], 0, r[2], u[2], n[2], 0, -dot(r, eye), -dot(u, eye), -dot(n, eye), 1];
    return { proj: proj, view: view, near: nr, far: f, dist: d, eye: eye.slice() };
  }
  // Onde o ponto P (mundo) aparece na textura da face (0..1, y pra baixo), visto do olho. null se a luz não cruza a face.
  function projectToFace(frame, eye, P) {
    var dir = sub(P, eye), den = dot(frame.n, dir);
    if (Math.abs(den) < 1e-9) return null;
    var tt = dot(frame.n, sub(frame.center, eye)) / den;
    if (tt <= 0) return null;
    var hit = add(eye, mul(dir, tt)), rel = sub(hit, frame.center), s = frame.half;
    return { u: (dot(rel, frame.r) / s + 1) / 2, v: (1 - dot(rel, frame.u) / s) / 2, t: tt, behind: tt < 1 };
  }

  // ---------- parâmetros ----------
  // kf: pode receber keyframe na timeline (nome vira "ill.<nome>" no motor de keyframes).
  var PARAMS = {
    depth: { label: 'Profundidade virtual (pol)', min: 8, max: 600, def: 120, step: 1, kf: true },
    travel: { label: 'Deslocamento (pol)', min: -2000, max: 2000, def: 0, step: 1, kf: true },
    flow: { label: 'Fluxo automático (pol/s)', min: -200, max: 200, def: 24, step: 1 },
    spacing: { label: 'Espaçamento (pol)', min: 2, max: 80, def: 16, step: 0.5 },
    thick: { label: 'Espessura (pol)', min: 0.1, max: 6, def: 0.8, step: 0.1 },
    glow: { label: 'Brilho', min: 0, max: 3, def: 1, step: 0.05, kf: true },
    light: { label: 'Luz', min: 0, max: 3, def: 1, step: 0.05, kf: true },
    open: { label: 'Abertura', min: 0, max: 1, def: 0, step: 0.01, kf: true },
    brk: { label: 'Quebra', min: 0, max: 1, def: 0, step: 0.01, kf: true },
    brkdir: { label: 'Direção da quebra', min: -1, max: 1, def: -1, step: 2 },
    ox: { label: 'Objeto X (pol)', min: -60, max: 60, def: 0, step: 0.5, kf: true },
    oy: { label: 'Objeto Y (pol)', min: -60, max: 60, def: 0, step: 0.5, kf: true },
    oz: { label: 'Objeto Z (pol)', min: -60, max: 60, def: 0, step: 0.5, kf: true },
    osize: { label: 'Tamanho do objeto', min: 0.1, max: 3, def: 1, step: 0.05, kf: true },
    orot: { label: 'Rotação do objeto (graus)', min: -3600, max: 3600, def: 0, step: 1, kf: true },
    spin: { label: 'Giro automático (graus/s)', min: -720, max: 720, def: 40, step: 1 },
    twist: { label: 'Torção (graus por anel)', min: -90, max: 90, def: 0, step: 1 },
    sides: { label: 'Lados do túnel', min: 3, max: 32, def: 4, step: 1 },
    camx: { label: 'Olhar X (pol)', min: -60, max: 60, def: 0, step: 0.5, kf: true },
    camy: { label: 'Olhar Y (pol)', min: -60, max: 60, def: 0, step: 0.5, kf: true },
    camz: { label: 'Olhar Z (pol)', min: -100, max: 100, def: 0, step: 0.5, kf: true }
  };
  var KF_PARAMS = Object.keys(PARAMS).filter(function (k) { return PARAMS[k].kf; });
  var OBJECTS = ['sphere', 'cube', 'torus', 'gear'];
  var MATERIALS = ['matte', 'metal', 'glass', 'neon', 'wire'];
  var WALLS = ['grid', 'panel', 'plain'];
  var QUALITIES = ['low', 'medium', 'high'];
  var CAM_VIEWS = ['audience', 'free', 'projector'];

  // Cada preset diz quais parâmetros usa, o escopo (face: uma janela por face; cube: um mundo só visto por todas as faces)
  // e se o plano próximo recorta na face (clip).
  var PRESETS = {
    'infinite-room': { name: 'Infinite Room', scope: 'face', clip: true, uses: ['depth', 'travel', 'flow', 'spacing', 'thick', 'glow', 'light', 'camx', 'camy', 'camz'], over: { depth: 160, spacing: 16 }, desc: 'Sala que continua pra sempre atrás da face, com molduras de luz.' },
    'infinite-tunnel': { name: 'Infinite Tunnel', scope: 'face', clip: true, uses: ['depth', 'travel', 'flow', 'spacing', 'thick', 'glow', 'light', 'twist', 'sides', 'camx', 'camy', 'camz'], over: { depth: 220, spacing: 12, sides: 4, flow: 36 }, desc: 'Túnel de anéis vindo na direção do público, com torção opcional.' },
    'opening-cube': { name: 'Opening Cube', scope: 'cube', clip: true, uses: ['open', 'glow', 'light', 'spin', 'orot', 'camx', 'camy', 'camz'], over: {}, desc: 'Um cubo interno abre as portas e revela um núcleo de luz.' },
    'breaking-surface': { name: 'Breaking Surface', scope: 'face', clip: false, uses: ['brk', 'brkdir', 'depth', 'travel', 'flow', 'glow', 'light', 'camx', 'camy', 'camz'], over: { depth: 120, flow: 18 }, desc: 'A superfície racha e os cacos voam, mostrando uma sala atrás.' },
    'object-inside': { name: 'Object Inside', scope: 'cube', clip: true, uses: ['ox', 'oy', 'oz', 'osize', 'orot', 'spin', 'glow', 'light', 'camx', 'camy', 'camz'], over: {}, desc: 'Um objeto flutua dentro do cubo e é visto por todas as faces.' },
    'object-emerging': { name: 'Object Emerging', scope: 'face', clip: false, uses: ['ox', 'oy', 'oz', 'osize', 'orot', 'spin', 'depth', 'glow', 'light', 'camx', 'camy', 'camz'], over: { oz: 0, depth: 60 }, desc: 'Um objeto sai da face na direção do público.' },
    'room-builder': { name: 'Sala (montar paredes)', scope: 'face', clip: true, uses: ['depth', 'travel', 'flow', 'spacing', 'thick', 'glow', 'light', 'camx', 'camy', 'camz'], over: { depth: 80, spacing: 12, flow: 6 }, desc: 'Você liga cada parede (fundo, lados, chão, teto), empurra para o fundo e coloca GIF ou imagem em cada uma.' },
    'mechanical-interior': { name: 'Mechanical Interior', scope: 'cube', clip: true, uses: ['spin', 'orot', 'glow', 'light', 'camx', 'camy', 'camz'], over: { spin: 30 }, desc: 'Engrenagens e pistões girando dentro do cubo.' }
  };
  var PRESET_ORDER = ['infinite-room', 'infinite-tunnel', 'opening-cube', 'breaking-surface', 'object-inside', 'object-emerging', 'mechanical-interior', 'room-builder'];

  function defaultParams(preset) {
    var p = {}, pr = PRESETS[preset] || PRESETS['infinite-room'];
    Object.keys(PARAMS).forEach(function (k) { p[k] = PARAMS[k].def; });
    Object.keys(pr.over || {}).forEach(function (k) { p[k] = pr.over[k]; });
    return p;
  }
  function isColor(c) { return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c); }

  // Sala montável (preset room-builder). Coordenadas no quadro da face: X direita, Y cima, Z pro público; o interior é Z negativo.
  // Paredes: fundo (profundidade = parâmetro depth, que aceita keyframe), esquerda, direita, chão e teto. "d" é o quanto a parede
  // entra pra dentro a partir da borda da face, em polegadas. Mídia: só imagem e GIF (referência por caminho/endereço, nunca código).
  var ROOM_WALLS = ['back', 'left', 'right', 'floor', 'ceiling'];
  var WALL_LABEL = { back: 'Fundo', left: 'Parede esquerda', right: 'Parede direita', floor: 'Chão', ceiling: 'Teto' };
  var MAX_SPRITES = 12;
  // Sala contínua na quina: duas faces vizinhas (na ordem do anel frente, direita, trás, esquerda) mostram UMA sala só, vista do mesmo ponto.
  var JOINS = { 'front+right': { a: 'front', b: 'right', ang: 0 }, 'right+back': { a: 'right', b: 'back', ang: 90 }, 'back+left': { a: 'back', b: 'left', ang: 180 }, 'left+front': { a: 'left', b: 'front', ang: 270 } };
  function defaultRoom() {
    var w = {};
    ROOM_WALLS.forEach(function (k) { w[k] = { on: k !== 'ceiling', d: 0, color: '#1a1d2e', media: null }; });
    return { walls: w, sprites: [], join: null };
  }
  function cleanMedia(m) {
    if (!m || typeof m !== 'object') return null;
    var path = typeof m.path === 'string' && m.path.length <= 600 && !/[\u0000-\u001f]/.test(m.path) ? m.path : '';
    var src = typeof m.src === 'string' && m.src.length <= 2000 && /^(file:|https?:|blob:|data:image\/)/i.test(m.src) ? m.src : '';
    if (!path && !src) return null;
    var out = { name: typeof m.name === 'string' ? m.name.slice(0, 60) : '' };
    if (path) out.path = path;
    if (src) out.src = src;
    return out;
  }
  function cleanRoom(r, warnings) {
    var d = defaultRoom(); if (!r || typeof r !== 'object') return d;
    var w = r.walls && typeof r.walls === 'object' ? r.walls : {};
    ROOM_WALLS.forEach(function (k) {
      var x = w[k]; if (!x || typeof x !== 'object') return;
      d.walls[k] = { on: x.on == null ? d.walls[k].on : !!x.on, d: clamp(num(x.d, 0), 0, 14), color: isColor(x.color) ? x.color : '#1a1d2e', media: cleanMedia(x.media) };
    });
    var seen = {};
    (Array.isArray(r.sprites) ? r.sprites : []).slice(0, MAX_SPRITES).forEach(function (q, i) {
      if (!q || typeof q !== 'object') return;
      var id = typeof q.id === 'string' && /^[\w-]{1,30}$/.test(q.id) && !seen[q.id] ? q.id : 'sp' + i;
      seen[id] = 1;
      d.sprites.push({ id: id, name: typeof q.name === 'string' ? q.name.slice(0, 40) : 'Objeto', x: clamp(num(q.x, 0), -60, 60), y: clamp(num(q.y, 0), -60, 60), z: clamp(num(q.z, -20), -600, 60), size: clamp(num(q.size, 6), 0.5, 80), media: cleanMedia(q.media), fx: q.fx === 'float' ? 'float' : '' });
    });
    if (Array.isArray(r.sprites) && r.sprites.length > MAX_SPRITES) warnings && warnings.push('Máximo de ' + MAX_SPRITES + ' objetos por sala.');
    d.join = typeof r.join === 'string' && JOINS[r.join] ? r.join : null;
    return d;
  }

  function defaultIllusion(preset) {
    preset = PRESETS[preset] ? preset : 'infinite-room';
    var il = {
      v: VERSION, id: 'il' + Math.random().toString(36).slice(2, 9), preset: preset, name: PRESETS[preset].name,
      target: { cube: 'A', faces: ['front'] },
      params: defaultParams(preset),
      style: { color1: '#2fd8ff', color2: '#ff4fa3', obj: 'cube', material: 'matte', wall: 'grid' },
      light: { ambient: 0.35, key: 1, keyDir: [-0.4, 0.8, 0.6], keyColor: '#ffffff', core: 0.6, coreColor: '#66ccff' },
      camera: { view: 'audience', fov: 35, assist: true, yaw: 0, tilt: 0 },
      quality: 'medium'
    };
    if (preset === 'room-builder') il.room = defaultRoom();
    return il;
  }

  // Validação com lista fechada. Aceita qualquer JSON, devolve {ok, value, errors, warnings}. Chaves desconhecidas são descartadas,
  // números são limitados à faixa, textos só passam se forem de listas conhecidas. Não existe campo que vire código.
  // Migração versionada. v1 é a atual; sem v é tratado como v1. Dados de versão MAIS NOVA são lidos no que se entende e avisam.
  // Para criar a v2: some um passo em MIGRATIONS[1] (v1 -> v2), que recebe e devolve o objeto.
  var MIGRATIONS = {};
  function migrateIllusion(x, warnings) {
    var v = Number(x.v);
    if (!isFinite(v) || v < 1) v = 1;
    if (v > VERSION) { if (warnings) warnings.push('Esta ilusão foi criada por uma versão mais nova do LenziMap (v' + v + '). Li só o que esta versão entende.'); return x; }
    while (v < VERSION && MIGRATIONS[v]) { x = MIGRATIONS[v](x); v++; }
    return x;
  }
  function stageVersionWarning(s) {
    var v = Number(s && s.v);
    return isFinite(v) && v > STAGE_VERSION ? 'O palco deste projeto foi salvo por uma versão mais nova (v' + v + '). Li só o que esta versão entende.' : '';
  }
  function validate(x, stage) {
    var errors = [], warnings = [];
    if (!x || typeof x !== 'object' || Array.isArray(x)) return { ok: false, value: null, errors: ['A ilusão precisa ser um objeto.'], warnings: warnings };
    if (!PRESETS[x.preset]) return { ok: false, value: null, errors: ['Preset desconhecido: ' + String(x.preset).slice(0, 40) + '. Use um de: ' + PRESET_ORDER.join(', ') + '.'], warnings: warnings };
    x = migrateIllusion(x, warnings);
    var d = defaultIllusion(x.preset), out = defaultIllusion(x.preset);
    out.id = typeof x.id === 'string' && /^[\w-]{1,40}$/.test(x.id) ? x.id : d.id;
    out.name = typeof x.name === 'string' && x.name.trim() ? x.name.trim().slice(0, 60) : d.name;
    // alvo
    var tg = x.target || {};
    var cid = typeof tg.cube === 'string' ? tg.cube : 'A';
    if (stage && !cubeById(stage, cid)) { warnings.push('Cubo "' + String(cid).slice(0, 12) + '" não existe no palco, usei o primeiro.'); cid = stage.cubes[0].id; }
    out.target.cube = cid;
    var fl = Array.isArray(tg.faces) ? tg.faces.filter(function (f) { return FACES.indexOf(f) >= 0; }) : ['front'];
    out.target.faces = fl.filter(function (f, i) { return fl.indexOf(f) === i; });
    if (!out.target.faces.length) out.target.faces = ['front'];
    // parâmetros
    var pin = x.params && typeof x.params === 'object' ? x.params : {};
    Object.keys(pin).forEach(function (k) {
      if (!PARAMS[k]) { warnings.push('Parâmetro desconhecido ignorado: ' + String(k).slice(0, 30)); return; }
      var v = +pin[k];
      if (!isFinite(v)) { warnings.push('Parâmetro ' + k + ' não é número, usei o padrão.'); return; }
      var P = PARAMS[k], c = clamp(v, P.min, P.max);
      if (c !== v) warnings.push('Parâmetro ' + k + ' limitado à faixa ' + P.min + ' a ' + P.max + '.');
      out.params[k] = k === 'sides' || k === 'brkdir' ? Math.round(c) : c;
    });
    if (out.params.brkdir === 0) out.params.brkdir = -1;
    // estilo
    var st = x.style || {};
    if (st.color1 != null) { if (isColor(st.color1)) out.style.color1 = st.color1; else warnings.push('color1 inválida, usei a padrão.'); }
    if (st.color2 != null) { if (isColor(st.color2)) out.style.color2 = st.color2; else warnings.push('color2 inválida, usei a padrão.'); }
    if (st.obj != null) { if (OBJECTS.indexOf(st.obj) >= 0) out.style.obj = st.obj; else warnings.push('Objeto desconhecido, usei cubo.'); }
    if (st.material != null) { if (MATERIALS.indexOf(st.material) >= 0) out.style.material = st.material; else warnings.push('Material desconhecido, usei matte.'); }
    if (st.wall != null) { if (WALLS.indexOf(st.wall) >= 0) out.style.wall = st.wall; else warnings.push('Parede desconhecida, usei grid.'); }
    // luz
    var lt = x.light || {};
    out.light.ambient = clamp(num(lt.ambient, d.light.ambient), 0, 2);
    out.light.key = clamp(num(lt.key, d.light.key), 0, 3);
    out.light.core = clamp(num(lt.core, d.light.core), 0, 3);
    if (Array.isArray(lt.keyDir) && lt.keyDir.length === 3) { var kd = [num(lt.keyDir[0], 0), num(lt.keyDir[1], 1), num(lt.keyDir[2], 0)]; out.light.keyDir = len(kd) > 1e-6 ? norm(kd) : d.light.keyDir; }
    if (isColor(lt.keyColor)) out.light.keyColor = lt.keyColor;
    if (isColor(lt.coreColor)) out.light.coreColor = lt.coreColor;
    // câmera e qualidade
    var cm = x.camera || {};
    out.camera.view = CAM_VIEWS.indexOf(cm.view) >= 0 ? cm.view : 'audience';
    out.camera.fov = clamp(num(cm.fov, 35), 10, 100);
    out.camera.assist = cm.assist !== false;
    out.camera.yaw = clamp(num(cm.yaw, 0), -80, 80); out.camera.tilt = clamp(num(cm.tilt, 0), -60, 60);
    out.quality = QUALITIES.indexOf(x.quality) >= 0 ? x.quality : 'medium';
    if (out.preset === 'room-builder') out.room = cleanRoom(x.room, warnings);
    return { ok: true, value: out, errors: errors, warnings: warnings };
  }

  // Keyframes pedidos de fora (IA): lista de {param, t, v, i}. Só parâmetros kf, tempo dentro da duração, valor dentro da faixa.
  function validateKeys(list, duration) {
    var out = [], warnings = [];
    if (!Array.isArray(list)) return { keys: out, warnings: warnings };
    list.slice(0, 200).forEach(function (k) {
      if (!k || !PARAMS[k.param] || !PARAMS[k.param].kf) { warnings.push('Keyframe ignorado: parâmetro ' + String(k && k.param).slice(0, 30) + ' não é animável.'); return; }
      var t = num(k.t, NaN), v = num(k.v, NaN);
      if (!isFinite(t) || !isFinite(v)) { warnings.push('Keyframe ignorado: tempo ou valor inválido.'); return; }
      var P = PARAMS[k.param];
      out.push({ param: k.param, t: clamp(t, 0, duration || 3600), v: clamp(v, P.min, P.max), i: ['linear', 'hold', 'ease', 'easein', 'easeout'].indexOf(k.i) >= 0 ? k.i : 'ease' });
    });
    return { keys: out, warnings: warnings };
  }

  // Parâmetros efetivos no tempo: base da ilusão + valores animados (ill) vindos do avaliador da timeline.
  function effective(il, ill) {
    var p = {}, k;
    for (k in il.params) p[k] = il.params[k];
    if (ill) for (k in ill) if (PARAMS[k] && isFinite(ill[k])) p[k] = clamp(ill[k], PARAMS[k].min, PARAMS[k].max);
    return p;
  }

  // ---------- construtores de cena ----------
  function hex(c) { var m = /^#?([0-9a-f]{6})$/i.exec(c || ''), n = m ? parseInt(m[1], 16) : 0xffffff; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
  function shade(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
  function prim(k, p, r, s, c, o) {
    o = o || {};
    return { k: k, p: p, r: r || [0, 0, 0], s: s || [1, 1, 1], c: c, e: o.e == null ? 0 : o.e, a: o.a == null ? 1 : o.a, add: !!o.add, wire: !!o.wire, sh: o.sh || 0, n: o.n || 0, ratio: o.ratio || 0 };
  }
  // material da ilusão vira opções da primitiva
  function matOpts(style, base) {
    var m = style.material, o = { e: base && base.e || 0, a: 1, sh: 0, wire: false, add: false };
    if (m === 'metal') o.sh = 1.2;
    else if (m === 'glass') { o.a = 0.35; o.sh = 1.5; }
    else if (m === 'neon') { o.e = 1; }
    else if (m === 'wire') { o.wire = true; o.e = 1; }
    return o;
  }

  function barsAround(out, hx, hy, z, th, col, e, add, a) {
    // moldura retangular de 4 barras centrada em (0,0,z)
    out.push(prim('box', [0, hy - th / 2, z], null, [2 * hx, th, th], col, { e: e, add: add, a: a }));
    out.push(prim('box', [0, -hy + th / 2, z], null, [2 * hx, th, th], col, { e: e, add: add, a: a }));
    out.push(prim('box', [-hx + th / 2, 0, z], null, [th, 2 * hy - 2 * th, th], col, { e: e, add: add, a: a }));
    out.push(prim('box', [hx - th / 2, 0, z], null, [th, 2 * hy - 2 * th, th], col, { e: e, add: add, a: a }));
  }
  function hash(i, j, seed) { var x = Math.sin(i * 127.1 + j * 311.7 + (seed || 0) * 74.7) * 43758.5453; return x - Math.floor(x); }

  function buildRoom(P, t, x, out) {
    var h = x.h, D = P.depth, sp = P.spacing, th = P.thick, tr = P.travel + t * P.flow, c1 = x.c1, c2 = x.c2;
    var off = ((tr % sp) + sp) % sp, base = Math.floor(tr / sp), n = Math.ceil(D / sp) + 2, i;
    var wallC = x.wall === 'plain' ? [0.08, 0.09, 0.12] : [0.10, 0.11, 0.16];
    for (i = 0; i < n; i++) {
      var z0 = -i * sp + off, z1 = z0 - sp;
      if (z0 > 0) z0 = 0;
      if (z1 < -D) z1 = -D;
      if (z1 >= z0) continue;
      var ln = z0 - z1, zc = (z0 + z1) / 2, alt = ((i - base) & 1) ? 1 : 0.55;
      if (x.wall === 'plain') alt = 1;
      var col = shade(wallC, alt);
      out.push(prim('quad', [-h, 0, zc], [0, 90, 0], [ln, 2 * h, 1], col, { e: 0.0 }));
      out.push(prim('quad', [h, 0, zc], [0, -90, 0], [ln, 2 * h, 1], col, { e: 0.0 }));
      out.push(prim('quad', [0, -h, zc], [-90, 0, 0], [2 * h, ln, 1], col, { e: 0.0 }));
      out.push(prim('quad', [0, h, zc], [90, 0, 0], [2 * h, ln, 1], col, { e: 0.0 }));
      if (x.wall === 'grid') {
        // linhas guia de cada parede ao longo da profundidade
        var gl = shade(c1, 0.35);
        for (var g = -1; g <= 1; g += 2) {
          out.push(prim('box', [g * h * 0.98, 0, zc], null, [th * 0.35, th * 0.35, ln], gl, { e: 1 }));
          out.push(prim('box', [0, g * h * 0.98, zc], null, [th * 0.35, th * 0.35, ln], gl, { e: 1 }));
        }
      }
    }
    out.push(prim('quad', [0, 0, -D], null, [2 * h, 2 * h, 1], [0.02, 0.03, 0.05], { e: 0 }));
    // núcleo de luz no fundo
    out.push(prim('quad', [0, 0, -D + 0.05], null, [h * 1.2, h * 1.2, 1], shade(c2, 0.9 * Math.min(1, P.glow)), { e: 1, add: true, a: 0.5 }));
    // molduras
    for (i = 0; i < n; i++) {
      var z = -i * sp + off;
      if (z > 0.001 || z < -D) continue;
      var cc = ((i - base) & 1) ? c1 : c2;
      barsAround(out, h, h, z, th, cc, 1, false, 1);
      if (P.glow > 0.01) barsAround(out, h + th * 0.6, h + th * 0.6, z, th * 2.2, cc, 1, true, 0.22 * Math.min(2, P.glow));
    }
  }

  function buildTunnel(P, t, x, out) {
    var h = x.h, D = P.depth, sp = P.spacing, th = P.thick, tr = P.travel + t * P.flow, c1 = x.c1, c2 = x.c2, N = Math.round(P.sides);
    var off = ((tr % sp) + sp) % sp, base = Math.floor(tr / sp), n = Math.ceil(D / sp) + 2, i, k;
    for (i = 0; i < n; i++) {
      var z = -i * sp + off;
      if (z > 0.001 || z < -D) continue;
      var idx = i - base, cc = (idx & 1) ? c1 : c2, ang = idx * P.twist;
      if (N === 4) {
        // túnel quadrado: acompanha a janela exatamente
        out.push.apply(out, rotRing(function (o) { barsAround(o, h, h, 0, th, cc, 1, false, 1); if (P.glow > 0.01) barsAround(o, h + th * 0.6, h + th * 0.6, 0, th * 2.2, cc, 1, true, 0.2 * Math.min(2, P.glow)); }, z, ang));
      } else {
        var R = h, step = 360 / N, side = 2 * R * Math.sin(Math.PI / N);
        for (k = 0; k < N; k++) {
          var a0 = (k * step + ang) * D2R, a1 = ((k + 1) * step + ang) * D2R;
          var mx = (Math.cos(a0) + Math.cos(a1)) / 2 * R, my = (Math.sin(a0) + Math.sin(a1)) / 2 * R;
          var rot = Math.atan2(Math.sin(a1) - Math.sin(a0), Math.cos(a1) - Math.cos(a0)) / D2R;
          out.push(prim('box', [mx, my, z], [0, 0, rot], [side * 1.02, th, th], cc, { e: 1 }));
          if (P.glow > 0.01) out.push(prim('box', [mx, my, z], [0, 0, rot], [side * 1.02, th * 2.4, th * 2.4], cc, { e: 1, add: true, a: 0.18 * Math.min(2, P.glow) }));
        }
      }
    }
    out.push(prim('quad', [0, 0, -D], null, [2 * h, 2 * h, 1], shade(c2, 0.9 * Math.min(1, P.glow)), { e: 1, add: true, a: 0.6 }));
  }
  function rotRing(fn, z, angDeg) {
    var tmp = [];
    fn(tmp);
    return tmp.map(function (p) {
      var q = rotAboutZ(p, angDeg);
      q.p = [q.p[0], q.p[1], z + (p.p[2] || 0)];
      return q;
    });
  }
  function rotAboutZ(p, deg) {
    var a = deg * D2R, c = Math.cos(a), s = Math.sin(a), q = {};
    for (var k in p) q[k] = p[k];
    q.p = [p.p[0] * c - p.p[1] * s, p.p[0] * s + p.p[1] * c, p.p[2]];
    q.r = [p.r[0], p.r[1], p.r[2] + deg];
    return q;
  }

  function objPrim(kind, p, r, size, col, st, P) {
    var o = matOpts(st, { e: 0 });
    var s = [size, size, size];
    if (kind === 'sphere') return prim('sphere', p, r, s, col, o);
    if (kind === 'torus') return prim('torus', p, r, s, col, { e: o.e, a: o.a, sh: o.sh, wire: o.wire, ratio: 0.28 });
    if (kind === 'gear') return prim('gear', p, r, [size, size, size * 0.35], col, { e: o.e, a: o.a, sh: o.sh, wire: o.wire, n: 12 });
    return prim('box', p, r, [size * 1.4, size * 1.4, size * 1.4], col, o);
  }

  function buildOpening(P, t, x, out) {
    var h = x.h, ib = h * 0.62, zf = ib - h * 0.1, th = Math.max(0.3, h * 0.05), a = P.open * 115;
    var c1 = x.c1, c2 = x.c2, body = shade(c1, 0.35), spin = P.orot;
    // corpo do cubo interno (5 faces) centrado um pouco atrás do centro
    var cz = -h * 0.1;
    out.push(prim('box', [0, 0, cz - ib + th / 2], null, [2 * ib, 2 * ib, th], body, { e: 0 }));
    out.push(prim('box', [-ib + th / 2, 0, cz], null, [th, 2 * ib, 2 * ib], body, { e: 0 }));
    out.push(prim('box', [ib - th / 2, 0, cz], null, [th, 2 * ib, 2 * ib], body, { e: 0 }));
    out.push(prim('box', [0, ib - th / 2, cz], null, [2 * ib, th, 2 * ib], body, { e: 0 }));
    out.push(prim('box', [0, -ib + th / 2, cz], null, [2 * ib, th, 2 * ib], body, { e: 0 }));
    // arestas brilhantes
    out.push(prim('box', [0, 0, cz], null, [2 * ib + 0.1, 2 * ib + 0.1, 2 * ib + 0.1], c1, { e: 1, wire: true }));
    // núcleo
    var pulse = 0.8 + 0.2 * Math.sin(t * 3);
    out.push(prim('sphere', [0, 0, cz], [0, spin, 0], [ib * 0.45, ib * 0.45, ib * 0.45], c2, { e: 1 }));
    if (P.glow > 0.01) out.push(prim('sphere', [0, 0, cz], null, [ib * 0.9 * pulse, ib * 0.9 * pulse, ib * 0.9 * pulse], c2, { e: 1, add: true, a: 0.18 * Math.min(2, P.glow) * Math.min(1, 0.25 + P.open) }));
    // duas portas na frente, abrindo pra fora (dobradiça na borda de fora de cada porta)
    var zfront = cz + ib;
    [-1, 1].forEach(function (sd) {
      var th0 = sd * a * D2R, dx = -sd * ib / 2;
      out.push(prim('box', [sd * ib + dx * Math.cos(th0), 0, zfront - dx * Math.sin(th0)], [0, sd * a, 0], [ib, 2 * ib, th], shade(c1, 0.6), { e: 0.15 }));
    });
  }

  function buildBreaking(P, t, x, out) {
    var h = x.h, N = 6, tile = 2 * h / N, seed = 7, i, j, b = clamp(P.brk, 0, 1), dir = P.brkdir >= 0 ? 1 : -1;
    // sala curta atrás
    var Pr = {}, k;
    for (k in P) Pr[k] = P[k];
    Pr.spacing = 18; Pr.thick = Math.max(0.5, P.thick || 0.8);
    var inner = [];
    buildRoom(Pr, t, x, inner);
    inner.forEach(function (q) { out.push(q); });
    // cacos: cada um sai da sua posição com velocidade e giro próprios
    for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
      var cx = (i + 0.5) * tile - h, cy = (j + 0.5) * tile - h, r1 = hash(i, j, seed), r2 = hash(j, i, seed + 3), r3 = hash(i + 9, j + 4, seed);
      var e = clamp((b - r1 * 0.3) / 0.7, 0, 1), ee = e * e * (3 - 2 * e);
      var out2 = Math.hypot(cx, cy) || 1;
      var px = cx + (cx / out2) * ee * h * (0.8 + r2), py = cy + (cy / out2) * ee * h * (0.8 + r2) - ee * ee * h * 0.6;
      var pz = dir * ee * h * (0.5 + 1.6 * r3);
      var rot = [ee * (r1 - 0.5) * 540, ee * (r2 - 0.5) * 540, ee * (r3 - 0.5) * 540];
      var sc = 1 - ee * 0.35, gridc = ((i + j) & 1) ? shade(x.c1, 0.55) : shade(x.c1, 0.4);
      out.push(prim('box', [px, py, pz], rot, [tile * sc, tile * sc, Math.max(0.3, x.h * 0.04)], gridc, { e: 0.1 }));
      out.push(prim('box', [px, py, pz + 0.01], rot, [tile * sc + 0.1, tile * sc + 0.1, Math.max(0.3, x.h * 0.04) + 0.1], x.c2, { e: 1, wire: true }));
    }
  }

  function buildObject(P, t, x, out, emerging) {
    var h = x.h, size = h * 0.45 * P.osize, rot = P.orot + t * P.spin;
    var c1 = x.c1, c2 = x.c2, st = x.style;
    var pos = emerging ? [P.ox, P.oy, -h * 0.6 + P.oz + h * 0.0] : [P.ox, P.oy, P.oz];
    // referência de profundidade: caixa de luz do volume e chão
    if (!emerging) {
      out.push(prim('box', [0, 0, 0], null, [2 * h * 0.98, 2 * h * 0.98, 2 * h * 0.98], shade(c1, 0.4), { e: 1, wire: true }));
      out.push(prim('quad', [0, -h * 0.98, 0], [-90, 0, 0], [2 * h * 0.98, 2 * h * 0.98, 1], [0.05, 0.06, 0.1], { e: 0 }));
    } else {
      out.push(prim('quad', [0, 0, -P.depth], null, [2 * h, 2 * h, 1], [0.03, 0.04, 0.07], { e: 0 }));
      out.push(prim('quad', [0, -h, -P.depth / 2], [-90, 0, 0], [2 * h, P.depth, 1], [0.05, 0.06, 0.1], { e: 0 }));
      barsAround(out, h, h, 0, Math.max(0.3, h * 0.04), c1, 1, false, 1);
    }
    out.push(objPrim(x.style.obj, pos, [rot * 0.6, rot, rot * 0.3], size, shade(c2, 0.9), st, P));
    if (P.glow > 0.01) out.push(prim('sphere', pos, null, [size * 1.6, size * 1.6, size * 1.6], c2, { e: 1, add: true, a: 0.10 * Math.min(2, P.glow) }));
  }

  function buildMechanical(P, t, x, out) {
    var h = x.h, c1 = x.c1, c2 = x.c2, mod = h * 0.07, w = P.spin * t + P.orot, z = -h * 0.1;
    var n1 = 14, n2 = 9, r1 = n1 * mod / 2, r2 = n2 * mod / 2, d = r1 + r2;
    var g1 = [-h * 0.25, h * 0.2, z], g2 = [g1[0] + d * 0.9, g1[1] - d * 0.43, z], g3 = [g1[0] - r1 * 0.2, g1[1] - r1 - r2 * 0.95, z];
    var metal = { e: 0, sh: 1.2 };
    function gear(pos, n, rp, ang, col) { out.push(prim('gear', pos, [0, 0, ang], [rp + mod, rp + mod, h * 0.12], col, { e: 0, sh: 1.2, n: n })); out.push(prim('gear', pos, [0, 0, ang], [rp + mod + 0.05, rp + mod + 0.05, h * 0.12 + 0.05], c1, { e: 1, wire: true, n: n })); }
    gear(g1, n1, r1, w, shade(c1, 0.55));
    gear(g2, n2, r2, -w * n1 / n2 + 180 / n2, shade(c2, 0.55));
    gear(g3, n2, r2, -w * n1 / n2 + 180 / n2 + 10, shade(c1, 0.45));
    // pistões
    for (var i = 0; i < 2; i++) {
      var px = h * (0.35 + 0.3 * i), ph = Math.sin((w * D2R) + i * Math.PI) * h * 0.18;
      out.push(prim('cyl', [px, -h * 0.35, z], null, [h * 0.06, h * 0.7, h * 0.06], shade(c1, 0.3), { e: 0, sh: 1 }));
      out.push(prim('cyl', [px, -h * 0.05 + ph, z], null, [h * 0.1, h * 0.28, h * 0.1], shade(c2, 0.75), { e: 0, sh: 1.2 }));
    }
    // tubos nas arestas de baixo e núcleo quente
    out.push(prim('cyl', [0, -h * 0.9, z], [0, 0, 90], [h * 0.05, h * 1.8, h * 0.05], shade(c1, 0.4), { e: 0.2 }));
    out.push(prim('sphere', [h * 0.1, h * 0.05, z - h * 0.4], null, [h * 0.14, h * 0.14, h * 0.14], c2, { e: 1 }));
    if (P.glow > 0.01) out.push(prim('sphere', [h * 0.1, h * 0.05, z - h * 0.4], null, [h * 0.5, h * 0.5, h * 0.5], c2, { e: 1, add: true, a: 0.12 * Math.min(2, P.glow) }));
    out.push(prim('box', [0, 0, 0], null, [2 * h * 0.98, 2 * h * 0.98, 2 * h * 0.98], shade(c1, 0.35), { e: 1, wire: true }));
  }

  // Constrói a lista de primitivas de uma ilusão no quadro local (face ou cubo). Determinístico: mesmos (il, ill, t) dão a mesma lista.
  // Sala montável. Retorna também "quads": planos com mídia (parede ou objeto) que o motor GL desenha com textura.
  function buildBuilder(il, P, t, x, out, quads) {
    var R = il.room || defaultRoom(), h = x.h, D = P.depth, sp = P.spacing, th = P.thick, c1 = x.c1, c2 = x.c2;
    var tr = P.travel + t * P.flow, off = ((tr % sp) + sp) % sp, base = Math.floor(tr / sp), n = Math.ceil(D / sp) + 2, i;
    var W = R.walls;
    function wallCol(k, alt) { var c = hex(W[k].color); return shade(c, alt); }
    function lines(k, mk) {
      if (x.wall !== 'grid' || W[k].media) return;
      var gl = shade(c1, 0.35);
      for (i = 0; i < n; i++) { var z = -i * sp + off; if (z > 0.001 || z < -D) continue; mk(z, gl); }
    }
    var inL = W.left.on ? W.left.d : 0, inR = W.right.on ? W.right.d : 0, inF = W.floor.on ? W.floor.d : 0, inC = W.ceiling.on ? W.ceiling.d : 0;
    if (W.back.on) {
      if (W.back.media) quads.push({ p: [0, 0, -D], r: [0, 0, 0], s: [2 * h, 2 * h, 1], m: W.back.media, solid: true, a: 1, id: 'wall:back' });
      else out.push(prim('quad', [0, 0, -D], null, [2 * h, 2 * h, 1], wallCol('back', 1), { e: 0 }));
      out.push(prim('quad', [0, 0, -D + 0.05], null, [h * 1.2, h * 1.2, 1], shade(c2, 0.5 * Math.min(1, P.glow)), { e: 1, add: true, a: 0.35 }));
    }
    function side(k, xs, rot, flipU) {
      if (!W[k].on) return;
      var xp = xs * (h - W[k].d);
      if (W[k].media) quads.push({ p: [xp, 0, -D / 2], r: [0, rot, 0], s: [D, 2 * h, 1], m: W[k].media, solid: true, a: 1, flipU: flipU, id: 'wall:' + k });
      else out.push(prim('quad', [xp, 0, -D / 2], [0, rot, 0], [D, 2 * h, 1], wallCol(k, 0.85), { e: 0 }));
      lines(k, function (z, gl) { out.push(prim('box', [xp - xs * th * 0.1, 0, z], null, [th * 0.35, 2 * h, th * 0.35], gl, { e: 1 })); });
    }
    side('left', -1, 90, false); side('right', 1, -90, true);
    function flat(k, ys, rot, flipV) {
      if (!W[k].on) return;
      var yp = ys * (h - W[k].d);
      if (W[k].media) quads.push({ p: [0, yp, -D / 2], r: [rot, 0, 0], s: [2 * h, D, 1], m: W[k].media, solid: true, a: 1, flipV: flipV, id: 'wall:' + k });
      else out.push(prim('quad', [0, yp, -D / 2], [rot, 0, 0], [2 * h, D, 1], wallCol(k, 0.7), { e: 0 }));
      lines(k, function (z, gl) { out.push(prim('box', [0, yp - ys * th * 0.1, z], null, [2 * h, th * 0.35, th * 0.35], gl, { e: 1 })); });
    }
    flat('floor', -1, -90, false); flat('ceiling', 1, 90, true);
    // molduras de luz que correm pela sala
    for (i = 0; i < n; i++) {
      var z = -i * sp + off; if (z > 0.001 || z < -D) continue;
      var cc = ((i - base) & 1) ? c1 : c2;
      barsAround(out, h, h, z, th, cc, 1, false, 0.9);
    }
    // objetos com mídia (GIF, imagem): planos virados pra frente da face
    (R.sprites || []).forEach(function (q, k) {
      if (!q.media) { out.push(prim('sphere', [q.x, q.y, q.z], null, [q.size * 0.5, q.size * 0.5, q.size * 0.5], shade(c2, 0.9), { e: 0.6 })); return; }
      var bob = q.fx === 'float' ? Math.sin(t * 1.6 + k) * q.size * 0.06 : 0;
      quads.push({ p: [q.x, q.y + bob, q.z], r: [0, 0, 0], s: [q.size, q.size, 1], m: q.media, solid: false, a: 1, sprite: true, id: 'sp:' + q.id });
    });
  }

  // Sala contínua na quina. Coordenadas do par (frente + direita = ângulo 0): o cubo fica na origem, as janelas são os planos z = +h e x = +h
  // e a sala continua pra dentro (-x, -z) até a profundidade D. As outras quinas giram essa mesma cena em volta do eixo vertical.
  function buildJoined(il, P, t, x, out, quads) {
    var R = il.room, W = R.walls, h = x.h, D = P.depth, sp = P.spacing, th = P.thick, n = Math.min(60, Math.ceil(D / sp) + 1), k;
    function wallCol(key, alt) { return shade(hex(W[key].color), alt); }
    var gl = shade(x.c1, 0.35), wire = x.wall === 'grid', tt = th * 0.35;
    if (W.back.on) {
      if (W.back.media) quads.push({ p: [h - D / 2, 0, h - D], r: [0, 0, 0], s: [D, 2 * h, 1], m: W.back.media, solid: true, a: 1, id: 'wall:back' });
      else out.push(prim('quad', [h - D / 2, 0, h - D], null, [D, 2 * h, 1], wallCol('back', 1), { e: 0 }));
      if (wire && !W.back.media) for (k = 0; k < n; k++) { var xv = h - k * sp; out.push(prim('box', [xv, 0, h - D + 0.05], null, [tt, 2 * h, tt], gl, { e: 1 })); }
      if (wire && !W.back.media) for (k = 1; k * sp < 2 * h; k++) out.push(prim('box', [h - D / 2, -h + k * sp, h - D + 0.05], null, [D, tt, tt], gl, { e: 1 }));
    }
    if (W.right.on) {
      if (W.right.media) quads.push({ p: [h - D, 0, h - D / 2], r: [0, 90, 0], s: [D, 2 * h, 1], m: W.right.media, solid: true, a: 1, id: 'wall:right' });
      else out.push(prim('quad', [h - D, 0, h - D / 2], [0, 90, 0], [D, 2 * h, 1], wallCol('right', 0.85), { e: 0 }));
      if (wire && !W.right.media) for (k = 0; k < n; k++) { var zv = h - k * sp; out.push(prim('box', [h - D + 0.05, 0, zv], null, [tt, 2 * h, tt], gl, { e: 1 })); }
      if (wire && !W.right.media) for (k = 1; k * sp < 2 * h; k++) out.push(prim('box', [h - D + 0.05, -h + k * sp, h - D / 2], null, [tt, tt, D], gl, { e: 1 }));
    }
    function flat(key, y, rot, flipV, alt) {
      if (!W[key].on) return;
      if (W[key].media) quads.push({ p: [h - D / 2, y, h - D / 2], r: [rot, 0, 0], s: [D, D, 1], m: W[key].media, solid: true, a: 1, flipV: flipV, id: 'wall:' + key });
      else out.push(prim('quad', [h - D / 2, y, h - D / 2], [rot, 0, 0], [D, D, 1], wallCol(key, alt), { e: 0 }));
      if (wire && !W[key].media) for (k = 0; k < n; k++) {
        out.push(prim('box', [h - D / 2, y, h - k * sp], null, [D, tt, tt], gl, { e: 1 }));
        out.push(prim('box', [h - k * sp, y, h - D / 2], null, [tt, tt, D], gl, { e: 1 }));
      }
    }
    flat('floor', -h, -90, false, 0.7); flat('ceiling', h, 90, true, 0.7);
  }

  function buildScene(il, ill, t, h) {
    var P = effective(il, ill), out = [], quads = [], st = il.style, pr = PRESETS[il.preset];
    var x = { h: h, c1: hex(st.color1), c2: hex(st.color2), wall: st.wall, style: st };
    switch (il.preset) {
      case 'infinite-room': buildRoom(P, t, x, out); break;
      case 'infinite-tunnel': buildTunnel(P, t, x, out); break;
      case 'opening-cube': buildOpening(P, t, x, out); break;
      case 'breaking-surface': buildBreaking(P, t, x, out); break;
      case 'object-inside': buildObject(P, t, x, out, false); break;
      case 'object-emerging': buildObject(P, t, x, out, true); break;
      case 'mechanical-interior': buildMechanical(P, t, x, out); break;
      case 'room-builder': if (il.room && il.room.join && JOINS[il.room.join]) buildJoined(il, P, t, x, out, quads); else buildBuilder(il, P, t, x, out, quads); break;
    }
    return { prims: out, quads: quads, scope: pr.scope, clip: pr.clip, params: P };
  }

  // Resolve tudo que o motor precisa pra desenhar UMA face de UMA ilusão: quadro, olho, câmera e cena.
  // Sem cubo ligado à superfície, cai numa janela de teste de frente (não quebra o projeto, só não é anamórfica).
  function resolveFace(stage, il, ill, surfaceKey, t, forced) {
    var hit = forced && stage ? { cube: cubeById(stage, forced.cube), face: forced.face } : findFace(stage, surfaceKey), P = effective(il, ill), frame, cube, free = false;
    if (hit && !hit.cube) hit = null;
    if (hit) { cube = hit.cube; frame = faceFrame(cube, hit.face); }
    else { free = true; cube = { id: '_', size: 16, pos: [0, 0, 0], rotY: 0, faces: {} }; frame = faceFrame(cube, 'front'); }
    var eye = hit ? stage.viewer.pos.slice() : [0, 0, 16 * 4];
    eye = [eye[0] + P.camx, eye[1] + P.camy, eye[2] + P.camz];
    // Perspectiva manual da face: Girar (esquerda/direita) e Inclinar (cima/baixo) em volta da face, na mesma distância do público.
    var manual = !!(hit && il.camera && (il.camera.yaw || il.camera.tilt));
    if (manual) {
      var yw = (il.camera.yaw || 0) * D2R, tl = (il.camera.tilt || 0) * D2R, rv = [eye[0] - frame.center[0], eye[1] - frame.center[1], eye[2] - frame.center[2]], md = Math.max(40, Math.min(600, Math.sqrt(rv[0] * rv[0] + rv[1] * rv[1] + rv[2] * rv[2]) || 130));
      var dirv = [0, 1, 2].map(function (q) { return Math.cos(tl) * (Math.cos(yw) * frame.n[q] + Math.sin(yw) * frame.r[q]) + Math.sin(tl) * frame.u[q]; });
      eye = [frame.center[0] + dirv[0] * md, frame.center[1] + dirv[1] * md, frame.center[2] + dirv[2] * md];
    }
    // Perspectiva própria de cada face (modo "normal"): a Frente usa o ponto de vista do público. Direita, Esquerda, Trás e Topo são
    // desenhadas como se o público estivesse de frente para elas (mesma distância e mesma altura do olho). Se o público real já enxerga a
    // face com folga (menos de 60 graus de inclinação), usa o ponto de vista real, então nada muda para quem olha de canto.
    if (hit && !manual && hit.face !== 'front' && (!il.camera || il.camera.assist !== false)) {
      var nn = frame.n, rl = [eye[0] - frame.center[0], eye[1] - frame.center[1], eye[2] - frame.center[2]], dl = Math.sqrt(rl[0] * rl[0] + rl[1] * rl[1] + rl[2] * rl[2]) || 1;
      if ((rl[0] * nn[0] + rl[1] * nn[1] + rl[2] * nn[2]) / dl < 0.5) {
        var vv = stage.viewer.pos, hd = Math.max(40, Math.min(400, Math.sqrt((vv[0] - cube.pos[0]) * (vv[0] - cube.pos[0]) + (vv[2] - cube.pos[2]) * (vv[2] - cube.pos[2]))));
        var base = hit.face === 'top' ? [frame.center[0] + nn[0] * hd, frame.center[1] + nn[1] * hd, frame.center[2] + nn[2] * hd] : [cube.pos[0] + nn[0] * hd, vv[1], cube.pos[2] + nn[2] * hd];
        eye = [base[0] + frame.r[0] * P.camx + frame.u[0] * P.camy + nn[0] * P.camz, base[1] + frame.r[1] * P.camx + frame.u[1] * P.camy + nn[1] * P.camz, base[2] + frame.r[2] * P.camx + frame.u[2] * P.camy + nn[2] * P.camz];
      }
    }
    // Sala contínua: as duas faces da quina olham a mesma sala do mesmo ponto (a 45 graus entre as duas faces, na distância e altura do público).
    var jn = hit && il.preset === 'room-builder' && il.room && il.room.join ? JOINS[il.room.join] : null, joined = !!(jn && (hit.face === jn.a || hit.face === jn.b));
    if (joined) {
      var na = FACE_AXES[jn.a].n, nb = FACE_AXES[jn.b].n, cd = rotYv([na[0] + nb[0], 0, na[2] + nb[2]], cube.rotY), cl = Math.sqrt(cd[0] * cd[0] + cd[2] * cd[2]) || 1;
      var vv2 = stage.viewer.pos, hd2 = Math.max(60, Math.min(400, Math.sqrt((vv2[0] - cube.pos[0]) * (vv2[0] - cube.pos[0]) + (vv2[2] - cube.pos[2]) * (vv2[2] - cube.pos[2]))));
      var cdr = rotYv([cd[0] / cl, 0, cd[2] / cl], -((il.camera && il.camera.yaw) || 0)), tlt = ((il.camera && il.camera.tilt) || 0) * D2R;
      eye = [cube.pos[0] + cdr[0] * hd2, vv2[1] + hd2 * Math.tan(tlt), cube.pos[2] + cdr[2] * hd2];
    }
    var pr = PRESETS[il.preset], scope = joined ? 'cube' : pr.scope;
    var local = joined ? { M: m4mul(cubeFrame(cube).M, trs([0, 0, 0], [0, jn.ang, 0], [1, 1, 1])) } : (scope === 'face' ? frame : cubeFrame(cube));
    var scene = buildScene(il, ill, t, frame.half);
    if (joined) scene.scope = 'cube';
    var cam = faceCamera(frame, eye, pr.clip, Math.max(400, P.depth * 3 + 200));
    return { free: free, frame: frame, local: local, eye: eye, cam: cam, scene: scene, cube: cube, face: hit ? hit.face : 'front' };
  }

  var API = {
    VERSION: VERSION, STAGE_VERSION: STAGE_VERSION, FACES: FACES, FACE_LABEL: FACE_LABEL, PARAMS: PARAMS, KF_PARAMS: KF_PARAMS, PRESETS: PRESETS, PRESET_ORDER: PRESET_ORDER,
    OBJECTS: OBJECTS, MATERIALS: MATERIALS, WALLS: WALLS, QUALITIES: QUALITIES, CAM_VIEWS: CAM_VIEWS,
    defaultStage: defaultStage, fixStage: fixStage, viewerFromMeasures: viewerFromMeasures, measuresFromViewer: measuresFromViewer, viewerAdvice: viewerAdvice, cubeById: cubeById, faceFrame: faceFrame, cubeFrame: cubeFrame, visibleFrom: visibleFrom, findFace: findFace,
    faceCamera: faceCamera, projectToFace: projectToFace,
    defaultParams: defaultParams, defaultIllusion: defaultIllusion, validate: validate, migrateIllusion: migrateIllusion, stageVersionWarning: stageVersionWarning, validateKeys: validateKeys, effective: effective,
    buildScene: buildScene, ROOM_WALLS: ROOM_WALLS, JOINS: JOINS, WALL_LABEL: WALL_LABEL, MAX_SPRITES: MAX_SPRITES, defaultRoom: defaultRoom, resolveFace: resolveFace, hex: hex,
    m: { ident: ident, mul: m4mul, pt: m4pt, dir: m4dir, trs: trs, rot: rotM, frustum: frustum, perspective: perspective, lookAt: lookAt },
    v: { add: add, sub: sub, mul: mul, dot: dot, cross: cross, len: len, norm: norm },
    rig: null,
    setRig: function (s) { API.rig = s ? fixStage(s) : null; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.IllusionCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
