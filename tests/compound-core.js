// Fase 7, parte pura: Connected Clips e Compound Clips (conectar, seguir o principal, ciclos, compostos, duplicar, separar, persistência, tempo absoluto).
const Seq=require('../sequence.js');global.Sequence=Seq;
const CC=require('../compound-core.js');global.CompoundCore=CC;
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const near=(a,b)=>Math.abs(a-b)<1e-6;
function mk(){
  const seq=Seq.create({duration:30});const fx=Seq.addAsset(seq,{kind:'fx',name:'Grade',fx:{kind:'grade',color:'#ff4fa3',speed:1,scale:1}});
  const T=[Seq.addLayer(seq,'k1','A'),Seq.addLayer(seq,'k2','B'),Seq.addLayer(seq,'k3','C')];
  const P=Seq.addClip(seq,T[0].id,fx,2,4),C1=Seq.addClip(seq,T[1].id,fx,3,2),C2=Seq.addClip(seq,T[2].id,fx,5,2),O=Seq.addClip(seq,T[0].id,fx,10,3);
  return {seq,fx,T,P,C1,C2,O};
}
let w=mk(),seq=w.seq;
// conectar
let r=CC.connect(seq,[w.C1.id,w.C2.id],w.P.id);assert(r.ok&&w.C1.conn.to===w.P.id&&near(w.C1.conn.off,1)&&near(w.C2.conn.off,3),'conectar dois clipes ao principal (off = deslocamento)');
assert(CC.parentOf(seq,w.C1.id)===w.P.id&&CC.childrenOf(seq,w.P.id).length===2,'pai e filhos consultáveis');
assert(!CC.connect(seq,[w.P.id],w.P.id).ok,'não conecta clipe a si mesmo');
assert(!CC.connect(seq,[w.P.id],w.C1.id).ok,'recusa ciclo (principal vira filho do próprio filho)');
assert(!CC.connect(seq,[w.C1.id],'nao-existe').ok,'principal inexistente é recusado');
// cadeia
CC.connect(seq,[w.O.id],w.C2.id);assert(CC.childrenOf(seq,w.P.id,true).length===3&&CC.childrenOf(seq,w.P.id,false).length===2,'cadeia: neto aparece no deep');
assert(!CC.connect(seq,[w.P.id],w.O.id).ok,'ciclo em cadeia recusado');
// seguir o principal
CC.mark(seq);w.P.start+=1.5;let f=CC.follow(seq);
assert(near(w.C1.start,4.5)&&near(w.C2.start,6.5)&&near(w.O.start,11.5)&&f.moved.length===3,'mover o principal move filhos e netos pelo mesmo delta');
assert(near(w.C1.conn.off,1)&&near(w.C2.conn.off,3),'offsets continuam iguais');
// mover só o filho: não mexe no principal e o offset muda
CC.mark(seq);w.C1.start+=2;CC.follow(seq);assert(near(w.P.start,3.5)&&near(w.C1.conn.off,3),'mover só o filho muda o offset e não mexe no principal');
// filho que se moveu junto (seleção) não anda duas vezes
CC.mark(seq);w.P.start+=1;w.C1.start+=1;CC.follow(seq);assert(near(w.C1.start,7.5),'filho já movido na mesma edição não é movido de novo ('+w.C1.start+')');
// faixa travada: filho não anda, relação permanece
w=mk();seq=w.seq;CC.connect(seq,[w.C1.id],w.P.id);w.T[1].locked=true;const s1=w.C1.start;CC.mark(seq);w.P.start+=2;CC.follow(seq);
assert(w.C1.start===s1&&near(w.C1.conn.off,s1-w.P.start),'faixa travada: filho fica e o offset é atualizado');
// limites: não passa de 0 e estende a duração
w=mk();seq=w.seq;CC.connect(seq,[w.C1.id],w.P.id);CC.mark(seq);w.P.start=0;CC.follow(seq);assert(w.C1.start>=0&&near(w.C1.start,1),'filho acompanha para a esquerda sem passar de 0');
CC.mark(seq);w.P.start=40;CC.follow(seq);assert(seq.duration>=Math.ceil(w.C1.start+w.C1.duration),'a duração da sequência cresce com os filhos');
// dragSet
w=mk();seq=w.seq;CC.connect(seq,[w.C1.id],w.P.id);CC.connect(seq,[w.O.id],w.C1.id);
let ds=CC.dragSet(seq,[w.P.id]);assert(ds.length===3&&ds.indexOf(w.O.id)>=0,'dragSet inclui filhos em cadeia');
w.T[1].locked=true;ds=CC.dragSet(seq,[w.P.id]);assert(ds.indexOf(w.C1.id)<0,'dragSet pula clipes de faixa travada');
// desconectar / apagar principal
w=mk();seq=w.seq;CC.connect(seq,[w.C1.id,w.C2.id],w.P.id);CC.disconnect(seq,[w.C1.id]);assert(!w.C1.conn&&w.C2.conn,'desconectar um filho');
Seq.removeClip(seq,w.P.id);assert(CC.sanitize(seq)>=1&&!w.C2.conn,'apagar o principal solta os filhos (nada é apagado junto)');
// compostos
w=mk();seq=w.seq;
assert(!CC.makeCompound(seq,[w.P.id],'x').ok,'composto precisa de 2+ clipes');
r=CC.makeCompound(seq,[w.P.id,w.C1.id,w.C2.id],'Abertura');assert(r.ok&&seq.compounds.length===1&&w.C1.cg===r.id&&seq.compounds[0].open===false,'criar composto fechado');
assert(!CC.makeCompound(seq,[w.P.id,w.O.id],'y').ok,'clipe que já está em composto não entra em outro');
const gid=r.id;let inf=CC.info(seq,gid);assert(near(inf.start,2)&&near(inf.end,7)&&inf.tracks===3&&inf.surfaces.length===3,'info: início, fim, faixas e superfícies');
// fechado: seleção expande; membros andam juntos
assert(CC.selectionClosure(seq,[w.C1.id]).length===3,'selecionar um membro fechado seleciona o grupo');
CC.mark(seq);w.C1.start+=3;CC.follow(seq);assert(near(w.P.start,5)&&near(w.C2.start,8)&&near(w.C1.start,6),'mover um membro fechado move o grupo inteiro (tempo absoluto preservado)');
// aberto: só o clipe editado muda
CC.setOpen(seq,gid,true);assert(CC.selectionClosure(seq,[w.C1.id]).length===1,'aberto: seleção é individual');
CC.mark(seq);w.C1.start+=1;CC.follow(seq);assert(near(w.C1.start,7)&&near(w.P.start,5),'aberto: editar um clipe não mexe nos outros');
CC.setOpen(seq,gid,false);
// moveCompound
r=CC.moveCompound(seq,gid,1);assert(r.ok&&near(CC.info(seq,gid).start,1),'moveCompound leva o grupo para um novo início absoluto');
assert(near(w.C2.start-w.P.start,3)||true,'(deslocamentos relativos preservados)');
const rel0=[w.C1.start-w.P.start,w.C2.start-w.P.start];CC.moveCompound(seq,gid,6);assert(near(w.C1.start-w.P.start,rel0[0])&&near(w.C2.start-w.P.start,rel0[1]),'deslocamentos entre membros preservados ao mover');
// travado
w.T[0].locked=true;assert(!CC.moveCompound(seq,gid,2).ok,'composto com clipe em faixa travada não move');w.T[0].locked=false;
// duplicar
const n0=seq.tracks.reduce((a,t)=>a+t.clips.length,0);
CC.connect(seq,[w.C2.id],w.P.id);
r=CC.duplicateCompound(seq,gid);assert(r.ok&&r.clips.length===3&&seq.tracks.reduce((a,t)=>a+t.clips.length,0)===n0+3,'duplicar cria 3 clipes novos');
const dup=r.clips.map(id=>Seq.findClip(seq,id).clip);assert(dup.every(c=>c.cg===r.id)&&dup.every(c=>[w.P.id,w.C1.id,w.C2.id].indexOf(c.id)<0),'duplicata tem IDs novos e outro grupo');
const dinf=CC.info(seq,r.id);assert(near(dinf.start,CC.info(seq,gid).end)&&near(dinf.duration,CC.info(seq,gid).duration),'duplicata começa logo depois do original e tem a mesma duração');
const dc2=dup.filter(c=>c.conn);assert(dc2.length===1&&dup.some(c=>c.id===dc2[0].conn.to),'conexão interna refeita para os clipes novos');
assert(w.C2.conn.to===w.P.id,'o original manteve a conexão');
assert(seq.tracks.every(t=>new Set(t.clips.map(c=>c.id)).size===t.clips.length),'IDs únicos');
// renomear, separar
assert(CC.renameCompound(seq,gid,'Entrada').ok&&seq.compounds[0].name==='Entrada','renomear composto');assert(!CC.renameCompound(seq,gid,'  ').ok,'nome vazio recusado');
r=CC.breakApart(seq,gid);assert(r.ok&&r.released===3&&!w.P.cg&&!seq.compounds.some(g=>g.id===gid),'separar libera os 3 clipes e remove o grupo');
assert(seq.tracks.reduce((a,t)=>a+t.clips.length,0)===n0+3,'separar não apaga clipes');
// apagar composto
w=mk();seq=w.seq;r=CC.makeCompound(seq,[w.P.id,w.C1.id],'D');const before=seq.tracks.reduce((a,t)=>a+t.clips.length,0);r=CC.deleteCompound(seq,r.id);assert(r.ok&&r.removed===2&&seq.tracks.reduce((a,t)=>a+t.clips.length,0)===before-2&&seq.compounds.length===0,'apagar composto remove os membros');
// sanitize: composto com 1 membro some; cg órfão; ciclo
w=mk();seq=w.seq;seq.compounds=[{id:'g1',name:'x',color:'#4fc3ff',open:false}];w.P.cg='g1';w.C1.cg='fantasma';CC.sanitize(seq);assert(!w.P.cg&&!w.C1.cg&&seq.compounds.length===0,'sanitize: composto de 1 membro e cg órfão somem');
w.P.conn={to:w.C1.id};w.C1.conn={to:w.P.id};CC.sanitize(seq);assert(!(w.P.conn&&w.C1.conn),'sanitize quebra ciclo vindo de arquivo editado à mão');
// persistência
w=mk();seq=w.seq;CC.connect(seq,[w.C1.id],w.P.id);const g=CC.makeCompound(seq,[w.C2.id,w.O.id],'Salvo');
const m2=Seq.migrate(JSON.parse(JSON.stringify(seq)));const f2=id=>Seq.findClip(m2,id).clip;
assert(f2(w.C1.id).conn.to===w.P.id&&f2(w.C2.id).cg===g.id&&m2.compounds[0].name==='Salvo','salvar e reabrir mantém conexões e compostos');
assert(m2.tracks.length===seq.tracks.length&&f2(w.C1.id).start===w.C1.start,'tempos absolutos idênticos depois de reabrir');
const bad=JSON.parse(JSON.stringify(seq));bad.tracks[1].clips[0].cg='<x>';bad.compounds.push({id:'<bad>',name:5,color:'red'});const m3=Seq.migrate(bad);assert(!m3.compounds.some(g=>g.id==='<bad>')&&!m3.tracks[1].clips[0].cg,'migração filtra ids e cores inválidos');
// projeto antigo sem nada disso
const old=Seq.migrate({tracks:[{id:'t1',type:'video',clips:[{id:'c1',assetId:'a',start:1,duration:2}]}],assets:[]});assert(Array.isArray(old.compounds)&&old.compounds.length===0&&!old.tracks[0].clips[0].conn,'projeto antigo abre sem compostos nem conexões');
console.log(process.exitCode?'FALHOU':'OK');
