'use strict';
// Fluxo completo com banco em memória: nenhuma gravação operacional.
const assert=require('node:assert/strict'),path=require('node:path');
const D=require('../domain.js'),{createStore}=require('../workspace-store.cjs');
const {fulfillStatic}=require('./ui-static.cjs');
const {chromium}=require(process.env.PROFOR_PLAYWRIGHT_PATH || 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
(async()=>{
 let state=D.clone(createStore(path.resolve(__dirname,'../dados/registros')).load().state),token='fixture',writes=0;
 const ap=state.proposals.find(p=>p.imported.uf==='AP');assert.ok(ap?.isDeleted,'Caso real: AP deve estar na lixeira');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname==='/api/state'){
    if(req.method()==='POST'){const body=req.postDataJSON();assert.equal(body.expected,state.revision);assert.equal(body.token,token);state=D.clone(D.validateState(body.state));state.revision++;token='fixture-'+(++writes);}
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({exists:true,state,token,recovery:null})});
   }
   if(url.origin==='http://127.0.0.1:8766' && req.method()==='GET')return fulfillStatic(route);
   return route.abort();
  });
  const panel=async()=>{await page.goto('http://127.0.0.1:8766/PROFOR_2026.html#painel');await page.reload();await page.locator('#uf-rows').waitFor();};
  const verify=async()=>{const expected=[...new Set(D.activeProposals(state).map(p=>p.imported.uf))].sort();assert.deepEqual((await page.locator('#uf-rows .uf-row').evaluateAll(rows=>rows.map(r=>r.dataset.uf))).sort(),expected);assert.deepEqual((await page.locator('#filter-uf option').evaluateAll(rows=>rows.map(r=>r.value).filter(Boolean))).sort(),expected);};
  await panel();await verify();assert.equal(await page.locator('#uf-rows [data-uf="AP"]').count(),0);
  await page.goto('http://127.0.0.1:8766/PROFOR_2026.html#apagadas');
  await page.locator('#del-rows tr.uf-row[data-uf="AP"] button.row-expand').click();
  await page.locator(`[data-action="restore-proposal"][data-id="${ap.id}"]`).click();
  await page.locator('[data-action="restore-proposal-now"]').click();
  await page.waitForFunction(()=>!document.querySelector('#modal').open);await panel();await verify();assert.equal(await page.locator('#uf-rows tr.uf-row[data-uf="AP"]').count(),1);
  await page.locator('#uf-rows tr.uf-row[data-uf="AP"] button.row-expand').click();
  await page.locator(`[data-action="delete-proposal"][data-id="${ap.id}"]`).click();await page.locator('[data-action="delete-proposal-now"]').click();
  await page.waitForFunction(()=>!document.querySelector('#modal').open);await verify();assert.equal(await page.locator('#uf-rows tr.uf-row[data-uf="AP"]').count(),0);
  const original=D.activeProposals(state)[0],uf=original.imported.uf;
  state.proposals.push(D.createProposal({...D.clone(original.imported),id:'999998',numero:'999999/2026'}));
  D.deleteProposal(original,'Teste isolado');await panel();await verify();assert.equal(await page.locator(`#uf-rows tr.uf-row[data-uf="${uf}"]`).count(),1,'UF permanece se outra proposta estiver ativa');
  for(const p of D.activeProposals(state))D.deleteProposal(p,'Teste isolado');await panel();assert.equal(await page.locator('#uf-rows tr.uf-row').count(),0);assert.equal(await page.locator('#uf-rows .empty').count(),1);
  assert.deepEqual(errors,[]);assert.equal(writes,2);console.log(JSON.stringify({status:'passed',restoreAndDelete:true,multipleProposals:true,emptyPanel:true,realDatabaseWrites:0}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
