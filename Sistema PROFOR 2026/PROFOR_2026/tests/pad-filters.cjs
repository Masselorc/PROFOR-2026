'use strict';
/* Interação do PAD pelo servidor real, com /api/state isolada em memória.
   Verifica seleção múltipla, busca combinada, totais e ausência de gravações. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const D=require('../domain.js');
const playwrightPath=process.env.PROFOR_PLAYWRIGHT_PATH || 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright';
const {chromium}=require(playwrightPath);
const ORIGIN='http://127.0.0.1:8766';
const STATIC=new Set(['/PROFOR_2026.html','/styles.css','/domain.js','/sync-apply.js','/bandeiras-uf.js','/storage.js','/transferegov.js','/report.js','/app.js']);
const root=path.resolve(__dirname,'../../..');
const output=path.join(root,'output','pad-filters');

function fixture(){
  const state=D.initialState();state.revision=1;
  const pad=[
    {id:'1',descricao:'Cadeira interlocutor',quantidade:'10',unitario:75430,total:754300},
    {id:'2',descricao:'Cadeira dobrável',quantidade:'10',unitario:10999,total:109990},
    {id:'3',descricao:'Mesa de trabalho',quantidade:'2',unitario:50000,total:100000},
    {id:'4',descricao:'Monitor',quantidade:'1',unitario:90000,total:90000}
  ];
  for(const [id,uf,items] of [['990888','AP',pad],['990889','AM',pad.slice(0,2)]]){
    const global=items.reduce((sum,item)=>sum+item.total,0);
    state.proposals.push(D.createProposal({id,numero:id+'/2026',uf,programa:D.PROGRAM,proponente:'Fixture isolada',cnpj:'',orgao:'',objeto:'Equipamentos',situacao:'Proposta/Plano de Trabalho Enviado para Análise',data:'2026-09-01',repasse:global,contrapartida:0,global,pad:items}));
  }
  return D.validateState(state);
}

async function main(){
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const errors=[];let writes=0;
  try{
    const memory=fixture();
    const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'pt-BR',serviceWorkers:'block'});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin===ORIGIN && url.pathname==='/api/state'){
        if(route.request().method()!=='GET'){writes++;return route.abort();}
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({exists:true,state:memory,token:createHash('sha256').update(JSON.stringify(memory)).digest('hex'),recovery:null})});
      }
      if(url.origin===ORIGIN && STATIC.has(url.pathname))return route.continue();
      return route.abort();
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(ORIGIN+'/PROFOR_2026.html#proposta/990888/pad');
    const rows=page.locator('.pad-table tbody tr[data-pad-item]');
    await rows.first().waitFor();
    assert.equal(await rows.count(),4,'Todos os itens ao abrir');
    assert.equal(await page.locator('[data-pad-select]:checked').count(),0);
    assert.equal(await page.locator('.pad-table tfoot .number').innerText(),D.fmtMoney(1054290));
    await page.locator('#pad-item-selector summary').click();
    await page.locator('#pad-pick-0').check();
    await page.locator('#pad-pick-2').check();
    assert.equal(await rows.count(),2,'União de dois itens selecionados');
    assert.equal(await page.locator('.pad-table tfoot .number').innerText(),D.fmtMoney(854300));
    assert.equal(await page.locator('#pad-item-selector').getAttribute('open'),'');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'pad-pick-2','Foco preservado ao marcar');
    await page.locator('#pad-search').click();
    assert.equal(await page.locator('#pad-item-selector').getAttribute('open'),null,'Clique fora fecha o seletor');
    await page.locator('#pad-search').fill('cadeira');
    assert.equal(await rows.count(),1,'Busca cruza com a seleção');
    assert.equal(await page.locator('.pad-table tfoot .number').innerText(),D.fmtMoney(754300));
    await page.locator('#pad-search').fill('monitor');
    assert.equal(await rows.count(),0,'Busca fora do conjunto não exibe itens');
    assert.match(await page.locator('.pad-table tbody').innerText(),/Nenhum item corresponde aos filtros/);
    assert.equal(await page.locator('.pad-table tfoot .number').innerText(),D.fmtMoney(0));
    await page.locator('#pad-show-all').click();
    assert.equal(await rows.count(),4);
    assert.equal(await page.locator('#pad-search').inputValue(),'');
    assert.equal(await page.locator('[data-pad-select]:checked').count(),0);
    await page.locator('#pad-item-selector summary').focus();
    await page.keyboard.press('Enter');
    await page.locator('#pad-pick-1').focus();
    await page.keyboard.press('Space');
    assert.equal(await rows.count(),1,'Seleção pelo teclado');
    await page.locator('#pad-pick-1').press('Escape');
    assert.equal(await page.locator('#pad-item-selector').getAttribute('open'),null,'Escape fecha o seletor');
    await page.keyboard.press('Enter');
    await page.locator('#pad-pick-1').uncheck();
    assert.equal(await rows.count(),4,'Sem seleção, todos os itens');
    await page.locator('#pad-search').click();
    await page.locator('#pad-search').fill('cadeira');
    assert.equal(await rows.count(),2,'Busca textual sozinha');
    await page.locator('#pad-search').press('Escape');
    assert.equal(await rows.count(),4);
    await page.locator('#pad-item-selector summary').click();
    await page.locator('#pad-pick-3').check();
    await page.locator('.tabs a[data-tab="dados"]').click();
    await page.locator('.data-sections-body').waitFor();
    await page.locator('.tabs a[data-tab="pad"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.pad-table tbody tr[data-pad-item]').length===4);
    assert.equal(await rows.count(),4,'Reentrada na aba exibe todos');
    await page.locator('#pad-item-selector summary').click();
    await page.locator('#pad-pick-3').check();
    await page.goto(ORIGIN+'/PROFOR_2026.html#proposta/990889/pad');
    await page.waitForFunction(()=>document.querySelectorAll('.pad-table tbody tr[data-pad-item]').length===2);
    assert.equal(await page.locator('[data-pad-select]:checked').count(),0,'Seleção não vaza entre propostas');
    assert.equal(writes,0,'Filtros não gravam no banco');

    // Mesma interação na consulta pública estática, com a base já publicada.
    const sandbox={window:{}};
    vm.runInNewContext(fs.readFileSync(path.join(root,'docs/dados_publicos.js'),'utf8'),sandbox);
    const proposal=sandbox.window.PROFOR_PUBLIC_DATA.proposals.find(p=>!p.isDeleted && p.imported.pad?.length>2);
    assert.ok(proposal,'Snapshot contém PAD para verificar a consulta pública');
    const publicPage=await browser.newPage({viewport:{width:1440,height:1000}});
    publicPage.on('pageerror',error=>errors.push(error.message));
    await publicPage.goto('file:///'+path.join(root,'docs/index.html').replace(/\\/g,'/')+'#proposta/'+proposal.id+'/pad');
    const publicRows=publicPage.locator('.pad-table tbody tr[data-pad-item]');
    await publicRows.first().waitFor();
    assert.equal(await publicRows.count(),proposal.imported.pad.length);
    await publicPage.locator('#pad-item-selector summary').click();
    await publicPage.locator('#pad-pick-0').check();
    await publicPage.locator('#pad-pick-1').check();
    assert.equal(await publicRows.count(),2,'Seleção múltipla também na consulta pública');
    assert.equal(await publicPage.locator('button[data-status-toggle]').count(),0,'Consulta mantém modo somente leitura');
    const lastPick=publicPage.locator('#pad-pick-'+(proposal.imported.pad.length-1));
    await lastPick.check();
    assert.equal(await publicRows.count(),3);
    assert.ok(await publicPage.locator('#pad-item-options').evaluate(el=>el.scrollTop)>0,'Rolagem preservada ao selecionar item no fim da lista');
    await lastPick.uncheck();
    assert.equal(await publicRows.count(),2);
    await publicPage.locator('#pad-item-options').evaluate(el=>{el.scrollTop=0;});
    fs.mkdirSync(output,{recursive:true});
    await publicPage.locator('.pad-cards').scrollIntoViewIfNeeded();
    await publicPage.screenshot({path:path.join(output,'selecao-desktop.png')});
    await publicPage.locator('#pad-item-selector summary').click();
    await publicPage.setViewportSize({width:390,height:844});
    await publicPage.locator('#pad-item-selector summary').click();
    const box=await publicPage.locator('.pad-selector-panel').boundingBox();
    assert.ok(box.x>=0 && box.x+box.width<=390,'Seletor cabe na tela de celular');
    await publicPage.locator('#pad-item-selector summary').scrollIntoViewIfNeeded();
    await publicPage.screenshot({path:path.join(output,'selecao-mobile.png')});
    assert.deepEqual(errors,[],'Sem erros de página');
    console.log(JSON.stringify({status:'passed',realDatabaseWrites:writes,pageErrors:errors.length,localAndPublic:true,scenarios:['default','multiple','text intersection','empty','totals','clear','keyboard','tab reset','proposal reset','mobile']}));
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
