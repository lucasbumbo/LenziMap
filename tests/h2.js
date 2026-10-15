// controle + saida ligados por "IPC" simulado (JSON), como no Electron
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const {serve}=require('./h.js');
async function openPair(port,opts={}){
 const srv=await serve(port);
 const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});
 const p=await ctx.newPage(), o=await ctx.newPage();const errs=[],oerrs=[];
 p.on('pageerror',e=>errs.push(e.message));o.on('pageerror',e=>oerrs.push(e.message));
 let outReady=false,pending=[];
 let chain=Promise.resolve();
 await p.exposeFunction('__toOut',(kind,json)=>{ chain=chain.then(async()=>{ if(!outReady)return; try{await o.evaluate(([k,j])=>window.__fromCtl(k,j),[kind,json]);}catch(e){} }); return chain; });
 await p.addInitScript((port)=>{try{localStorage.setItem('lenzi-onboarded','1')}catch(e){}
  window.__sent={state:0,tr:0};
  window.api={displays:()=>Promise.resolve([{id:1,primary:true,bounds:{width:1440,height:900}}]),openOutput:()=>Promise.resolve(true),closeOutput:()=>Promise.resolve(),onOutputClosed:()=>{},onResend:(cb)=>{window.__resend=cb;},
   sendState:(s)=>{window.__sent.state++;window.__lastState=s;window.__toOut('state',JSON.stringify(s));},sendTransport:(t)=>{window.__sent.tr++;window.__toOut('transport',JSON.stringify(t));},sendLevel:()=>{},setShowMode:(on)=>{window.__showMode=on;},libraryApp:()=>Promise.resolve([]),libraryFolder:()=>Promise.resolve([]),
   toUrl:x=>x.startsWith('/')?('http://localhost:'+port+x):x,pathFor:()=>'',askMedia:()=>Promise.resolve(true),saveProject:(j)=>{window.__saved=j;return Promise.resolve('/x.mapa')},openProject:()=>Promise.resolve(window.__openJson||null),openMedia:()=>Promise.resolve([]),saveRecording:()=>Promise.resolve()};
 },port);
 await o.addInitScript(()=>{window.__cb={};window.api={onState:(f)=>{window.__cb.state=f},onLevel:(f)=>{window.__cb.level=f},onTransport:(f)=>{window.__cb.tr=f},outputReady:()=>{}};
  window.__fromCtl=(k,j)=>{const v=JSON.parse(j);if(k==='state'&&window.__cb.state)window.__cb.state(v);if(k==='transport'&&window.__cb.tr)window.__cb.tr(v);};});
 await o.setViewportSize({width:1440,height:810});
 await o.goto('http://localhost:'+port+'/output.html');await o.waitForTimeout(300);outReady=true;
if(!opts.easy)await p.addInitScript(()=>{try{localStorage.setItem('lenzi-il-adv','1')}catch(e){}});
 await p.goto('http://localhost:'+port+'/control.html');await p.waitForTimeout(900);
 await p.evaluate(()=>{window.__resend&&window.__resend();});
 return {p,o,b,srv,errs,oerrs,close:async()=>{await b.close();srv.close();}};
}
module.exports={openPair};
