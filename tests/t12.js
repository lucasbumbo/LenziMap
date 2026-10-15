// Media Browser com mouse real: importar, miniaturas, metadados, busca, ordenar, coleções, arrastar, offline, relink, substituir, desfazer, persistir.
const {open}=require('./h.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{const h=await open(8872);const p=h.p;
 await p.click('#btn-newbox');
 await p.click('[data-go="timeline"]');await p.click('#tl-insp button.primary');await p.waitForTimeout(500);
 await p.click('.tl-bar button:has-text("Faixa p/ cada face")');await p.waitForTimeout(300);
 const g=()=>p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>[s.q,s.mask,s.mesh])));const g0=await g();
 const cards=()=>p.locator('.mb-card').count();
 const asset=(name)=>p.evaluate(n=>{const a=window.TimelineUI._h.tl.seq.assets.find(x=>x.name===n);return a?JSON.parse(JSON.stringify(a)):null;},name);
 const clips=()=>p.evaluate(()=>window.TimelineUI._h.tl.seq.tracks.reduce((n,t)=>n+t.clips.length,0));
 assert(await p.locator('.mb-sec').count()===1,'seção "Mídia do projeto" no inspetor');
 assert(/Nenhuma mídia/.test(await p.locator('.mb-info').textContent()),'estado vazio explica o que fazer');
 // importar de verdade pelo botão
 await p.evaluate(()=>{window.__media=['/media/v6.webm','/media/v4.webm','/media/music.mp3','/media/sfx1.wav'];window.api.openMedia=()=>Promise.resolve(window.__media);});
 await p.click('.mb-b:has-text("Importar")');await p.waitForTimeout(2500);
 assert(await cards()===4,'4 mídias na biblioteca ('+await cards()+')');
 assert(await clips()>=4,'cada importação também colocou clipe na timeline ('+await clips()+')');
 // miniaturas
 await p.waitForTimeout(1500);
 const thumbOk=await p.evaluate(()=>[...document.querySelectorAll('.mb-card')].map(c=>{const cv=c.querySelector('canvas');const d=cv.getContext('2d').getImageData(0,0,160,90).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2];return {n:c.querySelector('.mb-nm').textContent,s};}));
 console.log('miniaturas',JSON.stringify(thumbOk));
 assert(thumbOk.filter(x=>/v6|v4/.test(x.n)).every(x=>x.s>1000),'miniaturas de vídeo têm imagem de verdade');
 // metadados
 await p.waitForTimeout(3000);
 const v6=await asset('v6.webm');console.log('v6',JSON.stringify(v6));
 assert(v6&&v6.dims&&v6.dims[0]>0&&v6.duration>5,'resolução e duração lidas ('+JSON.stringify(v6&&v6.dims)+', '+(v6&&v6.duration)+')');
 assert(v6.meta&&v6.meta.fps>=10,'fps medido de verdade ('+(v6.meta&&v6.meta.fps)+')');
 const txt=await p.locator('.mb-card:has-text("v6.webm") .mb-meta').textContent();assert(/Vídeo/.test(txt)&&/×/.test(txt)&&/fps/.test(txt)&&/em 1 clipe/.test(txt),'cartão mostra tipo, resolução, fps e uso: '+txt);
 // busca / filtro / ordenar
 await p.fill('.mb-top input[type=search]','v4');await p.waitForTimeout(200);assert(await cards()===1,'busca "v4" acha 1');
 await p.fill('.mb-top input[type=search]','');await p.selectOption('.mb-row select[aria-label="Tipo"]','audio');await p.waitForTimeout(200);assert(await cards()===2,'filtro Áudio: 2');
 await p.selectOption('.mb-row select[aria-label="Tipo"]','all');await p.selectOption('.mb-row select[aria-label="Ordenar"]','name');await p.waitForTimeout(200);
 let ns=await p.locator('.mb-nm').allTextContents();assert(ns.join()===[...ns].sort((a,b)=>a.localeCompare(b,'pt',{numeric:true,sensitivity:'base'})).join(),'ordem por nome: '+ns);
 await p.click('.mb-b[aria-label="Inverter a ordem"]');await p.waitForTimeout(200);let nd=await p.locator('.mb-nm').allTextContents();assert(nd.join()===[...ns].reverse().join(),'↓ inverte a ordem');
 await p.click('.mb-b[aria-label="Inverter a ordem"]');
 // coleção e renomear
 await p.evaluate(()=>{window.prompt=(m,d)=>window.__ans;});
 await p.evaluate(()=>{window.__ans='Cena 1';});await p.locator('.mb-card:has-text("v6.webm") [data-k="col"]').click();await p.waitForTimeout(300);
 assert((await asset('v6.webm')).collection==='Cena 1','coleção gravada no ativo');
 assert(await p.evaluate(()=>[...document.querySelectorAll('.mb-row select[aria-label="Coleção"] option')].some(o=>/Cena 1 \(1\)/.test(o.textContent))),'coleção aparece no seletor com contagem');
 await p.selectOption('.mb-row select[aria-label="Coleção"]','Cena 1');await p.waitForTimeout(200);assert(await cards()===1,'filtro por coleção');
 await p.selectOption('.mb-row select[aria-label="Coleção"]','all');
 await p.evaluate(()=>{window.__ans='Neon final';});await p.locator('.mb-card:has-text("v4.webm") [data-k="ren"]').click();await p.waitForTimeout(300);assert(!!(await asset('Neon final')),'renomear');
 // apagar só o que não está em uso
 assert(await p.locator('.mb-card:has-text("Neon final") [data-k="del"]').isDisabled(),'🗑 desligado para mídia em uso');
 await p.evaluate(()=>{const H=window.TimelineUI._h;H.Seq.addAsset(H.tl.seq,{kind:'fx',name:'Grade solta',fx:{kind:'grade',color:'#f0a',speed:1,scale:1}});H.push();window.TimelineUI.refresh();});await p.waitForTimeout(500);
 assert(await cards()===5,'ativo sem clipe aparece');
 await p.locator('.mb-card:has-text("Grade solta") [data-k="del"]').click();await p.waitForTimeout(300);assert(await cards()===4&&!(await asset('Grade solta')),'🗑 apaga o ativo sem uso');
 // arrastar do navegador para a faixa
 const nBefore=await clips();
 const lane=p.locator('.tl-lane').first();const lb=await lane.boundingBox();
 await p.locator('.mb-card:has-text("sfx1.wav")').first().scrollIntoViewIfNeeded();
 await p.locator('.mb-card:has-text("Neon final")').dragTo(lane,{targetPosition:{x:300,y:Math.min(20,lb.height/2)}});await p.waitForTimeout(500);
 assert(await clips()===nBefore+1,'arrastar um cartão até uma faixa cria clipe ('+nBefore+' -> '+await clips()+')');
 // ＋ coloca no playhead
 await p.evaluate(()=>window.TimelineUI.api.seek(9));await p.locator('.mb-card:has-text("Neon final") [data-k="add"]').click();await p.waitForTimeout(400);assert(await clips()===nBefore+2,'＋ coloca no playhead');
 // offline
 await p.evaluate(()=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;const a=S.addAsset(seq,{kind:'video',name:'sumiu.mp4',path:'/media/nao-existe.mp4',duration:6,dims:[640,360]});a.src=H.toUrl(a.path);const tr=seq.tracks.find(t=>t.type==='video');window.__off=a.id;const c=S.addClip(seq,tr.id,a,14,5);window.__offClip=c.id;H.push();window.TimelineUI.refresh();});
 await p.waitForTimeout(2500);
 assert(await p.locator('.mb-card.off .mb-badge').count()===1,'mídia ausente ganha selo OFFLINE');
 assert(await p.locator('.tl-clip.off').count()===1,'o clipe fica marcado como offline na timeline');
 const cb=await clips();await p.locator('.mb-card.off [data-k="add"]').click();await p.waitForTimeout(300);assert(await clips()===cb,'＋ não coloca mídia offline');
 assert(await p.evaluate(()=>!!window.TimelineUI._h.Seq.findClip(window.TimelineUI._h.tl.seq,window.__offClip)),'clipe de mídia ausente NÃO é apagado');
 await p.check('.mb-chk1:has-text("Só offline") input');await p.waitForTimeout(200);assert(await cards()===1,'filtro "Só offline"');await p.uncheck('.mb-chk1:has-text("Só offline") input');
 // relink por arquivo
 const sav=await p.evaluate(()=>{const a=window.TimelineUI._h.tl.seq.assets.find(x=>x.id===window.__off);return {path:a.path};});
 await p.evaluate(()=>{window.__media=['/media/v4.webm'];});await p.locator('.mb-card.off [data-k="relink"]').click();await p.waitForTimeout(2500);
 const rl=await p.evaluate(()=>{const H=window.TimelineUI._h,a=H.tl.seq.assets.find(x=>x.id===window.__off),f=H.Seq.findClip(H.tl.seq,window.__offClip);return {path:a.path,off:!!a._off,dur:a.duration,clip:!!f,out:f&&f.clip.outPoint,cd:f&&f.clip.duration};});
 console.log('relink',JSON.stringify(rl));
 assert(rl.path==='/media/v4.webm'&&!rl.off&&rl.clip,'Localizar reconecta e mantém o clipe');
 assert(await p.locator('.mb-card.off').count()===0&&await p.locator('.tl-clip.off').count()===0,'selo OFFLINE some');
 // desfazer o relink
 await p.evaluate(()=>document.activeElement&&document.activeElement.blur());await p.keyboard.press('Control+z');await p.waitForTimeout(1500);
 assert((await p.evaluate(()=>window.TimelineUI._h.tl.seq.assets.find(x=>x.id===window.__off)))?.path===sav.path,'Ctrl+Z desfaz o relink');
 await p.waitForTimeout(2000);
 // relink em lote por pasta
 await p.evaluate(()=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;['v6.webm','v4.webm'].forEach((n,i)=>{const a=S.addAsset(seq,{kind:'video',name:'antigo '+n,path:'/pasta-antiga/'+n.toUpperCase(),duration:4});a.src=H.toUrl(a.path);});H.push();window.TimelineUI.refresh();window.api.libraryFolder=()=>Promise.resolve({dir:'/media',files:['/media/v6.webm','/media/v4.webm','/media/music.mp3']});});
 await p.waitForTimeout(2500);const nOff=await p.locator('.mb-card.off').count();assert(nOff===3,'3 mídias offline antes do relink em lote ('+nOff+')');
 await p.click('.mb-b:has-text("Reconectar pasta")');await p.waitForTimeout(3500);
 const left=await p.locator('.mb-card.off').count();assert(left===1,'relink de pasta reconectou as 2 que existem e deixou 1 offline ('+left+')');
 // substituir (mesmo tipo ok, outro tipo recusado)
 await p.evaluate(()=>{window.__media=['/media/music.mp3'];});const before=await asset('Neon final');await p.locator('.mb-card:has-text("Neon final") [data-k="replace"]').click();await p.waitForTimeout(1200);
 assert((await asset('Neon final')).path===before.path,'substituir vídeo por áudio é recusado');
 await p.evaluate(()=>{window.__media=['/media/v6.webm'];});await p.locator('.mb-card:has-text("Neon final") [data-k="replace"]').click();await p.waitForTimeout(2500);
 assert((await asset('Neon final')).path==='/media/v6.webm','substituir por outro vídeo troca o arquivo');
 // salvar e reabrir
 await p.click('[data-go="saida"]');await p.click('#btn-save');await p.waitForTimeout(300);
 const saved=await p.evaluate(()=>window.__saved);const sj=JSON.parse(saved).sequence.assets;
 assert(sj.some(a=>a.name==='Neon final')&&sj.some(a=>a.collection==='Cena 1'),'nome e coleção no arquivo do projeto');
 assert(!JSON.stringify(sj).includes('_off'),'estado offline não é gravado no projeto');
 await p.evaluate(j=>{window.__openJson=j;},saved);await p.click('#btn-new');await p.click('#btn-new');await p.click('#btn-open');await p.waitForTimeout(1500);
 await p.click('[data-go="timeline"]');await p.waitForTimeout(3500);
 assert(!!(await asset('Neon final'))&&(await asset('v6.webm')).collection==='Cena 1','reabrir preserva nome e coleção');
 assert(await p.locator('.mb-card.off').count()===1,'ao reabrir a mídia ausente volta a ser marcada offline');
 assert(await g()===g0,'q, máscara e malha intactos');
 await p.screenshot({path:'shots/media-browser.png'});
 console.log('errs',h.errs);assert(h.errs.length===0,'sem erros de JS');
 await h.close();})();
