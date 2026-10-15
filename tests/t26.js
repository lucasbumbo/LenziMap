// Modo fácil das paredes: escolher a face, empurrar o fundo, ligar paredes, aplicar. Sem opções avançadas.
const {open}=require('./h.js');
let fails=0,n=0;function assert(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const h=await open(8937,{easy:true}),p=h.p;
 for(let i=0;i<3;i++){await p.click('#btn-newbox');await p.waitForTimeout(250);}
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1200);
 assert(await p.evaluate(()=>window.IllusionUI.state.il.preset)==='room-builder','abre direto na Sala de paredes');
 assert(await p.locator('#il-adv').count()===1&&!(await p.locator('#il-adv').isChecked()),'opções avançadas começam desligadas');
 assert(await p.locator('.il-card').count()===0&&await p.locator('#il-quality').count()===0,'cartões avançados (tipos, qualidade) ficam escondidos');
 // 1) face
 await p.click('#il-pick-top');await p.waitForTimeout(400);
 const f=await p.evaluate(()=>({t:window.IllusionUI.state.il.target.faces,top:window.TimelineUI._h.tl.seq.stage.cubes[0].faces.top}));
 assert(f.t.length===1&&f.t[0]==='top'&&!!f.top,'escolher Topo liga uma tela livre automaticamente ('+JSON.stringify(f)+')');
 await p.click('#il-pick-left');await p.waitForTimeout(400);
 const f2=await p.evaluate(()=>{const c=window.TimelineUI._h.tl.seq.stage.cubes[0].faces;return c;});
 assert(f2.left&&f2.left!==f2.top,'escolher Esquerda liga outra tela (não repete)');
 // 2) fundo
 await p.evaluate(()=>{window.IllusionUI.state.il.params.depth=60;window.IllusionUI.render();});await p.waitForTimeout(300);
 assert(await p.locator('text=Distância do fundo').count()>=1,'tem o controle Distância do fundo');
 // 3) paredes
 assert(await p.locator('#il-wall-back').count()===1&&await p.locator('#il-wall-floor').count()===1,'paredes (fundo, chão...) na mesma tela');
 await p.uncheck('#il-wall-ceiling');await p.waitForTimeout(200);
 assert(await p.evaluate(()=>window.IllusionUI.state.il.room.walls.ceiling.on)===false,'desligar o teto vale');
 // aplicar
 await p.click('#il-apply');await p.waitForTimeout(800);
 const ap=await p.evaluate(()=>{const s=window.TimelineUI._h.tl.seq;return {clips:s.tracks.reduce((a,t)=>a+t.clips.length,0),pre:s.assets[0]&&s.assets[0].fx.illusion.preset,depth:s.assets[0]&&s.assets[0].fx.illusion.params.depth};});
 assert(ap.clips===1&&ap.pre==='room-builder'&&ap.depth===60,'aplicar cria o clipe da sala com o fundo em 60 ('+JSON.stringify(ap)+')');
 // avançado liga e mostra tudo
 await p.check('#il-adv');await p.waitForTimeout(500);
 assert(await p.locator('#il-quality').count()===1,'ligar avançado mostra o resto');
 assert(h.errs.length===0,'erros de página: nenhum ('+h.errs.join('|')+')');
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
