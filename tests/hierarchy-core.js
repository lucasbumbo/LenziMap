// Hierarquia (fase 6), parte pura: árvore, IDs estáveis, cubos, grupos, faces, camadas, propriedades compartilhadas, migração.
const Seq=require('../sequence.js');global.Sequence=Seq;
const IC=require('../illusion-core.js');global.IllusionCore=IC;
const IT=require('../illusion-timeline.js');global.IllusionTimeline=IT;
const H=require('../hierarchy-core.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const mk=()=>{
  const seq=Seq.create({duration:30});const scenes=[{id:'s1',name:'Cena 1',surfaces:[{key:'k1',name:'Face frente'},{key:'k2',name:'Lateral'},{key:'k3',name:'Solta'}]},{id:'s2',name:'Cena 2',surfaces:[{key:'k9',name:'Outra'}]}];
  const st=IT.ensureStage(seq);st.cubes[0].faces.front='k1';st.cubes[0].faces.left='k2';st.cubes[1].faces.front='k9';
  const fx=Seq.addAsset(seq,{kind:'fx',name:'Grade',fx:{kind:'grade',color:'#ff4fa3',speed:1,scale:1}});
  const L1=Seq.addLayer(seq,'k1','Base'),L2=Seq.addLayer(seq,'k1','Topo'),L3=Seq.addLayer(seq,'k2','Lat');
  const c1=Seq.addClip(seq,L1.id,fx,0,4),c2=Seq.addClip(seq,L2.id,fx,1,3),c3=Seq.addClip(seq,L3.id,fx,0,5);
  return {seq,scenes,L1,L2,L3,c1,c2,c3,fx};
};
let w=mk();let ctx={seq:w.seq,scenes:w.scenes,active:0};
let t=H.build(ctx);
// estrutura
assert(t.type==='library'&&t.children[0].type==='project','raiz: Biblioteca > Projeto');
const prj=t.children[0];assert(prj.children.length===2&&prj.children.every(s=>s.type==='scene'),'projeto tem as duas cenas');
const sc1=prj.children[0];
const cubeA=H.find(t,'cb:A');assert(cubeA&&cubeA.type==='cube'&&cubeA.children.length===5,'cena ativa mostra o cubo A com as 5 faces (inclui vazias)');
const fFront=H.find(t,'fc:A:front');assert(fFront&&fFront.meta.surfaceKey==='k1'&&fFront.children.length===2,'face frente: 2 camadas');
assert(fFront.children[0].meta.trackId===w.L2.id&&fFront.children[1].meta.trackId===w.L1.id,'camadas: a de cima da lista primeiro');
const cl=H.find(t,'cl:'+w.c1.id);assert(cl&&cl.type==='clip'&&cl.children[0].type==='effect'&&cl.children[0].name==='Grade','clipe > efeito');
const free=sc1.children.filter(n=>n.type==='free')[0];assert(free&&free.children[0].meta.surfaceKey==='k3','superfície sem cubo aparece em "Superfícies sem cubo"');
const s2=prj.children[1];assert(s2.children.some(n=>n.id==='cb:B'&&n.children.length===1)&&!s2.children.some(n=>n.id==='cb:A'),'cena 2 mostra só os cubos com faces nela');
// IDs estáveis: reconstruir e após ida e volta em JSON
const ids1=H.allIds(t).sort().join();
const copy=JSON.parse(JSON.stringify(w.seq));const m=Seq.migrate(copy);
const t2=H.build({seq:m,scenes:JSON.parse(JSON.stringify(w.scenes)),active:0});
assert(H.allIds(t2).sort().join()===ids1.replace('prj:'+w.seq.id,'prj:'+m.id),'IDs iguais depois de salvar e reabrir (migrate)');
// criar cubo
let r=H.createCube(w.seq,{name:'Cubo novo',size:10});assert(r.ok&&r.id==='E'&&H.stageOf(w.seq).cubes.length===5,'criar cubo: próximo id livre (E)');
assert(H.stageOf(w.seq).cubes[4].faceOrder.length===5,'cubo novo tem ordem de faces');
for(let i=0;i<20;i++)H.createCube(w.seq,{});assert(H.stageOf(w.seq).cubes.length===H.MAX_CUBES,'limite de cubos respeitado ('+H.MAX_CUBES+')');
assert(!H.createCube(w.seq,{}).ok,'passar do limite devolve erro');
// renomear
assert(H.renameCube(w.seq,'A','Cubo grande').ok&&H.stageOf(w.seq).cubes[0].name==='Cubo grande','renomear cubo');
assert(!H.renameCube(w.seq,'A','   ').ok,'nome vazio é recusado');
assert(H.renameCube(w.seq,'A','x\u0000y'.repeat(30)).ok&&H.stageOf(w.seq).cubes[0].name.length<=40&&!/\u0000/.test(H.stageOf(w.seq).cubes[0].name),'nome é limpo e limitado');
H.renameCube(w.seq,'A','Cubo A');
assert(H.renameScene(ctx,0,'Abertura').ok&&w.scenes[0].name==='Abertura','renomear cena');
assert(H.renameLayer(w.seq,w.L1.id,'Fundo').ok&&w.L1.name==='Fundo','renomear camada');
// grupos
w=mk();ctx={seq:w.seq,scenes:w.scenes,active:0};
let g=H.createGroup(w.seq,'Palco',['B','C']);assert(g.ok&&H.stageOf(w.seq).groups[0].cubes.join()==='B,C','criar grupo com cubos');
let g2=H.createGroup(w.seq,'Outro',['C']);assert(H.stageOf(w.seq).groups[0].cubes.join()==='B'&&H.stageOf(w.seq).groups[1].cubes.join()==='C','cubo só em um grupo (mover tira do anterior)');
t=H.build(ctx);assert(H.find(t,'grp:'+g.id).children[0].id==='cb:B','árvore mostra o grupo com o cubo dentro');
assert(H.renameGroup(w.seq,g.id,'Principal').ok&&H.stageOf(w.seq).groups[0].name==='Principal','renomear grupo');
assert(H.deleteGroup(w.seq,g2.id).ok&&H.stageOf(w.seq).groups.length===1&&H.stageOf(w.seq).cubes.some(c=>c.id==='C'),'apagar grupo mantém os cubos');
assert(H.setGroup(w.seq,'B',null).ok&&H.stageOf(w.seq).groups[0].cubes.length===0,'tirar cubo do grupo');
// mover cubo
assert(H.moveCube(w.seq,'D',0).ok&&H.stageOf(w.seq).cubes[0].id==='D','reordenar cubos');
H.moveCube(w.seq,'D',3);
// apagar cubo
w.seq.assets.push({id:'ax',kind:'fx',name:'i',fx:{kind:'illusion',illusion:{preset:'infinite-room',target:{cube:'B',faces:['front']}}}});
r=H.deleteCube(w.seq,'B');assert(r.ok&&r.warnings.length===1&&!H.stageOf(w.seq).cubes.some(c=>c.id==='B'),'apagar cubo avisa sobre ilusões que apontavam pra ele');
assert(w.scenes[1].surfaces[0].key==='k9'&&Seq.layersOf(w.seq,'k1').length===2,'apagar cubo não apaga superfícies nem camadas');
w=mk();ctx={seq:w.seq,scenes:w.scenes,active:0};
['B','C','D'].forEach(id=>H.deleteCube(w.seq,id));assert(!H.deleteCube(w.seq,'A').ok,'não apaga o último cubo');
// faces
w=mk();ctx={seq:w.seq,scenes:w.scenes,active:0};
r=H.moveFaceBinding(w.seq,{cube:'A',face:'front'},{cube:'A',face:'right'});assert(r.ok&&H.stageOf(w.seq).cubes[0].faces.right==='k1'&&H.stageOf(w.seq).cubes[0].faces.front===null,'mover superfície para face vazia');
r=H.moveFaceBinding(w.seq,{cube:'A',face:'right'},{cube:'A',face:'left'});assert(r.swapped&&H.stageOf(w.seq).cubes[0].faces.left==='k1'&&H.stageOf(w.seq).cubes[0].faces.right==='k2','face ocupada troca de lugar');
r=H.moveFaceBinding(w.seq,{cube:'A',face:'left'},{cube:'C',face:'top'});assert(H.stageOf(w.seq).cubes[2].faces.top==='k1'&&H.stageOf(w.seq).cubes[0].faces.left===null,'mover face para outro cubo');
assert(H.bindFace(w.seq,'D','front','k1').ok&&H.stageOf(w.seq).cubes[2].faces.top===null,'ligar superfície já usada a outra face a tira da antiga');
assert(H.reorderFace(w.seq,'A','top',0).ok&&H.stageOf(w.seq).cubes[0].faceOrder[0]==='top','reordenar faces (ordem de exibição)');
t=H.build(ctx);assert(H.find(t,'cb:A').children[0].meta.face==='top','árvore segue a ordem das faces');
// camadas
w=mk();ctx={seq:w.seq,scenes:w.scenes,active:0};
const before=Seq.layersOf(w.seq,'k1').map(x=>x.id).join();
r=H.moveLayerTo(w.seq,w.L1.id,0);assert(r.ok&&Seq.layersOf(w.seq,'k1')[0].id===w.L1.id,'camada vai pro topo da face');
H.moveLayerTo(w.seq,w.L1.id,1);assert(Seq.layersOf(w.seq,'k1').map(x=>x.id).join()===before,'e volta');
r=H.moveLayerToSurface(w.seq,w.L2.id,'k2');assert(r.ok&&w.L2.surfaceId==='k2'&&Seq.layersOf(w.seq,'k2')[0].id===w.L2.id&&Seq.layersOf(w.seq,'k1').length===1,'camada muda de face (fica por cima)');
assert(w.seq.tracks.every((x,i)=>x.order===i),'ordem das faixas continua consistente');
// propriedades compartilhadas
w=mk();ctx={seq:w.seq,scenes:w.scenes,active:0};
let sp=H.sharedProps(ctx,['cb:A','cb:B']);assert(sp.kind==='cube'&&sp.props.find(p=>p.p==='size').mixed,'cubos de tamanhos diferentes: valor misto');
sp=H.sharedProps(ctx,['cb:B','cb:C']);assert(!sp.props.find(p=>p.p==='size').mixed&&sp.props.find(p=>p.p==='size').value===8,'cubos iguais: valor comum');
r=H.setShared(ctx,['cb:B','cb:C','cb:D'],'size',12);assert(r.ok&&r.changed===3&&H.stageOf(w.seq).cubes.slice(1).every(c=>c.size===12),'tamanho aplicado a todos os cubos selecionados');
r=H.setShared(ctx,['cb:B'],'size',9999);assert(H.stageOf(w.seq).cubes[1].size===200,'valor limitado à faixa');
assert(H.sharedProps(ctx,['cb:A','ly:'+w.L1.id]).kind==='misto','tipos misturados não editam juntos');
r=H.setShared(ctx,['cl:'+w.c1.id,'cl:'+w.c2.id],'opacity',0.5);assert(r.changed===2&&w.c1.opacity===0.5&&w.c2.opacity===0.5,'opacidade em vários clipes');
w.L2.locked=true;r=H.setShared(ctx,['cl:'+w.c1.id,'cl:'+w.c2.id],'opacity',0.2);assert(r.changed===1&&r.skipped===1&&w.c2.opacity===0.5&&w.c1.opacity===0.2,'clipe em faixa travada nunca é alterado');
r=H.setShared(ctx,['ly:'+w.L1.id,'ly:'+w.L3.id],'muted',true);assert(w.L1.muted&&w.L3.muted,'mutar várias camadas');
assert(!H.setShared(ctx,['cb:A'],'opacity',1).ok,'propriedade que a seleção não tem é recusada');
// surface.q não existe na hierarquia
assert(JSON.stringify(H.build(ctx)).indexOf('"q"')<0,'a árvore não expõe nem altera surface.q');
// recolhimento persistente
w=mk();H.toggle(w.seq,'cb:A',false);assert(H.collapsedOf(w.seq)['cb:A']===1,'recolher grava no projeto');
const m2=Seq.migrate(JSON.parse(JSON.stringify(w.seq)));assert(m2.settings.tree&&m2.settings.tree.collapsed['cb:A']===1,'recolhido sobrevive a salvar e reabrir');
const rows=H.flatten(H.build({seq:w.seq,scenes:w.scenes,active:0}),H.collapsedOf(w.seq));assert(!rows.some(x=>x.node.id==='fc:A:front'),'filhos do nó recolhido somem da lista');
assert(H.toggle(w.seq,'cb:A')===true&&!H.collapsedOf(w.seq)['cb:A'],'expandir remove o recolhimento');
const bad=Seq.migrate({settings:{tree:{collapsed:{'<script>':1,'ok:1':1}}}});assert(bad.settings.tree.collapsed['ok:1']===1&&!bad.settings.tree.collapsed['<script>'],'migração filtra chaves inválidas');
// projeto antigo (sem stage, sem ids de cena)
const old=Seq.migrate({tracks:[],assets:[]});const sc=[{name:'A',surfaces:[]}];const to=H.build({seq:old,scenes:sc,active:0});
assert(sc[0].id&&to.children[0].children[0].id==='sc:'+sc[0].id,'projeto antigo: cena ganha ID estável e árvore monta');
assert(old.stage&&old.stage.v===2&&H.find(to,'cb:A'),'projeto antigo: palco é criado já na v2');
console.log(process.exitCode?'FALHOU':'OK');
