'use strict';
/* Fluxos reais da UI sobre store temporário e HTTP interceptado. Não usa servidor
 * nem dados/registros. PROFOR_PLAYWRIGHT_PATH aponta à dependência disponível.
 * node "Sistema PROFOR 2026/PROFOR_2026/tests/prioridades-ui.cjs" */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(process.env.PROFOR_PLAYWRIGHT_PATH||'playwright');
const D=require('../domain.js'),{createStore}=require('../workspace-store.cjs');
const {build}=require('../../../tools/build_public_docs.cjs'),{fulfillStatic}=require('./ui-static.cjs');
const ORIGIN='http://127.0.0.1:9879',APP=path.resolve(__dirname,'..'),ROOT=path.resolve(APP,'../..'),OUTPUT=path.join(ROOT,'output/playwright/prioridades');
const long='Descrição sintética integral: equipamento destinado ao atendimento institucional. '.repeat(12)+'FINAL DO CONTEÚDO';
function proposal(id='101',ready=true,extra={}){
 const p=D.createProposal({id,numero:`TESTE-${id}/2026`,uf:'AP',programa:D.PROGRAM,proponente:'FIXTURE SINTÉTICA ISOLADA',cnpj:'',orgao:'',objeto:'Objeto fictício',situacao:'Proposta/Plano de Trabalho Enviado para Análise',data:'2026-09-15',repasse:50000,contrapartida:0,global:50000,pad:Array.from({length:5},(_,n)=>({id:String(11+n),descricao:n===0?long:`Item fictício ${n+1}`,quantidade:'2',unitario:5000,total:10000})),...extra});
 D.setTextos(p,{caracterizacao:'Texto oficial íntegro sintético',publicoAlvo:'Público fictício',problema:'Problema fictício',resultados:'Resultados fictícios',relacao:'Relação fictícia',capacidade:'Capacidade fictícia'},'Fixture');
 if(ready)for(const r of D.referenceRows(p))D.markReview(p,r.group,r.id,true,'Fixture');return p;
}
function fixture(p=proposal()){return {...D.initialState(),proposals:[p],sync:{at:'2026-09-30T12:00:00Z',source:'fixture',changes:[]}};}
async function environment(browser,state,publicMode=false,viewport={width:1366,height:768},touch=false){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-ui-')),store=createStore(path.join(dir,'records'));store.save({state,expected:0,token:null});
 const docs=path.join(dir,'docs');if(publicMode){build({state:store.load().state,history:[],outputDir:docs,updatedAt:'2026-10-02T12:00:00Z',quiet:true});for(const file of ['index.html','public-storage.js'])fs.copyFileSync(path.join(ROOT,'docs',file),path.join(docs,file));}
 const context=await browser.newContext({viewport,hasTouch:touch,serviceWorkers:'block',acceptDownloads:true,locale:'pt-BR',timezoneId:'America/Sao_Paulo'}),errors=[],requests=[],posts=[];
 const env={store,context,errors,requests,posts,fail:0,beforePost:null};
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());requests.push({path:url.pathname,method:req.method()});
  if(url.origin!==ORIGIN)return route.abort('blockedbyclient');
  if(!publicMode && url.pathname==='/api/state'){
   if(req.method()==='GET')return route.fulfill({json:store.load()});
   const body=req.postDataJSON();posts.push(body);
   if(env.fail){const status=env.fail;env.fail=0;return route.fulfill({status,json:{error:status===409?'Conflito simulado':'Falha de disco simulada'}});}
   try{if(env.beforePost)env.beforePost(body);return route.fulfill({json:store.save(body)});}catch(err){return route.fulfill({status:err.status||500,json:{error:err.message}});}
  }
  if(!publicMode && url.pathname==='/api/sync/history')return route.fulfill({json:{entries:store.history()}});
  if(!['GET','HEAD'].includes(req.method()) || url.pathname.startsWith('/api/'))return route.abort('blockedbyclient');
  return fulfillStatic(route,publicMode?docs:APP);
 });
 env.page=await context.newPage();env.page.setDefaultTimeout(10000);env.page.on('pageerror',e=>errors.push(e.message));
 env.goto=async tab=>{await env.page.goto(`${ORIGIN}/${publicMode?'index.html':'PROFOR_2026.html'}#proposta/101/${tab}`);await env.page.locator('#tab-content').waitFor();};
 env.close=async()=>{assert.deepEqual(errors,[]);await context.close();fs.rmSync(dir,{recursive:true,force:true});};return env;
}
async function openConclusion(t){await t.page.locator('[data-action="conclude"]').click();await t.page.locator('[name="reference"]').fill('Evidências da fixture conferidas');}
async function confirm(t){await t.page.locator('[data-action="confirm-conclusion"]').click();}
async function run(){
 fs.mkdirSync(OUTPUT,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});const passed=[];
 try{
  // 1: evento real, clique duplo, persistência imutável, recarga e relatório.
  let t=await environment(browser,fixture());await t.goto('dados');await openConclusion(t);
  await t.page.locator('[data-action="confirm-conclusion"]').evaluate(el=>{el.click();el.click();});
  await t.page.waitForFunction(()=>!document.querySelector('#modal').open);const saved=t.store.load().state.proposals[0];assert.equal(saved.conclusion.result,'favoravel');assert.equal(t.posts.length,1);assert.equal(saved.history.filter(h=>h.event==='Conclusão da análise técnica registrada').length,1);
  await t.page.reload();await t.page.locator('[data-action="conclude"]').waitFor();assert.match(await t.page.locator('#main').innerText(),/favor[aá]vel/i);
  await t.page.locator('[data-action="report"]').click();assert.match(await t.page.locator('#modal-content').innerText(),/Evidências da fixture conferidas/);await t.close();passed.push('1: clique duplo, store, recarga, histórico e relatório');
  // Erro recuperável, HTTP 409, bloqueio/evidência superveniente, revisão/token.
  for(const scenario of ['disk','post-conflict','new-block','evidence']){
   t=await environment(browser,fixture());await t.goto('dados');await openConclusion(t);const before=JSON.stringify(t.store.load().state);
   if(scenario==='disk')t.fail=500;if(scenario==='post-conflict')t.fail=409;
   if(scenario==='new-block'){const loaded=t.store.load(),next=D.clone(loaded.state);D.markReview(next.proposals[0],'pad','11',null,'Fixture');t.store.save({state:next,expected:loaded.state.revision,token:loaded.token});}
   if(scenario==='evidence')await t.page.evaluate(()=>{const check=ProforStore.checkCurrent;ProforStore.checkCurrent=async expected=>{const s=await check(expected);Profor.setTextos(s.proposals[0],{capacidade:'Evidência mudou'},'Fixture');return s;};});
   const persisted=JSON.stringify(t.store.load().state);await confirm(t);await t.page.waitForFunction(()=>document.querySelector('#form-error')?.textContent.length>0);
   assert.equal(await t.page.locator('#modal').isVisible(),true);assert.equal(await t.page.locator('[name="reference"]').inputValue(),'Evidências da fixture conferidas');assert.equal(JSON.stringify(t.store.load().state),persisted);assert.equal(t.store.load().state.proposals[0].conclusion,null);
   if(scenario==='disk'){assert.equal(await t.page.locator('#save-state').getAttribute('data-state'),'error');await confirm(t);await t.page.waitForFunction(()=>!document.querySelector('#modal').open);assert.equal(t.posts.length,2);assert.equal(t.store.load().state.proposals[0].history.filter(h=>h.event==='Conclusão da análise técnica registrada').length,1);}
   if(scenario==='new-block'||scenario==='post-conflict')assert.equal(await t.page.locator('#save-state').getAttribute('data-state'),'conflict');
   await t.close();passed.push(`1: ${scenario}`);
  }
  // 5/7: desfavorável, fatos atômicos e consulta consistente.
  const negative=proposal();D.setReview(negative,'merito','objeto',{status:'no',note:'Objeto incompatível na fixture',document:'',url:''},'Fixture');D.saveDiligence(negative,{ref:'merito:objeto',category:'PLANO DE TRABALHO',request:'Rever objeto sintético',communication:'2026-09-15',science:'',response:'',status:'nao_saneada',note:'Objeto incompatível na fixture',calendarNote:'',confirmed:false,due:''},'Fixture');
  t=await environment(browser,fixture(negative));await t.goto('dados');await openConclusion(t);await t.page.locator('[name="result"]').selectOption('desfavoravel');await t.page.locator('[name="note"]').fill('Conclusão sintética desfavorável fundamentada');await confirm(t);await t.page.waitForFunction(()=>!document.querySelector('#modal').open);assert.equal(t.store.load().state.proposals[0].conclusion.result,'desfavoravel');assert.equal(D.aptForCelebration(t.store.load().state.proposals[0]),false);await t.page.locator('#nav-panel').click();await t.page.locator('button.row-expand[data-uf="AP"]').click();assert.match(await t.page.locator('.row-card').innerText(),/0 aberta\(s\) · 1 encerrada\(s\) não saneada\(s\)/);await t.close();passed.push('5: conclusão desfavorável pelo botão e diligência terminal no painel');
  // 7: falha não salva metade da decisão institucional; mudança inversa requer nova revisão.
  t=await environment(browser,fixture());await t.goto('analise');const institutionBefore=JSON.stringify(t.store.load().state);t.fail=500;
  async function falaNo(){const c=t.page.locator('[data-status-dropdown][data-id="falaBRAdesao"]');await c.locator('[data-status-toggle]').click();await c.locator('[data-status-value="no"]').click();}
  await falaNo();await t.page.waitForFunction(()=>document.querySelector('#save-state').dataset.state==='error');assert.equal(JSON.stringify(t.store.load().state),institutionBefore);
  await falaNo();await t.page.waitForFunction(()=>document.querySelector('#save-state').dataset.state==='saved');let institutional=t.store.load().state.proposals[0];assert.equal(institutional.falaBR,'nao_previsto');assert.equal(institutional.reviews.merito.falaBRAdesao.status,'no');
  await t.page.locator('[data-action="institution"]').click();await t.page.locator('[name="falaBR"]').selectOption('aderido');await t.page.locator('#modal-content form button[type="submit"]').click();await t.page.waitForFunction(()=>!document.querySelector('#modal').open);institutional=t.store.load().state.proposals[0];assert.equal(institutional.falaBR,'aderido');assert.equal(institutional.reviews.merito.falaBRAdesao.status,'reanalise');await t.close();passed.push('7: falha atômica, decisão direta e edição inversa do fato');
  // Backup/restauração real da fixture; a revisão anterior permanece como recuperação.
  t=await environment(browser,fixture());await t.goto('dados');await t.page.locator('#nav-panel').click();await t.page.locator('[data-action="export"]').first().click();const downloading=t.page.waitForEvent('download');await t.page.getByRole('button',{name:'Exportar backup JSON',exact:true}).click();const backupDownload=await downloading,backupPath=await backupDownload.path(),backupContent=fs.readFileSync(backupPath);assert.equal(JSON.parse(backupContent).proposals.length,1);
  await t.page.getByLabel('Restaurar backup JSON',{exact:true}).setInputFiles({name:'fixture-backup.json',mimeType:'application/json',buffer:backupContent});await t.page.getByRole('button',{name:'Validar restauração',exact:true}).click();await t.page.getByRole('button',{name:'Restaurar este backup',exact:true}).click();await t.page.waitForFunction(()=>!document.querySelector('#modal').open);assert.deepEqual(t.store.load().state.proposals,t.store.load().recovery.proposals);await t.close();passed.push('backup JSON e restauração pelo botão com recuperação');
  // 3: sem PAD anterior, parcial não ganha aparência de ausência legítima de itens.
  const incomplete=proposal('101',false,{pad:[{id:'11',descricao:'Candidato sintético',quantidade:'2',unitario:5000,total:10000}],padExtraction:{version:1,status:'partial',source:'fixture.csv',at:'2026-10-02T12:00:00Z',received:2,accepted:1,rejected:1,reasons:[{line:2,itemId:'12',reason:'Quantidade inválida na fixture'}]}});
  t=await environment(browser,fixture(incomplete));await t.goto('pad');assert.match(await t.page.locator('.pad-table .empty').innerText(),/Importação incompleta/);assert.doesNotMatch(await t.page.locator('.pad-table .empty').innerText(),/não consta|não carregado/);assert.match(await t.page.locator('.result-section').innerText(),/Importação incompleta do PAD/);assert.doesNotMatch(await t.page.locator('.result-section').innerText(),/Arquivo do PAD não carregado|Sem itens de PAD publicados/);await t.page.getByText('Inspecionar extração candidata e rejeições (sem aplicação ao PAD oficial)',{exact:true}).click();assert.match(await t.page.locator('#tab-content').innerText(),/Candidato sintético/);assert.equal(t.store.load().state.proposals[0].imported.pad,null);await t.page.locator('#nav-panel').click();await t.page.locator('button.row-expand[data-uf="AP"]').click();assert.match(await t.page.locator('.row-card').innerText(),/Importação incompleta do PAD/);assert.doesNotMatch(await t.page.locator('.row-card').innerText(),/PAD não carregado|nenhum item publicado/);await t.close();passed.push('3: candidato/alerta, resumo e painel sem PAD íntegro anterior');
  // 8: filtros combinados na mesma proposta e link/valor/total correspondentes.
  const s=fixture();s.proposals.push(proposal('102',false,{situacao:'Proposta/Plano de Trabalho Cadastrados',global:60000}));
  t=await environment(browser,s);await t.page.goto(`${ORIGIN}/PROFOR_2026.html#painel`);await t.page.locator('#search').fill('TESTE-102');await t.page.locator('#filter-control').selectOption('financial');assert.equal(await t.page.locator('#uf-rows tr.uf-row').count(),1);assert.match(await t.page.locator('#uf-rows a.btn-detail').getAttribute('href'),/102/);assert.match(await t.page.locator('#panel-filter-count').innerText(),/600,00/);await t.page.locator('#filter-source').selectOption('enviada');assert.equal(await t.page.locator('#uf-rows tr.uf-row').count(),0);await t.page.locator('#filter-source').selectOption('');await t.page.locator('#uf-rows a.btn-detail').click();assert.match(t.page.url(),/102\/dados/);await t.close();passed.push('8: filtros, link e total filtrado');
  // 10: cinco decisões de mérito e cinco PAD só por teclado; erro conserva foco.
  t=await environment(browser,fixture(proposal('101',false)));await t.goto('analise');
  async function choose(group,id){const trigger=t.page.locator(`[data-status-dropdown][data-group="${group}"][data-id="${id}"] [data-status-toggle]`);await trigger.focus();await t.page.keyboard.press('Enter');await t.page.keyboard.press('Home');await t.page.keyboard.press('ArrowDown');await t.page.keyboard.press('Enter');await t.page.waitForFunction(()=>document.querySelector('#save-state').dataset.state==='saved');assert.equal(await trigger.evaluate(el=>document.activeElement===el),true);}
  await t.page.locator('.review-summary>summary').click();
  t.fail=500;const meritFirst=t.page.locator('[data-status-dropdown][data-group="merito"][data-id="objeto"] [data-status-toggle]');await meritFirst.focus();await t.page.keyboard.press('Enter');await t.page.keyboard.press('Home');await t.page.keyboard.press('ArrowDown');await t.page.keyboard.press('Enter');await t.page.waitForFunction(()=>document.querySelector('#save-state').dataset.state==='error');assert.equal(await meritFirst.evaluate(el=>document.activeElement===el),true);
  for(const id of ['objeto','justificativa','publicoAlvo','problema','resultados'])await choose('merito',id);
  assert.equal(await t.page.locator('.review-summary').getAttribute('open'),null);await t.goto('pad');
  const desc=t.page.locator('[data-pad-item="11"] .item-description summary');await desc.focus();await t.page.keyboard.press('Enter');assert.match(await t.page.locator('[data-pad-item="11"] .business-text').innerText(),/FINAL DO CONTEÚDO/);
  for(const id of ['11','12','13','14'])await choose('pad',id);
  assert.equal(await t.page.locator('[data-pad-item="11"] .item-description').getAttribute('open'),'');
  t.fail=500;const last=t.page.locator('[data-status-dropdown][data-group="pad"][data-id="15"] [data-status-toggle]');await last.focus();await t.page.keyboard.press('Enter');await t.page.keyboard.press('Home');await t.page.keyboard.press('ArrowDown');await t.page.keyboard.press('Enter');await t.page.waitForFunction(()=>document.querySelector('#save-state').dataset.state==='error');assert.equal(await last.evaluate(el=>document.activeElement===el),true);assert.equal(t.store.load().state.proposals[0].reviews.pad['15'].status,'na');await choose('pad','15');
  await t.page.locator('#notice').evaluate(el=>el.hidden=true);assert.equal(await t.page.locator('.pad-table').evaluate(el=>el.getBoundingClientRect().right<=innerWidth && el.parentElement.scrollWidth<=el.parentElement.clientWidth+1),true);await t.page.screenshot({path:path.join(OUTPUT,'desktop-pad.png')});await t.page.setViewportSize({width:390,height:844});await desc.scrollIntoViewIfNeeded();await t.page.screenshot({path:path.join(OUTPUT,'mobile-pad.png')});assert.equal(await t.page.locator('.pad-table').evaluate(el=>el.getBoundingClientRect().width<400),true);await t.page.locator('[data-pad-item="15"]').scrollIntoViewIfNeeded();await t.page.screenshot({path:path.join(OUTPUT,'mobile-acao.png')});
  await t.page.setViewportSize({width:683,height:384});const zoomSession=await t.context.newCDPSession(t.page);await zoomSession.send('Emulation.setDeviceMetricsOverride',{width:683,height:384,deviceScaleFactor:2,mobile:false});await desc.scrollIntoViewIfNeeded();await t.page.screenshot({path:path.join(OUTPUT,'reflow-dpr2-pad.png')});assert.ok(await desc.isVisible());await t.page.locator('[data-pad-item="15"]').scrollIntoViewIfNeeded();await t.page.screenshot({path:path.join(OUTPUT,'reflow-dpr2-acao.png')});await t.close();passed.push('10: 5 mérito + 5 PAD, foco, falha, expansão, desktop/mobile/reflow DPR2 (não é zoom do navegador)');
  // 6: diligências das duas abas, PAD com mesmo ID e mérito; mesma apresentação.
  const p=proposal();for(const ref of ['celebracao:6','celebracao:11','celebracao:9','merito:objeto','pad:11'])D.saveDiligence(p,{ref,category:'OUTRO',request:`Providência ${ref}`,communication:'2026-09-15',science:'2026-09-16',response:'2026-09-17',status:'saneada',note:`Conclusão ${ref}`},'Fixture');
  D.addAttachment(p,'proposta','6',{name:'fixture.txt',data:'data:text/plain;base64,Rml4dHVyZQ==',size:7,type:'text/plain',note:'Nota do anexo'},'Fixture');
  for(const r of D.referenceRows(p))D.markReview(p,r.group,r.id,true,'Fixture');
  const lookup={};for(const mode of [false,true]){t=await environment(browser,fixture(p),mode);await t.goto('diligencias');
   assert.equal(await t.page.locator('[data-action="view-diligence"]').count(),p.diligences.length);
   for(const d of p.diligences){await t.page.locator(`[data-action="view-diligence"][data-id="${d.id}"]`).click();const content=await t.page.locator('#modal-content dl').innerText();if(!mode)lookup[d.id]=content;else assert.equal(content,lookup[d.id]);assert.match(content,/Comunicação|comunicação/);assert.match(content,/Ciência|ciência/);await t.page.locator('#modal-close').click();}
   for(const [tab,id,ref] of [['proposta','6','celebracao:6'],['proposta','11','celebracao:11'],['formalizacao','9','celebracao:9'],['pad','11','pad:11'],['analise','objeto','merito:objeto']]){
    await t.goto(tab);const review=t.page.locator(`[data-action="review"][data-id="${id}"]`).first();if(await review.count())await review.click();else{const control=t.page.locator(`[data-status-dropdown][data-id="${id}"]`);await control.locator('[data-status-toggle]').click();await control.locator('[data-status-details]').click();}if(mode){assert.match(await t.page.locator('#modal-content').innerText(),new RegExp(`Providência ${ref}`));if(id==='6')assert.match(await t.page.locator('#modal-content').innerText(),/fixture.txt/);}await t.page.locator('#modal-close').click();
   }
   if(mode){const before=await t.page.evaluate(()=>JSON.stringify(PROFOR_PUBLIC_DATA));assert.match(await t.page.locator('#save-state').innerText(),/Snapshot gerado.*Brasília.*Última sincronização/s);assert.match(await t.page.evaluate(async()=>{try{await ProforStore.save({});return 'INCORRETO';}catch(e){return e.message;}}),/somente leitura/);
    await t.page.evaluate(()=>{for(const action of ['confirm-conclusion','delete-proposal-now','restore-proposal-now','institution','sync-start','import','review','resolve-ref','restore-proposal']){const b=document.createElement('button');b.dataset.action=action;b.dataset.id='101';if(action==='review'){b.dataset.group='merito';b.dataset.id='objeto';}document.body.append(b);b.click();b.remove();}});
    assert.equal(await t.page.evaluate(()=>JSON.stringify(PROFOR_PUBLIC_DATA)),before);assert.equal(t.posts.length,0);assert.equal(t.requests.filter(r=>r.path.startsWith('/api/')||!['GET','HEAD'].includes(r.method)).length,0);
    if(await t.page.locator('#modal').isVisible())await t.page.locator('#modal-close').click();await t.goto('pad');await t.page.locator('.item-description summary').first().click();assert.match(await t.page.locator('.business-text').first().innerText(),/FINAL DO CONTEÚDO/);
   }await t.close();
  }passed.push('6: detalhe integral idêntico, refs canônicas, anexos, handlers/adaptador sem mutação');
  t=await environment(browser,fixture(),false,{width:390,height:844},true);await t.goto('pad');await t.page.locator('.item-description summary').first().tap();assert.equal(await t.page.locator('.item-description').first().getAttribute('open'),'');await t.page.locator('[data-status-toggle]').first().tap();assert.equal(await t.page.locator('[data-status-popover]:visible').count(),1);await t.close();passed.push('10: toque simulado');
  fs.writeFileSync(path.join(OUTPUT,'resultado.json'),JSON.stringify({status:'PASS',passed,realDatabaseWrites:0,screenshots:['desktop-pad.png','mobile-pad.png','reflow-dpr2-pad.png','mobile-acao.png','reflow-dpr2-acao.png']},null,2));console.log(JSON.stringify({status:'PASS',passed,realDatabaseWrites:0}));
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
