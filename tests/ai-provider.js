// Provedores de IA contra um servidor falso local: formato dos pedidos, erros, timeout, cancelamento e segredo da chave.
const http=require('http'),path=require('path');const P=require(path.join(__dirname,'..','ai','ai-provider.js'));
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
(async()=>{
 let mode='ok',seen=null;const KEY='sk-TESTKEY-123456789';
 const srv=http.createServer((q,r)=>{let b='';q.on('data',d=>b+=d);q.on('end',()=>{seen={url:q.url,headers:q.headers,body:b};
  if(mode==='401'){r.writeHead(401);return r.end('{"error":"bad key '+KEY+'"}');}if(mode==='429'){r.writeHead(429);return r.end('{}');}if(mode==='500'){r.writeHead(500);return r.end('boom');}
  if(mode==='html'){r.writeHead(200,{'content-type':'text/html'});return r.end('<html>');}if(mode==='empty'){r.writeHead(200);return r.end('{"choices":[]}');}
  if(mode==='slow'){return;}
  r.writeHead(200,{'content-type':'application/json'});
  if(q.url.endsWith('openai'))r.end(JSON.stringify({choices:[{message:{content:'{"ok":1}'}}],usage:{prompt_tokens:10,completion_tokens:5}}));else r.end(JSON.stringify({content:[{type:'text',text:'{"ok":2}'}],usage:{input_tokens:7,output_tokens:3}}));});});
 await new Promise(r=>srv.listen(0,r));const base='http://127.0.0.1:'+srv.address().port;
 const img={b64:Buffer.from('x'.repeat(100)).toString('base64'),mime:'image/jpeg'};
 const base1={provider:'openai',key:KEY,system:'sys',prompt:'oi',image:img,baseUrl:base};
 let r=await P.call(base1);assert(r.ok&&r.text==='{"ok":1}'&&r.usage.input===10,'OpenAI: resposta lida e uso contado');
 const b1=JSON.parse(seen.body);assert(seen.headers.authorization==='Bearer '+KEY&&!seen.body.includes(KEY),'OpenAI: chave só no cabeçalho, nunca no corpo');
 assert(b1.messages[1].content.some(c=>c.type==='image_url'&&c.image_url.url.startsWith('data:image/jpeg;base64,'))&&b1.response_format.type==='json_object','OpenAI: imagem e JSON estruturado no pedido');
 r=await P.call(Object.assign({},base1,{provider:'anthropic'}));assert(r.ok&&r.text==='{"ok":2}','Anthropic: resposta lida');
 const b2=JSON.parse(seen.body);assert(seen.headers['x-api-key']===KEY&&seen.headers['anthropic-version']&&b2.messages[0].content[0].type==='image'&&!seen.body.includes(KEY),'Anthropic: cabeçalhos e imagem corretos, chave fora do corpo');
 for(const [m,code,re] of [['401','http',/recusou a chave/],['429','http',/Limite de uso/],['500','http',/problema agora/],['html','bad-response',/formato inesperado/],['empty','bad-response',/formato inesperado/]]){
  mode=m;r=await P.call(base1);assert(!r.ok&&r.code===code&&re.test(r.error),'erro '+m+' vira mensagem clara');assert(!JSON.stringify(r).includes(KEY),'erro '+m+' não vaza a chave');}
 mode='slow';let t0=Date.now();r=await P.call(Object.assign({},base1,{timeoutMs:300}));assert(r.code==='timeout'&&Date.now()-t0<2000,'timeout encerra o pedido');
 const ac=new AbortController();setTimeout(()=>ac.abort(),150);r=await P.call(Object.assign({},base1,{signal:ac.signal,timeoutMs:5000}));assert(r.code==='cancelled','cancelamento pelo usuário');
 srv.closeAllConnections();srv.close();r=await P.call(Object.assign({},base1,{timeoutMs:2000}));assert(r.code==='offline'&&/Sem conexão/.test(r.error),'falha de conexão: mensagem clara, sem travar');
 r=await P.call(Object.assign({},base1,{key:null}));assert(r.code==='no-key','sem chave: avisa antes de qualquer envio');
 r=await P.call(Object.assign({},base1,{image:{b64:'A'.repeat(6*1024*1024),mime:'image/png'}}));assert(r.code==='bad-request'&&/grande demais/.test(r.error),'imagem acima do limite não é enviada');
 r=await P.call(Object.assign({},base1,{provider:'nope'}));assert(!r.ok,'provedor desconhecido recusado');
 assert(!JSON.stringify(P.PROVIDERS).includes('sk-'),'nenhuma chave no código dos provedores');
})();
