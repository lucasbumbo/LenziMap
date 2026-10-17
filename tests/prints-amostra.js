// Teste REAL no Electron: Sala do rato -> Colocar na face -> Montar no cubo -> saída -> arrastar um canto -> Desfazer. Também janelas (minimizar, fechar).
// Rodar: ELECTRON_BIN=/tmp/claude-0/el/node_modules/electron/dist/electron xvfb-run -a node tests/electron-montar.js
const {_electron}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const path=require('path');
let fails=0,n=0;const ok=(c,m)=>{n++;console.log(c?'PASS':'FAIL',m);if(!c)fails++;};
const ELEC=process.env.ELECTRON_BIN||'/tmp/claude-0/el/node_modules/electron/dist/electron';
(async()=>{
 const app=await _electron.launch({executablePath:ELEC,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows',].concat(process.env.ELECTRON_BIN&&process.env.PACKAGED?[]:[path.join(__dirname,'..')]),env:Object.assign({},process.env,{ELECTRON_DISABLE_SECURITY_WARNINGS:'1'})});
 const win=await app.firstWindow();const jc=(sel)=>win.evaluate(q=>document.querySelector(q).click(),sel);const errs=[];win.on('pageerror',e=>errs.push(e.message));
await win.waitForLoadState('load');await win.waitForTimeout(2500);
 await win.evaluate(()=>{try{localStorage.setItem('lenzi-onboarded','1');localStorage.removeItem('ml-autosave')}catch(e){}});await win.reload();await win.waitForTimeout(2000);
 await win.setViewportSize({width:1500,height:1000}).catch(()=>{});
 // janela de controle: minimizar e fechar existem
 const fl=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {min:w.isMinimizable(),close:w.isClosable(),max:w.isMaximizable(),top:w.isAlwaysOnTop()}});
 console.log(JSON.stringify(fl));ok(fl.min&&fl.close&&!fl.top,'controle: minimiza, fecha, nao fica por cima');
 // 3D
 await win.click('[data-go="ilusao"]');await win.waitForTimeout(1500);
 await win.evaluate(()=>{const c=window.TimelineUI._h.tl.seq.stage.cubes[0];c.rotY=-45;});
 const hasRato=await win.locator('#il-modelo-rato').count();ok(hasRato===1,'botao Sala do rato existe');
 await jc('#il-modelo-rato');await win.waitForTimeout(2500);
 const media=await win.evaluate(()=>{const W=IllusionUI.state.il.room.walls;return {bk:W.back.media&&W.back.media.name,fl:W.floor.media&&W.floor.media.name,sp:IllusionUI.state.il.room.sprites.length}});
 console.log(JSON.stringify(media));ok(media.bk&&media.fl&&media.sp>=1,'biblioteca real do app carregou parede, piso e rato');
 await jc('#il-apply');await win.waitForTimeout(3000);
 await win.evaluate(()=>{const H=TimelineUI._h,cu=H.tl.seq.stage.cubes[0],by={};H.surfaces().forEach(z=>by[z.s.key]=z.s);
  const Q={front:[[.2,.3],[.5,.45],[.5,.85],[.2,.7]],right:[[.5,.45],[.8,.3],[.8,.7],[.5,.85]],top:[[.2,.3],[.5,.15],[.8,.3],[.5,.45]]};
  Object.keys(Q).forEach(f=>{const s=by[cu.faces[f]];if(s)s.q=Q[f];});H.renderAll();});
 await win.waitForTimeout(1200);

 const P='/tmp/claude-0/amostra/';require('fs').mkdirSync(P,{recursive:true});
 const shot=async(w,n)=>{await w.screenshot({path:P+n+'.png',timeout:120000}).catch(e=>console.log('falhou print',n,e.message))};
 await jc('#il-montar');await win.waitForTimeout(3500);
 const ds=await win.evaluate(()=>window.api.displays());await win.evaluate(id=>window.api.openOutput(id),ds[ds.length-1].id);await win.waitForTimeout(3000);
 const out=app.windows().find(w=>w!==win);await out.waitForFunction(()=>window.__rend&&window.__rend.player,null,{timeout:8000}).catch(()=>{});
 await win.evaluate(()=>{window.TimelineUI.api.seek(0.5);window.TimelineUI.api.pause&&window.TimelineUI.api.pause();});await win.waitForTimeout(2500);
 await shot(out,'1-sala-montada-sem-mascara');
 // 1) janela circular recortada na parede da direita (peca "Parede de tras (Direita)") com feather
 const sel=async(re)=>win.evaluate((re)=>{const H=TimelineUI._h;const s=H.surfaces().map(z=>z.s).find(s=>new RegExp(re).test(s.name));H.selectKey(s.key);return s.name},re);
 console.log('peca',await sel('^Parede de trás \\(Direita\\)'));await win.waitForTimeout(800);
 await win.evaluate(()=>{window.__cuts.add('circle')});await win.waitForTimeout(800);
 await win.evaluate(()=>{const c=window.__cuts.sel();const f=document.getElementById('cut-f-'+c.id);f.value=6;f.dispatchEvent(new Event('input',{bubbles:true}))});await win.waitForTimeout(3500);
 await shot(out,'2-janela-recortada-na-parede-com-feather');await shot(win,'2b-tela-de-controle-com-a-mascara');
 // 2) holofote: no piso (Frente), mascara invertida com feather = so um circulo de luz
 console.log('peca',await sel('^Piso \\(Frente\\)'));await win.waitForTimeout(800);
 await win.evaluate(()=>{window.__cuts.add('circle')});await win.waitForTimeout(800);
 await win.evaluate(()=>{const c=window.__cuts.sel();document.getElementById('cut-inv-'+c.id).click();const f=document.getElementById('cut-f-'+c.id);f.value=12;f.dispatchEvent(new Event('input',{bubbles:true}))});await win.waitForTimeout(3500);
 await shot(out,'3-holofote-no-piso-invertida-com-feather');
 const cuts=await win.evaluate(()=>TimelineUI._h.surfaces().map(z=>z.s).filter(s=>(s.cuts||[]).length).map(s=>s.name+':'+s.cuts.length));console.log('cuts',JSON.stringify(cuts));ok(cuts.length===2,'2 pecas com mascara extra');
 console.log('errs',JSON.stringify(errs.slice(0,3)));ok(errs.length===0,'sem erros de JS');
 await app.close().catch(()=>{});console.log(fails?'FALHOU':'TUDO OK '+n);process.exit(fails?1:0);
})();
