// 3D Sala (room-builder): paredes ligaveis, arrastar fundo/laterais na vista, imagem e GIF como textura, objetos, angulo de visao
const {open}=require('./h.js');
const fs=require('fs');
let fails=0,n=0;function assert(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const h=await open(8897);const p=h.p;
 await p.click('#btn-newbox');await p.waitForTimeout(300);
 const calib=()=>p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>({q:s.q,mask:s.mask,mesh:s.mesh}))));const c0=await calib();
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(400);
 assert(await p.locator('.il-card.first[data-preset="room-builder"]').count()===1,'cartao Sala aparece primeiro');
 await p.click('.il-card[data-preset="room-builder"]');await p.waitForTimeout(300);
 assert(await p.locator('#il-room-cv').count()===1,'vista de edicao da sala aparece');
 const walls=await p.evaluate(()=>{const r=window.IllusionUI.state.il.room.walls;return Object.keys(r).map(k=>k+':'+r[k].on).join(',');});
 assert(walls==='back:true,left:true,right:true,floor:true,ceiling:false','padrao: fundo, laterais e chao ligados, teto desligado ('+walls+')');
 await p.click('#il-autobind');await p.waitForTimeout(200);
 await p.click('#il-apply');await p.waitForTimeout(500);
 assert(await p.evaluate(()=>!!window.IllusionUI.state.assetId),'Sala aplicada na timeline');
 // arrastar o fundo na vista de cima
 const drag=async(id)=>{const info=await p.evaluate((id)=>{const M=window.IllusionUI._roomMap(),cv=document.getElementById('il-room-cv'),r=cv.getBoundingClientRect(),R=window.IllusionUI.state.il.room,h=M.h,D=M.D;let x,y;
   if(M.view==='top'){ if(id==='back'){x=M.px(0);y=M.py(D);} else if(id==='left'){x=M.px(-(h-R.walls.left.d));y=M.py(D/2);} else {x=M.px(h-R.walls.right.d);y=M.py(D/2);} }
   else { if(id==='back'){x=M.px(D);y=M.py(0);} else if(id==='floor'){x=M.px(D/2);y=M.py(-(h-R.walls.floor.d));} else {x=M.px(D/2);y=M.py(h-R.walls.ceiling.d);} }
   return {x:r.left+x*r.width/cv.width,y:r.top+y*r.height/cv.height,sx:r.width/cv.width};},id);return info;};
 const mid=async()=>p.evaluate(()=>{const pn=document.querySelector('.panel'),cv=document.getElementById('il-room-cv');pn.scrollTop+=cv.getBoundingClientRect().top-290;});await mid();await p.waitForTimeout(250);
 const D0=await p.evaluate(()=>window.IllusionUI.state.il.params.depth);
 let a=await drag('back');
 await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(a.x,a.y+40,{steps:6});await p.mouse.up();await p.waitForTimeout(300);
 const D1=await p.evaluate(()=>window.IllusionUI.state.il.params.depth);
 assert(D1<D0,'arrastar o fundo para baixo na vista de cima traz o fundo para perto ('+D0+' -> '+D1+')');
 assert(await p.evaluate(()=>{const H=window.TimelineUI._h,id=window.IllusionUI.state.assetId,a=H.tl.seq.assets.find(x=>x.id===id);return a&&a.fx.illusion.params.depth===window.IllusionUI.state.il.params.depth;}),'a mudanca vai junto para a ilusao na timeline');
 await mid();await p.waitForTimeout(200);a=await drag('left');
 await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(a.x+30,a.y,{steps:5});await p.mouse.up();await p.waitForTimeout(300);
 const dl=await p.evaluate(()=>window.IllusionUI.state.il.room.walls.left.d);
 assert(dl>0,'arrastar a parede esquerda para dentro muda o recuo ('+dl+' pol)');
 await p.click('#il-rv-side');await p.waitForTimeout(250);
 await mid();await p.waitForTimeout(200);a=await drag('floor');
 await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(a.x,a.y-20,{steps:5});await p.mouse.up();await p.waitForTimeout(300);
 assert(await p.evaluate(()=>window.IllusionUI.state.il.room.walls.floor.d)>0,'na vista de lado o chao tambem arrasta');
 // desligar parede
 await p.evaluate(()=>{});await p.locator('#il-wall-ceiling').check();await p.waitForTimeout(200);
 assert(await p.evaluate(()=>window.IllusionUI.state.il.room.walls.ceiling.on),'teto liga pelo checkbox');
 // MIDIA: imagem verde no fundo, GIF animado em objeto
 const png=fs.readFileSync(__dirname+'/media/green.png').toString('base64'),gif=fs.readFileSync(__dirname+'/media/anim.gif').toString('base64'),dot=fs.readFileSync(__dirname+'/media/dot.png').toString('base64');
 const urls=await p.evaluate(async(d)=>{const mk=async(b,t)=>{const bin=atob(b),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return URL.createObjectURL(new Blob([u],{type:t}));};return {png:await mk(d.png,'image/png'),gif:await mk(d.gif,'image/gif'),dot:await mk(d.dot,'image/png')};},{png,gif,dot});
 await p.evaluate((u)=>{const S=window.IllusionUI.state,R=S.il.room;R.walls.back.media={name:'verde.png',src:u.png};R.walls.left.on=false;R.walls.right.on=false;R.walls.floor.on=false;R.walls.ceiling.on=false;R.walls.back.d=0;S.il.params.depth=60;
   R.sprites=[{id:'a1',name:'gif',x:0,y:0,z:-20,size:6,media:{name:'a.gif',src:u.gif},fx:''}];window.IllusionUI.render();},urls);
 await p.waitForTimeout(800);
 // renderiza a face direto (WebGL por software) e le o pixel central e uma regiao do objeto
 const shot=async()=>p.evaluate(()=>{const S=window.IllusionUI.state,C=window.IllusionCore,G=window.IllusionGL;const r=C.resolveFace(null,C.validate(S.il,null).value,null,null,0);G._renderFace(r,S.il,null,200,200);return {c:G.readPixel(100,100),e:G.readPixel(20,100),st:G.mediaStatus()};});
 await shot();await p.waitForTimeout(500);
 const s1=await shot();
 console.log('pixels',JSON.stringify(s1));
 assert(s1.st.failed===0&&s1.st.ok>=1,'imagens carregaram sem erro de seguranca (ok='+s1.st.ok+', falhas='+s1.st.failed+')');
 assert(s1.e[1]>120&&s1.e[0]<80,'parede do fundo com imagem verde aparece como textura');
 assert(s1.c[0]>120||s1.c[2]>120,'objeto GIF aparece no centro (vermelho ou azul)');
 // GIF: o app reenvia o quadro atual do GIF pra textura varias vezes (a imagem estatica so uma vez). Quem anima o GIF e o navegador;
 // no Chromium sem tela os quadros do GIF nao avancam, por isso aqui se confere o reenvio e nao a troca de cor.
 for(let i=0;i<20;i++){await p.screenshot({clip:{x:0,y:0,width:4,height:4}});await shot();await p.waitForTimeout(50);}
 const ms=(await shot()).st.items,g=ms.find(x=>/blob:/.test(x.key)&&x.anim),stat=ms.filter(x=>!x.anim);
 assert(g&&g.uploads>=5,'GIF reenvia o quadro atual para a textura durante a animacao (envios='+(g&&g.uploads)+')');
 assert(stat.length>=1&&stat.every(x=>x.uploads===1),'PNG estatico e enviado uma unica vez');
 // PNG com transparencia: o fundo atras do objeto continua visivel
 await p.evaluate((u)=>{const S=window.IllusionUI.state;S.il.room.sprites=[{id:'a2',name:'dot',x:0,y:0,z:-20,size:4,media:{name:'dot.png',src:u.dot},fx:''}];},urls);
 await p.waitForTimeout(600);await shot();await p.waitForTimeout(300);
 const t=await p.evaluate(()=>{const S=window.IllusionUI.state,C=window.IllusionCore,G=window.IllusionGL;const r=C.resolveFace(null,C.validate(S.il,null).value,null,null,0);G._renderFace(r,S.il,null,200,200);return {c:G.readPixel(100,100),corner:G.readPixel(117,117)};});
 assert(t.c[0]>150&&t.corner[1]>100,'PNG transparente: centro vermelho, canto do objeto mostra a parede verde atras ('+JSON.stringify(t)+')');
 // projeto salva e reabre com a sala
 const saved=await p.evaluate(()=>JSON.stringify(window.TimelineUI._h.tl.seq));
 assert(JSON.parse(saved).assets.some(a=>a.fx&&a.fx.illusion&&a.fx.illusion.room&&a.fx.illusion.room.walls),'sala fica gravada no projeto');
 // angulo de visao
 await p.locator('details[data-sec="cam"] summary').click();await p.waitForTimeout(200);
 await p.click('#il-ang-70');await p.waitForTimeout(250);
 assert(await p.evaluate(()=>window.IllusionUI.state.view==='free'&&window.IllusionUI.state.orbit.pitch===70),'botao De cima inclina a camera da previa para 70 graus');
 assert(await calib()===c0,'surface.q, mascara e malha intactos');
 assert(h.errs.length===0,'erros de pagina: '+(h.errs.join('|')||'nenhum'));
 console.log(n+' testes, '+fails+' falhas');
 await h.close();process.exit(fails?1:0);
})().catch(e=>{console.log('FAIL excecao',e.message);process.exit(1);});
