// Fase 8 (núcleo puro): âncora, flip, reset, grade, réguas, áreas seguras, guias, motion path, visualização persistente.
const V=require('../viewer-core.js');const Seq=require('../sequence.js');
let fails=0;const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c){fails++;process.exitCode=1;}};
const near=(a,b,e)=>Math.abs(a-b)<(e||1e-6);
// visualização
const d=V.defaultView();assert(!d.grid.on&&!d.rulers&&!d.safe.on&&d.guides.length===0,'padrões: tudo desligado');
const s=V.sanitizeView({grid:{on:1,div:999},safe:{on:1,action:5,title:0},guides:[{axis:'v',pos:2},{axis:'x',pos:.5},null,{id:'a b',axis:'h',pos:-1}],rulers:1});
assert(s.grid.div===64&&s.safe.action===1&&s.safe.title===0.4,'valores limitados');
assert(s.guides.length===2&&s.guides[0].pos===1&&s.guides[1].pos===0,'guias inválidas descartadas e posição limitada');
assert(V.sanitizeView(undefined).guides.length===0&&V.sanitizeView('x').grid.div===10,'entrada inválida cai nos padrões');
const v=V.defaultView();const g1=V.addGuide(v,'v',0.25).guide,g2=V.addGuide(v,'h',0.75).guide;
assert(v.guides.length===2&&g1.id!==g2.id,'adiciona guias com ids diferentes');
assert(V.moveGuide(v,g1.id,0.4).ok&&near(v.guides[0].pos,0.4)&&!V.moveGuide(v,'zz',0.1).ok,'move guia');
assert(V.removeGuide(v,g1.id).ok&&v.guides.length===1&&V.clearGuides(v).count===1&&v.guides.length===0,'remove e limpa guias');
for(let i=0;i<V.MAX_GUIDES;i++)V.addGuide(v,'v',i/100);assert(!V.addGuide(v,'v',.5).ok,'limite de guias');
assert(!V.addGuide(v,'z',.5).ok,'eixo inválido recusado');
// grade, áreas seguras, réguas
v.guides=[];v.grid={on:true,div:4};
let gl=V.gridLines(v,1600,900);assert(gl.v.join()==='400,800,1200'&&gl.h.join()==='225,450,675','grade 4x4');
let sr=V.safeRects({safe:{on:true,action:.9,title:.8}},1000,500);assert(near(sr[0].w,900)&&near(sr[0].x,50)&&near(sr[1].h,400)&&near(sr[1].y,50),'áreas seguras centradas');
assert(V.niceStep(0.7)===1&&V.niceStep(1.5)===2&&V.niceStep(3)===5&&V.niceStep(7)===10&&V.niceStep(130)===200,'passo bonito 1-2-5');
let tk=V.rulerTicks(1600,800,48);assert(tk[0].v===0&&tk[0].major&&tk.filter(t=>t.major).length>=3&&tk[tk.length-1].v<=1600,'régua tem marcas principais e secundárias');
const tkA=V.rulerTicks(1600,400,48),tkB=V.rulerTicks(1600,1600,48);assert(tkB.length>tkA.length,'régua mais detalhada com mais zoom');
// ímã
const vw=V.sanitizeView({grid:{on:true,div:4},guides:[{id:'g',axis:'v',pos:.1},{id:'h',axis:'h',pos:.9}],safe:{on:true}});
const T=V.snapTargets(vw,1000,500);assert(T.x.includes(100)&&T.x.includes(500)&&T.x.includes(250)&&T.y.includes(450),'alvos de ímã: guias, centro, grade');
assert(V.nearest(T.x,103,8)===100&&V.nearest(T.x,150,8)===null,'ímã respeita a tolerância');
// âncora: com ax=ay=0 o quadrilátero é idêntico ao modelo antigo (rodado manualmente aqui)
const P0={x:.1,y:-.05,scale:1.3,sx:1,sy:1,rot:25,corners:[[0,0],[0,0],[0,0],[0,0]]};
// compensar a âncora não pode mover o quadro na tela
const q0=Seq.quadOf(1600,900,P0);
const a2=[0.2,-0.15],comp=V.compensateAnchor(P0,1600,900,a2);const P1=Object.assign({},P0,comp);
const q1=Seq.quadOf(1600,900,P1);
assert(q0.every((p,i)=>near(p[0],q1[i][0],1e-6)&&near(p[1],q1[i][1],1e-6)),'mover a âncora com compensação não move o quadro (rot+escala)');
const P2=Object.assign({},P0,{ax:.2,ay:-.15});const q2=Seq.quadOf(1600,900,P2);
assert(q0.some((p,i)=>!near(p[0],q2[i][0],1e-3)),'mover a âncora SEM compensar muda o quadro (confirma que a âncora é usada)');
// com flip
const PF=Object.assign({},P0,{flipH:true,flipV:true});const qf0=Seq.quadOf(1600,900,PF);const cf=V.compensateAnchor(PF,1600,900,a2);const qf1=Seq.quadOf(1600,900,Object.assign({},PF,cf));
assert(qf0.every((p,i)=>near(p[0],qf1[i][0],1e-6)&&near(p[1],qf1[i][1],1e-6)),'compensação funciona com flip H e V');
// flip: gira em torno da âncora; flip duplo = rotação de 180
const Pi={x:0,y:0,scale:1,sx:1,sy:1,rot:0,corners:[[0,0],[0,0],[0,0],[0,0]]};
const qh=Seq.quadOf(1600,900,Object.assign({},Pi,{flipH:true}));assert(near(qh[0][0],1600)&&near(qh[1][0],0)&&near(qh[0][1],0),'Flip H espelha na horizontal');
const qv=Seq.quadOf(1600,900,Object.assign({},Pi,{flipV:true}));assert(near(qv[0][1],900)&&near(qv[3][1],0)&&near(qv[0][0],0),'Flip V espelha na vertical');
const qhv=Seq.quadOf(1600,900,Object.assign({},Pi,{flipH:true,flipV:true})),q180=Seq.quadOf(1600,900,Object.assign({},Pi,{rot:180}));
assert(qhv.every((p,i)=>near(p[0],q180[i][0],1e-6)&&near(p[1],q180[i][1],1e-6)),'Flip H + V = girar 180 graus');
// âncora em canto: girar 90 graus em torno do canto superior esquerdo
const qa=Seq.quadOf(1600,900,Object.assign({},Pi,{rot:90,ax:-.5,ay:-.5}));assert(near(qa[0][0],0,1e-6)&&near(qa[0][1],0,1e-6)&&near(qa[1][0],0,1e-6)&&near(qa[1][1],1600,1e-6),'âncora no canto: o canto fica parado e o quadro gira em torno dele');
// identidade continua identidade
assert(Seq.isIdentity(Object.assign({},Pi,{ax:.3,ay:.3})),'âncora sozinha, sem transformação, continua identidade');
assert(Seq.isIdentity(Pi)&&!Seq.isIdentity(Object.assign({},Pi,{flipH:true})),'flip deixa de ser identidade');
// reset
const c={transform:Seq.newTransform(),keyframes:{x:[{t:0,v:0,i:'linear'}],cl:[{t:0,v:0,i:'linear'}],opacity:[{t:0,v:1,i:'linear'}]}};
Object.assign(c.transform,{x:.3,y:.2,scale:2,rot:40,ax:.1,flipH:true,crop:{l:.1,t:.1,r:.1,b:.1}});c.transform.corners[2]=[.1,.1];
const r=V.resetTransform(c);
assert(c.transform.x===0&&c.transform.scale===1&&c.transform.rot===0&&c.transform.ax===0&&!c.transform.flipH&&c.transform.crop.l===0&&c.transform.corners[2][0]===0,'Reset zera transformação, âncora, flip, corte e distorção');
assert(r.keysRemoved===2&&!c.keyframes.x&&!c.keyframes.cl&&c.keyframes.opacity,'Reset remove só keyframes de transformação (opacidade fica)');
const c2={transform:Seq.newTransform(),keyframes:{x:[{t:0,v:0,i:'linear'}]}};V.resetTransform(c2,true);assert(c2.keyframes.x,'Reset pode manter keyframes');
assert(V.toggleFlip(c2,'h').flipH===true&&V.toggleFlip(c2,'h').flipH===false&&V.toggleFlip(c2,'v').flipV===true,'alterna flips');
// motion path
const cm={duration:4,loopMode:'none',loopLen:null,transform:Seq.newTransform(),keyframes:{x:[{t:0,v:-.25,i:'linear'},{t:2,v:.25,i:'linear'}],y:[{t:0,v:0,i:'linear'},{t:1,v:.2,i:'linear'}]}};
const mp=V.motionPath(Seq,cm,1600,900,32);assert(mp.animated&&mp.pts.length===33,'motion path amostrado');
assert(near(mp.pts[0][0],400)&&near(mp.pts[0][1],450),'começa no 1º keyframe (centro + x*W)');
assert(near(mp.pts[16][0],1200,1e-6)&&near(mp.pts[16][1],450+0.2*900,1e-6),'meio da trajetória (t=2 s): x=1200, y=630');
assert(mp.keys.length===3&&mp.keys[0].hasX&&mp.keys[0].hasY&&!mp.keys[1].hasX&&mp.keys[1].hasY&&mp.keys[2].hasX&&!mp.keys[2].hasY,'pontos-chave por keyframe de x e de y');
assert(!V.motionPath(Seq,{duration:2,transform:Seq.newTransform(),keyframes:{}},1600,900).animated,'sem keyframes: sem trajetória');
console.log(fails?'HA FALHAS':'ok');
