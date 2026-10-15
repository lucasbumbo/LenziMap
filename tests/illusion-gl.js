// Testes do motor WebGL do 3D Illusion Creator (Chromium + swiftshader). Mede pixels de verdade.
const {serve}=require('./h.js');
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const srv=await serve(8881);
 const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:900,height:600}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load/.test(m.text()))errs.push('console:'+m.text())});
 await p.goto('http://localhost:8881/tests/illusion-page.html');
 ok(await p.evaluate(()=>!!window.IllusionGL&&!!window.IllusionCore),'módulos carregam');
 ok(await p.evaluate(()=>window.IllusionGL.hasGl()),'WebGL disponível (swiftshader)');

 // helpers no navegador
 await p.evaluate(()=>{
  const C=window.IllusionCore,G=window.IllusionGL;
  window.T={C,G};
  window.rigWith=(faces)=>{const s=C.defaultStage();Object.assign(s.cubes[0].faces,faces);return s;};
  window.stats=(cv)=>{const x=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let lit=0,sum=0,mx=0;for(let i=0;i<x.length;i+=4){const v=x[i]+x[i+1]+x[i+2];if(x[i+3]>0&&v>20)lit++;sum+=v;if(v>mx)mx=v;}return {lit,frac:lit/(x.length/4),mean:sum/(x.length/4),mx};};
  // desenha uma ilusão numa face e devolve o canvas 2D
  window.face=(il,key,tms,W,H,ill)=>{const c=document.createElement('canvas');c.width=W||800;c.height=H||800;const f={kind:'illusion',illusion:il,ill:ill||null};G.draw(c,c.getContext('2d'),c.width,c.height,tms||0,f,key);return {c,f};};
 });

 // 1) Infinite Room por face, saída calibrada: textura entra no canvas 2D do renderer
 const room=await p.evaluate(()=>{
  const C=T.C;C.setRig(rigWith({front:'K1',left:'K2'}));
  const il=C.defaultIllusion('infinite-room');
  const a=face(il,'K1',0,640,640);const s=stats(a.c);
  const q=document.createElement('canvas');return {s,err:a.f._error,st:T.G.status()};
 });
 ok(!room.err,'Infinite Room: sem erro de desenho');
 ok(room.s.lit>2000&&room.s.frac>0.2,'Infinite Room: preenche a face ('+(room.s.frac*100).toFixed(0)+'% acesa)');
 ok(room.st.stats.ms<500,'Infinite Room: desenho de uma face em '+room.st.stats.ms.toFixed(1)+' ms (swiftshader, sem GPU)');

 // 2) A sala muda com o relógio e é periódica no espaçamento (loop contínuo)
 const loop=await p.evaluate(()=>{
  const C=T.C;const il=C.defaultIllusion('infinite-room');il.params.flow=16;il.params.spacing=16;// 1 s = 1 espaçamento, cores alternam: período de 2 s
  const px=(tms)=>{const a=face(il,'K1',tms,320,320);const d=a.c.getContext('2d').getImageData(0,0,320,320).data;return Array.from(d);};
  const A=px(0),B=px(500),A2=px(2000);let dAB=0,dAA=0;for(let i=0;i<A.length;i+=4){dAB+=Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1]);dAA+=Math.abs(A[i]-A2[i])+Math.abs(A[i+1]-A2[i+1]);}
  return {dAB,dAA,n:A.length/4};
 });
 ok(loop.dAB>loop.n*0.5,'tempo muda a imagem (diferença '+loop.dAB+')');
 ok(loop.dAA<loop.dAB*0.02,'volta idêntica depois de um período (2 espaçamentos, loop sem pulo, resíduo '+loop.dAA+')');

 // 3) Anamorfose de verdade: um ponto virtual cai exatamente onde o raio do olho cruza a face
 const ana=await p.evaluate(()=>{
  const C=T.C,G=T.G,out=[];C.setRig(rigWith({front:'K1'}));
  const il=C.defaultIllusion('object-emerging');il.style.obj='sphere';il.quality='high';
  const stage=C.rig;
  [[0,0,-20],[2,-3,-40],[-3,-2,-10]].forEach(lp=>{
   const r=C.resolveFace(stage,il,null,'K1',0);
   r.scene.prims=[C.PRESETS?{k:'sphere',p:lp,r:[0,0,0],s:[0.8,0.8,0.8],c:[1,1,1],e:1,a:1,add:false,wire:false,sh:0,n:0,ratio:0}:null];
   const W=512;G._renderFace(r,il,null,W,W);
   // centro de massa dos pixels acesos
   const cv=G._cv(),c2=document.createElement('canvas');c2.width=W;c2.height=W;const x=c2.getContext('2d');x.drawImage(cv,0,0);const d=x.getImageData(0,0,W,W).data;let sx=0,sy=0,m=0;
   for(let yy=0;yy<W;yy++)for(let xx=0;xx<W;xx++){const a=d[(yy*W+xx)*4+3];if(a>128){sx+=xx;sy+=yy;m++;}}
   const P=C.m.pt(r.frame.M,lp),pf=C.projectToFace(r.frame,r.eye,P);
   out.push({got:[sx/m/W,sy/m/W],want:[pf.u,pf.v],m});
  });
  return out;
 });
 ana.forEach((a,i)=>ok(a.m>10&&Math.abs(a.got[0]-a.want[0])<0.006&&Math.abs(a.got[1]-a.want[1])<0.006,'anamorfose '+i+': pixel em ('+a.got.map(v=>v.toFixed(3))+') previsto ('+a.want.map(v=>v.toFixed(3))+')'));

 // 4) Oclusão por buffer de profundidade, independente da ordem de envio
 const occ=await p.evaluate(()=>{
  const C=T.C,G=T.G;C.setRig(rigWith({front:'K1'}));const il=C.defaultIllusion('infinite-room');
  function run(order){
   const r=C.resolveFace(C.rig,il,null,'K1',0);
   const red={k:'box',p:[0,0,-10],r:[0,0,0],s:[6,6,1],c:[1,0,0],e:1,a:1,add:false,wire:false,sh:0,n:0,ratio:0};
   const grn={k:'box',p:[0,0,-40],r:[0,0,0],s:[30,30,1],c:[0,1,0],e:1,a:1,add:false,wire:false,sh:0,n:0,ratio:0};
   r.scene.prims=order?[red,grn]:[grn,red];G._renderFace(r,il,null,256,256);
   const cv=G._cv(),c2=document.createElement('canvas');c2.width=256;c2.height=256;const x=c2.getContext('2d');x.drawImage(cv,0,0);
   const pr=C.projectToFace(r.frame,r.eye,C.m.pt(r.frame.M,[0,0,-10])),px=x.getImageData(Math.round(pr.u*256),Math.round(pr.v*256),1,1).data;
   const edge=x.getImageData(20,20,1,1).data;return {c:Array.from(px),e:Array.from(edge)};
  }
  return {a:run(true),b:run(false)};
 });
 ok(occ.a.c[0]>150&&occ.a.c[1]<60,'oclusão: objeto perto (vermelho) tapa o de trás (verde)');
 ok(occ.b.c[0]>150&&occ.b.c[1]<60,'oclusão não depende da ordem de envio');
 ok(occ.a.e[1]>100&&occ.a.e[0]<60,'fora do objeto perto aparece o plano de trás (verde)');

 // 5) Recorte pela face: o que está na frente do plano da face some (clip) ou aparece (sem clip)
 const clip=await p.evaluate(()=>{
  const C=T.C,G=T.G;C.setRig(rigWith({front:'K1'}));
  function lit(preset){const il=C.defaultIllusion(preset);const r=C.resolveFace(C.rig,il,null,'K1',0);
   r.scene.prims=[{k:'box',p:[0,0,8],r:[0,0,0],s:[3,3,3],c:[1,1,1],e:1,a:1,add:false,wire:false,sh:0,n:0,ratio:0}];
   G._renderFace(r,il,null,128,128);const cv=G._cv(),c2=document.createElement('canvas');c2.width=128;c2.height=128;const x=c2.getContext('2d');x.drawImage(cv,0,0);
   const d=x.getImageData(0,0,128,128).data;let m=0;for(let i=3;i<d.length;i+=4)if(d[i]>128)m++;return {m,clip:C.PRESETS[preset].clip};}
  return {inside:lit('infinite-room'),emerging:lit('object-emerging')};
 });
 ok(clip.inside.clip===true&&clip.inside.m===0,'recorte: objeto na frente da face não aparece em preset com clip (Infinite Room)');
 ok(clip.emerging.clip===false&&clip.emerging.m>20,'sem recorte: objeto pode sair da face ('+clip.emerging.m+' px)');

 // 6) todos os presets desenham, em todas as faces visíveis, sem erro e com pixels
 const all=await p.evaluate(()=>{
  const C=T.C,res={};C.setRig(rigWith({front:'F',left:'L',top:'T'}));
  C.PRESET_ORDER.forEach(pr=>{const il=C.defaultIllusion(pr);res[pr]={};['F','L','T'].forEach(k=>{const a=face(il,k,1200,320,320);const s=stats(a.c);res[pr][k]={lit:s.lit,err:a.f._error};});});
  return res;
 });
 Object.keys(all).forEach(pr=>{const r=all[pr];ok(!r.F.err&&r.F.lit>200,pr+': face frente desenha ('+r.F.lit+' px)');ok(r.L.lit>=0&&!r.L.err&&r.T.lit>=0&&!r.T.err,pr+': faces esquerda e topo sem erro (esq '+r.L.lit+', topo '+r.T.lit+')');});

 // 7) animação por parâmetro (ill) muda a cena
 const anim=await p.evaluate(()=>{
  const C=T.C;C.setRig(rigWith({front:'K1'}));
  const il=C.defaultIllusion('opening-cube');
  const cl=face(il,'K1',0,256,256,{open:0});const op=face(il,'K1',0,256,256,{open:1});
  const a=cl.c.getContext('2d').getImageData(0,0,256,256).data,b=op.c.getContext('2d').getImageData(0,0,256,256).data;let d=0;for(let i=0;i<a.length;i++)d+=Math.abs(a[i]-b[i]);
  const bk=C.defaultIllusion('breaking-surface');const b0=face(bk,'K1',0,256,256,{brk:0}),b1=face(bk,'K1',0,256,256,{brk:1});
  const x=b0.c.getContext('2d').getImageData(0,0,256,256).data,y=b1.c.getContext('2d').getImageData(0,0,256,256).data;let d2=0;for(let i=0;i<x.length;i++)d2+=Math.abs(x[i]-y[i]);
  return {d,d2};
 });
 ok(anim.d>50000,'Opening Cube: abrir muda a imagem ('+anim.d+')');
 ok(anim.d2>50000,'Breaking Surface: quebrar muda a imagem ('+anim.d2+')');

 // 8) qualidade Low/Medium/High
 const q=await p.evaluate(()=>{const G=T.G;return {l:G.sizeFor(1600,900,'low'),m:G.sizeFor(1600,900,'medium'),h:G.sizeFor(1600,900,'high')};});
 ok(q.l[0]<q.m[0]&&q.m[0]<q.h[0]&&q.l[0]<=320&&q.m[0]<=640,'qualidade: Low '+q.l+' < Medium '+q.m+' < High '+q.h);

 // 9) palco: Audience, Free e Projector
 const stage=await p.evaluate(()=>{
  const C=T.C,G=T.G;C.setRig(rigWith({front:'K1',left:'K2',top:'K3'}));const il=C.defaultIllusion('infinite-room');il.target.faces=['front','left','top'];
  const out={};['audience','free','projector'].forEach(v=>{const c=document.createElement('canvas');c.width=480;c.height=300;const okk=G.drawStage(c,{rig:C.rig,il,ill:null,t:0.5,view:v,orbit:{yaw:35,pitch:25,dist:90}});const s=stats(c);out[v]={ok:okk,lit:s.lit,mx:s.mx};});
  return out;
 });
 ok(stage.audience.ok&&stage.audience.lit>5000,'Audience View desenha o palco ('+stage.audience.lit+' px)');
 ok(stage.free.ok&&stage.free.lit>5000,'Free Camera desenha o palco ('+stage.free.lit+' px)');
 ok(stage.projector.ok&&stage.projector.lit>2000,'Projector Output mostra as texturas planas ('+stage.projector.lit+' px)');

 // 10) falha de WebGL: perde o contexto e continua desenhando em 2D, sem exceção
 const lost=await p.evaluate(async()=>{
  const C=T.C,G=T.G;C.setRig(rigWith({front:'K1'}));const il=C.defaultIllusion('infinite-room');let thrown=null,pre=null,post=null;
  try{G._forceLoss();await new Promise(r=>setTimeout(r,120));const a=face(il,'K1',0,256,256);post={lit:stats(a.c).lit,err:a.f._error,ok:G.status().ok};
   await new Promise(r=>setTimeout(r,1700));const b=face(il,'K1',0,256,256);pre={lit:stats(b.c).lit,err:b.f._error,ok:G.status().ok};}catch(e){thrown=String(e)}
  return {thrown,post,pre};
 });
 ok(!lost.thrown,'perda de contexto não lança exceção');
 ok(lost.post&&lost.post.lit>500,'durante a perda: versão 2D simples desenha ('+(lost.post&&lost.post.lit)+' px)');
 ok(lost.pre&&lost.pre.lit>500,'depois da perda: segue desenhando ('+(lost.pre&&lost.pre.lit)+' px, webgl '+(lost.pre&&lost.pre.ok)+')');

 // 10b) base compartilhada: palco sem ilusão com texturas externas; vista da plateia enquadra o cubo alvo
 const sh=await p.evaluate(()=>{const G=T.G,C=T.C;const rig=C.defaultStage();const tx=document.createElement('canvas');tx.width=64;tx.height=64;const x=tx.getContext('2d');x.fillStyle='#2f9';x.fillRect(0,0,64,64);
  const c=document.createElement('canvas');c.width=400;c.height=300;const okk=G.drawStage(c,{rig,il:null,view:'free',orbit:{yaw:20,pitch:20,dist:70},faceTextures:{'A:front':tx,'A:top':tx}});
  const d=c.getContext('2d').getImageData(0,0,400,300).data;let g=0;for(let i=0;i<d.length;i+=4)if(d[i+1]>150&&d[i]<120)g++;
  const c2=document.createElement('canvas');c2.width=400;c2.height=300;const bad=G.drawStage(c2,{rig,il:null,view:'free'});
  return {okk,g,bad};});
 ok(sh.okk&&sh.g>300,'drawStage genérico desenha faceTextures sem ilusão ('+sh.g+' px verdes)');
 ok(sh.bad===false,'sem ilusão e sem texturas: retorna false sem lançar');
 // 11) entrada inválida não derruba
 const bad=await p.evaluate(()=>{const G=T.G;let ex=null;try{const c=document.createElement('canvas');c.width=64;c.height=64;G.draw(c,c.getContext('2d'),64,64,0,{kind:'illusion',illusion:{preset:'x'}},'K');G.draw(c,c.getContext('2d'),64,64,0,{kind:'illusion'},'K');G.draw(c,c.getContext('2d'),64,64,0,{kind:'illusion',illusion:'{"a":1}'},'K');}catch(e){ex=String(e)}return ex;});
 ok(!bad,'ilusão inválida ou ausente não lança exceção');
 ok(errs.length===0,'erros de página: '+(errs.join('|')||'nenhum'));
 await b.close();srv.close();
 console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})().catch(e=>{console.log('FAIL excecao',e.message);process.exit(1);});
