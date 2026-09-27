/* Consulta pública: dados oficiais disponíveis, estado interno ausente. */
'use strict';
const path=require('node:path');
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PROFOR_PLAYWRIGHT_PATH||'playwright');
const ROOT=path.resolve(__dirname,'..','..','..');
const DOCS=path.join(ROOT,'docs');
const privateKeys=new Set(['reviews','diligences','history','attachments','note','document','url','ouvidoria','falaBR','conclusion','sei','lastBackup','isDeleted','deletedAt','deletedBy','token','expected','activity','source']);
function snapshot(){
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(DOCS,'dados_publicos.js'),'utf8'),context);
  return context.window.PROFOR_PUBLIC_DATA;
}
function assertPublic(data){
  const visit=(value,location='snapshot')=>{
    if(!value||typeof value!=='object')return;
    for(const [key,item] of Object.entries(value)){
      assert.ok(!privateKeys.has(key),`${location}.${key} contém estrutura interna`);
      visit(item,`${location}.${key}`);
    }
  };
  visit(data);
  assert.doesNotMatch(JSON.stringify(data),/data:[^\s"']+/i,'Arquivos embutidos não podem ser publicados.');
  assert.ok(data.proposals.length>0);
  assert.ok(data.proposals.every(p=>Object.keys(p).every(k=>['id','imported','textos'].includes(k))));
}
async function run(){
  const data=snapshot();assertPublic(data);
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    await page.goto('file:///'+path.join(DOCS,'index.html').replace(/\\/g,'/'));
    await page.waitForSelector('#uf-rows tr.uf-row',{timeout:10000});
    assert.match(await page.textContent('.local-label'),/Consulta pública/);
    for(const id of ['#server-open','#import-open','#backup-open','#nav-deleted'])assert.equal(await page.$eval(id,el=>el.hidden),true,id);
    assert.equal(await page.locator('button[data-action="sync"]').count(),0);
    assert.equal(await page.locator('#uf-rows tr.uf-row').count(),Object.keys(require('../domain.js').UFS).length);
    await page.locator('#uf-rows a.btn-detail').first().click();
    await page.waitForSelector('.program-facts');
    assert.equal(await page.locator('button[data-action="report"],button[data-action="conclude"],button[data-action="diligence"]').count(),0);
    assert.match(await page.textContent('#main'),/Consulta pública dos dados oficiais/);
    await page.getByRole('link',{name:'Plano de aplicação detalhado',exact:true}).click();
    await page.waitForSelector('#main table');
    await page.locator('#nav-records').click();
    await page.waitForSelector('#main .change-card');
    assert.equal(errors.length,0,errors.join('; '));
    console.log('Página pública: painel, filtros, proposta, PAD e registros oficiais sem erros.');
  }finally{await browser.close();}
}
run().catch(err=>{console.error(err);process.exitCode=1;});
