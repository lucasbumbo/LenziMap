// Desfazer, refazer, reset de controle e Voltar ao modelo no painel 3D (modo simples).
const {open}=require('./h.js');
let fails=0,n=0;function ok(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const PORT=8971,h=await open(PORT,{easy:true,w:1300,h:1500}),p=h.p;
 await p.click('[data-go="ilusao"]');await p.waitForTimeout(1500);
 const depth=()=>p.evaluate(()=>IllusionUI.state.il.params.depth);
 const setDepth=async v=>{await p.evaluate(v=>{const r=document.querySelector('.il-sl input[type=range]');r.value=v;r.dispatchEvent(new Event('input',{bubbles:true}));},v);await p.waitForTimeout(150);};
 ok(await p.locator('#il-undo').count()===1&&await p.locator('#il-redo').count()===1&&await p.locator('#il-modelo-reset').count()===1,'botões Desfazer, Refazer e Voltar ao modelo existem');
 ok(await p.locator('#il-undo').isDisabled(),'Desfazer começa desligado (nada a desfazer)');
 await p.click('#il-sala-quarto');await p.waitForTimeout(500);
 const d0=await depth();
 ok(d0===40,'quarto: profundidade 40 ('+d0+')');
 await setDepth(70);await p.waitForTimeout(900);await setDepth(90);await p.waitForTimeout(100);
 ok(await depth()===90,'slider levou a profundidade para 90');
 ok(await p.locator('#il-undo').isEnabled(),'Desfazer liga depois da mudança');
 await p.click('#il-undo');await p.waitForTimeout(500);
 ok(await depth()===70,'um Desfazer volta o gesto do slider ('+await depth()+')');
 await p.click('#il-undo');await p.waitForTimeout(500);
 ok(await depth()===40,'outro Desfazer volta ao quarto ('+await depth()+')');
 await p.click('#il-redo');await p.waitForTimeout(500);
 ok(await depth()===70,'Refazer avança ('+await depth()+')');
 // ↺ do controle: volta ao valor da primeira vez que o controle apareceu
 const rs=p.locator('.il-sl .il-rs').first();
 ok(await rs.isEnabled(),'↺ ligado quando o valor mudou');
 await rs.click();await p.waitForTimeout(400);
 ok(await depth()===40,'↺ volta o slider ao original ('+await depth()+')');
 // modelo
 await setDepth(55);await p.waitForTimeout(900);
 await p.click('#il-modelo-reset');await p.waitForTimeout(500);
 ok(await depth()===40,'Voltar ao modelo restaura a sala do modelo ('+await depth()+')');
 // grupo: Sala do rato é um passo só
 await p.evaluate(({PORT})=>{const names=['Parede - Labirinto','Piso - Xadrez preto e branco','Teto - Ondas','Personagem - Rato em pe'];
   window.api=Object.assign(window.api||{},{libraryApp:()=>Promise.resolve(names.map(n=>'/biblioteca/'+n+(/animado/.test(n)?'.gif':'.png')))});
   const H=TimelineUI._h;H.toUrl=p=>'http://localhost:'+PORT+encodeURI(p);},{PORT});
 await p.evaluate(()=>IllusionUI.render&&IllusionUI.render());await p.waitForTimeout(400);
 const before=await p.evaluate(()=>({n:IllusionUI.state.hist.length,rot:TimelineUI._h.tl.seq.stage.cubes[0].rotY,sp:IllusionUI.state.il.room.sprites.length}));
 await p.click('#il-modelo-rato');await p.waitForTimeout(1500);
 const mid=await p.evaluate(()=>({n:IllusionUI.state.hist.length,rot:TimelineUI._h.tl.seq.stage.cubes[0].rotY,sp:IllusionUI.state.il.room.sprites.length,join:IllusionUI.state.il.room.join}));
 ok(mid.rot===-45&&mid.sp===1&&mid.join,'Sala do rato aplicada');
 ok(mid.n===before.n+1,'Sala do rato vale um passo só no histórico ('+before.n+' -> '+mid.n+')');
 await p.click('#il-undo');await p.waitForTimeout(700);
 const aft=await p.evaluate(()=>({rot:TimelineUI._h.tl.seq.stage.cubes[0].rotY,sp:IllusionUI.state.il.room.sprites.length,join:IllusionUI.state.il.room.join||null}));
 ok(aft.rot===before.rot&&aft.sp===0&&!aft.join,'um Desfazer tira a Sala do rato inteira ('+JSON.stringify(aft)+')');
 ok(h.errs.length===0,'sem erros de página '+h.errs.join('|'));
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
