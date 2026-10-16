// Testes do núcleo do 3D Illusion Creator (matemática, geometria, validação, cenas). Node puro.
const C = require('../illusion-core.js');
let fails = 0, n = 0;
function ok(c, m) { n++; if (c) console.log('PASS ' + m); else { fails++; console.log('FAIL ' + m); } }
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
const V = C.v, M = C.m;

// palco padrão
const st = C.defaultStage();
ok(st.cubes.length === 4 && st.cubes[0].size === 16 && st.cubes[1].size === 8 && st.cubes[2].size === 8 && st.cubes[3].size === 8, 'palco padrão: A 16 pol, B, C e D 8 pol');
ok(st.v === C.STAGE_VERSION && Array.isArray(st.groups), 'palco versionado (v2, com grupos)');
const v1 = C.fixStage({ v: 1, cubes: [{ id: 'A', size: 16, pos: [0,8,0], faces: { front: 'k1' } }] });
ok(v1.v === 2 && v1.groups.length === 0 && v1.cubes[0].faces.front === 'k1' && v1.cubes[0].faceOrder.length === 5, 'palco v1 migra para v2 sem perder faces');
const g = C.fixStage({ cubes: [{ id: 'A' }, { id: 'B' }], groups: [{ id: 'g1', name: 'X', cubes: ['A', 'Z', 'B'] }, { id: 'g2', name: 'Y', cubes: ['A'] }] });
ok(g.groups[0].cubes.join() === 'A,B' && g.groups[1].cubes.length === 0, 'grupos: cubo inexistente some, cubo só em um grupo');

// quadro das faces
C.FACES.forEach(f => {
  const fr = C.faceFrame(st.cubes[0], f);
  const rxu = V.cross(fr.r, fr.u);
  ok(near(V.len(fr.n), 1) && near(V.len(fr.r), 1) && near(V.len(fr.u), 1), 'face ' + f + ': eixos unitários');
  ok(near(V.dot(fr.n, fr.r), 0) && near(V.dot(fr.n, fr.u), 0) && near(V.dot(fr.r, fr.u), 0), 'face ' + f + ': eixos ortogonais');
  ok(near(rxu[0], fr.n[0]) && near(rxu[1], fr.n[1]) && near(rxu[2], fr.n[2]), 'face ' + f + ': r x u = n (destro, visto de fora)');
  const d = V.sub(fr.center, st.cubes[0].pos);
  ok(near(V.len(d), 8), 'face ' + f + ': centro a meia aresta do centro do cubo');
  ok(near(V.len(V.sub(fr.corners[0], fr.corners[1])), 16) && near(V.len(V.sub(fr.corners[1], fr.corners[2])), 16), 'face ' + f + ': cantos formam quadrado de 16 pol');
});
const cB = st.cubes[1];
ok(near(V.len(V.sub(C.faceFrame(cB, 'front').corners[0], C.faceFrame(cB, 'front').corners[1])), 8), 'cubo B: face de 8 pol');
const rot = JSON.parse(JSON.stringify(st.cubes[0])); rot.rotY = 90;
const fr90 = C.faceFrame(rot, 'front');
ok(near(fr90.n[0], 1) && near(fr90.n[2], 0, 1e-9), 'rotY 90 gira a normal da frente para +X');

// câmera de janela: os 4 cantos da face viram os 4 cantos da tela
const eyes = [[0, 40, 130], [30, 10, 90], [-25, 60, 200]];
eyes.forEach(eye => {
  const fr = C.faceFrame(st.cubes[0], 'front');
  const cam = C.faceCamera(fr, eye, true, 800);
  const MV = M.mul(cam.proj, cam.view);
  const exp = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
  let good = true;
  fr.corners.forEach((p, i) => { const q = M.pt(MV, p), x = q[0] / q[3], y = q[1] / q[3]; if (!near(x, exp[i][0], 1e-6) || !near(y, exp[i][1], 1e-6)) good = false; });
  ok(good, 'câmera de janela (olho ' + eye + '): cantos da face = cantos da tela');
  const q0 = M.pt(MV, fr.corners[0]); ok(near(q0[2] / q0[3], -1, 1e-6), 'plano próximo recorta exatamente na face (clip)');
});
// o ponto de vista tem que estar na frente da face
ok(C.faceCamera(C.faceFrame(st.cubes[0], 'back'), [0, 40, 130], true) === null, 'face de trás não é visível pelo público (câmera nula)');
ok(C.visibleFrom(C.faceFrame(st.cubes[0], 'front'), [0, 40, 130]) && !C.visibleFrom(C.faceFrame(st.cubes[0], 'back'), [0, 40, 130]), 'visibilidade por face');

// anamorfose: ponto virtual atrás da face aparece na posição prevista da textura
{
  const fr = C.faceFrame(st.cubes[0], 'front'), eye = [10, 35, 120];
  const cam = C.faceCamera(fr, eye, false, 800), MV = M.mul(cam.proj, cam.view);
  let good = true, cnt = 0;
  [[0, 8, -20], [5, 12, -60], [-6, 3, -100], [2, 8, -5]].forEach(P => {
    const pf = C.projectToFace(fr, eye, P), q = M.pt(MV, P), x = q[0] / q[3], y = q[1] / q[3];
    cnt++;
    if (!pf || !near(x, 2 * pf.u - 1, 1e-6) || !near(y, 1 - 2 * pf.v, 1e-6)) good = false;
  });
  ok(good && cnt === 4, 'ponto virtual: projeção da câmera = interseção do raio do olho com a face');
  // todos os pontos do mesmo raio caem no mesmo pixel (profundidade não muda a posição na face)
  const ray = V.sub([3, 9, -40], eye), a = C.projectToFace(fr, eye, V.add(eye, V.mul(ray, 1))), b = C.projectToFace(fr, eye, V.add(eye, V.mul(ray, 1.7)));
  ok(near(a.u, b.u) && near(a.v, b.v), 'pontos no mesmo raio do olho caem no mesmo ponto da face');
  const mid = C.projectToFace(fr, [0, 8, 130], [0, 8, -50]);
  ok(near(mid.u, 0.5) && near(mid.v, 0.5), 'olho alinhado: centro da face fica em 0,5 / 0,5');
  ok(C.projectToFace(fr, eye, [0, 8, 500]) === null, 'ponto atrás do olho não projeta na face');
}

// validação
{
  const r0 = C.validate({ preset: 'nao-existe' }); ok(!r0.ok, 'preset desconhecido é recusado');
  ok(!C.validate(null).ok && !C.validate([]).ok && !C.validate('x').ok, 'entrada que não é objeto é recusada');
  const r1 = C.validate({ preset: 'infinite-room', name: '<script>alert(1)</script>', params: { depth: 99999, foo: 1, flow: 'abc', sides: 5.7, evil: 'x=>1' }, style: { color1: 'url(javascript:1)', color2: '#00ff00', obj: 'rm -rf', material: 'metal' }, extra: { code: 'eval(1)' }, target: { cube: 'Z', faces: ['front', 'top', 'bottom', 'front'] } }, st);
  ok(r1.ok, 'validação aceita e corrige');
  ok(r1.value.params.depth === 600, 'depth limitado a 600');
  ok(!('foo' in r1.value.params) && !('evil' in r1.value.params) && !('extra' in r1.value), 'chaves desconhecidas descartadas');
  ok(r1.value.params.sides === 6, 'sides arredondado');
  ok(r1.value.style.color1 === '#2fd8ff' && r1.value.style.color2 === '#00ff00', 'cor inválida volta ao padrão, válida passa');
  ok(r1.value.style.obj === 'cube' && r1.value.style.material === 'metal', 'objeto fora da lista cai no padrão');
  ok(r1.value.target.cube === 'A' && r1.value.target.faces.join() === 'front,top', 'alvo: cubo inexistente vira o primeiro, faces filtradas e sem repetição');
  ok(r1.warnings.length >= 4, 'avisos explicam o que foi corrigido (' + r1.warnings.length + ')');
  ok(typeof r1.value.name === 'string' && r1.value.name.indexOf('<') >= 0, 'nome é só texto (a interface escapa)');
  const j = JSON.stringify(r1.value); ok(j.indexOf('eval') < 0 && j.indexOf('javascript') < 0 && j.indexOf('rm -rf') < 0, 'nenhum texto executável sobrevive na ilusão validada');
  const rk = C.validateKeys([{ param: 'depth', t: 2, v: 50, i: 'ease' }, { param: 'flow', t: 1, v: 1 }, { param: 'open', t: -5, v: 9, i: 'zzz' }, { param: 'x', t: 1, v: 1 }, { param: 'open', t: 'a', v: 1 }], 10);
  ok(rk.keys.length === 2 && rk.keys[1].t === 0 && rk.keys[1].v === 1 && rk.keys[1].i === 'ease', 'keyframes: só animáveis, tempo e valor limitados');
  ok(rk.warnings.length === 3, 'keyframes inválidos geram aviso');
}

// stage
{
  const s1 = C.fixStage({ cubes: [{ id: 'A', size: 9999, pos: [1, 2, 'x'], faces: { front: 'abc', top: 5 } }, { id: 'A', size: -3 }], viewer: { pos: [9e9, 0, 0] } });
  ok(s1.cubes.length === 2 && s1.cubes[0].size === 200 && s1.cubes[1].size === 1 && s1.cubes[0].id !== s1.cubes[1].id, 'fixStage limita tamanhos e evita ids repetidos');
  ok(s1.cubes[0].faces.front === 'abc' && s1.cubes[0].faces.top === null && s1.viewer.pos[0] === 600, 'fixStage limpa faces e olho');
  ok(C.fixStage(null).cubes.length === 4 && C.fixStage('lixo').cubes.length === 4, 'fixStage de lixo volta ao padrão');
  const st2 = JSON.parse(JSON.stringify(st)); st2.cubes[0].faces.front = 'sKEY';
  const f = C.findFace(st2, 'sKEY'); ok(f && f.cube.id === 'A' && f.face === 'front', 'findFace acha a face ligada à superfície');
  ok(C.findFace(st2, 'outra') === null, 'findFace nulo para superfície sem face');
}

// cenas
C.PRESET_ORDER.forEach(p => {
  const il = C.defaultIllusion(p);
  const sc = C.buildScene(il, null, 1.3, 8), sc2 = C.buildScene(il, null, 1.3, 8);
  let finite = true;
  sc.prims.forEach(q => { [q.p, q.r, q.s, q.c].forEach(a => a.forEach(x => { if (!isFinite(x)) finite = false; })); if (!(q.a >= 0 && q.a <= 1)) finite = false; });
  ok(sc.prims.length > 3 && finite, p + ': cena com ' + sc.prims.length + ' primitivas, todas finitas');
  ok(JSON.stringify(sc.prims) === JSON.stringify(sc2.prims), p + ': determinística');
  const t2 = C.buildScene(il, null, 2.9, 8);
  ok(JSON.stringify(t2.prims) !== JSON.stringify(sc.prims), p + ': muda com o tempo');
});
{
  const il = C.defaultIllusion('infinite-room'), sc = C.buildScene(il, null, 0.7, 8), D = il.params.depth;
  const zs = sc.prims.map(q => q.p[2]);
  ok(Math.min.apply(null, zs) >= -D - 1e-6 && Math.max.apply(null, zs) <= 1e-6, 'Infinite Room: tudo entre a face e a profundidade virtual');
  const a = C.buildScene(il, { depth: 60 }, 0, 8), zs2 = a.prims.map(q => q.p[2]);
  ok(Math.min.apply(null, zs2) >= -60 - 1e-6, 'Infinite Room: depth animado encurta a sala');
  const l1 = C.buildScene(il, { travel: 0 }, 0, 8), l2 = C.buildScene(il, { travel: 16 }, 0, 8);
  ok(l1.prims.length === l2.prims.length, 'Infinite Room: deslocamento de um espaçamento fecha o ciclo (loop contínuo)');
  const e = C.effective(il, { depth: 9999, nada: 1, glow: 2 }); ok(e.depth === 600 && e.glow === 2 && !('nada' in e), 'effective limita e ignora o que não é parâmetro');
}
{
  const il = C.defaultIllusion('infinite-room'); il.target.cube = 'A'; il.params.flow = 0;
  const s2 = JSON.parse(JSON.stringify(st)); s2.cubes[0].faces.front = 'k1'; s2.cubes[0].faces.left = 'k2';
  const r = C.resolveFace(s2, il, null, 'k1', 0), l = C.resolveFace(s2, il, null, 'k2', 0), fr = C.resolveFace(s2, il, null, 'semface', 0);
  ok(!r.free && r.face === 'front' && r.cam && r.cam.dist > 100, 'resolveFace: superfície ligada usa o cubo e o olho do público');
  ok(!l.free && l.face === 'left', 'resolveFace: face esquerda');
  ok(l.cam === null || l.cam.dist > 0, 'resolveFace: face esquerda visível ou câmera nula coerente');
  ok(fr.free && fr.cam, 'resolveFace: superfície sem cubo cai na janela de teste');
  ok(C.defaultStage().cubes.every(c => Object.keys(c.faces).length === 5), 'cada cubo tem 5 faces possíveis');
}
ok(C.KF_PARAMS.indexOf('depth') >= 0 && C.KF_PARAMS.indexOf('flow') < 0, 'animáveis: depth sim, flow não');
// versionamento
{
  const a = C.validate({ preset: 'infinite-room' }, null);
  ok(a.ok && a.value.v === C.VERSION && !a.warnings.some(w => /mais nova/.test(w)), 'sem v: tratado como v1, sem aviso');
  const b = C.validate({ v: 99, preset: 'infinite-room', params: { depth: 100 } }, null);
  ok(b.ok && b.value.v === C.VERSION && b.warnings.some(w => /mais nova/.test(w)), 'v mais nova: lê o que entende e avisa');
  ok(C.validate({ v: -3, preset: 'infinite-room' }, null).ok, 'v inválida não derruba');
  ok(C.stageVersionWarning({ v: 5 }) !== '' && C.stageVersionWarning({ v: 1 }) === '' && C.stageVersionWarning(null) === '', 'aviso de palco de versão mais nova');
}
// assistente do espectador
{
  const cb = C.defaultStage().cubes[0]; // A 16", pos 0,8,0
  const pos = C.viewerFromMeasures(cb, { dist: 100, height: 60, lateral: 12 });
  ok(Math.abs(pos[0] - 12) < 1e-9 && pos[1] === 60 && Math.abs(pos[2] - 108) < 1e-9, 'medidas viram posição: 100 pol da face frontal = z 108, lado +12 = x 12');
  const back = C.measuresFromViewer(cb, pos);
  ok(Math.abs(back.dist - 100) < 1e-9 && Math.abs(back.lateral - 12) < 1e-9 && back.height === 60, 'ida e volta das medidas');
  const rc = Object.assign({}, cb, { rotY: 90 });
  const p2 = C.viewerFromMeasures(rc, { dist: 50, height: 50, lateral: 0 });
  ok(Math.abs(p2[0] - 58) < 1e-6 && Math.abs(p2[2]) < 1e-6, 'cubo girado 90 graus: a "frente" gira junto');
  ok(C.viewerAdvice(cb, { dist: 10, height: 60, lateral: 0 }).length >= 1 && C.viewerAdvice(cb, { dist: 100, height: 60, lateral: 0 }).length === 0, 'avisos de bom senso');
  const wild = C.viewerFromMeasures(cb, { dist: 1e9, height: -5, lateral: 'x' });
  ok(wild.every(Number.isFinite) && wild[1] === 0, 'entrada absurda é limitada');
}
// Sala montável (room-builder)
{
  const il = C.defaultIllusion('room-builder');
  ok(il.room && C.ROOM_WALLS.every(k => il.room.walls[k]) && !C.defaultIllusion('infinite-room').room, 'room-builder tem sala; os outros presets continuam sem o campo room');
  const bad = JSON.parse(JSON.stringify(il));
  bad.room.walls.back.media = { path: '/x/a.gif', src: 'javascript:alert(1)', name: 'a' };
  bad.room.walls.left.media = { src: 'file:///x/b.png' };
  bad.room.walls.right.media = { src: 'data:text/html,<script>1</script>' };
  bad.room.walls.floor.d = 9999; bad.room.walls.floor.color = 'red';
  bad.room.sprites = []; for (let i = 0; i < 40; i++) bad.room.sprites.push({ id: 'a', x: 1e9, y: 'x', z: -1e9, size: 1e9, media: { path: '/y.png' } });
  bad.room.extra = 'x'; bad.room.walls.zzz = { on: true };
  const v = C.validate(bad, null).value;
  ok(v.room.walls.back.media.path === '/x/a.gif' && !('src' in v.room.walls.back.media), 'mídia: endereço javascript: descartado, caminho mantido');
  ok(v.room.walls.left.media.src === 'file:///x/b.png' && v.room.walls.right.media === null, 'mídia: file: passa, data:text/html é descartado');
  ok(v.room.walls.floor.d === 14 && v.room.walls.floor.color === '#1a1d2e', 'parede: recuo limitado e cor inválida volta ao padrão');
  ok(v.room.sprites.length === C.MAX_SPRITES && v.room.sprites.every(q => Math.abs(q.x) <= 60 && q.z >= -600 && q.size <= 80) && new Set(v.room.sprites.map(q => q.id)).size === v.room.sprites.length, 'objetos: no máximo ' + C.MAX_SPRITES + ', valores limitados e ids únicos');
  ok(!('extra' in v.room) && !('zzz' in v.room.walls), 'chaves desconhecidas da sala são descartadas');
  const il2 = JSON.parse(JSON.stringify(il)); il2.room.walls.back.media = { src: 'blob:http://x/1', name: 'g.gif' };
  il2.room.sprites.push({ id: 'q', x: 0, y: 0, z: -10, size: 5, media: { src: 'blob:http://x/2', name: 'p.png' } });
  const sc = C.buildScene(C.validate(il2, null).value, null, 0.5, 8);
  const vq = sc.quads.filter(q => !q.pickOnly);
  ok(vq.length === 2 && vq.some(q => q.solid && q.id === 'wall:back') && vq.some(q => !q.solid && q.sprite), 'cena: parede com mídia e objeto viram planos texturizados');
  const sc0 = C.buildScene(il, null, 0.5, 8);
  ok(sc0.quads.filter(q => !q.pickOnly).length === 0 && sc0.prims.length > 5, 'cena sem mídia usa só primitivas coloridas');
  const zs = sc0.prims.map(q => q.p[2]); ok(Math.min.apply(null, zs) >= -il.params.depth - 1e-6, 'sala: nada passa do fundo');
  il.room.walls.left.on = false; il.room.walls.right.on = false; il.room.walls.floor.on = false; il.room.walls.back.on = false;
  ok(C.buildScene(il, null, 0, 8).prims.length >= 1, 'sala sem nenhuma parede não quebra');
}
console.log(n + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
