/**
 * Testes automatizados da seleção de tópicos e exportação XLSX no Relatório de Análise (PROFOR 2026).
 * Valida as APIs ProforReport.html, ProforReport.xlsx e a interação na interface com Playwright.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');

const playwrightPath = process.env.PROFOR_PLAYWRIGHT_PATH ||
  (fs.existsSync('C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright')
    ? 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright'
    : 'C:/Users/marcelo.cortez/AppData/Local/Programs/nodejs/node-v24.15.0-win-x64/node_modules/playwright');
const { chromium } = require(playwrightPath);

const ROOT_DIR = path.resolve(__dirname, '..');
global.globalThis = global;
global.window = global;

const D = require(path.join(ROOT_DIR, 'domain.js'));
global.Profor = D;
const ProforReport = require(path.join(ROOT_DIR, 'report.js'));

test('ProforReport: filtragem de tópicos e renumeração sequencial HTML', async () => {
  const storePath = path.join(ROOT_DIR, 'dados', 'registros');
  const store = require(path.join(ROOT_DIR, 'workspace-store.cjs')).createStore(storePath);
  const state = store.load().state;
  const p = state.proposals.find(item => item.imported.uf === 'RS');
  assert.ok(p, 'Proposta do RS encontrada');

  const available = ProforReport.availableTopics(p);
  assert.ok(available.length >= 7, 'Pelo menos 7 tópicos disponíveis');
  assert.ok(available.some(t => t.id === 'pad'), 'Tópico PAD disponível');
  assert.ok(available.some(t => t.id === 'identificacao'), 'Tópico Identificação disponível');

  // Caso 1: Sem opções (padrão)
  const fullHtml = ProforReport.html(p);
  assert.match(fullHtml, /1\.\s+Identificação da proposta/);
  assert.match(fullHtml, /2\.\s+Valores/);
  assert.match(fullHtml, /Plano de aplicação detalhado/);
  assert.doesNotMatch(fullHtml, /Relatório de análise da proposta/);
  assert.doesNotMatch(fullHtml, /Documento auxiliar gerado a partir dos dados/);

  // Caso 2: Apenas PAD
  const padOnlyHtml = ProforReport.html(p, { topics: ['pad'] });
  assert.match(padOnlyHtml, /1\.\s+Plano de aplicação detalhado/);
  assert.doesNotMatch(padOnlyHtml, /Identificação da proposta/);
  assert.doesNotMatch(padOnlyHtml, /Valores<\/h2>/);
  assert.doesNotMatch(padOnlyHtml, /Avaliação de mérito<\/h2>/);

  // Caso 3: Seleção arbitrária (Valores e Situação final)
  const customHtml = ProforReport.html(p, { topics: ['valores', 'situacao'] });
  assert.match(customHtml, /1\.\s+Valores/);
  assert.match(customHtml, /2\.\s+Situação final da análise/);
  assert.doesNotMatch(customHtml, /Identificação da proposta/);
  assert.doesNotMatch(customHtml, /Plano de aplicação detalhado/);

  // Caso 4: Nenhum tópico selecionado
  const emptyHtml = ProforReport.html(p, { topics: [] });
  assert.match(emptyHtml, /Nenhum tópico selecionado para o relatório/);
  assert.doesNotMatch(emptyHtml, /<section class="pr-section">/);
});

test('ProforReport: exportação XLSX estruturada como banco de dados para IAs', async () => {
  const storePath = path.join(ROOT_DIR, 'dados', 'registros');
  const store = require(path.join(ROOT_DIR, 'workspace-store.cjs')).createStore(storePath);
  const state = store.load().state;
  const p = state.proposals.find(item => item.imported.uf === 'RS');
  assert.ok(p, 'Proposta do RS encontrada');

  // Caso 1: XLSX completo com todos os tópicos
  const fullBytes = ProforReport.xlsx(p);
  assert.ok(fullBytes instanceof Uint8Array, 'Deve retornar um Uint8Array');
  assert.ok(fullBytes.length > 3000, 'Arquivo gerado deve conter bytes válidos de ZIP/XLSX');

  const tmpFull = path.join(__dirname, 'tmp_full.xlsx');
  fs.writeFileSync(tmpFull, Buffer.from(fullBytes));

  // Validação estrita via Python openpyxl (o mesmo motor usado por Pandas/IAs)
  const pyCheckFull = `
import openpyxl
wb = openpyxl.load_workbook(r'${tmpFull}')
assert 'Base_Dados' in wb.sheetnames, 'Aba Base_Dados obrigatória'
assert 'PAD' in wb.sheetnames, 'Aba PAD especializada presente'
ws = wb['Base_Dados']
rows = list(ws.iter_rows(values_only=True))
assert len(rows) > 10, 'Base_Dados deve conter dezenas de linhas'
headers = rows[0]
assert 'proposta' in headers and 'uf' in headers and 'topico_nome' in headers, 'Cabeçalhos relacionais presentes'
ws_pad = wb['PAD']
pad_rows = list(ws_pad.iter_rows(values_only=True))
assert len(pad_rows) > 1, 'Aba PAD deve conter itens'
assert isinstance(pad_rows[1][2], (int, float)), 'Quantidade deve ser numérica'
assert isinstance(pad_rows[1][3], (int, float)), 'Valor unitário deve ser numérico'
print('FULL_OK')
`;
  const fullOut = execSync('python', { input: pyCheckFull, encoding: 'utf-8' });
  assert.match(fullOut, /FULL_OK/);
  fs.unlinkSync(tmpFull);

  // Caso 2: XLSX com "Apenas PAD"
  const padBytes = ProforReport.xlsx(p, { topics: ['pad'] });
  const tmpPad = path.join(__dirname, 'tmp_pad.xlsx');
  fs.writeFileSync(tmpPad, Buffer.from(padBytes));

  const pyCheckPad = `
import openpyxl
wb = openpyxl.load_workbook(r'${tmpPad}')
assert 'Base_Dados' in wb.sheetnames
assert 'PAD' in wb.sheetnames
assert 'Merito' not in wb.sheetnames, 'Mérito não deve estar presente'
assert 'Requisitos' not in wb.sheetnames, 'Requisitos não deve estar presente'
ws = wb['Base_Dados']
for r in list(ws.iter_rows(values_only=True))[1:]:
    assert r[3] == 'pad', f'Todos os tópicos em Base_Dados devem ser pad, veio: {r[3]}'
print('PAD_ONLY_OK')
`;
  const padOut = execSync('python', { input: pyCheckPad, encoding: 'utf-8' });
  assert.match(padOut, /PAD_ONLY_OK/);
  fs.unlinkSync(tmpPad);
});

test('UI: Modal de relatório com botão Salvar XLSX, atalhos e download', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const fileUrl = 'file:///' + path.join(__dirname, '..', '..', '..', 'docs', 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });

  // Abre detalhes da proposta RS
  await page.waitForSelector('tr.uf-row');
  const firstRow = page.locator('tr.uf-row').first();
  await firstRow.click();
  await page.waitForSelector('.btn-detail');
  await page.locator('.btn-detail').first().click();

  // Aguarda tela da proposta carregar e clica em "Gerar relatório"
  await page.waitForSelector('button[data-action="report"]');
  await page.click('button[data-action="report"]');

  // Valida que o modal abriu com a barra de filtros
  await page.waitForSelector('.report-filter-bar');
  const checkboxes = page.locator('#report-topics-list input[type="checkbox"]');
  const totalCheckboxes = await checkboxes.count();
  assert.ok(totalCheckboxes >= 7, 'Existem checkboxes de tópicos suficientes');

  // Botão "Salvar XLSX" presente e habilitado
  const xlsxBtn = page.locator('button[data-action="save-xlsx"]');
  assert.ok(await xlsxBtn.isVisible(), 'Botão Salvar XLSX deve estar visível');
  assert.equal(await xlsxBtn.isDisabled(), false, 'Botão Salvar XLSX deve estar habilitado inicialmente');

  // Testa download do XLSX
  const downloadPromise = page.waitForEvent('download');
  await xlsxBtn.click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /PROFOR_RELATORIO_.*\.xlsx$/);

  // Testa atalho "Apenas PAD"
  await page.click('[data-action="report-select-pad"]');
  const padChecked = await page.locator('#report-topics-list input[value="pad"]').isChecked();
  assert.equal(padChecked, true, 'PAD deve continuar marcado');
  assert.equal(await xlsxBtn.isDisabled(), false, 'Salvar XLSX deve permanecer habilitado');

  // Testa atalho "Nenhum"
  await page.click('[data-action="report-select-none"]');
  assert.equal(await xlsxBtn.isDisabled(), true, 'Botão Salvar XLSX deve desabilitar sem seleção');

  // Marca individualmente "Valores"
  await page.locator('#report-topics-list input[value="valores"]').check();
  assert.equal(await xlsxBtn.isDisabled(), false, 'Botão Salvar XLSX deve reabilitar com 1 tópico');

  // Testa atalho "Todos"
  await page.click('[data-action="report-select-all"]');
  assert.equal(await xlsxBtn.isDisabled(), false);

  await browser.close();
});

test('UI Servidor Local: Botão Salvar XLSX funciona em http://127.0.0.1:8766/', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  try {
    const res = await page.goto('http://127.0.0.1:8766/', { waitUntil: 'domcontentloaded', timeout: 5000 });
    if (!res || !res.ok()) {
      console.log('Servidor local não respondeu com 200, pulando subteste de servidor.');
      await browser.close();
      return;
    }
  } catch (err) {
    console.log('Servidor local não acessível na porta 8766, pulando subteste de servidor:', err.message);
    await browser.close();
    return;
  }

  await page.waitForSelector('tr.uf-row');
  await page.locator('tr.uf-row').first().click();
  await page.waitForSelector('.btn-detail');
  await page.locator('.btn-detail').first().click();

  await page.waitForSelector('button[data-action="report"]');
  await page.click('button[data-action="report"]');

  await page.waitForSelector('.report-filter-bar');
  const xlsxBtn = page.locator('button[data-action="save-xlsx"]');
  assert.ok(await xlsxBtn.isVisible(), 'Botão Salvar XLSX deve estar visível no servidor local');

  // Testa download do XLSX no servidor local
  const downloadPromise = page.waitForEvent('download');
  await xlsxBtn.click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /\.xlsx$/);

  await browser.close();
});
