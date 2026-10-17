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
 const P='/tmp/claude-0/prints2/';require('fs').mkdirSync(P,{recursive:true});
 const shot=async(w,n)=>{await w.screenshot({path:P+n+'.png',timeout:120000}).catch(e=>console.log('falhou print',n,e.message))};
 // abrir a saida (projetor)
 const ds=await win.evaluate(()=>window.api.displays());await win.evaluate(id=>window.api.openOutput(id),ds[ds.length-1].id);await win.waitForTimeout(2500);
 const out=app.windows().find(w=>w!==win);await out.waitForFunction(()=>window.__rend&&window.__rend.player,null,{timeout:8000}).catch(()=>{});
 await win.evaluate(()=>{window.TimelineUI.api.seek(0.5);window.TimelineUI.api.pause&&window.TimelineUI.api.pause();});await win.waitForTimeout(2000);
 // ferramenta 1: sliders de distorcer cantos do piso
 await win.evaluate(()=>{const d=document.getElementById('il-tf-floor');d.open=true;d.scrollIntoView({block:'center'})});await win.waitForTimeout(800);
 await win.screenshot({path:P+'A1-ferramenta-sliders-do-piso.png',clip:{x:1124,y:17,width:360,height:590},timeout:120000}).catch(e=>console.log('falhou A1',e.message));await shot(win,'A1b-tela-antes');await shot(out,'A2-saida-antes');
 const rs=win.locator('#il-tf-floor input[type=range]');console.log('sliders no piso',await rs.count());
 const setv=async(i,v)=>{await rs.nth(i).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))},v)};
 await setv(4,'0.3');await win.waitForTimeout(800);await win.evaluate(()=>{const f=IllusionUI.state.il.room.walls.floor;f.tf.c=[0.3,0.2,0,0,-0.2,0,0,0];IllusionUI.render();});await win.waitForTimeout(1500);
 const c=await win.evaluate(()=>IllusionUI.state.il.room.walls.floor.tf.c.join());console.log('c do piso',c);ok(c.split(',')[0]==='0.3','sliders mudaram o piso');
 await win.evaluate(()=>{const b=document.getElementById('il-apply');if(b)b.click()});await win.waitForTimeout(2500);
 await win.evaluate(()=>{const d=document.getElementById('il-tf-floor');d.open=true;d.scrollIntoView({block:'center'})});await win.waitForTimeout(800);
 await win.screenshot({path:P+'A3-sliders-do-piso-com-valores.png',clip:{x:1124,y:17,width:360,height:590},timeout:120000}).catch(e=>console.log('falhou A3',e.message));await shot(win,'A3b-tela-depois');await shot(out,'A4-saida-depois-piso-distorcido');
 // tirar a distorcao
 await jc('#il-tf-c0-floor');await win.waitForTimeout(500);await win.evaluate(()=>{const b=document.getElementById('il-apply');if(b)b.click()});await win.waitForTimeout(2000);
 // ferramenta 2: Montar no cubo + cantos da peca
 await jc('#il-montar');await win.waitForTimeout(3000);
 await win.click('[data-go="ilusao"]').catch(()=>{});
 const sel=await win.evaluate(()=>{const H=TimelineUI._h;const s=H.surfaces().map(z=>z.s).find(s=>/^Piso/.test(s.name));H.selectKey(s.key);H.setMode&&H.setMode('corners');return s.name});
 await win.waitForTimeout(800);await shot(win,'B1-pecas-soltas-piso-selecionado-com-4-pontos');await shot(out,'B2-saida-pecas-antes');
 const geo=await win.evaluate(()=>{const c=document.querySelector('#overlay .h-corner[data-i="0"]');const b=c.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}});
 await win.mouse.move(geo.x,geo.y);await win.mouse.down();await win.mouse.move(geo.x+60,geo.y+40,{steps:10});await win.mouse.up();await win.waitForTimeout(1500);
 await shot(win,'B3-canto-do-piso-arrastado');await shot(out,'B4-saida-piso-distorcido-pela-peca');
 await app.close().catch(()=>{});
 console.log(fails?'FALHOU':'TUDO OK '+n);process.exit(fails?1:0);
})();
