// Teste REAL no Electron (inicialização, IPC, mídia, janela de saída). Rodar com: xvfb-run -a node tests/electron-smoke.js
// Requer: npm i electron playwright (fora do projeto). Em Linux/Xvfb: não substitui teste em Mac com projetor.
const {_electron}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const path=require('path'),fs=require('fs');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const ELEC=process.env.ELECTRON_BIN||'/tmp/elt/node_modules/electron/dist/electron';
(async()=>{
 const app=await _electron.launch({executablePath:ELEC,args:['--no-sandbox','--disable-gpu-sandbox','--autoplay-policy=no-user-gesture-required',path.join(__dirname,'..')],env:Object.assign({},process.env,{ELECTRON_DISABLE_SECURITY_WARNINGS:'1'})});
 const win=await app.firstWindow();const errs=[];win.on('pageerror',e=>errs.push(e.message));
 await win.addInitScript(()=>{try{localStorage.setItem('lenzi-onboarded','1')}catch(e){}});
 await win.evaluate(()=>{try{localStorage.setItem('lenzi-onboarded','1')}catch(e){}});await win.reload();await win.waitForTimeout(1500);
 const info=await win.evaluate(()=>({api:Object.keys(window.api||{}).length,tl:!!window.TimelineUI,seq:!!window.Sequence,node:typeof require,proc:typeof process}));
 console.log('janela',JSON.stringify(info));
 assert(info.api>15&&info.tl&&info.seq,'Electron: preload (window.api) e módulos da timeline carregados');
 assert(info.node==='undefined'&&info.proc==='undefined','Electron: nodeIntegration desligado (sem require/process na página)');
 const ds=await win.evaluate(()=>window.api.displays());assert(ds.length>=1,'IPC displays: '+JSON.stringify(ds.map(d=>d.bounds)));
 // timeline + 2 clipes (um H.264 mp4, um VP9 webm) usando caminhos reais de arquivo
 const media=path.join(__dirname,'media');
 await win.click('[data-go="timeline"]');if(await win.locator('#tl-insp button.primary').count())await win.click('#tl-insp button.primary');await win.waitForTimeout(400);
 await win.click('.tl-bar button:has-text("Faixa p/ cada face")');await win.waitForTimeout(300);
 const url=await win.evaluate(p=>window.TimelineUI._h.toUrl(p),path.join(media,'v6.mp4'));console.log('toUrl',url);
 await win.evaluate(([a,b])=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;
  const v=S.addAsset(seq,{kind:'video',name:'h264',path:a,duration:6});v.src=H.toUrl(a);
  const w=S.addAsset(seq,{kind:'video',name:'vp9',path:b,duration:6});w.src=H.toUrl(b);
  S.addClip(seq,seq.tracks[0].id,v,0,6);seq.duration=10;H.syncClock();H.push();H.renderAll();},[path.join(media,'v6.mp4'),path.join(media,'v6.webm')]);
 await win.waitForTimeout(800);
 // mídia H.264 e VP9 decodificam no Electron?
 const dec=await win.evaluate(async([a,b])=>{const t=(u)=>new Promise(r=>{const v=document.createElement('video');v.muted=true;v.src=u;v.onloadedmetadata=()=>r({ok:true,w:v.videoWidth,d:v.duration});v.onerror=()=>r({ok:false});setTimeout(()=>r({ok:false,timeout:1}),6000);});return {h264:await t(window.TimelineUI._h.toUrl(a)),vp9:await t(window.TimelineUI._h.toUrl(b))};},[path.join(media,'v6.mp4'),path.join(media,'v6.webm')]);
 console.log('decode',JSON.stringify(dec));
 assert(dec.vp9.ok,'Electron carrega VP9 via toUrl');
 console.log(dec.h264.ok?'INFO H.264 carrega no Electron (Linux/Xvfb)':'INFO H.264 NÃO carregou neste Electron Linux');
 // read-bytes
 const rb=await win.evaluate(p=>window.api.readBytes(p).then(b=>b&&(b.byteLength||b.length)),path.join(media,'music.mp3'));
 assert(rb>1000,'IPC read-bytes devolve o áudio ('+rb+' bytes)');
 // saída real
 const outId=ds[ds.length-1].id;
 const okOpen=await win.evaluate(id=>window.api.openOutput(id),outId);assert(okOpen===true,'IPC open-output abre a janela de saída');
 await win.waitForTimeout(2000);
 const wins=app.windows();assert(wins.length===2,'duas janelas Electron (controle e saída): '+wins.length);
 const out=wins.find(w=>w!==win);
 await out.waitForFunction(()=>window.__rend&&window.__rend.player,null,{timeout:8000}).catch(()=>{});
 const hasOut=await out.evaluate(()=>!!(window.__rend&&window.__rend.player));assert(hasOut,'saída inicializou o SequencePlayer');
 await win.evaluate(()=>{window.TimelineUI.api.seek(2.5);window.TimelineUI.api.play();});await win.waitForTimeout(1800);
 const t=await win.evaluate(()=>window.TimelineUI._h.tl.clock.now()),to=await out.evaluate(()=>window.__rend.player.clock.now());
 console.log('tempo painel',t.toFixed(3),'saida',to.toFixed(3));
 assert(Math.abs(t-to)<0.2,'IPC transport: painel e saída no mesmo tempo (Δ '+Math.abs(t-to).toFixed(3)+' s)');
 const vid=await out.evaluate(()=>{const r=window.__rend;let n=0,ok=0;Object.values(r.recs).forEach(rec=>Object.keys(rec.ex).forEach(k=>{if(k[0]==='c'&&rec.ex[k].el.tagName==='VIDEO'){n++;if(rec.ex[k].el.readyState>=2)ok++;}}));return {n,ok};});
 console.log('videos na saida',JSON.stringify(vid));
 assert(vid.n>=1&&vid.ok>=1,'saída tem vídeo pronto (readyState>=2) tocando');
 await win.evaluate(()=>window.TimelineUI.api.pause());
 // salvar/abrir via IPC de verdade é diálogo nativo: NÃO TESTADO
 await win.evaluate(()=>window.api.closeOutput());await win.waitForTimeout(600);
 assert(app.windows().length===1,'IPC close-output fecha a saída');
 console.log('NÃO TESTADO aqui: diálogos nativos de abrir/salvar, projetor/segundo monitor físico, gravação de tela, Mac.');
 console.log('errs',errs);assert(errs.length===0,'sem erros de JS no controle');
 await app.close();})();
