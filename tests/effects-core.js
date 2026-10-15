// Fase 9 (núcleo puro): catálogo, validação, mesclagem, cálculo determinístico da pilha, keyframes de intensidade e persistência no clipe.
const EC=require('../effects-core.js');const Seq=require('../sequence.js');
let fails=0;const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c){fails++;process.exitCode=1;}};
// catálogo
assert(['glow','blur','glitch','noise','chroma','displace','pixelate','strobe'].every(k=>EC.TYPES[k]),'catálogo tem Glow, Blur, Glitch, Noise, Chromatic Aberration, Displacement, Pixelate e Strobe');
assert(EC.GENERATORS.some(g=>g.group==='Particles')&&EC.GENERATORS.every(g=>g.id&&g.name),'Particles e demais geradores apontam para efeitos existentes');
assert(EC.BLENDS.map(b=>b.id).join()==='normal,add,screen,multiply,overlay','mesclagens: Normal, Add, Screen, Multiply, Overlay');
assert(EC.cssBlend('add')==='plus-lighter'&&EC.canvasBlend('add')==='lighter'&&EC.cssBlend('overlay')==='overlay'&&EC.cssBlend('xx')==='normal','mapeamento CSS e canvas das mesclagens');
assert(EC.fixBlend('Screen')==='normal'&&EC.fixBlend('screen')==='screen','mesclagem inválida volta para Normal');
// criação e validação
const g=EC.create('glow');assert(g.type==='glow'&&g.on===true&&g.amount===0.6&&g.size===16&&/^e/.test(g.id),'cria efeito com padrões');
assert(EC.create('nope')===null,'tipo inexistente recusado');
const sx=EC.sanitize([{type:'blur',amount:5},{type:'evil'},null,{type:'glow',id:'a b',amount:-1,size:999},{type:'blur',id:'dup'},{type:'blur',id:'dup'}]);
assert(sx.length===4&&sx[0].amount===1&&sx[1].amount===0&&sx[1].size===60,'sanitize limita valores e descarta inválidos');
assert(new Set(sx.map(e=>e.id)).size===4,'ids únicos (ids inválidos ou repetidos são refeitos)');
const many=EC.sanitize(Array.from({length:20},()=>({type:'blur'})));assert(many.length===EC.MAX_EFX,'máximo de '+EC.MAX_EFX+' efeitos por clipe');
assert(EC.sanitize('x').length===0&&EC.sanitize(undefined).length===0,'entrada inválida vira lista vazia');
// cálculo
const e=Object.assign(EC.create('blur'),{id:'b1',amount:0.5});
let r=EC.evalOne(e,0.5,0,'c1');assert(r.css==='blur(20.00px)'&&!r.def&&r.opacity===1,'Blur 50% = 20 px');
assert(EC.evalOne(e,0,0,'c1').css===''&&EC.evalOne(Object.assign({},e,{on:false}),1,0,'c1').css==='','intensidade 0 ou efeito desligado não gera filtro');
for(const t of ['glow','chroma','displace','pixelate','noise','glitch']){
 const ef=Object.assign(EC.create(t),{id:'x1'});const o=EC.evalOne(ef,0.7,1.3,'cl9');
 assert(o.css==='url(#lmfx-cl9-x1)'&&o.def&&o.def.id==='lmfx-cl9-x1'&&o.def.markup.indexOf('<filter id="lmfx-cl9-x1"')===0&&o.def.markup.slice(-9)==='</filter>',t+': filtro SVG com id estável');
 assert(o.def.markup===EC.evalOne(ef,0.7,1.3,'cl9').def.markup,t+': determinístico (mesmo tempo, mesmo filtro)');
}
assert(/stdDeviation="[\d.]+"/.test(EC.evalOne(Object.assign(EC.create('glow'),{id:'g'}),1,0,'c').def.markup)&&/feBlend[^>]+screen/.test(EC.evalOne(Object.assign(EC.create('glow'),{id:'g'}),1,0,'c').def.markup),'Glow: desfoque das altas luzes + screen');
assert(EC.evalOne(Object.assign(EC.create('glow'),{id:'g'}),1,0,'c').def.markup!==EC.evalOne(Object.assign(EC.create('glow'),{id:'g'}),0.2,0,'c').def.markup,'Glow muda com a intensidade');
const ch=EC.evalOne(Object.assign(EC.create('chroma'),{id:'c',angle:0}),1,0,'c').def.markup;assert(/dx="24.00"/.test(ch)&&/dx="-24.00"/.test(ch),'Chromatic Aberration: R e B deslocam em sentidos opostos (24 px a 100%)');
const px=EC.evalOne(Object.assign(EC.create('pixelate'),{id:'p'}),1,0,'c').def.markup;assert(/width="60" height="60"/.test(px)&&/feMorphology[^>]+radius="30"/.test(px),'Pixelate 100% = blocos de 60 px');
const nz0=EC.evalOne(Object.assign(EC.create('noise'),{id:'n',speed:1}),0.5,0,'c').def.markup,nz1=EC.evalOne(Object.assign(EC.create('noise'),{id:'n',speed:1}),0.5,0.5,'c').def.markup;assert(nz0!==nz1,'Noise anima com o tempo');
const nzs=EC.evalOne(Object.assign(EC.create('noise'),{id:'n',speed:0}),0.5,0,'c').def.markup,nzs2=EC.evalOne(Object.assign(EC.create('noise'),{id:'n',speed:0}),0.5,9,'c').def.markup;assert(nzs===nzs2,'Noise com velocidade 0 fica parado');
// strobe: onda quadrada
const st=Object.assign(EC.create('strobe'),{rate:5,amount:0.8});
const vals=[0,0.05,0.1,0.15,0.2,0.25,0.3,0.35].map(t=>EC.evalOne(st,0.8,t,'c').opacity);assert(vals[0]===1&&Math.abs(vals[2]-0.2)<1e-9&&vals[4]===1,'Strobe alterna entre 100% e '+(100-80)+'% a 5 Hz ('+vals.join(',')+')');
// pilha
const stack=EC.evalStack([Object.assign(EC.create('blur'),{id:'b',amount:0.25}),Object.assign(EC.create('glow'),{id:'g'}),Object.assign(EC.create('strobe'),{id:'s'})],id=>({b:0.25,g:0.6,s:0.8}[id]),0.12,'cc');
assert(stack.filter==='blur(10.00px) url(#lmfx-cc-g)'&&stack.defs.length===1&&stack.opacity<1&&stack.active,'pilha: filtros em ordem, 1 definição SVG e opacidade do strobe');
const sk=EC.evalStack([Object.assign(EC.create('glow'),{id:'g'}),Object.assign(EC.create('blur'),{id:'b',amount:.5})],null,0,'cc',{glow:true});assert(sk.filter==='blur(20.00px)'&&sk.defs.length===0,'modo de desempenho pode pular tipos');
assert(!EC.evalStack([],null,0,'c').active&&EC.evalStack(null,null,0,'c').filter==='','pilha vazia não faz nada');
// integração com a Sequência: persistência, keyframes de intensidade, evalClip
const seq=Seq.create({});const a=Seq.addAsset(seq,{kind:'fx',name:'Fx',fx:{kind:'grade',color:'#fff',speed:1,scale:1}});const L=Seq.addLayer(seq,'k1','L');const cl=Seq.addClip(seq,L.id,a,0,4);
const eg=EC.create('glow'),eb=EC.create('blur');cl.efx=[eg,eb];cl.blend='add';
Seq.setKey(cl,'ef.'+eg.id,0,0);Seq.setKey(cl,'ef.'+eg.id,2,1);
let ev=Seq.evalClip(cl,a,1);assert(Math.abs(ev.efx[0].amount-0.5)<1e-9&&ev.blend==='add'&&ev.efx.length===2,'evalClip: intensidade com keyframe (50% em 1 s) e mesclagem');
const j=JSON.parse(JSON.stringify(seq));const m=Seq.migrate(j);const c2=m.tracks[0].clips[0];
assert(c2.efx.length===2&&c2.efx[0].id===eg.id&&c2.blend==='add'&&c2.keyframes['ef.'+eg.id].length===2,'salvar/reabrir (migrate) mantém efeitos, mesclagem e keyframes');
const bad=JSON.parse(JSON.stringify(seq));bad.tracks[0].clips[0].keyframes['ef.naoexiste']=[{t:0,v:1,i:'linear'}];bad.tracks[0].clips[0].blend='burn';bad.tracks[0].clips[0].efx.push({type:'evil'});
const mb=Seq.migrate(bad).tracks[0].clips[0];assert(!mb.keyframes['ef.naoexiste']&&mb.blend===undefined&&mb.efx.length===2,'keyframe órfão, mesclagem e efeito inválidos são limpos');
const old=Seq.migrate(JSON.parse(JSON.stringify(Object.assign({},seq,{tracks:seq.tracks.map(t=>Object.assign({},t,{clips:t.clips.map(c=>{const o=JSON.parse(JSON.stringify(c));delete o.efx;delete o.blend;return o;})}))}))));
const oc=old.tracks[0].clips[0];assert(!oc.efx&&!oc.blend&&Seq.evalClip(oc,a,1).efx===null&&Seq.evalClip(oc,a,1).blend==='normal','clipe antigo (sem efeitos) continua igual');
const cc=Seq.cloneClip?Seq.cloneClip(cl):JSON.parse(JSON.stringify(cl));assert(cc.efx&&cc.efx.length===2,'duplicar clipe leva os efeitos');
assert(Seq.baseValue(cl,'ef.'+eb.id)===eb.amount&&(Seq.setBase(cl,'ef.'+eb.id,0.9),eb.amount===0.9),'baseValue/setBase de intensidade');
console.log(fails?'HA FALHAS':'ok');
