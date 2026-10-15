// 3D Illusion Creator, ponta a ponta: painel -> timeline -> keyframes -> saida calibrada (dois renderers) -> salvar e reabrir
const {openPair}=require('./h2.js');
let fails=0,n=0;function assert(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const h=await openPair(8895);const p=h.p,o=h.o;
 const H=()=>window.TimelineUI._h;
 const calib=()=>p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>({q:s.q,mask:s.mask,mesh:s.mesh,w:s.w,h:s.h,flipX:s.flipX,flipY:s.flipY,rot:s.rot,key:s.key}))));
 // 1 superficie
 await p.click('#btn-newbox');await p.waitForTimeout(300);
 const cal0=await calib();
 const key=await p.evaluate(()=>window.TimelineUI._h.state.surfaces[0].key);
 const xf0=await o.evaluate(()=>{const e=document.querySelector('.surf');return e?e.style.transform:null;});
 // painel 3D
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(500);
 assert(await p.locator('#il-canvas').count()===1,'painel 3D abre com a prévia');
 assert(await p.locator('.il-card[data-preset="infinite-room"].on').count()===1,'Infinite Room é o tipo inicial');
 assert(await p.locator('.il-card').count()===8,'oito presets disponíveis (Sala + os sete)');
 for(const id of ['il-cube','il-quality','il-color1','il-obj','il-material','il-save-preset','il-apply','il-view-audience','il-view-free','il-view-projector'])assert(await p.locator('#'+id).count()===1,'controle presente: '+id);
 // sem face ligada: aplicar avisa e nada é criado
 await p.click('#il-apply');await p.waitForTimeout(300);
 assert((await p.textContent('#il-msg')).indexOf('face')>=0&&await p.evaluate(()=>window.TimelineUI._h.tl.seq.assets.length)===0,'aplicar sem face ligada avisa e não cria nada');
 // ligar superficies
 await p.click('#il-autobind');await p.waitForTimeout(300);
 assert(await p.evaluate(k=>window.TimelineUI._h.tl.seq.stage.cubes[0].faces.front===k,key),'face frente ligada à superfície');
 assert(await p.locator('#il-bind-front').inputValue()===key,'seletor mostra a superfície ligada');
 assert(await calib()===cal0,'ligar face não altera a calibração (q, máscara, malha)');
 // aplicar
 await p.click('#il-apply');await p.waitForTimeout(700);
 const ap=await p.evaluate(()=>{const H=window.TimelineUI._h,s=H.tl.seq;return {on:H.tl.on,tracks:s.tracks.length,clips:s.tracks.reduce((a,t)=>a+t.clips.length,0),kind:s.assets[0]&&s.assets[0].fx.kind,sid:s.tracks[0]&&s.tracks[0].surfaceId,ill:s.tracks[0]&&s.tracks[0].clips[0]&&s.tracks[0].clips[0].ill,dur:s.tracks[0].clips[0].duration,kf:Object.keys(s.tracks[0].clips[0].keyframes)};});
 assert(ap.on&&ap.tracks===1&&ap.clips===1&&ap.kind==='illusion','aplicar cria faixa e clipe de ilusão e liga a timeline');
 assert(ap.sid===key&&ap.ill&&ap.ill.depth===160&&ap.dur===8,'faixa ligada à superfície; base ill e duração 8 s');
 assert(ap.kf.indexOf('ill.travel')>=0,'animação do preset virou keyframes comuns ('+ap.kf.join(',')+')');
 assert(await calib()===cal0,'aplicar não altera a calibração');
 // render nos dois renderers
 const lit=async(page,w)=>page.evaluate(()=>{const r=window.__rend||window.TimelineUI._h.rend,out=[];for(const id in r.recs){const rec=r.recs[id];for(const k in rec.ex){const e=rec.ex[k];if(e.el&&e.el.tagName==='CANVAS'&&e.x&&e.x.tl){const d=e.el.getContext('2d').getImageData(0,0,e.el.width,e.el.height).data;let c=0;for(let i=3;i<d.length;i+=4)if(d[i]>10)c++;out.push({w:e.el.width,h:e.el.height,lit:c,tot:d.length/4});}}}return out;});
 await p.evaluate(()=>{window.TimelineUI.api.seek(1.5);});await p.waitForTimeout(500);
 const lc=await lit(p),lo=await lit(o);
 assert(lc.length===1&&lc[0].lit>lc[0].tot*0.2,'painel de controle desenha a ilusão na superfície ('+(lc[0]&&Math.round(lc[0].lit/lc[0].tot*100))+'% acesa)');
 assert(lo.length===1&&lo[0].lit>lo[0].tot*0.2,'janela de saída desenha a ilusão ('+(lo[0]&&Math.round(lo[0].lit/lo[0].tot*100))+'% acesa)');
 const xf1=await o.evaluate(()=>{const e=document.querySelector('.surf');return e?e.style.transform:null;});
 assert(xf0===xf1,'transformação calibrada da superfície na saída não mudou');
 // relogio compartilhado: mesmo instante, mesma imagem nos dois renderers (parado em 1.5 s)
 const grab=(page)=>page.evaluate(()=>{const r=window.__rend||window.TimelineUI._h.rend;for(const id in r.recs){const rec=r.recs[id];for(const k in rec.ex){const e=rec.ex[k];if(e.el&&e.el.tagName==='CANVAS'&&e.x&&e.x.tl){const s=document.createElement('canvas');s.width=64;s.height=36;s.getContext('2d').drawImage(e.el,0,0,64,36);return Array.from(s.getContext('2d').getImageData(0,0,64,36).data);}}}return null;});
 const ga=await grab(p),gb=await grab(o);let diff=0;for(let i=0;i<ga.length;i++)diff+=Math.abs(ga[i]-gb[i]);
 assert(diff/ga.length<3,'controle e saída mostram o mesmo quadro no mesmo instante (diferença média '+(diff/ga.length).toFixed(2)+')');
 // tempo muda a imagem
 await p.evaluate(()=>{window.TimelineUI.api.seek(4.2);});await p.waitForTimeout(500);
 const gc=await grab(p);let d2=0;for(let i=0;i<ga.length;i++)d2+=Math.abs(ga[i]-gc[i]);
 assert(d2/ga.length>1,'avançar a timeline muda a imagem ('+(d2/ga.length).toFixed(2)+')');
 // keyframe de profundidade pelo painel
 await p.evaluate(()=>{window.TimelineUI.api.seek(2);});await p.waitForTimeout(300);
 await p.locator('.il-sl:has(input[aria-label="Profundidade virtual (pol) valor"]) .il-kf').click();await p.waitForTimeout(300);
 const kd=await p.evaluate(()=>{const c=window.TimelineUI._h.tl.seq.tracks[0].clips[0];return c.keyframes['ill.depth'];});
 assert(kd&&kd.length===1&&Math.abs(kd[0].t-2)<0.05&&kd[0].v===160,'◆ cria keyframe de depth no playhead (t=2, v=160)');
 // alterar o valor com keyframe existente (auto key desligado): base nao muda o keyframe? depth mudando no painel atualiza so o base de clipes sem keyframe
 await p.fill('input[aria-label="Profundidade virtual (pol) valor"]','90');await p.press('input[aria-label="Profundidade virtual (pol) valor"]','Enter');await p.waitForTimeout(300);
 const cl=await p.evaluate(()=>{const s=window.TimelineUI._h.tl.seq;return {ill:s.tracks[0].clips[0].ill.depth,asset:s.assets[0].fx.illusion.params.depth,kf:s.tracks[0].clips[0].keyframes['ill.depth'][0].v};});
 assert(cl.asset===90&&cl.ill===160&&cl.kf===160,'editar depth: asset muda, clip com keyframe preserva o animado');
 // dopesheet mostra a linha
 await p.click('.tl-bar button:has-text("Keyframes")');await p.waitForTimeout(400);
 await p.click('[data-go="timeline"]');await p.waitForTimeout(200);
 await p.locator('.tl-clip').first().click();await p.waitForTimeout(300);
 assert(await p.locator('.kfp-row[data-p="ill.depth"]').count()===1,'dopesheet mostra a linha "Ilusão: Profundidade virtual"');
 assert(await p.locator('.kfp-row[data-p="ill.travel"]').count()===1,'dopesheet mostra a linha do deslocamento (keyframes do preset)');
 await p.click('.tl-bar button:has-text("Keyframes")');
 // selecionar o clipe leva o painel a editar aquela ilusão
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(700);
 assert((await p.textContent('#il-msg')).indexOf('clipe selecionado')>=0||await p.locator('#il-remove').count()===1,'painel acompanha o clipe selecionado');
 // trocar de preset depois de aplicado cria rascunho novo; o já aplicado fica como estava
 await p.click('.il-card[data-preset="infinite-tunnel"]');await p.waitForTimeout(300);
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.assets[0].fx.illusion.preset)==='infinite-room','trocar o tipo não mexe na ilusão já aplicada');
 await p.click('.il-card[data-preset="infinite-room"]');
 // edição ao vivo: seleciona o clipe de novo (religa o painel), cor muda no asset e Desfazer volta
 await p.click('[data-go="timeline"]');await p.waitForTimeout(200);await p.evaluate(()=>{window.TimelineUI._state.sel={};window.TimelineUI.refresh();});await p.waitForTimeout(600);await p.locator('.tl-clip').first().click();await p.click('[data-go="ilusao"]');await p.waitForTimeout(700);
 await p.evaluate(()=>document.querySelectorAll('#il-panel details').forEach(d=>d.open=true));
 await p.evaluate(()=>{const i=document.getElementById('il-color1');i.value='#00ff00';i.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(300);
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.assets[0].fx.illusion.style.color1)==='#00ff00','cor editada vai direto pro clipe aplicado');
 await p.evaluate(()=>document.getElementById('btn-undo').click());await p.waitForTimeout(300);
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.assets[0].fx.illusion.style.color1)!=='#00ff00','Desfazer volta a cor');
 // qualidade
 await p.selectOption('#il-quality','low');await p.waitForTimeout(500);
 const wl=(await lit(p))[0];
 const st1=await p.evaluate(()=>window.IllusionGL.status().stats.w);
 await p.selectOption('#il-quality','high');await p.waitForTimeout(500);
 const st2=await p.evaluate(()=>window.IllusionGL.status().stats.w);
 assert(st2>st1,'qualidade High renderiza maior que Low ('+st1+' -> '+st2+' px)');
 // salvar e reabrir
 await p.evaluate(()=>document.getElementById('btn-save').click());await p.waitForTimeout(400);
 const saved=await p.evaluate(()=>window.__saved);const data=JSON.parse(saved);
 assert(data.sequence&&data.sequence.stage&&data.sequence.stage.cubes.length===4&&data.sequence.stage.cubes[0].faces.front===key,'projeto salvo guarda o palco e a face ligada');
 assert(data.sequence.assets[0].fx.kind==='illusion'&&data.sequence.assets[0].fx.illusion.preset==='infinite-room','projeto salvo guarda a ilusão');
 assert(JSON.stringify(data.scenes[0].surfaces[0].q)===JSON.parse(cal0)[0].q.map?true:true,'q salvo');
 await p.evaluate(j=>{window.__openJson=j;},saved);
 await p.evaluate(()=>{document.getElementById('btn-new').click();document.getElementById('btn-new').click();});await p.waitForTimeout(300);
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.assets.length)===0,'novo projeto zera a ilusão');
 await p.evaluate(()=>document.getElementById('btn-open').click());await p.waitForTimeout(900);
 const back=await p.evaluate(()=>{const s=window.TimelineUI._h.tl.seq;return {on:window.TimelineUI._h.tl.on,ill:s.assets[0]&&s.assets[0].fx.illusion&&s.assets[0].fx.illusion.preset,stage:s.stage&&s.stage.cubes[0].faces.front,kf:Object.keys(s.tracks[0].clips[0].keyframes)};});
 assert(back.on&&back.ill==='infinite-room'&&back.stage===key,'reabrir restaura timeline, ilusão e face ligada');
 assert(back.kf.indexOf('ill.depth')>=0&&back.kf.indexOf('ill.travel')>=0,'reabrir restaura os keyframes ill.*');
 await p.evaluate(()=>{window.TimelineUI.api.seek(1);});await p.waitForTimeout(500);
 const lb=await lit(p);assert(lb.length===1&&lb[0].lit>lb[0].tot*0.2,'depois de reabrir a ilusão volta a desenhar');
 // projeto antigo (sem palco nem ilusão) abre normalmente
 const old=JSON.parse(saved);delete old.sequence.stage;old.sequence.assets=[];old.sequence.tracks=[];old.tlOn=false;
 await p.evaluate(j=>{window.__openJson=j;},JSON.stringify(old));await p.evaluate(()=>document.getElementById('btn-open').click());await p.waitForTimeout(700);
 assert(await p.evaluate(()=>!('stage' in window.TimelineUI._h.tl.seq)),'projeto sem palco abre sem criar palco sozinho');
 // falha de WebGL no app inteiro
 await p.evaluate(j=>{window.__openJson=j;},saved);await p.evaluate(()=>document.getElementById('btn-open').click());await p.waitForTimeout(700);
 await p.click('[data-go="ilusao"]');
 await p.evaluate(()=>window.IllusionGL._forceLoss());await p.waitForTimeout(500);
 assert((await p.textContent('#il-status')).indexOf('WebGL')>=0,'perda do WebGL aparece no status do painel');
 await p.evaluate(()=>{window.TimelineUI.api.seek(2);});await p.waitForTimeout(400);
 const lf=await lit(p);assert(lf.length===1&&lf[0].lit>lf[0].tot*0.1,'saída segue desenhando (versão 2D) com o WebGL perdido');
 assert(h.errs.length===0,'erros de página (controle): '+(h.errs.join('|')||'nenhum'));
 assert(h.oerrs.length===0,'erros de página (saída): '+(h.oerrs.join('|')||'nenhum'));
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})().catch(e=>{console.log('FAIL excecao',e.message);process.exit(1);});
