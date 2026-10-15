// Sala contínua na quina: duas faces vizinhas mostram uma sala só, vista do mesmo ponto
const {open}=require('./h.js');
let fails=0,n=0;function assert(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const h=await open(8949,{easy:true,w:1300,h:1900}),p=h.p;
 for(let i=0;i<3;i++){await p.click('#btn-newbox');await p.waitForTimeout(250);}
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1500);
 await p.click('#il-pick-front');await p.waitForTimeout(500);
 assert(await p.locator('#il-join').count()===1,'tem a opção Sala contínua na quina');
 const opts=await p.locator('#il-join option').allTextContents();
 assert(opts.length===3&&/Direita/.test(opts[1])&&/Esquerda/.test(opts[2]),'opções: não, com Direita, com Esquerda ('+opts.join(' | ')+')');
 await p.selectOption('#il-join','front+right');await p.waitForTimeout(700);
 let st=await p.evaluate(()=>{const s=window.TimelineUI._h.tl.seq.stage,c=s.cubes[0],il=window.IllusionUI.state.il;return {faces:il.target.faces,join:il.room.join,fr:c.faces.front,rt:c.faces.right};});
 assert(st.join==='front+right'&&st.faces.join()==='front,right'&&st.fr&&st.rt&&st.fr!==st.rt,'juntar liga Frente e Direita com telas diferentes ('+JSON.stringify(st)+')');
 assert(await p.locator('#il-wall-left').count()===0&&await p.locator('#il-wall-floor').count()===1,'na sala contínua some a parede esquerda e fica o chão');
 // as duas faces: mesmo olho e preenchidas
 const r=await p.evaluate(()=>{const C=window.IllusionCore,G=window.IllusionGL,s=window.TimelineUI._h.tl.seq.stage,il=window.IllusionUI.state.il,out={eyes:[],lit:[]};
  ['front','right'].forEach(f=>{const rf=C.resolveFace(s,il,null,null,0,{cube:'A',face:f});out.eyes.push(rf.eye.map(x=>x.toFixed(2)).join());const c=G.faceTexture(s,il,null,'A',f,0,200);const d=c.getContext('2d').getImageData(0,0,200,200).data;let k=0;for(let i=3;i<d.length;i+=4)if(d[i]>20)k++;out.lit.push(k/400);});
  const v=C.validate(JSON.parse(JSON.stringify(il)),s).value;out.kept=v.room.join;return out;});
 assert(r.eyes[0]===r.eyes[1],'as duas faces usam o mesmo ponto de vista ('+r.eyes[0]+')');
 assert(r.lit[0]>15&&r.lit[1]>15,'as duas faces ficam preenchidas ('+r.lit.map(Math.round)+'%)');
 assert(r.kept==='front+right','a sala contínua sobrevive à validação (salvar e abrir)');
 // aplicar: um clipe por face, mesmo ativo
 await p.click('#il-apply');await p.waitForTimeout(900);
 const ap=await p.evaluate(()=>{const s=window.TimelineUI._h.tl.seq;return {clips:s.tracks.reduce((a,t)=>a+t.clips.length,0),ill:s.assets.filter(a=>a.fx&&a.fx.illusion).length};});
 assert(ap.clips===2&&ap.ill===1,'aplicar cria 2 clipes de uma ilusão só ('+JSON.stringify(ap)+')');
 // clicar na outra face da quina continua na mesma sala
 await p.click('#il-pick-right');await p.waitForTimeout(600);
 const j2=await p.evaluate(()=>({join:window.IllusionUI.state.il.room.join,faces:window.IllusionUI.state.il.target.faces,asset:!!window.IllusionUI.state.assetId}));
 assert(j2.join==='front+right'&&j2.faces.join()==='front,right'&&j2.asset,'escolher a Direita continua na mesma sala ('+JSON.stringify(j2)+')');
 // outra quina
 await p.selectOption('#il-join','right+back');await p.waitForTimeout(700);
 const j3=await p.evaluate(()=>({join:window.IllusionUI.state.il.room.join,faces:window.IllusionUI.state.il.target.faces,clips:window.TimelineUI._h.tl.seq.tracks.reduce((a,t)=>a+t.clips.length,0)}));
 assert(j3.join==='right+back'&&j3.faces.join()==='right,back'&&j3.clips===0,'trocar de quina tira o clipe antigo e espera Aplicar ('+JSON.stringify(j3)+')');
 // desligar
 await p.selectOption('#il-join','');await p.waitForTimeout(600);
 const j4=await p.evaluate(()=>({join:window.IllusionUI.state.il.room.join,faces:window.IllusionUI.state.il.target.faces}));
 assert(j4.join===null&&j4.faces.length===1,'desligar volta para uma face só ('+JSON.stringify(j4)+')');
 // as quatro quinas desenham (cada par com o mesmo olho)
 const all=await p.evaluate(()=>{const C=window.IllusionCore,G=window.IllusionGL,s=window.TimelineUI._h.tl.seq.stage,res=[];
  Object.keys(C.JOINS).forEach(k=>{const J=C.JOINS[k],il=C.defaultIllusion('room-builder');il.room.join=k;il.target.faces=[J.a,J.b];
   const e=[J.a,J.b].map(f=>{const rf=C.resolveFace(s,il,null,null,0,{cube:'A',face:f});const c=G.faceTexture(s,il,null,'A',f,0,160);const d=c.getContext('2d').getImageData(0,0,160,160).data;let q=0;for(let i=3;i<d.length;i+=4)if(d[i]>20)q++;return {eye:rf.eye.map(x=>x.toFixed(1)).join(),lit:q/256};});
   res.push(k+': '+(e[0].eye===e[1].eye?'olho igual':'olho DIFERENTE')+', '+Math.round(e[0].lit)+'%/'+Math.round(e[1].lit)+'%');});return res;});
 console.log(all.join(' ; '));
 assert(all.every(x=>/olho igual/.test(x)&&!/ 0%/.test(x)),'as quatro quinas: mesmo olho e faces preenchidas');
 assert(h.errs.length===0,'erros de página: nenhum ('+h.errs.join('|')+')');
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
