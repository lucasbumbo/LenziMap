// Confere o empacotamento: todo script/estilo que control.html e output.html carregam está em "build.files",
// electron-updater está em "dependencies" (vai para o app.asar) e o updater não é só devDependency.
// Conferência real do pacote (feita à mão, ver LENZIMAP_FINAL_IMPLEMENTATION_REPORT.md): electron-builder --linux dir + listar app.asar.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const assert=(c,m)=>{console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
const files=pkg.build.files;
const rx=g=>new RegExp('^'+g.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*\*\//g,'(.*/)?').replace(/\*/g,'[^/]*')+'$');
const inFiles=f=>files.some(g=>g[0]!=='!'&&rx(g).test(f));
assert(pkg.dependencies&&pkg.dependencies['electron-updater'],'electron-updater está em dependencies (empacotado no app.asar)');
assert(!(pkg.devDependencies&&pkg.devDependencies['electron-updater']),'electron-updater não está só em devDependencies');
['control.html','output.html'].forEach(h=>{
  const html=fs.readFileSync(path.join(root,h),'utf8');
  const refs=[...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"#?]+)"/g)].map(m=>m[1]).filter(x=>!/^(https?:|data:)/.test(x));
  const miss=refs.filter(r=>!fs.existsSync(path.join(root,r))||!inFiles(r));
  assert(miss.length===0,h+': '+refs.length+' arquivos referenciados existem e estão em build.files'+(miss.length?' (faltam: '+miss.join(', ')+')':''));
});
['main.js','preload.js','control.html','output.html','control.js','output.js','updater.js','updater-core.js'].forEach(f=>{if(fs.existsSync(path.join(root,f)))assert(inFiles(f),'principal empacotado: '+f);});
