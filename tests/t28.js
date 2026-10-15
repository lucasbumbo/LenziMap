// Orientação das faces: um objeto colocado em cima e à direita (no quadro da face) tem que aparecer em cima e à direita
// na textura da face e no ponto certo do cubo 3D, vendo cada face de fora.
const {serve}=require('./h.js');
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const fs=require('fs');
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const srv=await serve(8888);
 const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1000,height:700}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8888/tests/illusion-page.html');
 const res=await p.evaluate(()=>{
  const C=window.IllusionCore,G=window.IllusionGL,out={};
  const rig=C.defaultStage();
  const faces=['front','right','back','left','top'];
  faces.forEach((f,i)=>{rig.cubes[0].faces[f]='S'+i;});
  const il=C.defaultIllusion('object-emerging');
  il.target.cube='A';il.target.faces=faces.slice();
  il.params.ox=4;il.params.oy=4;il.params.oz=0;il.params.osize=0.6;il.params.spin=0;il.params.depth=60;
  il.camera.assist=false;
  // 1) textura de cada face: centroide da parte acesa (0..1, y pra baixo)
  faces.forEach(f=>{
   const fr=C.faceFrame(rig.cubes[0],f);rig.viewer.pos=[fr.center[0]+fr.n[0]*130,fr.center[1]+fr.n[1]*130,fr.center[2]+fr.n[2]*130];if(f!=='top'){rig.viewer.pos[1]=fr.center[1]+10;}
   const c=G.faceTexture(rig,il,null,'A',f,0,256);
   const d=c.getContext('2d').getImageData(0,0,256,256).data;let sx=0,sy=0,w=0;
   for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,v=(d[i]+d[i+1]+d[i+2])*(d[i+3]/255);if(v>60){sx+=x*v;sy+=y*v;w+=v;}}
   out[f]=w?{x:sx/w/256,y:sy/w/256,w}:null;
  });
  return out;
 });
 console.log(JSON.stringify(res));
 // Para cada face: o ponto de luz (centroide) deve ficar em cima (y<0.5) e à direita (x>0.5) do quadro da face
 ['front','right','back','left','top'].forEach(f=>{const r=res[f];ok(r&&r.x>0.5&&r.y<0.5,'textura '+f+': objeto em cima e à direita ('+(r?r.x.toFixed(2)+','+r.y.toFixed(2):'vazio')+')');});
 // 2) cubo 3D: de fora, cada face mostra o objeto no ponto de mundo certo (centro + r*ox + u*oy)
 const shots=await p.evaluate(()=>{
  const C=window.IllusionCore,G=window.IllusionGL,rig=C.defaultStage();
  const faces=['front','right','back','left','top'];faces.forEach((f,i)=>{rig.cubes[0].faces[f]='S'+i;});
  const il=C.defaultIllusion('object-emerging');il.target.cube='A';il.target.faces=faces.slice();il.params.ox=4;il.params.oy=4;il.params.oz=0;il.params.osize=0.6;il.params.spin=0;il.camera.assist=false;
  const views={front:{yaw:0,pitch:5},right:{yaw:90,pitch:5},back:{yaw:180,pitch:5},left:{yaw:270,pitch:5},top:{yaw:0,pitch:85}};
  const out={};
  Object.keys(views).forEach(f=>{
   const c=document.createElement('canvas');c.width=640;c.height=640;
   const o=views[f];
   const fr0=C.faceFrame(rig.cubes[0],f);rig.viewer.pos=[fr0.center[0]+fr0.n[0]*130,fr0.center[1]+fr0.n[1]*130,fr0.center[2]+fr0.n[2]*130];if(f!=='top')rig.viewer.pos[1]=fr0.center[1]+10;
   G.drawStage(c,{rig:rig,il:il,t:0,view:'free',orbit:{yaw:o.yaw,pitch:o.pitch,dist:46},focus:true});
   const fl=G.stageFaces().find(x=>x.cube==='A'&&x.face===f);
   // quatro cantos na tela: 0=topo-esq 1=topo-dir 2=base-dir 3=base-esq do conteúdo
   const d=c.getContext('2d').getImageData(0,0,640,640).data;let sx=0,sy=0,w=0;
   // olha só dentro do polígono da face
   const poly=fl.poly;let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;poly.forEach(q=>{minx=Math.min(minx,q[0]);maxx=Math.max(maxx,q[0]);miny=Math.min(miny,q[1]);maxy=Math.max(maxy,q[1]);});
   for(let y=Math.max(0,Math.floor(miny));y<Math.min(640,maxy);y++)for(let x=Math.max(0,Math.floor(minx));x<Math.min(640,maxx);x++){const i=(y*640+x)*4,v=d[i]+d[i+1]+d[i+2];if(v>330){sx+=x*v;sy+=y*v;w+=v;}}
   out[f]={poly:poly,visible:fl.visible,lit:w?[sx/w,sy/w]:null,url:c.toDataURL('image/png')};
  });
  return out;
 });
 for(const f of Object.keys(shots)){fs.writeFileSync('/tmp/t28-'+f+'.png',Buffer.from(shots[f].url.split(',')[1],'base64'));}
 for(const f of Object.keys(shots)){
  const s=shots[f],P=s.poly;
  // com a face vista de frente: x máximo/mínimo do polígono, e a luz tem que ficar no quadrante cima-direita da face
  const cx=(P[0][0]+P[1][0]+P[2][0]+P[3][0])/4,cy=(P[0][1]+P[1][1]+P[2][1]+P[3][1])/4;
  ok(s.visible&&s.lit,'cubo 3D '+f+': face visível e com luz');
  if(s.lit){
   // direita da face na tela: do canto 0 para o canto 1 (topo-esq -> topo-dir do conteúdo)
   const rx=P[1][0]-P[0][0],ry=P[1][1]-P[0][1],ux=P[0][0]-P[3][0],uy=P[0][1]-P[3][1];
   const vx=s.lit[0]-cx,vy=s.lit[1]-cy;
   const kr=(vx*rx+vy*ry)/(rx*rx+ry*ry),ku=(vx*ux+vy*uy)/(ux*ux+uy*uy);
   ok(kr>0.05&&ku>0.05,'cubo 3D '+f+': objeto à direita ('+kr.toFixed(2)+') e em cima ('+ku.toFixed(2)+') do quadro da face');
   // e o quadro está certo para quem olha de fora: o lado "direita" do conteúdo fica à direita da tela
   ok(rx>0,'cubo 3D '+f+': direita do conteúdo fica à direita na tela, sem espelhar (dx='+rx.toFixed(0)+')');
   ok(ux*0+(P[0][1]<P[3][1]),'cubo 3D '+f+': topo do conteúdo fica em cima na tela');
  }
 }
 ok(errs.length===0,'sem erros de página '+errs.join('|'));
 await b.close();srv.close&&srv.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
