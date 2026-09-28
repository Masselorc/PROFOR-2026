/**
 * Testes automatizados da seleção de tópicos no Relatório de Análise (PROFOR 2026).
 * Valida a API ProforReport.html(p, options) e a interação na interface com Playwright.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

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

test('ProforReport: filtragem de tópicos e renumeração sequencial', async () => {
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

test('UI: Modal de relatório com caixas de seleção e atalhos em tempo real', async () => {
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

  // Todos começam marcados
  for (let i = 0; i < totalCheckboxes; i++) {
    const isChecked = await checkboxes.nth(i).isChecked();
    assert.equal(isChecked, true, `Checkbox ${i} deve iniciar marcado`);
  }
  const initialPreviewText = await page.locator('#report-preview').innerText();
  assert.match(initialPreviewText, /1\.\s+Identificação da proposta/);

  // Testa atalho "Apenas PAD"
  await page.click('[data-action="report-select-pad"]');
  const padChecked = await page.locator('#report-topics-list input[value="pad"]').isChecked();
  assert.equal(padChecked, true, 'PAD deve continuar marcado');
  const idChecked = await page.locator('#report-topics-list input[value="identificacao"]').isChecked();
  assert.equal(idChecked, false, 'Identificação deve estar desmarcada');

  // Verifica que o preview atualizou em tempo real para ter o PAD como 1.
  const padOnlyPreview = await page.locator('#report-preview').innerText();
  assert.match(padOnlyPreview, /1\.\s+Plano de aplicação detalhado/);
  assert.doesNotMatch(padOnlyPreview, /Identificação da proposta/);

  // Testa atalho "Nenhum"
  await page.click('[data-action="report-select-none"]');
  const emptyPreview = await page.locator('#report-preview').innerText();
  assert.match(emptyPreview, /Nenhum tópico selecionado/);

  // Botões de ação desabilitados quando nada está selecionado
  const copyBtnDisabled = await page.locator('button[data-action="copy-html"]').isDisabled();
  assert.equal(copyBtnDisabled, true, 'Botão Copiar deve estar desabilitado sem seleção');

  // Marca individualmente "Valores"
  await page.locator('#report-topics-list input[value="valores"]').check();
  const valuesBtnDisabled = await page.locator('button[data-action="copy-html"]').isDisabled();
  assert.equal(valuesBtnDisabled, false, 'Botão Copiar deve reabilitar com 1 tópico');
  const valuesPreview = await page.locator('#report-preview').innerText();
  assert.match(valuesPreview, /1\.\s+Valores/);
  assert.doesNotMatch(valuesPreview, /Plano de aplicação detalhado/);

  // Testa atalho "Todos"
  await page.click('[data-action="report-select-all"]');
  const allPreview = await page.locator('#report-preview').innerText();
  assert.match(allPreview, /1\.\s+Identificação da proposta/);
  assert.match(allPreview, /Valores/);
  assert.match(allPreview, /Plano de aplicação detalhado/);

  await browser.close();
});

test('UI Servidor Local: Seleção de tópicos funciona em http://127.0.0.1:8766/', async () => {
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
  await page.click('[data-action="report-select-pad"]');
  const padOnlyPreview = await page.locator('#report-preview').innerText();
  assert.match(padOnlyPreview, /1\.\s+Plano de aplicação detalhado/);
  assert.doesNotMatch(padOnlyPreview, /Identificação da proposta/);

  await browser.close();
});
