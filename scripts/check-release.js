// Barreira antes de publicar: versão semântica válida, tag igual à versão do package.json, repositório configurado.
const pkg = require('../package.json');
const { parse } = require('../updater-core.js');
const tag = (process.argv[2] || process.env.GITHUB_REF_NAME || '').replace(/^v/, '');
const pub = [].concat(pkg.build.publish || [])[0] || {};
const errs = [];
if (!parse(pkg.version)) errs.push('Versão inválida no package.json: ' + pkg.version);
if (tag && tag !== pkg.version) errs.push('A tag v' + tag + ' não é igual à versão do package.json (' + pkg.version + ').');
if (pub.provider !== 'github' || !pub.owner || pub.owner === 'SEU_USUARIO_GITHUB' || !pub.repo) errs.push('Configure build.publish (owner e repo do GitHub) no package.json.');
if (errs.length) { console.error('PUBLICAÇÃO BLOQUEADA:\n- ' + errs.join('\n- ')); process.exit(1); }
console.log('OK: publicar v' + pkg.version + ' em ' + pub.owner + '/' + pub.repo);
