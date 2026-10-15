// Finalização 3.2: cartão de compatibilidade (projeto de versão mais nova) e assistente do espectador.
const {open}=require('./h.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{
 const h=await open(8884);const p=h.p;
 await p.click('#btn-newbox');await p.waitForTimeout(300);
 const calib=()=>p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>[s.key,s.q,s.mask,s.mesh])));
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(400);
 await p.evaluate(()=>document.getElementById('il-autobind').click());await p.waitForTimeout(200);
 await p.evaluate(()=>document.getElementById('il-apply').click());await p.waitForTimeout(500);
 await p.evaluate(()=>document.getElementById('btn-save').click());await p.waitForTimeout(400);
 const saved=await p.evaluate(()=>window.__saved);
 const open_=async j=>{await p.evaluate(x=>{window.__openJson=x;},j);await p.evaluate(()=>document.getElementById('btn-open').click());await p.waitForTimeout(800);};
 // projeto normal: sem cartão
 await open_(saved);
 assert(await p.locator('#compat-card').count()===0,'projeto da versão atual abre sem cartão de compatibilidade');
 // projeto de versão mais nova
 const d=JSON.parse(saved);d.sequence.schema=99;d.sequence.stage.v=7;d.sequence.assets.forEach(a=>{if(a.fx&&a.fx.illusion)a.fx.illusion.v=5;});
 await open_(JSON.stringify(d));
 assert(await p.locator('#compat-card').count()===1,'projeto mais novo mostra o cartão de compatibilidade');
 const tx=await p.textContent('#compat-card');
 assert(/schema 99/.test(tx)&&/palco/.test(tx)&&/ilusão/.test(tx),'cartão lista schema, palco e ilusão ('+tx.length+' chars)');
 assert(await p.locator('#compat-card').isVisible(),'cartão está visível');
 const il=await p.evaluate(()=>window.TimelineUI._h.tl.seq.assets[0].fx.illusion);
 assert(il&&il.preset==='infinite-room','a ilusão ainda abre e funciona');
 await p.click('#compat-ok');assert(await p.locator('#compat-card').count()===0,'"Entendi" fecha o cartão');
 // novo abrir normal limpa o cartão
 await open_(JSON.stringify(d));await open_(saved);
 assert(await p.locator('#compat-card').count()===0,'abrir projeto atual depois remove o cartão antigo');
 // assistente do espectador
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(300);
 await p.evaluate(()=>{document.querySelectorAll('#il-panel details').forEach(d=>{d.open=true;});});
 const cal0=await calib();
 assert(await p.locator('#il-wizard').count()===1,'assistente do espectador existe na geometria');
 await p.evaluate(()=>{const s=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));};s('il-wz-dist',100);});await p.waitForTimeout(200);
 await p.evaluate(()=>{document.querySelectorAll('#il-panel details').forEach(d=>{d.open=true;});});
 await p.evaluate(()=>{const s=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));};s('il-wz-height',58);});await p.waitForTimeout(200);
 await p.evaluate(()=>{document.querySelectorAll('#il-panel details').forEach(d=>{d.open=true;});});
 await p.evaluate(()=>{const s=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));};s('il-wz-lateral',10);});await p.waitForTimeout(200);
 await p.evaluate(()=>{document.querySelectorAll('#il-panel details').forEach(d=>{d.open=true;});});
 await p.evaluate(()=>document.getElementById('il-wz-apply').click());await p.waitForTimeout(300);
 const v=await p.evaluate(()=>window.TimelineUI._h.tl.seq.stage.viewer.pos);
 assert(Math.abs(v[0]-10)<1e-6&&Math.abs(v[1]-58)<1e-6&&Math.abs(v[2]-108)<1e-6,'aplicar move o olho para x10 y58 z108 ('+v+')');
 assert(await calib()===cal0,'assistente não altera a calibração (q, máscara, malha)');
 await p.evaluate(()=>{document.querySelectorAll('#il-panel details').forEach(d=>{d.open=true;});});
 const gx=await p.inputValue('#il-vx');assert(parseFloat(gx)===10,'campos "Olho X" refletem a medida');
 await p.evaluate(()=>{window.TimelineUI._h.checkpoint;});
 assert(h.errs.length===0,'erros de página: '+(h.errs.join('|')||'nenhum'));
 await h.close();process.exit(process.exitCode||0);
})().catch(e=>{console.log('FAIL excecao',e.message);process.exit(1);});
