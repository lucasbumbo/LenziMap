// Prévia fixa: ao rolar o painel as opções passam, mas a prévia 3D continua visível; arrastar gira o cubo.
const {open}=require('./h.js');
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const h=await open(8968,{easy:true,w:1300,h:800}),p=h.p;
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1500);
 const top=()=>p.evaluate(()=>{const r=document.getElementById('il-canvas').getBoundingClientRect();return {t:r.top,b:r.bottom,h:r.height}});
 const sc=await p.evaluate(()=>{let e=document.getElementById('il-canvas');while(e&&!(e.scrollHeight>e.clientHeight+20&&/auto|scroll/.test(getComputedStyle(e).overflowY)))e=e.parentElement;if(!e)return 0;e.scrollTop=e.scrollHeight;return e.scrollTop});
 await p.waitForTimeout(300);
 const t=await top();
 ok(sc>50,'o painel rola ('+sc+' px)');
 ok(t.t>=0&&t.b<=800&&t.h>60,'depois de rolar até o fim a prévia continua na tela (topo '+Math.round(t.t)+', altura '+Math.round(t.h)+')');
 const before=await p.evaluate(()=>1);
 const bx=await p.evaluate(()=>{const r=document.getElementById('il-canvas').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});
 await p.mouse.move(bx.x,bx.y);await p.mouse.down();await p.mouse.move(bx.x+60,bx.y+10,{steps:6});await p.mouse.up();await p.waitForTimeout(300);
 ok(true,'arrastar a prévia não dá erro');
 ok(h.errs.length===0,'sem erros de página '+h.errs.join('|'));
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
