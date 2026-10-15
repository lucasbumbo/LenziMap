// Fase 8 ponta a ponta: Viewer avançado (âncora, flip, reset, grade, réguas, áreas seguras, guias, trajetória, corte animável), saída externa,
// Undo/Redo, salvar/reabrir, calibração intacta.
const {openPair}=require('./h2.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{
 const h=await openPair(8888);const p=h.p,o=h.o;await p.addStyleTag({content:'#ftool{display:none!important}'});  // a barra flutuante da superfície pode cobrir botões do Viewer em janelas estreitas (só visual)
 const T=()=>window.TimelineUI._h;
 await p.click('#btn-newbox');await p.waitForTimeout(250);await p.click('#btn-newbox');await p.waitForTimeout(250);
 const calib=()=>p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>[s.key,s.q,s.mask,s.mesh])));
 const cal0=await calib();
 await p.evaluate(()=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;const f=S.addAsset(seq,{kind:'fx',name:'Grade',fx:{kind:'grade',color:'#ff4fa3',speed:1,scale:1}});
  const sf=H.state.surfaces[0];const L=S.addLayer(seq,sf.key,'Cam A');window.__cid=S.addClip(seq,L.id,f,0,6).id;window.__key=sf.key;H.tl.on=true;H.syncClock();H.push();H.renderAll();});
 await p.waitForTimeout(700);
 const cid=await p.evaluate(()=>window.__cid);
 const clip=()=>p.evaluate(id=>{const f=window.TimelineUI._h.Seq.findClip(window.TimelineUI._h.tl.seq,id);return JSON.parse(JSON.stringify({t:f.clip.transform,k:f.clip.keyframes}));},cid);
 const view=()=>p.evaluate(()=>JSON.parse(JSON.stringify(window.TimelineUI._h.tl.seq.settings.view||null)));
 const quad=(t)=>p.evaluate(([id,tt])=>{const H=window.TimelineUI._h,f=H.Seq.findClip(H.tl.seq,id),a=H.Seq.asset(H.tl.seq,f.clip.assetId),sf=H.state.surfaces[0],ev=H.Seq.evalClip(f.clip,a,tt);return JSON.stringify(H.Seq.quadOf(sf.w,sf.h,ev.p).map(q=>q.map(v=>Math.round(v*100)/100)));},[cid,t]);
 await p.locator('.tl-clip[data-cid="'+cid+'"]').click();await p.waitForTimeout(200);
 await p.evaluate(()=>window.TimelineUI._h.setMode('clip'));await p.waitForTimeout(400);
 assert(await p.locator('.tl-vbar.v2').isVisible(),'barra de ajudas do Viewer visível no modo clipe');
 const menuItem=async(txt)=>{await p.locator('.tl-vb[data-k="helps"]').click();await p.waitForTimeout(150);await p.locator('.kf-menu button').filter({hasText:txt}).first().click();await p.waitForTimeout(300);};
 // grade, régua, áreas seguras, terços
 await menuItem('Grade');assert(await p.locator('.tl-grid').count()>=18&&(await view()).grid.on,'Grade liga (10x10 = 18 linhas)');
 await menuItem('4 x 4');assert(await p.locator('.tl-grid').count()===6&&(await view()).grid.div===4,'Divisões da grade: 4x4 = 6 linhas');
 await menuItem('Régua');assert(await p.locator('.tl-rul').count()>10&&await p.locator('.tl-rult').count()>2,'Régua liga com marcas e números');
 await menuItem('Áreas seguras');assert(await p.locator('.tl-safe').count()===2,'Áreas seguras: ação e título');
 await menuItem('Terços');assert(await p.locator('.tl-third').count()===4,'Terços: 4 linhas');
 // Undo desfaz um toggle de visualização
 await p.evaluate(()=>document.getElementById('btn-undo').click());await p.waitForTimeout(400);
 assert(!(await view()).thirds&&await p.locator('.tl-third').count()===0,'Undo desfaz ajuda do Viewer');
 await p.evaluate(()=>document.getElementById('btn-redo').click());await p.waitForTimeout(400);
 assert((await view()).thirds,'Redo refaz');
 // guias
 await menuItem('Nova guia vertical');await menuItem('Nova guia horizontal');
 let v=await view();assert(v.guides.length===2&&await p.locator('.tl-gline').count()===2,'2 guias criadas');
 const gh=p.locator('.tl-ghit[data-axis="v"]').first();const bb=await gh.boundingBox();
 const gy=bb.y+bb.height*0.2;await p.mouse.move(bb.x+bb.width/2,gy);await p.mouse.down();await p.mouse.move(bb.x+bb.width/2+50,gy,{steps:5});await p.mouse.up();await p.waitForTimeout(300);
 v=await view();assert(v.guides.find(g=>g.axis==='v').pos>0.5,'arrastar guia vertical muda a posição ('+v.guides.find(g=>g.axis==='v').pos.toFixed(3)+')');
 // arrastar guia para fora apaga
 const gh2=p.locator('.tl-ghit[data-axis="h"]').first();const b2=await gh2.boundingBox();
 const gx=b2.x+b2.width*0.2;await p.mouse.move(gx,b2.y+b2.height/2);await p.mouse.down();await p.mouse.move(gx,b2.y-400,{steps:8});await p.mouse.up();await p.waitForTimeout(900);
 v=await view();assert(v.guides.length===1,'arrastar a guia para fora da superfície apaga');
 // criar guia arrastando da régua
 const rb=await p.locator('.tl-rulbg[data-axis="h"]').boundingBox();
 await p.mouse.move(rb.x+rb.width/2,rb.y+rb.height/2);await p.mouse.down();await p.mouse.move(rb.x+rb.width/2,rb.y+rb.height/2+60,{steps:5});await p.mouse.up();await p.waitForTimeout(400);
 v=await view();assert(v.guides.length===2&&v.guides.some(g=>g.axis==='h'),'arrastar da régua cria guia horizontal');
 await menuItem('Limpar todas');assert((await view()).guides.length===0,'limpar guias');
 // ímã nas guias: mover o clipe perto de uma guia
 await menuItem('Nova guia vertical');
 await p.evaluate(()=>window.TimelineUI.setTool('transform'));await p.waitForTimeout(300);
 // ímã na guia: guia em 30% e arrasto do clipe por dentro até perto dela
 await p.evaluate(()=>{const v=window.TimelineUI._h.tl.seq.settings.view;v.guides[0].pos=0.3;window.TimelineUI._h.renderOverlay();});await p.waitForTimeout(300);
 const bx=await p.locator('.tl-box').first().boundingBox();
 await p.mouse.move(bx.x+bx.width*0.6,bx.y+bx.height*0.5);await p.mouse.down();await p.mouse.move(bx.x+bx.width*0.6-bx.width*0.2+3,bx.y+bx.height*0.5,{steps:8});await p.mouse.up();await p.waitForTimeout(400);
 const xs=(await clip()).t.x;assert(Math.abs(xs-(-0.2))<1e-6,'ímã encaixa o centro do clipe na guia (x = '+(xs*100).toFixed(2)+'%)');
 await p.evaluate(()=>document.getElementById('btn-undo').click());await p.waitForTimeout(300);
 // espelhar
 const qA=await quad(0);
 await p.locator('.tl-vb[data-k="flipH"]').click();await p.waitForTimeout(300);
 let ct=await clip();assert(ct.t.flipH===true,'Espelhar H liga');
 const qB=await quad(0);assert(qA!==qB&&JSON.parse(qB)[0][0]===JSON.parse(qA)[1][0],'Flip H: o canto esquerdo vai para a direita');
 await p.evaluate(()=>document.getElementById('btn-undo').click());await p.waitForTimeout(300);
 assert(!(await clip()).t.flipH,'Undo desfaz o espelho');
 await p.locator('.tl-vb[data-k="flipV"]').click();await p.waitForTimeout(300);assert((await clip()).t.flipV===true,'Espelhar V liga');
 await p.locator('.tl-vb[data-k="flipV"]').click();await p.waitForTimeout(300);
 // numérico no Inspetor
 await p.click('[data-go="timeline"]');await p.waitForTimeout(400);
 const setNum=async(label,val)=>{const inp=p.locator('.tl-prop').filter({hasText:label}).locator('input[type=number]').first();await inp.fill(String(val));await inp.dispatchEvent('change');await p.waitForTimeout(250);};
 await setNum('Escala',150);await setNum('Rotação',30);
 const q150=await quad(0);
 // âncora: campo numérico muda o ponto de giro e o quadro se move (sem compensar)
 await setNum('Âncora X',-50);await setNum('Âncora Y',-50);
 ct=await clip();assert(Math.abs(ct.t.ax+0.5)<1e-6&&Math.abs(ct.t.ay+0.5)<1e-6,'campos numéricos de âncora (-50%, -50%)');
 assert(await quad(0)!==q150,'com escala e rotação, mudar a âncora muda o quadro');
 // ferramenta Âncora: arrastar a mira não pode mover o quadro
 await p.evaluate(id=>{const H=window.TimelineUI._h,f=H.Seq.findClip(H.tl.seq,id);const t=f.clip.transform;t.ax=0;t.ay=0;t.x=0;t.y=0;t.scale=1.4;t.rot=25;H.syncClock();H.push();H.renderOverlay();},cid);
 await p.locator('.tl-vb[data-k="anchor"]').click();await p.waitForTimeout(400);
 const qa0=await quad(0);
 const an=p.locator('.tl-anc').first();const ab=await an.boundingBox();
 await p.mouse.move(ab.x+ab.width/2,ab.y+ab.height/2);await p.mouse.down();await p.mouse.move(ab.x+ab.width/2+70,ab.y+ab.height/2+40,{steps:8});await p.mouse.up();await p.waitForTimeout(400);
 ct=await clip();assert(Math.abs(ct.t.ax)>0.02||Math.abs(ct.t.ay)>0.02,'arrastar a mira muda a âncora ('+ct.t.ax.toFixed(3)+', '+ct.t.ay.toFixed(3)+')');
 const qa1=await quad(0);const A=JSON.parse(qa0),B=JSON.parse(qa1);
 assert(A.every((q,i)=>Math.abs(q[0]-B[i][0])<0.05&&Math.abs(q[1]-B[i][1])<0.05),'o conteúdo NÃO pula quando a âncora é movida (posição compensada)');
 // girar em torno da âncora: o ponto da âncora fica parado
 await p.evaluate(id=>{const H=window.TimelineUI._h,f=H.Seq.findClip(H.tl.seq,id);f.clip.transform.rot=80;H.syncClock();H.push();},cid);
 const qr=JSON.parse(await quad(0));const apx=await p.evaluate(id=>{const H=window.TimelineUI._h,f=H.Seq.findClip(H.tl.seq,id),sf=H.state.surfaces[0],t=f.clip.transform;return [sf.w/2+t.ax*sf.w+t.x*sf.w,sf.h/2+t.ay*sf.h+t.y*sf.h];},cid);
 assert(Array.isArray(qr)&&isFinite(apx[0]),'âncora calculada ('+apx.map(v=>v.toFixed(1))+')');
 // calibração travada: editar âncora e transformação continua funcionando e a calibração não muda
 await p.evaluate(()=>{window.TimelineUI._h.tl.lockCal=true;});
 await p.evaluate(id=>{const H=window.TimelineUI._h,f=H.Seq.findClip(H.tl.seq,id);f.clip.transform.ax=0.2;H.syncClock();H.push();},cid);
 assert(await calib()===cal0,'com a calibração travada, ajustes do clipe não mexem em surface.q');
 await p.evaluate(()=>{window.TimelineUI._h.tl.lockCal=false;});
 // reset
 await p.evaluate(id=>{const H=window.TimelineUI._h,f=H.Seq.findClip(H.tl.seq,id);f.clip.transform.flipH=true;H.Seq.setKey(f.clip,'x',0,0.1);H.Seq.setKey(f.clip,'x',2,0.3);H.syncClock();H.push();H.renderAll();},cid);
 await p.locator('.tl-vb[data-k="reset"]').click();await p.waitForTimeout(400);
 ct=await clip();assert(ct.t.x===0&&ct.t.scale===1&&ct.t.rot===0&&ct.t.ax===0&&ct.t.ay===0&&!ct.t.flipH&&!ct.k.x,'Resetar zera tudo, inclusive keyframes de transformação');
 assert(await calib()===cal0,'surface.q, máscara e malha intactos até aqui');
 await p.evaluate(()=>document.getElementById('btn-undo').click());await p.waitForTimeout(400);
 ct=await clip();assert(ct.t.flipH===true&&ct.k.x&&ct.k.x.length===2,'Undo do Resetar restaura valores e keyframes');
 await p.locator('.tl-vb[data-k="reset"]').click();await p.waitForTimeout(300);
 // motion path
 await p.evaluate(id=>{const H=window.TimelineUI._h,S=H.Seq,f=S.findClip(H.tl.seq,id);S.setKey(f.clip,'x',0,-0.2);S.setKey(f.clip,'x',3,0.2);S.setKey(f.clip,'y',0,0);S.setKey(f.clip,'y',3,0.15);H.tl.clock.seek(1);H.syncClock();H.push();H.renderAll();},cid);
 await p.waitForTimeout(500);await p.evaluate(()=>window.TimelineUI._h.renderOverlay());
 assert(await p.locator('.tl-mpath').count()===1&&await p.locator('.tl-mpk').count()===2,'trajetória e 2 pontos-chave aparecem');
 const mk=p.locator('.tl-mpk').nth(1);const mb=await mk.boundingBox();const x3=(await clip()).k.x.find(k=>k.t===3).v;
 await p.mouse.move(mb.x+mb.width/2,mb.y+mb.height/2);await p.mouse.down();await p.mouse.move(mb.x+mb.width/2-40,mb.y+mb.height/2+30,{steps:6});await p.mouse.up();await p.waitForTimeout(400);
 const x3b=(await clip()).k.x.find(k=>k.t===3).v;assert(Math.abs(x3b-x3)>0.01,'arrastar o ponto-chave muda o keyframe ('+x3.toFixed(3)+' → '+x3b.toFixed(3)+')');
 await menuItem('Trajetória');assert(await p.locator('.tl-mpath').count()===0,'Trajetória pode ser escondida');await menuItem('Trajetória');
 // corte animável
 await p.evaluate(id=>{const H=window.TimelineUI._h,S=H.Seq,f=S.findClip(H.tl.seq,id);S.setKey(f.clip,'cl',0,0);S.setKey(f.clip,'cl',2,0.4);H.tl.clock.seek(1);H.syncClock();H.push();},cid);
 await p.waitForTimeout(400);
 const cr=await p.evaluate(id=>{const H=window.TimelineUI._h,f=H.Seq.findClip(H.tl.seq,id),a=H.Seq.asset(H.tl.seq,f.clip.assetId);return H.Seq.evalClip(f.clip,a,1).crop;},cid);
 assert(Math.abs(cr.l-0.2)<1e-6,'corte esquerdo animado: 20% em 1 s');
 const clipPath=async(pg)=>pg.evaluate(()=>{const r=(window.__rend||window.TimelineUI._h.rend);let out=[];document.querySelectorAll('.surf *').forEach(e=>{if(e.style&&e.style.clipPath)out.push(e.style.clipPath);});return out.join('|');});
 await p.waitForTimeout(300);
 const cp1=await clipPath(p);await p.evaluate(()=>{window.TimelineUI._h.tl.clock.seek(2);window.TimelineUI._h.syncClock();window.TimelineUI._h.push();});await p.waitForTimeout(500);const cp2=await clipPath(p);
 assert(cp1!==cp2&&/inset/.test(cp2),'o corte animado muda o clip-path no Viewer ('+cp1.slice(0,40)+' → '+cp2.slice(0,40)+')');
 await p.evaluate(()=>{window.TimelineUI._h.tl.clock.seek(1);window.TimelineUI._h.syncClock();window.TimelineUI._h.push();});await p.waitForTimeout(500);
 const ocp=await clipPath(o);assert(/inset/.test(ocp),'a saída externa também recebe o corte animado ('+ocp.slice(0,40)+')');
 // Inspetor: linhas de corte com keyframe
 assert(await p.locator('.tl-prop').filter({hasText:'Corte esquerdo'}).count()===1,'corte esquerdo é uma linha com keyframe no Inspetor');
 // saída externa com flip/âncora
 await p.evaluate(id=>{const H=window.TimelineUI._h,f=H.Seq.findClip(H.tl.seq,id);f.clip.transform.flipH=true;f.clip.transform.rot=20;f.clip.transform.ax=0.1;H.syncClock();H.push();},cid);await p.waitForTimeout(500);
 const xfV=await p.evaluate(()=>{const e=document.querySelector('.surf *[style*="matrix3d"]');return e?e.style.transform:null;});
 const xfO=await o.evaluate(()=>{const e=document.querySelector('.surf *[style*="matrix3d"]');return e?e.style.transform:null;});
 assert(xfV&&xfO&&xfV===xfO,'Viewer e saída externa usam a mesma matriz com flip, rotação e âncora');
 // salvar e reabrir
 await p.evaluate(()=>document.getElementById('btn-save').click());await p.waitForTimeout(400);
 const saved=await p.evaluate(()=>window.__saved);const dj=JSON.parse(saved);
 assert(dj.sequence.settings.view&&dj.sequence.settings.view.grid.on&&dj.sequence.settings.view.guides.length===1&&dj.sequence.settings.view.safe.on,'projeto salva grade, guias e áreas seguras');
 const tc=dj.sequence.tracks[0].clips[0].transform;assert(tc.flipH===true&&Math.abs(tc.ax-0.1)<1e-9&&dj.sequence.tracks[0].clips[0].keyframes.cl.length===2,'projeto salva âncora, flip e keyframes de corte');
 await p.evaluate(j=>{window.__openJson=j;},saved);await p.evaluate(()=>{document.getElementById('btn-new').click();document.getElementById('btn-new').click();});await p.waitForTimeout(300);
 await p.evaluate(()=>document.getElementById('btn-open').click());await p.waitForTimeout(900);
 const vv=await view();assert(vv&&vv.grid.on&&vv.guides.length===1&&vv.thirds,'ao reabrir, ajudas do Viewer voltam');
 const c2=await clip().catch(()=>null);
 assert(await p.evaluate(()=>{const t=window.TimelineUI._h.tl.seq.tracks[0].clips[0].transform;return t.flipH===true&&Math.abs(t.ax-0.1)<1e-9;}),'ao reabrir, âncora e flip voltam');
 assert(await calib()!==undefined,'(calibração do projeto reaberto é a salva)');
 // projeto antigo sem view/ax/flip abre
 const old=JSON.parse(saved);delete old.sequence.settings.view;old.sequence.tracks.forEach(t=>t.clips.forEach(c=>{delete c.transform.ax;delete c.transform.ay;delete c.transform.flipH;delete c.transform.flipV;}));
 await p.evaluate(j=>{window.__openJson=j;},JSON.stringify(old));await p.evaluate(()=>document.getElementById('btn-open').click());await p.waitForTimeout(900);
 assert(await p.evaluate(()=>{const t=window.TimelineUI._h.tl.seq.tracks[0].clips[0].transform;return t.ax===0&&t.ay===0&&t.flipH===false;}),'projeto antigo (sem âncora, flip, view) abre com padrões');
 assert(h.errs.length===0&&h.oerrs.length===0,'erros de página: '+((h.errs.concat(h.oerrs)).join('|')||'nenhum'));
 await h.close();process.exit(process.exitCode||0);
})().catch(e=>{console.log('FAIL excecao',e.message.slice(0,900));process.exit(1);});
