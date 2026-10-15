// Cada face tem a própria configuração: girar o 3D, profundidade e camadas (incluindo chão). Mudar numa face não mexe na outra.
const {open}=require('./h.js');
let fails=0,n=0;function assert(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const h=await open(8946,{easy:true,w:1300,h:1900}),p=h.p;
 for(let i=0;i<3;i++){await p.click('#btn-newbox');await p.waitForTimeout(250);}
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1500);
 await p.evaluate(()=>{['il-fino','il-cores'].forEach(i=>{const d=document.getElementById(i);if(d)d.open=true;});});await p.waitForTimeout(200);
 const num=(lab)=>p.locator('input[type=number][aria-label="'+lab+' valor"]');
 const GIRAR='Girar o 3D (graus, esquerda/direita)',PROF='Profundidade do fundo (pol)';
 assert(await p.locator('text=Girar o 3D').count()>=1&&await p.locator('text=Inclinar o 3D').count()>=1&&await p.locator('text=Profundidade do fundo').count()>=1,'painel tem Girar, Inclinar e Profundidade');
 const ws=await Promise.all(['back','left','right','floor','ceiling'].map(k=>p.locator('#il-wall-'+k).count()));
 assert(ws.every(x=>x===1),'camadas: fundo, esquerda, direita, chão e teto');
 assert(await p.locator('text=De onde o público vê').count()===0,'sem passos extras de perspectiva');
 await p.click('#il-pick-front');await p.waitForTimeout(500);
 await num(GIRAR).fill('25');await num(GIRAR).press('Tab');await p.waitForTimeout(300);
 await num(PROF).fill('90');await num(PROF).press('Tab');await p.waitForTimeout(300);
 await p.click('#il-pick-right');await p.waitForTimeout(600);
 let r=await p.evaluate(()=>({yaw:window.IllusionUI.state.il.camera.yaw,depth:window.IllusionUI.state.il.params.depth,f:window.IllusionUI.state.il.target.faces}));
 assert(r.f[0]==='right'&&r.yaw===0&&r.depth!==90,'a face Direita começa com a configuração própria ('+JSON.stringify(r)+')');
 await num(GIRAR).fill('-15');await num(GIRAR).press('Tab');await p.waitForTimeout(300);
 await p.click('#il-pick-front');await p.waitForTimeout(600);
 r=await p.evaluate(()=>({yaw:window.IllusionUI.state.il.camera.yaw,depth:window.IllusionUI.state.il.params.depth}));
 assert(r.yaw===25&&r.depth===90,'voltar na Frente mantém o que foi ajustado nela ('+JSON.stringify(r)+')');
 // chão: liga/desliga e profundidade própria
 const fl=await p.evaluate(()=>window.IllusionUI.state.il.room.walls.floor.on);
 assert(fl===true,'chão vem ligado');
 await p.uncheck('#il-wall-floor');await p.waitForTimeout(300);await p.check('#il-wall-floor');await p.waitForTimeout(300);
 await p.evaluate(()=>{['il-fino','il-cores'].forEach(i=>{const d=document.getElementById(i);if(d)d.open=true;});});await p.waitForTimeout(200);
 const FL='Chão: profundidade para dentro (pol)';
 assert(await num(FL).count()===1,'chão tem ajuste de profundidade');
 await num(FL).fill('4');await num(FL).press('Tab');await p.waitForTimeout(300);
 assert(await p.evaluate(()=>window.IllusionUI.state.il.room.walls.floor.d)===4,'profundidade do chão vale (4)');
 // girar muda de verdade a perspectiva
 const e=await p.evaluate(()=>{const C=window.IllusionCore,s=window.TimelineUI._h.tl.seq.stage,il=window.IllusionUI.state.il,a=C.resolveFace(s,il,null,null,0,{cube:'A',face:'front'}),i2=JSON.parse(JSON.stringify(il));i2.camera.yaw=0;const b=C.resolveFace(s,i2,null,null,0,{cube:'A',face:'front'});return {a:a.eye,b:b.eye};});
 assert(Math.abs(e.a[0]-e.b[0])>5,'girar o 3D muda a perspectiva da face ('+e.a.map(x=>x.toFixed(0))+' contra '+e.b.map(x=>x.toFixed(0))+')');
 // aplicar nas duas faces
 await p.click('#il-apply');await p.waitForTimeout(800);
 await p.click('#il-pick-right');await p.waitForTimeout(600);
 await p.click('#il-apply');await p.waitForTimeout(800);
 const cl=await p.evaluate(()=>window.TimelineUI._h.tl.seq.assets.filter(a=>a.fx&&a.fx.illusion).map(a=>a.fx.illusion.camera.yaw+'/'+a.fx.illusion.target.faces.join()));
 assert(cl.length===2&&cl.indexOf('25/front')>=0&&cl.indexOf('-15/right')>=0,'cada face virou o seu clipe com o seu giro ('+cl.join(' ; ')+')');
 await num(GIRAR).fill('10');await num(GIRAR).press('Tab');await p.waitForTimeout(400);
 const cl2=await p.evaluate(()=>window.TimelineUI._h.tl.seq.assets.filter(a=>a.fx&&a.fx.illusion).map(a=>a.fx.illusion.camera.yaw+'/'+a.fx.illusion.target.faces.join()));
 assert(cl2.indexOf('10/right')>=0&&cl2.indexOf('25/front')>=0,'mudar a Direita depois de aplicar atualiza só o clipe dela ('+cl2.join(' ; ')+')');
 await p.click('#il-sala-caixa');await p.waitForTimeout(400);
 const on=await Promise.all(['back','left','right','floor','ceiling'].map(k=>p.locator('#il-wall-'+k).isChecked()));
 assert(JSON.stringify(on)==='[true,false,false,false,false]','sala pronta Caixa funda: só o fundo '+JSON.stringify(on));
 await p.click('#il-sala-corredor');await p.waitForTimeout(400);
 const on2=await Promise.all(['back','left','right','floor','ceiling'].map(k=>p.locator('#il-wall-'+k).isChecked()));
 assert(on2.every(x=>x),'sala pronta Corredor: todas as camadas');
 assert(h.errs.length===0,'erros de página: nenhum ('+h.errs.join('|')+')');
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
