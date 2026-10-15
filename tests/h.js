// harness compartilhado: servidor estatico + pagina de controle com api falsa
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||path.join(__dirname,'..'), MEDIA=__dirname+'/media';
const mt={'.html':'text/html','.js':'text/javascript','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.wav':'audio/wav','.css':'text/css'};
function serve(port){return new Promise(res=>{const s=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);let f=u.startsWith('/media/')?path.join(MEDIA,u.slice(7)):path.join(ROOT,u==='/'?'control.html':u);
 fs.stat(f,(e,st)=>{if(e||!st.isFile()){r.writeHead(404);r.end();return;}const type=mt[path.extname(f)]||'application/octet-stream';const rg=q.headers.range;
  if(rg){const m=/bytes=(\d*)-(\d*)/.exec(rg);const a=+m[1]||0,b=m[2]?+m[2]:st.size-1;r.writeHead(206,{'content-type':type,'content-range':`bytes ${a}-${b}/${st.size}`,'accept-ranges':'bytes','content-length':b-a+1});fs.createReadStream(f,{start:a,end:b}).pipe(r);}
  else{r.writeHead(200,{'content-type':type,'accept-ranges':'bytes','content-length':st.size});fs.createReadStream(f).pipe(r);}});}).listen(port,()=>res(s));});}
async function open(port,opts={}){
 const srv=await serve(port);
 const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'].concat(opts.args||[])});
 const ctx=await b.newContext({viewport:{width:opts.w||1440,height:opts.h||900}});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('console:'+m.text());});
 await p.addInitScript((port)=>{try{localStorage.setItem('lenzi-onboarded','1')}catch(e){}
  window.__sent={state:0,tr:[]};
  window.api={displays:()=>Promise.resolve([{id:1,primary:true,bounds:{width:1440,height:900}}]),openOutput:()=>Promise.resolve(true),closeOutput:()=>Promise.resolve(),onOutputClosed:()=>{},onResend:()=>{},
   sendState:(s)=>{window.__sent.state++;window.__lastState=s;},sendTransport:(t)=>{window.__sent.tr.push(t);},sendLevel:()=>{},setShowMode:(on)=>{window.__showMode=on;},libraryApp:()=>Promise.resolve([]),libraryFolder:()=>Promise.resolve([]),
   toUrl:x=>x.startsWith('/')?('http://localhost:'+port+x):x,pathFor:()=>'',askMedia:()=>Promise.resolve(true),saveProject:(j)=>{window.__saved=j;return Promise.resolve('/x.mapa')},openProject:()=>Promise.resolve(window.__openJson||null),openMedia:()=>Promise.resolve([]),saveRecording:()=>Promise.resolve()};
 },port);
if(!opts.easy)await p.addInitScript(()=>{try{localStorage.setItem('lenzi-il-adv','1')}catch(e){}});
 await p.goto('http://localhost:'+port+'/control.html');await p.waitForTimeout(900);
 return {p,b,srv,errs,close:async()=>{await b.close();srv.close();}};
}
module.exports={open,serve};
