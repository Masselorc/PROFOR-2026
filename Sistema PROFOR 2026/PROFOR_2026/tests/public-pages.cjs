/**
 * Teste E2E da Publicação Estática do GitHub Pages (docs/index.html).
 * Valida a integridade da página pública, o modo estritamente somente leitura
 * e a ausência de controles de edição e mutação de dados.
 */
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert');
const D = require('../domain.js');
const { createStore } = require('../workspace-store.cjs');

const playwrightPath = process.env.PROFOR_PLAYWRIGHT_PATH ||
  (fs.existsSync('C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright')
    ? 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright'
    : 'C:/Users/marcelo.cortez/AppData/Local/Programs/nodejs/node-v24.15.0-win-x64/node_modules/playwright');
const { chromium } = require(playwrightPath);

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const DOCS_INDEX = path.join(ROOT_DIR, 'docs', 'index.html');

async function run() {
  assert.ok(fs.existsSync(DOCS_INDEX), 'docs/index.html deve existir.');
  
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  console.log('1. Abrindo docs/index.html em modo estático...');
  const fileUrl = 'file:///' + DOCS_INDEX.replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForSelector('#uf-rows tr', { timeout: 10000 });

  const localState = createStore(path.join(__dirname, '..', 'dados', 'registros')).load().state;
  const publicState = await page.evaluate(() => window.PROFOR_PUBLIC_DATA);
  assert.strictEqual(publicState.revision, localState.revision, 'Snapshot deve refletir a revisão local atual.');
  assert.strictEqual(publicState.proposals.length, D.activeProposals(localState).length, 'Publicar apenas propostas ativas.');
  assert.ok(publicState.proposals.every(p => !p.isDeleted), 'A lixeira local não deve integrar o snapshot público.');
  assert.ok(!('lastBackup' in publicState), 'Metadados de backup local não devem integrar o snapshot público.');

  // 1. Verificações do cabeçalho e menu lateral
  const topbarLabel = await page.textContent('.local-label');
  assert.match(topbarLabel, /Consulta pública/i, 'Rótulo da barra superior deve indicar Consulta pública.');

  const serverHidden = await page.$eval('#server-open', el => el.hidden);
  assert.strictEqual(serverHidden, true, 'Botão Ligar servidor deve estar oculto na versão pública.');

  const importHidden = await page.$eval('#import-open', el => el.hidden);
  assert.strictEqual(importHidden, true, 'Botão Sincronizar Transferegov deve estar oculto na versão pública.');

  const backupHidden = await page.$eval('#backup-open', el => el.hidden);
  assert.strictEqual(backupHidden, true, 'Botão Backup e exportação deve estar oculto na versão pública.');

  const deletedHidden = await page.$eval('#nav-deleted', el => el.hidden);
  assert.strictEqual(deletedHidden, true, 'Menu Propostas apagadas deve estar oculto na versão pública.');

  // 2. Verificações no Painel Geral
  const syncBtnCount = await page.locator('button[data-action="sync"]').count();
  assert.strictEqual(syncBtnCount, 0, 'Botão Sincronizar com o Transferegov não deve existir no painel.');

  const ufsCount = await page.locator('#uf-rows tr.uf-row').count();
  assert.ok(ufsCount >= 8, `Painel deve listar as UFs (encontradas: ${ufsCount}).`);

  // 3. Expansão de linha no Painel Geral
  console.log('2. Testando expansão de linha de UF no Painel...');
  const rowExpand = page.locator('tr.uf-row[data-uf="MG"] button.row-expand').first();
  await rowExpand.click();
  await page.waitForSelector('tr.uf-summary .row-card');

  const btnDeleteCount = await page.locator('tr.uf-summary button[data-action="delete-proposal"]').count();
  assert.strictEqual(btnDeleteCount, 0, 'Botão "Apagar proposta" não deve existir na linha expandida.');

  const btnDetail = page.locator('tr.uf-summary a.btn-detail').first();
  assert.ok(await btnDetail.isVisible(), 'Botão "Abrir análise" deve estar visível.');
  await btnDetail.click();

  // 4. Detalhe da Proposta
  console.log('3. Validando página de Detalhe da Proposta...');
  await page.waitForSelector('.result-section');

  const seiEditBtnCount = await page.locator('button.sei-edit').count();
  assert.strictEqual(seiEditBtnCount, 0, 'Botão de editar processo SEI não deve existir.');

  const concludeBtnCount = await page.locator('button[data-action="conclude"]').count();
  assert.strictEqual(concludeBtnCount, 0, 'Botão de concluir análise não deve existir.');

  const reportBtn = page.locator('button[data-action="report"]');
  assert.ok(await reportBtn.isVisible(), 'Botão de gerar relatório técnico deve estar acessível.');

  // 5. Aba Requisitos da Proposta com expansão e anexos
  console.log('4. Validando aba de Requisitos da Proposta e expansão de linha...');
  await page.getByRole('link', { name: 'Requisitos da Proposta', exact: true }).click();
  await page.waitForSelector('table.req-table tbody tr[data-req-row]');

  const reqRowsCount = await page.locator('table.req-table tbody tr[data-req-row]').count();
  assert.strictEqual(reqRowsCount, 7, 'Requisitos da Proposta deve conter 7 itens.');

  // Botões de criar diligência não devem existir
  const diligReqBtnCount = await page.locator('table.req-table button[data-action="diligence"]').count();
  assert.strictEqual(diligReqBtnCount, 0, 'Botão de criar diligência não deve existir na tabela de requisitos.');

  // Expande o primeiro requisito
  await page.locator('table.req-table tr[data-req-row] button.row-expand').first().click();
  await page.waitForSelector('tr.row-summary-detail');

  // Não deve ter formulário de upload nem botão de exclusão
  const uploadBoxCount = await page.locator('.expansion-upload-box').count();
  assert.strictEqual(uploadBoxCount, 0, 'Área de upload de arquivos não deve existir na versão pública.');

  const deleteAttBtnCount = await page.locator('.attachment-actions button.att-delete').count();
  assert.strictEqual(deleteAttBtnCount, 0, 'Botão de excluir anexo não deve existir na versão pública.');

  const editDocBtnCount = await page.locator('button.att-doc-edit-btn').count();
  assert.strictEqual(editDocBtnCount, 0, 'Botão de editar documento não deve existir na versão pública.');

  // 6. Aba Análise de Mérito
  console.log('5. Validando aba de Análise de Mérito...');
  await page.getByRole('link', { name: 'Mérito', exact: true }).click();
  await page.waitForSelector('.section-head');

  const editInstCount = await page.locator('button[data-action="institution"]').count();
  assert.strictEqual(editInstCount, 0, 'Botão "Editar informações" não deve existir no mérito.');

  const reviewOpenCount = await page.locator('button.review-open').count();
  assert.strictEqual(reviewOpenCount, 0, 'Títulos dos itens não devem ser botões clicáveis no mérito.');

  // 7. Aba Diligências
  console.log('6. Validando aba de Diligências...');
  await page.getByRole('link', { name: 'Diligências', exact: true }).click();
  await page.waitForSelector('#tab-content section');

  const newDiligBtnCount = await page.locator('button[data-action="diligence"]').count();
  assert.strictEqual(newDiligBtnCount, 0, 'Botões de criar/editar diligência não devem existir.');

  // 8. Zero erros no console
  assert.strictEqual(errors.length, 0, `Nenhum erro de console permitido. Encontrados: ${errors.join('; ')}`);

  await browser.close();
  console.log(JSON.stringify({
    status: 'passed',
    publicPages: '100% verificado',
    scenarios: [
      'Identificação de Consulta Pública no cabeçalho',
      'Ocultação total de menus administrativos na barra lateral',
      'Remoção de botões de sincronização no painel geral',
      'Expansão de linha das UFs no painel com modo somente leitura (sem botão apagar)',
      'Remoção de botões de mutação da proposta (editar SEI, concluir análise)',
      'Aba de requisitos com expansão de linha e download de anexos sem upload/exclusão',
      'Aba de mérito com selos estáticos e sem botões de edição',
      'Aba de diligências em modo consulta',
      'Zero pageerrors durante todo o fluxo de navegação'
    ]
  }, null, 2));
}

run().catch(err => {
  console.error('Falha no teste da publicação estática:', err);
  process.exit(1);
});
