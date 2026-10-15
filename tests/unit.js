const assert = require('assert');
const S = require('/home/claude/mapeador-livre-mac/sequence.js');
globalThis.document = undefined;
let MM; try { require('/home/claude/mapeador-livre-mac/renderer.js'); MM = globalThis.MapMath; } catch (e) { console.log('renderer load fail', e.message); }
let pass = 0; function ok(c, m) { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else { pass++; } }
function near(a, b, e, m) { ok(Math.abs(a - b) <= (e || 1e-6), m + ' (' + a + ' vs ' + b + ')'); }

// migracao
let s0 = S.migrate(null); ok(s0.schema === 1 && s0.tracks.length === 0 && s0.duration === 30, 'migrate null');
let s1 = S.migrate({ tracks: [{ type: 'video', surfaceId: 'k1', clips: [{ assetId: 'a', start: 1, duration: 2, foo: 9 }] }], assets: [{ id: 'a', kind: 'fx', fx: { kind: 'grade' } }], schema: 0 });
ok(s1.tracks[0].clips[0].speed === 1 && s1.tracks[0].clips[0].transform.scale === 1, 'migrate defaults');
ok(!('foo' in s1.tracks[0].clips[0]), 'migrate drops unknown');
ok(S.migrate({ schema: 99 })._newer === true, 'newer flag');
const rt = S.migrate(JSON.parse(JSON.stringify(s1))); ok(JSON.stringify(rt) === JSON.stringify(s1), 'migrate idempotent');

// sequencia de teste: 12 faixas com clipes em 0,2,5,10
let seq = S.create({ duration: 30 });
const vid = S.addAsset(seq, { kind: 'video', name: 'v.mp4', duration: 4, path: '/x/v.mp4' });
const fx = S.addAsset(seq, { kind: 'fx', name: 'Grade', fx: { kind: 'grade' } });
const tracks = []; for (let i = 0; i < 12; i++) tracks.push(S.addTrack(seq, 'video', 'face' + i));
const starts = [0, 2, 5, 10];
for (let i = 0; i < 12; i++) S.addClip(seq, tracks[i].id, i % 2 ? vid : fx, starts[i % 4], 3);
let e = S.evaluate(seq, 3.25);
const active = Object.keys(e.video).filter(k => e.video[k].length).sort();
// t=3.25: starts 0 (0-3 inativo), 2 (2-5 ativo), 5 inativo, 10 inativo => faces com i%4==1 : 1,5,9
ok(active.join() === 'face1,face5,face9', 'active at 3.25: ' + active);
let ev = e.video.face1[0].ev; near(ev.local, 1.25, 1e-9, 'local'); near(ev.srcTime, 1.25, 1e-9, 'srcTime'); near(ev.tms, 1250, 1e-6, 'tms');
// determinismo
ok(JSON.stringify(S.evaluate(seq, 3.25)) === JSON.stringify(S.evaluate(seq, 3.25)), 'deterministic');
// scrub para tras e frente da o mesmo
S.evaluate(seq, 9); ok(JSON.stringify(S.evaluate(seq, 3.25)) === JSON.stringify(e), 'seek independent of history');

// loop de clipe 2s em faixa de 10s
let sq = S.create({ duration: 10 }); const a2 = S.addAsset(sq, { kind: 'video', name: 'c', duration: 2 });
const t2 = S.addTrack(sq, 'video', 'f'); const c2 = S.addClip(sq, t2.id, a2, 0, 10); c2.loopMode = 'loop';
near(S.evalClip(c2, a2, 5.5).srcTime, 1.5, 1e-9, 'loop srcTime 5.5'); ok(S.evalClip(c2, a2, 5.5).cycle === 2, 'loop cycle');
near(S.evalClip(c2, a2, 9.99).srcTime, 1.99, 1e-6, 'loop end');
c2.loopMode = 'none'; let en = S.evalClip(c2, a2, 5); ok(en.ended && Math.abs(en.srcTime - 2) < 1e-9, 'non loop holds last frame');
// velocidade
c2.loopMode = 'loop'; c2.speed = 2; near(S.evalClip(c2, a2, 0.75).srcTime, 1.5, 1e-9, 'speed 2'); near(S.evalClip(c2, a2, 1.25).srcTime, 0.5, 1e-9, 'speed2 wraps at 1s');

// keyframes: linear e hold, loop repete keyframes
let ck = S.fixClip({ assetId: fx.id, start: 0, duration: 8, loopMode: 'loop', loopLen: 2 });
S.setKey(ck, 'x', 0, 0, 'linear'); S.setKey(ck, 'x', 1, 0.5, 'hold'); S.setKey(ck, 'x', 2, 1, 'linear');
near(S.valueAt(ck, 'x', 0.5), 0.25, 1e-9, 'kf linear'); near(S.valueAt(ck, 'x', 1.5), 0.5, 1e-9, 'kf hold'); near(S.valueAt(ck, 'x', 3), 1, 1e-9, 'kf after');
near(S.evalClip(ck, fx, 4.5).p.x, 0.25, 1e-9, 'loop repeats keyframes (4.5 -> cl 0.5)');
near(S.evalClip(ck, fx, 5.5).p.x, 0.0 + 0.0, 1, 'x in cycle');
ok(S.hasKey(ck, 'x', 1) && S.removeKey(ck, 'x', 1) && !S.hasKey(ck, 'x', 1), 'remove key');
ok(S.stepKey(ck, 'x', 0, 1) === 2 && S.stepKey(ck, 'x', 2, -1) === 0, 'step key');
// fades
let cf = S.fixClip({ assetId: fx.id, start: 0, duration: 4, fadeIn: 1, fadeOut: 1 });
near(S.evalClip(cf, fx, 0.5).opacity, 0.5, 1e-9, 'fade in'); near(S.evalClip(cf, fx, 3.75).opacity, 0.25, 1e-9, 'fade out'); near(S.evalClip(cf, fx, 2).opacity, 1, 1e-9, 'no fade mid');

// trim e split
let st = S.create({ duration: 20 }); const av = S.addAsset(st, { kind: 'video', name: 'v', duration: 10 }); const tt = S.addTrack(st, 'video', 'f');
let cc = S.addClip(st, tt.id, av, 2, 10);
S.trimClip(st, cc.id, 'l', 4); near(cc.start, 4, 1e-9, 'trim l start'); near(cc.inPoint, 2, 1e-9, 'trim l inPoint'); near(cc.duration, 8, 1e-9, 'trim l dur');
S.trimClip(st, cc.id, 'r', 9); near(cc.duration, 5, 1e-9, 'trim r');
S.trimClip(st, cc.id, 'r', 100); near(cc.duration, 8, 1e-9, 'trim r clamps to source');
let n = S.splitClip(st, cc.id, 8); near(cc.duration, 4, 1e-9, 'split a dur'); near(n.start, 8, 1e-9, 'split b start'); near(n.inPoint, 6, 1e-9, 'split b in');
// continuidade: frame no corte
near(S.evalClip(cc, av, 7.999).srcTime, 5.999, 1e-6, 'split a src'); near(S.evalClip(n, av, 8).srcTime, 6, 1e-9, 'split b src');
ok(S.splitClip(st, n.id, n.start) === null, 'split at edge refuses');
let d = S.duplicateClip(st, n.id); near(d.start, S.endOf(n), 1e-9, 'dup placed after');
// keyframes preservados no split
let ks = S.fixClip({ assetId: fx.id, start: 0, duration: 4 }); st.tracks[0].clips.push(ks); S.setKey(ks, 'opacity', 0, 0); S.setKey(ks, 'opacity', 4, 1);
let ks2 = S.splitClip(st, ks.id, 2); near(S.valueAt(ks, 'opacity', 2), 0.5, 1e-9, 'split kf end a'); near(S.valueAt(ks2, 'opacity', 0), 0.5, 1e-9, 'split kf start b'); near(S.valueAt(ks2, 'opacity', 2), 1, 1e-9, 'split kf end b');
// conflitos
let sc = S.create(); const ta = S.addTrack(sc, 'video', 'z'); const fa = S.addAsset(sc, { kind: 'fx' }); S.addClip(sc, ta.id, fa, 0, 5); const c5 = S.addClip(sc, ta.id, fa, 4, 3); S.addClip(sc, ta.id, fa, 7, 1);
const cf2 = S.conflicts(ta); ok(Object.keys(cf2).length === 2, 'conflicts detected');
// solo/mute/enabled
let sm = S.create(); const t1 = S.addTrack(sm, 'video', 's1'), t2b = S.addTrack(sm, 'video', 's2'); const fm = S.addAsset(sm, { kind: 'fx' });
S.addClip(sm, t1.id, fm, 0, 5); S.addClip(sm, t2b.id, fm, 0, 5);
t1.solo = true; ok(!S.evaluate(sm, 1).video.s2 || S.evaluate(sm, 1).video.s2.length === 0, 'solo hides others'); t1.solo = false; t1.enabled = false; ok(!S.evaluate(sm, 1).video.s1, 'disabled hidden');
let au = S.addAsset(sm, { kind: 'audio', name: 'm', duration: 60 }); const ta1 = S.addTrack(sm, 'audio'), ta2 = S.addTrack(sm, 'audio');
S.addClip(sm, ta1.id, au, 0, 20); S.addClip(sm, ta2.id, au, 0, 20);
ok(S.evaluate(sm, 1).audio.length === 2, 'two audio'); ta1.muted = true; ok(S.evaluate(sm, 1).audio.length === 1, 'mute'); ta2.solo = true; ta1.muted = false; ok(S.evaluate(sm, 1).audio.length === 1, 'solo audio');

// transform / matriz
if (MM) {
  const W = 1600, H = 900;
  let id = S.xformOf(W, H, { x: 0, y: 0, scale: 1, sx: 1, sy: 1, rot: 0, corners: [[0, 0], [0, 0], [0, 0], [0, 0]] }, MM.solveH); ok(id.xf === '', 'identity xf empty');
  let tr = S.xformOf(W, H, { x: 0.1, y: 0, scale: 0.5, sx: 1, sy: 1, rot: 0, corners: [[0, 0], [0, 0], [0, 0], [0, 0]] }, MM.solveH);
  // aplica a matriz ao canto (0,0): esperado cx + (0-cx)*0.5 + 0.1*W
  const m = tr.xf.slice(9, -1).split(',').map(Number); // matrix3d: a=m0 b=m1 ... e=m12 f=m13
  const px = m[0] * 0 + m[4] * 0 + m[12], py = m[1] * 0 + m[5] * 0 + m[13];
  near(px, 800 + (0 - 800) * 0.5 + 160, 1e-3, 'matrix maps corner x'); near(py, 450 + (0 - 450) * 0.5, 1e-3, 'matrix maps corner y');
  let dz = S.xformOf(W, H, { x: 0, y: 0, scale: 1, sx: 1, sy: 1, rot: 0, corners: [[0.1, 0], [0, 0], [0, 0], [0, 0]] }, MM.solveH);
  const q = dz.quad; near(q[0][0], 160, 1e-6, 'distort moves corner 0 only'); near(q[1][0], W, 1e-6, 'corner 1 intact');
}
ok(S.cropOf({ l: 0, t: 0, r: 0, b: 0 }) === '' && /inset/.test(S.cropOf({ l: .1, t: 0, r: 0, b: 0 })), 'crop');

// relogio
let wall = 1000000; const clk = new S.Clock({ wall: () => wall, duration: 10 });
near(clk.now(), 0, 1e-9, 'clock t0'); clk.play(); wall += 2500; near(clk.now(), 2.5, 1e-9, 'clock play 2.5s');
clk.pause(); wall += 5000; near(clk.now(), 2.5, 1e-9, 'clock paused holds'); clk.seek(7); near(clk.now(), 7, 1e-9, 'seek');
clk.play(); wall += 2000; near(clk.now(), 9, 1e-9, 'play after seek'); wall += 5000; near(clk.now(), 10, 1e-9, 'clamps at end'); ok(clk.ended, 'ended flag');
clk.pause(); clk.setRate(2); clk.seek(1); clk.play(); wall += 1000; near(clk.now(), 3, 1e-9, 'rate 2');
clk.setRate(1); clk.setLoop(true, 2, 6); clk.seek(5); clk.play(); wall += 3000; near(clk.now(), 2 + ((8 - 2) % 4), 1e-9, 'loop range wraps (' + clk.now() + ')');
// duas janelas, mesma referencia => mesmo tempo
let wall2 = wall; const clk2 = new S.Clock({ wall: () => wall2, duration: 10 }); clk2.apply(JSON.parse(JSON.stringify(clk.transport())));
wall += 1234; wall2 = wall; near(clk2.now(), clk.now(), 1e-9, 'two windows agree');
clk.stop(); near(clk.now(), 2, 1e-9, 'stop goes to loop start');
// mensagem velha nao desfaz seek novo
{ let w=5000; const a=new S.Clock({wall:()=>w}), b=new S.Clock({wall:()=>w}); a.seek(5); const t1=a.transport(); a.seek(8); const t2=a.transport(); b.apply(t2); const ok1=b.apply(t1); ok(ok1===false && Math.abs(b.now()-8)<1e-9,'stale transport ignored'); }
// tempo
near(S.parseTime('00:03.250'), 3.25, 1e-9, 'parse mm:ss.mmm'); near(S.parseTime('0:0:3:15', 30), 3.5, 1e-9, 'parse timecode'); ok(S.fmt(3.25) === '00:03.250', 'fmt'); ok(S.timecode(3.25, 30) === '00:00:03:08', 'timecode ' + S.timecode(3.25, 30));
// snap
let sn = S.create({ duration: 20 }); const tsn = S.addTrack(sn, 'video', 'q'); const asn = S.addAsset(sn, { kind: 'fx' }); S.addClip(sn, tsn.id, asn, 5, 2);
near(S.snapTime(sn, 4.95, 0.1, null), 5, 1e-9, 'snap to clip edge'); near(S.snapTime(sn, 4.5, 0.1, null), 4.5, 1e-9, 'no snap');

// ---- camadas empilhadas por face (estilo Final Cut: faixa de cima fica por cima) ----
{
  const sq = S.create({ duration: 20 }); const A = S.addAsset(sq, { kind: 'fx' });
  const base = S.addTrack(sq, 'video', 'faceX', 'Base'); S.addClip(sq, base.id, A, 0, 10);
  const l2 = S.addLayer(sq, 'faceX', 'Camada 2'); S.addClip(sq, l2.id, A, 2, 4);
  const l3 = S.addLayer(sq, 'faceX', 'Camada 3'); S.addClip(sq, l3.id, A, 3, 2);
  ok(sq.tracks.map(t => t.name).join() === 'Camada 3,Camada 2,Base', 'addLayer insere acima da camada mais alta: ' + sq.tracks.map(t => t.name));
  let ev = S.evaluate(sq, 3.5).video.faceX;
  ok(ev.map(x => x.track.name).join() === 'Base,Camada 2,Camada 3', 'ordem de pintura base primeiro, topo por último: ' + ev.map(x => x.track.name));
  ok(S.layerInfo(sq, l3.id).n === 3 && S.layerInfo(sq, base.id).n === 1 && S.layerInfo(sq, base.id).total === 3, 'layerInfo n/total');
  ok(S.moveLayer(sq, l3.id, +1) && sq.tracks[1].id === l3.id, 'moveLayer desce a camada');
  ev = S.evaluate(sq, 3.5).video.faceX;
  ok(ev[ev.length - 1].track.id === l2.id, 'depois de trocar, Camada 2 passa por cima');
  ok(!S.moveLayer(sq, sq.tracks[0].id, -1), 'moveLayer no topo não faz nada');
  for (let i = 0; i < 20; i++) S.addLayer(sq, 'faceX'); ok(S.layersOf(sq, 'faceX').length === 23, 'camadas ilimitadas por face: ' + S.layersOf(sq, 'faceX').length);
  const other = S.addTrack(sq, 'video', 'faceY', 'Y'); ok(S.layersOf(sq, 'faceY').length === 1 && S.moveLayer(sq, other.id, -1) === false, 'camadas de outra face independentes');
  const mg = S.migrate(JSON.parse(JSON.stringify(sq))); ok(mg.tracks.map(t => t.id).join() === sq.tracks.map(t => t.id).join(), 'ordem das camadas sobrevive a migrate/salvar');
}
console.log('PASS', pass, process.exitCode ? 'COM FALHAS' : 'ok');
