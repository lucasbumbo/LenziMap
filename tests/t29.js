// Projetor na quina: as duas faces da quina usam o mesmo ponto de vista e o ângulo é ajustável
const {open}=require('./h.js');
let fails=0,n=0;function assert(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const h=await open(8946,{easy:true,w:1300,h:1900}),p=h.p;
 for(let i=0;i<3;i++){await p.click('#btn-newbox');await p.waitForTimeout(250);}
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1500);
 assert(await p.locator('#il-vw-cr').count()===1&&await p.locator('#il-vw-cl').count()===1&&await p.locator('#il-vw-front').count()===1,'passo 2 tem De frente, Quina direita e Quina esquerda');
 await p.click('#il-vw-cr');await p.waitForTimeout(800);
 let st=await p.evaluate(()=>{const s=window.TimelineUI._h.tl.seq.stage,c=s.cubes[0],v=s.viewer.pos;return {faces:window.IllusionUI.state.il.target.faces,fr:c.faces.front,rt:c.faces.right,yaw:Math.atan2(v[0]-c.pos[0],v[2]-c.pos[2])*180/Math.PI};});
 assert(st.faces.join()==='front,right'&&st.fr&&st.rt&&st.fr!==st.rt,'Quina direita escolhe Frente e Direita e liga telas diferentes ('+JSON.stringify(st)+')');
 assert(Math.abs(st.yaw-45)<1,'público a 45 graus ('+st.yaw.toFixed(1)+')');
 // as duas faces: mesmo olho (perspectiva contínua) e texturas preenchidas
 const r=await p.evaluate(()=>{const C=window.IllusionCore,G=window.IllusionGL,s=window.TimelineUI._h.tl.seq.stage,il=window.IllusionUI.state.il;
  const out={eyes:[],lit:[]};['front','right'].forEach(f=>{const rf=C.resolveFace(s,il,null,null,0,{cube:'A',face:f});out.eyes.push(rf.eye.map(x=>+x.toFixed(2)).join());const c=G.faceTexture(s,il,null,'A',f,0,200);const d=c.getContext('2d').getImageData(0,0,200,200).data;let k=0;for(let i=3;i<d.length;i+=4)if(d[i]>20)k++;out.lit.push(k/400);});return out;});
 assert(r.eyes[0]===r.eyes[1],'Frente e Direita usam o mesmo ponto de vista ('+r.eyes[0]+')');
 assert(r.lit[0]>15&&r.lit[1]>15,'as duas faces da quina ficam preenchidas ('+r.lit.map(Math.round)+'%)');
 // controle de ângulo
 const sl=p.locator('input[type=number][aria-label*="Ângulo do público"]');
 assert(await sl.count()===1,'tem o controle de ângulo');
 await sl.fill('30');await sl.press('Tab');await p.waitForTimeout(400);
 const y2=await p.evaluate(()=>{const s=window.TimelineUI._h.tl.seq.stage,c=s.cubes[0],v=s.viewer.pos;return Math.atan2(v[0]-c.pos[0],v[2]-c.pos[2])*180/Math.PI;});
 assert(Math.abs(y2-30)<1,'ajustar o ângulo move o público ('+y2.toFixed(1)+')');
 const d2=await p.evaluate(()=>{const s=window.TimelineUI._h.tl.seq.stage,c=s.cubes[0],v=s.viewer.pos;return Math.hypot(v[0]-c.pos[0],v[2]-c.pos[2]);});
 assert(d2>=60,'distância mantida ('+d2.toFixed(0)+')');
 await p.click('#il-vw-cl');await p.waitForTimeout(700);
 const f3=await p.evaluate(()=>window.IllusionUI.state.il.target.faces.join());
 assert(f3==='left,front','Quina esquerda escolhe Esquerda e Frente ('+f3+')');
 await p.click('#il-vw-front');await p.waitForTimeout(500);
 const y4=await p.evaluate(()=>{const s=window.TimelineUI._h.tl.seq.stage,c=s.cubes[0],v=s.viewer.pos;return Math.atan2(v[0]-c.pos[0],v[2]-c.pos[2])*180/Math.PI;});
 assert(Math.abs(y4)<1,'De frente volta a 0 grau ('+y4.toFixed(1)+')');
 // aplicar na quina cria um clipe por face
 await p.click('#il-vw-cr');await p.waitForTimeout(700);
 await p.click('#il-apply');await p.waitForTimeout(900);
 const clips=await p.evaluate(()=>window.TimelineUI._h.tl.seq.tracks.reduce((a,t)=>a+t.clips.length,0));
 assert(clips===2,'aplicar cria um clipe para cada face da quina ('+clips+')');
 assert(h.errs.length===0,'erros de página: nenhum ('+h.errs.join('|')+')');
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
