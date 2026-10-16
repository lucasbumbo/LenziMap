// Onde o público fica: De frente / Na quina (diagonal) ajusta giro do cubo, olho e sala na quina.
const {open}=require('./h.js');
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const h=await open(8969,{easy:true,w:1300,h:1500}),p=h.p;
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1500);
 const st=()=>p.evaluate(()=>{const s=TimelineUI._h.tl.seq.stage,c=s.cubes[0];return {rot:c.rotY,eye:s.viewer.pos.slice(),join:IllusionUI.state.il.room.join}});
 const clips=()=>p.evaluate(()=>window.TimelineUI._h.tl.seq.tracks.reduce((n,t)=>n+t.clips.length,0));
 ok(await p.locator('#il-pub-frente').count()===1&&await p.locator('#il-pub-quina').count()===1,'tem os dois botões Onde o público fica');
 await p.click('#il-pub-quina');await p.waitForTimeout(700);
 let s=await st();
 ok(s.rot===-45,'quina: cubo girado -45 ('+s.rot+')');
 ok(s.eye[1]===10&&s.eye[0]===0,'quina: olho na altura do cubo +2 = 10 ('+s.eye+')');
 ok(s.join==='top+front+right','quina: sala nas 3 faces (topo, frente, direita) ('+s.join+')');
 await p.click('#il-sala-quarto');await p.waitForTimeout(300);await p.click('#il-apply');await p.waitForTimeout(900);
 ok(await clips()===3,'colocar na quina cria um clipe para cada face ('+await clips()+')');
 await p.click('#il-pub-frente');await p.waitForTimeout(700);
 s=await st();
 ok(s.rot===0&&!s.join,'de frente: cubo reto e sala de uma face só ('+s.rot+','+s.join+')');
 ok(h.errs.length===0,'sem erros de página '+h.errs.join('|'));
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
