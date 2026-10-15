// Ligação de faces: a mesma superfície não fica em duas faces; aviso quando a face não é visível do público
const {open}=require('./h.js');
let fails=0,n=0;function assert(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const h=await open(8935),p=h.p;
 for(let i=0;i<3;i++){await p.click('#btn-newbox');await p.waitForTimeout(250);}
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1200);
 const keys=await p.evaluate(()=>window.TimelineUI._h.state.surfaces.map(s=>s.key));
 assert(keys.length>=3,'superfícies criadas ('+keys.length+')');
 const faces=()=>p.evaluate(()=>window.TimelineUI._h.tl.seq.stage.cubes[0].faces);
 await p.selectOption('#il-bind-front',keys[1]);await p.waitForTimeout(200);
 await p.selectOption('#il-bind-left',keys[1]);await p.waitForTimeout(300);
 const f=await faces();
 assert(f.left===keys[1]&&f.front===null,'ligar a mesma superfície em outra face tira da primeira ('+JSON.stringify(f)+')');
 // face direita marcada com o público no centro: não dá para ver
 await p.check('#il-face-right');await p.waitForTimeout(300);
 let warns=await p.locator('.il-warn').allTextContents();
 assert(!warns.some(t=>/não dá para ver a face/.test(t)),'com perspectiva própria a face Direita não gera aviso de invisível');
 await p.evaluate(()=>{window.IllusionUI.state.il.camera.assist=false;window.IllusionUI.render();});await p.waitForTimeout(300);
 warns=await p.locator('.il-warn').allTextContents();
 assert(warns.some(t=>/não dá para ver a face/.test(t)&&/Direita/.test(t)),'com a perspectiva própria desligada avisa que a face Direita não é visível do público');
 await p.evaluate(()=>{window.IllusionUI.state.il.camera.assist=true;window.IllusionUI.render();});await p.waitForTimeout(200);
 // projeto antigo com a mesma superfície em duas faces: o painel avisa
 await p.evaluate((k)=>{const s=window.TimelineUI._h.tl.seq;s.stage.cubes[0].faces.front=k;s.stage.cubes[0].faces.left=k;window.IllusionUI&&window.IllusionUI.refresh&&window.IllusionUI.refresh();},keys[1]);
 await p.evaluate(()=>window.IllusionUI.render());await p.waitForTimeout(300);
 const w2=await p.locator('.il-warn').allTextContents();
 assert(w2.some(t=>/mesma superfície/.test(t)),'avisa quando a mesma superfície está em duas faces');
 assert(h.errs.length===0,'erros de página: nenhum ('+h.errs.join('|')+')');
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
