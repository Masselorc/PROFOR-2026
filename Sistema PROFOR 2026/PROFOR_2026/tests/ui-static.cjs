'use strict';
// Estáticos do harness: nenhum servidor, origem autenticada ou base operacional.
const fs=require('node:fs'),path=require('node:path');
async function fulfillStatic(route,root=path.resolve(__dirname,'..')){
 const url=new URL(route.request().url()),relative=decodeURIComponent(url.pathname).replace(/^\/+/,''),file=path.resolve(root,relative||'PROFOR_2026.html');
 if(!file.startsWith(path.resolve(root)+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ico':'image/x-icon','.svg':'image/svg+xml','.pdf':'application/pdf'};
 return route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
}
module.exports={fulfillStatic};
