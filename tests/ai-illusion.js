// AI Director 3.2: categoria 3D Illusions. Planejador local, resposta da IA validada, recusa de código, apply/undo na timeline real.
const Seq=require('../sequence.js');global.Sequence=Seq;
const IC=require('../illusion-core.js');global.IllusionCore=IC;
const IT=require('../illusion-timeline.js');global.IllusionTimeline=IT;
global.AiSchema=require('../ai/ai-schema.js');
const AI=require('../ai/ai-illusion.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const stage=IC.defaultStage();
const ctx={stage};
// local: cada preset por palavra-chave
const cases=[['Sala infinita azul','infinite-room'],['um túnel veloz','infinite-tunnel'],['cubo abrindo e fechando','opening-cube'],['quebrar a parede','breaking-surface'],['objeto dentro do cubo','object-inside'],['esfera emergindo da face','object-emerging'],['interior mecânico com engrenagens','mechanical-interior']];
cases.forEach(([t,p])=>{const r=AI.planLocal(t,ctx);assert(r.ok&&r.plan.il.preset===p,'local: "'+t+'" -> '+p);});
let r=AI.planLocal('Sala infinita azul e rosa no cubo B, frente e esquerda, 10 segundos, material neon',ctx);
assert(r.ok&&r.plan.il.target.cube==='B','local: cubo B');
assert(r.plan.il.target.faces.join()==='front,left'||r.plan.il.target.faces.slice().sort().join()==='front,left','local: faces frente e esquerda');
assert(r.plan.il.style.color1==='#3b82ff'&&r.plan.il.style.color2==='#ff4fa3','local: duas cores na ordem do texto');
assert(r.plan.duration===10&&r.plan.il.style.material==='neon','local: duração e material');
assert(r.plan.keys.length>0&&r.plan.keys.every(k=>IC.KF_PARAMS.includes(k.param)),'local: keyframes só em parâmetros animáveis');
r=AI.planLocal('sala infinita em todas as faces',ctx);assert(r.plan.il.target.faces.length===5,'local: todas as faces');
r=AI.planLocal('qualquer coisa sem sentido',ctx);assert(r.ok&&r.plan.il.preset==='infinite-room'&&r.warnings.length>=1,'local: texto desconhecido cai na Sala Infinita com aviso');
r=AI.planLocal('sala infinita parada',ctx);assert(r.plan.keys.length===0,'local: "parada" não cria keyframes');
// IA: resposta válida com cerca de código
const good='```json\n{"preset":"infinite-tunnel","name":"Túnel neon","cube":"A","faces":["front","top"],"duration":6,"params":{"depth":9999,"flow":50},"style":{"color1":"#00ffcc","obj":"torus"},"keys":[{"param":"travel","t":0,"v":0},{"param":"travel","t":99,"v":500,"i":"linear"}]}\n```';
r=AI.parseResponse(good,ctx);
assert(r.ok&&r.plan.source==='ai'&&r.plan.il.params.depth===600,'IA: valor fora da faixa é limitado');
assert(r.plan.keys.length===2&&r.plan.keys[1].t===6,'IA: tempo do keyframe limitado à duração');
assert(r.warnings.some(w=>/limitad/.test(w)),'IA: ajustes viram avisos');
// IA: tentativas de código / campos extras
const evil='{"preset":"infinite-room","code":"require(\'fs\')","glsl":"void main(){}","name":"<img src=x onerror=alert(1)>","style":{"color1":"url(javascript:1)","obj":"__proto__","material":"eval(1)"},"params":{"__proto__":{"x":1},"depth":"abc","hack":5},"keys":[{"param":"constructor","t":0,"v":1},{"param":"depth","t":0,"v":50}],"extra":{"a":1}}';
r=AI.parseResponse(evil,ctx);
assert(r.ok,'IA: resposta maliciosa vira plano seguro (campos descartados)');
assert(r.warnings.filter(w=>/Campo ignorado/.test(w)).length>=3,'IA: code, glsl e extra descartados com aviso');
assert(r.plan.il.style.color1!=='url(javascript:1)'&&/^#[0-9a-f]{6}$/i.test(r.plan.il.style.color1),'IA: cor inválida recusada');
assert(r.plan.il.style.obj!=='__proto__'&&r.plan.il.style.material!=='eval(1)','IA: enums fora da lista recusados');
assert(r.plan.il.params.hack===undefined&&({}).x===undefined,'IA: parâmetro desconhecido e __proto__ não entram');
assert(r.plan.keys.length===1&&r.plan.keys[0].param==='depth','IA: keyframe em parâmetro inexistente é ignorado');
assert(!JSON.stringify(r.plan).includes('require'),'IA: nenhuma string de código chega no plano');
assert(!AI.parseResponse('{"preset":"fogo-magico"}',ctx).ok,'IA: preset desconhecido é recusado');
assert(!AI.parseResponse('não é json',ctx).ok,'IA: texto sem JSON é recusado');
assert(!AI.parseResponse('[1,2]',ctx).ok,'IA: JSON que não é objeto é recusado');
r=AI.parseResponse('{"preset":"opening-cube","cube":"Z","duration":99999}',ctx);assert(r.ok&&r.plan.il.target.cube==='A'&&r.plan.duration===300,'IA: cubo inexistente cai no primeiro; duração limitada a 300');
// pedido à IA
const rq=AI.request('sala infinita',ctx);assert(rq.system.includes('SOMENTE com JSON')&&rq.system.includes('infinite-room')&&/Não inclua código/.test(rq.system),'request: instrui JSON fechado sem código');
// apply/undo pela ponte real
const seq=Seq.create({duration:30});const surfs=['s1','s2','s3'];
const host={seq:()=>seq,checkpoint(){},push(){},syncClock(){},renderAll(){},setOn(){},now:()=>2,surfaces:()=>surfs.map(k=>({key:k}))};
IT.ensureStage(seq).cubes[0].faces.front='s1';IT.ensureStage(seq).cubes[0].faces.left='s2';
const plan=AI.planLocal('sala infinita no cubo A frente e esquerda 6 segundos',{stage:seq.stage}).plan;
const q0=JSON.stringify(seq.tracks.length);
const b=IT.apply(plan.il,host,{duration:plan.duration,keys:plan.keys});
assert(b.ok&&b.clipIds.length===2&&seq.tracks.length===2,'apply: um clipe por face ligada');
const c=seq.tracks[0].clips[0];assert(c.start===2&&Math.abs(c.duration-6)<1e-9&&c.keyframes['ill.travel'].length===2,'apply: início no playhead, duração e keyframes reais');
IT.undo(host);assert(seq.tracks.length===0&&seq.assets.length===0,'undo: remove só o que a IA criou');
console.log(process.exitCode?'FALHOU':'OK');
