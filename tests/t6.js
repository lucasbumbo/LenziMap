const {open}=require('./h.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{const h=await open(8831);const p=h.p;
 await p.click('#btn-newbox');await p.click('#btn-newbox');
 await p.click('[data-go="timeline"]');await p.click('#tl-insp button.primary');await p.waitForTimeout(400);
 await p.click('.tl-bar button:has-text("Faixa p/ cada face")');await p.waitForTimeout(300);
 await p.evaluate(()=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;const f=S.addAsset(seq,{kind:'fx',name:'Grade',fx:{kind:'grade',color:'#ff4fa3',speed:1,scale:1}});S.addClip(seq,seq.tracks[0].id,f,1,3);S.addClip(seq,seq.tracks[1].id,f,2,2);H.syncClock();H.push();H.renderAll();});
 await p.waitForTimeout(500);
 const seq=()=>p.evaluate(()=>{const s=window.TimelineUI._h.tl.seq;return s.tracks.map(t=>t.clips.map(c=>({id:c.id,s:+c.start.toFixed(3),d:+c.duration.toFixed(3),i:+c.inPoint.toFixed(3)})));});
 const clipBox=async(n)=>(await (await p.$$('.tl-clip'))[n].boundingBox());
 const z=await p.evaluate(()=>window.TimelineUI._state.zoom);
 // 1) arrastar clipe 0 em +1.0 s (zoom px/s)
 let b=await clipBox(0);
 await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width/2+z*1.0,b.y+b.height/2,{steps:8});await p.mouse.up();await p.waitForTimeout(300);
 let s=await seq();console.log('apos mover',JSON.stringify(s[0]));
 assert(Math.abs(s[0][0].s-2.0)<0.12,'arrastar move o clipe ~ +1 s (encaixe/quadros)');
 // 2) trim da borda direita -1s
 b=await clipBox(0);
 await p.mouse.move(b.x+b.width-3,b.y+b.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width-3-z*1.0,b.y+b.height/2,{steps:8});await p.mouse.up();await p.waitForTimeout(300);
 s=await seq();console.log('apos trim R',JSON.stringify(s[0]));
 assert(Math.abs(s[0][0].d-2.0)<0.15,'trim direito encurta ~1 s');
 // 3) split no playhead com S (foco no dock)
 await p.evaluate(()=>window.TimelineUI.api.seek(3.0));
 await p.mouse.click(300,700); // clica no dock (vazio) => foco no dock; clique no vazio tambem move playhead
 await p.evaluate(()=>window.TimelineUI.api.seek(3.0));
 await p.keyboard.press('s');await p.waitForTimeout(300);
 s=await seq();console.log('apos split',JSON.stringify(s[0]));
 assert(s[0].length===2&&Math.abs(s[0][0].d-1.0)<0.05,'S corta no playhead (3.0)');
 // 4) undo / redo
 await p.keyboard.press('Control+z');await p.waitForTimeout(300);
 s=await seq();assert(s[0].length===1,'Cmd+Z desfaz o corte');
 await p.keyboard.press('Control+Shift+z');await p.waitForTimeout(300);
 s=await seq();assert(s[0].length===2,'Shift+Cmd+Z refaz o corte');
 // 5) marcador, copy/paste, delete
 await p.evaluate(()=>window.TimelineUI.api.seek(5));await p.keyboard.press('m');await p.waitForTimeout(200);
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.markers.length)===1,'M cria marcador');
 const first=(await p.$$('.tl-clip'))[0];const fb=await first.boundingBox();await p.mouse.click(fb.x+fb.width/2,fb.y+fb.height/2);
 await p.keyboard.press('Control+c');await p.evaluate(()=>window.TimelineUI.api.seek(8));await p.keyboard.press('Control+v');await p.waitForTimeout(300);
 s=await seq();assert(s[0].length===3,'copiar e colar cria 3o clipe');
 await p.keyboard.press('Delete');await p.waitForTimeout(300);s=await seq();assert(s[0].length===2,'Delete apaga o clipe colado');
 // 6) Espaco toca/pausa; Home volta
 await p.keyboard.press('Space');await p.waitForTimeout(400);assert(await p.evaluate(()=>window.TimelineUI._h.tl.clock.playing),'Espaco toca');
 await p.keyboard.press('Space');await p.waitForTimeout(200);assert(!(await p.evaluate(()=>window.TimelineUI._h.tl.clock.playing)),'Espaco pausa');
 await p.keyboard.press('Home');await p.waitForTimeout(200);assert(await p.evaluate(()=>window.TimelineUI._h.tl.clock.now())<0.01,'Home vai pro inicio');
 // 7) conflito de sobreposicao: mover 2o clipe da faixa 0 pra cima do 1o
 // 8) tempo digitado
 await p.fill('.tl-time','00:03.250');await p.keyboard.press('Enter');await p.waitForTimeout(200);
 assert(Math.abs(await p.evaluate(()=>window.TimelineUI._h.tl.clock.now())-3.25)<0.01,'digitar 00:03.250 vai pra 3,25 s');
 // 9) loop
 await p.selectOption('.tl-bar select:nth-of-type(2)','all');await p.waitForTimeout(200);
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.settings.loop.on),'Loop infinito liga');
 await p.screenshot({path:'t6-a.png'});
 console.log('errs',h.errs);await h.close();})();
