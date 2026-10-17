// E2E obrigatorio no Electron REAL: criar projeto, superficies, cantos, mascara, salvar (.mapa de verdade),
// fechar o app, abrir de novo, abrir o arquivo, conferir integridade (salvar de novo e comparar) e saida com imagem.
// Rodar: ELECTRON_BIN=... [PACKAGED=1] xvfb-run -a node tests/electron-e2e-projeto.js   (frames em OUT, padrao /tmp/claude-0/e2e)
const {_electron}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const path=require('path'),fs=require('fs'),os=require('os'),cp=require('child_process');
let fails=0,n=0;const ok=(c,m)=>{n++;console.log(c?'PASS':'FAIL',m);if(!c)fails++;};
const ELEC=process.env.ELECTRON_BIN||'/tmp/claude-0/el33/node_modules/electron/dist/electron';
const OUT=process.env.OUT||'/tmp/claude-0/e2e';fs.mkdirSync(OUT,{recursive:true});
const WORK=fs.mkdtempSync(path.join(os.tmpdir(),'lzE2E-'));const FILE1=path.join(WORK,'projeto.mapa'),FILE2=path.join(WORK,'reaberto.mapa');
const UD=path.join(WORK,'ud');
const flags=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--user-data-dir='+UD];
async function launch(){
 const app=await _electron.launch({executablePath:ELEC,args:flags.concat(process.env.PACKAGED?[]:[path.join(__dirname,'..')]),env:Object.assign({},process.env,{ELECTRON_DISABLE_SECURITY_WARNINGS:'1'})});
 const win=await app.firstWindow();const errs=[];win.on('pageerror',e=>errs.push(e.message));
 await win.waitForLoadState('load');await win.waitForTimeout(2500);return {app,win,errs};
}
// troca os dialogos nativos por caminhos fixos (o resto do fluxo, incluindo gravar o arquivo, e o real)
const stub=(app,save,open)=>app.evaluate(({dialog},[s,o])=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:s});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[o]});},[save,open]);
const stats=(f)=>{const r=cp.spawnSync('python3',['-c',`
from PIL import Image,ImageStat;import sys
im=Image.open(sys.argv[1]).convert('L');print(int(ImageStat.Stat(im).mean[0]),int(ImageStat.Stat(im).extrema[0][1]))`,f]);return r.stdout.toString().trim().split(' ').map(Number);};
(async()=>{
 // ---------- sessao 1: criar e salvar
 let {app,win,errs}=await launch();
 await win.evaluate(()=>{try{localStorage.setItem('lenzi-onboarded','1');localStorage.removeItem('ml-autosave')}catch(e){}});await win.reload();await win.waitForTimeout(2000);
 await stub(app,FILE1,FILE1);
 const jc=(sel)=>win.evaluate(q=>document.querySelector(q).click(),sel);
 await jc('#btn-newbox');await win.waitForTimeout(500);await jc('#add-test');await win.waitForTimeout(1000);
 await jc('#btn-newbox');await win.waitForTimeout(500);await jc('#add-test');await win.waitForTimeout(1000);
 await win.evaluate(()=>{const l=TimelineUI._h.surfaces().map(z=>z.s);
  l[0].name='Fachada';l[0].q=[[0.10,0.12],[0.48,0.10],[0.50,0.62],[0.08,0.60]];
  l[1].name='Porta';l[1].q=[[0.58,0.20],[0.90,0.22],[0.88,0.80],[0.60,0.78]];TimelineUI._h.renderAll();});
 await win.evaluate(()=>{document.getElementById('cut-shape').value='rect';document.getElementById('cut-add').click()});await win.waitForTimeout(800);
 const nSurf=await win.evaluate(()=>TimelineUI._h.surfaces().length);ok(nSurf>=2,'2 superficies criadas ('+nSurf+')');
 const ds=await win.evaluate(()=>window.api.displays());await win.evaluate(id=>window.api.openOutput(id),ds[ds.length-1].id);await win.waitForTimeout(3500);
 let out=app.windows().find(w=>w!==win);
 await out.screenshot({path:OUT+'/1-antes-de-salvar.png',timeout:120000});
 await jc('#btn-save');await win.waitForTimeout(1500);
 ok(fs.existsSync(FILE1)&&fs.statSync(FILE1).size>200,'arquivo .mapa gravado no disco');
 let j1;try{j1=JSON.parse(fs.readFileSync(FILE1,'utf8'))}catch(e){}
 ok(!!j1,'arquivo e JSON valido');
 const surfs=j1?(j1.scenes?j1.scenes.flatMap(s=>s.surfaces):j1.surfaces):[];
 const byName=Object.fromEntries(surfs.map(s=>[s.name,s]));
 ok(byName['Fachada']&&byName['Porta'],'nomes das superficies salvos');
 ok(byName['Fachada']&&byName['Fachada'].q[0][0]===0.10&&byName['Fachada'].q[2][1]===0.62,'cantos (q) salvos exatamente');
 ok(surfs.some(s=>(s.cuts||[]).length>0),'mascara extra (cut) salva');
 ok(errs.length===0,'sessao 1 sem erros de JS: '+errs.slice(0,2));
 await app.close().catch(()=>{});
 // ---------- sessao 2: app novo, perfil limpo, abrir o arquivo
 fs.rmSync(UD,{recursive:true,force:true});
 ({app,win,errs}=await launch());
 await win.evaluate(()=>{try{localStorage.setItem('lenzi-onboarded','1');localStorage.removeItem('ml-autosave')}catch(e){}});await win.reload();await win.waitForTimeout(2000);
 await stub(app,FILE2,FILE1);
 const antes=await win.evaluate(()=>TimelineUI._h.surfaces().filter(z=>!z.s.pristine).length);
 await win.evaluate(()=>document.getElementById('btn-open').click());await win.waitForTimeout(2500);
 const depois=await win.evaluate(()=>TimelineUI._h.surfaces().map(z=>z.s.name));
 ok(antes===0&&depois.includes('Fachada')&&depois.includes('Porta'),'reaberto: superficies voltaram ('+depois.join(',')+')');
 await win.evaluate(id=>window.api.openOutput(id),ds[ds.length-1].id);await win.waitForTimeout(3500);
 out=app.windows().find(w=>w!==win);
 await out.screenshot({path:OUT+'/2-depois-de-reabrir.png',timeout:120000});
 await win.evaluate(()=>document.getElementById('btn-save').click());await win.waitForTimeout(1500);
 ok(fs.existsSync(FILE2),'re-salvou o projeto reaberto');
 const norm=f=>{const j=JSON.parse(fs.readFileSync(f,'utf8'));const S=(j.scenes?j.scenes.flatMap(s=>s.surfaces):j.surfaces);return JSON.stringify(S.filter(s=>s.name==='Fachada'||s.name==='Porta').map(s=>({name:s.name,q:s.q,cuts:(s.cuts||[]).length})).sort((a,b)=>a.name<b.name?-1:1));};
 ok(fs.existsSync(FILE2)&&norm(FILE1)===norm(FILE2),'integridade: nomes, cantos e mascaras identicos apos fechar e reabrir');
 const a=stats(OUT+'/1-antes-de-salvar.png'),b=stats(OUT+'/2-depois-de-reabrir.png');console.log('brilho antes/depois',a,b);
 ok(a[1]>40&&b[1]>40,'saida tem imagem nas duas sessoes');
 ok(Math.abs(a[0]-b[0])<=Math.max(6,a[0]*0.25),'saida parecida antes e depois (brilho medio)');
 ok(errs.length===0,'sessao 2 sem erros de JS: '+errs.slice(0,2));
 console.log(fails?'FALHOU '+fails:'TUDO OK '+n);await app.close().catch(()=>{});process.exit(fails?1:0);
})();
