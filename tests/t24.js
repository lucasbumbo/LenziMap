// Face de cima vista de raspão: com o ajuste ligado fica preenchida em todos os instantes; desligado, o cálculo exato continua como antes
const {open}=require('./h.js');
let fails=0,n=0;function assert(c,m){n++;if(c)console.log('PASS '+m);else{fails++;console.log('FAIL '+m);}}
(async()=>{
 const h=await open(8934),p=h.p;
 const r=await p.evaluate(()=>{
  const C=window.IllusionCore,G=window.IllusionGL,out={};
  const mk=(assist)=>{const x=C.defaultIllusion('infinite-tunnel');x.camera.assist=assist;return C.validate(x,null).value;};
  const lit=(il,f,t)=>{const rig=C.defaultStage();const c=G.faceTexture(rig,il,null,'A',f,t,200);const d=c.getContext('2d').getImageData(0,0,200,200).data;let k=0;for(let i=3;i<d.length;i+=4)if(d[i]>20)k++;return k/400;};
  out.def=C.validate(C.defaultIllusion('infinite-tunnel'),null).value.camera.assist;
  out.old=C.validate({v:C.VERSION,preset:'infinite-tunnel',camera:{view:'audience',fov:35}},null).value.camera.assist;
  out.on=[0.2,0.7,1.2,1.7,2.2,2.7].map(t=>lit(mk(true),'top',t));
  out.off=[0.2,0.7,1.2,1.7,2.2,2.7].map(t=>lit(mk(false),'top',t));
  out.front=[0.2,0.7].map(t=>[lit(mk(true),'front',t),lit(mk(false),'front',t)]);
  return out;
 });
 console.log(JSON.stringify(r));
 assert(r.def===true&&r.old===true,'padrão e projetos antigos: ajuste da face de cima ligado');
 assert(Math.min.apply(null,r.on)>15,'ligado: face de cima sempre preenchida (mín '+Math.round(Math.min.apply(null,r.on))+'%)');
 assert(Math.min.apply(null,r.off)<1,'desligado: cálculo exato como antes (pisca, mín '+Math.round(Math.min.apply(null,r.off))+'%)');
 assert(r.front.every(a=>Math.abs(a[0]-a[1])<0.01),'face da frente não muda');
 assert(h.errs.length===0,'erros de página: nenhum');
 await h.close();console.log(n+' testes, '+fails+' falhas');process.exit(fails?1:0);
})();
