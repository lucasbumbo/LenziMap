// Barra branca arrastável, zoom da visualização, sala de 3 faces e transform por camada
const {open}=require('./h.js');
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const h=await open(8981,{easy:true,w:1400,h:1000}),p=h.p;
 await p.click('#btn-newbox');await p.waitForTimeout(600);
 const st=await p.evaluate(()=>{const f=document.getElementById('ftool');return {hid:f.hidden,grip:!!f.querySelector('.fgrip')}});
 ok(!st.hid&&st.grip,'barra branca aparece com alça de arrastar');
 const b0=await p.evaluate(()=>{const r=document.getElementById('ftool').getBoundingClientRect();return [r.left,r.top]});
 const g=await p.evaluate(()=>{const r=document.querySelector('#ftool .fgrip').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]});
 await p.mouse.move(g[0],g[1]);await p.mouse.down();await p.mouse.move(g[0]+120,g[1]+90,{steps:6});await p.mouse.up();await p.waitForTimeout(200);
 const b1=await p.evaluate(()=>{const r=document.getElementById('ftool').getBoundingClientRect();return [r.left,r.top]});
 ok(Math.abs(b1[0]-b0[0]-120)<8&&Math.abs(b1[1]-b0[1]-90)<8,'arrastar a alça move a barra ('+Math.round(b1[0]-b0[0])+','+Math.round(b1[1]-b0[1])+')');
 await p.dblclick('#ftool .fgrip');await p.waitForTimeout(200);
 const b2=await p.evaluate(()=>{const r=document.getElementById('ftool').getBoundingClientRect();return [r.left,r.top]});
 ok(Math.abs(b2[0]-b0[0])<4&&Math.abs(b2[1]-b0[1])<4,'duplo clique na alça volta ao lugar');
 // zoom
 const s0=await p.evaluate(()=>{const r=document.getElementById('stage').getBoundingClientRect();return r.width});
 await p.click('#zoombar [data-z="in"]');await p.waitForTimeout(200);
 const s1=await p.evaluate(()=>{const r=document.getElementById('stage').getBoundingClientRect();return {w:r.width,l:document.getElementById('zoom-lbl').textContent}});
 ok(s1.w>s0*1.3&&/14\d%|140%/.test(s1.l),'botão + aproxima ('+s1.l+')');
 await p.click('#zoombar [data-z="fit"]');await p.waitForTimeout(200);
 const s2=await p.evaluate(()=>document.getElementById('stage').getBoundingClientRect().width);
 ok(Math.abs(s2-s0)<2,'1:1 volta ao tamanho original');
 // pinça (ctrl+roda) e arrastar com a roda
 const c=await p.evaluate(()=>{const r=document.getElementById('stage').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]});
 await p.mouse.move(c[0],c[1]);await p.keyboard.down('Control');await p.mouse.wheel(0,-200);await p.keyboard.up('Control');await p.waitForTimeout(200);
 const s3=await p.evaluate(()=>document.getElementById('stage').getBoundingClientRect().width);
 ok(s3>s0*1.2,'Ctrl + roda aproxima');
 await p.click('#zoombar [data-z="fit"]');
 ok(h.errs.length===0,'sem erros de página '+h.errs.join('|'));
 await h.close();console.log(fails?'FALHOU '+fails:'TUDO OK '+n);process.exit(fails?1:0);})();
