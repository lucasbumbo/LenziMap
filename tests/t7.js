const {open}=require('./h.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{const h=await open(8832);const p=h.p;
 await p.click('#btn-newbox');await p.click('#btn-newbox');
 await p.click('[data-go="timeline"]');await p.click('#tl-insp button.primary');await p.waitForTimeout(400);
 await p.click('.tl-bar button:has-text("Faixa p/ cada face")');await p.waitForTimeout(300);
 await p.evaluate(async()=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;
  const v=S.addAsset(seq,{kind:'video',name:'v6.webm',path:'/media/v6.webm',duration:6});v.src=H.toUrl(v.path);
  const f=S.addAsset(seq,{kind:'fx',name:'Grade',fx:{kind:'grade',color:'#ff4fa3',speed:1,scale:1}});
  const a=S.addAsset(seq,{kind:'audio',name:'m',path:'/media/music.mp3',duration:20});a.src=H.toUrl(a.path);
  const c1=S.addClip(seq,seq.tracks[0].id,v,1,4);c1.transform.corners[0]=[0.05,0.02];c1.transform.rot=10;S.setKey(c1,'x',0,0);S.setKey(c1,'x',2,0.3);S.setKey(c1,'opacity',1,0.5,'hold');c1.loopMode='loop';c1.fadeIn=0.5;
  const c2=S.addClip(seq,seq.tracks[1].id,f,3,2);
  const ta=S.addTrack(seq,'audio');const c3=S.addClip(seq,ta.id,a,0,10);c3.audioGain=0.6;c3.fadeOut=1;
  S.addMarker(seq,2.5,'x');seq.settings.loop={on:true,in:1,out:8};seq.settings.audioOffset=40;seq.duration=20;
  H.syncClock();H.push();H.renderAll();});
 await p.waitForTimeout(400);
 const q0=await p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>[s.key,s.q])));
 await p.click('[data-go="saida"]');await p.click('#btn-save');await p.waitForTimeout(300);
 const saved=await p.evaluate(()=>window.__saved);const data=JSON.parse(saved);
 assert(data.version===5&&data.sequence&&data.sequence.schema===1,'projeto salvo com version 5 e sequence.schema 1');
 assert(data.sequence.assets.every(a=>!('src' in a)),'assets salvos sem src');
 assert(data.scenes[0].surfaces.every(s=>s.key),'superficies salvas com key estavel');
 assert(data.tlOn===true,'tlOn salvo');
 console.log('tamanho do json',saved.length,'bytes; tracks',data.sequence.tracks.length,'clips',data.sequence.tracks.reduce((n,t)=>n+t.clips.length,0));
 // reabrir
 await p.evaluate(j=>{window.__openJson=j;},saved);
 await p.click('#btn-new');await p.click('#btn-new');await p.waitForTimeout(300);
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.tracks.length)===0&&!(await p.evaluate(()=>window.TimelineUI._h.tl.on)),'Novo projeto zera sequencia e desliga timeline');
 await p.click('#btn-open');await p.waitForTimeout(600);
 const back=await p.evaluate(()=>{const H=window.TimelineUI._h;const s=JSON.parse(JSON.stringify(H.tl.seq));s.assets.forEach(a=>delete a.src);return {seq:s,on:H.tl.on,keys:JSON.stringify(H.state.surfaces.map(x=>[x.key,x.q])),srcs:H.tl.seq.assets.filter(a=>a.path).every(a=>!!a.src)};});
 {const strip=(k,v)=>(k==='_chk'||k==='_off'||k==='src'||k==='snapOpts')?undefined:v;const sortK=o=>Array.isArray(o)?o.map(sortK):(o&&typeof o==='object'?Object.keys(o).sort().reduce((a,k)=>(a[k]=sortK(o[k]),a),{}):o);const A=JSON.stringify(sortK(JSON.parse(JSON.stringify(back.seq,strip)))),B=JSON.stringify(sortK(JSON.parse(JSON.stringify(data.sequence,strip))));if(A!==B){let i=0;while(A[i]===B[i])i++;console.log('DIFF',A.slice(i-60,i+80),'|||',B.slice(i-60,i+80));}assert(A===B,'sequencia identica depois de reabrir');}
 assert(back.on===true,'timeline volta ligada');
 assert(back.keys===q0,'calibracao (q) e keys iguais depois de reabrir');
 assert(back.srcs,'links de midia reconstruidos');
 // fechar e reabrir app (autosave)
 await p.waitForTimeout(1200);await p.reload();await p.waitForTimeout(1500);
 const re=await p.evaluate(()=>{const H=window.TimelineUI._h;return {tracks:H.tl.seq.tracks.length,on:H.tl.on,loop:H.tl.seq.settings.loop,kf:H.tl.seq.tracks[0].clips[0].keyframes.x&&H.tl.seq.tracks[0].clips[0].keyframes.x.length};});
 console.log('apos recarregar',JSON.stringify(re));
 assert(re.tracks===4&&re.on&&re.kf===2&&re.loop.on,'autosave restaura clipes, keyframes, trilhas e loop');
 // projeto antigo (v3 sem sequence)
 const old={version:3,scenes:[{name:'Cena 1',secs:0,surfaces:[{name:'Velha',tag:'SUPERFÍCIE',type:'box',w:1600,h:900,q:[[0.1,0.1],[0.6,0.12],[0.62,0.7],[0.08,0.68]],mask:[[0,0],[1,0],[1,1],[0,1]],opacity:1,visible:true,extras:[{id:'x9',type:'fx',name:'Grade',visible:true,opacity:1,fit:'fill',fx:{kind:'grade',color:'#ff4fa3',speed:1,scale:1}}]}]}]};
 await p.evaluate(j=>{window.__openJson=j;},JSON.stringify(old));await p.click('#btn-open');await p.waitForTimeout(800);
 const o=await p.evaluate(()=>{const H=window.TimelineUI._h;return {on:H.tl.on,n:H.state.surfaces.length,ex:H.state.surfaces[0].extras.length,q:H.state.surfaces[0].q,dom:Object.keys(H.rend.recs).length,exDom:Object.values(H.rend.recs).map(r=>Object.keys(r.ex).length),seqTracks:H.tl.seq.tracks.length,dock:getComputedStyle(document.querySelector('.tl-dock')).display};});
 console.log('projeto antigo',JSON.stringify(o));
 assert(!o.on&&o.n===1&&o.ex===1&&o.exDom[0]===1&&o.seqTracks===0&&o.dock==='none','projeto v3 abre com timeline desligada e projeta como antes');
 assert(JSON.stringify(o.q)===JSON.stringify(old.scenes[0].surfaces[0].q),'q do projeto antigo preservado');
 console.log('errs',h.errs);await h.close();})();
