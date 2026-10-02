'use strict';
// Fixtures descartáveis; todas as requisições HTTP são atendidas ou bloqueadas.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(process.env.PROFOR_PLAYWRIGHT_PATH||'playwright');
const D=require('../domain.js'),{createStore}=require('../workspace-store.cjs');
const {build}=require('../../../tools/build_public_docs.cjs'),{fulfillStatic}=require('./ui-static.cjs');
const APP=path.resolve(__dirname,'..'),ROOT=path.resolve(APP,'../..'),OUTPUT=path.join(ROOT,'output/seis-correcoes-2026-10-02');
const ORIGIN='http://127.0.0.1:9878',CHARACTERIZE=process.env.PROFOR_CHARACTERIZE==='1';
const long='Informação institucional longa, íntegra e sintética. '.repeat(15)+'FINAL INTEGRAL <img src=x onerror=window.fixtureExecuted=1>';
const clone=D.clone;
function proposal(){return D.createProposal({id:'606',numero:'FIXTURE-606/2026',uf:'RN',programa:D.PROGRAM,proponente:'FIXTURE SINTÉTICA',cnpj:'',orgao:'',objeto:'Objeto sintético',situacao:'Proposta/Plano de Trabalho Enviado para Análise',data:'2026-09-15',repasse:10000,contrapartida:0,global:10000,pad:[{id:'11',descricao:'Item sintético',quantidade:'2',unitario:5000,total:10000}]});}
function state(p=proposal()){return {...D.initialState(),proposals:[p]};}
async function environment(browser,seed,publicMode=false,viewport={width:1366,height:768},touch=false){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-six-ui-')),store=createStore(path.join(dir,'records'));store.save({state:seed,expected:0,token:null});
 const docs=path.join(dir,'docs');if(publicMode){build({state:store.load().state,history:[],outputDir:docs,quiet:true,updatedAt:'2026-10-02T12:00:00Z'});for(const name of ['index.html','public-storage.js'])fs.copyFileSync(path.join(ROOT,'docs',name),path.join(docs,name));}
 const context=await browser.newContext({viewport,hasTouch:touch,serviceWorkers:'block',locale:'pt-BR',timezoneId:'America/Sao_Paulo'});
 const env={dir,store,context,posts:[],requests:[],errors:[],blocked:[],fail:0};
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());env.requests.push({method:req.method(),path:url.pathname});
  if(url.origin!==ORIGIN){env.blocked.push(req.url());return route.abort('blockedbyclient');}
  if(!publicMode && url.pathname==='/api/state'){
   if(req.method()==='GET')return route.fulfill({json:store.load()});
   const body=req.postDataJSON();env.posts.push(body);
   if(env.fail){const status=env.fail;env.fail=0;return route.fulfill({status,json:{error:status===409?'Conflito sintético: nenhuma gravação':'Erro de escrita sintético: nenhuma gravação'}});}
   try{return route.fulfill({json:store.save(body)});}catch(e){return route.fulfill({status:e.status||500,json:{error:e.message}});}
  }
  if(!publicMode && url.pathname==='/api/sync/history' && req.method()==='GET')return route.fulfill({json:{entries:store.history()}});
  if(!['GET','HEAD'].includes(req.method()) || url.pathname.startsWith('/api/')){env.blocked.push(req.url());return route.abort('blockedbyclient');}
  return fulfillStatic(route,publicMode?docs:APP);
 });
 env.page=await context.newPage();env.page.setDefaultTimeout(5000);env.page.on('pageerror',e=>env.errors.push(e.message));env.page.on('dialog',d=>d.accept());
 env.goto=async tab=>{await env.page.goto(`${ORIGIN}/${publicMode?'index.html':'PROFOR_2026.html'}#proposta/606/${tab}`);await env.page.locator('#tab-content').waitFor();};
 env.read=()=>store.load().state.proposals[0];
 env.close=async()=>{await context.close();fs.rmSync(dir,{recursive:true,force:true});};
 return env;
}
async function reviewForm(t,id='11',group='pad'){
 const control=t.page.locator(`[data-status-dropdown][data-group="${group}"][data-id="${id}"]`);
 await control.locator('[data-status-toggle]').click();await control.locator('[data-status-details]').click();await t.page.locator('#modal[open] select[name="status"]').waitFor();
}
async function submit(t){await t.page.locator('#modal-content button[type="submit"]').click();await t.page.waitForFunction(()=>!document.querySelector('#modal').open);}
async function realZoom(results){
 const {PNG}=require(require.resolve('pngjs',{paths:[path.dirname(require.resolve(process.env.PROFOR_PLAYWRIGHT_PATH||'playwright'))]}));
 const measures=[];
 for(const publicMode of [false,true]){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'profor-real-zoom-'));
  const context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:false,viewport:{width:1366,height:768},serviceWorkers:'block',locale:'pt-BR',timezoneId:'America/Sao_Paulo'});let t;
  try{
   const settings=await context.newPage();await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('1');
   t=await environment({newContext:async()=>context},state(),publicMode);await t.goto('formalizacao');const session=await context.newCDPSession(t.page);
   const before=(await session.send('Page.getLayoutMetrics')).cssVisualViewport;assert.equal(before.zoom,1);
   await settings.locator('#zoomLevel').selectOption('2');assert.equal(await settings.locator('#zoomLevel').inputValue(),'2');
   await settings.locator('#zoomLevel').scrollIntoViewIfNeeded();await settings.screenshot({path:path.join(OUTPUT,'zoom-real-configuracao.png')});
   await t.page.bringToFront();await t.page.waitForFunction(()=>Math.abs(devicePixelRatio-2)<.01);
   for(const [tab,id,synthetic] of [['proposta','4',true],['formalizacao','19',false]]){
    const control=await detailsInteractions(t,tab,id,synthetic);const metric=(await session.send('Page.getLayoutMetrics')).cssVisualViewport;
    assert.equal(metric.zoom,2,'CDP confirma zoom REAL 200%');assert.equal(metric.scale,1,'Sem page scale/pinch');
    measures.push({mode:publicMode?'public':'admin',tab,requestedViewport:{width:1366,height:768},browserZoom:metric.zoom,pageScale:metric.scale,measured:await t.page.evaluate(()=>({innerWidth,innerHeight,outerWidth,outerHeight,dpr:devicePixelRatio}))});
    assert.equal(await t.page.locator('html').evaluate(el=>el.scrollWidth<=innerWidth+1),true);
    await control.summary.click();await control.summary.scrollIntoViewIfNeeded();await t.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    // Captura CDP da superfície visível: Playwright calcula clip como se zoom=1
    // e pode produzir imagem vazia quando o zoom REAL muda o viewport CSS.
    const capture=await session.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
    const buffer=Buffer.from(capture.data,'base64'),png=PNG.sync.read(buffer),colors=new Set();
    for(let i=0;i<png.data.length && colors.size<64;i+=52)colors.add(png.data.subarray(i,i+4).toString('hex'));
    assert.ok(colors.size>=16,'Captura da superfície contém conteúdo visual, não uma imagem uniforme');measures.at(-1).capture={width:png.width,height:png.height,distinctColorsAtLeast:colors.size};
    fs.writeFileSync(path.join(OUTPUT,`zoom-real-${publicMode?'public':'admin'}-${tab}.png`),buffer);
   }
   assert.equal(t.posts.length,0);assert.deepEqual(t.errors,[]);results.push({name:`4 zoom REAL 200% ${publicMode?'public':'admin'} ambas abas`,status:'PASS'});
  }finally{if(t)await t.close();else await context.close();assert.ok(profile.startsWith(path.join(os.tmpdir(),'profor-real-zoom-')));fs.rmSync(profile,{recursive:true,force:true});}
 }
 const evidence={status:'PASS',method:'Chrome headed, perfil temporário, chrome://settings/appearance select #zoomLevel=2; Page.getLayoutMetrics cssVisualViewport.zoom=2',emulation:false,measurements:measures};fs.writeFileSync(path.join(OUTPUT,'zoom-real-ui.json'),JSON.stringify(evidence,null,2));return evidence;
}
async function detailsInteractions(t,tab,id,synthetic=false){
 await t.goto(tab);
 if(synthetic){await t.page.evaluate(({id,text})=>{Profor.CELEBRACAO.find(item=>item.id===id).fundamentacao=text;},{id,text:long});await t.page.locator('.tabs a[data-tab="dados"]').click();await t.page.locator(`.tabs a[data-tab="${tab}"]`).click();}
 const row=t.page.locator(`tr[data-req-row][data-id="${id}"]`),details=row.locator('.req-fund details'),summary=details.locator('summary');
 const initial=await row.getAttribute('aria-expanded');assert.equal(initial,'false');
 for(const action of ['click','Enter','Space']){
  await summary.focus();if(action==='click')await summary.locator('span').first().click();else await t.page.keyboard.press(action);
  assert.equal(await details.evaluate(el=>el.open),true,`${tab}/${id}: ${action} abre fundamentação nativa`);
  assert.equal(await row.getAttribute('aria-expanded'),initial,'Fundamentação não altera anexos');
  assert.equal(await summary.evaluate(el=>document.activeElement===el),true,'Summary mantém foco após operação');
  const full=await details.locator('.business-text').innerText();assert.ok(full.length>180,'Texto completo longo visível');
  if(synthetic){assert.equal(full,long);assert.equal(await details.locator('img,script').count(),0);}
  await details.locator('.business-text').click();assert.equal(await row.getAttribute('aria-expanded'),initial,'Conteúdo interno de details não aciona anexos');
  await summary.focus();
  if(action==='click')await summary.click();else await t.page.keyboard.press(action);
  assert.equal(await details.evaluate(el=>el.open),false);assert.equal(await row.getAttribute('aria-expanded'),initial);
 }
 await summary.focus();await t.page.keyboard.press('Tab');assert.equal(await summary.evaluate(el=>document.activeElement===el),false,'Tab prossegue');
 await row.locator('.row-expand').click();assert.equal(await row.getAttribute('aria-expanded'),'true');
 await row.locator('.row-expand').focus();await t.page.keyboard.press('Enter');assert.equal(await row.getAttribute('aria-expanded'),'false');
 await row.focus();await t.page.keyboard.press('Space');assert.equal(await row.getAttribute('aria-expanded'),'true');
 assert.equal(await row.evaluate(el=>document.activeElement===el || el.contains(document.activeElement)),true,'Rerender intencional restaura foco equivalente');
 await row.focus();await t.page.keyboard.press('Enter');assert.equal(await row.getAttribute('aria-expanded'),'false');
 await row.scrollIntoViewIfNeeded();
 return {summary,details,row};
}
async function main(){
 fs.mkdirSync(OUTPUT,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:process.env.PROFOR_HEADED!=='1'}),results=[];let zoom={status:'NÃO EXECUTADO',reason:'Rodada não alcançou o cenário de zoom real.'};
 const test=async(name,run)=>{if(process.env.PROFOR_TEST_FILTER && !name.includes(process.env.PROFOR_TEST_FILTER))return;let t;try{t=await run();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',message:e.message});if(!CHARACTERIZE)throw e;}finally{if(t)await t.close();}};
 try{
  for(const terminal of ['nao_saneada','saneada'])await test(`2 individual ${terminal} cria aberta`,async()=>{
   const p=proposal();D.setReview(p,'pad','11',{status:'obs',note:'Nota anterior',document:'Documento preservado',url:'https://example.invalid/referencia'},'Fixture');
   const old=clone(D.saveDiligence(p,{ref:'pad:11',request:'Solicitação encerrada',category:'PLANO DE APLICAÇÃO DETALHADO',communication:'2026-09-01',response:'2026-09-03',status:terminal,note:'Conclusão encerrada'},'Fixture'));
   const t=await environment(browser,state(p));try{await t.goto('pad');await reviewForm(t);await t.page.locator('[name="status"]').selectOption('diligencia');
    assert.equal(await t.page.locator('[name="d_status"]').inputValue(),'aberta','Nova providência começa aberta, sem herdar terminal');
    for(const name of ['d_response','d_note','d_communication'])assert.equal(await t.page.locator(`[name="${name}"]`).inputValue(),'');
    await t.page.locator('textarea[name="note"]').fill('Nova solicitação');
    await t.page.locator('#modal-content form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await t.page.waitForFunction(()=>!document.querySelector('#modal').open);
    assert.equal(t.posts.length,1,'Submissão duplicada faz uma gravação');assert.equal(t.read().diligences.length,2);assert.deepEqual(t.read().diligences.find(d=>d.id===old.id),old);
    const fresh=t.read().diligences.find(d=>d.id!==old.id);assert.equal(fresh.status,'aberta');assert.equal(fresh.response,'');assert.equal(fresh.note,'');assert.equal(fresh.request,'Nova solicitação');
    const persisted=clone(t.read());await t.page.reload();await t.page.locator('#tab-content').waitFor();assert.deepEqual(t.read(),persisted);assert.equal(t.read().history.filter(h=>/Diligência/.test(h.event)).length,2);
    return t;
   }catch(e){await t.close();throw e;}
  });
  await test('4 CAUC summary nativo mantém anexos',async()=>{const t=await environment(browser,state());try{await detailsInteractions(t,'formalizacao','19');return t;}catch(e){await t.close();throw e;}});
  await test('6 ficha institucional pública disponível',async()=>{const t=await environment(browser,state(),true);try{await t.goto('analise');assert.equal(await t.page.locator('[data-action="view-institution"]').count(),1,'Público possui ação de consulta institucional');return t;}catch(e){await t.close();throw e;}});
  if(CHARACTERIZE)return;
  for(const result of ['favoravel','desfavoravel'])for(const ref of ['pad:11','merito:objeto'])await test(`1 conclusão ${result} ${ref} -> celebração via formulário`,async()=>{
   const p=proposal();const d=D.saveDiligence(p,{ref,request:'Providência técnica encerrada',category:'OUTRO',communication:'2026-09-01',response:'2026-09-03',status:result==='favoravel'?'saneada':'nao_saneada',note:'Encerramento sintético'},'Fixture');
   for(const r of D.referenceRows(p))D.markReview(p,r.group,r.id,true,'Fixture');
   if(result==='desfavoravel')D.setReview(p,'merito','objeto',{status:'no',note:'Motivo desfavorável sintético',document:'',url:''},'Fixture');
   const t=await environment(browser,state(p));try{
    await t.goto('dados');await t.page.locator('[data-action="conclude"]').click();await t.page.locator('[name="result"]').selectOption(result);await t.page.locator('[name="reference"]').fill('Referência técnica sintética');await t.page.locator('[name="note"]').fill('Justificativa da conclusão preservada');
    await t.page.locator('[data-action="confirm-conclusion"]').click();await t.page.waitForFunction(()=>!document.querySelector('#modal').open);assert.equal(D.conclusionValidity(t.read()).current,true);const conclusion=clone(t.read().conclusion);
    await t.goto('diligencias');await t.page.locator(`[data-action="diligence"][data-id="${d.id}"]`).click();await t.page.locator('[name="ref"]').selectOption('celebracao:6');
    const before=clone(t.read());t.fail=result==='favoravel'?500:409;await t.page.locator('#modal-content button[type="submit"]').click();await t.page.locator('#form-error').filter({hasText:/Conflito|Erro de escrita/}).waitFor();assert.deepEqual(t.read(),before,'Erro conserva conclusão/vínculo juntos');
    await submit(t);assert.equal(t.read().diligences.find(x=>x.id===d.id).ref,'celebracao:6');assert.equal(D.conclusionValidity(t.read()).current,false);assert.match(D.situation(t.read()),/nova análise|reanálise/i);
    assert.equal(t.read().conclusion.result,conclusion.result);for(const key of ['actor','at','reference','note','evidence'])assert.deepEqual(t.read().conclusion[key],conclusion[key]);
    await t.goto('dados');assert.match(await t.page.locator('#main').innerText(),/nova análise|reanálise/i);await t.page.locator('[data-action="report"]').click();assert.match(await t.page.locator('#report-preview').innerText(),/nova análise|reanálise/i);await t.page.locator('#modal-close').click();
    const saved=clone(t.read());await t.page.reload();await t.page.locator('#tab-content').waitFor();assert.deepEqual(t.read(),saved);assert.equal(D.conclusionValidity(t.read()).current,false);assert.equal(t.posts.length,3);return t;
   }catch(e){await t.close();throw e;}
  });
  const parity={};for(const mode of [false,true])for(const viewport of [{width:1366,height:768},{width:390,height:844}])await test(`4 fundamentos ${mode?'public':'admin'} ${viewport.width}`,async()=>{
   const t=await environment(browser,state(),mode,viewport,viewport.width===390);try{
    await detailsInteractions(t,'proposta','4',true);const x=await detailsInteractions(t,'formalizacao','19');
    if(viewport.width===390){await x.summary.tap();assert.equal(await x.details.evaluate(el=>el.open),true);assert.equal(await x.row.getAttribute('aria-expanded'),'false');}
    assert.equal(await t.page.locator('html').evaluate(el=>el.scrollWidth<=innerWidth+1),true,'Layout cabe na viewport');
    await t.page.screenshot({path:path.join(OUTPUT,`fundamento-${mode?'public':'admin'}-${viewport.width}.png`)});assert.deepEqual(t.errors,[]);assert.equal(t.posts.length,0);return t;
   }catch(e){await t.close();throw e;}
  });
  for(const mode of [false,true])await test(`6 ficha integral segura ${mode?'public':'admin'}`,async()=>{
   const p=proposal();Object.assign(p.ouvidoria,{status:'pendente',signature:'2026-09-20',url:'https://example.invalid/ato?ref=1&nome=2',note:long,clause:true,atoReferencia:'Ato sintético 123/2026',clausulaDados:{nota:'Condição sintética',data:'2026-09-20'}});p.falaBR='previsto';
   D.setReview(p,'merito','ouvidoriaInstituida',{status:'obs',note:'Nota exclusiva da avaliação',document:'Documento da avaliação',url:''},'Fixture');
   const t=await environment(browser,state(p),mode);try{
    await t.goto('analise');const before=JSON.stringify(t.read());const trigger=t.page.locator('[data-action="view-institution"]');await trigger.focus();await t.page.keyboard.press('Enter');
    const dl=t.page.locator('.institution-info');await dl.waitFor();assert.equal(await t.page.locator('#modal-content form,#modal-content input,#modal-content textarea,#modal-content select').count(),0,'Consulta sem inputs');
    const fields=await dl.locator('dt').evaluateAll(nodes=>nodes.map(dt=>[dt.textContent,dt.nextElementSibling.textContent]));
    if(!mode)parity.fields=fields;else assert.deepEqual(fields,parity.fields,'Todos os campos idênticos nos dois modos');
    const text=await dl.innerText();for(const fragment of ['Pendente','2026-09-20',long,'Ato sintético 123/2026','Condição sintética','Previsto no Plano de Trabalho'])assert.ok(text.includes(fragment),`Ficha contém ${fragment.slice(0,50)}`);
    assert.equal(await dl.locator('img,script').count(),0,'Texto malicioso permanece inerte');assert.equal(await t.page.evaluate(()=>window.fixtureExecuted),undefined);
    const link=dl.locator('a[href="https://example.invalid/ato?ref=1&nome=2"]');assert.equal(await link.count(),1);assert.equal(await link.getAttribute('target'),'_blank');await link.focus();assert.equal(await link.evaluate(el=>document.activeElement===el),true);
    await dl.locator('dt').first().scrollIntoViewIfNeeded();await t.page.screenshot({path:path.join(OUTPUT,`institucional-${mode?'public':'admin'}.png`)});
    await t.page.keyboard.press('Tab');await t.page.locator('#modal-close').focus();await t.page.keyboard.press('Enter');assert.equal(await trigger.evaluate(el=>document.activeElement===el),true,'Fechar ficha restaura foco no acionador');
    await trigger.click();await t.page.getByRole('button',{name:'Fechar',exact:true}).click();assert.equal(JSON.stringify(t.read()),before);assert.equal(t.posts.length,0);
    if(mode){const publicBefore=await t.page.evaluate(()=>JSON.stringify(PROFOR_PUBLIC_DATA));await t.page.evaluate(()=>{for(const action of ['institution','confirm-conclusion','delete-proposal-now','restore-proposal-now','sync-start','import','resolve-ref']){const b=document.createElement('button');b.dataset.action=action;document.body.append(b);b.click();b.remove();}});
     assert.equal(await t.page.evaluate(()=>JSON.stringify(PROFOR_PUBLIC_DATA)),publicBefore);assert.match(await t.page.evaluate(async()=>{try{await ProforStore.save({});return 'MUTATED';}catch(e){return e.message;}}),/somente leitura/);assert.equal(t.requests.filter(r=>r.method!=='GET'||r.path.startsWith('/api/')).length,0);
    }
    assert.deepEqual(t.errors,[]);return t;
   }catch(e){await t.close();throw e;}
  });
  for(const status of ['na','pendente'])await test(`3 formulário observação fato ${status} sem condição`,async()=>{
   const p=proposal();p.ouvidoria.status=status;const t=await environment(browser,state(p));try{await t.goto('analise');await reviewForm(t,'ouvidoriaInstituida','merito');await t.page.locator('[name="status"]').selectOption('obs');await t.page.locator('textarea[name="note"]').fill('Observação preservada, fato ainda não resolvido');await submit(t);
    assert.equal(t.read().ouvidoria.status,status);assert.equal(t.read().reviews.merito.ouvidoriaInstituida.status,'obs');assert.equal(D.institutionalAssessment(t.read(),'ouvidoriaInstituida').accepted,false);assert.match(await t.page.locator('#tab-content').innerText(),/pendente|conflito|não informad/i);
    await t.page.reload();await t.page.locator('#tab-content').waitFor();assert.equal(D.institutionalAssessment(t.read(),'ouvidoriaInstituida').accepted,false);assert.equal(t.posts.length,1);return t;
   }catch(e){await t.close();throw e;}
  });
  for(const fact of ['instituida','pendente'])await test(`3 formulário observação compatível ${fact}`,async()=>{const p=proposal();p.ouvidoria.status=fact;p.ouvidoria.clause=fact==='pendente';const t=await environment(browser,state(p));try{await t.goto('analise');await reviewForm(t,'ouvidoriaInstituida','merito');await t.page.locator('[name="status"]').selectOption('obs');await t.page.locator('textarea[name="note"]').fill('Observação compatível preservada');await submit(t);assert.equal(t.read().ouvidoria.status,fact);assert.equal(D.institutionalAssessment(t.read(),'ouvidoriaInstituida').accepted,true);assert.equal(t.read().reviews.merito.ouvidoriaInstituida.note,'Observação compatível preservada');await t.page.reload();await t.page.locator('#tab-content').waitFor();assert.equal(D.institutionalAssessment(t.read(),'ouvidoriaInstituida').accepted,true);return t;}catch(e){await t.close();throw e;}});
  await test('3 Fala.BR observação preserva exceção não bloqueante',async()=>{const t=await environment(browser,state());try{await t.goto('analise');await reviewForm(t,'falaBRAdesao','merito');await t.page.locator('[name="status"]').selectOption('obs');await t.page.locator('textarea[name="note"]').fill('Previsão do Fala.BR sintética');await submit(t);assert.equal(t.read().falaBR,'previsto');assert.equal(D.institutionalAssessment(t.read(),'falaBRAdesao').accepted,true);assert.equal(D.institutionalConflicts(t.read()).some(x=>x.id==='falaBRAdesao'),false);return t;}catch(e){await t.close();throw e;}});
  await test('6 legada ausente e protocolo inseguro inerte',async()=>{const p=proposal();p.ouvidoria.url='javascript:window.fixtureExecuted=1';p.ouvidoria.note=long;const t=await environment(browser,state(p),true);try{await t.goto('analise');await t.page.locator('[data-action="view-institution"]').click();const dl=t.page.locator('.institution-info');assert.match(await dl.innerText(),/Não informad/);assert.match(await dl.innerText(),/javascript:window.fixtureExecuted=1/);assert.equal(await dl.locator('a[href^="javascript:"]').count(),0);assert.equal(await t.page.evaluate(()=>window.fixtureExecuted),undefined);assert.equal(t.posts.length,0);return t;}catch(e){await t.close();throw e;}});
  await test('regressão contingência CSV comando/formulário/confirmação reais',async()=>{const t=await environment(browser,D.initialState());try{await t.page.goto(`${ORIGIN}/PROFOR_2026.html#painel`);await t.page.locator('#main').waitFor();
   // O HEAD oferece entrada file:// apenas. Dispara o comando existente; os
   // inputs, FileReader/parser, preview e confirmação abaixo são os da aplicação.
   await t.page.evaluate(()=>{const button=document.createElement('button');button.dataset.action='import';button.textContent='Comando de contingência sintético';document.body.append(button);button.click();button.remove();});
   await t.page.locator('#modal-content [name="program"]').waitFor();for(const [key,name] of [['program','siconv_programa.csv'],['links','siconv_programa_proposta.csv'],['proposal','siconv_proposta.csv'],['pad','siconv_plano_aplicacao_detalhado.csv']])await t.page.locator(`[name="${key}"]`).setInputFiles(path.join(__dirname,'fixtures',name));
   await t.page.getByRole('button',{name:'Conferir importação',exact:true}).click();await t.page.locator('#commit-import').waitFor();assert.equal(t.posts.length,0,'Prévia não salva');assert.match(await t.page.locator('#modal-content').innerText(),/1 proposta\(s\)/);await t.page.locator('#commit-import').click();await t.page.waitForFunction(()=>!document.querySelector('#modal').open);assert.equal(t.posts.length,1);const saved=t.store.load().state;assert.equal(saved.proposals.length,1);assert.equal(saved.proposals[0].id,'101');assert.ok(saved.proposals[0].imported.pad.length);await t.page.reload();await t.page.locator('#main').waitFor();assert.deepEqual(t.store.load().state,saved);assert.deepEqual(t.errors,[]);assert.deepEqual(t.blocked,[]);return t;
  }catch(e){await t.close();throw e;}});
  if(!process.env.PROFOR_TEST_FILTER || process.env.PROFOR_TEST_FILTER.includes('zoom'))zoom=await realZoom(results);
 }finally{
  await browser.close();const file=path.join(OUTPUT,CHARACTERIZE?'caracterizacao-ui.json':'resultado-ui.json');fs.writeFileSync(file,JSON.stringify({status:results.some(r=>r.status==='FAIL')?'FAIL':'PASS',characterization:CHARACTERIZE,results,realDatabaseWrites:0,zoom},null,2));console.log(JSON.stringify({results,realDatabaseWrites:0,zoom}));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
