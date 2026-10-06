'use strict';
// API atendida em store temporário; nenhuma escrita na base operacional.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const D=require('../domain.js'),{createStore}=require('../workspace-store.cjs'),{fulfillStatic}=require('./ui-static.cjs');
const {chromium}=require(process.env.PROFOR_PLAYWRIGHT_PATH || 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-reconcile-ui-')),store=createStore(dir);
 const real=createStore(path.resolve(__dirname,'../dados/registros')).load().state,rs=D.clone(real.proposals.find(p=>p.imported.uf==='RS'));
 const legacy=rs.diligences.find(d=>d.ref==='celebracao:11'),legacyBefore=D.clone(legacy),padBefore=JSON.stringify(rs.reviews.pad);
 const targets=[['formalizacao','12'],['formalizacao','13'],['formalizacao','14'],['merito','destinacao'],['merito','justificativa'],['proposta','4'],['proposta','6']];
 for(const [group,id] of targets){D.markReview(rs,group,id,'na','Fixture');D.saveDiligence(rs,{ref:D.canonicalRef(group,id),scope:'requirement',category:'OUTRO',request:'Apenas pendência do requisito — fixture',communication:'',science:'',response:'',status:'aberta',note:''},'Fixture');}
 const first=store.load();store.save({state:{...D.initialState(),proposals:[rs]},expected:first.state.revision,token:first.token});
 const browser=await chromium.launch({channel:'chrome',headless:true});let failNext=false,writes=0;
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!=='http://127.0.0.1:8766')return route.abort();
   if(url.pathname==='/api/state'){
    if(req.method()==='POST'){
     if(failNext){failNext=false;return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Conflito simulado'})});}
     store.save(req.postDataJSON());writes++;
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(store.load())});
   }
   if(url.pathname.startsWith('/api/'))return route.fulfill({status:404,contentType:'application/json',body:'{}'});
   return fulfillStatic(route);
  });
  const current=()=>store.load().state.proposals[0];
  const open=async group=>{await page.goto('http://127.0.0.1:8766/PROFOR_2026.html#proposta/'+rs.id+'/'+group);await page.reload();await page.locator('#tab-content table').first().waitFor();};
  await open('proposta');assert.match(await page.locator('tr[data-req-row][data-id="11"]').innerText(),/revise o alcance/);
  assert.deepEqual(current().diligences.find(d=>d.id===legacy.id),legacyBefore);
  await open('formalizacao');const item=page.locator('[data-status-dropdown][data-id="12"]');await item.locator('[data-status-toggle]').click();await item.locator('[data-status-details]').click();await page.locator('#modal-content select[name="status"]').selectOption('ok');await page.locator('#modal-content button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);
  assert.equal(current().diligences.find(d=>d.ref==='celebracao:12' && d.scope==='requirement').status,'baixada');await page.reload();await page.locator('#review-batch-header').waitFor();assert.equal(current().reviews.celebracao['12'].status,'ok');
  for(const [group,ids] of [['formalizacao',['13','14']],['analise',['destinacao','justificativa']],['proposta',['4','6']]]){
   await open(group);for(const id of ids)await page.locator(`[data-review-batch="${id}"]`).check();await page.locator('#review-batch-action').selectOption('ok');await page.locator('#review-batch-apply').click();
   const before=store.load();failNext=true;await page.locator('#modal-content button[type="submit"]').click();await page.locator('#form-error').filter({hasText:'Conflito'}).waitFor();assert.deepEqual(store.load(),before);assert.equal(await page.locator('[data-review-batch]:checked').count(),2);
   await page.locator('#modal-content button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);await page.reload();await page.locator('#review-batch-header').waitFor();
   for(const id of ids){const g=group==='analise'?'merito':group;assert.equal(D.reviewOf(current(),g,id).status,'ok');assert.equal(current().diligences.find(d=>d.ref===D.canonicalRef(g,id) && d.scope==='requirement').status,'baixada');}
  }
  await open('diligencias');await page.locator(`[data-action="diligence"][data-id="${legacy.id}"]`).click();await page.locator('#modal-content select[name="scope"]').selectOption('independent');await page.locator('#modal-content button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);await page.reload();await page.locator('#tab-content table').first().waitFor();
  const after=current().diligences.find(d=>d.id===legacy.id);assert.equal(after.status,legacyBefore.status);for(const key of ['communication','response','due','base','note','request','science'])assert.deepEqual(after[key],legacyBefore[key]);assert.match(await page.locator('#tab-content').innerText(),/obrigação independente permanece aberta/);
  assert.equal(JSON.stringify(current().reviews.pad),padBefore);assert.equal(current().history.filter(h=>h.event==='Diligência encerrada por atendimento do requisito').length,7);
  assert.equal(await page.locator('[data-action="diligence"]').count(),current().diligences.filter(d=>d.status!=='baixada').length+1);
  const output=path.resolve(__dirname,'../../../output/requirement-diligence');fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'rs-diligencias.png'),fullPage:true});
  await page.unroute('**/*');await page.goto('file:///'+path.resolve(__dirname,'../../../docs/index.html').replace(/\\/g,'/')+'#proposta/'+rs.id+'/diligencias');await page.locator('#tab-content table').first().waitFor();assert.match(await page.locator('#tab-content').innerText(),/revise o alcance/);assert.equal(await page.locator('[data-action="diligence"]').count(),0);
  await page.locator(`[data-action="view-diligence"][data-id="${legacy.id}"]`).click();assert.match(await page.locator('#modal-content').innerText(),/Nenhuma anexação foi presumida/);assert.equal(await page.locator('#modal-content select, #modal-content textarea, #modal-content input').count(),0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',individual:true,batchGroups:3,closures:7,persistedAfterReload:true,independentPreserved:true,conflictsAtomic:true,publicReadonly:true,realDatabaseWrites:0,writes,pageErrors:errors}));
 }finally{await browser.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
