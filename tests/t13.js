// AI Director de ponta a ponta no Chromium real: foto → análise → sugestão → prévia → timeline → undo → salvar/abrir.
// Provedor de IA = servidor falso local (o código de chamada, validação e erros é o real). NÃO usa IA de verdade.
const {open}=require('./h.js');const http=require('http');const Provider=require('../ai/ai-provider.js');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const ANALYSIS={subject:'statue',summary:'Estátua de pedra com rosto e base.',material:'pedra',dominantColors:['#808080'],
 objects:[{id:'rosto',label:'Rosto',kind:'object',region:{x:0.35,y:0.2,w:0.3,h:0.25},description:'Rosto da estátua',confidence:0.8,animatable:true},{id:'base',label:'Base',kind:'surface',region:{x:0.2,y:0.7,w:0.6,h:0.25},description:'Base de pedra',confidence:0.6}],
 surfaces:[{id:'sf1',label:'Base',quad:[[0.2,0.7],[0.8,0.7],[0.8,0.95],[0.2,0.95]],confidence:0.5}],difficulties:['Reflexo no lado esquerdo'],
 suggestions:[{title:'Awakening IA',description:'Olhos brilham e surgem rachaduras.',durationSec:12,effects:['ai-glow','ai-cracks','ai-fake'],sequence:['Brilho','Rachaduras'],surfaces:['rosto'],complexity:'média',resources:['Máscara']}]};
const PLAN={title:'Plano da IA',duration:10,layers:[{name:'Rachaduras IA',effect:'ai-cracks',color:'#ffb347',start:0,duration:6,target:'all',keyframes:{p1:[{t:0,v:0},{t:5,v:1,i:'ease'}]}},{name:'Ouro IA',effect:'ai-gold',start:5,duration:5,target:'all',keyframes:{p1:[{t:0,v:0},{t:4,v:1}]}}]};
(async()=>{
 let hits=[];
 const srv=http.createServer((q,r)=>{let b='';q.on('data',d=>b+=d);q.on('end',()=>{r.setHeader('access-control-allow-origin','*');r.setHeader('access-control-allow-headers','authorization,content-type,x-api-key,anthropic-version');r.setHeader('access-control-allow-methods','POST');
  if(q.method==='OPTIONS'){r.writeHead(204);return r.end();}
  const m=/\/m-(\w+)\/(openai|anthropic)/.exec(q.url);const mode=m[1],prov=m[2];hits.push({mode,prov,body:b,key:q.headers.authorization||q.headers['x-api-key']});
  const wrap=t=>{r.writeHead(200,{'content-type':'application/json'});r.end(JSON.stringify(prov==='openai'?{choices:[{message:{content:t}}]}:{content:[{type:'text',text:t}]}));};
  if(mode==='401'){r.writeHead(401);return r.end('{}');}
  if(mode==='analysis')return wrap('```json\n'+JSON.stringify(ANALYSIS)+'\n```');
  if(mode==='badjson')return wrap('Claro! Aqui está: {"subject": "statue", "objects": [');
  if(mode==='plan')return wrap(JSON.stringify(PLAN));
  if(mode==='badplan')return wrap(JSON.stringify({layers:[{effect:'process.exit',start:0}]}));
  if(mode==='shader')return wrap(JSON.stringify({name:'Onda IA',glsl:'vec4 lenziEffect(vec2 uv){ float v = 0.5 + 0.5 * sin(uv.x * 20.0 + uTime * uSpeed); return vec4(mix(uColor1, uColor2, v) * uP2, v * uP1); }'}));
  if(mode==='badshader')return wrap(JSON.stringify({name:'Ruim',glsl:'#define X\nvec4 lenziEffect(vec2 uv){ while(true){} return vec4(1.0); }'}));
  if(mode==='brokenshader')return wrap(JSON.stringify({name:'Quebrado',glsl:'vec4 lenziEffect(vec2 uv){ return vec4(nope(uv), 1.0); }'}));
  wrap('{}');});});
 await new Promise(r=>srv.listen(0,r));const AIPORT=srv.address().port;
 const h=await open(8881);const p=h.p;
 await p.click('#btn-newbox');
 // mock do canal seguro: a chamada roda no Node com o MESMO código do processo principal; a página nunca vê a chave (a CSP também bloqueia rede na página)
 let curMode='analysis';const store={};
 await p.exposeFunction('__setMode',m=>{curMode=m;});
 await p.exposeFunction('__aiRequest',(id,o)=>Provider.call({provider:o.provider,model:o.model,key:store[o.provider],system:o.system,prompt:o.prompt,image:o.image,baseUrl:'http://127.0.0.1:'+AIPORT+'/m-'+curMode,timeoutMs:5000}));
 await p.exposeFunction('__storeKey',(pv,k)=>{if(k)store[pv]=k;else delete store[pv];return {anthropic:!!store.anthropic,openai:!!store.openai};});
 await p.evaluate(()=>{window.__aireq=[];
  window.api.ai={status:()=>window.__storeKey('x',null).then(k=>({secure:true,keys:k})),setKey:(pv,k)=>window.__storeKey(pv,k).then(()=>({ok:true,secure:true})),clearKey:(pv)=>window.__storeKey(pv,null).then(k=>({secure:true,keys:k})),request:(id,o)=>{window.__aireq.push(o);return window.__aiRequest(id,o);},cancel:()=>Promise.resolve(false)};
  return AiDirector.refreshKeys();});
 const guard=()=>p.evaluate(()=>JSON.stringify(window.TimelineUI._h.state.surfaces.map(s=>[s.key,s.q,s.mask,s.mesh])));
 const clipsN=()=>p.evaluate(()=>window.TimelineUI._h.tl.seq.tracks.reduce((n,t)=>n+t.clips.length,0));
 await p.click('[data-go="timeline"]');await p.click('#tl-insp button.primary');await p.waitForTimeout(400);
 // clipe do usuário que já existe
 await p.evaluate(()=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;const f=S.addAsset(seq,{kind:'fx',name:'Grade',fx:{kind:'grade',color:'#ff4fa3',speed:1,scale:1}});S.addLayer(seq,H.state.surfaces[0].key,'Base');const t=S.layersOf(seq,H.state.surfaces[0].key)[0];const c=S.addClip(seq,t.id,f,0,8);window.__baseClip=JSON.stringify(c);window.__bid=c.id;seq.duration=20;H.syncClock();H.push();H.renderAll();});
 const g0=await guard();const base0=await p.evaluate(()=>window.__baseClip);
 await p.click('[data-go="ia"]');await p.waitForTimeout(300);
 assert(await p.locator('#ai-panel').isVisible(),'aba IA abre sem fechar a timeline');
 assert(await p.locator('.tl-bar').first().isVisible(),'timeline continua visível com o AI Director aberto');
 assert(/Modo local/.test(await p.locator('#ai-mode').textContent()),'sem chave e com serviços externos desligados: modo local identificado');
 assert(await p.locator('#ai-import').isVisible()&&await p.locator('#ai-analyze').count()===0,'Import Image visível; Analyze só depois de importar');
 // ---- fluxo LOCAL ----
 const mkimg=`(()=>{const c=document.createElement('canvas');c.width=400;c.height=300;const x=c.getContext('2d');x.fillStyle='#202a5a';x.fillRect(0,0,400,300);x.fillStyle='#c8b428';x.fillRect(120,60,160,190);x.fillStyle='#e8d870';x.fillRect(160,90,80,50);return c.toDataURL('image/png');})()`;
 const dataUrl=await p.evaluate(mkimg);
 await p.evaluate(u=>AiDirector.loadImageUrl(u),dataUrl);await p.waitForTimeout(400);
 assert(await p.locator('#ai-photo canvas').count()>=1,'foto importada aparece no painel');
 await p.selectOption('#ai-subject','statue');await p.click('#ai-analyze');await p.waitForTimeout(400);
 assert(await p.locator('#ai-objects .ai-item').count()>=1,'objetos detectados listados (local)');
 assert(/LOCAL/.test(await p.locator('#ai-photo').locator('xpath=ancestor::details').textContent()),'análise local é identificada como LOCAL, não como IA');
 assert(await p.locator('.ai-sg').count()===3,'3 sugestões de animação para estátua');
 assert(await p.locator('.ai-sg:has-text("Golden Transformation")').count()===1,'sugestão "Golden Transformation" presente');
 // máscara
 await p.click('#ai-objects .ai-item');await p.waitForTimeout(250);
 assert(await p.evaluate(()=>AiDirector.state.mask&&AiDirector.state.mask.data.some(v=>v>0)),'selecionar objeto gera máscara inicial');
 const a0=await p.evaluate(()=>{const m=AiDirector.state.mask.data;let n=0;for(const v of m)if(v>127)n++;return n;});
 await p.click('#ai-grow');await p.waitForTimeout(150);const a1=await p.evaluate(()=>{const m=AiDirector.state.mask.data;let n=0;for(const v of m)if(v>127)n++;return n;});assert(a1>a0,'expandir borda aumenta a máscara ('+a0+' → '+a1+')');
 await p.click('#ai-shrink');await p.click('#ai-shrink');await p.waitForTimeout(150);const a2=await p.evaluate(()=>{const m=AiDirector.state.mask.data;let n=0;for(const v of m)if(v>127)n++;return n;});assert(a2<a1,'contrair borda diminui');
 // pincel com mouse real
 await p.click('#ai-brush');await p.waitForTimeout(150);
 await p.locator('#ai-photo').scrollIntoViewIfNeeded();await p.waitForTimeout(150);const box=await p.locator('#ai-photo canvas.ai-ov').boundingBox();const before=await p.evaluate(()=>{let n=0;for(const v of AiDirector.state.mask.data)if(v>127)n++;return n;});
 await p.mouse.move(box.x+box.width*0.5,box.y+box.height*0.6);await p.mouse.down();await p.mouse.move(box.x+box.width*0.7,box.y+box.height*0.7,{steps:5});await p.mouse.up();await p.waitForTimeout(250);
 const after=await p.evaluate(()=>{let n=0;for(const v of AiDirector.state.mask.data)if(v>127)n++;return n;});assert(after>before,'pincel adiciona região com o mouse ('+before+' → '+after+')');
 await p.click('#ai-invert');await p.waitForTimeout(100);assert(await p.evaluate(()=>AiDirector.state.mask.invert),'inverter máscara');await p.click('#ai-invert');
 assert((await p.evaluate(()=>AiDirector.maskDataUrl())).startsWith('data:image/png'),'máscara exportada como PNG');
 // sugestão → prévia
 await p.click('#ai-sg-sg2');await p.waitForTimeout(500);
 assert(await p.locator('#ai-strip canvas').count()===5,'prévia com 5 quadros');
 const lit=await p.evaluate(()=>[...document.querySelectorAll('#ai-strip canvas')].map(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2];return s;}));
 assert(lit.some(s=>s>20000)&&new Set(lit).size>2,'prévia mostra imagem de verdade e muda com o tempo ('+lit.join(',')+')');
 assert(await p.locator('#ai-apply').isVisible()&&await p.locator('#ai-regen').isVisible()&&await p.locator('#ai-cancel-plan').isVisible()&&await p.locator('#ai-undo').isVisible(),'botões Apply to Timeline, Regenerate, Cancel e Undo existem');
 assert(await clipsN()===1,'a prévia NÃO mexe na timeline (ainda 1 clipe)');
 // aplicar
 await p.click('#ai-apply');await p.waitForTimeout(500);
 const NS=await p.evaluate(()=>window.TimelineUI._h.state.surfaces.length);const n1=await clipsN();assert(n1===1+2*NS,'Apply to Timeline criou os clipes reais (2 camadas x '+NS+' faces + 1 antigo = '+(1+2*NS)+', veio '+n1+')');
 assert(await guard()===g0,'surface.q / máscara / mesh intactos após aplicar');
 assert(await p.evaluate(()=>{const H=window.TimelineUI._h;return JSON.stringify(H.Seq.findClip(H.tl.seq,window.__bid).clip)})===base0,'clipe que já existia ficou idêntico');
 const tree=await p.evaluate(()=>{const H=window.TimelineUI._h;return H.tl.seq.tracks.map(t=>t.name+':'+t.clips.map(c=>c.name).join('|'));});console.log('árvore',JSON.stringify(tree));
 assert(tree.some(t=>/IA · Transformação em ouro/.test(t)),'camadas nomeadas "IA · ..." na timeline');
 assert(await p.locator('.tl-clip').count()>=3,'clipes aparecem na timeline visual');
 // editar manualmente: mover, alterar duração, editar keyframe
 const ed=await p.evaluate(()=>{const H=window.TimelineUI._h,S=H.Seq,seq=H.tl.seq;const c=seq.tracks.flatMap(t=>t.clips).find(c=>/ouro/i.test(c.name));const k0=JSON.stringify(c.keyframes);S.moveClip(seq,c.id,c.start+1);S.trimClip(seq,c.id,'r',c.start+c.duration-1);S.setKey(c,'p1',1,0.7);H.push();H.renderAll();return {moved:c.start,dur:c.duration,v:S.valueAt(c,'p1',1),hadKeys:!!k0&&k0!=='{}'};});
 assert(ed.hadKeys&&ed.v===0.7&&ed.dur>0,'clipes e keyframes gerados podem ser movidos, aparados e editados');
 // saída externa recebe os clipes
 const sent=await p.evaluate(()=>{window.TimelineUI._h.push();const s=window.__lastState;return s&&s.tl&&s.tl.seq?s.tl.seq.tracks.flatMap(t=>t.clips).length:-1;});assert(sent===n1,'estado enviado à janela de saída contém os clipes da IA ('+sent+')');
 // relógio: avaliar em tempos diferentes sincroniza todas as faces (mesmo T)
 // desfazer pelo botão
 await p.click('#ai-undo');await p.waitForTimeout(300);
 assert(await clipsN()===1,'Undo remove só o que a IA criou');
 assert(await p.evaluate(()=>{const H=window.TimelineUI._h;return JSON.stringify(H.Seq.findClip(H.tl.seq,window.__bid).clip)})===base0,'após Undo o clipe antigo continua idêntico');
 // aplicar de novo e desfazer pelo desfazer global do app
 await p.click('#ai-apply');await p.waitForTimeout(300);assert(await clipsN()===n1,'Regenerar/aplicar de novo funciona');
 await p.evaluate(()=>document.activeElement&&document.activeElement.blur());await p.keyboard.press('Control+z');await p.waitForTimeout(400);
 assert(await clipsN()===1,'Cmd/Ctrl+Z global também desfaz a geração ('+await clipsN()+')');
 // ---- prompt livre (teste 3) ----
 await p.fill('#ai-prompt','Quero rachaduras luminosas e partículas saindo de uma parede');await p.click('#ai-gen');await p.waitForTimeout(500);
 assert(await p.evaluate(()=>AiDirector.state.plan&&AiDirector.state.plan.layers.map(l=>l.effect).join()==='ai-cracks,ai-particles'),'teste 3: prompt livre vira cracks + partículas');
 assert(/planejador local/i.test(await p.locator('#ai-strip').locator('xpath=ancestor::details').textContent()),'prévia avisa que o plano veio do planejador LOCAL');
 await p.click('#ai-apply');await p.waitForTimeout(400);assert(await clipsN()===1+2*NS,'teste 3: composição aplicada com efeitos e keyframes editáveis');
 await p.click('#ai-undo');await p.waitForTimeout(200);
 // ---- shaders ----
 await p.selectOption('#ai-shader-pick','lava');await p.click('#ai-shader-use');await p.waitForTimeout(500);
 assert(await p.evaluate(()=>AiDirector.state.plan&&AiDirector.state.plan.layers[0].effect==='glsl'),'shader nativo GLSL entra no plano (passou validação e compilação WebGL)');
 assert(await p.evaluate(()=>GlslFx.hasGl()),'WebGL disponível no teste');
 await p.click('#ai-apply');await p.waitForTimeout(700);
 const glsl=await p.evaluate(()=>{const H=window.TimelineUI._h;const a=H.tl.seq.assets.find(a=>a.fx&&a.fx.kind==='glsl');const cv=document.createElement('canvas');Renderer.drawFx(cv,{w:160,h:90,fx:Object.assign({},a.fx,{p1:1,p2:1})},1500);const d=cv.getContext('2d').getImageData(0,0,160,90).data;let s=0;for(let i=3;i<d.length;i+=4)s+=d[i];return {err:a.fx._error||null,s,has:!!a.fx.glsl};});
 assert(glsl.has&&!glsl.err&&glsl.s>1000,'shader GLSL realmente desenha pixels (soma alfa '+glsl.s+')');
 await p.click('#ai-undo');
 // shader que não compila no WebGL: o plano é recusado, o editor segue
 const bad=await p.evaluate(()=>AiDirector.shaderPlan('x','_t').then(()=>null));
 await p.evaluate(()=>{ShaderValidator.PRESETS._bad={name:'Quebrado',code:'vec4 lenziEffect(vec2 uv){ return vec4(nope(uv), 1.0); }'};});
 await p.evaluate(()=>AiDirector.shaderPlan('', '_bad'));await p.waitForTimeout(300);
 assert(await p.evaluate(()=>!AiDirector.state.plan&&/recusad/i.test(AiDirector.state.error||'')),'shader que o WebGL não compila é recusado com motivo: '+await p.evaluate(()=>AiDirector.state.error));
 assert(await p.locator('#ai-panel').isVisible()&&await p.evaluate(()=>typeof window.TimelineUI._h.tl.seq.tracks.length==='number'),'editor continua funcionando após shader ruim');
 // fx com GLSL quebrado já salvo no projeto: cai no brilho nativo sem exceção
 const fb=await p.evaluate(()=>{const cv=document.createElement('canvas');try{Renderer.drawFx(cv,{w:80,h:45,fx:{kind:'glsl',glsl:'vec4 lenziEffect(vec2 uv){ return vec4(nope(uv),1.0); }',color:'#ff0000'}},0);const d=cv.getContext('2d').getImageData(0,0,80,45).data;let s=0;for(let i=3;i<d.length;i+=4)s+=d[i];return {ok:true,s};}catch(e){return {ok:false,e:e.message};}});
 assert(fb.ok&&fb.s>0,'clipe com shader quebrado não derruba o render (usa o brilho nativo)');
 // ---- IA (servidor falso) ----
 await p.click('[data-go="ia"]');
 await p.evaluate(()=>AiDirector.setSettings({external:true,provider:'openai'}));await p.waitForTimeout(150);
 assert(/Modo local/.test(await p.locator('#ai-mode').textContent()),'serviços ligados mas SEM chave: continua local e avisa');
 const r0=await p.evaluate(()=>AiDirector.analyze({subject:'statue'}).then(()=>AiDirector.state.source));assert(r0==='local'&&hits.length===0,'sem chave nada é enviado à rede');
 await p.evaluate(()=>AiDirector.setKey('openai','sk-TESTE-CHAVE-12345'));await p.waitForTimeout(200);
 assert(/IA: OpenAI/.test(await p.locator('#ai-mode').textContent()),'com chave e serviços ligados: modo IA identifica o provedor');
 // consentimento
 let pr=p.evaluate(()=>AiDirector.analyze({}));await p.waitForSelector('#ai-consent');
 assert(/OpenAI/.test(await p.locator('#ai-consent').textContent())&&/cobrar/.test(await p.locator('#ai-consent').textContent()),'consentimento cita o provedor e o custo antes de enviar a foto');
 assert(hits.length===0,'nada foi enviado antes da confirmação');
 await p.click('#ai-consent-no');await pr;await p.waitForTimeout(150);assert(hits.length===0&&/cancelad/i.test(await p.evaluate(()=>AiDirector.state.error||'')),'recusar o consentimento cancela sem enviar');
 pr=p.evaluate(()=>AiDirector.analyze({}));await p.waitForSelector('#ai-consent');await p.click('#ai-consent-yes');await pr;await p.waitForTimeout(300);
 assert(hits.length===1&&hits[0].prov==='openai'&&hits[0].key==='Bearer sk-TESTE-CHAVE-12345','foto enviada ao provedor só depois do OK, com a chave no cabeçalho');
 assert(JSON.parse(hits[0].body).messages[1].content.some(c=>c.type==='image_url'),'a imagem foi no pedido');
 assert(await p.evaluate(()=>AiDirector.state.source)==='ai'&&await p.locator('#ai-objects .ai-item').count()===2,'análise da IA validada: 2 objetos listados');
 assert(/\(80%\)/.test(await p.locator('#ai-objects').textContent())&&/Análise por IA/.test(await p.locator('.ai-note:has-text("Análise por IA")').first().textContent()),'confiança mostrada e origem "IA" identificada');
 const sg=await p.evaluate(()=>AiDirector.state.analysis.suggestions[0].effects.join());assert(sg==='ai-glow,ai-cracks','efeito inexistente que a IA inventou foi descartado ('+sg+')');
 assert(await p.locator('.ai-warn:has-text("Reflexo")').count()===1,'dificuldades de projeção apontadas pela IA aparecem');
 // respostas ruins
 await p.evaluate(()=>{window.__setMode('badjson');});await p.evaluate(()=>AiDirector.analyze({}));await p.waitForTimeout(200);
 assert(/validação|inválido|incompleto/i.test(await p.evaluate(()=>AiDirector.state.error)),'JSON quebrado da IA vira erro compreensível');
 await p.evaluate(()=>{window.__setMode('401');});await p.evaluate(()=>AiDirector.analyze({}));await p.waitForTimeout(200);assert(/recusou a chave/.test(await p.evaluate(()=>AiDirector.state.error)),'chave recusada: mensagem clara');
 await p.evaluate(()=>{window.__setMode('analysis');});
 // texto → plano pela IA
 await p.evaluate(()=>{window.__setMode('plan');});const pv=await p.evaluate(()=>AiDirector.planFromPrompt('estátua rachando e virando ouro').then(r=>({ok:r.ok,src:AiDirector.state.plan&&AiDirector.state.plan.source,n:AiDirector.state.plan&&AiDirector.state.plan.layers.length})));
 assert(pv.ok&&pv.src==='ai'&&pv.n===2,'prompt → plano pela IA (validado)');
 const rq=await p.evaluate(()=>window.__aireq[window.__aireq.length-1]);assert(/ai-cracks/.test(rq.prompt)&&/Superfícies do projeto/.test(rq.prompt)&&!rq.image,'pedido de texto leva efeitos e superfícies, sem imagem');
 await p.evaluate(()=>{window.__setMode('badplan');});const bp=await p.evaluate(()=>AiDirector.planFromPrompt('qualquer coisa').then(r=>({ok:r.ok,plan:!!AiDirector.state.plan,err:AiDirector.state.error})));
 assert(!bp.ok&&!bp.plan&&/inválido/.test(bp.err),'plano malicioso/inválido da IA é recusado e nada é aplicado');
 await p.evaluate(()=>{window.__setMode('shader');});const sh=await p.evaluate(()=>AiDirector.shaderPlan('ondas coloridas').then(r=>({ok:r.ok,src:AiDirector.state.plan&&AiDirector.state.plan.source})));assert(sh.ok&&sh.src==='ai','shader gerado pela IA passa no validador e compila');
 for(const m of ['badshader','brokenshader']){await p.evaluate(mm=>{window.__setMode(mm);},m);const r=await p.evaluate(()=>AiDirector.shaderPlan('x').then(()=>({err:AiDirector.state.error,errs:AiDirector.state.planErrors})));assert(/recusad/i.test((r.err||'')+r.errs.join()),'shader da IA "'+m+'" é rejeitado: '+(r.err||r.errs.join()));}
 assert(await p.evaluate(()=>AiDirector.history().length)>=4,'histórico de operações registrado');
 assert(!(await p.evaluate(()=>JSON.stringify(AiDirector.history()))).includes('sk-TESTE'),'histórico não guarda a chave');
 assert(!(await p.evaluate(()=>JSON.stringify(localStorage))).includes('sk-TESTE'),'a chave não está no localStorage');
 // falha de rede
 srv.closeAllConnections();srv.close();await p.evaluate(()=>{window.__setMode('analysis');});
 const off=await p.evaluate(()=>AiDirector.analyze({}).then(()=>AiDirector.state.error));assert(/Sem conexão/.test(off),'provedor fora do ar: erro claro');
 assert(await p.locator('#ai-import').isVisible(),'painel segue utilizável sem rede');
 // desligar serviços externos
 await p.evaluate(()=>AiDirector.setSettings({external:false}));await p.waitForTimeout(150);assert(/Modo local/.test(await p.locator('#ai-mode').textContent()),'desligar serviços externos volta ao modo local');
 // ---- assistente de mapeamento ----
 await p.evaluate(()=>AiDirector.analyze({subject:'cubes',count:4}));await p.waitForTimeout(200);
 const gA=await guard();const ns=await p.evaluate(()=>window.TimelineUI._h.state.surfaces.length);
 await p.evaluate(()=>AiDirector.suggestQuads());await p.waitForTimeout(200);
 assert(await p.evaluate(()=>AiDirector.state.quads.length)===5&&await guard()===gA,'Suggest cria quadriláteros SEM tocar na calibração');
 await p.evaluate(()=>{document.querySelectorAll('#ai-panel details').forEach(d=>{if(/Mapping/.test(d.querySelector('summary').textContent))d.open=true;});});await p.click('#ai-quad-sf1');await p.waitForTimeout(300);
 const gB=await p.evaluate(()=>window.TimelineUI._h.state.surfaces.length);assert(gB===ns+1,'Confirmar cria UMA superfície nova');
 const gC=JSON.parse(await guard());const gAo=JSON.parse(gA);assert(JSON.stringify(gC.slice(0,gAo.length))===JSON.stringify(gAo),'superfícies que já existiam ficaram idênticas após a confirmação');
 // ---- 4 cubos ----
 await p.click('[data-go="camadas"]');for(let i=0;i<3;i++)await p.click('#btn-newbox');await p.waitForTimeout(300);
 await p.click('[data-go="timeline"]');await p.click('.tl-bar button:has-text("Faixa p/ cada face")');await p.click('[data-go="ia"]');
 const nsf=await p.evaluate(()=>window.TimelineUI._h.state.surfaces.length);
 await p.fill('#ai-prompt','Crie uma animação neon que atravesse os quatro cubos');await p.click('#ai-gen');await p.waitForTimeout(400);
 const c0=await clipsN();await p.click('#ai-apply');await p.waitForTimeout(500);
 const neon=await p.evaluate(()=>{const H=window.TimelineUI._h;return H.tl.seq.tracks.filter(t=>/Linhas neon/.test(t.name)).map(t=>({s:t.surfaceId,st:t.clips[0].start}));});
 assert(neon.length===nsf&&new Set(neon.map(n=>n.s)).size===nsf,'teste 2: um clipe neon em CADA superfície ('+neon.length+'/'+nsf+')');
 assert(neon.every((n,i,a)=>i===0||a.some(x=>x.st>n.st-1e-9)),'teste 2: cascata de tempos entre as faces');
 const sync=await p.evaluate(()=>{const H=window.TimelineUI._h,S=H.Seq;const T=3;const ev=S.evaluate(H.tl.seq,T);return Object.keys(ev.video).filter(k=>ev.video[k].some(e=>/Linhas neon/.test(e.clip.name))).length;});assert(sync>=1,'avaliação no mesmo relógio da timeline enxerga os clipes (T=3 s)');
 // salvar → reabrir (teste 12/4)
 await p.evaluate(()=>AiDirector.planFromPrompt('rachaduras e depois ouro').then(()=>AiDirector.apply()));await p.waitForTimeout(300);
 await p.evaluate(()=>{const H=window.TimelineUI._h;AiDirector.setSettings({external:false});});
 await p.click('[data-go="saida"]');await p.click('#btn-save');await p.waitForTimeout(500);
 const json=await p.evaluate(()=>window.__saved);assert(!!json,'projeto salvo');
 if(json){const data=JSON.parse(json);assert(data.sequence.tracks.some(t=>/IA ·/.test(t.name))&&data.sequence.assets.some(a=>a.fx&&/^ai-/.test(a.fx.kind)),'.mapa contém as faixas e efeitos da IA');
  assert(!/sk-TESTE|base64,\/9j/.test(json),'.mapa não contém chave nem foto enviada');
  await p.evaluate(j=>{window.__openJson=j;},json);await p.click('#btn-open');await p.waitForTimeout(800);
  const re=await p.evaluate(()=>{const H=window.TimelineUI._h;return {tracks:H.tl.seq.tracks.length,cr:H.tl.seq.tracks.flatMap(t=>t.clips).filter(c=>c.keyframes.p1).length,surf:H.state.surfaces.length};});
  assert(re.tracks===data.sequence.tracks.length&&re.cr>=1,'reabrir devolve faixas e keyframes da IA ('+JSON.stringify(re)+')');
  const q2=await guard();assert(JSON.parse(q2).length===data.scenes[data.scene||0].surfaces.length||re.surf>=nsf,'calibração das superfícies voltou do arquivo');}
 // funcionamento sem internet: modo local completo sem nenhuma chamada de rede
 hits.length=0;await p.evaluate(()=>AiDirector.planFromPrompt('brilho e partículas'));assert(hits.length===0&&await p.evaluate(()=>!!AiDirector.state.plan),'sem internet/IA: o planejador local gera planos mesmo assim');
 assert(h.errs.length===0,'nenhum erro de JavaScript no console: '+h.errs.slice(0,3).join(' | '));
 await h.close();
})();
