const M=require('../media-core.js'),S=require('../sequence.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const seq=S.create();
const A=(o)=>S.addAsset(seq,o);
const v1=A({kind:'video',name:'Neon 10.mp4',path:'/a/Neon 10.mp4',duration:8,dims:[1920,1080],added:3,meta:{fps:29.97,audio:true}});
const v2=A({kind:'video',name:'neon 2.mp4',path:'/a/neon 2.mp4',duration:3,dims:[1280,720],added:1,collection:'Intro'});
const im=A({kind:'img',name:'Logo.png',path:'/a/Logo.png',dims:[800,600],added:2,collection:'Intro'});
const au=A({kind:'audio',name:'Musica.mp3',path:'/a/Musica.mp3',duration:120,added:4,meta:{channels:2}});
const fx=A({kind:'fx',name:'Grade',fx:{kind:'grade'},added:5});
const tx=A({kind:'text',name:'Titulo',text:{t:'x'},added:6});
const tr=S.addTrack(seq,'video','k1','Face');S.addClip(seq,tr.id,v1,0);S.addClip(seq,tr.id,v1,10);S.addClip(seq,tr.id,im,20);
const u=M.usage(seq);assert(u[v1.id]===2&&u[im.id]===1&&!u[v2.id],'uso por ativo');
assert(M.filter(seq.assets,{kind:'video'},u).length===2&&M.filter(seq.assets,{kind:'audio'},u).length===1,'filtro por tipo');
assert(M.filter(seq.assets,{q:'NEON'},u).length===2&&M.filter(seq.assets,{q:'musica'},u)[0]===au,'busca sem diferenciar maiúsculas');
assert(M.filter(seq.assets,{q:'video'},u).length===2&&M.filter(seq.assets,{q:'logo.png'},u)[0]===im,'busca por tipo e por nome de arquivo');
assert(M.filter(seq.assets,{collection:'Intro'},u).length===2&&M.filter(seq.assets,{collection:'(none)'},u).length===4,'coleções e sem coleção');
assert(M.collections(seq.assets).length===1&&M.collections(seq.assets)[0].n===2,'lista de coleções');
assert(M.filter(seq.assets,{onlyUnused:true},u).map(a=>a.name).sort().join()==='Grade,Musica.mp3,Titulo,neon 2.mp4','só não usados');
v2._off=true;assert(M.filter(seq.assets,{onlyOffline:true},u)[0]===v2,'só offline');delete v2._off;
const names=(l)=>l.map(a=>a.name).join('|');
assert(names(M.sort(seq.assets.filter(a=>a.kind==='video'),'name'))==='neon 2.mp4|Neon 10.mp4','ordem natural por nome (2 antes de 10)');
assert(M.sort(seq.assets,'duration',true)[0]===au,'duração decrescente');
assert(M.sort(seq.assets,'added')[0]===tx,'mais recentes primeiro');
assert(M.sort(seq.assets,'usage',false,u)[0]===v1,'mais usados primeiro');
assert(M.sort(seq.assets,'kind')[0].kind==='audio','tipo');
assert(M.describe(v1,2)==='Vídeo · 1920×1080 · 29.97 fps · 0:08 · com áudio · em 2 clipes','descrição completa: '+M.describe(v1,2));
assert(M.describe(au,0)==='Áudio · 2:00 · estéreo','descrição de áudio: '+M.describe(au,0));
assert(M.fileBacked(v1)&&!M.fileBacked(fx)&&!M.fileBacked({kind:'video',path:'x',test:true}),'ativo com arquivo');
// persistência dos campos novos
const re=S.migrate(JSON.parse(JSON.stringify(seq)));const r1=re.assets.find(a=>a.name==='Neon 10.mp4');
assert(r1.added===3&&r1.meta.fps===29.97&&r1.meta.audio===true&&re.assets.find(a=>a.name==='Logo.png').collection==='Intro','campos novos sobrevivem a salvar e abrir');
const old=S.migrate({assets:[{id:'a1',kind:'video',name:'x',path:'/x.mp4',duration:2}],tracks:[]});assert(old.assets[0].collection===undefined&&old.assets[0].meta===undefined,'projeto antigo sem os campos novos continua igual');
assert(M.setCollection(v2,'  Cena 1  ')==='Cena 1'&&v2.collection==='Cena 1','definir coleção');
// relink em lote
const off=[v1,v2,im];const m=M.matchRelink(off,['/novo/NEON 10.MP4','/novo/Logo.png','/novo/outra.mov']);
assert(m.hit.length===2&&m.miss.length===1&&m.miss[0]===v2,'relink por nome do arquivo (sem diferenciar maiúsculas)');
// relink preserva e corta clipes
const seq2=S.create();const vv=S.addAsset(seq2,{kind:'video',name:'v',path:'/x/v.mp4',duration:10});const t2=S.addTrack(seq2,'video','k','F');const c1=S.addClip(seq2,t2.id,vv,0,10);const c2=S.addClip(seq2,t2.id,vv,12,2);c2.inPoint=1;c2.outPoint=3;
const r=M.relink(seq2,vv,'/y/v2.mp4',{duration:6,dims:[640,360],meta:{fps:30}});
assert(vv.path==='/y/v2.mp4'&&vv.duration===6&&vv.dims[0]===640&&vv.meta.fps===30,'relink troca caminho e metadados');
assert(r.clipped===1&&r.kept===1&&c1.outPoint===6&&c2.outPoint===3&&S.findClip(seq2,c1.id)&&S.findClip(seq2,c2.id),'relink não apaga clipes: corta só o excesso '+JSON.stringify(r));
// apagar só o que não é usado
assert(!M.canDelete(seq,v1.id)&&M.canDelete(seq,v2.id)&&!M.removeAsset(seq,v1.id)&&M.removeAsset(seq,v2.id)&&seq.assets.length===5,'só apaga ativo sem uso');
assert(M.dir('C:\\a\\b.mp4')==='C:\\a'&&M.base('/a/b/c.mov')==='c.mov','caminhos com / e \\');
