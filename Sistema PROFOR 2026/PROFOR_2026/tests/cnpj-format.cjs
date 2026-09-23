'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const playwrightPath = process.env.PROFOR_PLAYWRIGHT_PATH ||
  (fs.existsSync('C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright')
    ? 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright'
    : 'C:/Users/marcelo.cortez/AppData/Local/Programs/nodejs/node-v24.15.0-win-x64/node_modules/playwright');
const { chromium } = require(playwrightPath);
const D = require('../domain.js');

const ORIGIN = 'http://127.0.0.1:8766';
const URL = `${ORIGIN}/PROFOR_2026.html`;

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    const state = D.initialState();
    const p = D.createProposal({
      id: '990999',
      numero: '990999/2026',
      uf: 'PE',
      proponente: 'Governo do Estado de Pernambuco',
      orgao: 'Secretaria de Administração Penitenciária',
      cnpj: '07954530000118', // 14 digits unformatted, like in user screenshot
      programa: D.PROGRAM,
      objeto: 'Teste CNPJ',
      situacao: 'Proposta/Plano de Trabalho Enviado para Análise',
      data: '2026-09-01',
      repasse: 10000,
      contrapartida: 100,
      global: 10100,
      pad: [{ id: '1', descricao: 'item', quantidade: '1', unitario: 10100, total: 10100 }]
    });
    state.proposals.push(p);

    await context.route('**/*', async route => {
      const u = new globalThis.URL(route.request().url());
      if (u.origin === ORIGIN && u.pathname === '/api/state') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ exists: true, state, token: '1' }) });
      }
      return route.continue();
    });

    await page.goto(`${URL}#proposta/990999/dados`, { waitUntil: 'domcontentloaded' });
    await page.locator('#tab-content h2').filter({ hasText: 'Dados da proposta' }).waitFor();

    // Check CNPJ display in card
    const cnpjCard = page.locator('.data-card-block').filter({ has: page.locator('dt', { hasText: 'CNPJ' }) });
    await cnpjCard.waitFor();
    const cnpjText = await cnpjCard.locator('dd').innerText();
    assert.ok(cnpjText.includes('07.954.530/0001-18'), `CNPJ deve estar formatado, obteve: ${cnpjText}`);

    // Check copy button
    const copyBtn = cnpjCard.locator('button.copy-cnpj');
    assert.equal(await copyBtn.count(), 1, 'Deve existir botão de cópia do CNPJ');
    assert.equal(await copyBtn.getAttribute('data-cnpj'), '07.954.530/0001-18');
    assert.equal(await copyBtn.getAttribute('title'), 'Copiar CNPJ');

    await copyBtn.click();
    const notice = page.locator('#notice');
    await notice.waitFor({ state: 'visible' });
    const noticeText = await notice.innerText();
    assert.ok(noticeText.includes('CNPJ 07.954.530/0001-18 copiado'), `Toast deve confirmar cópia: ${noticeText}`);

    // Also check summary in main panel
    await page.goto(`${URL}#painel`, { waitUntil: 'domcontentloaded' });
    const rowPE = page.locator('tr[data-uf="PE"]');
    await rowPE.click();
    const summaryRow = page.locator('.uf-summary');
    await summaryRow.waitFor({ state: 'visible' });
    const summaryCnpj = summaryRow.locator('dt:has-text("CNPJ") + dd');
    const summaryCnpjText = await summaryCnpj.innerText();
    assert.ok(summaryCnpjText.includes('07.954.530/0001-18'), `Resumo deve formatar CNPJ: ${summaryCnpjText}`);
    assert.equal(await summaryCnpj.locator('button.copy-cnpj').count(), 1, 'Resumo deve ter botão de cópia');

    assert.equal(pageErrors.length, 0, `Nenhum erro na página: ${pageErrors.join(', ')}`);
    console.log(JSON.stringify({ status: 'passed', cnpjFormatted: '07.954.530/0001-18', copyNotice: noticeText }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
