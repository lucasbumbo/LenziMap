// Teste REAL no Electron: imagem lida pelo app (api.readImage) vira textura WebGL na Sala 3D, sem bloqueio de segurança de file://
// Rodar com: xvfb-run -a node tests/electron-3d-media.js  (Linux/Xvfb: não substitui teste em Mac)
const {_electron}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const path=require('path');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const ELEC=process.env.ELECTRON_BIN||'/tmp/elt/node_modules/electron/dist/electron';
(async()=>{
 const app=await _electron.launch({executablePath:ELEC,args:['--no-sandbox','--disable-gpu-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader',path.join(__dirname,'..')],env:Object.assign({},process.env,{LENZIMAP_TEST:'1'})});
 const win=await app.firstWindow();const errs=[];win.on('pageerror',e=>errs.push(e.message));
 await win.evaluate(()=>{try{localStorage.setItem('lenzi-onboarded','1')}catch(e){}});await win.reload();await win.waitForTimeout(1500);
 const green=path.join(__dirname,'media','green.png'),gif=path.join(__dirname,'media','anim.gif'),dot=path.join(__dirname,'media','dot.png');
 assert(await win.evaluate(()=>typeof window.api.readImage==='function'),'preload expõe api.readImage');
 const rb=await win.evaluate(p=>window.api.readImage(p).then(b=>b&&(b.byteLength||b.length)),green);assert(rb>50,'IPC read-image devolve os bytes da imagem ('+rb+')');
 const bad=await win.evaluate(()=>window.api.readImage('/etc/passwd'));assert(bad===null,'read-image recusa arquivo que não é imagem');
 const badMp3=await win.evaluate(p=>window.api.readImage(p),path.join(__dirname,'media','music.mp3'));assert(badMp3===null,'read-image recusa áudio');
 await win.click('[data-go="camadas"]');await win.click('#btn-newbox');await win.waitForTimeout(300);
 await win.click('[data-go="ilusao"]');await win.waitForTimeout(400);
 await win.click('.il-card[data-preset="room-builder"]');await win.waitForTimeout(300);
 const url=await win.evaluate(p=>window.TimelineUI._h.toUrl(p),green);
 await win.evaluate(([g,u,gf,d])=>{const S=window.IllusionUI.state,R=S.il.room;R.walls.back.media={name:'verde.png',path:g,src:u};R.walls.left.on=R.walls.right.on=R.walls.floor.on=R.walls.ceiling.on=false;S.il.params.depth=60;
   R.sprites=[{id:'a',name:'dot',x:0,y:0,z:-20,size:4,media:{name:'dot.png',path:d},fx:''},{id:'b',name:'gif',x:5,y:0,z:-20,size:3,media:{name:'anim.gif',path:gf},fx:''}];window.IllusionUI.render();},[green,url,gif,dot]);
 await win.waitForTimeout(800);
 const shot=()=>win.evaluate(()=>{const S=window.IllusionUI.state,C=window.IllusionCore,G=window.IllusionGL;const r=C.resolveFace(null,C.validate(S.il,null).value,null,null,0);G._renderFace(r,S.il,null,200,200);return {e:G.readPixel(20,100),c:G.readPixel(100,100),st:G.mediaStatus()};});
 await shot();await win.waitForTimeout(700);const s=await shot();console.log(JSON.stringify(s));
 assert(s.st.failed===0&&s.st.ok===3,'3 imagens (PNG, PNG e GIF) carregaram pelo caminho real, sem bloqueio ('+JSON.stringify({ok:s.st.ok,falhas:s.st.failed,erros:s.st.errors})+')');
 assert(s.e[1]>120&&s.e[0]<80,'parede com PNG verde aparece como textura no Electron');
 assert(s.c[0]>150&&s.c[1]<90,'objeto PNG transparente (vermelho) aparece no centro');
 // contraprova: o mesmo arquivo pelo endereço file:// direto
 const direct=await win.evaluate(u=>new Promise(r=>{const im=new Image();im.onload=()=>{try{const c=document.createElement('canvas').getContext('webgl');const t=c.createTexture();c.bindTexture(c.TEXTURE_2D,t);c.texImage2D(c.TEXTURE_2D,0,c.RGBA,c.RGBA,c.UNSIGNED_BYTE,im);r('liberado');}catch(e){r('bloqueado: '+e.name);}};im.onerror=()=>r('erro');im.src=u;}),url);
 console.log('INFO endereço file:// direto como textura:',direct);
 assert(errs.length===0,'erros de página: '+(errs.join('|')||'nenhum'));
 await app.close();
})().catch(e=>{console.log('FAIL excecao',e.message.slice(0,500));process.exit(1);});
