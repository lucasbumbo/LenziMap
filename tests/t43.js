// Montar no cubo: piso, paredes e rato viram superfícies soltas com 4 cantos.
const {open}=require('./h.js');
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const PORT=8987,h=await open(PORT,{easy:true,w:1500,h:1500}),p=h.p;
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1500);
 await p.evaluate(({PORT})=>{const names=['Parede - Labirinto','Piso - Xadrez preto e branco','Teto - Ondas','Personagem - Rato animado'];
   window.api=Object.assign(window.api||{},{libraryApp:()=>Promise.resolve(names.map(n=>'/biblioteca/'+n+(/animado/.test(n)?'.gif':'.png')))});
   TimelineUI._h.toUrl=p=>'http://localhost:'+PORT+encodeURI(p);},{PORT});
 await p.evaluate(()=>IllusionUI.render&&IllusionUI.render());await p.waitForTimeout(500);
 await p.click('#il-modelo-rato');await p.waitForTimeout(1500);
 await p.click('#il-apply');await p.waitForTimeout(2500);
// pinta as 3 faces como um cubo visto de canto (como na foto real): frente à esquerda, direita à direita, topo em cima
 await p.evaluate(()=>{const H=TimelineUI._h,cu=H.tl.seq.stage.cubes[0],by={};H.surfaces().forEach(z=>by[z.s.key]=z.s);
   const Q={front:[[.2,.3],[.5,.45],[.5,.85],[.2,.7]],right:[[.5,.45],[.8,.3],[.8,.7],[.5,.85]],top:[[.2,.3],[.5,.15],[.8,.3],[.5,.45]]};
   Object.keys(Q).forEach(f=>{const s=by[cu.faces[f]];if(s)s.q=Q[f];});H.renderAll();});
 await p.waitForTimeout(1500);
 await p.screenshot({path:'/tmp/claude-0/montar-antes.png'});
 const before=await p.evaluate(()=>{const H=TimelineUI._h;return {surf:H.surfaces().length,tracks:H.tl.seq.tracks.length}});
 console.log(JSON.stringify(before));
 ok(await p.locator('#il-montar').count()===1,'botão Montar no cubo existe');
 await p.click('#il-montar');await p.waitForTimeout(2500);
 const r=await p.evaluate(()=>{const H=TimelineUI._h,S=H.surfaces().map(z=>z.s),sq=H.tl.seq;
   const nw=S.slice(before0=0).filter(s=>!s.visible===false);
   return {all:S.map(s=>({name:s.name,vis:s.visible,q:s.q.map(p=>[+p[0].toFixed(3),+p[1].toFixed(3)]),clips:sq.tracks.filter(t=>t.surfaceId===s.key).reduce((n,t)=>n+t.clips.length,0),fit:sq.tracks.filter(t=>t.surfaceId===s.key).map(t=>t.clips.map(c=>c.fit).join())}))};});
 console.log(JSON.stringify(r.all,null,0));
 const nov=r.all.filter(s=>/^(Piso|Parede|Rato|Personagem)/.test(s.name));
 ok(nov.length>=4,'camadas soltas criadas ('+nov.map(s=>s.name).join(', ')+')');
 ok(nov.every(s=>s.vis&&s.clips===1&&/fill/.test(s.fit[0])),'cada camada tem 1 clipe com ajuste Preencher');
 ok(nov.every(s=>s.q.every(pt=>isFinite(pt[0])&&isFinite(pt[1])&&Math.abs(pt[0])<3&&Math.abs(pt[1])<3)),'cantos com valores válidos');
 const hid=r.all.filter(s=>!/^(Piso|Parede|Rato|Personagem)/.test(s.name)&&s.vis===false);
 ok(hid.length===3,'as 3 faces da sala 3D ficaram escondidas ('+hid.length+')');
 await p.screenshot({path:'/tmp/claude-0/montar.png'});
 // Desfazer volta tudo
 await p.evaluate(()=>{});
 await h.close();console.log(fails?'HA FALHAS':'TUDO OK '+n);process.exit(fails?1:0);})();
