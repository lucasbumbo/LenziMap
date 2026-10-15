// Teste REAL no Electron com o electron-updater de verdade contra um servidor HTTP local (provider "generic").
// Rodar: xvfb-run -a node tests/electron-update.js   (precisa de node_modules do projeto: npm install)
// NÃO TESTADO aqui: instalação real em .app do Mac, assinatura/notarização Apple, GitHub Releases real.
const {_electron}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const path=require('path'),fs=require('fs'),os=require('os'),http=require('http'),crypto=require('crypto');
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const ELEC=process.env.ELECTRON_BIN||'/tmp/elt/node_modules/electron/dist/electron';
const tmp=process.env.KEEP_TMP||fs.mkdtempSync(path.join(os.tmpdir(),'lm-upd-'));fs.mkdirSync(tmp,{recursive:true});
const blob=crypto.randomBytes(1500000);const sha=crypto.createHash('sha512').update(blob).digest('base64');
const yml=(v,s)=>`version: ${v}\nfiles:\n  - url: LenziMap-${v}.AppImage\n    sha512: ${s}\n    size: ${blob.length}\npath: LenziMap-${v}.AppImage\nsha512: ${s}\nreleaseDate: '2026-10-14T00:00:00.000Z'\n`;
let mode='ok',hits=[];
const srv=http.createServer((req,res)=>{hits.push(req.url);
  if(mode==='down'){res.statusCode=503;return res.end('x');}
  if(req.url.startsWith('/latest-linux.yml')){res.setHeader('content-type','text/yaml');
    return res.end(mode==='same'?yml('1.0.0',sha):mode==='badsha'?yml('1.1.0',crypto.createHash('sha512').update('outro').digest('base64')):yml('1.1.0',sha));}
  if(req.url.includes('.AppImage')){
    if(mode==='cut'){res.setHeader('content-length',blob.length);res.write(blob.subarray(0,300000));return setTimeout(()=>res.destroy(),150);}
    res.setHeader('content-length',blob.length);
    let i=0;const step=()=>{if(i>=blob.length)return res.end();res.write(blob.subarray(i,i+250000));i+=250000;setTimeout(step,60);};return step();}
  res.statusCode=404;res.end('nao');});
const launch=async(ud,env)=>{const app=await _electron.launch({executablePath:ELEC,args:['--no-sandbox','--disable-gpu-sandbox','--user-data-dir='+ud,path.join(__dirname,'..')],
  env:Object.assign({},process.env,{ELECTRON_DISABLE_SECURITY_WARNINGS:'1',XDG_CACHE_HOME:path.join(ud,'cache'),LENZIMAP_UPDATE_URL:'http://127.0.0.1:'+(srv.address()?srv.address().port:1),APPIMAGE:path.join(tmp,'LenziMap.AppImage')},env||{})});
  const win=await app.firstWindow();await win.evaluate(()=>{try{localStorage.setItem('lenzi-onboarded','1')}catch(e){}});await win.reload();await win.waitForTimeout(800);
  await win.evaluate(()=>{window.__st=[];window.api.updater.onState(s=>window.__st.push(s));});return {app,win};};
const waitFor=async(win,fn,ms=15000)=>{const t=Date.now();while(Date.now()-t<ms){const r=await win.evaluate(fn);if(r)return r;await win.waitForTimeout(150);}return null;};
const st=(win)=>win.evaluate(()=>window.api.updater.state());
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));fs.writeFileSync(path.join(tmp,'LenziMap.AppImage'),'fake');
 const ud=path.join(tmp,'ud');
 // ---- 1ª execução: grava dados do usuário
 let {app,win}=await launch(ud);
 assert((await st(win)).status==='idle','abre normalmente e o estado inicial é idle (verificação automática é assíncrona)');
 await win.evaluate(()=>{localStorage.setItem('lenzi-marker','projeto-do-lucas');localStorage.setItem('lenzi-midi','{"cc1":"x"}');});
 await win.waitForTimeout(500);
 // ---- menu Help > Check for Updates
 const labels=await app.evaluate(({Menu})=>{const m=Menu.getApplicationMenu();const h=m.items.find(i=>i.role==='help'||i.label==='Help');return h.submenu.items.map(i=>i.label);});
 assert(labels.includes('Check for Updates...'),'menu Help tem "Check for Updates..." ('+labels+')');
 const topo=await app.evaluate(({Menu})=>Menu.getApplicationMenu().items.map(i=>i.label));console.log('menus',JSON.stringify(topo));
 // 1. sem atualização (servidor devolve a mesma versão)
 mode='same';await app.evaluate(({Menu})=>{const h=Menu.getApplicationMenu().items.find(i=>i.role==='help'||i.label==='Help');h.submenu.items.find(i=>i.label==='Check for Updates...').click();});
 let r=await waitFor(win,()=>window.__st.some(s=>s.status==='none'));assert(!!r,'1. sem atualização: "You\'re running the latest version of LenziMap."');
 let s=await st(win);assert(s.message==="You're running the latest version of LenziMap.",'1b. mensagem exata: '+s.message);
 assert(await win.evaluate(()=>!document.getElementById('upd-card').hidden&&/latest version/.test(document.getElementById('upd-card').textContent)),'1c. cartão visível na interface');
 await win.click('#upd-card button');await win.waitForTimeout(200);assert(await win.evaluate(()=>document.getElementById('upd-card').hidden),'1d. OK fecha o cartão');
 // 2. nova versão
 mode='ok';await win.evaluate(()=>window.api.updater.check());
 r=await waitFor(win,()=>window.__st.some(s=>s.status==='available'));assert(!!r,'2. versão nova detectada pelo electron-updater real');
 s=await st(win);assert(s.message==='LenziMap 1.1.0 is available.','2b. "LenziMap 1.1.0 is available." (atual '+s.current+')');
 const labelsBtn=await win.evaluate(()=>[...document.querySelectorAll('#upd-card button')].map(b=>b.textContent));assert(labelsBtn.join()==='Later,Update Now','2c. botões Later / Update Now: '+labelsBtn);
 // 5. adiar
 await win.click('#upd-card button:has-text("Later")');await win.waitForTimeout(200);assert(await win.evaluate(()=>document.getElementById('upd-card').hidden),'5. Later esconde o cartão');
 // 12. projeção em andamento: abrir a saída e tentar baixar
 const ds=await win.evaluate(()=>window.api.displays());await win.evaluate((id)=>window.api.openOutput(id),ds[0].id);await win.waitForTimeout(800);
 s=await st(win);assert(s.projecting===true&&s.canInstall===false,'12. com a saída aberta o estado marca projeção');
 const before=hits.length;const dres=await win.evaluate(async()=>{await window.api.updater.check();await window.api.updater.download();return window.api.updater.state();});
 assert(!hits.slice(before).some(u=>u.includes('.AppImage')),'12b. nenhum download durante a projeção');
 await win.evaluate(()=>window.api.closeOutput());await win.waitForTimeout(500);
 // 3. baixar com progresso real
 await win.evaluate(()=>{window.__st.length=0;});mode='ok';
 s=await st(win);if(s.status!=='available'){await win.evaluate(()=>window.api.updater.check());await waitFor(win,()=>window.__st.some(s=>s.status==='available'));}
 await win.evaluate(()=>window.api.updater.download());
 r=await waitFor(win,()=>window.__st.some(s=>s.status==='ready'),20000);assert(!!r,'3. download real concluído e verificado (sha512)');
 const pcts=await win.evaluate(()=>window.__st.filter(s=>s.status==='downloading').map(s=>s.percent));console.log('progresso',pcts.join(','));
 assert(pcts.length>=2&&pcts[pcts.length-1]>pcts[0],'3b. progresso real aumentou ('+pcts.length+' eventos)');
 assert((await st(win)).message==='Update ready to install.','3c. "Update ready to install."');
 const lb=await win.evaluate(()=>[...document.querySelectorAll('#upd-card button')].map(b=>b.textContent));assert(lb.join()==='Install Later,Restart and Install','3d. botões Install Later / Restart and Install: '+lb);
 // 12c. instalar com a saída aberta é recusado
 await win.evaluate((id)=>window.api.openOutput(id),ds[0].id);await win.waitForTimeout(800);
 const ir=await win.evaluate(()=>window.api.updater.install());assert(ir&&ir.ok===false&&ir.reason==='projecting','12c. "Restart and Install" recusado com projeção: '+JSON.stringify(ir));
 assert((await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length))===2,'12d. janela de saída continua aberta');
 await win.evaluate(()=>window.api.closeOutput());await win.waitForTimeout(400);
 await win.click('#upd-card button:has-text("Install Later")').catch(()=>{});
 assert((await win.evaluate(()=>localStorage.getItem('lenzi-marker'))).includes('projeto-do-lucas'),'10. dados do usuário intactos durante todo o ciclo');
 await app.close();
 // 7. download interrompido
 ({app,win}=await launch(path.join(tmp,'ud2')));mode='cut';await win.evaluate(()=>window.api.updater.check());await waitFor(win,()=>window.__st.some(s=>s.status==='available'));
 await win.evaluate(()=>window.api.updater.download());r=await waitFor(win,()=>window.__st.some(s=>s.status==='error'),20000);assert(!!r,'7. download interrompido vira erro (sem travar)');
 s=await st(win);assert(s.message==='Unable to check for updates. Please try again later.'&&s.status==='error','7b. mensagem de erro exata');
 mode='ok';await win.evaluate(()=>{window.__st.length=0;return window.api.updater.check();});await waitFor(win,()=>window.__st.some(s=>s.status==='available'));await win.evaluate(()=>window.api.updater.download());
 r=await waitFor(win,()=>window.__st.some(s=>s.status==='ready'),20000);assert(!!r,'7c. nova tentativa depois da queda funciona');
 await app.close();
 // 8. arquivo inválido (sha512 não confere)
 ({app,win}=await launch(path.join(tmp,'ud3')));mode='badsha';await win.evaluate(()=>window.api.updater.check());await waitFor(win,()=>window.__st.some(s=>s.status==='available'));
 await win.evaluate(()=>window.api.updater.download());r=await waitFor(win,()=>window.__st.some(s=>s.status==='error'),20000);assert(!!r,'8. arquivo com checksum errado é RECUSADO');
 assert(!(await win.evaluate(()=>window.__st.some(s=>s.status==='ready'))),'8b. nunca chega a "pronto para instalar"');
 await app.close();
 // 6/11. sem conexão: servidor fora do ar, e porta fechada
 ({app,win}=await launch(path.join(tmp,'ud4')));mode='down';await win.evaluate(()=>window.api.updater.check());r=await waitFor(win,()=>window.__st.some(s=>s.status==='error'));
 assert(!!r&&(await st(win)).message==='Unable to check for updates. Please try again later.','6. GitHub/servidor fora do ar: erro amigável e app continua');
 await app.close();
 const port=srv.address().port;await new Promise(r=>srv.close(r));
 ({app,win}=await launch(path.join(tmp,'ud5'),{LENZIMAP_UPDATE_URL:'http://127.0.0.1:'+port}));await win.evaluate(()=>window.api.updater.check());
 r=await waitFor(win,()=>window.__st.some(s=>s.status==='error'));assert(!!r,'11. sem conexão nenhuma (porta fechada): erro amigável, sem exceção');
 assert((await win.evaluate(()=>typeof window.TimelineUI))==='object','11b. app inteiro funcionando offline');
 await app.close();
 // 9/10. migração de dados: versão antiga -> nova cria cópia de segurança e preserva os dados
 const ud6=path.join(tmp,'ud6');await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 ({app,win}=await launch(ud6));await win.evaluate(()=>localStorage.setItem('lenzi-marker','antes-da-atualizacao'));await win.waitForTimeout(800);await app.close();
 fs.writeFileSync(path.join(ud6,'lenzimap-data-version.json'),JSON.stringify({appVersion:'0.9.0'}));
 ({app,win}=await launch(ud6));
 const bk=fs.existsSync(path.join(ud6,'backups'))?fs.readdirSync(path.join(ud6,'backups')):[];console.log('backups',bk);
 assert(bk.length===1&&/pre-0\.9\.0-to-1\.0\.0/.test(bk[0]),'9. cópia de segurança criada ao mudar de versão: '+bk);
 assert(fs.existsSync(path.join(ud6,'backups',bk[0],'Local Storage')),'9b. cópia contém o Local Storage');
 assert((await win.evaluate(()=>localStorage.getItem('lenzi-marker'))).includes('antes-da-atualizacao'),'10. configurações e autosave preservados na nova versão');
 assert(JSON.parse(fs.readFileSync(path.join(ud6,'lenzimap-data-version.json'),'utf8')).appVersion==='1.0.0','10b. versão dos dados atualizada');
 await app.close();
 console.log('NÃO TESTADO aqui: instalação real em .app do Mac, assinatura e notarização Apple, GitHub Releases real, reinício após instalar.');
 srv.close();if(!process.env.KEEP_TMP)fs.rmSync(tmp,{recursive:true,force:true});})().catch(e=>{console.log('FAIL exceção',e.message);process.exitCode=1;process.exit(1);});
