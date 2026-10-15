// Layout profissional com mouse real: divisória, ocultar, maximizar, workspaces, layouts salvos, persistência, Show Mode.
const {open}=require('./h.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{const h=await open(8871);const p=h.p;
 await p.click('#btn-newbox');
 const g=()=>p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>[s.q,s.mask,s.mesh])));
 const W=(sel)=>p.evaluate(s=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().width):0;},sel);
 const Hh=(sel)=>p.evaluate(s=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().height):0;},sel);
 const vis=(sel)=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none';},sel);
 const g0=await g();
 assert(await vis('.lay-bar')&&await vis('.lay-split'),'barra de layout e divisória aparecem');
 assert(await p.locator('.lay-bar select option').count()===5,'5 workspaces no seletor');
 let w0=await W('.panel');assert(Math.abs(w0-360)<=2,'painel começa com 360 px ('+w0+')');
 const sw0=await W('#stage');
 // arrastar a divisória com o mouse
 const sp=await p.evaluate(()=>{const r=document.querySelector('.lay-split').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
 await p.mouse.move(sp.x,sp.y);await p.mouse.down();await p.mouse.move(sp.x-120,sp.y,{steps:8});await p.mouse.up();await p.waitForTimeout(300);
 let w1=await W('.panel');assert(Math.abs(w1-480)<=3,'arrastar 120 px para a esquerda alarga o painel ('+w0+' -> '+w1+')');
 assert((await W('#stage'))<sw0,'o Viewer encolhe junto');
 await p.mouse.move(sp.x-120,sp.y);const sp2=await p.evaluate(()=>{const r=document.querySelector('.lay-split').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
 await p.mouse.move(sp2.x,sp2.y);await p.mouse.down();await p.mouse.move(sp2.x-900,sp2.y,{steps:6});await p.mouse.up();await p.waitForTimeout(200);
 assert(await W('.panel')===640,'limite máximo 640 px respeitado');
 await p.mouse.move(sp2.x,sp2.y);
 const sp3=await p.evaluate(()=>{const r=document.querySelector('.lay-split').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
 await p.mouse.move(sp3.x,sp3.y);await p.mouse.down();await p.mouse.move(sp3.x+900,sp3.y,{steps:6});await p.mouse.up();await p.waitForTimeout(200);
 assert(await W('.panel')===280,'limite mínimo 280 px respeitado');
 await p.focus('.lay-split');await p.keyboard.press('ArrowLeft');await p.waitForTimeout(100);assert(await W('.panel')===300,'teclado: seta esquerda alarga 20 px');
 await p.dblclick('.lay-split');await p.waitForTimeout(150);assert(Math.abs(await W('.panel')-360)<=2,'duplo clique restaura 360 px');
 // persistência
 await p.mouse.move(sp.x,sp.y);const sp4=await p.evaluate(()=>{const r=document.querySelector('.lay-split').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
 await p.mouse.move(sp4.x,sp4.y);await p.mouse.down();await p.mouse.move(sp4.x-60,sp4.y,{steps:5});await p.mouse.up();await p.waitForTimeout(200);
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('lenzi-layout')).panelW);assert(Math.abs(saved-420)<=3,'largura gravada em localStorage ('+saved+')');
 await p.reload();await p.waitForTimeout(1000);assert(Math.abs(await W('.panel')-420)<=3,'largura persiste depois de recarregar');
 // ocultar painel
 await p.click('.lay-b[data-k="panel"]');await p.waitForTimeout(250);assert(!(await vis('.panel')),'◧ oculta o painel lateral');
 const sw1=await W('#stage');assert(sw1>sw0,'Viewer ocupa o espaço liberado');
 await p.click('.lay-b[data-k="panel"]');await p.waitForTimeout(250);assert(await vis('.panel'),'◧ mostra de novo');
 // timeline
 await p.click('[data-go="timeline"]');await p.click('#tl-insp button.primary');await p.waitForTimeout(500);
 assert(await vis('.tl-dock'),'timeline ligada aparece');
 await p.click('.lay-b[data-k="tl"]');await p.waitForTimeout(250);assert(!(await vis('.tl-dock')),'⬓ oculta a timeline');
 await p.click('.lay-b[data-k="tl"]');await p.waitForTimeout(250);assert(await vis('.tl-dock'),'⬓ mostra a timeline');
 // maximizar viewer / timeline
 await p.click('.lay-b[data-k="maxv"]');await p.waitForTimeout(250);assert(!(await vis('.panel'))&&!(await vis('.tl-dock'))&&await vis('#stage'),'⤢ maximiza o Viewer');
 await p.click('.lay-b[data-k="maxv"]');await p.waitForTimeout(250);assert(await vis('.panel')&&await vis('.tl-dock'),'⤢ de novo restaura');
 await p.click('.lay-b[data-k="maxt"]');await p.waitForTimeout(250);assert(await vis('.tl-dock')&&!(await vis('#stage'))&&!(await vis('.panel')),'⤡ maximiza a Timeline');
 assert(await Hh('.tl-dock')>600,'timeline maximizada ocupa a altura ('+await Hh('.tl-dock')+')');
 await p.click('.lay-b[data-k="maxt"]');await p.waitForTimeout(250);assert(await vis('#stage')&&await vis('.panel'),'⤡ de novo restaura');
 // altura da timeline: arrastar a borda dela e persistir
 const gr=await p.evaluate(()=>{const r=document.querySelector('.tl-grip').getBoundingClientRect();return {x:r.left+200,y:r.top+3};});
 const th0=await Hh('.tl-dock');await p.mouse.move(gr.x,gr.y);await p.mouse.down();await p.mouse.move(gr.x,gr.y-80,{steps:6});await p.mouse.up();await p.waitForTimeout(300);
 const th1=await Hh('.tl-dock');assert(th1>th0+40,'arrastar a borda da timeline muda a altura ('+th0+' -> '+th1+')');
 assert(Math.abs((await p.evaluate(()=>JSON.parse(localStorage.getItem('lenzi-layout')).tlH))-th1)<=3,'altura da timeline persistida');
 // workspaces
 await p.selectOption('.lay-bar select','mapping');await p.waitForTimeout(300);assert(!(await vis('.tl-dock'))&&await p.evaluate(()=>document.querySelector('.panel').getAttribute('data-active'))==='camadas','Mapping: sem timeline e aba Camadas');
 await p.selectOption('.lay-bar select','animation');await p.waitForTimeout(300);assert(await vis('.tl-dock')&&await p.evaluate(()=>document.querySelector('.panel').getAttribute('data-active'))==='timeline','Animation: timeline e aba Timeline');
 // salvar e recuperar layout
 await p.evaluate(()=>{window.prompt=()=>'Meu palco';});
 await p.click('.lay-b[data-k="panel"]');await p.waitForTimeout(150);await p.click('.lay-b[data-k="save"]');await p.waitForTimeout(200);
 assert(await p.evaluate(()=>[...document.querySelectorAll('.lay-bar select option')].some(o=>o.textContent==='★ Meu palco')),'layout salvo aparece no seletor');
 await p.selectOption('.lay-bar select','editing');await p.waitForTimeout(250);assert(await vis('.panel'),'Editing mostra o painel');
 await p.selectOption('.lay-bar select','c:Meu palco');await p.waitForTimeout(250);assert(!(await vis('.panel')),'layout salvo recuperado (painel oculto)');
 await p.click('.lay-b[data-k="reset"]');await p.waitForTimeout(250);assert(await vis('.panel')&&Math.abs(await W('.panel')-360)<=2,'↺ restaura o padrão');
 assert(await p.evaluate(()=>!!JSON.parse(localStorage.getItem('lenzi-layout')).custom['Meu palco']),'restaurar não apaga layouts salvos');
 // Show Mode
 await p.selectOption('.lay-bar select','show');await p.waitForTimeout(400);
 assert(!(await vis('.panel'))&&!(await vis('.tl-dock'))&&await vis('.lay-time')&&await p.locator('.lay-b:has-text("Sair do Show")').isVisible(),'Show: sem painéis, com transporte e saída');
 assert(await p.evaluate(()=>window.__showMode===true),'Show avisa o processo principal (atualizações não interrompem)');
 assert(!(await vis('#overlay')),'Show: guias de edição ocultas');
 await p.mouse.click(400,300);await p.mouse.click(500,350,{button:'right'});await p.keyboard.press('ArrowRight');await p.keyboard.press('Shift+ArrowDown');await p.keyboard.press('Delete');
 assert(await g()===g0,'Show: clique, botão direito, setas e Delete não alteram a calibração');
 await p.click('.lay-tr .lay-b:has-text("▶")');await p.waitForTimeout(700);assert(await p.evaluate(()=>window.TimelineUI._h.tl.clock.playing),'Show: ▶ toca');
 await p.click('.lay-tr .lay-b:has-text("❚❚")');await p.waitForTimeout(300);assert(!(await p.evaluate(()=>window.TimelineUI._h.tl.clock.playing)),'Show: ❚❚ pausa');
 await p.keyboard.press('Escape');await p.waitForTimeout(300);assert(await vis('.panel')&&await p.evaluate(()=>window.__showMode===false),'Esc sai do Show e volta a editar');
 // recarregar nunca abre direto em Show
 await p.selectOption('.lay-bar select','show');await p.waitForTimeout(250);await p.reload();await p.waitForTimeout(1000);
 assert(await vis('.panel'),'recarregar não abre direto em Show Mode');
 // dados corrompidos
 await p.evaluate(()=>localStorage.setItem('lenzi-layout','{"panelW":"lixo","max":7'));await p.reload();await p.waitForTimeout(900);assert(await vis('.panel')&&Math.abs(await W('.panel')-360)<=2,'localStorage corrompido cai no padrão');
 assert(await g()===g0,'q, máscara e malha intactos em todo o teste');
 await p.screenshot({path:'shots/layout.png'});
 console.log('errs',h.errs);assert(h.errs.length===0,'sem erros de JS');
 await h.close();})();
