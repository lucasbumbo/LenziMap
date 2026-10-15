const {JSDOM}=(()=>{try{return require('jsdom')}catch(e){return require('/tmp/claude-0/-home-claude/f9c0fdae-e327-5968-818a-c13ef614e3a9/scratchpad/jt/node_modules/jsdom')}})();const fs=require('fs');
const dir=require('path').join(__dirname,'..')+'/';
let html=fs.readFileSync(dir+'control.html','utf8').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'http://localhost/control.html'});
const w=dom.window;
const errs=[];w.addEventListener('error',e=>errs.push(e.message));
// stubs
const grad={addColorStop(){}};
const ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:(k==='createLinearGradient'||k==='createRadialGradient'||k==='createConicGradient'?()=>grad:k==='measureText'?()=>({width:50}):k==='createImageData'?()=>({data:new Uint8ClampedArray(96*54*4)}):()=>{}),set:(t,k,v)=>{t[k]=v;return true}});
w.HTMLCanvasElement.prototype.getContext=()=>ctx;
Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get(){return 1280}});
Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get(){return 720}});
w.HTMLMediaElement.prototype.play=function(){return Promise.resolve()};w.HTMLMediaElement.prototype.pause=function(){};
w.Element.prototype.getBoundingClientRect=()=>({left:0,top:0,width:1280,height:720});
w.Element.prototype.setPointerCapture=()=>{};w.Element.prototype.releasePointerCapture=()=>{};
let saved=null, sent=[], openPaths=[];
w.api={displays:()=>Promise.resolve([{id:1,primary:true,bounds:{width:1920,height:1080},label:'A'},{id:2,primary:false,bounds:{width:1920,height:1080},label:'B'}]),
 openOutput:()=>Promise.resolve(true),closeOutput(){},sendState(s){sent.push(s)},openMedia:()=>Promise.resolve(openPaths),libraryApp:()=>Promise.resolve(['/app/biblioteca/a.mp4','/app/biblioteca/b.gif']),libraryFolder:(d)=>Promise.resolve({dir:d||'/u',files:['/u/x.png']}),
 saveProject:(j)=>{saved=j;return Promise.resolve('/p.mapa')},openProject:()=>Promise.resolve(openJson),pathFor:f=>f.path,outputReady(){},onState(){},onOutputClosed(){},onResend(){}};
let openJson=null;
w.requestAnimationFrame=f=>setTimeout(()=>f(w.performance.now()),16);
const run=f=>w.eval(fs.readFileSync(dir+f,'utf8'));
run('textures.js');run('textures-extra.js');run('textures-extra2.js');run('silhouette.js');run('sequence.js');run('renderer.js');run('sequence-player.js');run('timeline-ui.js');run('control.js');
const $=id=>w.document.getElementById(id);
const click=id=>$(id).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const T=(c,m)=>console.log(c?'PASS':'FAIL',m);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await wait(50);
 T($('list').querySelectorAll('li.item').length===1,'starts with 1 surface');
 T($('items').textContent.includes('Grade neon'),'starts with neon alignment grid');
 T(w.document.querySelectorAll('#stage .surf').length===1 && w.document.querySelector('#stage .surf').children.length>=1,'renderer: grid box');
 click('add-test'); await wait(10);
 T($('items').querySelectorAll('li.item').length===1,'test pattern added as item');
 T(w.document.querySelector('#stage .surf').children.length===2,'renderer shows item inside box');
 click('btn-text'); [...$('gal-grid').querySelectorAll('button.card')].find(b=>b.textContent.includes('Ondas')).click(); await wait(10);
 T($('items').querySelectorAll('li.item').length===3,'text + fx added');
 T(!$('fx-ctl').hidden && $('text-ctl').hidden,'fx controls shown for selected fx item');
 // edit fx kind
 $('fx-kind').value='scan';$('fx-kind').dispatchEvent(new w.Event('change',{bubbles:true}));
 // select text item
 const rows=[...$('items').querySelectorAll('li.item .item-main')];
 rows.find(b=>b.textContent.includes('TEXTO')).click(); await wait(5);
 T(!$('text-ctl').hidden,'text controls shown for text item');
 $('text-value').value='Olá';$('text-value').dispatchEvent(new w.Event('input',{bubbles:true}));
 T($('items').textContent.includes('Olá'),'item name follows text');
 // media
 openPaths=['/m/foto.png']; 
 w.Image=w.Image; const origCreate=w.document.createElement.bind(w.document);
 w.document.createElement=(t)=>{const e=origCreate(t);if(t==='img'){setTimeout(()=>{Object.defineProperty(e,'naturalWidth',{value:1080});Object.defineProperty(e,'naturalHeight',{value:1920});e.onload&&e.onload()},5)}return e};
 click('btn-add'); await wait(80);
 T($('items').textContent.includes('foto.png'),'media added to selected surface');
 // new surface, then media becomes first item -> aspect
 click('btn-newbox'); await wait(10);
 T($('list').querySelectorAll('li.item').length===2,'second surface');
 click('btn-add'); await wait(80);
 T($('aspect').value==='9:16','first media sets surface aspect 9:16 (got '+$('aspect').value+')');
 // layer ui
 $('opacity').value=50;$('opacity').dispatchEvent(new w.Event('input',{bubbles:true}));
 click('btn-flipx');click('btn-rot90');
 // undo/redo
 const n0=w.eval("0");
 click('btn-undo');click('btn-undo'); await wait(10);
 click('btn-redo'); await wait(10);
 // scenes
 click('scene-add'); await wait(10); click('btn-text'); await wait(10);
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'1',bubbles:true})); await wait(450);
 // save
 click('btn-save'); await wait(10);
 const data=JSON.parse(saved);
 T(data.version===5 && data.scenes.length===2 && data.scenes.every(function(s){return typeof s.id==='string'&&s.id;}) && data.scenes[0].id!==data.scenes[1].id,'saved v5 with 2 scenes with stable ids');
 T(data.scenes[0].surfaces.every(s=>s.extras.every(x=>!('src' in x))),'no src data urls in saved file');
 console.log('saved sizes',saved.length);
 // reopen
 openJson=saved; click('btn-open'); await wait(30);
 T($('list').querySelectorAll('li.item').length>=1,'reopened');
 T(w.document.querySelectorAll('#stage .surf').length>=1,'reopened renders');

 // texture library
 T($('gal-grid').querySelectorAll('button.card').length>=40,'texture grid has '+$('gal-grid').querySelectorAll('button.card').length+' cards');
 T($('fx-kind').querySelectorAll('optgroup').length>=4,'fx-kind grouped');
 const nBefore=$('items').querySelectorAll('li.item').length;
 [...$('gal-grid').querySelectorAll('button.card')].find(b=>b.textContent.includes('Aurora')).click(); await wait(10);
 T($('items').querySelectorAll('li.item').length===nBefore+1,'aurora added');
 T(!$('fx-ctl').hidden,'fx ctl open for aurora');
 $('fx-scale').value=2;$('fx-scale').dispatchEvent(new w.Event('input',{bubbles:true}));
 $('fx-color2').value='#00ff00';$('fx-color2').dispatchEvent(new w.Event('input',{bubbles:true}));
 const stx=sent[sent.length-1]; await wait(30);
 const cur=JSON.parse(JSON.stringify(sent[sent.length-1].surfaces.find(s=>s.id===sent[sent.length-1].surfaces.slice(-1)[0].id)));
 const fxItem=cur.extras.find(x=>x.fx&&x.fx.kind==='aurora');
 T(fxItem&&fxItem.fx.scale===2&&fxItem.fx.color2==='#00ff00','fx scale/color2 stored');
 click('fx-color2-auto'); await wait(20);
 T(!('color2' in sent[sent.length-1].surfaces.slice(-1)[0].extras.find(x=>x.fx&&x.fx.kind==='aurora').fx),'color2 auto clears');
 // item duplicate
 const n2=$('items').querySelectorAll('li.item').length; click('btn-item-dup'); await wait(10);
 T($('items').querySelectorAll('li.item').length===n2+1,'item duplicated');
 // layouts
 const nl=$('list').querySelectorAll('li.item').length;
 $('layout-pick').value='3';$('layout-pick').dispatchEvent(new w.Event('change',{bubbles:true})); await wait(10);
 T($('list').querySelectorAll('li.item').length===nl+4,'layout 2x2 adds 4 surfaces');
 // media library
 await wait(20);
 T([...$('gal-tabs').querySelectorAll('button')].some(b=>b.textContent.replace(/ \d+$/,'')==='Clipes'),'gallery has Clipes tab');
 [...$('gal-tabs').querySelectorAll('button')].find(b=>b.textContent.replace(/ \d+$/,'')==='Clipes').click(); await wait(10);
 T($('gal-grid').querySelectorAll('button.card').length===2,'gallery Clipes tab shows 2 app clips');
 click('lib-pick'); await wait(20);
 T($('gal-grid').querySelectorAll('button.card').length===1,'gallery user folder tab (Meus arquivos)');
 // autosave
 await wait(1100);
 const auto=w.localStorage.getItem('ml-autosave');
 T(!!auto && JSON.parse(auto).version===5,'autosave written');
 // novo projeto
 click('btn-new'); T($('btn-new').textContent==='Confirmar?','new asks confirm'); click('btn-new'); await wait(10);
 T($('list').querySelectorAll('li.item').length===1,'new project -> 1 empty surface');
 click('btn-undo'); await wait(10);
 T($('list').querySelectorAll('li.item').length>1,'undo new project');

 // hierarquia: cobrir, mistura, frente/tras, arrastar
 click('btn-newbox'); await wait(10);
 click('add-test'); await wait(5); click('btn-text'); await wait(5);
 [...$('gal-tabs').querySelectorAll('button')].find(b=>b.textContent.replace(/ \d+$/,'')==='Tudo').click();await wait(5);
 [...$('gal-grid').querySelectorAll('button.card')].find(b=>b.textContent.includes('Neve')).click(); await wait(80);
 let ss=sent[sent.length-1].surfaces.slice(-1)[0];
 console.log('items', ss.extras.map(x=>x.name+(x.placeholder?'*':'')).join('|'));T(ss.extras.length===3 && !ss.extras.some(x=>x.placeholder),'3 items in hierarchy, grid gone');
 T(ss.extras[0].cover===true&&ss.extras[1].cover===undefined,'media/test items cover by default, text does not');
 click('btn-cover'); await wait(10);
 ss=sent[sent.length-1].surfaces.slice(-1)[0];
 T(ss.extras[2].cover===true,'cover toggled on selected top item');
 $('item-blend').value='multiply';$('item-blend').dispatchEvent(new w.Event('change',{bubbles:true})); await wait(10);
 ss=sent[sent.length-1].surfaces.slice(-1)[0];
 T(ss.extras[2].blend==='multiply','item blend stored');
 click('btn-back'); await wait(10);
 ss=sent[sent.length-1].surfaces.slice(-1)[0];
 T(ss.extras[0].type==='fx','send to back moved fx to bottom');
 click('btn-front'); await wait(10);
 ss=sent[sent.length-1].surfaces.slice(-1)[0];
 T(ss.extras[2].type==='fx','bring to front');
 click('btn-scover'); await wait(40);
 ss=sent[sent.length-1].surfaces.slice(-1)[0];
 T(ss.cover===true,'surface cover toggled');
 // drag reorder: items list shows top first; drag first row (idx 2) onto last row (idx 0)
 const rowsI=[...$('items').querySelectorAll('li.item')];
 const ev=(t)=>{const e=new w.Event(t,{bubbles:true,cancelable:true});e.dataTransfer={setData(){},effectAllowed:''};return e};
 const before=sent[sent.length-1].surfaces.slice(-1)[0].extras.map(x=>x.type).join(',');
 rowsI[0].dispatchEvent(ev('dragstart')); rowsI[2].dispatchEvent(ev('dragover')); rowsI[2].dispatchEvent(ev('drop')); await wait(20);
 const after=sent[sent.length-1].surfaces.slice(-1)[0].extras.map(x=>x.type).join(',');
 T(before!==after && after.split(',')[0]==='fx','drag reorder moved top item to bottom ('+before+' -> '+after+')');
 // surfaces reorder by drag
 const rowsS=[...$('list').querySelectorAll('li.item')];
 const sb=sent[sent.length-1].surfaces.map(x=>x.id).join(',');
 rowsS[0].dispatchEvent(ev('dragstart')); rowsS[rowsS.length-1].dispatchEvent(ev('dragover')); rowsS[rowsS.length-1].dispatchEvent(ev('drop')); await wait(20);
 const sa=sent[sent.length-1].surfaces.map(x=>x.id).join(',');
 T(sb!==sa,'surfaces reordered by drag');
 // old v1 project migration
 openJson=JSON.stringify({version:1,surfaces:[{name:'Padrão de teste',tag:'TESTE',type:'img',test:true,w:1600,h:900,q:[[.1,.1],[.9,.1],[.9,.9],[.1,.9]],mask:[[0,0],[1,0],[1,1],[0,1]],opacity:1},{name:'vid',tag:'VÍDEO',type:'video',path:'/m/a.mp4',w:1280,h:720,q:[[.1,.1],[.9,.1],[.9,.9],[.1,.9]],mask:[[0,0],[1,0],[1,1],[0,1]],opacity:1},{name:'Texto',tag:'TEXTO',type:'text',w:1600,h:900,text:{value:'Oi'},q:[[.1,.1],[.9,.1],[.9,.9],[.1,.9]],mask:[[0,0],[1,0],[1,1],[0,1]],opacity:1}]});
 click('btn-open'); await wait(30);
 T($('list').querySelectorAll('li.item').length===3,'v1 project: 3 surfaces');
 const st=sent[sent.length-1];
 T(st.surfaces.every(s=>s.type==='box'&&s.extras.length===1),'v1 migrated to box+item');
 T(st.surfaces[1].extras[0].kind==='video'&&st.surfaces[1].extras[0].src.startsWith('file:'),'video item src restored');
 // right click rotate
 const ov=$('overlay');
 const q0=JSON.stringify(st.surfaces[0].q);
 const pe=(t,x,y,b)=>{const e=new w.MouseEvent(t,{bubbles:true,clientX:x,clientY:y,button:b});ov.dispatchEvent(e)};
 pe('pointerdown',640,360,2); pe('pointermove',900,300,2); pe('pointerup',900,300,2);
 await wait(40);
 const st2=sent[sent.length-1];
 T(JSON.stringify(st2.surfaces[2].q)!==JSON.stringify(st.surfaces[2].q)||JSON.stringify(st2.surfaces.map(s=>s.q))!==JSON.stringify(st.surfaces.map(s=>s.q)),'right-click drag rotates quad');
 // ---- malha, câmera, cenas, foto ----
 click('btn-newbox'); await wait(40);
 click('m-mesh'); await wait(40);
 let ms2=sent[sent.length-1].surfaces.slice(-1)[0];
 T(ms2.mesh&&ms2.mesh.on&&ms2.mesh.n===4&&ms2.mesh.off.length===25,'mesh on with 25 points');
 T($('overlay').querySelectorAll('circle.h-mesh').length===25,'25 mesh handles drawn');
 const hd=$('overlay').querySelectorAll('circle.h-mesh')[12];
 const pev=(t,x,y)=>{const e=new w.MouseEvent(t,{bubbles:true,clientX:x,clientY:y,button:0});hd.dispatchEvent(e)};
 pev('pointerdown',640,360); $('overlay').dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:740,clientY:300})); $('overlay').dispatchEvent(new w.MouseEvent('pointerup',{bubbles:true,clientX:740,clientY:300}));
 await wait(40);
 ms2=sent[sent.length-1].surfaces.slice(-1)[0];
 const o12=ms2.mesh.off[12];
 T(Math.abs(o12[0])>0.01||Math.abs(o12[1])>0.01,'dragging a mesh point changes its offset ('+o12.map(v=>v.toFixed(3))+')');
 $('mesh-n').value='6';$('mesh-n').dispatchEvent(new w.Event('change',{bubbles:true}));await wait(40);
 ms2=sent[sent.length-1].surfaces.slice(-1)[0];
 T(ms2.mesh.n===6&&ms2.mesh.off.length===49,'mesh resampled to 6x6');
 click('mesh-reset');await wait(40);
 T(sent[sent.length-1].surfaces.slice(-1)[0].mesh.off.every(o=>o[0]===0&&o[1]===0),'mesh reset');
 click('mesh-off');await wait(40);
 T(sent[sent.length-1].surfaces.slice(-1)[0].mesh.on===false,'mesh off');
 // câmera
 click('add-cam');await wait(40);
 const camIt=sent[sent.length-1].surfaces.slice(-1)[0].extras.slice(-1)[0];
 T(camIt.kind==='cam'&&camIt.src===null,'camera item added');
 // duração da cena
 $('scene-dur').value='10';$('scene-dur').dispatchEvent(new w.Event('change',{bubbles:true}));await wait(20);
 click('btn-save');await wait(30);
 T(JSON.parse(saved).scenes.some(sc=>sc.secs===10),'scene duration saved');
 // foto: UI aparece e botão criar começa desligado sem foto
 T($('photo-panel').hidden===true,'photo panel hidden at start');
 // girar leva a deformação da malha junto
 click('btn-newbox'); await wait(40); click('m-mesh'); await wait(40);
 const hd2=$('overlay').querySelectorAll('circle.h-mesh')[7];
 hd2.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true,clientX:600,clientY:300,button:0}));
 $('overlay').dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:700,clientY:330}));
 $('overlay').dispatchEvent(new w.MouseEvent('pointerup',{bubbles:true,clientX:700,clientY:330}));
 await wait(40);
 const offBefore=sent[sent.length-1].surfaces.slice(-1)[0].mesh.off[7].slice();
 click('btn-rotr'); await wait(40);
 const offAfter=sent[sent.length-1].surfaces.slice(-1)[0].mesh.off[7];
 const nb=Math.hypot(offBefore[0]*1.7778,offBefore[1]),na=Math.hypot(offAfter[0]*1.7778,offAfter[1]);
 T(Math.abs(nb-na)<1e-3&&(Math.abs(offBefore[0]-offAfter[0])>1e-4||Math.abs(offBefore[1]-offAfter[1])>1e-4),'rotation rotates mesh offsets and keeps their length');
 // ímã dos cantos
 click('btn-newbox'); await wait(40); click('m-corners'); await wait(40);
 const c0=$('overlay').querySelector('circle.h-corner[data-i="0"]');
 c0.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true,clientX:300,clientY:200,button:0}));
 $('overlay').dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:4,clientY:5}));
 $('overlay').dispatchEvent(new w.MouseEvent('pointerup',{bubbles:true,clientX:4,clientY:5}));
 await wait(40);
 let qs0=sent[sent.length-1].surfaces.slice(-1)[0].q[0];
 T(qs0[0]===0&&qs0[1]===0,"snap: corner sticks to stage corner ("+qs0+")");
 click('btn-snap'); await wait(10);
 const c1=$('overlay').querySelector('circle.h-corner[data-i="1"]');
 c1.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true,clientX:900,clientY:200,button:0}));
 $('overlay').dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:1276,clientY:4}));
 $('overlay').dispatchEvent(new w.MouseEvent('pointerup',{bubbles:true,clientX:1276,clientY:4}));
 await wait(40);
 const qs1=sent[sent.length-1].surfaces.slice(-1)[0].q[1];
 T(!(qs1[0]===1&&qs1[1]===0),'snap off: no sticking');
 click('btn-snap');
 // ---- novidades ----
 click('btn-newbox'); await wait(40);
 const setR=(id,v)=>{$(id).value=v;$(id).dispatchEvent(new w.Event('input',{bubbles:true}));};
 setR('sat',150);setR('hue',90);setR('blur',6);setR('audio-amt',40);setR('cycle',30);click('btn-invert');click('btn-mono');
 $('audio-to').value='opacity';$('audio-to').dispatchEvent(new w.Event('change',{bubbles:true}));
 await wait(60);
 const ns=sent[sent.length-1].surfaces[sent[sent.length-1].surfaces.length-1];
 T(ns.sat===150&&ns.hue===90&&ns.blur===6&&ns.audio===40&&ns.cycle===30&&ns.invert===true&&ns.mono===true&&ns.audioTo==='opacity','color/audio fields in state');
 const boxes=w.document.querySelectorAll('#stage .surf');const f=boxes[boxes.length-1].style.filter;
 T(/saturate\(1.5\)/.test(f)&&/hue-rotate/.test(f)&&/blur\(6px\)/.test(f)&&/invert\(1\)/.test(f)&&/grayscale\(1\)/.test(f),'renderer filter: '+f);
 $('shape-pick').value='circle';$('shape-pick').dispatchEvent(new w.Event('change',{bubbles:true}));await wait(40);
 const ms=sent[sent.length-1].surfaces.slice(-1)[0].mask;
 T(ms.length===48,'circle mask has 48 points');
 const cx=ms.reduce((a,p)=>a+p[0],0)/ms.length, cy=ms.reduce((a,p)=>a+p[1],0)/ms.length;
 T(Math.abs(cx-0.5)<0.01&&Math.abs(cy-0.5)<0.01,'circle centered');
 $('shape-pick').value='star';$('shape-pick').dispatchEvent(new w.Event('change',{bubbles:true}));await wait(40);
 T(sent[sent.length-1].surfaces.slice(-1)[0].mask.length===10,'star mask has 10 points');
 // salvar e reabrir mantém campos novos
 click('btn-save'); await wait(30);
 const sv=JSON.parse(saved);const lastS=sv.scenes[0].surfaces.slice(-1)[0];
 T(lastS.sat===150&&lastS.audio===40&&lastS.invert===true,'save keeps new fields');
 openJson=saved; click('btn-open'); await wait(40);
 const rs=sent[sent.length-1].surfaces.slice(-1)[0];
 T(rs.sat===150&&rs.blur===6&&rs.audioTo==='opacity','reopen restores new fields');
 // favoritos
 [...$('gal-tabs').querySelectorAll('button')].find(b=>b.textContent.replace(/ \d+$/,'')==='Tudo').click();await wait(10);
 const star=$('gal-grid').querySelector('button.fav');star.click();await wait(10);
 [...$('gal-tabs').querySelectorAll('button')].find(b=>b.textContent.replace(/ \d+$/,'')==='Favoritos').click();await wait(10);
 T($('gal-grid').querySelectorAll('button.card').length===1,'favorite appears in Favoritos');
 // busca
 [...$('gal-tabs').querySelectorAll('button')].find(b=>b.textContent.replace(/ \d+$/,'')==='Tudo').click();$('gal-search').value='grade num';$('gal-search').dispatchEvent(new w.Event('input',{bubbles:true}));await wait(10);
 T($('gal-grid').textContent.includes('Grade numerada'),'search finds Grade numerada');
 // cenas automáticas
 click('scene-add');await wait(20);const sc0=sent[sent.length-1].scene;
 $('scene-secs').value='3';click('scene-auto');
 T($('scene-auto').getAttribute('aria-pressed')==='true','scene auto on');
 click('scene-auto');
 // som
 w.navigator.mediaDevices=undefined;click('btn-mic');await wait(10);
 T($('status').textContent.includes('microfone'),'mic unavailable message');
 console.log('errors:',errs);
 process.exit(0);
})();
