const {openPair}=require('./h2.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{const h=await openPair(8841);const {p,o}=h;
 await p.click('[data-go="timeline"]');await p.click('#tl-insp button.primary');await p.waitForTimeout(400);
 await p.click('.tl-bar button:has-text("Faixa p/ cada face")');await p.waitForTimeout(300);
 await p.evaluate(()=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;
  const v=S.addAsset(seq,{kind:'video',name:'v6',path:'/media/v6.webm',duration:6});v.src=H.toUrl(v.path);
  const m=S.addAsset(seq,{kind:'audio',name:'music',path:'/media/music.mp3',duration:20});m.src=H.toUrl(m.path);
  const s=S.addAsset(seq,{kind:'audio',name:'sfx',path:'/media/sfx1.wav',duration:1});s.src=H.toUrl(s.path);
  const miss=S.addAsset(seq,{kind:'video',name:'sumiu',path:'/media/nao-existe.webm',duration:5});miss.src=H.toUrl(miss.path);
  const bad=S.addAsset(seq,{kind:'video',name:'corrompido',path:'/media/bad.webm',duration:5});bad.src=H.toUrl(bad.path);
  const c=S.addClip(seq,seq.tracks[0].id,v,0,6);
  S.setKey(c,'x',0,0,'linear');S.setKey(c,'x',2,0.4,'linear');S.setKey(c,'opacity',3,1,'hold');S.setKey(c,'opacity',4,0.2,'hold');
  c.transform.corners[2]=[0.1,-0.05];
  const ta=S.addTrack(seq,'audio');S.addClip(seq,ta.id,m,0,20);
  const tb=S.addTrack(seq,'audio');[1,3,5].forEach(t=>S.addClip(seq,tb.id,s,t,1));
  const o2=S.addClip(seq,seq.tracks[0].id,miss,7,2);
  seq.duration=12;H.syncClock();H.push();H.renderAll();window.__ids={c:c.id};});
 await p.waitForTimeout(500);
 const q0=await p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>s.q)));
 // keyframes
 const ev=await p.evaluate(()=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;const r=t=>{const e=S.evaluate(seq,t).video[H.state.surfaces[0].key];return e&&e[0]?{x:+e[0].ev.p.x.toFixed(3),op:+e[0].ev.opacity.toFixed(3)}:null};return {a:r(1),b:r(2),c:r(3.5),d:r(4.5)};});
 console.log('kf',JSON.stringify(ev));
 assert(Math.abs(ev.a.x-0.2)<1e-3&&Math.abs(ev.b.x-0.4)<1e-3,'keyframe linear interpola x (0.2 em 1 s, 0.4 em 2 s)');
 assert(ev.c.op===1&&Math.abs(ev.d.op-0.2)<1e-3,'keyframe hold de opacity');
 // render real: transform muda com o tempo e q intacto
 const tf=[];for(const t of [0,1,2]){await p.evaluate(t=>window.TimelineUI.api.seek(t),t);await p.waitForTimeout(250);tf.push(await p.evaluate(()=>{const r=window.TimelineUI._h.rend;const rec=Object.values(r.recs)[0];const k=Object.keys(rec.ex).find(x=>x[0]==='c');return rec.ex[k]&&rec.ex[k].el.style.transform;}));}
 assert(tf[0]&&tf[0]!==tf[2],'matrix3d muda entre 0 s e 2 s (distort + keyframe)');
 assert(await p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>s.q)))===q0,'quatro cantos de calibracao (q) intactos');
 // lockCal e autoKey via viewer: arrastar canto do clipe nao toca q
 // audio: play
 await p.evaluate(()=>window.TimelineUI.api.seek(0.5));await p.waitForTimeout(200);
 await p.evaluate(()=>window.TimelineUI.api.play());await p.waitForTimeout(1500);
 await p.evaluate(()=>{const s=window.TimelineUI._h.rend.player.audioStats;s.samples=0;s.sum=0;s.max=0;s.seeks=0;});await p.waitForTimeout(2000);
 const au=await p.evaluate(()=>{const pl=window.TimelineUI._h.rend.player;const a=Object.values(pl.audio);return {n:a.length,playing:a.filter(e=>!e.paused).length,muted:a.filter(e=>e.muted).length,st:pl.audioStats,t:window.TimelineUI._h.tl.clock.now(),ct:a.map(e=>+e.currentTime.toFixed(2))};});
 const ao=await o.evaluate(()=>{const pl=window.__rend.player;return {n:Object.keys(pl.audio).length,audioEls:document.querySelectorAll('audio').length,vids:[...document.querySelectorAll('video')].filter(v=>!v.muted).length};});
 console.log('audio preview',JSON.stringify(au),'saida',JSON.stringify(ao));
 assert(au.n>=1,'musica ativa na janela de controle');
 assert(ao.n===0&&ao.vids===0,'janela de saida nao toca audio (sem duplicar)');
 assert(au.st.samples>0&&au.st.sum/au.st.samples<0.1&&au.st.max<0.4,'audio drift max '+au.st.max.toFixed(3)+' s, media '+(au.st.sum/au.st.samples).toFixed(3)+' s');
 // pausa rapida
 for(let i=0;i<20;i++){await p.evaluate(()=>window.TimelineUI.api.pause());await p.evaluate(()=>window.TimelineUI.api.play());}
 await p.evaluate(()=>window.TimelineUI.api.pause());await p.waitForTimeout(500);
 const ps=await p.evaluate(()=>{const H=window.TimelineUI._h,pl=H.rend.player;return {pl:H.tl.clock.playing,pa:Object.values(pl.audio).filter(e=>!e.paused).length};});
 assert(!ps.pl&&ps.pa===0,'play/pause rapido (20x) termina pausado, audio todo pausado');
 const t1=await p.evaluate(()=>window.TimelineUI._h.tl.clock.now()),to=await o.evaluate(()=>window.__rend.player.clock.now());
 assert(Math.abs(t1-to)<0.05,'preview e saida no mesmo tempo apos pausa: '+t1.toFixed(3)+' vs '+to.toFixed(3));
 // midia faltando / corrompida / sobreposicao
 await p.evaluate(()=>window.TimelineUI.api.seek(7.5));await p.waitForTimeout(600);
 assert((await p.evaluate(()=>1))&&h.errs.length===0&&h.oerrs.length===0,'midia ausente nao gera erro JS');
 const st=await p.evaluate(()=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;const t=seq.tracks[0];const bad=seq.assets.find(a=>a.name==='corrompido');const c2=S.addClip(seq,t.id,bad,7.5,2);return {conf:Object.keys(S.conflicts(t)).length,n:t.clips.length};});
 console.log('sobreposicao',JSON.stringify(st));
 await p.evaluate(()=>{window.TimelineUI._h.syncClock();window.TimelineUI._h.push();window.TimelineUI._h.renderAll();window.TimelineUI.api.seek(8);});await p.waitForTimeout(800);
 await p.evaluate(()=>window.TimelineUI.api.play());await p.waitForTimeout(1500);await p.evaluate(()=>window.TimelineUI.api.pause());
 console.log('conflitos',st.conf);assert(st.conf===2,'sobreposicao detectada (2 clipes)');
 assert(h.errs.length===0&&h.oerrs.length===0,'midia corrompida + sobreposicao sem erro JS: '+JSON.stringify(h.errs.concat(h.oerrs)));
 // saida desconectada: fechar pagina de saida e continuar
 await o.close();await p.evaluate(()=>window.TimelineUI.api.seek(1));await p.evaluate(()=>window.TimelineUI.api.play());await p.waitForTimeout(800);await p.evaluate(()=>window.TimelineUI.api.pause());
 assert(h.errs.length===0,'saida desconectada: controle segue sem erro');
 console.log('errs',h.errs,h.oerrs);await h.close();})();
