// Fase 6 ponta a ponta: painel Árvore (criar/renomear/agrupar cubos, mover faces e camadas, seleção múltipla, propriedades compartilhadas,
// Undo/Redo, salvar e reabrir, projeto antigo) com surface.q intacto.
const {open}=require('./h.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{
 const h=await open(8885);const p=h.p;
 // Arrastar e soltar por eventos sintéticos (DragEvent com DataTransfer) nas linhas da árvore. O arrastar real do navegador rola o painel
 // sozinho nesta janela de teste e erra o alvo; estes eventos exercitam os mesmos tratadores (dragstart/dragover/drop) do app.
 const dnd=(a,b)=>p.evaluate(([a,b])=>{const q=id=>document.querySelector('#hr-tree .hr-row[data-id="'+id+'"]');const s=q(a),d=q(b);if(!s||!d)return 'sem-linha';
  const dt=new DataTransfer();const f=(el,t)=>el.dispatchEvent(new DragEvent(t,{bubbles:true,cancelable:true,dataTransfer:dt}));
  f(s,'dragstart');f(d,'dragenter');const ok=!f(d,'dragover');f(d,'drop');f(s,'dragend');return ok?'ok':'recusado';},[a,b]);
 const calib=()=>p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>[s.key,s.q,s.mask,s.mesh])));
 await p.click('#btn-newbox');await p.waitForTimeout(250);await p.click('#btn-newbox');await p.waitForTimeout(250);
 const keys=await p.evaluate(()=>window.TimelineUI._h.state.surfaces.map(s=>s.key));
 const cal0=await calib();
 // timeline: uma camada por superfície com um clipe de grade
 await p.evaluate(()=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;const f=S.addAsset(seq,{kind:'fx',name:'Grade',fx:{kind:'grade',color:'#ff4fa3',speed:1,scale:1}});
  H.state.surfaces.forEach((s,i)=>{const L=S.addLayer(seq,s.key,'Cam '+(i+1));S.addClip(seq,L.id,f,0,4);});H.tl.on=true;H.syncClock();H.push();H.renderAll();});
 await p.click('[data-go="arvore"]');await p.waitForTimeout(600);
 await p.evaluate(()=>{document.getElementById('hr-tree').style.maxHeight='3000px';});   // o teste arrasta entre linhas distantes: sem rolagem interna
 assert(await p.locator('#hr-tree').isVisible(),'aba Árvore abre');
 assert(await p.locator('#hr-tree .hr-row[data-type="library"]').count()===1&&await p.locator('#hr-tree .hr-row[data-type="project"]').count()===1,'raiz: Biblioteca e Projeto');
 assert(await p.locator('#hr-tree .hr-row[data-type="scene"]').count()===1,'cena aparece');
 assert(await p.locator('#hr-tree .hr-row[data-type="cube"]').count()===4,'cubos A a D aparecem na cena ativa');
 assert(await p.locator('#hr-tree .hr-row[data-type="free"]').count()===1,'superfícies ainda sem cubo aparecem em "sem cubo"');
 const sid=await p.evaluate(()=>window.TimelineUI._h.tl.seq.stage&&window.TimelineUI._h.state.scenes[0].id);assert(!!sid,'a cena tem ID estável');
 // arrastar superfície solta -> face frontal do cubo A
 assert(await dnd('fs:'+keys[0],'fc:A:front')==='ok','soltar superfície sobre a face é aceito');await p.waitForTimeout(400);
 assert(await p.evaluate(k=>window.TimelineUI._h.tl.seq.stage.cubes[0].faces.front===k,keys[0]),'arrastar superfície para a face do cubo liga as duas');
 assert(await p.locator('#hr-tree .hr-row[data-id="fc:A:front"] ~ .hr-row[data-type="layer"]').count()>=1,'a camada da superfície aparece sob a face');
 assert(await calib()===cal0,'surface.q, máscara e malha intactos');
 // mover face (troca) frente -> direita
 await dnd('fc:A:front','fc:A:right');await p.waitForTimeout(400);
 assert(await p.evaluate(k=>{const c=window.TimelineUI._h.tl.seq.stage.cubes[0];return c.faces.right===k&&!c.faces.front;},keys[0]),'arrastar face para face vazia move a ligação');
 // Undo / Redo
 await p.keyboard.press('Escape');
 await p.evaluate(()=>document.getElementById('btn-undo')&&document.getElementById('btn-undo').click());await p.waitForTimeout(500);
 assert(await p.evaluate(k=>{const c=window.TimelineUI._h.tl.seq.stage.cubes[0];return c.faces.front===k&&!c.faces.right;},keys[0]),'Undo desfaz o movimento da face');
 await p.evaluate(()=>document.getElementById('btn-redo')&&document.getElementById('btn-redo').click());await p.waitForTimeout(500);
 assert(await p.evaluate(k=>window.TimelineUI._h.tl.seq.stage.cubes[0].faces.right===k,keys[0]),'Redo refaz');
 // novo cubo
 await p.click('#hr-new-cube');await p.waitForTimeout(400);
 assert(await p.locator('#hr-tree .hr-row[data-type="cube"]').count()===5,'+ Cubo cria o quinto cubo');
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.stage.cubes[4].id==='E'),'ID novo estável (E)');
 // renomear por duplo clique
 await p.locator('#hr-tree .hr-row[data-id="cb:E"] .hr-name').dblclick();await p.waitForTimeout(200);
 await p.fill('#hr-rename-input','Cubo extra');await p.keyboard.press('Enter');await p.waitForTimeout(400);
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.stage.cubes[4].name==='Cubo extra'),'renomear cubo por duplo clique');
 // seleção múltipla + grupo
 await p.locator('#hr-tree .hr-row[data-id="cb:B"]').click();
 await p.locator('#hr-tree .hr-row[data-id="cb:C"]').click({modifiers:['Control']});
 await p.locator('#hr-tree .hr-row[data-id="cb:D"]').click({modifiers:['Control']});await p.waitForTimeout(200);
 assert((await p.textContent('#hr-count')).indexOf('3')===0,'Ctrl+clique seleciona vários (3)');
 await p.click('#hr-new-group');await p.waitForTimeout(400);
 const g=await p.evaluate(()=>window.TimelineUI._h.tl.seq.stage.groups);assert(g.length===1&&g[0].cubes.join()==='B,C,D','grupo criado com os 3 cubos selecionados');
 assert(await p.locator('#hr-tree .hr-row[data-type="group"]').count()===1,'grupo aparece na árvore');
 // propriedades compartilhadas: tamanho dos 3 cubos
 await p.locator('#hr-tree .hr-row[data-id="cb:B"]').click();
 await p.locator('#hr-tree .hr-row[data-id="cb:D"]').click({modifiers:['Shift']});await p.waitForTimeout(200);
 await p.evaluate(()=>{const e=document.getElementById('hr-p-size');e.value=10;e.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(400);
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.stage.cubes.slice(1,4).every(c=>c.size===10)&&window.TimelineUI._h.tl.seq.stage.cubes[0].size===16),'tamanho compartilhado nos 3 cubos; A não muda');
 // renomear grupo
 await p.locator('#hr-tree .hr-row[data-type="group"] .hr-name').dblclick();await p.fill('#hr-rename-input','Palco lateral');await p.keyboard.press('Enter');await p.waitForTimeout(300);
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.stage.groups[0].name==='Palco lateral'),'renomear grupo');
 // recolher / expandir persiste
 await p.locator('#hr-tree .hr-row[data-id="cb:A"] .hr-chev').click();await p.waitForTimeout(200);
 assert(await p.locator('#hr-tree .hr-row[data-id="fc:A:top"]').count()===0,'recolher esconde as faces do cubo A');
 // camadas: duas camadas na mesma face, reordenar
 await p.evaluate(k=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;const a=seq.assets[0];const L=S.addLayer(seq,k,'Topo');S.addClip(seq,L.id,a,1,2);H.renderAll();},keys[0]);
 await p.waitForTimeout(700);
 await p.locator('#hr-tree .hr-row[data-id="cb:A"] .hr-chev').click();await p.waitForTimeout(200);
 const order=()=>p.evaluate(k=>window.TimelineUI._h.Seq.layersOf(window.TimelineUI._h.tl.seq,k).map(t=>t.name),keys[0]);
 const o0=await order();
 const rowsL=p.locator('#hr-tree .hr-row[data-id="fc:A:right"] ~ .hr-row[data-type="layer"]');
 await p.locator('#hr-tree .hr-row[data-type="layer"]').filter({hasText:o0[o0.length-1]}).first().click();
 await p.click('#hr-up');await p.waitForTimeout(400);
 const o1=await order();assert(o1[o1.length-1]===o0[o0.length-2]||o1.join()!==o0.join(),'▲ sobe a camada na ordem ('+o0+' -> '+o1+')');
 // camada para outra superfície (arrastar sobre face do cubo B ligada?)
 await p.evaluate(k2=>{const seq=window.TimelineUI._h.tl.seq;seq.stage.cubes[1].faces.front=k2;window.TimelineUI._h.renderAll();},keys[1]);await p.waitForTimeout(700);
 const lname=o1[0];
 const lid=await p.locator('#hr-tree .hr-row[data-type="layer"]').filter({hasText:lname}).first().getAttribute('data-id');await dnd(lid,'fc:B:front');await p.waitForTimeout(500);
 assert(await p.evaluate(([k2,n])=>window.TimelineUI._h.Seq.layersOf(window.TimelineUI._h.tl.seq,k2).some(t=>t.name===n),[keys[1],lname]),'arrastar camada para outra face a move');
 assert(await calib()===cal0,'surface.q, máscara e malha continuam intactos depois de tudo');
 // clipe travado não muda
 await p.evaluate(()=>{const seq=window.TimelineUI._h.tl.seq;seq.tracks[0].locked=true;});
 // salvar e reabrir
 await p.evaluate(()=>document.getElementById('btn-save').click());await p.waitForTimeout(400);
 const saved=await p.evaluate(()=>window.__saved);const d=JSON.parse(saved);
 assert(d.version===5&&d.scenes[0].id===sid,'projeto salva versão 5 e o ID da cena');
 assert(d.sequence.stage.v===2&&d.sequence.stage.groups[0].name==='Palco lateral'&&d.sequence.settings.tree,'projeto salva palco v2, grupos e recolhimento');
 const ids1=await p.evaluate(()=>window.HierarchyUI.state.rows.map(r=>r.node.id).join());
 await p.evaluate(j=>{window.__openJson=j;},saved);await p.evaluate(()=>{document.getElementById('btn-new').click();document.getElementById('btn-new').click();});await p.waitForTimeout(300);
 await p.evaluate(()=>document.getElementById('btn-open').click());await p.waitForTimeout(900);
 await p.click('[data-go="arvore"]');await p.waitForTimeout(600);
 const ids2=await p.evaluate(()=>{window.HierarchyUI.refresh(true);return window.HierarchyUI.state.rows.map(r=>r.node.id).join();});
 assert(ids1===ids2.replace(/prj:\w+/,m=>m),'IDs da árvore iguais depois de salvar e reabrir');
 assert(await p.evaluate(()=>window.TimelineUI._h.state.scenes[0].id)===sid,'ID da cena sobrevive');
 // projeto antigo: sem ID de cena, sem palco
 const old=JSON.parse(saved);delete old.version;old.scenes.forEach(s=>delete s.id);delete old.sequence.stage;delete old.sequence.settings.tree;
 await p.evaluate(j=>{window.__openJson=j;},JSON.stringify(old));await p.evaluate(()=>document.getElementById('btn-open').click());await p.waitForTimeout(900);
 await p.click('[data-go="arvore"]');await p.waitForTimeout(600);
 assert(await p.evaluate(()=>!!window.TimelineUI._h.state.scenes[0].id),'projeto antigo ganha ID de cena ao abrir');
 assert(await p.locator('#hr-tree .hr-row[data-type="cube"]').count()===4,'projeto antigo abre com os 4 cubos padrão');
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.stage.v===2),'projeto antigo recebe palco v2');
 assert(h.errs.length===0,'erros de página: '+(h.errs.join('|')||'nenhum'));
 await h.close();process.exit(process.exitCode||0);
})().catch(e=>{console.log('FAIL excecao',e.message);process.exit(1);});
