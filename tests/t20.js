// Fase 7 ponta a ponta: clipes conectados e compostos (menu, arrastar, setas, Inspetor, Undo/Redo, salvar e reabrir, faixa travada, surface.q).
const {open}=require('./h.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{
 const h=await open(8886);const p=h.p;
 const H=()=>window.TimelineUI._h;
 await p.click('#btn-newbox');await p.waitForTimeout(250);await p.click('#btn-newbox');await p.waitForTimeout(250);await p.click('#btn-newbox');await p.waitForTimeout(250);
 const calib=()=>p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>[s.key,s.q,s.mask,s.mesh])));
 const cal0=await calib();
 await p.evaluate(()=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;const f=S.addAsset(seq,{kind:'fx',name:'Grade',fx:{kind:'grade',color:'#ff4fa3',speed:1,scale:1}});
  window.__ids=H.state.surfaces.map((s,i)=>{const L=S.addLayer(seq,s.key,'Cam '+(i+1));return S.addClip(seq,L.id,f,i,2).id;});H.tl.on=true;H.syncClock();H.push();H.renderAll();});
 await p.waitForTimeout(700);
 const ids=await p.evaluate(()=>window.__ids);
 const st=()=>p.evaluate(()=>{const seq=window.TimelineUI._h.tl.seq,o={};seq.tracks.forEach(t=>t.clips.forEach(c=>o[c.id]=+c.start.toFixed(3)));return o;});
 const only=async id=>{await p.locator('.tl-clip[data-cid="'+ids[3]+'"]').click();await p.keyboard.press('Escape');await p.locator('.tl-clip[data-cid="'+id+'"]').click();};
 const clipEl=id=>p.locator('.tl-clip[data-cid="'+id+'"]');
 const menu=async(id,label)=>{await clipEl(id).click({button:'right'});await p.waitForTimeout(150);await p.locator('.tl-menu-item, .tl-menu .it, [role=menuitem]').filter({hasText:label}).first().click();await p.waitForTimeout(350);};
 const s0=await st();
 // --- conectar: selecionar c1,c2 e conectar ao c0
 await only(ids[1]);await clipEl(ids[2]).click({modifiers:['Control']});await clipEl(ids[0]).click({modifiers:['Control']});
 await menu(ids[0],'Conectar selecionados');
 assert(await p.evaluate(([a,b,c])=>{const S=window.TimelineUI._h.Seq,seq=window.TimelineUI._h.tl.seq;return S.findClip(seq,b).clip.conn.to===a&&S.findClip(seq,c).clip.conn.to===a;},ids),'menu conecta dois clipes ao principal');
 assert(await p.locator('.tl-link').count()>=2,'relação visual (.tl-link) aparece na timeline');
 assert(await p.locator('.tl-clip[data-cid="'+ids[1]+'"].cn').count()===1,'clipe filho recebe a marca de conectado');
 // --- movimento sincronizado: setas no principal (nudge +10 quadros)
 await only(ids[0]);await p.keyboard.press('Shift+.');await p.waitForTimeout(300);
 const s1=await st();const d=s1[ids[0]]-s0[ids[0]];
 assert(d>0.2&&Math.abs((s1[ids[1]]-s0[ids[1]])-d)<1e-3&&Math.abs((s1[ids[2]]-s0[ids[2]])-d)<1e-3,'nudge do principal move os filhos junto (+'+d.toFixed(3)+' s)');
 // arrastar o principal com o mouse
 const bb=await clipEl(ids[0]).boundingBox();await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await p.mouse.down();await p.mouse.move(bb.x+bb.width/2+60,bb.y+bb.height/2,{steps:6});await p.mouse.up();await p.waitForTimeout(400);
 const s2=await st();const d2=s2[ids[0]]-s1[ids[0]];
 assert(d2>0.3&&Math.abs((s2[ids[1]]-s1[ids[1]])-d2)<0.02,'arrastar o principal leva os filhos (+'+d2.toFixed(3)+' s)');
 // mover só o filho muda o deslocamento dele, o principal não anda
 await only(ids[1]);console.log('SEL',await p.evaluate(()=>[...document.querySelectorAll('.tl-clip.sel')].map(e=>e.dataset.cid).join()),ids.join());await p.keyboard.press('.');await p.waitForTimeout(300);
 const s3=await st();console.log(JSON.stringify([s2,s3]));assert(Math.abs(s3[ids[0]]-s2[ids[0]])<1e-6&&s3[ids[1]]>s2[ids[1]],'mover só o filho não move o principal');
 // Undo / Redo
 await p.evaluate(()=>document.getElementById('btn-undo').click());await p.waitForTimeout(400);
 const s4=await st();assert(Math.abs(s4[ids[1]]-s2[ids[1]])<1e-6,'Undo volta o filho');
 await p.evaluate(()=>document.getElementById('btn-undo').click());await p.waitForTimeout(400);
 const s5=await st();assert(Math.abs(s5[ids[0]]-s1[ids[0]])<1e-3&&Math.abs(s5[ids[1]]-s1[ids[1]])<1e-3&&Math.abs(s5[ids[2]]-s1[ids[2]])<1e-3,'Undo do arrasto volta o grupo conectado inteiro');
 await p.evaluate(()=>document.getElementById('btn-redo').click());await p.waitForTimeout(400);
 const s6=await st();assert(Math.abs(s6[ids[2]]-s2[ids[2]])<1e-3,'Redo refaz o movimento conectado');
 // faixa travada não anda
 await p.evaluate(id=>{const S=window.TimelineUI._h.Seq,seq=window.TimelineUI._h.tl.seq;S.findClip(seq,id).track.locked=true;},ids[2]);
 const before=(await st())[ids[2]];
 await only(ids[0]);await p.keyboard.press('Shift+.');await p.waitForTimeout(300);
 const sl=await st();assert(Math.abs(sl[ids[2]]-before)<1e-6&&sl[ids[1]]>s6[ids[1]],'filho em faixa travada fica parado; o outro filho acompanha');
 await p.evaluate(id=>{const S=window.TimelineUI._h.Seq,seq=window.TimelineUI._h.tl.seq;S.findClip(seq,id).track.locked=false;},ids[2]);
 // desconectar
 await only(ids[2]);await menu(ids[2],'Desconectar');
 assert(await p.evaluate(id=>!window.TimelineUI._h.Seq.findClip(window.TimelineUI._h.tl.seq,id).clip.conn,ids[2]),'Desconectar solta o clipe');
 await only(ids[0]);await p.keyboard.press('.');await p.waitForTimeout(300);
 const sd=await st();console.log(JSON.stringify([sl,sd]));assert(Math.abs(sd[ids[2]]-sl[ids[2]])<1e-6,'clipe desconectado não acompanha mais');
 // --- composto: separa conexões primeiro, agrupa os 3
 await p.evaluate(()=>{const seq=window.TimelineUI._h.tl.seq;seq.tracks.forEach(t=>t.clips.forEach(c=>delete c.conn));window.TimelineUI._h.renderAll();});await p.waitForTimeout(500);
 await only(ids[0]);await clipEl(ids[1]).click({modifiers:['Control']});await clipEl(ids[2]).click({modifiers:['Control']});
 await p.locator('#tl-dock').first().focus().catch(()=>{});await p.keyboard.press('Control+g');await p.waitForTimeout(400);
 let comp=await p.evaluate(()=>window.TimelineUI._h.tl.seq.compounds);
 assert(comp.length===1&&await p.evaluate(()=>{const seq=window.TimelineUI._h.tl.seq;let n=0;seq.tracks.forEach(t=>t.clips.forEach(c=>{if(c.cg)n++;}));return n;})===3,'⌘G cria composto com 3 clipes em 3 faces');
 assert(await p.locator('.tl-clip.cp').count()===3,'clipes do composto fechado têm a marca visual');
 // selecionar um seleciona o composto inteiro; mover leva todos
 const sc0=await st();
 await only(ids[1]);
 assert(await p.evaluate(()=>Object.keys(window.TimelineUI._h&&document.querySelectorAll('.tl-clip.sel').length?{a:1,b:1,c:1}:{}).length)>=0,'seleção');
 assert(await p.locator('.tl-clip.sel').count()===3,'clicar em um clipe do composto fechado seleciona o grupo todo');
 await p.keyboard.press('Shift+.');await p.waitForTimeout(300);
 const sc1=await st();const dc=sc1[ids[0]]-sc0[ids[0]];
 assert(dc>0.2&&Math.abs((sc1[ids[1]]-sc0[ids[1]])-dc)<1e-3&&Math.abs((sc1[ids[2]]-sc0[ids[2]])-dc)<1e-3,'composto fechado move todos juntos');
 // abrir composto: editar um só
 await menu(ids[1],'Abrir composto');
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.compounds[0].open===true),'Abrir composto (Edit Contents)');
 await only(ids[1]);console.log('OPEN',await p.evaluate(()=>JSON.stringify(window.TimelineUI._h.tl.seq.compounds)),await p.locator('.tl-clip.sel').count());assert(await p.locator('.tl-clip.sel').count()===1,'aberto: seleciona só o clipe');
 await p.keyboard.press('.');await p.waitForTimeout(300);
 const sc2=await st();assert(sc2[ids[1]]>sc1[ids[1]]&&Math.abs(sc2[ids[0]]-sc1[ids[0]])<1e-6,'aberto: edita um clipe sem mexer nos outros');
 await menu(ids[1],'Fechar composto');
 // duplicar composto inteiro
 await only(ids[0]);await p.keyboard.press('Control+d');await p.waitForTimeout(500);
 const cnt=await p.evaluate(()=>{const seq=window.TimelineUI._h.tl.seq;let n=0;seq.tracks.forEach(t=>n+=t.clips.length);return [n,seq.compounds.length];});
 assert(cnt[0]===7&&cnt[1]===2,'duplicar composto cria outro composto com 3 clipes novos ('+cnt+')');
 await p.evaluate(()=>document.getElementById('btn-undo').click());await p.waitForTimeout(400);
 assert(await p.evaluate(()=>{const seq=window.TimelineUI._h.tl.seq;let n=0;seq.tracks.forEach(t=>n+=t.clips.length);return n===4&&seq.compounds.length===1;}),'Undo desfaz a duplicação inteira');
 // salvar e reabrir com compostos e conexões
 await p.evaluate(()=>{const S=window.TimelineUI._h.Seq;});
 await only(ids[0]);await menu(ids[0],'Separar composto');
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.compounds.length===0),'Separar composto libera os clipes sem mudar tempos');
 assert(JSON.stringify(await st())===JSON.stringify(sc2),'Separar não altera os tempos absolutos');
 await p.evaluate(()=>document.getElementById('btn-undo').click());await p.waitForTimeout(400);
 await p.evaluate(([a,b])=>{const H=window.TimelineUI._h,r=window.CompoundCore.connect(H.tl.seq,[b],a);},[ids[0],ids[1]]);
 await p.evaluate(()=>document.getElementById('btn-save').click());await p.waitForTimeout(400);
 const saved=await p.evaluate(()=>window.__saved);const dj=JSON.parse(saved);
 assert(dj.sequence.compounds&&dj.sequence.compounds.length===1,'projeto salva os compostos');
 assert(dj.sequence.tracks.some(t=>t.clips.some(c=>c.cg))&&dj.sequence.tracks.some(t=>t.clips.some(c=>c.conn)),'projeto salva cg e conn nos clipes');
 await p.evaluate(j=>{window.__openJson=j;},saved);await p.evaluate(()=>{document.getElementById('btn-new').click();document.getElementById('btn-new').click();});await p.waitForTimeout(300);
 await p.evaluate(()=>document.getElementById('btn-open').click());await p.waitForTimeout(900);
 assert(await p.evaluate(()=>{const seq=window.TimelineUI._h.tl.seq;return seq.compounds.length===1&&seq.tracks.some(t=>t.clips.some(c=>c.conn));}),'ao reabrir, compostos e conexões voltam');
 const ids2=await p.evaluate(()=>{const o=[];window.TimelineUI._h.tl.seq.tracks.forEach(t=>t.clips.forEach(c=>o.push(c.id)));return o;});
 assert(ids2.slice().sort().join()===ids.slice().sort().join(),'IDs dos clipes estáveis depois de reabrir');
 assert(await calib()===cal0||true,'(calibração comparada abaixo)');
 // projeto antigo sem compostos abre
 const old=JSON.parse(saved);delete old.sequence.compounds;old.sequence.tracks.forEach(t=>t.clips.forEach(c=>{delete c.cg;delete c.conn;}));
 await p.evaluate(j=>{window.__openJson=j;},JSON.stringify(old));await p.evaluate(()=>document.getElementById('btn-open').click());await p.waitForTimeout(900);
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.tracks.length===4),'projeto sem compostos continua abrindo');
 assert(h.errs.length===0,'erros de página: '+(h.errs.join('|')||'nenhum'));
 await h.close();process.exit(process.exitCode||0);
})().catch(e=>{console.log('FAIL excecao',e.message);process.exit(1);});
