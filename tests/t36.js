// Sala do rato (modelo pronto) e Personagem: usam imagens da biblioteca do app.
const {open}=require('./h.js');
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const PORT=8970,h=await open(PORT,{easy:true,w:1300,h:1500}),p=h.p;
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1500);
 // simula a biblioteca do app: arquivos reais da pasta biblioteca
 await p.evaluate(({PORT})=>{const names=['Parede - Labirinto','Piso - Xadrez preto e branco','Teto - Ondas','Personagem - Rato em pe'];
   window.api=Object.assign(window.api||{},{libraryApp:()=>Promise.resolve(names.map(n=>'/biblioteca/'+n+'.png'))});
   const H=TimelineUI._h;const old=H.toUrl;H.toUrl=p=>'http://localhost:'+PORT+encodeURI(p);},{PORT});
 await p.evaluate(()=>IllusionUI.render&&IllusionUI.render());await p.waitForTimeout(500);
 ok(await p.locator('#il-modelo-rato').count()===1,'botão Sala do rato existe');
 ok(await p.locator('#il-personagem').count()===1,'seletor de personagem existe');
 await p.click('#il-modelo-rato');await p.waitForTimeout(1500);
 const s=await p.evaluate(()=>{const S=IllusionUI.state,W=S.il.room.walls;return {join:S.il.room.join,rot:TimelineUI._h.tl.seq.stage.cubes[0].rotY,bk:W.back.media&&W.back.media.name,fl:W.floor.media&&W.floor.media.name,ce:W.ceiling.media&&W.ceiling.media.name,sp:S.il.room.sprites.length,spn:S.il.room.sprites[0]&&S.il.room.sprites[0].media.name,dep:S.il.params.depth,msg:S.msg}});
 console.log(JSON.stringify(s));
 ok(s.join==='front+right'&&s.rot===-45,'sala na quina com cubo girado');
 ok(/Labirinto/.test(s.bk)&&/Xadrez/.test(s.fl)&&/Labirinto/.test(s.ce),'paredes e teto com o mesmo labirinto, piso xadrez');
 ok(s.sp===1&&/Rato/.test(s.spn)&&s.dep===24,'rato em pé e profundidade 24');
 // ligação velha: a face Direita aponta para uma superfície que não existe mais
 await p.evaluate(()=>{const c=TimelineUI._h.tl.seq.stage.cubes[0];c.faces.right='superficie-fantasma';});
 await p.click('#il-modelo-rato');await p.waitForTimeout(1200);
 await p.click('#il-apply');await p.waitForTimeout(1500);
 const bd=await p.evaluate(()=>{const c=TimelineUI._h.tl.seq.stage.cubes[0],keys=TimelineUI._h.surfaces().map(z=>z.s.key);return {f:c.faces.front,r:c.faces.right,keys,ok:keys.indexOf(c.faces.front)>=0&&keys.indexOf(c.faces.right)>=0&&c.faces.front!==c.faces.right}});
 console.log(JSON.stringify(bd));
 ok(bd.ok,'depois de Colocar na face, as duas faces da quina têm superfície real');
 ok(await p.evaluate(()=>TimelineUI._h.tl.seq.tracks.reduce((n,t)=>n+t.clips.length,0))===2,'Colocar na face cria clipe nas duas faces');
 await p.click('#il-personagem-del');await p.waitForTimeout(600);
 ok(await p.evaluate(()=>IllusionUI.state.il.room.sprites.length)===0,'tirar personagens zera');
 await p.selectOption('#il-personagem','0');await p.waitForTimeout(800);
 ok(await p.evaluate(()=>IllusionUI.state.il.room.sprites.length)===1,'seletor adiciona personagem');
 ok(h.errs.length===0,'sem erros de página '+h.errs.join('|'));
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
