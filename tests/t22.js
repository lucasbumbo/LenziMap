// Fase 9 (parcial): efeitos de processamento e mesclagem no Viewer e na saída externa. O navegador de efeitos (aba) ainda NÃO existe.
const {openPair}=require('./h2.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{
 const h=await openPair(8889);const p=h.p,o=h.o;
 await p.click('#btn-newbox');await p.waitForTimeout(250);
 const cal=()=>p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>[s.q,s.mask,s.mesh])));const c0=await cal();
 await p.evaluate(()=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq,EC=window.EffectsCore;const f=S.addAsset(seq,{kind:'fx',name:'Grade',fx:{kind:'grade',color:'#ff4fa3',speed:1,scale:1}});
  const L=S.addLayer(seq,H.state.surfaces[0].key,'A');const c=S.addClip(seq,L.id,f,0,6);c.efx=[EC.create('blur'),EC.create('glow')];c.efx[0].amount=0.5;c.blend='add';window.__cid=c.id;H.tl.on=true;H.tl.clock.seek(1);H.syncClock();H.push();H.renderAll();});
 await p.waitForTimeout(900);
 const info=async(pg)=>pg.evaluate(()=>{const all=[...document.querySelectorAll('.surf *')].filter(x=>x.style&&x.style.filter);return all.map(x=>x.style.filter+'|'+x.style.mixBlendMode).join(' ## ');});
 const vi=await info(p),oi=await info(o);console.log('V',vi.slice(0,120),'O',oi.slice(0,120));
 assert(/blur\(20/.test(vi)&&/url\(["']?#lmfx-/.test(vi)&&/plus-lighter/.test(vi),'Viewer aplica Blur, Glow (SVG) e mesclagem Add');
 assert(/blur\(20/.test(oi)&&/plus-lighter/.test(oi),'saída externa aplica os mesmos efeitos');
 assert(await p.evaluate(()=>document.querySelectorAll('#lm-fx-defs filter').length)>=1&&await o.evaluate(()=>document.querySelectorAll('#lm-fx-defs filter').length)>=1,'filtros SVG criados nas duas páginas');
 await p.click('[data-go="timeline"]');await p.locator('.tl-clip').first().click();await p.waitForTimeout(500);
 assert(await p.locator('.tl-efx').count()===2,'Inspetor lista os 2 efeitos');
 await p.evaluate(()=>{const H=window.TimelineUI._h,c=H.Seq.findClip(H.tl.seq,window.__cid).clip;H.Seq.setKey(c,'ef.'+c.efx[0].id,0,0);H.Seq.setKey(c,'ef.'+c.efx[0].id,2,1);H.tl.clock.seek(1);H.syncClock();H.push();});await p.waitForTimeout(500);
 assert(/blur\(20/.test(await info(p)),'intensidade com keyframe (50% em 1 s)');
 await p.evaluate(()=>{const H=window.TimelineUI._h,c=H.Seq.findClip(H.tl.seq,window.__cid).clip;c.efx[0].on=false;c.efx[1].on=false;c.blend='normal';H.syncClock();H.push();});await p.waitForTimeout(500);
 assert(!/blur|url/.test(await info(p)),'desligar os efeitos remove os filtros');
 assert(await cal()===c0,'surface.q, máscara e malha intactos');
 assert(h.errs.length===0&&h.oerrs.length===0,'erros: '+(h.errs.concat(h.oerrs).join('|')||'nenhum'));
 await h.close();process.exit(process.exitCode||0);
})().catch(e=>{console.log('FAIL excecao',e.message);process.exit(1);});
