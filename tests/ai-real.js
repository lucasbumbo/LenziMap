// Teste com IA REAL (opcional). Só roda se houver chave em OPENAI_API_KEY ou ANTHROPIC_API_KEY e rede liberada.
// Sem chave: NÃO inventa resultado. Imprime "PENDENTE" e sai com 0. O que ele faz com chave:
//  1) plano de timeline a partir de texto; 2) ilusão 3D a partir de texto; ambos validados pelos mesmos validadores do app.
// Uso: OPENAI_API_KEY=sk-... node tests/ai-real.js   (ou ANTHROPIC_API_KEY=...)
const path=require('path');const A=p=>require(path.join(__dirname,'..','ai',p));
const Seq=require('../sequence.js');global.Sequence=Seq;global.AiSchema=A('ai-schema.js');
const IC=require('../illusion-core.js');global.IllusionCore=IC;global.IllusionTimeline=require('../illusion-timeline.js');
const reg={};global.Textures={register:(id)=>{reg[id]=1},util:{h2:()=>0.5}};A('ai-effects.js');global.AiEffects=globalThis.AiEffects;
const Prov=A('ai-provider.js'),SV=A('shader-validator.js'),AP=A('animation-planner.js'),AIL=A('ai-illusion.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const prov=process.env.OPENAI_API_KEY?'openai':process.env.ANTHROPIC_API_KEY?'anthropic':null;
(async()=>{
 // caminho de integração (sempre roda, sem rede): os pedidos são montados e a chave não vaza para o corpo
 const rq=AIL.request('sala infinita azul',{stage:IC.defaultStage()});
 const b=Prov.buildRequest('openai',{model:'',system:rq.system,prompt:rq.prompt,image:null});
 assert(b&&b.body.messages.length===2&&b.auth.header==='Authorization'&&b.body.messages[0].content.includes('SOMENTE com JSON'),'integração: pedido 3D montado para o provedor (a chave só entra no cabeçalho, no processo principal)');
 if(!prov){console.log('PENDENTE: sem OPENAI_API_KEY/ANTHROPIC_API_KEY neste ambiente. O teste com IA real NÃO foi executado e nenhum resultado foi inventado. Rode com uma chave para completar.');return;}
 const key=process.env.OPENAI_API_KEY||process.env.ANTHROPIC_API_KEY;
 // 1) ilusão 3D
 let r=await Prov.call({provider:prov,model:'',key,system:rq.system,prompt:rq.prompt,image:null,timeoutMs:60000});
 assert(r.ok,'IA real respondeu ao pedido de ilusão ('+(r.error||'ok')+')');
 if(r.ok){const pr=AIL.parseResponse(r.text,{stage:IC.defaultStage()});assert(pr.ok,'resposta real passa no validador 3D ('+(pr.errors||[]).join(' ')+')');console.log('  preset:',pr.plan&&pr.plan.il.preset,'avisos:',pr.warnings.length);}
 // 2) plano de timeline
 const ids=A('ai-effects.js')&&global.AiEffects.ids;const req=AP.planRequest('faça a estátua ganhar olhos brilhantes e depois virar ouro',{surfaces:[{key:'k1',name:'Superfície 1'}]});
 r=await Prov.call({provider:prov,model:'',key,system:req.system,prompt:req.prompt,image:null,timeoutMs:60000});
 assert(r.ok,'IA real respondeu ao pedido de plano ('+(r.error||'ok')+')');
 if(r.ok){const pp=AP.parsePlanResponse(r.text,{effectIds:ids,validateGlsl:SV.validate,surfaceKeys:['k1']});assert(pp.ok,'resposta real passa no validador de plano ('+(pp.errors||[]).join(' ')+')');}
})().catch(e=>{console.log('FAIL exceção',e.message);process.exit(1);});
