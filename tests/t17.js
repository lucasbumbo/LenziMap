// AI Director 3D Illusions no Chromium real: planejador local, IA simulada (JSON válido e malicioso), aplicar, desfazer, abrir no painel 3D.
// A "IA" é um stub no canal seguro: não usa IA de verdade.
const {open}=require('./h.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{
 const h=await open(8883);const p=h.p;
 await p.click('#btn-newbox');await p.waitForTimeout(300);
 const calib=()=>p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>[s.key,s.q,s.mask,s.mesh])));
 const cal0=await calib();
 await p.click('[data-go="ia"]');await p.waitForTimeout(300);
 await p.locator('#ai-ill-prompt').count()||await p.evaluate(()=>{document.querySelectorAll('#ai-panel details').forEach(d=>d.open=true);});
 await p.evaluate(()=>{document.querySelectorAll('#ai-panel details').forEach(d=>{if(/3D Illusions/.test(d.textContent.slice(0,40)))d.open=true;});});
 assert(await p.locator('#ai-ill-gen').count()===1,'caixa 3D Illusions existe no AI Director');
 assert(await p.locator('[id^="ai-ill-q-"]').count()===8,'oito atalhos de preset');
 // local
 await p.fill('#ai-ill-prompt','Sala infinita azul e rosa no cubo A, frente, 6 segundos');
 await p.evaluate(()=>document.getElementById('ai-ill-gen').click());await p.waitForTimeout(300);
 assert(await p.locator('#ai-ill-plan').count()===1,'plano local aparece como cartão');
 const txt=await p.textContent('#ai-ill-plan');
 assert(/Infinite Room/i.test(txt)&&/6 s/.test(txt)&&/planejador local/.test(txt),'cartão mostra preset, duração e origem local');
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.tracks.length)===0,'gerar o plano não toca na timeline');
 // aplicar: face sem superfície -> liga automaticamente a superfície livre
 await p.evaluate(()=>document.getElementById('ai-ill-apply').click());await p.waitForTimeout(500);
 const ap=await p.evaluate(()=>{const s=window.TimelineUI._h.tl.seq;return {tracks:s.tracks.length,kind:s.assets[0]&&s.assets[0].fx.kind,front:s.stage.cubes[0].faces.front,dur:s.tracks[0]&&s.tracks[0].clips[0].duration,kf:s.tracks[0]&&Object.keys(s.tracks[0].clips[0].keyframes)};});
 assert(ap.tracks===1&&ap.kind==='illusion'&&!!ap.front&&Math.abs(ap.dur-6)<1e-6&&ap.kf.includes('ill.travel'),'aplicar cria clipe de ilusão com keyframes e liga a face livre');
 assert(/ligadas automaticamente/.test(await p.textContent('#ai-ill-notice')),'aviso diz que a face foi ligada sozinha');
 assert(await calib()===cal0,'calibração (q, máscara, malha) intacta');
 await p.click('[data-go="timeline"]');await p.waitForTimeout(300);
 await p.locator('.tl-clip').first().click();await p.waitForTimeout(300);
 const insp=await p.evaluate(()=>{const t=[...document.querySelectorAll('#tl-insp .tl-prop label')].map(l=>l.textContent);return {n:t.length,has:t.filter(x=>/Profundidade virtual|Deslocamento/.test(x)).length};});
 assert(insp.has===2,'inspetor mostra seção Ilusão 3D com os parâmetros ('+insp.has+')');
 await p.click('[data-go="ia"]');await p.waitForTimeout(200);
 await p.evaluate(()=>{document.querySelectorAll('#ai-panel details').forEach(d=>{if(/3D Illusions/.test(d.textContent.slice(0,40)))d.open=true;});});
 await p.evaluate(()=>document.getElementById('ai-ill-undo').click());await p.waitForTimeout(300);
 assert(await p.evaluate(()=>{const s=window.TimelineUI._h.tl.seq;return s.tracks.length===0&&s.assets.length===0;}),'desfazer remove clipe e asset criados pela IA');
 // IA simulada
 let mode='good';
 await p.exposeFunction('__ill',()=>mode);
 await p.evaluate(()=>{
  const good={preset:'opening-cube',name:'Cubo IA',cube:'A',faces:['front'],duration:5,params:{open:5},style:{color1:'#ff8a2b'},keys:[{param:'open',t:0,v:0},{param:'open',t:3,v:1}]};
  const evil={preset:'infinite-room',code:'alert(1)',glsl:'void main(){}',name:'x',style:{color1:'javascript:1'},keys:[{param:'eval',t:0,v:1}]};
  window.api.ai={status:()=>Promise.resolve({secure:true,keys:{openai:true,anthropic:true}}),setKey:()=>Promise.resolve({ok:true}),clearKey:()=>Promise.resolve(),cancel(){},request:(id,o)=>window.__ill().then(m=>({ok:true,text:m==='good'?JSON.stringify(good):m==='evil'?JSON.stringify(evil):'sem json',usage:null}))};
 });
 await p.evaluate(()=>{AiDirector.setSettings({external:true,consent:{openai:true,anthropic:true}});return AiDirector.refreshKeys();});
 await p.waitForTimeout(200);
 await p.evaluate(()=>{document.querySelectorAll('#ai-panel details').forEach(d=>{if(/3D Illusions/.test(d.textContent.slice(0,40)))d.open=true;});});
 await p.fill('#ai-ill-prompt','cubo abrindo laranja');
 await p.evaluate(()=>document.getElementById('ai-ill-gen').click());await p.waitForTimeout(500);
 const t2=await p.textContent('#ai-ill-plan');
 assert(/Cubo IA/.test(t2)&&/origem: IA/.test(t2),'IA simulada: plano válido aparece com origem IA');
 assert(await p.evaluate(()=>AiDirector.state.ill.plan.il.params.open===1),'IA: parâmetro fora da faixa foi limitado');
 mode='evil';
 await p.evaluate(()=>document.getElementById('ai-ill-gen').click());await p.waitForTimeout(500);
 const ws=await p.evaluate(()=>AiDirector.state.ill.warnings.join('|'));
 assert(/Campo ignorado: code/.test(ws)&&/Campo ignorado: glsl/.test(ws),'IA maliciosa: code e glsl descartados com aviso');
 assert(await p.evaluate(()=>/^#[0-9a-f]{6}$/i.test(AiDirector.state.ill.plan.il.style.color1)),'IA maliciosa: cor inválida trocada');
 mode='bad';
 await p.evaluate(()=>document.getElementById('ai-ill-gen').click());await p.waitForTimeout(500);
 assert(await p.locator('#ai-ill-error').count()===1&&await p.evaluate(()=>AiDirector.state.ill.plan===null),'IA sem JSON: erro mostrado e nenhum plano');
 // abrir no painel 3D
 mode='good';
 await p.evaluate(()=>document.getElementById('ai-ill-gen').click());await p.waitForTimeout(500);
 await p.evaluate(()=>document.getElementById('ai-ill-open').click());await p.waitForTimeout(300);
 assert(await p.evaluate(()=>window.IllusionUI.state.il.preset==='opening-cube'&&window.IllusionUI.state.assetId===null),'Abrir no painel 3D carrega como rascunho');
 assert(h.errs.length===0,'erros de página: '+(h.errs.join('|')||'nenhum'));
 await h.close();process.exit(process.exitCode||0);
})().catch(e=>{console.log('FAIL excecao',e.message);process.exit(1);});
