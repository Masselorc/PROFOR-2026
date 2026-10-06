'use strict';
// Todos os POSTs usam store temporário; não grava dados/registros operacional.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const D=require('../domain.js'),{createStore}=require('../workspace-store.cjs'),{fulfillStatic}=require('./ui-static.cjs');
const {chromium}=require(process.env.PROFOR_PLAYWRIGHT_PATH || 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
const logs=p=>p.history.filter(h=>h.event==='Diligência encerrada por atendimento do requisito');
function fixture(id,uf){return D.createProposal({id,numero:id+'/2026',uf,programa:D.PROGRAM,proponente:'FIXTURE ISOLADA',cnpj:'',orgao:'',objeto:'Teste',situacao:'Proposta/Plano de Trabalho Enviado para Análise',data:'2026-09-15',repasse:10000,contrapartida:100,global:10100,pad:[{id:'11',descricao:'Item PAD preservado',quantidade:'2',unitario:5050,total:10100}]});}
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-reconcile-ui-')),store=createStore(dir),p=fixture('990001','RS'),other=fixture('990002','RN');
 const targets=[['proposta','11'],['formalizacao','12'],['formalizacao','13'],['formalizacao','14'],['merito','destinacao'],['merito','justificativa'],['proposta','4'],['proposta','6']],ids=new Map();
 for(const [group,id] of targets){const d=D.saveDiligence(p,{ref:D.canonicalRef(group,id),category:'OUTRO',request:'Anexar documento na aba Dados — fixture antiga',communication:'2026-09-16',science:'',response:'',status:'aberta',note:'Preservar observação',...(id==='12'?{scope:'independent'}:{})},'Fixture');ids.set(D.canonicalRef(group,id),d.id);}
 const legacy=p.diligences[0],legacyBefore=D.clone(legacy);p.reviews.celebracao['11'].status='ok';delete p.reviews.celebracao['11'].evidence;
 D.saveDiligence(other,{ref:'celebracao:11',category:'OUTRO',request:legacy.request,communication:'',science:'',response:'',status:'aberta',note:''},'Fixture');
 const first=store.load();store.save({state:{...D.initialState(),proposals:[p,other]},expected:first.state.revision,token:first.token});
 const otherBefore=D.clone(store.load().state.proposals[1]),padBefore=JSON.stringify(p.reviews.pad);
 const browser=await chromium.launch({channel:'chrome',headless:true});let failNext=false,writes=0;
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());if(url.origin!=='http://127.0.0.1:8766')return route.abort();
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
  const current=()=>store.load().state.proposals[0],open=async group=>{await page.goto('http://127.0.0.1:8766/PROFOR_2026.html#proposta/'+p.id+'/'+group);await page.reload();await page.locator('#tab-content table').first().waitFor();};
  await open('proposta');assert.equal(current().diligences.find(d=>d.id===legacy.id).status,'baixada');assert.equal(logs(current()).length,1);
  await open('formalizacao');const item=page.locator('[data-status-dropdown][data-id="12"]');await item.locator('[data-status-toggle]').click();await item.locator('[data-status-details]').click();assert.equal(await page.locator('#modal-content [name="scope"],#modal-content [name="d_scope"]').count(),0);await page.locator('#modal-content select[name="status"]').selectOption('ok');await page.locator('#modal-content button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);
  assert.equal(current().diligences.find(d=>d.id===ids.get('celebracao:12')).status,'baixada');await page.reload();await page.locator('#review-batch-header').waitFor();assert.equal(current().reviews.celebracao['12'].status,'ok');
  for(const [group,items] of [['formalizacao',['13','14']],['analise',['destinacao','justificativa']],['proposta',['4','6']]]){
   await open(group);for(const id of items)await page.locator(`[data-review-batch="${id}"]`).check();await page.locator('#review-batch-action').selectOption('ok');await page.locator('#review-batch-apply').click();
   const before=store.load();failNext=true;await page.locator('#modal-content button[type="submit"]').click();await page.locator('#form-error').filter({hasText:'Conflito'}).waitFor();assert.deepEqual(store.load(),before);assert.equal(await page.locator('[data-review-batch]:checked').count(),2);
   await page.locator('#modal-content button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);await page.reload();await page.locator('#review-batch-header').waitFor();
   for(const id of items){const g=group==='analise'?'merito':group;assert.equal(D.reviewOf(current(),g,id).status,'ok');assert.equal(current().diligences.find(d=>d.id===ids.get(D.canonicalRef(g,id))).status,'baixada');}
   const count=logs(current()).length;for(const id of items)await page.locator(`[data-review-batch="${id}"]`).check();await page.locator('#review-batch-action').selectOption('ok');await page.locator('#review-batch-apply').click();await page.locator('#modal-content button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);assert.equal(logs(current()).length,count);
  }
  await open('diligencias');const after=current().diligences.find(d=>d.id===legacy.id);assert.equal(after.status,'baixada');for(const key of ['communication','response','due','base','note','request','science'])assert.deepEqual(after[key],legacyBefore[key]);assert.equal(JSON.stringify(current().reviews.pad),padBefore);assert.deepEqual(store.load().state.proposals[1],otherBefore);assert.equal(logs(current()).length,8);
  await page.locator('#tab-content details summary').click();await page.locator(`[data-action="view-diligence"][data-id="${legacy.id}"]`).click();assert.match(await page.locator('#modal-content').innerText(),/Encerrada por confirmação de conformidade do requisito/);assert.equal(await page.locator('#modal-content select, #modal-content textarea, #modal-content input').count(),0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',individual:true,batchGroups:3,closures:8,legacyAlreadyConforming:true,persistedAfterReload:true,otherProposalAndPadPreserved:true,conflictsAtomic:true,idempotent:true,realDatabaseWrites:0,writes,pageErrors:errors}));
 }finally{await browser.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
