// Fase 4: motor de interpolacao (linear, hold, ease, easein, easeout, bezier) e operacoes puras sobre keyframes.
const S=require('../sequence.js'),K=require('../keyframe-core.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const near=(a,b,e=1e-3)=>Math.abs(a-b)<e;
const seq=S.create();const a=S.addAsset(seq,{kind:'fx',name:'G',fx:{kind:'grade'}});const tr=S.addTrack(seq,'video','k1','F');
const mk=()=>{const c=S.addClip(seq,tr.id,a,0,10);return c;};
// interpolacoes
let c=mk();
S.setKey(c,'x',0,0,'linear');S.setKey(c,'x',2,1,'linear');
assert(near(S.valueAt(c,'x',1),0.5),'linear: meio = 0.5');
S.setKey(c,'x',0,0,'hold');assert(near(S.valueAt(c,'x',1.99),0)&&near(S.valueAt(c,'x',2),1),'hold: fica no valor ate o proximo');
S.setKey(c,'x',0,0,'ease');assert(near(S.valueAt(c,'x',1),0.5)&&near(S.valueAt(c,'x',0.5),0.15625),'ease in/out: smoothstep (compatibilidade com projetos antigos)');
S.setKey(c,'x',0,0,'easein');const ein=S.valueAt(c,'x',0.5);assert(ein<0.25&&ein>0,'ease in: comeca devagar ('+ein.toFixed(3)+')');
S.setKey(c,'x',0,0,'easeout');const eout=S.valueAt(c,'x',0.5);assert(eout>0.25&&eout<1,'ease out: comeca rapido ('+eout.toFixed(3)+')');
assert(near(ein+S.valueAt(c,'x',1.5)*0+eout,ein+eout),'valores finitos');
S.setKey(c,'x',0,0,'bezier',[1/3,0,2/3,1]);assert(near(S.valueAt(c,'x',0.5),0.15625),'bezier(1/3,0,2/3,1) igual ao ease in/out');
S.setKey(c,'x',0,0,'bezier',[0.25,0.1,0.25,1]);const bz=S.valueAt(c,'x',1);assert(bz>0.5&&bz<1,'bezier CSS ease: meio acima de 0.5 ('+bz.toFixed(3)+')');
S.setKey(c,'x',0,0,'bezier',[0.3,1.9,0.7,1.6]);let mx=-9,mn=9;for(let t=0;t<=2;t+=0.02){const v=S.valueAt(c,'x',t);mx=Math.max(mx,v);mn=Math.min(mn,v);}assert(mx>1.05||mn<-0.05,'bezier com alcas fora de 0..1 faz overshoot ('+mn.toFixed(2)+'..'+mx.toFixed(2)+')');
// monotonia de x: sem NaN
let ok=true;for(let t=0;t<=2;t+=0.01){if(!isFinite(S.valueAt(c,'x',t)))ok=false;}assert(ok,'bezier nunca devolve NaN');
// persistencia pelo fix
const raw=JSON.parse(JSON.stringify(S.fixClip(c)));assert(raw.keyframes.x[0].i==='bezier'&&raw.keyframes.x[0].h.length===4,'fixClip preserva bezier e alcas');
const bad=S.fixClip({keyframes:{x:[{t:0,v:0,i:'bezier',h:[9,9,9]},{t:1,v:1,i:'lixo'}]}});assert(bad.keyframes.x[0].i==='bezier'&&bad.keyframes.x[0].h.length===4&&bad.keyframes.x[1].i==='linear','alcas invalidas viram padrao, modo desconhecido vira linear');
const clamped=S.fixClip({keyframes:{x:[{t:0,v:0,i:'bezier',h:[5,50,-2,-50]}]}}).keyframes.x[0].h;assert(clamped[0]===1&&clamped[2]===0&&clamped[1]<=4&&clamped[3]>=-3,'alcas sao limitadas');
const old=S.fixClip({keyframes:{x:[{t:0,v:0,i:'ease'},{t:1,v:1,i:'hold'}]}});assert(old.keyframes.x[0].i==='ease'&&old.keyframes.x[1].i==='hold','projeto antigo (ease/hold) abre igual');
// sequencia inteira ida e volta
const s2=S.fixSequence?S.fixSequence(JSON.parse(JSON.stringify(seq))):null;
// operacoes
c=mk();
[['x',0,0],['x',1,1],['x',2,0.5],['y',1,2],['opacity',1.5,0.2]].forEach(([p,t,v])=>S.setKey(c,p,t,v,'linear'));
assert(K.all(c).length===5,'all lista 5 keyframes');
assert(K.atTime(c,1).length===2,'atTime(1) pega x e y');
let sel=[{p:'x',t:1},{p:'y',t:1}];
let r=K.move(c,sel,0.5);assert(r.length===2&&near(r[0].t,1.5)&&K.find(c,'y',1.5)&&!K.find(c,'y',1),'mover grupo horizontalmente');
r=K.move(c,r,-5);assert(r.every(e=>near(e.t,0)||e.t>=0)&&K.all(c).every(e=>e.t>=0),'mover nao passa de 0');
assert(K.find(c,'x',0)&&near(K.find(c,'x',0).v,1),'keyframe movido sobre outro o substitui (valor do movido)');
r=K.move(c,[{p:'opacity',t:1.5}],99,10);assert(near(r[0].t,10),'mover respeita limite maximo');
// copiar/colar
c=mk();[['x',1,0.1],['x',2,0.9],['y',1,0.3]].forEach(([p,t,v])=>S.setKey(c,p,t,v,'ease'));
const cb=K.copy(c,[{p:'x',t:1},{p:'x',t:2},{p:'y',t:1}]);assert(cb.items.length===3&&near(cb.span,1),'copiar guarda 3 itens e span 1');
let pr=K.paste(c,cb,5);assert(pr.length===3&&near(K.find(c,'x',5).v,0.1)&&near(K.find(c,'x',6).v,0.9)&&K.find(c,'x',5).i==='ease'&&K.find(c,'y',5),'colar em 5s mantém valores, tempos relativos e interpolação');
pr=K.paste(c,cb,9.5,10);assert(pr.length===2||pr.length===3,'colar respeita o limite');
// duplicar
c=mk();[['x',1,0.1],['x',2,0.9]].forEach(([p,t,v])=>S.setKey(c,p,t,v,'bezier',[0.1,0.2,0.3,0.4]));
let d=K.duplicate(c,[{p:'x',t:1},{p:'x',t:2}],20,1/30);assert(d.length===2&&near(d[0].t,2.0333,0.01)&&c.keyframes.x.length===4||c.keyframes.x.length>=3,'duplicar poe copias depois do grupo');
assert(K.find(c,'x',d[1].t).h&&K.find(c,'x',d[1].t).h[2]===0.3,'duplicar copia as alcas');
// excluir
c=mk();[['x',1,0],['x',2,1],['y',1,0]].forEach(([p,t,v])=>S.setKey(c,p,t,v));
assert(K.remove(c,[{p:'x',t:1},{p:'y',t:1}])===2&&!c.keyframes.y&&c.keyframes.x.length===1,'excluir remove e limpa propriedade vazia');
assert(K.remove(c,[{p:'x',t:1}])===0,'excluir entrada inexistente nao faz nada');
// interpolacao em lote
c=mk();[['x',1,0],['x',2,1],['y',1,0]].forEach(([p,t,v])=>S.setKey(c,p,t,v));
K.setInterp(c,K.all(c),'easein');assert(K.all(c).every(e=>K.find(c,e.p,e.t).i==='easein'),'setInterp aplica em varios');
K.setHandles(c,{p:'x',t:1},[0.3,0.1,0.7,0.9]);assert(K.find(c,'x',1).i==='bezier'&&K.find(c,'x',1).h[1]===0.1,'setHandles converte para bezier');
K.setInterp(c,[{p:'x',t:1}],'linear');assert(!K.find(c,'x',1).h,'voltar a linear apaga alcas');
// valores com limites
assert(K.setValue(c,{p:'x',t:2},0.7)&&near(K.find(c,'x',2).v,0.7),'setValue');
c.keyframes.opacity=[{t:0,v:.5,i:'linear'}];K.setValue(c,{p:'opacity',t:0},5);assert(K.find(c,'opacity',0).v===1,'opacidade limitada a 1');
// navegacao
assert(near(K.step(c,null,1,1),2)&&near(K.step(c,null,1,-1),0),'navegar proximo/anterior');
// split preserva alcas
c=mk();c.duration=10;S.setKey(c,'x',0,0,'bezier',[0.1,0.9,0.9,0.1]);S.setKey(c,'x',8,1,'linear');S.setKey(c,'x',9,0,'bezier',[0.2,0.3,0.4,0.5]);
const n=S.splitClip(seq,c.id,5);assert(n&&n.keyframes.x.some(k=>k.i==='bezier'&&k.h&&k.h[0]===0.2),'cortar o clipe mantem alcas bezier no pedaco novo');
// duplicar clipe e JSON
const cl=S.cloneClip(c);assert(JSON.stringify(cl.keyframes.x[0].h)===JSON.stringify(c.keyframes.x[0].h),'clonar clipe mantem alcas');
console.log('ok');
