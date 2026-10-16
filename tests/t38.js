// Camadas por face (profundidade, lado, altura, tamanho, painel) e GIF animado no 3D.
const {open}=require('./h.js');
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const PORT=8975,h=await open(PORT,{easy:true,w:1300,h:1800}),p=h.p;
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1500);
 await p.evaluate(({PORT})=>{const names=['Parede - Labirinto','Piso - Xadrez preto e branco','Teto - Ondas','Personagem - Rato animado'];
   window.api=Object.assign(window.api||{},{libraryApp:()=>Promise.resolve(names.map(n=>'/biblioteca/'+n+(/animado/.test(n)?'.gif':'.png'))),openMedia:()=>Promise.resolve(['/media/pack/grade.png'])});
   const H=TimelineUI._h;H.toUrl=p=>'http://localhost:'+PORT+encodeURI(p);},{PORT});
 await p.evaluate(()=>IllusionUI.render&&IllusionUI.render());await p.waitForTimeout(400);
 const sp=()=>p.evaluate(()=>JSON.parse(JSON.stringify(IllusionUI.state.il.room.sprites)));
 // sala simples (uma face): camada de objeto e painel
 await p.click('#il-sala-quarto');await p.waitForTimeout(400);
 ok(await p.locator('#il-ly-add-obj').count()===1&&await p.locator('#il-ly-add-painel').count()===1,'botões de camada existem');
 await p.click('#il-ly-add-painel');await p.waitForTimeout(900);
 let s=await sp();
 ok(s.length===1&&s[0].size===16&&s[0].z<0,'painel entra cobrindo a janela (tamanho 16) e dentro da sala ('+JSON.stringify(s[0]&&[s[0].size,s[0].z])+')');
 const lay=p.locator('[data-layer]').first();
 ok(await lay.count()===1,'linha da camada existe');
 // slider de profundidade da camada: máximo = profundidade da sala
 const rg=lay.locator('input[type=range]').first();
 const mx=await rg.evaluate(e=>+e.max);
 const dep=await p.evaluate(()=>IllusionUI.state.il.params.depth);
 ok(mx===Math.round(dep),'slider de profundidade da camada vai até o fundo da sala ('+mx+' = '+dep+')');
 await rg.evaluate(e=>{e.value=e.max;e.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(300);
 s=await sp();
 ok(Math.abs(-s[0].z-dep)<0.6,'profundidade máxima põe a camada no fundo (z='+s[0].z+')');
 await rg.evaluate(e=>{e.value=0;e.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(300);
 s=await sp();
 ok(Math.abs(s[0].z)<0.6,'profundidade 0 põe a camada na janela (z='+s[0].z+')');
 // ↺ da camada volta ao valor de entrada
 await lay.locator('.il-rs').first().click();await p.waitForTimeout(300);
 s=await sp();ok(Math.abs(-s[0].z-dep*0.5)<0.6,'↺ volta a camada à profundidade original (z='+s[0].z+')');
 // desfazer remove a camada
 await p.waitForTimeout(800);
 await p.click('#il-undo');await p.waitForTimeout(500);
 for(let i=0;i<6&&(await sp()).length>0;i++){await p.click('#il-undo');await p.waitForTimeout(400);}
 ok((await sp()).length===0,'Desfazer volta até antes da camada');
 await p.click('#il-redo');await p.waitForTimeout(400);
 // limite de camadas
 await p.evaluate(()=>{const R=IllusionUI.state.il.room;while(R.sprites.length<12)R.sprites.push({id:'x'+R.sprites.length,name:'x',x:0,y:0,z:-5,size:4,media:null,fx:''});});
 await p.evaluate(()=>IllusionUI.render());await p.waitForTimeout(400);
 await p.click('#il-ly-add-obj');await p.waitForTimeout(500);
 ok((await sp()).length===12,'limite de 12 camadas respeitado');
 // GIF animado: decodifica quadros e troca de quadro com o tempo
 const gif=await p.evaluate(async({PORT})=>{const S=IllusionUI.state;S.il.room.sprites=[];S.il.room.walls.back.media={path:'/biblioteca/GIF - Bokeh.gif',src:'http://localhost:'+PORT+'/biblioteca/GIF%20-%20Bokeh.gif',name:'GIF - Bokeh.gif'};
   const rig=JSON.parse(JSON.stringify(TimelineUI._h.tl.seq.stage));rig.cubes=[rig.cubes[0]];
   const cv=document.createElement('canvas');cv.width=400;cv.height=400;document.body.appendChild(cv);const o={rig,il:S.il,ill:null,t:0,view:'audience',orbit:S.orbit,focus:false};
   const sleep=ms=>new Promise(r=>setTimeout(r,ms));IllusionGL.drawStage(cv,o);await sleep(2500);const hs=new Set();
   for(let i=0;i<60&&hs.size<4;i++){IllusionGL.drawStage(cv,o);const u=cv.toDataURL();let hh=0;for(let q=0;q<u.length;q+=7)hh=(hh*31+u.charCodeAt(q))|0;hs.add(hh);await sleep(230);}
   return hs.size;},{PORT});
 ok(gif>=4,'GIF anima dentro da parede 3D ('+gif+' quadros distintos em ate 60 capturas)');
 ok(h.errs.length===0,'sem erros de página '+h.errs.join('|'));
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
