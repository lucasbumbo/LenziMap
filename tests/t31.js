// Fluxo de criança: abre a aba 3D sem criar nada, escolhe sala e coloca em duas faces. O app cria as telas sozinho.
const {open}=require('./h.js');
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const h=await open(8967,{easy:true,w:1300,h:1500}),p=h.p;
 const clips=()=>p.evaluate(()=>window.TimelineUI._h.tl.seq.tracks.reduce((n,t)=>n+t.clips.length,0));
 const msg=()=>p.evaluate(()=>document.getElementById('il-msg').textContent);
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1500);
 ok(await p.locator('#il-sala-corredor').count()===1,'tem os botões das salas');
 await p.click('#il-sala-corredor');await p.waitForTimeout(300);
 await p.click('#il-apply');await p.waitForTimeout(900);
 ok(await clips()===1&&/Pronto/.test(await msg()),'Frente: um clique em Colocar na face cria o clipe ('+await msg()+')');
 ok(await p.locator('#il-apply').count()===0,'depois de colocar some o botão de aplicar de novo (evita clipe duplicado)');
 await p.click('#il-sala-quarto');await p.waitForTimeout(400);
 ok(await clips()===1,'trocar a sala depois de colocada não cria outro clipe');
 await p.click('#il-pick-right');await p.waitForTimeout(900);
 ok(/superfície nova/.test(await msg()),'Direita sem tela livre: o app cria a superfície sozinho ('+await msg()+')');
 await p.click('#il-sala-caixa');await p.click('#il-apply');await p.waitForTimeout(900);
 ok(await clips()===2,'Direita colocada: 2 clipes no total');
 await p.click('#il-pick-back');await p.waitForTimeout(900);await p.click('#il-apply');await p.waitForTimeout(900);
 ok(await clips()===3,'Trás também funciona sem passos extras: 3 clipes');
 ok(h.errs.length===0,'sem erros de página '+h.errs.join('|'));
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
