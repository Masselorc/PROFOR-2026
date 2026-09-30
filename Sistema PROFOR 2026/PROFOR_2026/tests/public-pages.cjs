/* Teste de integração da publicação estática (docs/index.html no GitHub Pages). */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const D = require('../domain.js');
const { createStore } = require('../workspace-store.cjs');
const playwrightPath = process.env.PROFOR_PLAYWRIGHT_PATH ||
  (fs.existsSync('C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright')
    ? 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright'
    : 'C:/Users/marcelo.cortez/AppData/Local/Programs/nodejs/node-v24.15.0-win-x64/node_modules/playwright');
const { chromium } = require(playwrightPath);

const ROOT = path.resolve(__dirname, '..', '..', '..');
const DOCS = path.join(ROOT, 'docs');

function snapshot() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(DOCS, 'dados_publicos.js'), 'utf8'), context);
  return context.window.PROFOR_PUBLIC_DATA;
}

async function run() {
  const data = snapshot();
  const local = createStore(path.resolve(__dirname, '../dados/registros')).load().state;
  const deletedCount = D.deletedProposals(data).length;
  D.validateState(data);
  assert.equal(data.revision, local.revision, 'Snapshot deve refletir a revisão local atual.');
  assert.equal(data.proposals.length, local.proposals.length);
  assert.equal(D.activeProposals(data).length, D.activeProposals(local).length);
  assert.equal(deletedCount, D.deletedProposals(local).length);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [];
    const writes = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('request', request => {if(!['GET','HEAD'].includes(request.method()))writes.push(request.url());});

    console.log('1. Carregando docs/index.html...');
    await page.goto('file:///' + path.join(DOCS, 'index.html').replace(/\\/g, '/'));
    await page.waitForSelector('#uf-rows tr.uf-row', { timeout: 10000 });

    // Barra superior e menu lateral
    assert.match(await page.textContent('.local-label'), /Consulta pública/);
    assert.equal(await page.$eval('#server-open', el => el.hidden), true, 'Ligar servidor deve estar oculto no ambiente estático');
    assert.equal(await page.$eval('#nav-deleted', el => el.hidden), false, 'Lixeira deve estar visível');
    assert.equal(await page.textContent('#del-count'), deletedCount?String(deletedCount):'', 'Contador da lixeira deve acompanhar o snapshot');

    // 5 Cards de estatísticas
    const statCards = await page.locator('.dashboard-stats .stat').count();
    assert.equal(statCards, 5, 'Painel deve exibir os 5 cards de estatísticas');

    // 5 Filtros do painel
    assert.ok(await page.locator('#search').isVisible(), 'Filtro de busca visível');
    assert.ok(await page.locator('#filter-uf').isVisible(), 'Filtro de UF visível');
    assert.ok(await page.locator('#filter-source').isVisible(), 'Filtro de status Transferegov visível');
    assert.ok(await page.locator('#filter-status').isVisible(), 'Filtro de status proposta visível');
    assert.ok(await page.locator('#filter-control').isVisible(), 'Filtro de controle visível');

    // 14 UFs na tabela com botão de expansão
    const rowsCount = await page.locator('#uf-rows tr.uf-row').count();
    assert.equal(rowsCount, Object.keys(D.UFS).length, '14 UFs presentes na tabela');

    // Botão Sincronização presente no painel
    const syncBtn = page.locator('button[data-action="sync"]');
    assert.equal(await syncBtn.count(), 1, 'Botão Sincronização presente');
    await syncBtn.click();
    await page.waitForSelector('#modal[open]');
    assert.match(await page.textContent('#modal-content'), /ATUALIZAR_GITHUB_PAGES\.cmd/);
    await page.locator('#modal-close').click();

    // Expansão de linha de UF
    console.log('2. Testando expansão de linha...');
    const firstExpand = page.locator('#uf-rows tr.uf-row button.row-expand').first();
    await firstExpand.click();
    await page.waitForSelector('tr.uf-summary');

    // Detalhar proposta
    console.log('3. Abrindo detalhes da proposta...');
    const detailLink = page.locator('#uf-rows tr.uf-row a.btn-detail').first();
    await detailLink.click();
    await page.waitForSelector('nav.tabs');

    // Abas de navegação da proposta presentes
    const abas = await page.locator('nav.tabs a').allInnerTexts();
    assert.ok(abas.includes('Dados'), 'Aba Dados presente');
    assert.ok(abas.includes('Mérito'), 'Aba Mérito presente');
    assert.ok(abas.includes('Diligências'), 'Aba Diligências presente');

    // Navega para Mérito
    console.log('4. Navegando para Mérito...');
    await page.getByRole('link', { name: 'Mérito', exact: true }).click();
    await page.waitForSelector('#tab-content table');

    // Detalhes públicos devem reproduzir as análises gravadas sem oferecer edição.
    console.log('4a. Conferindo detalhes de análise somente para leitura no PAD do DF...');
    const df=data.proposals.find(p=>!p.isDeleted && p.imported.uf==='DF');
    assert.ok(df);
    await page.goto('file:///' + path.join(DOCS, 'index.html').replace(/\\/g, '/')+'#proposta/'+df.id+'/pad');
    await page.locator('.pad-table tbody tr[data-pad-item]').first().waitFor();
    const before=await page.evaluate(()=>JSON.stringify(window.PROFOR_PUBLIC_DATA));
    await page.evaluate(()=>{window.publicSaveCalls=0;ProforStore.save=()=>{window.publicSaveCalls++;throw new Error('Consulta não deve salvar.');};});
    assert.equal(await page.locator('.pad-table button[data-action="review"]').count(),df.imported.pad.length);
    const statuses=new Set();
    for(const item of df.imported.pad){
      const review=D.reviewOf(df,'pad',item.id);
      if(statuses.has(review.status))continue;
      statuses.add(review.status);
      const trigger=page.locator(`.pad-table button[data-action="review"][data-id="${item.id}"]`);
      await trigger.click();
      await page.locator('#modal[open]').waitFor();
      assert.match(await page.locator('#modal-content').innerText(),new RegExp('Plano de Aplicação Detalhado'));
      assert.equal(await page.locator('#modal-content textarea[name="note"]').inputValue(),review.note);
      assert.equal(await page.locator('#modal-content input:not([readonly]),#modal-content textarea:not([readonly]),#modal-content select,#modal-content form,#modal-content button[type="submit"]').count(),0,'Sem campos editáveis ou envio');
      const note=page.locator('#modal-content textarea[name="note"]');
      await note.focus();await page.keyboard.press('Control+a');await page.keyboard.insertText('Tentativa de alteração');
      assert.equal(await note.inputValue(),review.note,'Texto não pode ser alterado');
      const linked=df.diligences.filter(d=>d.ref==='pad:'+item.id);
      assert.deepEqual(await page.locator('#modal-content textarea[name="d_request"]').evaluateAll(els=>els.map(el=>el.value)),Array.from(linked,d=>d.request));
      assert.deepEqual(await page.locator('#modal-content textarea[name="d_note"]').evaluateAll(els=>els.map(el=>el.value)),Array.from(linked,d=>d.note));
      if(review.status==='obs'){
        await note.evaluate(el=>{el.setSelectionRange(0,0);el.blur();});
        const output=path.join(ROOT,'output/public-review');fs.mkdirSync(output,{recursive:true});
        await page.screenshot({path:path.join(output,'df-observacao.png')});
        await page.setViewportSize({width:390,height:844});
        const box=await page.locator('#modal').boundingBox();
        assert.ok(box.x>=0 && box.x+box.width<=390,'Pop-up cabe no celular');
        await page.screenshot({path:path.join(output,'df-observacao-mobile.png')});
        await page.setViewportSize({width:1366,height:768});
      }
      await page.getByRole('button',{name:'Fechar',exact:true}).click();
      await page.waitForFunction(()=>!document.querySelector('#modal').open);
      assert.equal(await trigger.evaluate(el=>el===document.activeElement),true,'Foco retorna ao botão');
    }
    assert.equal(await page.evaluate(()=>JSON.stringify(window.PROFOR_PUBLIC_DATA)),before,'Consulta preserva o snapshot');
    assert.equal(await page.evaluate(()=>window.publicSaveCalls),0);
    assert.deepEqual(writes,[],'Nenhuma requisição de gravação');

    // Navega para Lixeira
    console.log('5. Navegando para Lixeira...');
    await page.locator('#nav-deleted').click();
    await page.waitForSelector('#del-rows tr.uf-row');
    const delRowsCount = await page.locator('#del-rows tr.uf-row').count();
    assert.ok(delRowsCount >= 1, 'Lixeira deve exibir propostas apagadas');

    // Navega para Registros
    console.log('6. Navegando para Registros...');
    await page.locator('#nav-records').click();
    await page.waitForSelector('.records-calendar');

    assert.equal(errors.length, 0, errors.join('; '));
    console.log('Página pública reproduz com exatidão o sistema local e funciona sem erros!');
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
