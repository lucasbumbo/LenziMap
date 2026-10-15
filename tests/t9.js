// Viewer estilo Final Cut: Transformar / Distorcer / Cortar com mouse real. Nenhuma alça pode alterar surface.q / mask / mesh.
const {open}=require('./h.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{const h=await open(8851);const p=h.p;
 await p.click('#btn-newbox');
 await p.click('[data-go="timeline"]');await p.click('#tl-insp button.primary');await p.waitForTimeout(400);
 await p.click('.tl-bar button:has-text("Faixa p/ cada face")');await p.waitForTimeout(300);
 await p.evaluate(()=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;
  const f=S.addAsset(seq,{kind:'fx',name:'Grade',fx:{kind:'grade',color:'#ff4fa3',speed:1,scale:1}});
  const c=S.addClip(seq,seq.tracks[0].id,f,0,10);window.__cid=c.id;
  seq.duration=20;H.syncClock();H.push();H.renderAll();window.TimelineUI.api.seek(2);});
 await p.waitForTimeout(400);
 await p.locator('.tl-clip').first().click();await p.waitForTimeout(400);
 const guard=()=>p.evaluate(()=>{const H=window.TimelineUI._h;return JSON.stringify(H.state.surfaces.map(s=>[s.q,s.mask,s.mesh]));});
 const g0=await guard();
 assert(await p.evaluate(()=>window.TimelineUI._h.state.mode)==='clip','selecionar clipe entra no modo clipe');
 const handle=(k,i)=>p.evaluate(([k,i])=>{const sel='#overlay [data-k="'+k+'"]'+(i!=null?'[data-i="'+i+'"]':'');const e=[...document.querySelectorAll(sel)].pop();if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};},[k,i]);
 const clip=()=>p.evaluate(()=>{const H=window.TimelineUI._h,c=H.Seq.findClip(H.tl.seq,window.__cid).clip;return JSON.parse(JSON.stringify({b:c.transform,k:c.keyframes}));});
 const drag=async(pt,dx,dy,steps=8,mod)=>{if(mod)await p.keyboard.down(mod);await p.mouse.move(pt.x,pt.y);await p.mouse.down();for(let i=1;i<=steps;i++)await p.mouse.move(pt.x+dx*i/steps,pt.y+dy*i/steps);await p.mouse.up();if(mod)await p.keyboard.up(mod);await p.waitForTimeout(150);};
 const bar=await p.evaluate(()=>[...document.querySelectorAll('.tl-vbar:not(.v2) .tl-vb')].map(x=>x.textContent));console.log('barra',JSON.stringify(bar));
 assert(bar.length===5,'barra do Viewer com 5 botões');
 assert(await p.locator('.tl-bar button').count()>3,'barra da timeline continua inteira');
 let c0=await clip();
 // Transformar
 for(const [k,i] of [['tlm'],['tlsc',0],['tlss',0],['tlr']])assert(!!(await handle(k,i)),'Transformar: alça '+k+' visível');
 let pt=await handle('tlm');await drag(pt,60,30);
 let c1=await clip();assert(Math.abs(c1.b.x-c0.b.x)>0.01||Math.abs(c1.b.y-c0.b.y)>0.01,'mover: arrastar dentro move o clipe');
 assert(await guard()===g0,'mover: q/mask/mesh intactos');
 pt=await handle('tlsc',2);await drag(pt,40,40);
 c1=await clip();assert(c1.b.scale!==c0.b.scale,'canto: escala proporcional mudou ('+c0.b.scale+' -> '+c1.b.scale+')');
 assert(c1.b.sx===c0.b.sx&&c1.b.sy===c0.b.sy,'canto: largura/altura independentes não mudaram');
 assert(await guard()===g0,'canto: q intacto');
 let c2;
 pt=await handle('tlss',1);await drag(pt,40,0);
 c2=await clip();assert(c2.b.sx!==c1.b.sx&&c2.b.sy===c1.b.sy,'lado direito: só a largura mudou ('+c1.b.sx+' -> '+c2.b.sx+')');
 pt=await handle('tlss',2);await drag(pt,0,30);
 let c3=await clip();assert(c3.b.sy!==c2.b.sy&&c3.b.sx===c2.b.sx,'lado de baixo: só a altura mudou');
 assert(await guard()===g0,'lados: q intacto');
 // girar (a tela ficou mais baixa: volta a escala antes, senão a bolinha cai fora do palco)
 await p.evaluate(()=>{const H=window.TimelineUI._h,c=H.Seq.findClip(H.tl.seq,window.__cid).clip;Object.assign(c.transform,{rot:0,scale:0.6,sx:1,sy:1,x:0,y:0});H.push();H.renderAll();});await p.waitForTimeout(300);
 c3=await clip();
 pt=await handle('tlr');await drag(pt,-80,40,12);
 let c4=await clip();assert(Math.abs(c4.b.rot-c3.b.rot)>2,'girar: rotação mudou ('+c3.b.rot+' -> '+c4.b.rot+')');
 assert(await guard()===g0,'girar: q intacto');
 await p.evaluate(()=>{const H=window.TimelineUI._h,c=H.Seq.findClip(H.tl.seq,window.__cid).clip;Object.assign(c.transform,{rot:0,scale:0.6,sx:1,sy:1,x:0,y:0});H.push();H.renderAll();});await p.waitForTimeout(300);
 // girar com Shift = passos de 15 graus
 pt=await handle('tlr');console.log('hit',await p.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e&&(e.tagName+'.'+(e.getAttribute('class')||'')+' k='+e.getAttribute('data-k'));},[pt.x,pt.y]));await drag(pt,30,25,10,'Shift');
 let c5=await clip();assert(Math.abs(c5.b.rot/15-Math.round(c5.b.rot/15))<1e-6,'Shift: rotação em múltiplos de 15 ('+c5.b.rot+')');
 // clique fora do polígono do clipe, dentro da superfície, e botão direito não mexem na calibração
 const st=await p.evaluate(()=>{const r=document.getElementById('stage').getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height};});
 await p.mouse.click(st.l+st.w*0.04,st.t+st.h*0.04);await p.mouse.click(st.l+st.w*0.5,st.t+st.h*0.5,{button:'right'});
 await p.mouse.move(st.l+st.w*0.5,st.t+st.h*0.5);await p.mouse.down({button:'right'});await p.mouse.move(st.l+st.w*0.6,st.t+st.h*0.6,{steps:6});await p.mouse.up({button:'right'});
 assert(await guard()===g0,'clique fora e botão direito não mexem em q');
 // setas movem só o clipe
 await p.evaluate(()=>document.activeElement&&document.activeElement.blur());
 const cx=await clip();await p.keyboard.press('ArrowRight');await p.keyboard.press('Shift+ArrowDown');
 const cy=await clip();assert(cy.b.x!==cx.b.x&&cy.b.y!==cx.b.y,'setas movem o clipe');
 assert(await guard()===g0,'setas: q intacto');
 // atalhos de ferramenta
 await p.keyboard.press('Shift+D');await p.waitForTimeout(150);
 assert(!!(await handle('tlc',0)),'Shift+D: Distorcer mostra cantos');
 // Distorcer
 pt=await handle('tlc',0);const before=(await clip()).b.corners;await drag(pt,25,20);
 let d=await clip();assert(JSON.stringify(d.b.corners[0])!==JSON.stringify(before[0]),'distorcer: canto 1 mudou');
 assert(JSON.stringify(d.b.corners[1])===JSON.stringify(before[1]),'distorcer: outros cantos independentes');
 assert(await guard()===g0,'distorcer: q intacto');
 // Cortar
 await p.keyboard.press('Shift+C');await p.waitForTimeout(150);
 assert(!!(await handle('tlcr',4)),'Shift+C: Cortar mostra alças');
 pt=await handle('tlcr',0);await drag(pt,0,25);
 d=await clip();assert(d.b.crop&&(d.b.crop.t>0.001||d.b.crop.l>0.001||d.b.crop.r>0.001||d.b.crop.b>0.001),'cortar: crop gravado '+JSON.stringify(d.b.crop));
 assert(await guard()===g0,'cortar: q intacto');
 // undo desfaz o corte
 await p.keyboard.press('Control+z');await p.waitForTimeout(300);
 const u=await clip();assert(JSON.stringify(u.b.crop)!==JSON.stringify(d.b.crop),'undo desfaz o corte');
 await p.keyboard.press('Shift+T');await p.waitForTimeout(200);await p.screenshot({path:'tests/shots-viewer.png'});
 // travar calibração
 await p.click('.tl-vb.lk');await p.waitForTimeout(150);
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.lockCal)===true,'botão de trava liga lockCal');
 // volta para calibração
 await p.click('.tl-vb[data-k="cal"]');await p.waitForTimeout(150);
 assert(await p.evaluate(()=>window.TimelineUI._h.state.mode)!=='clip','botão Calibração sai do modo clipe');
 console.log('errs',h.errs);assert(h.errs.length===0,'sem erros de JS');
 await h.close();})();
