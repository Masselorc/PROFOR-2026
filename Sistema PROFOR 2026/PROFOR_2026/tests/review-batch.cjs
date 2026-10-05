'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const D=require('../domain.js'),{createStore}=require('../workspace-store.cjs'),{fulfillStatic}=require('./ui-static.cjs');
const {chromium}=require(process.env.PROFOR_PLAYWRIGHT_PATH || 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
const root=path.resolve(__dirname,'../../..');
(async()=>{
 let memory=D.clone(createStore(path.resolve(__dirname,'../dados/registros')).load().state),token='fixture',writes=0,failNext=false;
 const p=memory.proposals.find(p=>!p.isDeleted && p.imported.uf==='RN');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname==='/api/state'){
    if(req.method()==='POST'){
     if(failNext){failNext=false;return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Conflito de revisão simulado'})});}
     const body=req.postDataJSON();assert.equal(body.expected,memory.revision);assert.equal(body.token,token);memory=D.clone(D.validateState(body.state));memory.revision++;token='fixture-'+(++writes);
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({exists:true,state:memory,token,recovery:null})});
   }
   if(url.origin==='http://127.0.0.1:8766' && req.method()==='GET')return fulfillStatic(route);
   return route.abort();
  });
  const open=async group=>{await page.goto('http://127.0.0.1:8766/PROFOR_2026.html#proposta/'+p.id+'/'+(group==='merito'?'analise':group));await page.reload();await page.locator('#review-batch-header').waitFor();};
  const select=async ids=>{for(const id of ids)await page.locator(`[data-review-batch="${id}"]`).check();};
  const current=()=>memory.proposals.find(x=>x.id===p.id);
  for(const group of ['merito','proposta','formalizacao']){
   const ids=D.rows(p,group).slice(0,2).map(x=>x[0]),other=D.rows(p,group)[2][0];
   for(const id of ids)D.setReview(current(),group,id,{status:'obs',note:'Nota preservada',document:'Documento preservado',url:'https://example.invalid/doc'},'Fixture');
   D.addAttachment(current(),group,ids[0],{name:'fixture.txt',data:'data:text/plain;base64,dGVzdGU=',size:5,type:'text/plain'},'Fixture');
   const unchanged=JSON.stringify(D.reviewOf(current(),group,other));
   await open(group);assert.equal(await page.locator('[data-review-batch]').count(),D.rows(p,group).length);
   await select(ids);assert.equal(await page.locator('#review-batch-header').evaluate(el=>el.indeterminate),true);
   if(group!=='merito'){await page.locator(`tr[data-req-row][data-id="${ids[0]}"] button.row-expand`).click();assert.equal(await page.locator('[data-review-batch]:checked').count(),2);}
   const cancelledAt=writes;await page.locator('#review-batch-action').selectOption('ok');await page.locator('#review-batch-apply').click();await page.locator('#modal-close').click();assert.equal(writes,cancelledAt);
   await page.locator('#review-batch-apply').click();const prior=JSON.stringify(memory),before=writes;failNext=true;await page.locator('#modal-content button[type="submit"]').click();await page.locator('#form-error').filter({hasText:'Conflito'}).waitFor();assert.equal(JSON.stringify(memory),prior);assert.equal(await page.locator('[data-review-batch]:checked').count(),2);
   await page.locator('#modal-content button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);assert.equal(writes,before+1);
   for(const action of ['obs','no','diligencia','diligencia','na']){
    await select(ids);await page.locator('#review-batch-action').selectOption(action);await page.locator('#review-batch-apply').click();
    if(['obs','no','diligencia'].includes(action))await page.locator('#modal-content textarea[name="note"]').fill('Justificativa conjunta '+action);
    const count=writes;await page.locator('#modal-content button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);assert.equal(writes,count+1);
    for(const id of ids){const r=D.reviewOf(current(),group,id);assert.equal(r.status,action);assert.equal(r.document,'Documento preservado');assert.equal(r.url,'https://example.invalid/doc');}
   }
   assert.equal(D.reviewOf(current(),group,ids[0]).attachments.length,1);assert.equal(JSON.stringify(D.reviewOf(current(),group,other)),unchanged);
   for(const id of ids)assert.equal(current().diligences.filter(d=>d.ref===D.canonicalRef(group,id)).length,1,'Diligência reutilizada com referência canônica');
   await page.locator('#review-batch-header').check();assert.equal(await page.locator('[data-review-batch]:checked').count(),D.rows(p,group).length);
   if(group==='merito'){assert.equal(await page.locator('#review-batch-action option[value="diligencia"]').count(),0);assert.equal(await page.locator('#review-batch-action option[value="obs"]').count(),0);}
   fs.mkdirSync(path.join(root,'output/review-batch'),{recursive:true});await page.screenshot({path:path.join(root,'output/review-batch',group+'.png')});
   await page.locator('#review-batch-action').selectOption('ok');await page.locator('#review-batch-apply').click();await page.locator('#modal-content button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);for(const [id] of D.rows(current(),group))assert.equal(D.reviewOf(current(),group,id).status,'ok');
   assert.equal(await page.locator('[data-review-batch]:checked').count(),0);
   await select(ids);await page.getByRole('link',{name:'Dados',exact:true}).first().click();await page.getByRole('link',{name:group==='merito'?'Mérito':group==='proposta'?'Requisitos da Proposta':'Requisitos para Formalização',exact:true}).click();await page.locator('#review-batch-header').waitFor();assert.equal(await page.locator('[data-review-batch]:checked').count(),0);
  }
  await open('merito');await page.setViewportSize({width:390,height:844});await page.locator('#review-batch-header').check();await page.screenshot({path:path.join(root,'output/review-batch/mobile.png')});
  await page.unroute('**/*');
  for(const group of ['analise','proposta','formalizacao']){await page.goto('file:///'+path.join(root,'docs/index.html').replace(/\\/g,'/')+'#proposta/'+p.id+'/'+group);await page.locator('#tab-content table').waitFor();assert.equal(await page.locator('[data-review-batch],#review-batch-action').count(),0);}
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',groups:3,atomicWrites:writes,realDatabaseWrites:0,publicReadonly:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
