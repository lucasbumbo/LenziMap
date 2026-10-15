// Módulos puros do AI Director em Node: schema, validação de respostas, shaders, planejador, ponte com a timeline, áudio e imagem.
const path=require('path');const A=p=>require(path.join(__dirname,'..','ai',p));
const Seq=require('../sequence.js');global.Sequence=Seq;global.AiSchema=A('ai-schema.js');
const reg={};global.Textures={register:(id)=>{reg[id]=1},util:{h2:()=>0.5}};A('ai-effects.js');global.AiEffects=globalThis.AiEffects;
const SV=A('shader-validator.js'),P=A('animation-planner.js'),B=A('ai-timeline-bridge.js'),VA=A('vision-analysis.js'),AA=A('audio-analysis.js'),IT=A('image-tools.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const ids=AiEffects.ids;
// biblioteca
assert(ids.length>=10&&ids.every(i=>reg[i]),'10 efeitos nativos registrados na biblioteca de texturas');
// respostas inválidas (teste 2)
assert(!VA.parseAnalysis('isso não é json',ids).ok,'resposta sem JSON é recusada');
assert(!VA.parseAnalysis('{"subject":"statue","objects":[',ids).ok,'JSON cortado é recusado');
assert(!VA.parseAnalysis('{"subject":"statue"}',ids).ok,'JSON sem nada utilizável é recusado');
let a=VA.parseAnalysis('texto antes ```json\n{"subject":"statue","objects":[{"id":"r","label":"Rosto","region":{"x":0.5,"y":0.1,"w":9,"h":0.2},"confidence":3},{"label":"sem região"}],"suggestions":[{"title":"X","effects":["ai-glow","rm -rf"],"durationSec":9999}]}```',ids);
assert(a.ok&&a.value.objects.length===1&&a.value.objects[0].region.w<=0.5&&a.value.objects[0].confidence===1,'região e confiança fora do limite são ajustadas; detecção sem região é descartada');
assert(a.value.suggestions[0].effects.join()==='ai-glow'&&a.value.suggestions[0].durationSec===300,'efeito inexistente é removido e duração limitada');
assert(a.warnings.length>=1,'descartes viram avisos');
// plano inválido
const vc={effectIds:ids,validateGlsl:SV.validate,surfaceKeys:['k1','k2']};
assert(!AiSchema.validatePlan({layers:[{effect:'exec("rm")'}]},vc).ok,'plano com efeito desconhecido é recusado');
assert(!AiSchema.validatePlan({layers:[{effect:'ai-glow',keyframes:{'transform.corners':[{t:0,v:1}]}}]},vc).ok,'keyframe em propriedade não permitida é recusado');
assert(!AiSchema.validatePlan({layers:[]},vc).ok,'plano sem camadas é recusado');
let pv=AiSchema.validatePlan({duration:5,layers:[{effect:'ai-glow',start:99,duration:99,keyframes:{p1:[{t:50,v:9}]}}]},vc);
assert(pv.ok&&pv.value.layers[0].start<=5&&pv.value.layers[0].keyframes.p1[0].v===1&&pv.value.layers[0].keyframes.p1[0].t<=pv.value.layers[0].duration,'tempos e valores do plano são limitados');
// shaders (testes 7 e 8)
Object.keys(SV.PRESETS).forEach(k=>assert(SV.validate(SV.PRESETS[k].code).ok,'shader nativo "'+k+'" passa no validador'));
const bad={'while':'vec4 lenziEffect(vec2 uv){ while(true){} return vec4(1.0);}','define':'#define X 1\nvec4 lenziEffect(vec2 uv){return vec4(1.0);}','uniform alheio':'vec4 lenziEffect(vec2 uv){return vec4(uSecret);}','laço enorme':'vec4 lenziEffect(vec2 uv){float a=0.0; for(int i=0;i<1000;i++){a+=1.0;} return vec4(a);}','laço variável':'vec4 lenziEffect(vec2 uv){float a=0.0; for(int i=0;i<int(uTime);i++){a+=1.0;} return vec4(a);}','sem função':'void foo(){}','textura':'vec4 lenziEffect(vec2 uv){return texture2D(t,uv);}','gl_ alheio':'vec4 lenziEffect(vec2 uv){gl_Position=vec4(0.0);return vec4(1.0);}','vazio':'','gigante':'vec4 lenziEffect(vec2 uv){return vec4(1.0);}'+' '.repeat(7000),'unicode':'vec4 lenziEffect(vec2 uv){return vec4(1.0);} // ação','main próprio':'void main(){} vec4 lenziEffect(vec2 uv){return vec4(1.0);}'};
Object.keys(bad).forEach(k=>assert(!SV.validate(bad[k]).ok,'shader inválido recusado: '+k));
assert(!AiSchema.validatePlan({layers:[{effect:'glsl',glsl:bad.while}]},vc).ok,'plano com shader inválido é recusado inteiro');
assert(AiSchema.validatePlan({layers:[{effect:'glsl',glsl:SV.PRESETS.lava.code}]},vc).ok,'plano com shader válido é aceito');
// planejador (teste 9)
const pl=P.planFromPrompt('Quero que a estátua rache, brilhe e depois vire ouro. 20 segundos');
assert(pl.duration===20&&pl.layers.map(l=>l.effect).join()==='ai-cracks,ai-glow,ai-gold','prompt vira plano na ordem certa: '+pl.layers.map(l=>l.effect));
assert(pl.layers[0].start<pl.layers[1].start&&pl.layers[1].start<pl.layers[2].start,'camadas em sequência no tempo');
assert(AiSchema.validatePlan(pl,vc).ok,'plano local passa no schema');
const cub=P.planFromPrompt('Crie uma animação neon que atravesse os quatro cubos');assert(cub.layers[0].effect==='ai-neon-lines'&&cub.layers[0].target==='each','neon + cubos = linhas em cada superfície');
const wall=P.planFromPrompt('Quero rachaduras luminosas e partículas saindo de uma parede');assert(wall.layers.map(l=>l.effect).join()==='ai-cracks,ai-particles','teste 3: rachaduras + partículas');
const rit=P.planFromPrompt('Faça os quatro cubos piscarem em neon no ritmo da música');assert(rit.layers.some(l=>l.beatSync&&l.effect==='ai-pulse'),'pedido de ritmo cria camada sincronizada');
assert(P.planFromPrompt('xyzzy').notes.length>0,'prompt sem palavras conhecidas avisa e usa ponto de partida');
// ponte (testes 10, 11, 13)
const seq=Seq.create({});const keys=['k1','k2','k3','k4'];const surf=keys.map(k=>({key:k,name:k}));
const base=Seq.addLayer(seq,'k1','Base');const ba=Seq.addAsset(seq,{kind:'fx',fx:{kind:'grade'}});const bc=Seq.addClip(seq,base.id,ba,1,4);Seq.setKey(bc,'opacity',0,0.5);
const clipBefore=JSON.stringify(bc);const surfQ=JSON.stringify([[0,0],[1,1]]);
const plan=AiSchema.validatePlan(cub,vc).value;const bt=B.applyToSeq(seq,plan,surf,{at:2});
assert(bt.clipIds.length===4&&bt.trackIds.length===4,'4 clipes em 4 faixas novas, uma por superfície');
const starts=bt.clipIds.map(id=>Seq.findClip(seq,id).clip.start);assert(starts.every((s,i)=>i===0||s>starts[i-1])&&starts[0]===2,'cascata a partir do ponto de inserção: '+starts.join());
assert(JSON.stringify(Seq.findClip(seq,bc.id).clip)===clipBefore,'clipe existente ficou idêntico (nada foi deslocado)');
assert(Seq.evaluate(seq,3).video.k1.length===2,'evaluate vê o clipe antigo e o novo juntos na mesma face');
const b2=B.applyToSeq(seq,AiSchema.validatePlan(pl,vc).value,surf,{at:0});
const crack=Seq.findClip(seq,b2.clipIds[0]).clip;assert(crack.keyframes.p1&&crack.keyframes.p1.length>=2&&crack.fadeIn>0,'keyframes de progresso e fade foram criados e são editáveis');
Seq.setKey(crack,'p1',1,0.9);assert(Seq.valueAt(crack,'p1',1)===0.9,'keyframe pode ser editado depois');
const mig=Seq.migrate(JSON.parse(JSON.stringify(seq)));assert(mig.tracks.reduce((n,t)=>n+t.clips.length,0)===seq.tracks.reduce((n,t)=>n+t.clips.length,0)&&Seq.findClip(mig,b2.clipIds[0]).clip.keyframes.p1.length===crack.keyframes.p1.length,'salvar/abrir (migrate) preserva clipes e keyframes da IA');
// desfazer
const host={seq:()=>seq,checkpoint(){},push(){},syncClock(){},renderAll(){},surfaces:()=>surf,now:()=>0};
const n0=seq.tracks.length;const hb=B.apply(AiSchema.validatePlan(cub,vc).value,host,{at:0});assert(seq.tracks.length===n0+4,'apply cria faixas');
B.undo(host);assert(seq.tracks.length===n0&&JSON.stringify(Seq.findClip(seq,bc.id).clip)===clipBefore,'undo remove só o que a IA criou');
// projeto antigo (teste 17)
const old=Seq.migrate({schema:1,id:'s',name:'antigo',duration:10,fps:30,tracks:[{id:'t1',type:'video',surfaceId:'k1',clips:[{id:'c1',assetId:'a1',start:0,duration:3}]}],assets:[{id:'a1',kind:'fx',fx:{kind:'grade'}}]});
assert(old.tracks[0].clips[0].fxp.p1===1&&old.tracks[0].clips[0].fxp.p2===1&&Seq.evaluate(old,1).video.k1[0].ev.p1===1,'projeto antigo (sem fxp) abre com valores neutros');
// áudio (teste 14/13 parte)
const sr=22050,N=sr*10,x=new Float32Array(N);for(let b=0;b*0.5<10;b++){const s=Math.round(b*0.5*sr);for(let k=0;k<2000&&s+k<N;k++)x[s+k]+=Math.sin(2*Math.PI*60*k/sr)*Math.exp(-k/500);}
const r1=AA.analyze(x,sr),r2=AA.analyze(x,sr);assert(r1.bpm===120&&r1.beats.length>=18,'BPM 120 e batidas detectadas ('+r1.bpm+', '+r1.beats.length+')');assert(JSON.stringify(r1)===JSON.stringify(r2),'análise de áudio é determinística');
const sq=Seq.create({});const tt=Seq.addLayer(sq,'k1','x');const bt3=B.applyToSeq(sq,AiSchema.validatePlan(rit,vc).value,[{key:'k1',name:'k1'}],{at:0,beats:r1.beats});
const pc=bt3.clipIds.map(id=>Seq.findClip(sq,id).clip).find(c=>c.keyframes.p2);const nearBeat=r1.beats.find(b=>b>pc.start+0.5&&b<pc.start+pc.duration-0.5);assert(nearBeat!=null&&pc.keyframes.p2&&pc.keyframes.p2.some(k=>Math.abs(k.t-(nearBeat-pc.start))<0.01&&k.v>1),'pulso cai exatamente nos tempos detectados das batidas');
const sq2=Seq.create({});Seq.addLayer(sq2,'k1','x');const bn=B.applyToSeq(sq2,AiSchema.validatePlan(rit,vc).value,[{key:'k1',name:'k1'}],{at:0});assert(bn.warnings.some(w=>/batidas/.test(w)),'sem batidas analisadas: avisa em vez de inventar tempos');
// imagem (teste 5)
const w=100,h=80,d=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++){const i=(y*w+xx)*4,ins=xx>=30&&xx<70&&y>=20&&y<60;d[i]=ins?200:20;d[i+1]=ins?180:30;d[i+2]=ins?40:90;d[i+3]=255;}
const img={width:w,height:h,data:d};const m=IT.maskFromRegion(img,{x:.25,y:.2,w:.5,h:.6});assert(Math.abs(IT.area(m)-0.2)<0.01,'máscara inicial acerta o objeto');
const m2=IT.paint(Uint8Array.from(m),w,h,5,5,3,true);assert(IT.area(m2)>IT.area(m),'pincel adiciona região');const m3=IT.paint(Uint8Array.from(m),w,h,50,40,6,false);assert(IT.area(m3)<IT.area(m),'pincel remove região');
assert(IT.area(IT.morph(m,w,h,3))>IT.area(m)&&IT.area(IT.morph(m,w,h,-3))<IT.area(m),'expandir e contrair a borda');assert(IT.feather(m,w,h,5)[40*w+30]>0&&IT.feather(m,w,h,5)[40*w+30]<255,'feather suaviza a borda');
assert(Math.abs(IT.area(IT.invert(m))-0.8)<0.01,'inverter máscara');
const dp=IT.depthFromLuma(img,{});const dpi=IT.depthFromLuma(img,{invert:true});assert(dp[40*w+50]+dpi[40*w+50]===255,'mapa de profundidade e inversão (heurística)');
const la=VA.localAnalysis(img,'cubes',4);assert(la.ok&&la.value.objects.length===5&&la.value.surfaces.length===4&&la.value.suggestions.length===3&&la.value.source==='local','análise local de 4 cubos (marcada como local)');
const q=IT.quadFromMask(m,w,h);assert(q&&q[0][0]<q[1][0]&&q[0][1]<q[3][1],'quadrilátero sugerido a partir da máscara');
