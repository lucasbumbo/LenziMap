// Canal seguro de IA no Electron REAL (Linux/Xvfb): chave fora da página, cofre, pedido via processo principal, cancelamento, CSP.
// Provedor = servidor falso local (LENZIMAP_AI_URL só vale fora do app empacotado). Rodar: xvfb-run -a node tests/electron-ai.js
const {_electron}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const path=require('path'),fs=require('fs'),os=require('os'),http=require('http');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const ELEC=process.env.ELECTRON_BIN||'/tmp/elt/node_modules/electron/dist/electron';
(async()=>{
 const KEY='sk-ELECTRON-SEGREDO-98765';let seen=[],slow=false;
 const srv=http.createServer((q,r)=>{let b='';q.on('data',d=>b+=d);q.on('end',()=>{seen.push({url:q.url,auth:q.headers.authorization,body:b});if(slow)return;r.writeHead(200,{'content-type':'application/json'});r.end(JSON.stringify({choices:[{message:{content:'{"ok":true}'}}],usage:{prompt_tokens:3,completion_tokens:2}}));});});
 await new Promise(r=>srv.listen(0,r));const port=srv.address().port;
 const ud=fs.mkdtempSync(path.join(os.tmpdir(),'lm-ai-'));
 const app=await _electron.launch({executablePath:ELEC,args:['--no-sandbox','--disable-gpu-sandbox','--user-data-dir='+ud,path.join(__dirname,'..')],env:Object.assign({},process.env,{LENZIMAP_AI_URL:'http://127.0.0.1:'+port+'/x'})});
 const win=await app.firstWindow();await win.waitForTimeout(1500);
 const has=await win.evaluate(()=>!!(window.api&&window.api.ai&&window.AiDirector&&window.AiDirectorPanel));assert(has,'Electron: window.api.ai e módulos do AI Director carregados');
 const st0=await win.evaluate(()=>window.api.ai.status());assert(st0.keys&&st0.keys.openai===false,'sem chave no início ('+JSON.stringify(st0)+')');
 assert(!(await win.evaluate(()=>window.api.ai.setKey('openai','abc'))).ok,'chave curta/inválida é recusada');
 assert(!(await win.evaluate(()=>window.api.ai.setKey('openai','com espaco no meio 12345'))).ok,'chave com espaço é recusada');
 assert(!(await win.evaluate(()=>window.api.ai.setKey('evil','sk-123456789'))).ok,'provedor desconhecido é recusado');
 let r=await win.evaluate(k=>window.api.ai.request('r0',{provider:'openai',prompt:'oi',system:'s'}),KEY);assert(!r.ok&&r.code==='no-key'&&seen.length===0,'sem chave: nada sai do computador');
 const sk=await win.evaluate(k=>window.api.ai.setKey('openai',k),KEY);assert(sk.ok,'chave aceita (cofre do sistema: '+sk.secure+')');
 const st1=await win.evaluate(()=>window.api.ai.status());assert(st1.keys.openai===true&&!JSON.stringify(st1).includes(KEY),'status diz que há chave, mas nunca a devolve à página');
 r=await win.evaluate(()=>window.api.ai.request('r1',{provider:'openai',prompt:'oi',system:'s',image:{b64:'QUJD',mime:'image/jpeg'}}));
 assert(r.ok&&r.text==='{"ok":true}'&&r.usage.input===3,'pedido passa pelo processo principal e volta com a resposta');
 assert(seen.length===1&&seen[0].auth==='Bearer '+KEY&&!seen[0].body.includes(KEY),'processo principal pôs a chave no cabeçalho; o corpo não tem a chave');
 assert(!JSON.stringify(r).includes(KEY),'resposta à página não contém a chave');
 // nada em disco em texto puro
 let leaked=false;(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);let s;try{s=fs.statSync(p)}catch(e){continue}if(s.isDirectory()){if(!/Cache|GPUCache|Code Cache|DawnCache/.test(f))walk(p)}else if(s.size<5e6&&fs.readFileSync(p).includes(KEY))leaked=p;}})(ud);
 assert(!leaked,'a chave não aparece em texto puro em nenhum arquivo do app'+(leaked?' ('+leaked+')':''));
 const ls=await win.evaluate(()=>JSON.stringify(localStorage));assert(!ls.includes(KEY),'a chave não está no localStorage');
 // CSP: a página não consegue falar com a rede
 const net=await win.evaluate(p=>fetch('http://127.0.0.1:'+p+'/x/openai',{method:'POST',body:'{}'}).then(()=>'saiu').catch(()=>'bloqueado'),port);assert(net==='bloqueado','a página não pode chamar a rede (CSP); só o processo principal chama');
 // cancelar
 slow=true;const pr=win.evaluate(()=>window.api.ai.request('slow1',{provider:'openai',prompt:'oi',system:'s',timeoutMs:20000}));await win.waitForTimeout(400);
 await win.evaluate(()=>window.api.ai.cancel('slow1'));const rc=await pr;assert(rc.code==='cancelled','cancelar interrompe o pedido em andamento');slow=false;
 // remover
 const st2=await win.evaluate(()=>window.api.ai.clearKey('openai'));assert(st2.keys.openai===false,'remover chave funciona');
 r=await win.evaluate(()=>window.api.ai.request('r2',{provider:'openai',prompt:'oi',system:'s'}));assert(r.code==='no-key','depois de remover, não envia mais');
 await app.close();srv.close();fs.rmSync(ud,{recursive:true,force:true});
})();
