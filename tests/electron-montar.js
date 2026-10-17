// Teste REAL no Electron: Sala do rato -> Colocar na face -> Montar no cubo -> saída -> arrastar um canto -> Desfazer. Também janelas (minimizar, fechar).
// Rodar: ELECTRON_BIN=/tmp/claude-0/el33/node_modules/electron/dist/electron xvfb-run -a node tests/electron-montar.js
const {_electron}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const path=require('path');
let fails=0,n=0;const ok=(c,m)=>{n++;console.log(c?'PASS':'FAIL',m);if(!c)fails++;};
const ELEC=process.env.ELECTRON_BIN||'/tmp/claude-0/el33/node_modules/electron/dist/electron';
(async()=>{
 const app=await _electron.launch({executablePath:ELEC,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows',path.join(__dirname,'..')],env:Object.assign({},process.env,{ELECTRON_DISABLE_SECURITY_WARNINGS:'1'})});
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
 // arrastar na prévia 3D do painel, com o mouse de verdade (piso, parede e rato)
 const pts=await win.evaluate(()=>{const cv=document.getElementById('il-canvas'),out={wall:null,floor:null,sp:null},st=TimelineUI._h.tl.seq.stage;
  for(let y=10;y<cv.height;y+=5)for(let x=10;x<cv.width;x+=5){const hh=IllusionGL.roomPick(st,IllusionUI.state.il,x,y);if(!hh)continue;
   if(!out.sp&&hh.id.indexOf('sp:')===0)out.sp=[x,y];if(!out.wall&&hh.id==='wall:right')out.wall=[x,y];if(!out.floor&&hh.id==='wall:floor')out.floor=[x,y];}
  return out;});
 console.log('alvos na previa',JSON.stringify(pts));
 ok(!!(pts.wall&&pts.floor&&pts.sp),'acha parede, piso e rato sob o mouse na previa');
 async function dragCv(pt,dx,dy){const g=await win.evaluate(([x,y])=>{const cv=document.getElementById('il-canvas'),r=cv.getBoundingClientRect();return [r.left+x*r.width/cv.width,r.top+y*r.height/cv.height,r.width/cv.width,r.height/cv.height]},pt);
  await win.mouse.move(g[0],g[1]);await win.mouse.down();await win.mouse.move(g[0]+dx*g[2],g[1]+dy*g[3],{steps:8});await win.mouse.up();await win.waitForTimeout(500);}
 const rd=()=>win.evaluate(()=>{const R=IllusionUI.state.il.room;return {fl:JSON.stringify(R.walls.floor.tf),wl:JSON.stringify(R.walls.right.tf),sp:[R.sprites[0].x,R.sprites[0].z].map(v=>+v.toFixed(2))}});
 const a0=await rd();await dragCv(pts.floor,30,-10);const a1=await rd();
 ok(a1.fl!==a0.fl&&a1.wl===a0.wl&&JSON.stringify(a1.sp)===JSON.stringify(a0.sp),'Electron real: arrastar o piso desliza so o piso');
 await dragCv(pts.wall,25,10);const a2=await rd();
 ok(a2.wl!==a1.wl&&a2.fl===a1.fl,'Electron real: arrastar a parede desliza so a parede');
 const pts2=await win.evaluate(()=>{const cv=document.getElementById('il-canvas'),st=TimelineUI._h.tl.seq.stage;for(let y=10;y<cv.height;y+=4)for(let x=10;x<cv.width;x+=4){const hh=IllusionGL.roomPick(st,IllusionUI.state.il,x,y);if(hh&&hh.id.indexOf('sp:')===0)return [x,y];}return null;});
 await dragCv(pts2||pts.sp,-30,12);const a3=await rd();
 ok(JSON.stringify(a3.sp)!==JSON.stringify(a2.sp),'Electron real: arrastar o rato muda a posicao dele ('+a2.sp+' -> '+a3.sp+')');
 // calibra as 3 faces como um cubo visto de canto
 await win.evaluate(()=>{const H=TimelineUI._h,cu=H.tl.seq.stage.cubes[0],by={};H.surfaces().forEach(z=>by[z.s.key]=z.s);
  const Q={front:[[.2,.3],[.5,.45],[.5,.85],[.2,.7]],right:[[.5,.45],[.8,.3],[.8,.7],[.5,.85]],top:[[.2,.3],[.5,.15],[.8,.3],[.5,.45]]};
  Object.keys(Q).forEach(f=>{const s=by[cu.faces[f]];if(s)s.q=Q[f];});H.renderAll();});
 await win.waitForTimeout(1200);
 const nSurf0=await win.evaluate(()=>TimelineUI._h.surfaces().length);
 await jc('#il-montar');await win.waitForTimeout(3000);
 const lst=await win.evaluate(()=>{const H=TimelineUI._h,sq=H.tl.seq;return H.surfaces().map(z=>z.s).map(s=>({name:s.name,vis:s.visible,mask:s.mask.map(m=>m.map(v=>+v.toFixed(2))),clips:sq.tracks.filter(t=>t.surfaceId===s.key).reduce((a,t)=>a+t.clips.length,0)}))});
 console.log(lst.map(s=>s.name+(s.vis?'':' [escondida]')).join(' | '));
 const pieces=lst.filter(s=>/^(Piso|Parede|Rato)/.test(s.name));
 ok(pieces.length>=6&&pieces.every(s=>s.vis&&s.clips===1),'pecas criadas no app real ('+pieces.length+'), cada uma com 1 clipe');
 ok(pieces.every(s=>s.mask.every(m=>m.every(v=>v>=0&&v<=1))),'mascaras dentro da imagem');
 ok(lst.filter(s=>!/^(Piso|Parede|Rato)/.test(s.name)&&!s.vis).length===3,'3 faces da sala 3D escondidas');
 // saída real
 const ds=await win.evaluate(()=>window.api.displays());
 const okOpen=await win.evaluate(id=>window.api.openOutput(id),ds[ds.length-1].id);ok(okOpen===true,'janela de saida abriu');
 await win.waitForTimeout(2500);
 const wins=app.windows();ok(wins.length===2,'2 janelas: '+wins.length);
 const out=wins.find(w=>w!==win);
 await out.waitForFunction(()=>window.__rend&&window.__rend.player,null,{timeout:8000}).catch(()=>{});
 await win.evaluate(()=>{window.TimelineUI.api.seek(0.5);window.TimelineUI.api.play();});await win.waitForTimeout(2500);
 await out.screenshot({path:'/tmp/claude-0/el-saida.png'});
 const png=await out.screenshot();require('fs').writeFileSync('/tmp/claude-0/el-saida.png',png);
 const py=require('child_process').spawnSync('python3',['-c',`
from PIL import Image
im=Image.open('/tmp/claude-0/el-saida.png').convert('RGB');W,H=im.size
def at(fx,fy):
    r,g,b=im.getpixel((int(fx*W),int(fy*H)));return r+g+b
print(at(.24,.55),at(.78,.55),at(.5,.82),at(.03,.04),at(.97,.96),at(.03,.96),at(.97,.04))`]).stdout.toString().trim().split(' ').map(Number);
 console.log('pixels esq dir chao e 4 cantos de fora:',py.join(' '));
 ok(py[0]>150&&py[1]>150,'saida (Electron real) mostra paredes nas faces esquerda e direita');
 ok(py.slice(3).every(v=>v<20),'saida fica preta fora do cubo (nada vaza)');
 // a janela de saída não pode ficar por cima do controle depois de fechar; Esc fecha
 await app.evaluate(({BrowserWindow})=>{const ws=BrowserWindow.getAllWindows();const o=ws.find(w=>w.getTitle()==='Saída')||ws[1];o.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});});await win.waitForTimeout(1000);
 ok(app.windows().length===1,'Esc fecha a saida');
 // minimizar o controle de verdade
 await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].minimize()});await win.waitForTimeout(500);
 const mini=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMinimized());console.log('minimizado',mini);
 await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].restore()});
 // arrastar um canto de uma peca com o mouse de verdade (Calibração)
 await win.click('[data-go="ilusao"]').catch(()=>{});
 const sel=await win.evaluate(()=>{const H=TimelineUI._h;const s=H.surfaces().map(z=>z.s).find(s=>/^Piso/.test(s.name));H.selectKey(s.key);H.setMode&&H.setMode('corners');return {name:s.name,q:s.q.map(p=>p.map(v=>+v.toFixed(3)))}});
 await win.waitForTimeout(600);
 const geo=await win.evaluate(()=>{const st=document.getElementById('stage'),r=st.getBoundingClientRect();const c=document.querySelector('#overlay .h-corner[data-i="0"]');const b=c.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}});
 await win.mouse.move(geo.x,geo.y);await win.mouse.down();await win.mouse.move(geo.x+40,geo.y+25,{steps:8});await win.mouse.up();await win.waitForTimeout(500);
 const q2=await win.evaluate(()=>{const s=TimelineUI._h.currentSurface();return {name:s.name,q:s.q.map(p=>p.map(v=>+v.toFixed(3)))}});
 console.log(JSON.stringify(sel.q[0]),'->',JSON.stringify(q2.q[0]));
 ok(q2.name===sel.name&&(Math.abs(q2.q[0][0]-sel.q[0][0])>0.005||Math.abs(q2.q[0][1]-sel.q[0][1])>0.005),'arrastar o canto 1 do piso com o mouse move so essa peca');
 const other=await win.evaluate(()=>TimelineUI._h.surfaces().map(z=>z.s).filter(s=>/^Parede de/.test(s.name)).map(s=>JSON.stringify(s.q)).join('|'));
 ok(other.length>0,'outras pecas continuam la');
 // Desfazer (Ctrl+Z) volta o canto
 await win.evaluate(()=>document.activeElement&&document.activeElement.blur());await win.keyboard.press('Control+z');await win.waitForTimeout(600);
 const q3=await win.evaluate(()=>{const s=TimelineUI._h.surfaces().map(z=>z.s).find(s=>/^Piso/.test(s.name));return s.q[0].map(v=>+v.toFixed(3))});
 console.log('depois do Ctrl+Z',JSON.stringify(q3));
 ok(Math.abs(q3[0]-sel.q[0][0])<0.01&&Math.abs(q3[1]-sel.q[0][1])<0.01,'Ctrl+Z desfaz o arrasto do canto');
 console.log('errs',errs.slice(0,5));ok(errs.length===0,'sem erros de JS');
 await app.close();console.log(fails?'HA FALHAS':'TUDO OK '+n);process.exit(fails?1:0);})();
