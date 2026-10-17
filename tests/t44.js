// P1a: máscaras extras por superfície (várias, inverter, feather, desfazer, salvar e reabrir).
const {open}=require('./h.js');
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const h=await open(8987,{easy:true,w:1500,h:1000}),p=h.p;
 await p.waitForTimeout(800);
 await p.evaluate(()=>document.getElementById('btn-newbox').click());await p.waitForTimeout(400);
 const a=()=>p.evaluate(()=>{const s=window.__lastState.surfaces.slice(-1)[0];return {n:(s.cuts||[]).length,cuts:JSON.parse(JSON.stringify(s.cuts||[])),key:s.key}});
 ok((await a()).n===0,'superfície nova começa sem máscaras extras');
 await p.evaluate(()=>{document.getElementById('cut-shape').value='rect';document.getElementById('cut-add').click()});await p.waitForTimeout(500);
 let s0=await a();ok(s0.n===1&&s0.cuts[0].pts.length===4&&s0.cuts[0].on===true&&s0.cuts[0].inv===false,'+ Máscara cria 1 máscara de 4 pontos');
 await p.evaluate(()=>{document.getElementById('cut-shape').value='circle';document.getElementById('cut-add').click()});await p.waitForTimeout(500);
 s0=await a();ok(s0.n===2&&s0.cuts[1].pts.length>8,'segunda máscara (círculo) adicionada: '+s0.cuts[1].pts.length+' pontos');
 ok(await p.locator('#cut-list .cut-row').count()===2,'lista mostra 2 linhas');
 // máscara de alfa: dentro do retângulo (centro) some, fora aparece
 const alpha=(xy)=>p.evaluate((xy)=>{const s=window.__lastState.surfaces.slice(-1)[0];const m=RendererCuts.cutMask(s);if(!m)return null;const c=m.canvas.getContext('2d');return xy.map(q=>c.getImageData(Math.round(q[0]*(m.canvas.width-1)),Math.round(q[1]*(m.canvas.height-1)),1,1).data[3])},xy);
 // desliga o círculo para testar só o retângulo
 await p.evaluate((id)=>document.getElementById('cut-on-'+id).click(),s0.cuts[1].id);await p.waitForTimeout(400);
 let al=await alpha([[0.5,0.5],[0.05,0.05],[0.9,0.9]]);
 ok(al&&al[0]===0&&al[1]===255&&al[2]===255,'recorte: centro transparente, fora opaco '+JSON.stringify(al));
 // inverter
 await p.evaluate((id)=>document.getElementById('cut-inv-'+id).click(),s0.cuts[0].id);await p.waitForTimeout(400);
 al=await alpha([[0.5,0.5],[0.05,0.05],[0.9,0.9]]);
 ok(al&&al[0]===255&&al[1]===0&&al[2]===0,'invertida: só o interior aparece '+JSON.stringify(al));
 await p.evaluate((id)=>document.getElementById('cut-inv-'+id).click(),s0.cuts[0].id);await p.waitForTimeout(300);
 // feather
 await p.evaluate((id)=>{const f=document.getElementById('cut-f-'+id);f.value=30;f.dispatchEvent(new Event('input',{bubbles:true}))},s0.cuts[0].id);await p.waitForTimeout(400);
 al=await alpha([[0.26,0.5],[0.5,0.5],[0.02,0.5]]);
 ok(al&&al[0]>5&&al[0]<250&&al[2]===255,'feather deixa a borda intermediária '+JSON.stringify(al));
 // DOM: mask-image aplicado no elemento
 const mi=await p.evaluate(()=>{const e=[...document.querySelectorAll('#stage .surf')].pop();return (e.style.maskImage||e.style.webkitMaskImage||'').slice(0,40)});
 ok(/url\(/.test(mi),'elemento da superfície usa mask-image: '+mi);
 // arrastar um ponto da máscara selecionada com o mouse
 await p.evaluate((id)=>document.getElementById('cut-sel-'+id).click(),s0.cuts[0].id);await p.waitForTimeout(500);
 const g=await p.evaluate(()=>{const c=document.querySelector('#overlay .h-cutpt[data-i="0"]');const b=c.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}});
 const before=(await a()).cuts[0].pts[0].slice();
 await p.mouse.move(g.x,g.y);await p.mouse.down();await p.mouse.move(g.x-40,g.y-30,{steps:6});await p.mouse.up();await p.waitForTimeout(400);
 const after=(await a()).cuts[0].pts[0];
 ok(after[0]!==before[0]&&after[1]!==before[1],'arrastar ponto muda a máscara '+JSON.stringify(before)+' -> '+JSON.stringify(after));
 ok(JSON.stringify((await a()).cuts[1].pts)===JSON.stringify(s0.cuts[1].pts),'a outra máscara não mexeu');
 // duplo clique no ponto apaga (retângulo tem 4: vira 3), depois não deixa passar de 3
 await p.mouse.dblclick(g.x-40,g.y-30);await p.waitForTimeout(400);
 ok((await a()).cuts[0].pts.length===3,'duplo clique no ponto remove (4 -> 3)');
 // desfazer
 await p.evaluate(()=>{document.activeElement&&document.activeElement.blur()});await p.keyboard.press('Control+z');await p.waitForTimeout(400);
 ok((await a()).cuts[0].pts.length===4,'Ctrl+Z desfaz a remoção');
 // salvar e reabrir: cuts vão no projeto
 const saved=await p.evaluate(()=>{window.__saved=null;const b=document.getElementById('btn-save');b&&b.click();return null});await p.waitForTimeout(600);
 const js=await p.evaluate(()=>window.__saved);
 ok(js&&/"cuts"/.test(js)&&/Máscara 1/.test(js),'projeto salvo contém as máscaras extras');
 // apagar
 await p.evaluate((id)=>document.getElementById('cut-del-'+id).click(),s0.cuts[1].id);await p.waitForTimeout(400);
 ok((await a()).n===1,'Apagar remove a máscara');
 ok(h.errs.length===0,'sem erros de JS '+JSON.stringify(h.errs.slice(0,3)));
 await h.close();console.log(fails?'HA FALHAS '+fails:'TUDO OK '+n);process.exit(fails?1:0);})();
