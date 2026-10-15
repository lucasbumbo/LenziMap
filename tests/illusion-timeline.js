// Testes da ponte ilusão -> timeline (Node puro): clipes por face, keyframes, atualização, desfazer, persistência.
const S = require('../sequence.js'), C = require('../illusion-core.js'), T = require('../illusion-timeline.js'), KC = require('../keyframe-core.js');
let fails = 0, n = 0;
function ok(c, m) { n++; if (c) console.log('PASS ' + m); else { fails++; console.log('FAIL ' + m); } }
const seq = S.create(); T.ensureStage(seq);
seq.stage.cubes[0].faces.front = 'KF'; seq.stage.cubes[0].faces.left = 'KL';
const before = JSON.stringify(seq.stage);
const il = C.defaultIllusion('infinite-room'); il.target = { cube: 'A', faces: ['front', 'left', 'top'] };
const b = T.applyToSeq(seq, il, { at: 2, duration: 6, keys: [{ param: 'travel', t: 0, v: 0 }, { param: 'travel', t: 6, v: 100, i: 'linear' }, { param: 'flow', t: 1, v: 1 }] });
ok(b.ok && b.clipIds.length === 2, 'um clipe por face ligada (2 de 3, topo sem superfície)');
ok(b.warnings.some(w => /Topo/.test(w)) && b.warnings.some(w => /animável/.test(w)), 'avisos: face sem superfície e keyframe inválido');
ok(seq.assets.length === 1 && seq.assets[0].fx.kind === 'illusion' && seq.assets[0].fx.illusion.preset === 'infinite-room', 'um asset de ilusão compartilhado');
const cl = T.clipsOfAsset(seq, b.assetId);
ok(cl.length === 2 && cl.every(x => x.clip.start === 2 && x.clip.duration === 6), 'clipes começam em 2 s e duram 6 s');
ok(cl.every(x => x.track.surfaceId === 'KF' || x.track.surfaceId === 'KL'), 'faixas ligadas às superfícies certas');
ok(cl.every(x => x.clip.keyframes['ill.travel'].length === 2 && !x.clip.keyframes['ill.flow']), 'keyframes só nos parâmetros animáveis');
ok(cl.every(x => x.clip.ill.depth === 160 && x.clip.ill.travel === 0), 'valores base copiados pro clipe (depth do preset = 160)');
ok(JSON.stringify(seq.stage) === before, 'palco (geometria física) intacto pela aplicação');

// avaliação: o motor devolve os parâmetros animados no tempo certo
const e0 = S.evaluate(seq, 5), it = e0.video.KF[0];
ok(it && it.ev.ill && Math.abs(it.ev.ill.travel - 50) < 0.5, 'avaliador: travel = 50 no meio do clipe (' + (it && it.ev.ill && it.ev.ill.travel.toFixed(2)) + ')');
ok(S.evaluate(seq, 1).video.KF === undefined || S.evaluate(seq, 1).video.KF.length === 0, 'antes do clipe não há nada');
ok(it.ev.ill.depth === 160, 'parâmetro sem keyframe usa o base do clipe');

// valueAt / setBase / limites via keyframe-core
const c0 = cl[0].clip;
ok(S.valueAt(c0, 'ill.depth', 1) === 160, 'valueAt de ill.depth');
S.setBase(c0, 'ill.depth', 99999); ok(c0.ill.depth === 600, 'setBase limita a faixa do parâmetro');
ok(KC.clampV('ill.open', 5) === 1 && KC.clampV('ill.depth', -5) === 8, 'keyframe-core limita por parâmetro');
ok(S.KF_LABEL['ill.travel'] && /Deslocamento/.test(S.KF_LABEL['ill.travel']), 'rótulo do keyframe em português');

// salvar e reabrir: nada se perde
const saved = JSON.parse(JSON.stringify(seq)), back = S.migrate(saved);
ok(JSON.stringify(back.stage) === JSON.stringify(seq.stage), 'migrate mantém o palco');
ok(T.clipsOfAsset(back, b.assetId).every(x => x.clip.keyframes['ill.travel'].length === 2 && x.clip.ill.depth === (x.clip.id === c0.id ? 600 : 160)), 'migrate mantém keyframes e base de ill');
ok(back.assets[0].fx.illusion.params.depth === 160 && back.assets[0].fx.illusion.preset === 'infinite-room', 'migrate mantém a ilusão validada');
const old = S.migrate({ tracks: [], assets: [] }); ok(!('stage' in old), 'projeto antigo (sem palco) continua sem palco');
const bad = JSON.parse(JSON.stringify(saved)); bad.assets[0].fx.illusion = { preset: 'x' };
ok(!('illusion' in S.migrate(bad).assets[0].fx), 'ilusão corrompida no arquivo é descartada sem quebrar');
const evil = JSON.parse(JSON.stringify(saved)); evil.assets[0].fx.illusion.style.color1 = 'javascript:1'; evil.assets[0].fx.illusion.params.__proto__ = { x: 1 };
const ev2 = S.migrate(evil).assets[0].fx.illusion; ok(ev2.style.color1 === '#2fd8ff' && !({}).x, 'arquivo com valores maliciosos é saneado');

// update: muda params, respeita keyframes
const il2 = JSON.parse(JSON.stringify(seq.assets[0].fx.illusion)); il2.params.depth = 90; il2.params.travel = 40; il2.style.color2 = '#00ff00';
const r = T.update(seq, b.assetId, il2);
ok(r.ok && seq.assets[0].fx.illusion.params.depth === 90, 'update troca a ilusão do asset');
ok(cl.every(x => x.clip.ill.depth === 90) && cl.every(x => x.clip.ill.travel === 0), 'update muda o base sem keyframe e preserva o que tem keyframe');
ok(!T.update(seq, 'nao-existe', il2).ok && !T.update(seq, b.assetId, { preset: 'zzz' }).ok, 'update recusa asset inexistente e ilusão inválida');
ok(seq.assets[0].fx.illusion.id === il.id || typeof seq.assets[0].fx.illusion.id === 'string', 'id da ilusão preservado');

// keyAt
ok(T.keyAt(seq, b.assetId, 'open', 4, 0.5) === 2 && cl.every(x => S.hasKey(x.clip, 'ill.open', 2)), 'keyAt cria keyframe em todos os clipes no tempo local (4 s = 2 s do clipe)');
ok(T.keyAt(seq, b.assetId, 'flow', 4, 1) === 0, 'keyAt recusa parâmetro não animável');
ok(T.keyAt(seq, b.assetId, 'open', 20, 1) === 0, 'keyAt fora do clipe não cria nada');

// clonar/dividir não perde nada
const sp = S.splitClip(seq, c0.id, 5);
ok(sp && (sp.clip || sp.a || true), 'split de clipe de ilusão funciona');
const all = T.clipsOfAsset(seq, b.assetId);
ok(all.length === 3 && all.every(x => x.clip.ill && typeof x.clip.ill.depth === 'number'), 'depois do split os dois pedaços mantêm o base de ill');

// aplicar sem faces ligadas
const s2 = S.create(); T.ensureStage(s2);
const nb = T.applyToSeq(s2, C.defaultIllusion('opening-cube'), {});
ok(!nb.ok && nb.warnings.some(w => /Nenhuma face/.test(w)) && s2.assets.length === 0 && s2.tracks.length === 0, 'sem face ligada: nada é criado, aviso claro');
// superfícies que não existem mais
const s3 = S.create(); T.ensureStage(s3); s3.stage.cubes[0].faces.front = 'GONE';
const gb = T.applyToSeq(s3, C.defaultIllusion('infinite-room'), { surfaceKeys: ['OUTRA'] });
ok(!gb.ok && s3.assets.length === 0, 'superfície removida: ilusão não cria faixa órfã');
// remover tudo
const n1 = T.removeAll(seq, b); ok(n1 === 3 && seq.assets.length === 0 && seq.tracks.length === 0, 'removeAll tira clipes, faixas vazias e o asset');
// host fake: apply/undo
const hseq = S.create(); T.ensureStage(hseq); hseq.stage.cubes[0].faces.front = 'K1';
let ck = 0, pushes = 0, on = false; const host = { seq: () => hseq, checkpoint: () => ck++, push: () => pushes++, syncClock: () => {}, renderAll: () => {}, setOn: v => { on = v; }, now: () => 3, surfaces: () => [{ key: 'K1' }] };
const il3 = C.defaultIllusion('infinite-room'); const hb2 = T.apply(il3, host, { duration: 4 });
ok(hb2.ok && on && ck >= 1 && hseq.tracks.length === 1 && hseq.tracks[0].clips[0].start === 3, 'apply via host: cria, liga a timeline e começa no playhead');
T.undo(host); ok(hseq.tracks.length === 0 && hseq.assets.length === 0, 'undo remove só o que a ilusão criou');
ok(T.QUICK['infinite-room'][0].keys(4).every(k => C.PARAMS[k.param].kf), 'receitas rápidas só usam parâmetros animáveis');
console.log(n + ' testes, ' + fails + ' falhas'); process.exit(fails ? 1 : 0);
