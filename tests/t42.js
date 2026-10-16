// Distorcer os cantos de uma parede/piso sem mexer nas outras camadas.
const {open}=require('./h.js');
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const PORT=8986,h=await open(PORT,{easy:true,w:1300,h:1500}),p=h.p;
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1500);
 await p.evaluate(({PORT})=>{
  window.api=Object.assign(window.api||{},{libraryApp:()=>Promise.resolve(['/biblioteca/Parede - Labirinto.png','/biblioteca/Piso - Xadrez preto e branco.png'])});
  TimelineUI._h.toUrl=pp=>'http://localhost:'+PORT+encodeURI(pp);
  const S=IllusionUI.state,base='http://localhost:'+PORT+'/biblioteca/',M=n=>({name:n,src:base+encodeURI(n)});
  TimelineUI._h.tl.seq.stage.cubes[0].rotY=-45;
  const W=S.il.room.walls;W.back.on=W.right.on=W.floor.on=true;W.ceiling.on=false;W.back.media=M('Parede - Labirinto.png');W.right.media=M('Parede - Labirinto.png');W.floor.media=M('Piso - Xadrez preto e branco.png');
  S.il.room.join='top+front+right';S.il.target.faces=['front','right','top'];S.il.params.depth=24;S.orbit={yaw:0,pitch:30,dist:44};S.selId=null;IllusionUI.render();},{PORT});
 await p.waitForTimeout(2500);
 const px=async()=>p.evaluate(()=>{const c=document.getElementById('il-canvas'),t=document.createElement('canvas');t.width=c.width;t.height=c.height;const x=t.getContext('2d');x.drawImage(c,0,0);return Array.from(x.getImageData(0,0,c.width,c.height).data).join(',').length+':'+x.getImageData(0,0,c.width,c.height).data.reduce((a,v,i)=>a+(i%4<3?v:0),0);});
 const before=await px();
 await p.screenshot({path:'/tmp/claude-0/warp0.png'});
 ok(await p.locator('#il-tf-floor').count()===1,'caixa do piso existe');
 await p.evaluate(()=>{const S=IllusionUI.state,W=S.il.room.walls;W.floor.tf=W.floor.tf||{x:0,y:0,s:1,r:0};W.floor.tf.c=[0.3,0.2,0,0,-0.2,0,0,0];IllusionUI.render();});
 await p.waitForTimeout(1500);
 const after=await px();
 await p.screenshot({path:'/tmp/claude-0/warp1.png'});
 ok(before!==after,'distorcer o piso muda a imagem');
 const st=await p.evaluate(()=>{const W=IllusionUI.state.il.room.walls;return {b:JSON.stringify(W.back.tf.c||null),f:W.floor.tf.c.join()}});
 ok(st.f==='0.3,0.2,0,0,-0.2,0,0,0'&&(st.b==='null'||/^\[(0,?)+\]$/.test(st.b)),'só o piso foi distorcido ('+JSON.stringify(st)+')');
 await p.evaluate(()=>{document.getElementById('il-tf-floor').open=true});await p.click('#il-tf-c0-floor');await p.waitForTimeout(800);
 ok(await p.evaluate(()=>IllusionUI.state.il.room.walls.floor.tf.c.every(v=>v===0)),'Tirar a distorção zera');
 await h.close();console.log(fails?'HA FALHAS':'TUDO OK '+n);process.exit(fails?1:0);})();
