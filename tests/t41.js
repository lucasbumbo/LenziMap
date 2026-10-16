// Interface estilo The Sims: catálogo, pincel (pintar parede/piso), colocar personagem no chão, selecionar com destaque, teclado
const {open}=require('./h.js');
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const PORT=8984,h=await open(PORT,{easy:true,w:1300,h:1500}),p=h.p;
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1500);
 await p.evaluate(({PORT})=>{
  const names=['Parede - Labirinto.png','Parede - Amarelo geometrico.png','Piso - Xadrez preto e branco.png','Personagem - Rato em pe.png'];
  window.api=Object.assign(window.api||{},{libraryApp:()=>Promise.resolve(names.map(n=>'/biblioteca/'+n))});
  TimelineUI._h.toUrl=pp=>'http://localhost:'+PORT+encodeURI(pp);
  const S=IllusionUI.state,base='http://localhost:'+PORT+'/biblioteca/',M=n=>({name:n,src:base+encodeURI(n)});
  TimelineUI._h.tl.seq.stage.cubes[0].rotY=-45;
  const W=S.il.room.walls;W.back.on=W.right.on=W.floor.on=true;W.ceiling.on=false;W.back.media=M('Parede - Labirinto.png');W.right.media=M('Parede - Labirinto.png');W.floor.media=M('Piso - Xadrez preto e branco.png');
  S.il.room.join='top+front+right';S.il.target.faces=['front','right','top'];S.il.params.depth=24;S.il.room.sprites=[];IllusionUI.render();},{PORT});
 await p.waitForTimeout(3000);
 ok(await p.locator('#il-catalogo .il-th').count()>=2,'catálogo de paredes mostra miniaturas ('+await p.locator('#il-catalogo .il-th').count()+')');
 const scan=(kind)=>p.evaluate((kind)=>{const cv=document.getElementById('il-canvas'),S=IllusionUI.state;
  for(let y=10;y<cv.height;y+=5)for(let x=10;x<cv.width;x+=5){const hh=IllusionGL.roomPick(TimelineUI._h.tl.seq.stage,S.il,x,y);if(hh&&hh.id===kind)return [x,y];}return null;},kind);
 const box=await p.evaluate(()=>{const c=document.getElementById('il-canvas').getBoundingClientRect();return [c.left,c.top,c.width,c.height,document.getElementById('il-canvas').width,document.getElementById('il-canvas').height]});
 const pg=(pt)=>[box[0]+pt[0]*box[2]/box[4],box[1]+pt[1]*box[3]/box[5]];
 // pintar o piso com a outra textura
 await p.click('#il-catalogo .il-th:nth-child(2)');await p.waitForTimeout(500);
 ok(await p.evaluate(()=>!!IllusionUI.state.tool&&IllusionUI.state.tool.kind==='tex'),'escolher miniatura liga o pincel');
 ok(await p.locator('#il-selbar').count()===1,'barra mostra o pincel ativo');
 const fl=await scan('wall:floor');ok(!!fl,'acha o piso sob o mouse');
 const fp=pg(fl);await p.mouse.click(fp[0],fp[1]);await p.waitForTimeout(600);
 const fm=await p.evaluate(()=>IllusionUI.state.il.room.walls.floor.media.name);
 ok(/Labirinto|Amarelo/.test(fm)&&!/Xadrez/.test(fm),'clicar no piso com o pincel troca a imagem do piso ('+fm+')');
 ok(await p.evaluate(()=>IllusionUI.state.selId)==='wall:floor','o piso pintado fica selecionado');
 // contorno de destaque
 const ol=await p.evaluate(()=>{const S=IllusionUI.state;return IllusionGL.roomOutline(TimelineUI._h.tl.seq.stage,S.il,['wall:floor']).reduce((a,f)=>a+f.shapes.length,0)});
 ok(ol>0,'o piso selecionado tem contorno nas faces ('+ol+')');
 // colocar personagem no chão
 await p.click('#il-cat-personagem');await p.waitForTimeout(500);
 await p.click('#il-catalogo .il-th:nth-child(1)');await p.waitForTimeout(400);
 const fl2=await scan('wall:floor');const fp2=pg(fl2);
 await p.mouse.click(fp2[0],fp2[1]);await p.waitForTimeout(700);
 const sp=await p.evaluate(()=>{const S=IllusionUI.state,q=S.il.room.sprites[0];return q?{n:S.il.room.sprites.length,y:q.y,size:q.size,x:q.x,z:q.z,fy:IllusionCore.floorY(8,24)}:null});
 ok(!!sp&&sp.n===1&&Math.abs(sp.y-(sp.fy+sp.size/2))<0.01,'clicar no piso coloca o personagem em pé no chão ('+JSON.stringify(sp)+')');
 ok(await p.evaluate(()=>IllusionUI.state.selId&&IllusionUI.state.selId.indexOf('sp:')===0),'o personagem colocado fica selecionado');
 // Maior / Delete
 const s0=sp.size;await p.click('#il-sel-big');await p.waitForTimeout(300);
 ok(await p.evaluate(()=>IllusionUI.state.il.room.sprites[0].size)>s0,'botão Maior aumenta o personagem');
 await p.click('#il-tool-off');await p.waitForTimeout(300);
 await p.focus('#il-canvas');await p.keyboard.press('Delete');await p.waitForTimeout(400);
 ok(await p.evaluate(()=>IllusionUI.state.il.room.sprites.length)===0,'tecla Delete tira o personagem selecionado');
 await p.click('#il-undo');await p.waitForTimeout(300);
 ok(await p.evaluate(()=>IllusionUI.state.il.room.sprites.length)===1,'Desfazer traz o personagem de volta');
 ok(h.errs.length===0,'sem erros de página '+h.errs.join('|'));
 await h.close();console.log(fails?'FALHOU '+fails:'TUDO OK '+n);process.exit(fails?1:0);})();
