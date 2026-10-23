'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PROFOR_PLAYWRIGHT_PATH||'playwright');
const D=require('../domain.js'),{syntheticProposal}=require('./fixtures/state.cjs'),{createStore}=require('../workspace-store.cjs'),{fulfillStatic}=require('./ui-static.cjs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const result of ['favoravel','desfavoravel']){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-conclusion-ui-')),store=createStore(dir),p=syntheticProposal();
  for(const r of D.referenceRows(p))D.markReview(p,r.group,r.id,true,'Teste');
  D.setReview(p,'pad','11',{status:'diligencia',note:'Conferir item',document:'',url:''},'Teste');
  D.saveDiligence(p,{ref:'pad:11',category:'PLANO DE APLICAÇÃO DETALHADO',request:'Conferir documento',communication:'2026-09-15',science:'',response:'',status:'aberta',note:'',calendarNote:'',confirmed:false,due:''},'Teste');
  store.save({state:{...D.initialState(),proposals:[p]},expected:0,token:null});
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];let posts=0;
  try{
   page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!=='http://127.0.0.1:9878')return route.abort();
    if(url.pathname==='/api/state'){
     if(req.method()==='GET')return route.fulfill({json:store.load()});
     posts++;try{return route.fulfill({json:store.save(req.postDataJSON())});}catch(e){return route.fulfill({status:e.status||500,json:{error:e.message}});}
    }
    if(url.pathname==='/api/sync/history')return route.fulfill({json:{entries:[]}});
    if(url.pathname.startsWith('/api/')||req.method()!=='GET')return route.abort();
    return fulfillStatic(route);
   });
   await page.goto('http://127.0.0.1:9878/PROFOR_2026.html#proposta/990900/dados');
   await page.locator('[data-action="conclude"]').click();
   await page.locator('#conclusion-form [name="result"]').selectOption(result);
   assert.equal(await page.locator('#conclusion-form [name="reference"]').getAttribute('required'),null);
   assert.equal(await page.locator('#conclusion-form [name="reference"]').inputValue(),'');
   assert.equal(await page.locator('#conclusion-form [name="note"]').inputValue(),'');
   await page.locator('[data-action="confirm-conclusion"]').click();
   await page.waitForFunction(()=>!document.querySelector('#modal').open);
   const saved=store.load().state.proposals[0];assert.equal(saved.conclusion.result,result);assert.equal(saved.conclusion.reference,'');assert.equal(saved.conclusion.note,'');assert.equal(saved.diligences[0].status,'aberta');assert.equal(posts,1);
   await page.reload();await page.locator('[data-action="conclude"]').waitFor();assert.equal(D.conclusionCurrent(store.load().state.proposals[0]),true);assert.deepEqual(errors,[]);
   console.log('PASS: formulário '+result+' vazio, diligência aberta, gravação única e recarga');
  }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true});}
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
