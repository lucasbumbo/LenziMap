// Camadas empilhadas por face (estilo Final Cut): faixa de cima aparece por cima, em prévia e saída.
const {openPair}=require('./h2.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{const h=await openPair(8861);const {p,o}=h;
 await p.click('#btn-newbox');
 await p.click('[data-go="timeline"]');await p.click('#tl-insp button.primary');await p.waitForTimeout(400);
 await p.click('.tl-bar button:has-text("Faixa p/ cada face")');await p.waitForTimeout(300);
 const q0=await p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>s.q)));
 // clique real no botão ＋ da primeira faixa
 assert(await p.locator('.tl-head').count()===2,'2 faixas, uma por face');
 await p.locator('.tl-head').first().locator('button[aria-label="Adicionar camada"]').click();await p.waitForTimeout(300);
 const names=await p.evaluate(()=>window.TimelineUI._h.tl.seq.tracks.map(t=>t.name));console.log('faixas',JSON.stringify(names));
 assert(names.length===3&&/Camada 2/.test(names[0]),'＋ cria "Camada 2" ACIMA da faixa da face: '+names);
 const info=await p.evaluate(()=>{const S=window.Sequence,seq=window.TimelineUI._h.tl.seq;return seq.tracks.map(t=>S.layerInfo(seq,t.id));});
 assert(info[0].n===2&&info[1].n===1&&info[0].total===2,'badge C2 em cima, C1 embaixo');
 assert(await p.locator('.tl-lay.multi').count()===2,'badges C2 e C1 destacados na UI');
 await p.evaluate(()=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;
  const a=S.addAsset(seq,{kind:'fx',name:'Grade',fx:{kind:'grade',color:'#ff4fa3',speed:1,scale:1}});
  const b=S.addAsset(seq,{kind:'video',name:'v6',path:'/media/v6.webm',duration:6});b.src=H.toUrl(b.path);
  const top=seq.tracks[0],base=seq.tracks[1];
  const cb=S.addClip(seq,base.id,a,0,10);const ct=S.addClip(seq,top.id,b,1,5);ct.transform.opacity=0.8;
  window.__ids={cb:cb.id,ct:ct.id,top:top.id,base:base.id};
  seq.duration=12;H.syncClock();H.push();H.renderAll();window.TimelineUI.api.seek(3);});
 await p.waitForTimeout(1500);
 const order=(pg,isOut)=>pg.evaluate(([isOut,ids])=>{const r=isOut?window.__rend:window.TimelineUI._h.rend;const rec=Object.values(r.recs)[0];const kids=[...rec.box.children].filter(e=>e.tagName==='VIDEO'||e.tagName==='CANVAS'||e.tagName==='DIV');const idx=id=>{const x=rec.ex['c'+id];return x?[...rec.box.children].indexOf(x.el):-1;};return {base:idx(ids.cb),top:idx(ids.ct)};},[isOut,{cb:null,ct:null}]);
 const ids=await p.evaluate(()=>window.__ids);
 const ord=async(pg,isOut)=>pg.evaluate(([isOut,ids])=>{const r=isOut?window.__rend:window.TimelineUI._h.rend;const rec=Object.values(r.recs)[0];const ch=[...rec.box.children];const idx=id=>{const x=rec.ex['c'+id];return x?ch.indexOf(x.el):-1;};return {base:idx(ids.cb),top:idx(ids.ct)};},[isOut,ids]);
 let po=await ord(p,false),oo=await ord(o,true);console.log('ordem DOM prévia',JSON.stringify(po),'saída',JSON.stringify(oo));
 assert(po.base>=0&&po.top>po.base,'prévia: camada de cima pintada por cima da base');
 assert(oo.base>=0&&oo.top>oo.base,'saída: mesma ordem de pintura');
 const nv=await o.evaluate(()=>{const r=window.__rend;let n=0;Object.values(r.recs).forEach(rec=>Object.keys(rec.ex).forEach(k=>{if(k[0]==='c'&&rec.ex[k].el.tagName==='VIDEO')n++;}));return n;});
 assert(nv===1,'1 vídeo ativo decodificando na saída (camada de cima) e grade na base');
 // subir/descer pelo botão ▼ da camada de cima: troca a ordem
 await p.locator('.tl-head').first().locator('button[aria-label="Descer camada"]').click();await p.waitForTimeout(800);
 po=await ord(p,false);oo=await ord(o,true);console.log('depois de descer: prévia',JSON.stringify(po),'saída',JSON.stringify(oo));
 assert(po.top<po.base&&oo.top<oo.base,'▼ inverte a pintura em prévia e saída');
 // undo
 await p.evaluate(()=>document.activeElement&&document.activeElement.blur());await p.keyboard.press('Control+z');await p.waitForTimeout(800);
 po=await ord(p,false);assert(po.top>po.base,'undo restaura a ordem das camadas');
 // ilimitadas: 12 cliques no ＋ da camada de cima
 for(let i=0;i<12;i++) await p.locator('.tl-head').first().locator('button[aria-label="Adicionar camada"]').click();
 const n=await p.evaluate(()=>window.Sequence.layersOf(window.TimelineUI._h.tl.seq,window.TimelineUI._h.tl.seq.tracks[0].surfaceId).length);
 assert(n===14,'sem limite de camadas por face ('+n+')');
 await p.waitForTimeout(500);const vis=await p.evaluate(()=>{const sc=window.TimelineUI._h.panel?null:null;const ls=document.querySelector('.tl-lane').parentElement.parentElement;return {rows:document.querySelectorAll('.tl-head').length,scroll:ls.scrollHeight>ls.clientHeight,cls:ls.className,sh:ls.scrollHeight,ch:ls.clientHeight};});console.log(JSON.stringify(vis));
 assert(vis.rows===15&&vis.scroll,'15 faixas na lista e rolagem vertical disponível');
 // salvar e reabrir
 await p.click('[data-go="saida"]');await p.click('#btn-save');await p.waitForTimeout(300);
 const saved=await p.evaluate(()=>window.__saved);await p.evaluate(j=>{window.__openJson=j;},saved);
 await p.click('#btn-new');await p.click('#btn-new');await p.click('#btn-open');await p.waitForTimeout(800);
 const re=await p.evaluate(()=>window.TimelineUI._h.tl.seq.tracks.map(t=>t.name+':'+t.clips.length));
 assert(re.length===JSON.parse(saved).sequence.tracks.length,'camadas persistem ao salvar e reabrir '+JSON.stringify(re));
 assert(await p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>s.q)))===q0,'q intacto');
 console.log('errs',h.errs,h.oerrs);assert(h.errs.length===0&&h.oerrs.length===0,'sem erros de JS');
 await h.close();})();
