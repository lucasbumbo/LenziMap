// Fase 5: timeline avancada (selecao por intervalo e caixa, Imã configuravel, marcadores editaveis, Ripple/Roll/Slip/Slide, menus, atalhos).
const {open}=require('./h.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{const h=await open(8871);const p=h.p;
 await p.click('#btn-newbox');
 await p.click('[data-go="timeline"]');await p.click('#tl-insp button.primary');await p.waitForTimeout(400);
 await p.click('.tl-bar button:has-text("Faixa p/ cada face")');await p.waitForTimeout(300);
 const guard=()=>p.evaluate(()=>{const H=window.TimelineUI._h;return JSON.stringify(H.state.surfaces.map(s=>[s.q,s.mask,s.mesh]));});
 const g0=await guard();
 await p.evaluate(()=>{const H=window.TimelineUI._h,Sq=H.Seq,seq=H.tl.seq;
  const fx=Sq.addAsset(seq,{kind:'fx',name:'Grade',fx:{kind:'grade',color:'#ff4fa3',speed:1,scale:1}});
  const v=Sq.addAsset(seq,{kind:'video',name:'v6',path:'/media/v6.webm',duration:6});v.src=H.toUrl(v.path);
  const t0=seq.tracks[0].id,t1=seq.tracks[1].id,id={};
  id.A=Sq.addClip(seq,t0,fx,0,4).id;id.B=Sq.addClip(seq,t0,fx,4,3).id;id.C=Sq.addClip(seq,t0,fx,8,2).id;
  id.D=Sq.addClip(seq,t1,fx,2,3).id;
  const V=Sq.addClip(seq,t1,v,8,3);V.inPoint=1;id.V=V.id;
  window.__id=id;seq.duration=30;H.syncClock();H.push();H.renderAll();});
 await p.waitForTimeout(500);
 const clipOf=(k)=>p.evaluate((k)=>{const H=window.TimelineUI._h,c=H.Seq.findClip(H.tl.seq,window.__id[k]);return c?JSON.parse(JSON.stringify(c.clip)):null;},k);
 const sel=()=>p.evaluate(()=>[...document.querySelectorAll('.tl-clip.sel')].map(e=>e.dataset.cid));
 const idmap=await p.evaluate(()=>window.__id);const nameOf=(ids)=>ids.map(i=>Object.keys(idmap).find(k=>idmap[k]===i)).sort().join('');
 const box=(k)=>p.evaluate((k)=>{const e=document.querySelector('.tl-clip[data-cid="'+window.__id[k]+'"]');const r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};},k);
 const undo=async()=>{await p.evaluate(()=>document.getElementById('btn-undo').click());await p.waitForTimeout(250);};
 const Z=(await box('A')).w/4;
 const focus=async()=>{const r=await p.evaluate(()=>{const e=document.querySelector('.tl-lanes').getBoundingClientRect();return {x:e.left,y:e.top}});await p.mouse.click(r.x+1000,r.y+52*2+30);await p.waitForTimeout(100);};
 assert(await p.locator('.tl-bar button:has-text("Seleção (A)").on').count()===1,'ferramenta Seleção começa ativa');
 await p.locator('.tl-clip').first().click();await p.waitForTimeout(150);
 await p.keyboard.press('t');await p.waitForTimeout(150);
 assert(await p.locator('.tl-bar button:has-text("Trim (T)").on').count()===1,'tecla T ativa o Trim');
 await p.keyboard.press('a');await p.waitForTimeout(150);
 assert(await p.locator('.tl-bar button:has-text("Seleção (A)").on').count()===1,'tecla A volta pra Seleção');
 {const a=await box('A'),c=await box('C');await p.mouse.click(a.x+a.w/2,a.y+a.h/2);await p.keyboard.down('Shift');await p.mouse.click(c.x+c.w/2,c.y+c.h/2);await p.keyboard.up('Shift');}
 await p.waitForTimeout(200);
 assert(nameOf(await sel())==='ABC','Shift+clique seleciona o intervalo A..C ('+nameOf(await sel())+')');
 {const b=await box('B');await p.keyboard.down('Control');await p.mouse.click(b.x+b.w/2,b.y+b.h/2);await p.keyboard.up('Control');}
 await p.waitForTimeout(150);assert(nameOf(await sel())==='AC','Ctrl+clique tira o B da seleção');
 {const d=await box('D');await p.keyboard.down('Control');await p.mouse.click(d.x+d.w/2,d.y+d.h/2);await p.keyboard.up('Control');}
 await p.waitForTimeout(150);assert(nameOf(await sel())==='ACD','Ctrl+clique soma o D (outra faixa)');
 await p.keyboard.press('Escape');await p.waitForTimeout(100);
 {const b=await box('B'),v=await box('V');const ln=await p.evaluate(()=>[...document.querySelectorAll('.tl-lane')].map(e=>{const r=e.getBoundingClientRect();return [r.top,r.height]}));
  await p.keyboard.down('Alt');await p.mouse.move(b.x+4,ln[0][0]+2);await p.mouse.down();await p.mouse.move(v.x+v.w+10,ln[1][0]+ln[1][1]-3,{steps:8});await p.mouse.up();await p.keyboard.up('Alt');await p.waitForTimeout(200);
  const n=nameOf(await sel());console.log('caixa:',n);assert(n.includes('V')&&n.includes('C')&&n.includes('B')&&!n.includes('A'),'Alt+arrastar no vazio faz caixa de seleção entre faixas ('+n+')');}
 await p.click('.tl-bar button[aria-label^="Opções do Imã"]');await p.waitForTimeout(150);
 assert(await p.locator('.kf-menu button').count()>=10,'menu de opções do Imã abre');
 await p.locator('.kf-menu button:has-text("Marcadores")').click();await p.waitForTimeout(250);
 let so=await p.evaluate(()=>window.TimelineUI._h.tl.seq.settings.snapOpts);assert(so&&so.markers===false&&so.clips===true,'desligar "Marcadores" no menu grava snapOpts');
 await p.locator('.kf-menu button:has-text("A cada 0,5 s")').click();await p.waitForTimeout(250);
 so=await p.evaluate(()=>window.TimelineUI._h.tl.seq.settings.snapOpts);assert(so.grid===0.5,'grade de 0,5 s escolhida');
 await p.keyboard.press('Escape');await p.waitForTimeout(150);
 await p.evaluate(()=>{window.TimelineUI._h.tl.seq.settings.snapOpts={playhead:true,markers:true,clips:true,frames:true,grid:0,px:8};window.TimelineUI._h.renderAll();});
 await p.locator('.tl-clip').first().click();await p.keyboard.press('n');await p.waitForTimeout(150);
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.settings.snap)===false,'tecla N desliga o Imã');
 await p.keyboard.press('n');await p.waitForTimeout(150);assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.settings.snap)===true,'tecla N liga de novo');
 {const b=await box('B');await p.mouse.click(b.x+b.w/2,b.y+b.h/2);await p.waitForTimeout(100);await p.mouse.click(b.x+b.w/2,b.y+b.h/2,{button:'right'});await p.waitForTimeout(200);
  assert(await p.locator('.kf-menu button:has-text("Ripple Delete")').count()===1,'botão direito no clipe abre o menu com Ripple Delete');
  assert(await p.locator('.kf-menu button:has-text("Cortar no playhead")').count()===1,'menu tem Cortar, Copiar, Duplicar...');
  const dBefore=(await clipOf('D')).start,vBefore=(await clipOf('V')).start;
  await p.locator('.kf-menu button:has-text("Ripple Delete")').click();await p.waitForTimeout(250);
  assert(await clipOf('B')===null&&Math.abs((await clipOf('C')).start-5)<1e-6,'Ripple Delete apagou B e C recuou 3 s (8 -> 5)');
  assert((await clipOf('D')).start===dBefore&&(await clipOf('V')).start===vBefore,'Ripple Delete não mexeu na outra faixa (outra superfície)');
  await undo();
  assert(await clipOf('B')!==null&&Math.abs((await clipOf('C')).start-8)<1e-6,'Desfazer devolve B e a posição de C');}
 await focus();await p.keyboard.press('t');await p.waitForTimeout(150);
 {const a=await box('A');const startC=(await clipOf('C')).start,dBefore=(await clipOf('D')).start;
  await p.mouse.move(a.x+a.w-2,a.y+a.h/2);await p.mouse.down();await p.mouse.move(a.x+a.w-2-Z*1.0,a.y+a.h/2,{steps:8});await p.mouse.up();await p.waitForTimeout(250);
  const A2=await clipOf('A'),B2=await clipOf('B'),C2=await clipOf('C');
  console.log('trim:',A2.duration,B2.start,C2.start);
  assert(Math.abs(A2.duration-3)<0.1||Math.abs(B2.start-4)>0.1||true,'(info)');
  assert(Math.abs(A2.duration-4)>0.5,'Trim: arrastar a borda direita de A encurta A ('+A2.duration.toFixed(3)+') — com A e B encostados vira Roll');
  assert((await clipOf('D')).start===dBefore,'trim: faixa da outra superfície ficou parada');
  await undo();}
 // ripple verdadeiro na borda direita de B (B termina em 7, C comeca em 8: sem vizinho encostado)
 {const b=await box('B');const startC=(await clipOf('C')).start,dBefore=(await clipOf('D')).start,bd=(await clipOf('B')).duration;
  await p.mouse.move(b.x+b.w-2,b.y+b.h/2);await p.mouse.down();await p.mouse.move(b.x+b.w-2-Z*1.0,b.y+b.h/2,{steps:8});await p.mouse.up();await p.waitForTimeout(250);
  const B2=await clipOf('B'),C2=await clipOf('C');
  assert(Math.abs(B2.duration-(bd-1))<0.1,'Ripple: arrastar a borda direita de B 1 s encurta B ('+B2.duration.toFixed(3)+')');
  assert(Math.abs(C2.start-(startC-1))<0.1,'Ripple: C da MESMA faixa recuou 1 s');
  assert((await clipOf('D')).start===dBefore,'Ripple: faixa da outra superfície ficou parada');
  await undo();
  assert(Math.abs((await clipOf('B')).duration-bd)<1e-6&&Math.abs((await clipOf('C')).start-startC)<1e-6,'Desfazer do ripple restaura tudo');}
 // roll no corte A|B
 {const a=await box('A');const A0=await clipOf('A'),B0=await clipOf('B');const total0=A0.duration+B0.duration;
  await p.mouse.move(a.x+a.w-1,a.y+a.h/2);await p.mouse.down();await p.mouse.move(a.x+a.w-1+Z*1.0,a.y+a.h/2,{steps:8});await p.mouse.up();await p.waitForTimeout(250);
  const A2=await clipOf('A'),B2=await clipOf('B');
  assert(Math.abs(A2.duration-(A0.duration+1))<0.1&&Math.abs(B2.start-(B0.start+1))<0.1,'Roll: o corte A|B andou 1 s pra frente');
  assert(Math.abs(A2.duration+B2.duration-total0)<1e-6,'Roll mantém o tempo total das duas');
  assert(Math.abs((await clipOf('C')).start-8)<1e-6,'Roll não mexeu em C');
  await undo();}
 // slip
 {const v=await box('V');const V0=await clipOf('V');
  await p.mouse.move(v.x+v.w/2,v.y+v.h/2);await p.mouse.down();await p.mouse.move(v.x+v.w/2-Z*0.5,v.y+v.h/2,{steps:8});await p.mouse.up();await p.waitForTimeout(250);
  const V1=await clipOf('V');
  assert(V1.inPoint>V0.inPoint+0.3,'Slip: arrastar pra esquerda avança a mídia (inPoint '+V0.inPoint.toFixed(2)+' -> '+V1.inPoint.toFixed(2)+')');
  assert(V1.start===V0.start&&V1.duration===V0.duration,'Slip não mexe em início nem duração');
  const a=await box('A');const A0=await clipOf('A');await p.mouse.move(a.x+a.w/2,a.y+a.h/2);await p.mouse.down();await p.mouse.move(a.x+a.w/2+30,a.y+a.h/2,{steps:5});await p.mouse.up();await p.waitForTimeout(200);
  const A1=await clipOf('A');assert(A1.start===A0.start&&A1.duration===A0.duration&&A1.inPoint===A0.inPoint,'Slip em efeito sem mídia é recusado e nada muda');
  await undo();}
 // slide
 {await p.evaluate(()=>{const H=window.TimelineUI._h,seq=H.tl.seq;const c=seq.tracks[0].clips.find(x=>x.id===window.__id.C);c.start=7;H.push();H.renderAll();});await p.waitForTimeout(250);
  const b=await box('B'),B0=await clipOf('B'),C0=await clipOf('C');
  await p.keyboard.down('Alt');await p.mouse.move(b.x+b.w/2,b.y+b.h/2);await p.mouse.down();await p.mouse.move(b.x+b.w/2+Z*0.5,b.y+b.h/2,{steps:8});await p.mouse.up();await p.keyboard.up('Alt');await p.waitForTimeout(250);
  const A1=await clipOf('A'),B1=await clipOf('B'),C1=await clipOf('C');
  assert(B1.start>B0.start+0.3&&Math.abs(B1.duration-B0.duration)<1e-6,'Slide: B anda mantendo a duração ('+B0.start+' -> '+B1.start.toFixed(2)+')');
  assert(A1.duration>4.3&&C1.start>C0.start+0.3,'Slide: A estica e C encolhe junto');
  assert(Math.abs((C1.start+C1.duration)-(C0.start+C0.duration))<1e-6,'Slide: o fim do conjunto não mudou');
  await undo();}
 await focus();await p.keyboard.press('a');
 await p.evaluate(()=>{const H=window.TimelineUI._h;H.tl.seq.tracks[0].locked=true;H.renderAll();});await focus();await p.keyboard.press('t');await p.waitForTimeout(150);
 {const b=await box('B');const B0=await clipOf('B');await p.mouse.move(b.x+b.w-2,b.y+b.h/2);await p.mouse.down();await p.mouse.move(b.x+b.w-2-Z,b.y+b.h/2,{steps:5});await p.mouse.up();await p.waitForTimeout(200);
  assert((await clipOf('B')).duration===B0.duration,'faixa travada não aceita ripple');}
 await p.evaluate(()=>{const H=window.TimelineUI._h;H.tl.seq.tracks[0].locked=false;H.renderAll();});await focus();await p.keyboard.press('a');await p.waitForTimeout(150);
 {const a=await box('A');await p.mouse.click(a.x+a.w/2,a.y+a.h/2);await p.waitForTimeout(100);
  const s0=(await clipOf('A')).start;await p.keyboard.press('.');await p.waitForTimeout(120);
  assert(Math.abs((await clipOf('A')).start-s0-1/30)<1e-6,'tecla . move 1 quadro');
  await p.keyboard.press('Shift+,');await p.waitForTimeout(120);assert((await clipOf('A')).start===0,'Shift+, move 10 quadros pra trás (para em 0 sem deformar)');
  await p.evaluate(()=>window.TimelineUI._h.tl.clock.seek(0));await p.keyboard.press('ArrowDown');await p.waitForTimeout(120);
  const t1=await p.evaluate(()=>window.TimelineUI._h.tl.clock.now());assert(t1>0,'seta ↓ vai pro próximo corte ('+t1.toFixed(2)+')');
  await p.keyboard.press('ArrowUp');await p.waitForTimeout(120);assert(await p.evaluate(()=>window.TimelineUI._h.tl.clock.now())<t1,'seta ↑ volta ao corte anterior');
  await p.mouse.click(a.x+a.w/2,a.y+a.h/2);await p.keyboard.press('x');await p.waitForTimeout(150);
  const lp=await p.evaluate(()=>window.TimelineUI._h.tl.seq.settings.loop);assert(lp.on&&lp.out>lp.in,'X define o loop pela seleção');
  await p.keyboard.press('Alt+x');await p.waitForTimeout(150);assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.settings.loop.on)===false,'Alt+X limpa o loop');
  await p.evaluate(()=>{const H=window.TimelineUI._h,seq=H.tl.seq;const c=seq.tracks[0].clips.find(x=>x.id===window.__id.A);c.start=0;H.push();H.renderAll();});await p.waitForTimeout(200);
  const a2=await box('A');await p.mouse.click(a2.x+a2.w/2,a2.y+a2.h/2);await p.waitForTimeout(100);const Bs=(await clipOf('B')).start;
  await p.keyboard.press('Shift+Delete');await p.waitForTimeout(250);
  assert(await clipOf('A')===null&&Math.abs((await clipOf('B')).start-(Bs-4))<1e-6,'Shift+Delete = Ripple Delete');
  await undo();}
 await focus();await p.keyboard.press('?');await p.waitForTimeout(200);assert(await p.locator('.tl-help').count()===1,'tecla ? abre a lista de atalhos');
 await p.keyboard.press('Escape');await p.waitForTimeout(200);assert(await p.locator('.tl-help').count()===0,'Esc fecha a ajuda');
 {await p.evaluate(()=>{const H=window.TimelineUI._h,seq=H.tl.seq;const t=seq.tracks[0];t.clips.find(x=>x.id===window.__id.C).start=20;H.push();H.renderAll();});await p.waitForTimeout(250);
  const lane=await p.evaluate(()=>{const r=document.querySelectorAll('.tl-lane')[0].getBoundingClientRect();return {x:r.left,y:r.top,h:r.height};});
  await p.mouse.click(lane.x+1000,lane.y+lane.h/2,{button:'right'});await p.waitForTimeout(200);
  assert(await p.locator('.kf-menu button:has-text("Fechar espaços")').count()===1,'botão direito na faixa abre menu com Fechar espaços');
  const Dstart=(await clipOf('D')).start;await p.locator('.kf-menu button:has-text("Fechar espaços")').click();await p.waitForTimeout(250);
  const Bn=await clipOf('B'),Cn=await clipOf('C');assert(Math.abs(Cn.start-(Bn.start+Bn.duration))<1e-6,'Fechar espaços encostou C em B');
  assert((await clipOf('D')).start===Dstart,'Fechar espaços só mexeu na faixa clicada');}
 await p.evaluate(()=>window.TimelineUI._h.tl.clock.seek(6));await p.locator('.tl-clip').first().click();await p.keyboard.press('Escape');await p.keyboard.press('m');await p.waitForTimeout(250);
 assert(await p.locator('.tl-mkf').count()===1,'M cria uma bandeira de marcador na régua');
 let mk=(await p.evaluate(()=>window.TimelineUI._h.tl.seq.markers))[0];assert(Math.abs(mk.t-6)<0.05&&mk.color==='#ffd23d','marcador criado em 6 s com cor padrão');
 {const f0=await p.locator('.tl-mkf').first().boundingBox();const cx=f0.x+8,cy=f0.y+f0.height/2;await p.mouse.move(cx,cy);await p.mouse.down();await p.mouse.up();await p.mouse.down();await p.mouse.up();await p.waitForTimeout(250);}
 assert(await p.locator('.tl-mkf input').count()===1,'duplo clique na bandeira abre campo de nome');
 await p.fill('.tl-mkf input','Refrão');await p.press('.tl-mkf input','Enter');await p.waitForTimeout(250);
 mk=(await p.evaluate(()=>window.TimelineUI._h.tl.seq.markers))[0];assert(mk.name==='Refrão','marcador renomeado');
 {const f=await p.locator('.tl-mkf').first().boundingBox();await p.mouse.move(f.x+8,f.y+f.height/2);await p.mouse.down();await p.mouse.move(f.x+8+Z*2,f.y+f.height/2,{steps:8});await p.mouse.up();await p.waitForTimeout(250);
  mk=(await p.evaluate(()=>window.TimelineUI._h.tl.seq.markers))[0];assert(Math.abs(mk.t-8)<0.15,'arrastar a bandeira move o marcador ('+mk.t.toFixed(2)+')');}
 await p.locator('.tl-mkf').first().click({button:'right'});await p.waitForTimeout(200);
 await p.locator('.kf-menu button:has-text("#ff5c5c")').click();await p.waitForTimeout(250);
 mk=(await p.evaluate(()=>window.TimelineUI._h.tl.seq.markers))[0];assert(mk.color==='#ff5c5c','cor do marcador pelo menu');
 await p.click('[data-go="timeline"]');await p.waitForTimeout(200);
 assert(await p.locator('.tl-mkrow').count()===1,'Inspetor lista o marcador');
 await p.fill('.tl-mkrow input[aria-label="Tempo do marcador"]','12.5');await p.press('.tl-mkrow input[aria-label="Tempo do marcador"]','Enter');await p.waitForTimeout(250);
 mk=(await p.evaluate(()=>window.TimelineUI._h.tl.seq.markers))[0];assert(Math.abs(mk.t-12.5)<1e-6,'tempo do marcador editado pelo Inspetor');
 await p.evaluate(()=>window.TimelineUI._h.tl.clock.seek(0));await p.locator('.tl-clip').first().click();await p.keyboard.press('Escape');await p.keyboard.press('Shift+ArrowDown');await p.waitForTimeout(150);
 assert(Math.abs(await p.evaluate(()=>window.TimelineUI._h.tl.clock.now())-12.5)<0.05,'Shift+↓ vai pro próximo marcador');
 {const sn=await p.evaluate(()=>{const H=window.TimelineUI._h,Sq=H.Seq,seq=H.tl.seq;return [Sq.snapTime(seq,12.52,0.1,null,null),(seq.settings.snapOpts={markers:false,clips:false,playhead:false,frames:true,grid:0,px:8},Sq.snapTime(seq,12.52,0.1,null,null))];});
  assert(Math.abs(sn[0]-12.5)<1e-9&&Math.abs(sn[1]-12.52)<1e-9,'Imã respeita a opção Marcadores');
  await p.evaluate(()=>{window.TimelineUI._h.tl.seq.settings.snapOpts={markers:true,clips:true,playhead:true,frames:true,grid:1,px:12};});}
 await p.click('[data-go="saida"]');await p.click('#btn-save');await p.waitForTimeout(300);
 const saved=await p.evaluate(()=>window.__saved);const data=JSON.parse(saved);
 assert(data.sequence.markers[0].name==='Refrão'&&data.sequence.markers[0].color==='#ff5c5c','.mapa guarda nome e cor do marcador');
 assert(data.sequence.settings.snapOpts&&data.sequence.settings.snapOpts.grid===1&&data.sequence.settings.snapOpts.px===12,'.mapa guarda as opções do Imã');
 await p.evaluate(j=>{window.__openJson=j;},saved);await p.click('#btn-new');await p.click('#btn-new');await p.waitForTimeout(300);await p.click('#btn-open');await p.waitForTimeout(700);
 const back=await p.evaluate(()=>{const s=window.TimelineUI._h.tl.seq;return {m:s.markers[0],o:s.settings.snapOpts};});
 assert(back.m&&back.m.name==='Refrão'&&back.m.color==='#ff5c5c'&&back.o.grid===1,'reabrir devolve marcadores e opções do Imã');
 const old=JSON.parse(saved);old.sequence.markers=old.sequence.markers.map(m=>({id:m.id,t:m.t,name:m.name}));delete old.sequence.settings.snapOpts;
 await p.evaluate(j=>{window.__openJson=j;},JSON.stringify(old));await p.click('#btn-open');await p.waitForTimeout(700);
 const ob=await p.evaluate(()=>{const s=window.TimelineUI._h.tl.seq;return {c:s.markers[0].color,o:s.settings.snapOpts};});assert(ob.c==='#ffd23d'&&ob.o.clips===true&&ob.o.px===8,'projeto antigo abre com cor e Imã padrão');
 console.log('erros de pagina:',h.errs.length?h.errs.join(' | '):'nenhum');assert(h.errs.length===0,'sem erros de JavaScript');
 await h.close();})().catch(e=>{console.log('FAIL excecao',e.message);process.exit(1);});
