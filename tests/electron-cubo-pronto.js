// Teste REAL no Electron: botão "Montar cubo (3 faces, pronto)" faz tudo sozinho. Saída/prints em /tmp/claude-0/cubo-pronto/
const {_electron}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const path=require('path'),fs=require('fs');
let fails=0,n=0;const ok=(c,m)=>{n++;console.log(c?'PASS':'FAIL',m);if(!c)fails++;};
const ELEC=process.env.ELECTRON_BIN||'/tmp/claude-0/el33/node_modules/electron/dist/electron';
const P='/tmp/claude-0/cubo-pronto/';fs.mkdirSync(P,{recursive:true});
(async()=>{
 const app=await _electron.launch({executablePath:ELEC,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows'].concat(process.env.PACKAGED?[]:[path.join(__dirname,'..')]),env:Object.assign({},process.env,{ELECTRON_DISABLE_SECURITY_WARNINGS:'1'})});
 const win=await app.firstWindow();const errs=[];win.on('pageerror',e=>errs.push(e.message));
 await win.waitForLoadState('load');await win.waitForTimeout(2500);
 await win.evaluate(()=>{try{localStorage.setItem('lenzi-onboarded','1');localStorage.removeItem('ml-autosave')}catch(e){}});await win.reload();await win.waitForTimeout(2000);
 await win.setViewportSize({width:1500,height:1000}).catch(()=>{});
 await win.click('[data-go="ilusao"]');await win.waitForTimeout(1500);
 ok(await win.locator('#il-cubo-pronto').count()===1,'botao Montar cubo existe');
 const st=()=>win.evaluate(()=>{const H=TimelineUI._h,sq=H.tl.seq,c=sq.stage.cubes[0],keys=H.surfaces().map(z=>z.s.key);
  const bound=['front','right','top'].map(f=>keys.indexOf(c.faces[f])>=0);
  const tracks=sq.tracks.filter(t=>t.type==='video').map(t=>({s:t.surfaceId,clips:t.clips.length}));
  return {nS:keys.length,bound,rotY:c.rotY,join:IllusionUI.state.il.room.join,viewer:sq.stage.viewer.pos,tracks,topClip:tracks.some(t=>t.s===c.faces.top&&t.clips>0),sideClip:tracks.some(t=>t.s===c.faces.front&&t.clips>0)};});
 await win.evaluate(()=>document.querySelector('#il-cubo-pronto').click());await win.waitForTimeout(5000);
 const a=await st();console.log(JSON.stringify(a));
 ok(a.bound.every(Boolean),'3 faces ligadas a superficies');ok(a.rotY===-45,'cubo na quina');ok(a.join==='front+right','modo 2 faces (frente+direita)');
 ok(a.topClip&&a.sideClip,'topo e lateral com conteudo na timeline');
 // segunda vez: nao duplica superficies
 await win.evaluate(()=>document.querySelector('#il-cubo-pronto').click());await win.waitForTimeout(4000);
 const b=await st();ok(b.nS===a.nS,'clicar de novo nao cria superficies a mais ('+a.nS+' -> '+b.nS+')');
 // saída real: as 3 faces têm imagem
 const ds=await win.evaluate(()=>window.api.displays());await win.evaluate(id=>window.api.openOutput(id),ds[ds.length-1].id);await win.waitForTimeout(3000);
 const out=app.windows().find(w=>w!==win);await out.waitForFunction(()=>window.__rend&&window.__rend.player,null,{timeout:8000}).catch(()=>{});
 await win.evaluate(()=>{TimelineUI.api.seek(1.0);TimelineUI.api.pause&&TimelineUI.api.pause();});await win.waitForTimeout(4500);
 await out.screenshot({path:P+'saida.png',timeout:120000});await win.screenshot({path:P+'controle.png',timeout:120000}).catch(()=>{});
 const g=await win.evaluate(()=>{const H=TimelineUI._h,c=H.tl.seq.stage.cubes[0],by={};H.surfaces().forEach(z=>by[z.s.key]=z.s);return ['front','right','top'].map(f=>by[c.faces[f]].q)});
 const py=require('child_process').spawnSync('python3',['-c',`
import json
from PIL import Image
im=Image.open('${P}saida.png').convert('RGB');W,H=im.size;g=json.loads('${JSON.stringify(g)}')
def c(q):
    x=sum(p[0] for p in q)/4;y=sum(p[1] for p in q)/4;return int(x*W),int(y*H)
res=[]
for q in g:
    x,y=c(q);s=0;k=0
    for dx in range(-12,13,6):
        for dy in range(-12,13,6):
            r,gg,b=im.getpixel((x+dx,y+dy));s+=r+gg+b;k+=1
    res.append(s//k)
print(*res)`],{encoding:'utf8'}).stdout.trim().split(' ').map(Number);
 console.log('brilho no centro de cada face',py.join(' '));ok(py.length===3&&py.every(v=>v>30),'saida tem imagem nas 3 faces');
 const vaz=await win.evaluate(()=>[...document.querySelectorAll('#overlay text.q-empty')].map(t=>t.textContent));ok(vaz.length===0,'nenhum aviso falso de superficie vazia '+JSON.stringify(vaz));
 // FRAMES (todo teste termina gerando frames para mostrar como ficou)
 const cfg=await win.evaluate(()=>{const H=TimelineUI._h,st=H.tl.seq.stage,cu=st.cubes[0];return {pw:1920,ph:1080,proj:st.projector.pos,ptgt:cu.pos,pfov:14,cubePos:cu.pos,size:cu.size,rotY:cu.rotY,viewer:st.viewer.pos,vfov:15,lado:[16,3,8]};});
 fs.writeFileSync(P+'cfg.json',JSON.stringify(cfg));
 const TS=[0.2,0.6,1.0,1.4,1.8,2.2];const fr=[];
 for(let i=0;i<TS.length;i++){await win.evaluate(t=>{TimelineUI.api.seek(t);TimelineUI.api.pause&&TimelineUI.api.pause();},TS[i]);await win.waitForTimeout(3800);
  const f='f'+i+'-';await out.screenshot({path:P+f+'raw.png',timeout:120000}).catch(e=>console.log('falhou frame',i));
  const r=require('child_process').spawnSync('python3',[path.join(__dirname,'amostra/cubo.py'),P+'cfg.json',P+f+'raw.png',P,f],{encoding:'utf8'});if(r.stderr)console.log(r.stderr.slice(0,300));fr.push(f);}
 ok(fr.every(f=>fs.existsSync(P+f+'foto-publico.png')),'frames gerados ('+fr.length+')');
 // desfazer não quebra
 await win.evaluate(()=>{const b=document.getElementById('btn-undo')||[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Desfazer');b&&b.click()});await win.waitForTimeout(1500);
 ok(errs.length===0,'sem erros de JS '+JSON.stringify(errs.slice(0,3)));
 await app.close().catch(()=>{});console.log(fails?'FALHOU':'TUDO OK '+n);process.exit(fails?1:0);
})();
