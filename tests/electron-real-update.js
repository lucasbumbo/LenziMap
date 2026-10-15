// Atualização REAL entre duas versões empacotadas (Linux AppImage, 1.0.0 -> 1.1.0), com servidor local.
// Pré-requisito: gerar os pacotes (ver LENZIMAP_AUTO_UPDATE_IMPLEMENTATION.md, seção "teste de duas versões").
// Mostra que: detecta, baixa com checksum, instala só após o clique, substitui o app, reabre na versão nova e preserva dados.
// NÃO é teste de Mac: assinatura Apple, Squirrel.Mac e notarização continuam NÃO TESTADOS.
const {_electron}=(()=>{try{return require('playwright')}catch(e){return require('/opt/npm-tools/node_modules/playwright')}})();
const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),crypto=require('crypto');
const REL=process.env.REL||'/tmp/rel',RUN='/tmp/run-real';
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const sha=(f)=>crypto.createHash('sha512').update(fs.readFileSync(f)).digest('hex');
(async()=>{fs.rmSync(RUN,{recursive:true,force:true});fs.mkdirSync(RUN,{recursive:true});
 const app1=path.join(RUN,'LenziMap.AppImage');fs.copyFileSync(path.join(REL,'1.0.0/LenziMap-1.0.0.AppImage'),app1);fs.chmodSync(app1,0o755);
 const old=sha(app1),neu=sha(path.join(REL,'1.1.0/LenziMap-1.1.0.AppImage'));
 const srv=http.createServer((q,r)=>{const f=path.join(REL,'1.1.0',decodeURIComponent(q.url.split('?')[0]));if(fs.existsSync(f)&&fs.statSync(f).isFile()){r.setHeader('content-length',fs.statSync(f).size);fs.createReadStream(f).pipe(r);}else{r.statusCode=404;r.end();}}).listen(8899,'127.0.0.1');
 const env=Object.assign({},process.env,{APPIMAGE:app1,APPIMAGE_EXTRACT_AND_RUN:'1',XDG_CONFIG_HOME:path.join(RUN,'cfg'),XDG_CACHE_HOME:path.join(RUN,'cache'),ELECTRON_DISABLE_SANDBOX:'1',ELECTRON_DISABLE_SECURITY_WARNINGS:'1'});
 const app=await _electron.launch({executablePath:path.join(REL,'unpacked-1.0.0/lenzimap'),args:['--no-sandbox'],env});
 const win=await app.firstWindow();await win.waitForTimeout(1500);
 const v=await app.evaluate(({app})=>({v:app.getVersion(),p:app.isPackaged,ud:app.getPath('userData')}));assert(v.v==='1.0.0'&&v.p,'app empacotado em 1.0.0 (isPackaged='+v.p+')');
 await win.evaluate(()=>{localStorage.setItem('lenzi-marker','dados-do-lucas-v1');window.__st=[];window.api.updater.onState(s=>window.__st.push(s));});await win.waitForTimeout(600);
 await win.evaluate(()=>window.api.updater.check());
 const wait=async(fn,ms)=>{const t=Date.now();while(Date.now()-t<(ms||30000)){if(await win.evaluate(fn))return true;await win.waitForTimeout(200);}return false;};
 assert(await wait(()=>window.__st.some(s=>s.status==='available')),'pacote 1.0.0 detecta a 1.1.0 no servidor');
 await win.evaluate(()=>window.api.updater.download());
 assert(await wait(()=>window.__st.some(s=>s.status==='ready'),60000),'download completo verificado (sha512 do latest-linux.yml)');
 assert(sha(app1)===old,'antes do clique em Restart and Install o app antigo continua intacto');
 let r='app fechou antes de responder (esperado)';try{r=await win.evaluate(()=>window.api.updater.install());}catch(e){}console.log('install ->',JSON.stringify(r));
 // o app fecha, troca o arquivo e reabre sozinho
 let ok=false;for(let i=0;i<60&&!ok;i++){await new Promise(r=>setTimeout(r,1000));try{ok=sha(app1)===neu;}catch(e){}}
 assert(ok,'AppImage foi substituído pela 1.1.0');
 let verFile=path.join(v.ud,'lenzimap-data-version.json'),got=null;
 for(let i=0;i<45;i++){await new Promise(r=>setTimeout(r,1000));try{got=JSON.parse(fs.readFileSync(verFile,'utf8')).appVersion;if(got==='1.1.0')break;}catch(e){}}
 assert(got==='1.1.0','o app reabriu sozinho já na versão 1.1.0 (versão dos dados: '+got+')');
 const bk=fs.existsSync(path.join(v.ud,'backups'))?fs.readdirSync(path.join(v.ud,'backups')):[];console.log('backups',bk);
 assert(bk.some(x=>/pre-update-1\.0\.0-to-1\.1\.0/.test(x))&&bk.some(x=>/pre-1\.0\.0-to-1\.1\.0/.test(x)),'cópias de segurança antes de instalar e antes de migrar');
 const ls=bk.length?path.join(v.ud,'backups',bk[0],'Local Storage'):'';assert(ls&&fs.existsSync(ls),'cópia contém Local Storage');
 let found=false;for(const b of bk){const d=path.join(v.ud,'backups',b,'Local Storage','leveldb');if(fs.existsSync(d))for(const f of fs.readdirSync(d))if(fs.readFileSync(path.join(d,f)).includes('dados-do-lucas-v1'))found=true;}
 assert(found,'dados do usuário (localStorage) estão na cópia de segurança');
 const live=path.join(v.ud,'Local Storage','leveldb');let live2=false;if(fs.existsSync(live))for(const f of fs.readdirSync(live))if(fs.readFileSync(path.join(live,f)).includes('dados-do-lucas-v1'))live2=true;
 assert(live2,'dados do usuário continuam no app 1.1.0 (mesma pasta de dados)');
 try{cp.execSync("pkill -f '[r]un-real' || true; pkill -f '[l]enziMap' || true");}catch(e){}
 srv.close();console.log('NÃO TESTADO: Mac, assinatura Developer ID, notarização, Squirrel.Mac, GitHub Releases real.');process.exit(process.exitCode||0);})().catch(e=>{console.log('FAIL exceção',e.message);process.exit(1);});
