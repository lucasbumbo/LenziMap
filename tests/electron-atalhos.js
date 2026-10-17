// Teste REAL no Electron: menu Projeção (fechar projeção / sair) e atalhos globais.
const {_electron}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const path=require('path');
let fails=0,n=0;const ok=(c,m)=>{n++;console.log(c?'PASS':'FAIL',m);if(!c)fails++;};
const ELEC=process.env.ELECTRON_BIN||'/tmp/claude-0/el33/node_modules/electron/dist/electron';
(async()=>{
 const app=await _electron.launch({executablePath:ELEC,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'].concat(process.env.PACKAGED?[]:[path.join(__dirname,'..')])});
 const win=await app.firstWindow();await win.waitForLoadState('load');await win.waitForTimeout(2500);
 const info=await app.evaluate(({Menu,globalShortcut})=>{const m=Menu.getApplicationMenu();const p=m.items.find(i=>i.label==='Projeção');return{has:!!p,labels:p?p.submenu.items.map(i=>i.label+':'+i.accelerator):[],reg:globalShortcut.isRegistered('Control+Alt+W')&&globalShortcut.isRegistered('Control+Alt+Q')}});
 console.log(JSON.stringify(info));
 ok(info.has&&info.labels.length===2,'menu Projeção com 2 itens');
 ok(info.reg,'atalhos globais registrados (Ctrl+Option+W e Q)');
 const before=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length);
 await win.evaluate(async()=>{const d=await window.api.displays();await window.api.openOutput(d[0].id)});
 await win.waitForTimeout(2500);
 const mid=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length);
 console.log('janelas antes/depois de abrir',before,mid);
 await app.evaluate(({Menu})=>{const p=Menu.getApplicationMenu().items.find(i=>i.label==='Projeção');p.submenu.items[0].click()});
 await win.waitForTimeout(1500);
 const after=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length);
 ok(after===before,'Fechar a projeção deixa so a janela de controle ('+before+'->'+mid+'->'+after+')');
 const closed=new Promise(r=>app.process().once('exit',r));
 await app.evaluate(({Menu})=>{const p=Menu.getApplicationMenu().items.find(i=>i.label==='Projeção');p.submenu.items[1].click()});
 const t=await Promise.race([closed.then(()=>'saiu'),new Promise(r=>setTimeout(()=>r('nao saiu'),8000))]);
 ok(t==='saiu','Sair do LenziMap encerra o app');
 console.log(fails?'FALHOU '+fails:'TUDO OK '+n);process.exit(fails?1:0);
})();
