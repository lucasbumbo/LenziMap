// Projeto de exemplo (fachada com janelas, porta, placa e telhado) montado no app real (Electron) + prints. Uso:
// ELECTRON_BIN=... [PACKAGED=1] xvfb-run -a node tests/prints-projeto.js   (saída em /tmp/claude-0/amostra2/)
const {_electron}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const path=require('path'),fs=require('fs'),cp=require('child_process');
let fails=0,n=0;const ok=(c,m)=>{n++;console.log(c?'PASS':'FAIL',m);if(!c)fails++;};
const ELEC=process.env.ELECTRON_BIN||'/tmp/claude-0/el33/node_modules/electron/dist/electron';
const P='/tmp/claude-0/amostra2/';fs.mkdirSync(P,{recursive:true});
const GJ=P+'geom.json';cp.spawnSync('python3',[path.join(__dirname,'amostra/geom.py'),'geom',GJ]);
const G=JSON.parse(fs.readFileSync(GJ));const LIB=path.join(__dirname,'..','biblioteca')+'/';
(async()=>{
 const app=await _electron.launch({executablePath:ELEC,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows'].concat(process.env.PACKAGED?[]:[path.join(__dirname,'..')]),env:Object.assign({},process.env,{ELECTRON_DISABLE_SECURITY_WARNINGS:'1'})});
 const win=await app.firstWindow();const errs=[];win.on('pageerror',e=>errs.push(e.message));
 await win.waitForLoadState('load');await win.waitForTimeout(2500);
 await win.evaluate(()=>{try{localStorage.setItem('lenzi-onboarded','1');localStorage.removeItem('ml-autosave')}catch(e){}});await win.reload();await win.waitForTimeout(2000);
 await win.setViewportSize({width:1500,height:1000}).catch(()=>{});
 const shot=async(w,nm,o)=>{await w.screenshot(Object.assign({path:P+nm+'.png',timeout:120000},o||{})).catch(e=>console.log('falhou',nm,e.message))};
 const info=await win.evaluate(({G,LIB})=>{
  const H=TimelineUI._h,Seq=H.Seq,sq=H.tl.seq;
  H.surfaces().map(z=>z.s).forEach(s=>{s.visible=false;});
  const mk=(nm,q,w,h)=>{const s=H.newSurface(q,nm,w,h);s.pristine=false;return s;};
  const add=(s,file,kind,dur)=>{const tr=Seq.addTrack(sq,'video',s.key,s.name);const a=Seq.addAsset(sq,{kind,name:file,path:LIB+file,duration:dur||null,dims:kind==='video'?[960,540]:null});a.src=H.toUrl(LIB+file);const c=Seq.addClip(sq,tr.id,a,0,8);return c;};
  const E=G.el,UV=G.uv,S={};
  S.base=mk('Fachada',G.fac,1600,1000);add(S.base,'Parede - Amarelo geometrico.png','img');
  const cut=(nm,id)=>{const [u0,v0,u1,v1]=UV[id];return {id:'c-'+id,name:nm,on:true,inv:false,f:1.5,pts:[[u0,v0],[u1,v0],[u1,v1],[u0,v1]]};};
  S.base.cuts=[cut('Janela esquerda','janela-esq'),cut('Janela direita','janela-dir'),cut('Porta','porta')];
  S.tel=mk('Telhado',E['telhado'],1600,240);add(S.tel,'Teto - Ondas.png','img');
  S.pla=mk('Placa',E['placa'],1600,360);add(S.pla,'Textura - Equalizador.mp4','video',5);
  S.je=mk('Janela esquerda',E['janela-esq'],900,900);add(S.je,'Textura - Aurora.mp4','video',5);
  S.jd=mk('Janela direita',E['janela-dir'],900,900);add(S.jd,'Textura - Nebulosa.mp4','video',5);
  S.po=mk('Porta',E['porta'],600,1100);add(S.po,'Textura - Lava lamp.mp4','video',5);
  try{H.setOn(true);}catch(e){}H.syncClock();H.renderAll();
  return Object.keys(S).map(k=>S[k].name+':'+S[k].cuts.length);
 },{G,LIB});
 console.log(JSON.stringify(info));await win.waitForTimeout(2500);
 const nS=await win.evaluate(()=>TimelineUI._h.surfaces().filter(z=>z.s.visible!==false).length);ok(nS===6,'6 superficies visiveis: '+nS);
 const ds=await win.evaluate(()=>window.api.displays());await win.evaluate(id=>window.api.openOutput(id),ds[ds.length-1].id);await win.waitForTimeout(3000);
 const out=app.windows().find(w=>w!==win);await out.waitForFunction(()=>window.__rend&&window.__rend.player,null,{timeout:8000}).catch(()=>{});
 await win.evaluate(()=>{TimelineUI.api.seek(2.0);TimelineUI.api.pause&&TimelineUI.api.pause();});await win.waitForTimeout(4000);
 await shot(out,'raw-saida');
 const sz=await out.evaluate(()=>[innerWidth,innerHeight]);console.log('saida',sz);
 // tela de controle: Calibração com a janela esquerda selecionada
 await win.evaluate(()=>{const H=TimelineUI._h;const s=H.surfaces().map(z=>z.s).find(s=>s.name==='Janela esquerda');H.selectKey(s.key);H.setMode&&H.setMode('corners');});await win.waitForTimeout(2500);
 await shot(win,'2-tela-de-controle');
 await win.evaluate(()=>{const H=TimelineUI._h;const s=H.surfaces().map(z=>z.s).find(s=>s.name==='Fachada');H.selectKey(s.key);H.setMode&&H.setMode('mask');});await win.waitForTimeout(2500);
 await shot(win,'3-tela-de-controle-mascaras-da-fachada');
 const pr=await win.evaluate(()=>{const o=TimelineUI._h.surfaces().map(z=>z.s).find(s=>s.name==='Fachada');return (o.cuts||[]).length});ok(pr===3,'3 recortes na fachada');
 ok(errs.length===0,'sem erros de JS '+JSON.stringify(errs.slice(0,2)));
 await app.close().catch(()=>{});
 // composição: foto do objeto + projeção (mistura "screen")
 const W=sz[0],Hh=sz[1];
 const r=cp.spawnSync('python3',['-c',`
import subprocess,sys
from PIL import Image,ImageChops,ImageEnhance
subprocess.run(['python3','${path.join(__dirname,'amostra/geom.py')}','foto','${P}foto.png','${W}','${Hh}'],check=True)
foto=Image.open('${P}foto.png').convert('RGB');raw=Image.open('${P}raw-saida.png').convert('RGB').resize(foto.size)
amb=ImageEnhance.Brightness(foto).enhance(0.45);amb.save('${P}1-objeto-sem-projecao.png')
# luz projetada sobre a superficie: a cor do reboco multiplica a imagem, mais um pouco de brilho do projetor
refl=ImageChops.multiply(raw,ImageEnhance.Brightness(foto).enhance(1.15).point(lambda v:min(255,int(v*1.0))))
res=ImageChops.screen(amb,refl);res.save('${P}4-resultado-projetado.png')
`],{encoding:'utf8'});console.log(r.stdout,r.stderr);
 console.log(fails?'FALHOU':'TUDO OK '+n);process.exit(fails?1:0);
})();
