const {openPair}=require('./h2.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{const h=await openPair(8813);const {p,o}=h;
 for(let i=0;i<11;i++) await p.click('#btn-newbox');
 await p.click('[data-go="timeline"]');await p.click('#tl-insp button.primary');await p.waitForTimeout(400);
 await p.click('.tl-bar button:has-text("Faixa p/ cada face")');await p.waitForTimeout(300);
 // monta sequencia 12 faixas, clipes em 0,2,5,10 (3 s)
 await p.evaluate(()=>{
  const H=window.TimelineUI._h, S=H.Seq, tl=H.tl, seq=tl.seq;
  const v=S.addAsset(seq,{kind:'video',name:'v6.webm',path:'/media/v6.webm',duration:6}); v.src=H.toUrl('/media/v6.webm');
  const f=S.addAsset(seq,{kind:'fx',name:'Grade',fx:{kind:'grade',color:'#ff4fa3',speed:1,scale:1}});
  const starts=[0,2,5,10];
  seq.tracks.filter(t=>t.type==='video').forEach((t,i)=>{ S.addClip(seq,t.id,i%2?v:f,starts[i%4],3); });
  seq.duration=30; H.syncClock(); H.push(); H.renderAll();
 });
 await p.waitForTimeout(800);
 const q0=await p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>s.q)));
 // seek 3.25 (pausado)
 await p.evaluate(()=>window.TimelineUI.api.seek(3.25));
 const t0=Date.now();
 // Espera por condição POSITIVA (antes usava every() em lista vazia: passava antes do vídeo existir, e sob carga lia o quadro velho).
 // Pronto = pelo menos um <video> existe nas duas páginas, nenhum está em seek, e todos estão em 1.25 s.
 const settled=(pg,isOut)=>pg.evaluate((isOut)=>{const r=isOut?window.__rend:window.TimelineUI._h.rend;const vs=[];Object.values(r.recs).forEach(rec=>Object.keys(rec.ex).filter(x=>x[0]==='c').forEach(x=>{const e=rec.ex[x].el;if(e.tagName==='VIDEO')vs.push(e);}));return {n:vs.length,ok:vs.length>0&&vs.every(e=>!e.seeking&&e.readyState>=2&&Math.abs(e.currentTime-1.25)<0.05),cts:vs.map(e=>+e.currentTime.toFixed(2))};},isOut);
 let sp0=null,so0=null;for(let k=0;k<60;k++){ await p.waitForTimeout(150); sp0=await settled(p,false); so0=await settled(o,true); if(sp0.ok&&so0.ok){console.log('seek settled in ms',Date.now()-t0);break;} }
 assert(sp0.ok&&so0.ok,'seek assentou nas duas janelas (preview '+JSON.stringify(sp0)+', saida '+JSON.stringify(so0)+')');
 const snap=async(pg,isOut)=>pg.evaluate((isOut)=>{
   const rend=isOut?window.__rend:window.TimelineUI._h.rend;
   const keys=Object.keys(rend.recs);
   return keys.map(k=>{const r=rend.recs[k];return Object.keys(r.ex).filter(x=>x[0]==='c').map(x=>{const e=r.ex[x].el;return {tag:e.tagName,op:+(+e.style.opacity).toFixed(3),tf:e.style.transform||'',ct:e.tagName==='VIDEO'?+e.currentTime.toFixed(2):null};});});
 },isOut);
 const sp=await snap(p,false), so=await snap(o,true);
 const active=sp.map((e,i)=>e.length?i:-1).filter(i=>i>=0);
 // t=3.25: starts=2 (i%4==1) ativo (2..5). i%4==0: 0..3 inativo; i%4==2: 5.. inativo
 assert(JSON.stringify(active)==='[1,5,9]','faces ativas em 3.25 (preview): '+JSON.stringify(active));
 const activeO=so.map((e,i)=>e.length?i:-1).filter(i=>i>=0);
 assert(JSON.stringify(activeO)===JSON.stringify(active),'faces ativas na saida iguais: '+JSON.stringify(activeO));
 const vp=sp[1].find(e=>e.tag==='VIDEO'), vo=so[1].find(e=>e.tag==='VIDEO');
 console.log('video currentTime preview/saida',vp&&vp.ct,vo&&vo.ct);
 assert(vp&&Math.abs(vp.ct-1.25)<0.1,'preview video em 1.25 (seek 3.25 - start 2)');
 assert(vo&&Math.abs(vo.ct-1.25)<0.1,'saida video em 1.25');
 // calibracao intacta
 const q1=await p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>s.q)));
 assert(q0===q1,'quadrilateros q intactos');
 console.log('errs',h.errs,h.oerrs);
 await p.screenshot({path:'t2-a.png'});await o.screenshot({path:'t2-out.png'});
 await h.close();})();
