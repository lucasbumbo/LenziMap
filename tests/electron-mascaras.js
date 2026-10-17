// Teste REAL no Electron: máscaras extras aparecem na janela de SAÍDA (pixels), invertem, suavizam e voltam com Ctrl+Z.
// Rodar: ELECTRON_BIN=/tmp/claude-0/el33/node_modules/electron/dist/electron xvfb-run -a node tests/electron-mascaras.js
const {_electron}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const path=require('path'),fs=require('fs');
let fails=0,n=0;const ok=(c,m)=>{n++;console.log(c?'PASS':'FAIL',m);if(!c)fails++;};
const ELEC=process.env.ELECTRON_BIN||'/tmp/claude-0/el33/node_modules/electron/dist/electron';
const PR=process.env.PRINTS||'';
(async()=>{
 const app=await _electron.launch({executablePath:ELEC,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows'].concat(process.env.PACKAGED?[]:[path.join(__dirname,'..')]),env:Object.assign({},process.env,{ELECTRON_DISABLE_SECURITY_WARNINGS:'1'})});
 const win=await app.firstWindow();const errs=[];win.on('pageerror',e=>errs.push(e.message));
 await win.waitForLoadState('load');await win.waitForTimeout(2500);
 await win.evaluate(()=>{try{localStorage.setItem('lenzi-onboarded','1');localStorage.removeItem('ml-autosave')}catch(e){}});await win.reload();await win.waitForTimeout(2000);
 const jc=(sel)=>win.evaluate(q=>document.querySelector(q).click(),sel);
 await jc('#btn-newbox');await win.waitForTimeout(600);await jc('#add-test');await win.waitForTimeout(1200);
 await win.evaluate(()=>{const H=TimelineUI._h,l=H.surfaces().map(z=>z.s);l[0].visible=false;H.renderAll();});await win.waitForTimeout(500);
 // saída
 const ds=await win.evaluate(()=>window.api.displays());await win.evaluate(id=>window.api.openOutput(id),ds[ds.length-1].id);await win.waitForTimeout(3000);
 const out=app.windows().find(w=>w!==win);
 const shot=async(name)=>{const b=await out.screenshot({timeout:120000});if(PR)fs.writeFileSync(PR+name+'.png',b);return b};
 // amostra de pixels da saída: pega o quadro e lê pelo python
 const sample=async(buf,pts)=>{const f='/tmp/claude-0/mk-'+Date.now()+'.png';fs.writeFileSync(f,buf);const r=require('child_process').spawnSync('python3',['-c',`
from PIL import Image;import json,sys
im=Image.open(sys.argv[1]).convert('RGB');pts=json.loads(sys.argv[2]);W,H=im.size
def m(x,y):
    X=min(W-3,int(x*W));Y=min(H-3,int(y*H));v=[sum(im.getpixel((X+i,Y+j)))//3 for i in range(-2,3) for j in range(-2,3)];return sum(v)//len(v)
print(json.dumps([[m(x,y)] for x,y in pts]))`,f,JSON.stringify(pts)]);return JSON.parse(r.stdout.toString()).map(a=>a[0]);};
 // acha a caixa da superfície na saída (bounding de pixels claros) para amostrar dentro dela
 const box=await win.evaluate(()=>{const s=window.__lastState?null:null;return null});
 const buf0=await shot('M0-sem-mascara');
 const info=await win.evaluate(()=>{const H=TimelineUI._h;const s=H.surfaces().map(z=>z.s).pop();return {q:s.q}});
 const q=info.q,cx=(q[0][0]+q[1][0]+q[2][0]+q[3][0])/4,cy=(q[0][1]+q[1][1]+q[2][1]+q[3][1])/4;
 const qw=q[1][0]-q[0][0],qh=q[3][1]-q[0][1];const inX=q[0][0]+qw*0.33,inY=q[0][1]+qh*0.40,edgeX=q[0][0]+qw*0.1,edgeY=q[0][1]+qh*0.5;
 const p0=await sample(buf0,[[inX,inY],[edgeX,edgeY]]);console.log('sem mascara',JSON.stringify(p0));
 ok(p0[0]>12&&p0[1]>12,'antes: centro e lado da superfície têm imagem');
 // cria máscara retângulo (metade central)
 await win.evaluate(()=>{document.getElementById('cut-shape').value='rect';document.getElementById('cut-add').click()});await win.waitForTimeout(3500);
 const buf1=await shot('M1-mascara-recortando');const p1=await sample(buf1,[[inX,inY],[edgeX,edgeY]]);console.log('com mascara',JSON.stringify(p1));
 ok(p1[0]<5,'depois: o centro (dentro da máscara) ficou preto na saída');
 ok(p1[1]>12,'depois: o lado (fora da máscara) continua com imagem');
 // inverter
 await win.evaluate(()=>{const c=window.__cuts.sel();document.getElementById('cut-inv-'+c.id).click()});await win.waitForTimeout(3500);
 const buf2=await shot('M2-mascara-invertida');const p2=await sample(buf2,[[inX,inY],[edgeX,edgeY]]);console.log('invertida',JSON.stringify(p2));
 ok(p2[0]>12&&p2[1]<5,'invertida: só o interior aparece');
 // Ctrl+Z (desfaz inverter)
 await win.evaluate(()=>document.activeElement&&document.activeElement.blur());await win.keyboard.press('Control+z');await win.waitForTimeout(3500);
 const buf3=await shot('M3-depois-desfazer');const p3=await sample(buf3,[[inX,inY],[edgeX,edgeY]]);console.log('desfeito',JSON.stringify(p3));
 ok(p3[0]<5&&p3[1]>12,'Ctrl+Z volta ao recorte normal');
 // feather: borda intermediária
 await win.evaluate(()=>{const c=window.__cuts.sel();const f=document.getElementById('cut-f-'+c.id);f.value=40;f.dispatchEvent(new Event('input',{bubbles:true}))});await win.waitForTimeout(3500);
 await shot('M4-feather');
 // desligar a máscara pelo olho
 await win.evaluate(()=>{const c=window.__cuts.sel();document.getElementById('cut-on-'+c.id).click()});await win.waitForTimeout(3500);
 const buf5=await shot('M5-desligada');const p5=await sample(buf5,[[inX,inY],[edgeX,edgeY]]);
 ok(p5[0]>12&&p5[1]>12,'máscara desligada: imagem volta inteira');
 console.log('errs',errs.slice(0,3));ok(errs.length===0,'sem erros de JS');
 console.log(fails?'FALHOU '+fails:'TUDO OK '+n);await app.close().catch(()=>{});process.exit(fails?1:0);
})();
