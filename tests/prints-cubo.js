// Sala assombrada (cenário original) num cubo visto de quina, calibrado com a geometria real do palco do app. Saída em /tmp/claude-0/amostra3/
const {_electron}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const path=require('path'),fs=require('fs'),cp=require('child_process');
let fails=0,n=0;const ok=(c,m)=>{n++;console.log(c?'PASS':'FAIL',m);if(!c)fails++;};
const ELEC=process.env.ELECTRON_BIN||'/tmp/claude-0/el33/node_modules/electron/dist/electron';
const J2=!process.env.J3,GRID=!!process.env.GRID,VY=+(process.env.VY||24),VZ=+(process.env.VZ||100),DEP=+(process.env.DEPTH||24);const P=process.env.OUT||(GRID?'/tmp/claude-0/amostra3g/':'/tmp/claude-0/amostra3/');fs.mkdirSync(P,{recursive:true});
const M=path.join(__dirname,'amostra/media')+'/';
(async()=>{
 cp.spawnSync('python3',[path.join(__dirname,'amostra/gerar-midias.py')],{cwd:path.join(__dirname,'amostra')});
 const app=await _electron.launch({executablePath:ELEC,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows'].concat(process.env.PACKAGED?[]:[path.join(__dirname,'..')]),env:Object.assign({},process.env,{ELECTRON_DISABLE_SECURITY_WARNINGS:'1'})});
 const win=await app.firstWindow();const jc=(sel)=>win.evaluate(q=>document.querySelector(q).click(),sel);const errs=[];win.on('pageerror',e=>errs.push(e.message));
 await win.waitForLoadState('load');await win.waitForTimeout(2500);
 await win.evaluate(()=>{try{localStorage.setItem('lenzi-onboarded','1');localStorage.removeItem('ml-autosave')}catch(e){}});await win.reload();await win.waitForTimeout(2000);
 await win.setViewportSize({width:1500,height:1000}).catch(()=>{});
 const shot=async(w,nm,o)=>{await w.screenshot(Object.assign({path:P+nm+'.png',timeout:120000},o||{})).catch(e=>console.log('falhou',nm,e.message))};
 await win.click('[data-go="ilusao"]');await win.waitForTimeout(1500);
 // o cubo precisa de 3 superfícies ligadas às faces (frente, direita, topo), como no uso real
 await win.evaluate(()=>{const H=TimelineUI._h;H.newSurface([[.2,.3],[.4,.3],[.4,.5],[.2,.5]],'Face direita',1600,900);H.newSurface([[.5,.3],[.7,.3],[.7,.5],[.5,.5]],'Topo',1600,900);H.renderAll();});await win.waitForTimeout(1500);
 await win.evaluate(()=>{const H=TimelineUI._h,c=H.tl.seq.stage.cubes[0],ks=H.surfaces().map(z=>z.s.key).filter(Boolean);const used=['front','right','top'].map(f=>c.faces[f]);
  const free=ks.filter(k=>used.indexOf(k)<0);if(!c.faces.front)c.faces.front=free.shift();c.faces.right=free.shift();c.faces.top=free.shift();IllusionUI.render();});await win.waitForTimeout(800);
 const bound=await win.evaluate(()=>{const c=TimelineUI._h.tl.seq.stage.cubes[0];return ['front','right','top'].map(f=>!!c.faces[f])});console.log('faces ligadas',bound);ok(bound.every(Boolean),'frente, direita e topo ligadas a superficies');
 await jc('#il-modelo-rato');await win.waitForTimeout(2500);   // quina + topo + 2 paredes (mesma preparação de cubo); trocamos o conteúdo abaixo
 await win.evaluate(({M,GRID,J2,VY,VZ,DEP,LIBD})=>{const U=IllusionUI.state.il.room,H=TimelineUI._h;
  const md=(f,nm)=>({name:nm,path:(GRID?LIBD:M)+f,src:H.toUrl((GRID?LIBD:M)+f)});
  U.walls.back.media=md(GRID?'Parede - Grade branca.png':'parede-fundo-janela-lua.png','Parede fundo');U.walls.right.media=md(GRID?'Parede - Grade branca.png':'parede-direita-papel-quadros.png','Parede dir');U.walls.floor.media=md(GRID?'Piso - Xadrez preto e branco.png':'piso-madeira.png','Piso');
  const fy=U.sprites[0].y-6;
  U.sprites=GRID?[]:[{id:'fant',name:'Fantasma',x:-3,y:fy+6.2,z:-10,size:11,media:md('fantasma.png','Fantasma'),fx:''},{id:'abob',name:'Abóbora',x:6,y:fy+3.2,z:-6,size:5.6,media:md('abobora.png','Abóbora'),fx:''}];
  const U2=IllusionUI.state.il;U2.light.ambient=0.95;U2.light.key=0.7;
  if(J2){IllusionUI.state.il.room.join='front+right';IllusionUI.state.il.target.faces=['front','right'];}
  const st0=H.tl.seq.stage;st0.viewer.pos=[0,VY,VZ];U2.params.depth=DEP;const hh=H.tl.seq.stage.cubes[0].size/2;if(!GRID){const fy2=J2?-hh:hh-DEP;U.sprites[0].y=fy2+6.2;U.sprites[1].y=fy2+3.2;}IllusionUI.render();},{M,GRID,J2,VY,VZ,DEP,LIBD:path.join(__dirname,'..','biblioteca')+'/'});await win.waitForTimeout(1500);
 await jc('#il-apply');await win.waitForTimeout(3500);
 if(J2)await win.evaluate(({M})=>{const H=TimelineUI._h,Seq=H.Seq,sq=H.tl.seq,c=sq.stage.cubes[0],s=H.surfaces().map(z=>z.s).find(z=>z.key===c.faces.top);
  const tr=Seq.addTrack(sq,'video',s.key,s.name);const a=Seq.addAsset(sq,{kind:'img',name:'teto-vigas.png',path:M+'teto-vigas.png'});a.src=H.toUrl(M+'teto-vigas.png');const cl=Seq.addClip(sq,tr.id,a,0,8);if(cl)cl.fit='fill';H.syncClock();H.renderAll();},{M});
 await win.waitForTimeout(1500);
 const cfg=await win.evaluate(()=>{const C=IllusionCore,H=TimelineUI._h,st=H.tl.seq.stage,cu=st.cubes[0];
  const PW=1280,PH=1024,PROJ=st.projector.pos,PT=cu.pos,FOV=12*Math.PI/180;
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],nm=a=>{const l=Math.hypot(a[0],a[1],a[2]);return a.map(v=>v/l)};
  const f=nm(sub(PT,PROJ)),r=nm(cr(f,[0,1,0])),u=cr(r,f),fl=(PH/2)/Math.tan(FOV/2);
  const pj=X=>{const d=sub(X,PROJ),z=dot(d,f);return [(PW/2+fl*dot(d,r)/z)/PW,(PH/2-fl*dot(d,u)/z)/PH];};
  const by={};H.surfaces().forEach(z=>by[z.s.key]=z.s);const rep={};
  ['front','right','top'].forEach(face=>{const s=by[cu.faces[face]];if(!s)return;const fr=C.faceFrame(cu,face);s.q=fr.corners.map(pj);rep[face]=s.q.map(p=>p.map(v=>+v.toFixed(3)));});
  H.renderAll();
  return {rep,pw:PW,ph:PH,proj:PROJ,ptgt:PT,pfov:12,cubePos:cu.pos,size:cu.size,rotY:cu.rotY,viewer:st.viewer.pos,vfov:15,lado:[16,3,8],join:IllusionUI.state.il.room.join};});
 console.log(JSON.stringify(cfg.rep));ok(Object.keys(cfg.rep).length===3,'3 faces calibradas pela geometria do palco');
 const all=[].concat(...Object.values(cfg.rep)).flat();ok(all.every(v=>v>0.02&&v<0.98),'quads dentro da tela do projetor');
 await win.waitForTimeout(1500);
 const ds=await win.evaluate(()=>window.api.displays());await win.evaluate(id=>window.api.openOutput(id),ds[ds.length-1].id);await win.waitForTimeout(3000);
 const out=app.windows().find(w=>w!==win);await out.waitForFunction(()=>window.__rend&&window.__rend.player,null,{timeout:8000}).catch(()=>{});
 await win.evaluate(()=>{TimelineUI.api.seek(1.0);TimelineUI.api.pause&&TimelineUI.api.pause();});await win.waitForTimeout(4500);
 await shot(out,'raw-saida');await shot(win,'tela-de-controle');
 const sz=await out.evaluate(()=>[innerWidth,innerHeight]);cfg.pw=sz[0];cfg.ph=sz[1];console.log('saida',sz);
 fs.writeFileSync(P+'cfg.json',JSON.stringify(cfg));
 ok(errs.length===0,'sem erros de JS '+JSON.stringify(errs.slice(0,2)));
 await app.close().catch(()=>{});
 const r=cp.spawnSync('python3',[path.join(__dirname,'amostra/cubo.py'),P+'cfg.json',P+'raw-saida.png',P],{encoding:'utf8'});console.log(r.stdout,r.stderr);
 console.log(fails?'FALHOU':'TUDO OK '+n);process.exit(fails?1:0);
})();
