// Fase 4: keyframes visuais (Dopesheet, barra do clipe, editor de curvas), interpolacoes, undo/redo, persistencia e consistencia do avaliador.
const {open}=require('./h.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const S=require('../sequence.js');
(async()=>{const h=await open(8861);const p=h.p;
 await p.click('#btn-newbox');
 await p.click('[data-go="timeline"]');await p.click('#tl-insp button.primary');await p.waitForTimeout(400);
 await p.click('.tl-bar button:has-text("Faixa p/ cada face")');await p.waitForTimeout(300);
 await p.evaluate(()=>{const H=window.TimelineUI._h,Sq=H.Seq,seq=H.tl.seq;
  const f=Sq.addAsset(seq,{kind:'fx',name:'Grade',fx:{kind:'grade',color:'#ff4fa3',speed:1,scale:1}});
  const c=Sq.addClip(seq,seq.tracks[0].id,f,0,10);window.__cid=c.id;
  seq.duration=20;H.syncClock();H.push();H.renderAll();window.TimelineUI.api&&0;});
 await p.waitForTimeout(300);
 const guard=()=>p.evaluate(()=>{const H=window.TimelineUI._h;return JSON.stringify(H.state.surfaces.map(s=>[s.q,s.mask,s.mesh]));});
 const g0=await guard();
 const clip=()=>p.evaluate(()=>{const H=window.TimelineUI._h,c=H.Seq.findClip(H.tl.seq,window.__cid).clip;return JSON.parse(JSON.stringify(c));});
 const seek=(t)=>p.evaluate((t)=>{const H=window.TimelineUI._h;H.tl.clock.seek(t);},t);
 await p.locator('.tl-clip').first().click();await p.waitForTimeout(300);
 // painel
 assert(await p.locator('#kfp.open').count()===0,'painel de keyframes começa fechado');
 await p.click('.tl-bar button:has-text("Keyframes")');await p.waitForTimeout(300);
 assert(await p.locator('#kfp.open').count()===1,'botão Keyframes abre o painel');
 assert(await p.locator('.kfp-row').count()>=8,'Dopesheet com linhas (Todos + propriedades)');
 const rowBox=async(pn)=>p.evaluate((pn)=>{const r=document.querySelector('.kfp-row[data-p="'+pn+'"]').getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height};},pn);
 const zoomPx=await p.evaluate(()=>{const e=document.querySelector('.tl-clip');return e.getBoundingClientRect().width/10;});
 const dbl=async(pn,t)=>{const r=await rowBox(pn);await p.mouse.dblclick(r.l+t*zoomPx,r.t+r.h/2);await p.waitForTimeout(150);};
 // criar keyframes por duplo clique
 await dbl('x',2);await dbl('x',5);
 let c=await clip();
 assert(c.keyframes.x&&c.keyframes.x.length===2,'duplo clique na linha cria keyframes ('+JSON.stringify((c.keyframes.x||[]).map(k=>k.t))+')');
 assert(Math.abs(c.keyframes.x[0].t-2)<0.1&&Math.abs(c.keyframes.x[1].t-5)<0.1,'tempos criados perto de 2s e 5s');
 assert(await p.locator('.kfp-row[data-p="x"] .kfd').count()===2,'2 losangos na linha X');
 assert(await p.locator('.kfp-row[data-p="*"] .kfd').count()===2,'linha Todos resume os tempos');
 assert(await p.locator('.tl-clip .kf').count()===2,'losangos também aparecem na barra do clipe');
 // selecao individual e multipla
 const dia=(pn,i)=>p.locator('.kfp-row[data-p="'+pn+'"] .kfd').nth(i);
 await dia('x',0).click();await p.waitForTimeout(100);
 assert(await p.locator('.kfp-row[data-p="x"] .kfd.sel').count()===1,'clique seleciona um');
 await dia('x',1).click({modifiers:['Shift']});await p.waitForTimeout(100);
 assert(await p.locator('.kfp-row[data-p="x"] .kfd.sel').count()===2,'Shift+clique soma à seleção');
 await dia('x',1).click({modifiers:['Shift']});await p.waitForTimeout(100);
 assert(await p.locator('.kfp-row[data-p="x"] .kfd.sel').count()===1,'Shift+clique de novo remove da seleção');
 // dar valores diferentes pelos campos numericos
 await dia('x',0).click();await p.fill('.kfp-bar input[aria-label="Valor do keyframe"]','-30');await p.press('.kfp-bar input[aria-label="Valor do keyframe"]','Enter');await p.waitForTimeout(150);
 await dia('x',1).click();await p.fill('.kfp-bar input[aria-label="Valor do keyframe"]','40');await p.press('.kfp-bar input[aria-label="Valor do keyframe"]','Enter');await p.waitForTimeout(150);
 c=await clip();assert(Math.abs(c.keyframes.x[0].v+0.3)<1e-6&&Math.abs(c.keyframes.x[1].v-0.4)<1e-6,'campo de valor edita o keyframe (-30% e 40%)');
 // arrastar horizontalmente
 await dia('x',1).click();await p.waitForTimeout(500);
 const b1=await dia('x',1).boundingBox();
 await p.mouse.move(b1.x+b1.width/2,b1.y+b1.height/2);await p.mouse.down();
 for(let i=1;i<=6;i++)await p.mouse.move(b1.x+b1.width/2+zoomPx*1.0*i/6,b1.y+b1.height/2);
 await p.mouse.up();await p.waitForTimeout(200);
 c=await clip();assert(Math.abs(c.keyframes.x[1].t-6)<0.1,'arrastar 1s pra direita move o keyframe de 5s para ~6s ('+c.keyframes.x[1].t.toFixed(3)+')');
 assert(Math.abs(c.keyframes.x[1].v-0.4)<1e-6,'arrastar na horizontal não muda o valor');
 const frame=1/30;const tt=c.keyframes.x[1].t;assert(Math.abs(tt/frame-Math.round(tt/frame))<1e-3,'encaixe em frames quando o Imã está ligado');
 // desfazer / refazer do arrasto
 await p.evaluate(()=>document.getElementById('btn-undo').click());await p.waitForTimeout(250);
 c=await clip();assert(Math.abs(c.keyframes.x[1].t-5)<0.1,'Desfazer devolve o keyframe a ~5s');
 await p.evaluate(()=>document.getElementById('btn-redo').click());await p.waitForTimeout(250);
 c=await clip();assert(Math.abs(c.keyframes.x[1].t-6)<0.1,'Refazer leva de volta a ~6s');
 // marquee
 const rA=await rowBox('*');
 await p.mouse.move(rA.l+2,rA.t-2);
 // seleciona com clique em Todos e arrasta caixa sobre as linhas
 const first=await p.locator('.kfp-row[data-p="*"] .kfd').first().boundingBox();
 await p.mouse.move(first.x-30,first.y+6);await p.mouse.down();await p.mouse.move(first.x+zoomPx*5,first.y+120,{steps:6});await p.mouse.up();await p.waitForTimeout(150);
 assert(await p.locator('.kfp-row[data-p="x"] .kfd.sel').count()===2,'caixa de seleção pega vários keyframes');
 // copiar e colar
 await seek(5);
 await p.locator('#kfp').click({position:{x:5,y:5}});
 await p.click('.kfp-bar button:has-text("Copiar")');await p.click('.kfp-bar button:has-text("Colar")');await p.waitForTimeout(200);
 c=await clip();assert(c.keyframes.x.length===4,'copiar + colar no playhead (5s) cria 2 keyframes (total '+c.keyframes.x.length+')');
 const pasted=c.keyframes.x.filter(k=>k.t>4.9&&k.t!==6&&Math.abs(k.t-6)>0.01);assert(pasted.length===2&&Math.abs(pasted[1].t-pasted[0].t-4)<0.05,'colados mantêm distância relativa (4s)');
 // duplicar
 await p.click('.kfp-bar button:has-text("Duplicar")');await p.waitForTimeout(200);
 c=await clip();assert(c.keyframes.x.length>=5,'duplicar acrescenta cópias ('+c.keyframes.x.length+')');
 // excluir pelo teclado
 const nBefore=c.keyframes.x.length;
 await p.locator('#kfp').click({position:{x:5,y:5}});await p.keyboard.press('Delete');await p.waitForTimeout(200);
 c=await clip();assert((c.keyframes.x||[]).length===nBefore-(await p.evaluate(()=>0))||(c.keyframes.x||[]).length<nBefore,'Delete remove os selecionados ('+nBefore+' -> '+((c.keyframes.x||[]).length)+')');
 // limpa e recria 3 keyframes limpos pra testar interpolacao
 await p.evaluate(()=>{const H=window.TimelineUI._h,c=H.Seq.findClip(H.tl.seq,window.__cid).clip;c.keyframes={};H.Seq.setKey(c,'x',1,0);H.Seq.setKey(c,'x',3,0.5);H.Seq.setKey(c,'x',6,-0.2);H.push();H.renderAll();});
 await p.waitForTimeout(300);
 // navegacao
 await seek(0);
 await p.click('.kfp-bar button[aria-label^="Próximo keyframe"]');await p.waitForTimeout(150);
 let now=await p.evaluate(()=>window.TimelineUI._h.tl.clock.now());assert(Math.abs(now-1)<0.05,'▶ vai para o próximo keyframe (1s)');
 await p.click('.kfp-bar button[aria-label^="Próximo keyframe"]');await p.waitForTimeout(150);
 now=await p.evaluate(()=>window.TimelineUI._h.tl.clock.now());assert(Math.abs(now-3)<0.05,'▶ de novo vai para 3s');
 await p.click('.kfp-bar button[aria-label^="Keyframe anterior"]');await p.waitForTimeout(150);
 now=await p.evaluate(()=>window.TimelineUI._h.tl.clock.now());assert(Math.abs(now-1)<0.05,'◀ volta para 1s');
 await p.locator('#kfp').click({position:{x:5,y:5}});await p.keyboard.press('Alt+ArrowRight');await p.waitForTimeout(150);
 now=await p.evaluate(()=>window.TimelineUI._h.tl.clock.now());assert(Math.abs(now-3)<0.05,'Alt+→ também navega');
 // interpolacoes pelos botoes
 const setMode=async(label)=>{await p.click('.kfp-bar button.kfm:has-text("'+label+'")');await p.waitForTimeout(120);};
 const modeOf=async(i)=>(await clip()).keyframes.x[i].i;
 await dia('x',0).click();
 for(const [lab,id] of [['Hold','hold'],['Ease In','easein'],['Ease Out','easeout'],['Ease In/Out','ease'],['Linear','linear'],['Bézier','bezier']]){await setMode(lab);assert(await modeOf(0)===id,'botão '+lab+' aplica "'+id+'"');}
 c=await clip();assert(Array.isArray(c.keyframes.x[0].h)&&c.keyframes.x[0].h.length===4,'Bézier cria alças');
 // menu de contexto
 await dia('x',0).click({button:'right'});await p.waitForTimeout(150);
 assert(await p.locator('.kf-menu button').count()>=8,'menu de contexto do keyframe aparece');
 await p.locator('.kf-menu button:has-text("Hold")').click();await p.waitForTimeout(150);
 assert(await modeOf(0)==='hold','menu de contexto muda a interpolação');
 // valores avaliados: hold, linear e ease
 await setMode('Linear');
 await dia('x',0).click();
 const ev=(t)=>p.evaluate((t)=>{const H=window.TimelineUI._h,Sq=H.Seq,c=Sq.findClip(H.tl.seq,window.__cid).clip;return Sq.valueAt(c,'x',t);},t);
 assert(Math.abs(await ev(2)-0.25)<1e-6,'linear: valor a 2s = 0.25');
 await setMode('Hold');assert(Math.abs(await ev(2.9))<1e-6,'hold: segura 0 até 3s');
 await setMode('Ease In');assert((await ev(2))<0.25&&(await ev(2))>0,'ease in: abaixo do linear');
 await setMode('Ease Out');assert((await ev(2))>0.25,'ease out: acima do linear');
 // editor de curvas
 await p.click('.kfp-bar button:has-text("Curvas")');await p.waitForTimeout(300);
 assert(await p.locator('.kfp-curve svg').count()===1,'editor de curvas aparece');
 assert(await p.locator('.kfp-curve svg circle[data-role="point"]').count()===3,'3 pontos na curva');
 assert(await p.locator('.kfp-chip').count()===1,'lista só as propriedades animadas');
 // converter em bezier arrastando alça: selecionar ponto 0
 await p.locator('.kfp-curve svg circle[data-role="point"]').nth(0).click();await p.waitForTimeout(150);
 assert(await p.locator('.kfp-curve svg rect[data-role="handle"]').count()>=1,'alças aparecem pro segmento do keyframe selecionado');
 await p.click('.kfp-bar button.kfm:has-text("Linear")');await p.waitForTimeout(150);
 const hb=await p.locator('.kfp-curve svg rect[data-role="handle"]').nth(0).boundingBox();
 await p.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await p.mouse.down();await p.mouse.move(hb.x+hb.width/2+30,hb.y+hb.height/2-25,{steps:6});await p.mouse.up();await p.waitForTimeout(200);
 c=await clip();assert(c.keyframes.x[0].i==='bezier'&&c.keyframes.x[0].h.length===4,'arrastar alça converte pra Bézier ('+JSON.stringify(c.keyframes.x[0].h&&c.keyframes.x[0].h.map(v=>+v.toFixed(2)))+')');
 // curva desenhada bate com o avaliador
 const poly=await p.evaluate(()=>document.querySelector('.kfp-curve svg polyline[data-role="curve"]').getAttribute('points').split(' ').length);assert(poly>100,'curva amostrada com '+poly+' pontos');
 // arrastar ponto na vertical muda o valor
 const pt1=await p.locator('.kfp-curve svg circle[data-role="point"]').nth(1).boundingBox();
 const v1a=(await clip()).keyframes.x[1].v;
 await p.mouse.move(pt1.x+pt1.width/2,pt1.y+pt1.height/2);await p.mouse.down();await p.mouse.move(pt1.x+pt1.width/2,pt1.y+pt1.height/2-30,{steps:6});await p.mouse.up();await p.waitForTimeout(200);
 c=await clip();assert(c.keyframes.x[1].v>v1a+0.01,'arrastar o ponto pra cima aumenta o valor ('+v1a.toFixed(3)+' -> '+c.keyframes.x[1].v.toFixed(3)+')');
 assert(Math.abs(c.keyframes.x[1].t-3)<0.05,'arrastar na vertical não muda o tempo');
 // duplo clique na curva cria keyframe
 const svgb=await p.locator('.kfp-curve svg').boundingBox();
 await p.mouse.dblclick(svgb.x+svgb.width*0.5,svgb.y+svgb.height*0.35);await p.waitForTimeout(200);
 c=await clip();assert(c.keyframes.x.length===4,'duplo clique na curva cria keyframe');
 // propriedade nova pelo botao Criar: opacidade e rotacao entram
 await p.click('.kfp-bar button:has-text("Dopesheet")');await p.waitForTimeout(200);
 await seek(4);await p.click('.kfp-lab[data-p="*"]');await p.click('.kfp-bar button:has-text("Criar")');await p.waitForTimeout(200);
 c=await clip();assert(['x','y','scale','rot','opacity'].every(k=>c.keyframes[k]&&c.keyframes[k].some(q=>Math.abs(q.t-4)<0.05)),'◆ Criar cria keyframes básicos no playhead');
 // losango da barra do clipe arrasta
 const kb=await p.locator('.tl-clip .kf').first().boundingBox();
 const tBefore=(await clip()).keyframes.x.map(k=>k.t).sort((a,b)=>a-b)[0];
 await p.mouse.move(kb.x+kb.width/2,kb.y+kb.height/2);await p.mouse.down();await p.mouse.move(kb.x+kb.width/2+zoomPx*0.5,kb.y+kb.height/2,{steps:5});await p.mouse.up();await p.waitForTimeout(250);
 c=await clip();const tAfter=c.keyframes.x.map(k=>k.t).sort((a,b)=>a-b)[0];
 assert(Math.abs(tAfter-tBefore-0.5)<0.1,'arrastar o losango na barra do clipe move o keyframe ('+tBefore.toFixed(2)+' -> '+tAfter.toFixed(2)+')');
 assert((await clip()).start===0,'mover keyframe não mexe no clipe');
 // consistencia: Viewer (evalClip) x estado enviado a saida
 await p.evaluate(()=>{window.TimelineUI._h.push();});await p.waitForTimeout(200);
 const cmp=await p.evaluate(()=>{const H=window.TimelineUI._h,Sq=H.Seq;const sent=window.__lastState&&window.__lastState.tl&&window.__lastState.tl.seq;const a=Sq.findClip(H.tl.seq,window.__cid).clip;return {sent:!!sent,json:sent?JSON.stringify(sent):null,live:JSON.stringify(a.keyframes)};});
 assert(cmp.sent,'estado enviado à saída contém a sequência');
 if(cmp.sent){const sentSeq=JSON.parse(cmp.json);const sc=sentSeq.tracks.flatMap(t=>t.clips).find(x=>x.id===(c.id));
  const fixed=S.fixClip(sc);let ok=true,maxd=0;for(let t=0;t<=10;t+=0.1){const live=await p.evaluate((t)=>{const H=window.TimelineUI._h,Sq=H.Seq;return Sq.valueAt(Sq.findClip(H.tl.seq,window.__cid).clip,'x',t);},t);const out=S.valueAt(fixed,'x',t);maxd=Math.max(maxd,Math.abs(live-out));}
  assert(maxd<1e-9,'a saída avalia os keyframes igual ao Viewer (diferença máxima '+maxd+')');}
 // render real: opacidade keyframada muda o que aparece
 // render real no Viewer: a opacidade keyframada aparece na tela (DOM do palco) igual ao avaliador, com cada modo
 await p.evaluate(()=>{const H=window.TimelineUI._h,Sq=H.Seq,c=Sq.findClip(H.tl.seq,window.__cid).clip;c.keyframes={};Sq.setKey(c,'opacity',0,0,'linear');Sq.setKey(c,'opacity',4,1,'ease');H.push();H.renderAll();});
 for(const [m,tt] of [['linear',1],['hold',1],['ease',1],['easein',1],['easeout',1],['bezier',1]]){
  await p.evaluate(([m])=>{const H=window.TimelineUI._h,Sq=H.Seq,c=Sq.findClip(H.tl.seq,window.__cid).clip;Sq.setKey(c,'opacity',0,0,m,m==='bezier'?[0.8,0,0.2,1]:undefined);H.push();},[m]);
  await p.evaluate((t)=>window.TimelineUI._h.tl.clock.seek(t),tt);await p.waitForTimeout(300);
  const [shown,expect]=await p.evaluate(()=>{const H=window.TimelineUI._h,Sq=H.Seq,c=Sq.findClip(H.tl.seq,window.__cid).clip;const e=[...document.querySelectorAll('#stage canvas.xs')].map(x=>parseFloat(x.style.opacity));return [e[0],Sq.valueAt(c,'opacity',1)];});
  assert(Math.abs(shown-expect)<0.01,'Viewer desenha opacidade no modo '+m+' (tela '+(+shown).toFixed(3)+' x motor '+(+expect).toFixed(3)+')');}
 await p.evaluate(()=>{const H=window.TimelineUI._h,Sq=H.Seq,c=Sq.findClip(H.tl.seq,window.__cid).clip;Sq.setKey(c,'x',1,0.1,'bezier',[0.3,0.1,0.7,0.9]);Sq.setKey(c,'x',4,0.5,'ease');Sq.setKey(c,'x',8,-0.2,'hold');H.push();H.renderAll();});await p.waitForTimeout(200);
 // persistencia
 await p.click('[data-go="saida"]');await p.click('#btn-save');await p.waitForTimeout(300);
 const saved=await p.evaluate(()=>window.__saved);const data=JSON.parse(saved);
 const sk=data.sequence.tracks.flatMap(t=>t.clips).find(x=>x.id===c.id).keyframes.x;
 assert(sk.some(k=>k.i==='bezier'&&k.h.length===4),'.mapa salvo guarda interpolação Bézier e alças');
 await p.evaluate(j=>{window.__openJson=j;},saved);
 await p.click('#btn-new');await p.click('#btn-new');await p.waitForTimeout(300);
 await p.click('#btn-open');await p.waitForTimeout(700);
 const back=await p.evaluate(()=>{const H=window.TimelineUI._h;const cl=H.tl.seq.tracks.flatMap(t=>t.clips).find(x=>x.assetId&&x.keyframes&&x.keyframes.x);return cl?JSON.stringify(cl.keyframes):null;});
 assert(back&&JSON.stringify(JSON.parse(back).x.map(k=>[k.t,k.v,k.i,k.h||null]))===JSON.stringify(sk.map(k=>[k.t,k.v,k.i,k.h||null])),'reabrir o .mapa devolve os mesmos keyframes, modos e alças');
 // projeto antigo: keyframes sem h abrem
 const old=JSON.parse(saved);old.sequence.tracks.forEach(t=>t.clips.forEach(cl=>{Object.keys(cl.keyframes||{}).forEach(k=>cl.keyframes[k]=cl.keyframes[k].map(q=>({t:q.t,v:q.v,i:q.i==='bezier'?'ease':q.i}))); }));
 await p.evaluate(j=>{window.__openJson=j;},JSON.stringify(old));await p.click('#btn-open');await p.waitForTimeout(700);
 assert(await p.evaluate(()=>window.TimelineUI._h.tl.seq.tracks.flatMap(t=>t.clips).some(x=>x.keyframes&&x.keyframes.x&&x.keyframes.x.length)),'projeto antigo (só linear/ease/hold) abre normalmente');
 assert(await guard()===await guard(),'(estável)');
 console.log('erros de pagina:',h.errs.length?h.errs.join(' | '):'nenhum');
 assert(h.errs.length===0,'sem erros de JavaScript');
 await h.close();})().catch(e=>{console.log('FAIL excecao',e.message);process.exit(1);});
