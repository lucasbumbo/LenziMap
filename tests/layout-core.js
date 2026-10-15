// Lógica pura do layout (limites, workspaces, layouts salvos, sanitização de dados corrompidos).
const L=require('../layout-core.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
let s=L.defaults();assert(s.panelW===360&&s.workspace==='editing'&&s.showPanel&&s.showTimeline&&!s.max,'padrão');
for(const bad of [null,undefined,'x',5,[],{panelW:'abc',tlH:NaN,max:'xx',workspace:'zzz',showPanel:0,custom:5},{panelW:99999,tlH:-5}]){const r=L.sanitize(bad,900);
 assert(r.panelW>=280&&r.panelW<=640&&r.tlH>=190&&r.tlH<=Math.round(900*0.72)&&(r.max===null||r.max==='viewer'||r.max==='timeline')&&typeof r.custom==='object','sanitize seguro para '+JSON.stringify(bad));}
assert(L.sanitize({panelW:100},900).panelW===280&&L.sanitize({panelW:9999},900).panelW===640,'limites de largura');
assert(L.sanitize({tlH:9999},500).tlH===360,'altura máxima da timeline = 72% da janela');
assert(L.ORDER.join()==='editing,mapping,animation,audio,show','5 workspaces');
s=L.defaults();L.applyWorkspace(s,'mapping');assert(s.workspace==='mapping'&&!s.showTimeline&&s.tab==='camadas'&&!s.show,'Mapping: foco nas superfícies, sem timeline');
L.applyWorkspace(s,'animation');assert(s.tlH>=400&&s.tab==='timeline','Animation: timeline alta');
L.applyWorkspace(s,'audio');assert(s.workspace==='audio'&&s.showTimeline,'Audio');
L.applyWorkspace(s,'show');assert(s.show&&s.max==='viewer'&&!s.showPanel,'Show: Viewer maximizado e bloqueado');
assert(L.classes(s,true).join()==='lay-nopanel,lay-notl,lay-maxv,lay-show','classes do Show');
s=L.defaults();assert(L.classes(s,true).length===0&&L.classes(s,false).join()==='lay-notl','timeline desligada oculta o dock');
L.toggleMax(s,'timeline');assert(L.classes(s,true).includes('lay-maxtl')&&L.classes(s,true).includes('lay-nopanel'),'maximizar timeline');
L.toggleMax(s,'timeline');assert(s.max===null,'segundo pedido restaura');
s=L.defaults();s.panelW=500;s.tlH=250;s.showTimeline=false;const nm=L.saveCustom(s,'  Meu show  ');assert(nm==='Meu show'&&s.workspace==='custom','salvar layout com nome');
L.applyWorkspace(s,'editing');assert(s.panelW===360,'volta ao Editing');
assert(L.recallCustom(s,'Meu show')&&s.panelW===500&&s.tlH===250&&!s.showTimeline,'recuperar layout salvo');
assert(L.saveCustom(s,'   ')===null&&!L.recallCustom(s,'nao existe'),'nome vazio e layout inexistente');
assert(L.deleteCustom(s,'Meu show')&&!L.deleteCustom(s,'Meu show'),'apagar layout');
s=L.defaults();for(let i=0;i<20;i++){L.saveCustom(s,'L'+i);}const r=L.sanitize(JSON.parse(JSON.stringify(s)),900);assert(Object.keys(r.custom).length<=12,'no máximo 12 layouts salvos ao carregar');
s=L.defaults();s.panelW=600;s.custom.A={panelW:300,tlH:300,showPanel:true,showTimeline:true,tab:'camadas'};s=L.reset(s);assert(s.panelW===360&&s.custom.A,'restaurar padrão preserva layouts salvos');
