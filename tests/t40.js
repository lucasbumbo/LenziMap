// Arrastar imagens dentro do cubo: parede/piso deslizam a imagem, personagem anda pelo chão, modo girar não mexe nas camadas, desfazer volta
const {open}=require('./h.js');
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const PORT=8982,h=await open(PORT,{easy:true,w:1300,h:1500}),p=h.p;
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1500);
 await p.evaluate(({PORT})=>{
  const S=IllusionUI.state,base='http://localhost:'+PORT+'/biblioteca/',M=n=>({name:n,src:base+encodeURI(n)});
  const st=TimelineUI._h.tl.seq.stage;st.cubes[0].rotY=-45;
  const W=S.il.room.walls;W.back.on=W.right.on=W.floor.on=true;W.ceiling.on=false;
  W.back.media=M('Parede - Labirinto.png');W.right.media=M('Parede - Labirinto.png');W.floor.media=M('Piso - Xadrez preto e branco.png');
  S.il.room.join='top+front+right';S.il.target.faces=['front','right','top'];S.il.params.depth=24;
  S.il.room.sprites=[{id:'r',name:'Rato',x:-4,y:-10,z:-4,size:12,media:M('Personagem - Rato em pe.png'),fx:''}];
  IllusionUI.render();},{PORT});
 await p.waitForTimeout(3500);
 const cvBox=await p.evaluate(()=>{const c=document.getElementById('il-canvas').getBoundingClientRect();return [c.left,c.top,c.width,c.height]});
 // varre a prévia e acha um ponto de parede e um do personagem
 const pts=await p.evaluate(()=>{const cv=document.getElementById('il-canvas'),sx=cv.width/cv.getBoundingClientRect().width,out={wall:null,sp:null};
  for(let y=10;y<cv.height&&!(out.wall&&out.sp);y+=6)for(let x=10;x<cv.width;x+=6){const hh=IllusionGL.roomPick(TimelineUI._h.tl.seq.stage,IllusionUI.state.il,x,y);if(!hh)continue;
   if(!out.sp&&hh.id.indexOf('sp:')===0)out.sp=[x,y,hh.id];if(!out.wall&&hh.id==='wall:right')out.wall=[x,y,hh.id];}
  return out;});
 console.log(JSON.stringify(pts));
 ok(!!pts.wall,'acha a parede da direita sob o mouse');ok(!!pts.sp,'acha o personagem sob o mouse');
 const cs=await p.evaluate(()=>{const cv=document.getElementById('il-canvas');return [cv.width,cv.height]});
 const toPage=(pt)=>[cvBox[0]+pt[0]*cvBox[2]/cs[0],cvBox[1]+pt[1]*cvBox[3]/cs[1]];
 const tf0=await p.evaluate(()=>JSON.stringify(IllusionUI.state.il.room.walls.right.tf));
 let a=toPage(pts.wall);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(a[0]+30,a[1]+10,{steps:6});await p.mouse.up();await p.waitForTimeout(400);
 const tf1=await p.evaluate(()=>JSON.stringify(IllusionUI.state.il.room.walls.right.tf));
 ok(tf0!==tf1,'arrastar a parede desliza só a imagem dela ('+tf0+' -> '+tf1+')');
 const otherTf=await p.evaluate(()=>JSON.stringify([IllusionUI.state.il.room.walls.back.tf,IllusionUI.state.il.room.walls.floor.tf]));
 ok(otherTf===JSON.stringify([{x:0,y:0,s:1,r:0},{x:0,y:0,s:1,r:0}]),'as outras camadas não mudaram');
 const sp0=await p.evaluate(()=>{const q=IllusionUI.state.il.room.sprites[0];return [q.x,q.z]});
 a=toPage(pts.sp);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(a[0]+35,a[1]+8,{steps:6});await p.mouse.up();await p.waitForTimeout(400);
 const sp1=await p.evaluate(()=>{const q=IllusionUI.state.il.room.sprites[0];return [q.x,q.z]});
 ok(Math.abs(sp1[0]-sp0[0])+Math.abs(sp1[1]-sp0[1])>0.5,'arrastar o personagem anda pelo chão ('+sp0+' -> '+sp1+')');
 ok(await p.evaluate(()=>IllusionUI.state.il.room.sprites[0].y)===-10,'a altura do personagem não mudou');
 // desfazer
 await p.click('#il-undo');await p.waitForTimeout(300);
 const sp2=await p.evaluate(()=>{const q=IllusionUI.state.il.room.sprites[0];return [q.x,q.z]});
 ok(sp2[0]===sp0[0]&&sp2[1]===sp0[1],'Desfazer devolve o personagem');
 // modo girar
 await p.click('#il-dm-orbit');await p.waitForTimeout(300);
 const o0=await p.evaluate(()=>IllusionUI.state.orbit.yaw),tf2=await p.evaluate(()=>JSON.stringify(IllusionUI.state.il.room.walls.right.tf));
 a=toPage(pts.wall);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(a[0]+60,a[1],{steps:6});await p.mouse.up();await p.waitForTimeout(300);
 const o1=await p.evaluate(()=>IllusionUI.state.orbit.yaw),tf3=await p.evaluate(()=>JSON.stringify(IllusionUI.state.il.room.walls.right.tf));
 ok(o1!==o0&&tf2===tf3,'no modo girar o cubo gira e as camadas ficam quietas');
 ok(h.errs.length===0,'sem erros de página '+h.errs.join('|'));
 await h.close();console.log(fails?'FALHOU '+fails:'TUDO OK '+n);process.exit(fails?1:0);})();
