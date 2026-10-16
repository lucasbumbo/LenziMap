// Cubo 3D clicável: girar com o mouse, clicar numa face escolhe a face (e liga uma tela)
const {open}=require('./h.js');
let fails=0,n=0;function assert(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const h=await open(8939,{easy:true,w:1300,h:1700}),p=h.p;
 for(let i=0;i<3;i++){await p.click('#btn-newbox');await p.waitForTimeout(250);}
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1500);
 assert(await p.evaluate(()=>window.IllusionUI.state.view)==='free','modo fácil abre com a câmera livre (girar com o mouse)');
 const faces=await p.evaluate(()=>window.IllusionGL.stageFaces().filter(f=>f.cube==='A'&&f.visible).map(f=>f.face));
 assert(faces.indexOf('top')>=0&&faces.length>=2,'faces visíveis do Cubo A: '+faces.join(','));
 const clickFace=async(face)=>{
  const pt=await p.evaluate((fc)=>{const f=window.IllusionGL.stageFaces().find(x=>x.cube==='A'&&x.face===fc&&x.visible);if(!f)return null;const cv=document.getElementById('il-canvas'),r=cv.getBoundingClientRect();let cx=0,cy=0;f.poly.forEach(q=>{cx+=q[0]/4;cy+=q[1]/4;});return {x:r.left+cx*r.width/cv.width,y:r.top+cy*r.height/cv.height};},face);
  if(!pt)return false;await p.mouse.move(pt.x,pt.y);await p.mouse.down();await p.mouse.up();await p.waitForTimeout(500);return true;};
 assert(await clickFace('top'),'achou a face de cima na tela');
 let st=await p.evaluate(()=>({f:window.IllusionUI.state.il.target.faces,k:window.TimelineUI._h.tl.seq.stage.cubes[0].faces.top}));
 assert(st.f[0]==='top'&&!!st.k,'clicar na face de cima escolhe Topo e liga uma tela ('+JSON.stringify(st)+')');
 const other=faces.find(f=>f!=='top');
 assert(await clickFace(other),'achou outra face: '+other);
 st=await p.evaluate(()=>window.IllusionUI.state.il.target.faces);
 assert(st[0]===other,'clicar em outra face troca a escolhida ('+st[0]+')');
 // arrastar gira e não escolhe
 const y0=await p.evaluate(()=>window.IllusionUI.state.orbit.yaw), fBefore=await p.evaluate(()=>window.IllusionUI.state.il.target.faces[0]);
 const bb=await p.locator('#il-canvas').boundingBox();
 await p.click('#il-dm-orbit');
 await p.mouse.move(bb.x+bb.width*0.5,bb.y+bb.height*0.5);await p.mouse.down();await p.mouse.move(bb.x+bb.width*0.5+80,bb.y+bb.height*0.5,{steps:6});await p.mouse.up();await p.waitForTimeout(300);
 const y1=await p.evaluate(()=>window.IllusionUI.state.orbit.yaw);
 assert(Math.abs(y1-y0)>10,'arrastar com o mouse gira o cubo ('+Math.round(y0)+' -> '+Math.round(y1)+')');
 assert(await p.evaluate(()=>window.IllusionUI.state.il.target.faces[0])===fBefore,'arrastar não muda a face escolhida');
 // botões de ângulo
 await p.click('#il-ang-70');await p.waitForTimeout(300);
 assert(await p.evaluate(()=>window.IllusionUI.state.orbit.pitch)===70,'botão De cima inclina a visão');
 assert(h.errs.length===0,'erros de página: nenhum ('+h.errs.join('|')+')');
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
