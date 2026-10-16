// Caça-bugs do painel simples: cenários de uso real, um depois do outro.
const {open}=require('./h.js');
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const h=await open(8975,{easy:true,w:1300,h:1500}),p=h.p;
 const seq=()=>p.evaluate(()=>{const s=window.TimelineUI._h.tl.seq;return {clips:s.tracks.reduce((n,t)=>n+t.clips.length,0),assets:s.assets.filter(a=>a.fx&&a.fx.illusion).length,names:s.tracks.map(t=>t.clips.map(c=>c.name).join(',')).join('|')};});
 const msg=()=>p.evaluate(()=>document.getElementById('il-msg')?document.getElementById('il-msg').textContent:'(sem msg)');
 const wait=(t)=>p.waitForTimeout(t||500);
 await p.click('[data-go="ilusao"]');await wait(1500);
 // A: Topo
 await p.click('#il-pick-top');await wait(900);await p.click('#il-sala-caixa');await p.click('#il-apply');await wait(900);
 let s=await seq();ok(s.clips===1,'A: Topo coloca 1 clipe ('+s.names+')');
 // B: outro cubo
 await p.evaluate(()=>{const sel=document.getElementById('il-fino');if(sel)sel.open=true;});await wait(300);
 const cubes=await p.evaluate(()=>[...document.querySelectorAll('#il-cube option')].map(o=>o.value));
 ok(cubes.length>=2,'B: tem mais de um cubo ('+cubes+')');
 await p.selectOption('#il-cube',cubes[1]);await wait(900);
 const hasChips=await p.locator('#il-pick-front').count();ok(hasChips===1,'B: depois de trocar de cubo os botões de face continuam');
 await p.click('#il-sala-quarto');await p.click('#il-apply');await wait(900);
 s=await seq();ok(s.clips===2,'B: cubo B também coloca clipe ('+s.names+' | '+await msg()+')');
 // volta cubo A
 await p.selectOption('#il-cube',cubes[0]);await wait(700);
 // C: avançado e volta
 await p.evaluate(()=>{document.getElementById('il-adv').click();});await wait(700);
 await p.evaluate(()=>{document.getElementById('il-adv').click();});await wait(900);
 ok(await p.locator('#il-sala-corredor').count()===1,'C: ligar e desligar avançado volta ao painel simples');
 s=await seq();ok(s.clips===2,'C: nada foi duplicado ('+s.clips+')');
 // D: Desfazer do app tira o clipe e o painel acompanha
 await p.click('#il-pick-right');await wait(900);await p.click('#il-sala-corredor');await p.click('#il-apply');await wait(900);
 s=await seq();const antes=s.clips;
 await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Desfazer');if(b)b.click();});await wait(1200);
 s=await seq();ok(s.clips===antes-1,'D: Desfazer do app tira o clipe ('+antes+' para '+s.clips+')');
 ok(await p.locator('#il-apply').count()===1,'D: o botão Colocar na face volta depois do desfazer');
 const m=await msg();ok(!/undefined|NaN/.test(m),'D: mensagem sem lixo ('+m+')');
 // E: Tirar da face
 await p.click('#il-pick-front');await wait(900);
 const tinha=await p.locator('#il-remove').count();
 if(tinha){const c0=(await seq()).clips;await p.click('#il-remove');await wait(700);s=await seq();ok(s.clips===c0-1&&await p.locator('#il-apply').count()===1,'E: Tirar da face remove só o clipe dela');}
 else{await p.click('#il-sala-quarto');await p.click('#il-apply');await wait(900);const c0=(await seq()).clips;await p.click('#il-remove');await wait(700);s=await seq();ok(s.clips===c0-1,'E: Tirar da face remove o clipe');}
 // F: reabrir: perde o estado da sessão mas o clipe continua; ao clicar a face não pode duplicar
 await p.click('#il-pick-top');await wait(900);
 await p.evaluate(()=>{window.IllusionUI.state.faceIl={};});
 await p.click('#il-pick-back');await wait(700);await p.click('#il-pick-top');await wait(900);
 const temBotao=await p.locator('#il-apply').count();
 const c1=(await seq()).clips;
 if(temBotao){await p.click('#il-apply');await wait(900);}
 s=await seq();ok(s.clips===c1||!temBotao,'F: depois de perder o estado da sessão, clicar Colocar na face de novo numa face que já tem sala não duplica ('+c1+' para '+s.clips+')');
 // G: painel perde o estado (como ao reabrir o projeto): a face que já tem sala reconhece o clipe e não duplica
 await p.click('#il-pick-front');await wait(700);
 if(!(await p.locator('#il-remove').count())){await p.click('#il-sala-quarto');await p.click('#il-apply');await wait(900);}
 const antesG=(await seq()).clips;
 await p.evaluate(()=>{const U=window.IllusionUI;U.state.faceIl={};U._newIllusion('room-builder');U.state.assetId=null;U.render();});await wait(600);
 ok(await p.locator('#il-remove').count()===1&&await p.locator('#il-apply').count()===0,'G: depois de perder o estado, a face com sala mostra Tirar da face (sem botão de aplicar)');
 await p.click('#il-pick-left');await wait(800);await p.click('#il-pick-front');await wait(800);
 ok((await seq()).clips===antesG&&await p.locator('#il-apply').count()===0,'G: trocar de face e voltar continua sem duplicar ('+antesG+' clipes)');
 ok(h.errs.length===0,'sem erros de página '+h.errs.join('|'));
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
