'use strict';
const {fulfillStatic}=require('./ui-static.cjs');
// Aprovação conjunta isolada: todos os GET/POST de /api/state ficam em memória.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {build}=require('../../../tools/build_public_docs.cjs');
const {createHash}=require('node:crypto');
const D=require('../domain.js');
const {chromium}=require(process.env.PROFOR_PLAYWRIGHT_PATH || 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
const ORIGIN='http://127.0.0.1:8766';
const STATIC=new Set(['/PROFOR_2026.html','/styles.css','/domain.js','/sync-apply.js','/bandeiras-uf.js','/storage.js','/transferegov.js','/report.js','/app.js']);
const clone=value=>JSON.parse(JSON.stringify(value));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const root=path.resolve(__dirname,'../../..');
function fixture(){
  const state=D.initialState();state.revision=7;
  const pad=['Cadeira','Mesa','Armário','Monitor'].map((descricao,index)=>({id:String(index+1),descricao,quantidade:'1',unitario:10000,total:10000}));
  const p=D.createProposal({id:'990777',numero:'990777/2026',uf:'RN',programa:D.PROGRAM,proponente:'Fixture isolada',cnpj:'',orgao:'',objeto:'Equipamentos',situacao:'Proposta/Plano de Trabalho Enviado para Análise',data:'2026-09-01',repasse:40000,contrapartida:0,global:40000,pad});
  for(const item of pad)D.setReview(p,'pad',item.id,{status:item.id==='3'?'diligencia':'obs',note:'Justificativa preservada '+item.id,document:'Documento '+item.id,url:'https://example.invalid/'+item.id},'Fixture');
  p.reviews.pad['1'].attachments=[{id:'fixture-att',name:'teste.txt',size:5,type:'text/plain',data:'data:text/plain;base64,dGVzdGU=',uploadedAt:D.now(),uploadedBy:'Fixture',note:''}];
  D.saveDiligence(p,{id:'',ref:'pad:3',category:'PLANO DE APLICAÇÃO DETALHADO',request:'Solicitação preservada',communication:'2026-09-01',science:'',response:'',status:'aberta',note:'Observação preservada'},'Fixture');
  state.proposals.push(p);return D.validateState(state);
}
async function main(){
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const errors=[],blocked=[];let memory=fixture(),token=hash(memory),posts=0,failNext=false;
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin===ORIGIN && url.pathname==='/api/state'){
        const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
        if(request.method()==='GET')return json({exists:true,state:memory,token,recovery:null});
        if(request.method()==='POST'){
          posts++;
          if(failNext){failNext=false;return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Conflito de revisão simulado. Nenhuma alteração salva.'})});}
          const body=request.postDataJSON();assert.equal(body.expected,memory.revision);assert.equal(body.token,token);D.validateState(body.state);
          memory=clone(body.state);memory.revision++;token=hash(memory);
          return json({exists:true,state:memory,token});
        }
      }
      if(url.origin===ORIGIN && request.method()==='GET' && STATIC.has(url.pathname))return fulfillStatic(route);
      blocked.push(request.url());return route.abort();
    });
    const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(ORIGIN+'/PROFOR_2026.html#proposta/990777/pad');
    await page.locator('#pad-batch-header').waitFor();
    assert.equal(await page.locator('[data-pad-batch]').count(),4);
    assert.equal(await page.locator('#pad-batch-apply').isDisabled(),true);
    await page.locator('#pad-batch-1').check();await page.locator('#pad-batch-3').check();
    assert.equal(await page.locator('#pad-batch-header').evaluate(el=>el.indeterminate),true);
    await page.locator('#pad-search').fill('cadeira');
    assert.match(await page.locator('#pad-batch-count').innerText(),/1 fora dos filtros/);
    await page.locator('#pad-batch-header').uncheck();
    assert.match(await page.locator('#pad-batch-count').innerText(),/1 item selecionado/);
    await page.locator('#pad-search').fill('');
    await page.locator('#pad-batch-1').check();
    await page.locator('#pad-batch-action').selectOption('ok');await page.locator('#pad-batch-apply').click();
    assert.equal(await page.locator('.pad-batch-preview li').count(),2);
    assert.equal(await page.locator('#modal-content textarea').count(),0,'Compatível não pede justificativa adicional');
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(posts,0);
    await page.locator('.tabs a[data-tab="dados"]').click();await page.locator('.data-sections-body').waitFor();
    await page.locator('.tabs a[data-tab="pad"]').click();await page.locator('#pad-batch-header').waitFor();
    assert.equal(await page.locator('[data-pad-batch]:checked').count(),0,'Reentrada limpa seleção de ação');
    await page.locator('#pad-batch-1').check();await page.locator('#pad-batch-3').check();
    const before=clone(memory.proposals[0]);
    await page.locator('#pad-batch-action').selectOption('ok');await page.locator('#pad-batch-apply').click();
    await page.locator('#modal-content button[type="submit"]').click();
    await page.waitForFunction(()=>!document.querySelector('#modal').open);
    assert.equal(posts,1,'Lote inteiro em uma gravação');assert.equal(memory.revision,8);
    const after=memory.proposals[0];
    for(const id of ['1','3']){assert.equal(after.reviews.pad[id].status,'ok');for(const field of ['note','document','url','attachments'])assert.deepEqual(after.reviews.pad[id][field],before.reviews.pad[id][field]);}
    for(const id of ['2','4'])assert.deepEqual(after.reviews.pad[id],before.reviews.pad[id]);
    assert.deepEqual(after.diligences,before.diligences,'Não encerra diligências sem análise');
    assert.equal(after.history.length,before.history.length+2,'Histórico individual preservado');
    assert.equal(await page.locator('[data-pad-batch]:checked').count(),0);
    await page.locator('#pad-search').fill('monitor');await page.locator('#pad-batch-header').check();
    assert.equal(await page.locator('[data-pad-batch]:checked').count(),1,'Selecionar todos respeita o filtro');
    await page.locator('#pad-batch-clear').click();await page.locator('#pad-search').fill('');
    await page.locator('#pad-batch-header').check();
    assert.equal(await page.locator('[data-pad-batch]:checked').count(),4);
    const unchanged=clone(memory);failNext=true;
    await page.locator('#pad-batch-action').selectOption('ok');await page.locator('#pad-batch-apply').click();await page.locator('#modal-content button[type="submit"]').click();
    await page.locator('#form-error').filter({hasText:'Conflito de revisão'}).waitFor();
    assert.deepEqual(memory,unchanged,'Falha não salva parcialmente');
    assert.equal(await page.locator('[data-pad-batch]:checked').count(),4,'Falha mantém seleção para repetir');
    await page.locator('#modal-content button[type="submit"]').click();
    await page.waitForFunction(()=>!document.querySelector('#modal').open);
    assert.equal(memory.revision,9);assert.equal(posts,3,'Uma tentativa com falha e uma repetição');
    assert.ok(Object.values(memory.proposals[0].reviews.pad).every(r=>r.status==='ok'));
    assert.equal(memory.proposals[0].history.length,after.history.length+2,'Itens já compatíveis não são regravados');
    const documents=clone(memory.proposals[0].reviews.pad);
    const apply=async(action,note='')=>{
      await page.locator('#pad-batch-header').check();
      await page.locator('#pad-batch-action').selectOption(action);
      await page.locator('#pad-batch-apply').click();
      if(note)await page.locator('#modal-content textarea[name="note"]').fill(note);
    };
    const submit=async()=>{await page.locator('#modal-content button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);};
    await apply('obs','Observação comum ao conjunto');await submit();
    assert.ok(Object.values(memory.proposals[0].reviews.pad).every(r=>r.status==='obs' && r.note==='Observação comum ao conjunto'));
    await apply('no');await submit();
    assert.ok(Object.values(memory.proposals[0].reviews.pad).every(r=>r.status==='no' && r.note==='Observação comum ao conjunto'));
    await apply('na');await submit();
    assert.ok(Object.values(memory.proposals[0].reviews.pad).every(r=>r.status==='na'));
    const oldDiligence=clone(memory.proposals[0].diligences[0]);
    await apply('diligencia','Solicitação comum aos quatro itens');
    await page.locator('#modal-content input[name="communication"]').fill('2026-09-30');
    await submit();
    assert.equal(memory.proposals[0].diligences.length,4,'Uma diligência por item, reutilizando a existente');
    assert.equal(memory.proposals[0].diligences.find(d=>d.ref==='pad:3').id,oldDiligence.id);
    assert.ok(Object.values(memory.proposals[0].reviews.pad).every(r=>r.status==='diligencia'));
    const diligenceIDs=memory.proposals[0].diligences.map(d=>d.id);
    await apply('diligencia','Atualização da solicitação');await submit();
    assert.deepEqual(memory.proposals[0].diligences.map(d=>d.id),diligenceIDs,'Repetir ação não duplica diligências');
    for(const id of ['1','2','3','4'])for(const field of ['document','url','attachments'])assert.deepEqual(memory.proposals[0].reviews.pad[id][field],documents[id][field]);
    assert.equal(posts,8,'Uma persistência por ação do conjunto, incluindo a falha');
    const extra=D.saveDiligence(memory.proposals[0],{...memory.proposals[0].diligences.find(d=>d.ref==='pad:3'),id:'',request:'Outra diligência ativa'},'Fixture');
    const extraBefore=clone(extra);memory.revision++;token=hash(memory);
    await page.reload();await page.locator('#pad-batch-header').waitFor();
    await page.locator('#pad-batch-2').check();await page.locator('#pad-batch-3').check();
    await page.locator('#pad-batch-action').selectOption('diligencia');await page.locator('#pad-batch-apply').click();
    await page.locator('#modal-content textarea[name="note"]').fill('Solicitação para o conjunto');
    await page.locator('#modal-content button[type="submit"]').click();
    assert.equal(posts,8,'Exige indicar a diligência quando há mais de uma ativa');
    await page.locator('#modal-content select[name="d_3"]').selectOption(oldDiligence.id);
    await submit();
    assert.equal(posts,9);assert.equal(memory.proposals[0].diligences.length,5);
    assert.deepEqual(memory.proposals[0].diligences.find(d=>d.id===extra.id),extraBefore,'Não modifica a diligência que não foi escolhida');
    const terminalCases=[];
    for(const terminal of ['nao_saneada','saneada']){
      memory=fixture();const p=memory.proposals[0];
      const closed=clone(D.saveDiligence(p,{...p.diligences[0],status:terminal,response:'2026-09-03',note:'Conclusão encerrada',request:'Providência encerrada'},'Fixture'));
      memory.revision++;token=hash(memory);await page.reload();await page.locator('#pad-batch-header').waitFor();
      await page.locator('#pad-batch-3').check();await page.locator('#pad-batch-action').selectOption('diligencia');await page.locator('#pad-batch-apply').click();
      await page.locator('#modal-content textarea[name="note"]').fill('Nova providência do lote');
      const before=clone(memory),count=posts;failNext=true;await page.locator('#modal-content button[type="submit"]').click();await page.locator('#form-error').filter({hasText:'Conflito de revisão'}).waitFor();assert.deepEqual(memory,before);
      await page.locator('#modal-content form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await page.waitForFunction(()=>!document.querySelector('#modal').open);
      assert.equal(posts,count+2,'Conflito e repetição duplicada contam uma tentativa cada');assert.equal(memory.proposals[0].diligences.length,2);
      assert.deepEqual(memory.proposals[0].diligences.find(d=>d.id===closed.id),closed,'Terminal permanece integralmente intacta');
      const fresh=clone(memory.proposals[0].diligences.find(d=>d.id!==closed.id));assert.equal(fresh.status,'aberta');assert.equal(fresh.request,'Nova providência do lote');
      for(const field of ['response','science','note','communication'])assert.equal(fresh[field],'');
      const persisted=clone(memory);await page.reload();await page.locator('#pad-batch-header').waitFor();assert.deepEqual(memory,persisted);
      assert.equal(memory.proposals[0].history.filter(h=>h.event==='Diligência cadastrada').length,2);
      await page.locator('#pad-batch-3').check();await page.locator('#pad-batch-action').selectOption('diligencia');await page.locator('#pad-batch-apply').click();await page.locator('#modal-content textarea[name="note"]').fill('Atualizar somente ativa');await submit();
      assert.equal(memory.proposals[0].diligences.length,2);assert.equal(memory.proposals[0].diligences.find(d=>d.id!==closed.id).id,fresh.id);assert.deepEqual(memory.proposals[0].diligences.find(d=>d.id===closed.id),closed);terminalCases.push(terminal);
    }
    assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
    // Conferência visual reutiliza a mesma fixture isolada, sem servidor real.
    const visual=page;
    await visual.locator('#pad-batch-header').check();await visual.locator('.pad-batch-bar').scrollIntoViewIfNeeded();
    const output=path.join(root,'output/pad-batch');fs.mkdirSync(output,{recursive:true});
    await visual.screenshot({path:path.join(output,'fixture-selecao.png')});
    await visual.setViewportSize({width:390,height:844});await visual.locator('.pad-batch-bar').scrollIntoViewIfNeeded();
    await visual.screenshot({path:path.join(output,'fixture-selecao-mobile.png')});
    // A publicação mantém a consulta dos detalhes e não oferece aprovação.
    const publicDir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-batch-public-'));
    build({state:clone(memory),history:[],outputDir:publicDir,quiet:true});for(const name of ['index.html','public-storage.js'])fs.copyFileSync(path.join(root,'docs',name),path.join(publicDir,name));
    const publicContext=await browser.newContext({serviceWorkers:'block'});await publicContext.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==ORIGIN || req.method()!=='GET' || url.pathname.startsWith('/api/'))return route.abort('blockedbyclient');return fulfillStatic(route,publicDir);});
    const publicPage=await publicContext.newPage();
    await publicPage.goto(ORIGIN+'/index.html#proposta/990777/pad');
    await publicPage.locator('.pad-table').waitFor();
    assert.equal(await publicPage.locator('[data-pad-batch],#pad-batch-header,.pad-batch-bar').count(),0);
    await publicContext.close();fs.rmSync(publicDir,{recursive:true,force:true});
    console.log(JSON.stringify({status:'passed',realDatabaseWrites:0,actions:['ok','obs','no','na','diligencia'],terminalCases,simulatedConflicts:3,pageErrors:errors.length,readonlyPublic:true}));
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
