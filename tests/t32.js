// Modo avançado, Sala de paredes: o quadro de edição (vista de cima/lado) e a prévia não podem ficar pretos.
const {open}=require('./h.js');
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
const lit=(id)=>{const c=document.getElementById(id);if(!c)return -1;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let k=0;for(let i=0;i<d.length;i+=4)if(d[i]+d[i+1]+d[i+2]>60)k++;return k;};
(async()=>{
 const h=await open(8973,{easy:false,w:1300,h:2400}),p=h.p;
 await p.click('#btn-newbox');await p.waitForTimeout(300);
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1500);
 await p.click('.il-card[data-preset="room-builder"]');await p.waitForTimeout(800);
 ok(await p.evaluate(lit,'il-room-cv')>500,'vista de cima da sala tem desenho ('+await p.evaluate(lit,'il-room-cv')+' pontos)');
 await p.click('#il-rv-side');await p.waitForTimeout(500);
 ok(await p.evaluate(lit,'il-room-cv')>500,'vista de lado da sala tem desenho ('+await p.evaluate(lit,'il-room-cv')+' pontos)');
 ok(await p.evaluate(lit,'il-canvas')>2000,'prévia 3D não está preta ('+await p.evaluate(lit,'il-canvas')+' pontos)');
 ok(h.errs.length===0,'sem erros de página '+h.errs.join('|'));
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
