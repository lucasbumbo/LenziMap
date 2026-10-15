// Fase 5: operacoes de edicao avancada (ripple, roll, slip, slide, selecao, alinhamento, marcadores, snap). Tudo em Node, sem DOM.
const S=require('../sequence.js'),E=require('../timeline-edit-core.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
function mkSeq(){const seq=S.create();seq.duration=60;
 const v=S.addAsset(seq,{kind:'video',name:'v.mp4',path:'/v.mp4',duration:20});
 const fx=S.addAsset(seq,{kind:'fx',name:'fx',fx:{kind:'grade'}});
 const t1=S.addTrack(seq,'video','kA','A'),t2=S.addTrack(seq,'video','kB','B');
 return {seq,v,fx,t1,t2};}
// ---------- selecao ----------
{const {seq,v,t1,t2}=mkSeq();
 const a=S.addClip(seq,t1.id,v,0,4),b=S.addClip(seq,t1.id,v,5,3),c=S.addClip(seq,t1.id,v,10,2),d=S.addClip(seq,t2.id,v,2,6),e=S.addClip(seq,t2.id,v,20,2);
 let r=E.selectRange(seq,a.id,c.id);assert(r.length===3&&r.includes(b.id),'Shift+clique: intervalo na mesma faixa pega os 3 clipes');
 r=E.selectRange(seq,c.id,a.id);assert(r.length===3,'intervalo funciona de trás pra frente');
 r=E.selectRange(seq,a.id,d.id);assert(r.includes(a.id)&&r.includes(d.id)&&r.includes(b.id)&&!r.includes(e.id),'intervalo entre faixas pega o retângulo (tempo x faixas)');
 r=E.selectRect(seq,4.5,11,0,0);assert(r.length===2&&r.includes(b.id)&&r.includes(c.id),'retângulo: só clipes que cruzam o tempo na faixa');
 r=E.selectRect(seq,0,30,0,1);assert(r.length===5,'retângulo cobrindo tudo seleciona 5');
 r=E.selectForward(seq,6,null);assert(r.includes(b.id)&&r.includes(c.id)&&r.includes(e.id)&&!r.includes(a.id),'selecionar à frente a partir de 6s (inclui os que atravessam)');
 r=E.selectForward(seq,6,t1.id);assert(!r.includes(e.id),'selecionar à frente só numa faixa');
 assert(E.selectTrack(seq,t2.id).length===2,'selecionar faixa');
 const bd=E.bounds(seq,[a.id,c.id]);assert(near(bd.start,0)&&near(bd.end,12),'limites da seleção');
 let pts=E.editPoints(seq);assert(near(pts[0],0)&&pts.includes(4)&&pts.includes(5)&&pts.includes(22),'pontos de edição de todas as faixas');
 assert(near(E.nextEdit(seq,0,1),2)&&near(E.nextEdit(seq,5,-1),4)&&E.nextEdit(seq,100,1)===null,'próximo/anterior ponto de edição');
 S.addMarker(seq,7.5,'x');assert(near(E.nextEdit(seq,6,1,true),7.5)&&near(E.nextEdit(seq,6,1,false),8),'pontos de edição podem incluir marcadores');}
// ---------- ripple ----------
{const {seq,v,t1,t2}=mkSeq();
 const a=S.addClip(seq,t1.id,v,0,4),b=S.addClip(seq,t1.id,v,4,3),c=S.addClip(seq,t1.id,v,10,2),o=S.addClip(seq,t2.id,v,5,3);
 let r=E.rippleTrim(seq,a.id,'r',3);assert(r.ok&&near(a.duration,3)&&near(b.start,3)&&near(c.start,9),'ripple trim (direita) encurta e puxa os seguintes da MESMA faixa');
 assert(near(o.start,5),'ripple NUNCA mexe em outra faixa');
 r=E.rippleTrim(seq,a.id,'r',5);assert(near(a.duration,5)&&near(b.start,5)&&near(c.start,11),'ripple trim estendendo empurra os seguintes');
 const inB=b.inPoint;r=E.rippleTrim(seq,b.id,'l',b.start+1);assert(near(b.start,5)&&near(b.duration,2)&&near(b.inPoint,inB+1)&&near(c.start,10),'ripple trim (esquerda): início fica, mídia avança, seguintes recuam');
 t1.locked=true;r=E.rippleTrim(seq,a.id,'r',2);assert(!r.ok&&near(a.duration,5),'faixa travada recusa ripple');t1.locked=false;
 r=E.rippleDelete(seq,[b.id]);assert(r.ok&&!t1.clips.includes(b)&&near(c.start,8)&&near(o.start,5),'ripple delete fecha o buraco só na faixa');
 const {seq:s2,v:v2,t1:u1}=mkSeq();const x=S.addClip(s2,u1.id,v2,0,2),y=S.addClip(s2,u1.id,v2,2,2),z=S.addClip(s2,u1.id,v2,4,2),w=S.addClip(s2,u1.id,v2,6,2);
 E.rippleDelete(s2,[x.id,z.id]);assert(near(y.start,0)&&near(w.start,2),'ripple delete de vários: cada buraco fecha uma vez');
 const {seq:s3,v:v3,t1:g1}=mkSeq();const p=S.addClip(s3,g1.id,v3,1,2),q=S.addClip(s3,g1.id,v3,6,2),w2=S.addClip(s3,g1.id,v3,12,1);
 r=E.closeGaps(s3,g1.id);assert(near(p.start,1)&&near(q.start,3)&&near(w2.start,5),'fechar espaços: primeiro clipe fica, o resto encosta');
 g1.locked=true;assert(!E.closeGaps(s3,g1.id).ok,'fechar espaços recusa faixa travada');}
// ---------- roll ----------
{const {seq,v,t1}=mkSeq();
 const a=S.addClip(seq,t1.id,v,0,4);a.inPoint=2;const b=S.addClip(seq,t1.id,v,4,4);b.inPoint=5;
 let r=E.rollEdit(seq,a.id,b.id,5);assert(r.ok&&near(a.duration,5)&&near(b.start,5)&&near(b.duration,3)&&near(b.inPoint,6),'roll: corte vai de 4 pra 5, B começa mais tarde na mídia');
 assert(near(a.start+a.duration+b.duration,8),'roll mantém a duração total');
 r=E.rollEdit(seq,a.id,b.id,3);assert(near(a.duration,3)&&near(b.start,3)&&near(b.inPoint,4),'roll pra trás devolve mídia a B');
 r=E.rollEdit(seq,a.id,b.id,-5);assert(near(b.inPoint,0)||b.inPoint>=0,'roll não deixa B recuar antes do começo da mídia ('+b.inPoint.toFixed(2)+')');
 assert(b.start>=a.start+0.04,'roll mantém A com pelo menos 1 quadro');
 const far=S.addClip(seq,t1.id,v,30,2);assert(!E.rollEdit(seq,a.id,far.id,3).ok,'roll só entre vizinhos');
 t1.locked=true;assert(!E.rollEdit(seq,a.id,b.id,3.5).ok,'roll recusa faixa travada');}
// ---------- slip ----------
{const {seq,v,fx,t1}=mkSeq();
 const a=S.addClip(seq,t1.id,v,3,5);a.inPoint=4;const start=a.start,dur=a.duration;
 let r=E.slipClip(seq,a.id,2);assert(r.ok&&near(a.inPoint,6)&&near(a.start,start)&&near(a.duration,dur),'slip: inPoint muda, início e duração não');
 r=E.slipClip(seq,a.id,100);assert(near(a.inPoint,15),'slip limitado pelo fim da mídia (20 - 5 = 15)');
 r=E.slipClip(seq,a.id,-100);assert(near(a.inPoint,0),'slip limitado pelo começo da mídia');
 a.speed=2;E.slipClip(seq,a.id,0);r=E.slipClip(seq,a.id,100);assert(near(a.inPoint,10),'slip respeita a velocidade (5s a 2x usa 10s da mídia)');
 const f=S.addClip(seq,t1.id,fx,20,3);assert(!E.slipClip(seq,f.id,1).ok,'slip recusa efeito (sem mídia)');
 a.loopMode='loop';assert(!E.slipClip(seq,a.id,1).ok,'slip recusa clipe em loop');}
// ---------- slide ----------
{const {seq,v,t1,t2}=mkSeq();
 const p=S.addClip(seq,t1.id,v,0,4);p.inPoint=0;const c=S.addClip(seq,t1.id,v,4,2);const n=S.addClip(seq,t1.id,v,6,5);n.inPoint=3;const o=S.addClip(seq,t2.id,v,4,2);
 let r=E.slideClip(seq,c.id,5);assert(r.ok&&near(c.start,5)&&near(p.duration,5)&&near(n.start,7)&&near(n.duration,4)&&near(n.inPoint,4),'slide: clipe anda 1s, anterior estica, seguinte encolhe e avança na mídia');
 assert(near(c.duration,2)&&near(end(n),11),'slide mantém a duração do clipe e o fim do conjunto');
 function end(x){return x.start+x.duration}
 r=E.slideClip(seq,c.id,0);assert(near(p.duration,p.duration)&&c.start>=0.04,'slide limitado pelo mínimo do anterior ('+c.start.toFixed(2)+')');
 assert(near(o.start,4),'slide NUNCA mexe em outra faixa');
 const solo=S.addClip(seq,t2.id,v,20,2);r=E.slideClip(seq,solo.id,25);assert(near(solo.start,25),'sem vizinhos o slide vira mover');
 t1.locked=true;assert(!E.slideClip(seq,c.id,6).ok,'slide recusa faixa travada');}
// ---------- varios clipes ----------
{const {seq,v,t1,t2}=mkSeq();
 const a=S.addClip(seq,t1.id,v,2,3),b=S.addClip(seq,t1.id,v,8,4),c=S.addClip(seq,t2.id,v,5,2);
 let r=E.nudge(seq,[a.id,b.id,c.id],0.5);assert(r.ok&&near(a.start,2.5)&&near(b.start,8.5)&&near(c.start,5.5),'nudge move todos');
 E.nudge(seq,[a.id,b.id,c.id],-10);assert(near(a.start,0)&&near(b.start,6)&&near(c.start,3),'nudge para no zero sem deformar o grupo');
 E.alignTo(seq,[a.id,b.id,c.id],10,'start');assert([a,b,c].every(x=>near(x.start,10)),'alinhar começos ao playhead');
 E.alignTo(seq,[a.id,b.id],20,'end');assert(near(a.start+a.duration,20)&&near(b.start+b.duration,20),'alinhar fins');
 r=E.equalLength(seq,[a.id,b.id,c.id]);assert(near(b.duration,3)&&near(c.duration,3),'mesma duração do primeiro');
 a.start=0;b.start=10;E.joinSelected(seq,[a.id,b.id]);assert(near(b.start,3),'emendar clipes selecionados da mesma faixa');
 const keep=c.start;E.joinSelected(seq,[a.id,b.id]);assert(near(c.start,keep),'emendar não mexe em outras faixas');
 t1.locked=true;const st=a.start;E.nudge(seq,[a.id],1);assert(near(a.start,st),'operações em lote ignoram faixa travada');}
// ---------- marcadores ----------
{const seq=S.create();seq.duration=30;
 const m1=S.addMarker(seq,5,'A'),m2=S.addMarker(seq,2,'B');
 assert(seq.markers[0].t===2,'marcadores ordenados');
 E.renameMarker(seq,m1.id,'Refrão');E.colorMarker(seq,m1.id,'#ff0000');E.moveMarker(seq,m1.id,1);
 assert(seq.markers[0].id===m1.id&&seq.markers[0].name==='Refrão'&&seq.markers[0].color==='#ff0000'&&near(seq.markers[0].t,1),'renomear, colorir e mover (reordena)');
 assert(!E.colorMarker(seq,m1.id,'vermelho'),'cor inválida recusada');
 assert(E.nextMarker(seq,1.5,1).id===m2.id&&E.nextMarker(seq,2,-1).id===m1.id&&E.nextMarker(seq,5,1)===null,'próximo/anterior marcador');
 const fx=S.migrate(JSON.parse(JSON.stringify(seq)));assert(fx.markers[0].color==='#ff0000'&&fx.markers[0].name==='Refrão','marcador sobrevive ao salvar/abrir');
 const old=S.migrate({markers:[{id:'x',t:3,name:'velho'}]});assert(old.markers[0].color==='#ffd23d','marcador antigo ganha cor padrão');
 assert(E.removeMarker(seq,m2.id)&&seq.markers.length===1,'remover marcador');}
// ---------- snap configuravel ----------
{const seq=S.create();seq.duration=60;const t=S.addTrack(seq,'video','k','A');const a=S.asset?null:null;
 const as=S.addAsset(seq,{kind:'fx',name:'f',fx:{kind:'grade'}});const c=S.addClip(seq,t.id,as,10,5);S.addMarker(seq,20,'m');
 assert(near(S.snapTime(seq,10.05,0.1,null,null),10),'snap em borda de clipe');
 assert(near(S.snapTime(seq,20.03,0.1,null,null),20),'snap em marcador');
 assert(near(S.snapTime(seq,30.04,0.1,30,null),30),'snap no playhead');
 seq.settings.snapOpts={clips:false};assert(near(S.snapTime(seq,10.05,0.1,null,null),10.05),'desligar "clipes" tira o encaixe nas bordas');
 seq.settings.snapOpts={markers:false,clips:false};assert(near(S.snapTime(seq,20.03,0.1,null,null),20.03),'desligar "marcadores"');
 seq.settings.snapOpts={playhead:false,markers:false,clips:false};assert(near(S.snapTime(seq,30.04,0.1,30,null),30.04),'desligar "playhead"');
 seq.settings.snapOpts={playhead:false,markers:false,clips:false,grid:0.5};assert(near(S.snapTime(seq,30.43,0.1,null,null),30.5),'grade de 0,5 s');
 const fx=S.migrate(JSON.parse(JSON.stringify(seq)));assert(fx.settings.snapOpts.grid===0.5&&fx.settings.snapOpts.clips===false,'opções do imã persistem');
 const old=S.migrate({settings:{snap:true}});assert(old.settings.snapOpts.clips===true&&old.settings.snapOpts.px===8,'projeto antigo: tudo ligado por padrão');}
console.log('ok');
