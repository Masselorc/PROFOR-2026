/* Teste de integração da publicação estática (docs/index.html no GitHub Pages). */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const D = require('../domain.js');
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
  D.validateState(data);
  assert.equal(data.proposals.length, 14, 'Snapshot deve conter 14 propostas (9 ativas + 5 apagadas).');
  assert.equal(D.activeProposals(data).length, 9, '9 propostas ativas.');
  assert.equal(D.deletedProposals(data).length, 5, '5 propostas apagadas.');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    console.log('1. Carregando docs/index.html...');
    await page.goto('file:///' + path.join(DOCS, 'index.html').replace(/\\/g, '/'));
    await page.waitForSelector('#uf-rows tr.uf-row', { timeout: 10000 });

    // Barra superior e menu lateral
    assert.match(await page.textContent('.local-label'), /Consulta pública/);
    assert.equal(await page.$eval('#server-open', el => el.hidden), true, 'Ligar servidor deve estar oculto no ambiente estático');
    assert.equal(await page.$eval('#nav-deleted', el => el.hidden), false, 'Lixeira deve estar visível');
    assert.equal(await page.textContent('#del-count'), '5', 'Contador da lixeira deve exibir 5');

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
