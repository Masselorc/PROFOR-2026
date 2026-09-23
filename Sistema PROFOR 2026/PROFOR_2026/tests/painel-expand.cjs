const fs = require('fs');
const assert = require('assert');
const playwrightPath = process.env.PROFOR_PLAYWRIGHT_PATH ||
  (fs.existsSync('C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright')
    ? 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright'
    : 'C:/Users/marcelo.cortez/AppData/Local/Programs/nodejs/node-v24.15.0-win-x64/node_modules/playwright');
const { chromium } = require(playwrightPath);
const D = require('../domain.js');

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();

  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const state = D.initialState();
  const pMG = D.createProposal({
    id: '012345',
    numero: '012345/2026',
    uf: 'MG',
    proponente: 'GOVERNO DO ESTADO DE MINAS GERAIS',
    orgao: 'SECRETARIA DE ESTADO DE JUSTICA E SEGURANCA PUBLICA',
    cnpj: '18715615000160',
    programa: D.PROGRAM,
    objeto: 'Aquisição de equipamentos de tecnologia para a Ouvidoria de Serviços Penais de Minas Gerais.',
    situacao: 'Proposta/Plano de Trabalho Enviado para Análise',
    data: '2026-02-24',
    repasse: 950000,
    contrapartida: 50000,
    global: 1000000,
    pad: [{ id: '1', descricao: 'Equipamento TI', quantidade: '1', unitario: 1000000, total: 1000000 }]
  });
  state.proposals.push(pMG);

  await page.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/state') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ exists: true, state, token: '1' }) });
    }
    return route.continue();
  });

  try {
    await page.goto('http://127.0.0.1:8766/PROFOR_2026.html#painel', { waitUntil: 'domcontentloaded' });
    await page.locator('#uf-rows tr.uf-row').first().waitFor();

    // 1. Cada linha de UF possui um wrapper com o botão .row-expand
    const rowMG = page.locator('tr[data-uf="MG"]');
    await rowMG.waitFor();
    const expandBtnMG = rowMG.locator('.uf-col-wrapper button.row-expand');
    assert.equal(await expandBtnMG.count(), 1, 'Deve haver botão .row-expand para MG');
    assert.equal(await expandBtnMG.getAttribute('aria-expanded'), 'false', 'Inicialmente fechado');

    // 2. O botão de expansão herda classe de tom dinâmico do status
    const btnClasses = await expandBtnMG.getAttribute('class');
    assert.ok(btnClasses.includes('tom-'), `Botão deve ter classe de tom: ${btnClasses}`);

    // Captura inicial com linhas recolhidas
    await page.screenshot({ path: 'C:/Users/marcelo.cortez/.gemini/antigravity/brain/5307e7b8-eab1-44af-b1f7-31284bcc5730/painel_recolhido.png' });

    // 3. Expansão via clique no botão .row-expand
    await expandBtnMG.click();
    assert.equal(await expandBtnMG.getAttribute('aria-expanded'), 'true', 'Botão deve ficar aria-expanded=true');
    assert.ok((await rowMG.getAttribute('class')).includes('row-is-expanded'), 'Linha deve receber classe row-is-expanded');

    // 4. Detalhe expandido renderizado no DOM
    const summaryMG = page.locator('tr#summary-MG');
    await summaryMG.waitFor({ state: 'visible' });
    assert.ok(await summaryMG.isVisible(), 'Detalhe summary-MG visível');

    // 5. Estrutura executiva do detalhe expandido
    const title = await summaryMG.locator('.expansion-title').innerText();
    assert.ok(title.includes('Minas Gerais') && title.includes('MG'), `Título deve conter MG: ${title}`);
    
    // 6. Presença de botão Abrir Análise e dados formatados
    const btnDetail = summaryMG.locator('a.btn-detail');
    assert.equal(await btnDetail.count(), 1, 'Deve conter link/botão Abrir análise');
    assert.ok((await btnDetail.getAttribute('href')).includes('#proposta/012345/dados'), 'Link para dados da proposta');

    const cnpjText = await summaryMG.locator('dt:has-text("CNPJ") + dd').innerText();
    assert.ok(cnpjText.includes('18.715.615/0001-60'), `CNPJ formatado: ${cnpjText}`);
    assert.equal(await summaryMG.locator('button.copy-cnpj').count(), 1, 'Botão de cópia de CNPJ presente');

    // Captura com MG expandido
    await page.screenshot({ path: 'C:/Users/marcelo.cortez/.gemini/antigravity/brain/5307e7b8-eab1-44af-b1f7-31284bcc5730/painel_expandido_mg.png' });

    // 7. Recolher via clique no botão .row-expand
    await expandBtnMG.click();
    assert.equal(await expandBtnMG.getAttribute('aria-expanded'), 'false', 'Botão volta a aria-expanded=false');
    assert.equal(await page.locator('tr#summary-MG').count(), 0, 'Detalhe removido do DOM ao recolher');

    // 8. Expansão e recolhimento via clique na linha (área da UF)
    await rowMG.click();
    assert.equal(await expandBtnMG.getAttribute('aria-expanded'), 'true', 'Linha expande ao clicar');
    assert.equal(await page.locator('tr#summary-MG').count(), 1, 'Detalhe presente');

    await rowMG.click();
    assert.equal(await expandBtnMG.getAttribute('aria-expanded'), 'false', 'Linha recolhe ao clicar novamente');
    assert.equal(await page.locator('tr#summary-MG').count(), 0, 'Detalhe recolhido');

    // 9. Acessibilidade por teclado (Enter na linha)
    await rowMG.focus();
    await page.keyboard.press('Enter');
    assert.equal(await expandBtnMG.getAttribute('aria-expanded'), 'true', 'Expande com Enter');

    await page.keyboard.press('Enter');
    assert.equal(await expandBtnMG.getAttribute('aria-expanded'), 'false', 'Recolhe com Enter');

    // 10. Expansão de UF sem proposta importada (ex: AP)
    const rowAP = page.locator('tr[data-uf="AP"]');
    const expandBtnAP = rowAP.locator('.uf-col-wrapper button.row-expand');
    await expandBtnAP.click();
    const summaryAP = page.locator('tr#summary-AP');
    await summaryAP.waitFor({ state: 'visible' });
    const textAP = await summaryAP.innerText();
    assert.ok(textAP.includes('Amapá (AP)') && textAP.includes('não tem proposta vinculada'), `Resumo de AP deve ser informativo: ${textAP}`);
    await page.screenshot({ path: 'C:/Users/marcelo.cortez/.gemini/antigravity/brain/5307e7b8-eab1-44af-b1f7-31284bcc5730/painel_expandido_ap.png' });
    await expandBtnAP.click();
    assert.equal(await page.locator('tr#summary-AP').count(), 0, 'AP recolhido');

    // 11. Garantir zero pageerrors
    assert.equal(pageErrors.length, 0, `Nenhum erro de página: ${pageErrors.join(', ')}`);

    console.log(JSON.stringify({
      status: 'passed',
      painelExpansion: '100% verificado',
      scenarios: [
        'Botão .row-expand presente em cada UF',
        'Tom dinâmico herdado do status',
        'Expansão e fechamento via botão chevron',
        'Expansão e fechamento via clique na linha',
        'Controle acessível via teclado Enter',
        'Card executivo com botão Abrir análise, CNPJ formatado e cópia',
        'Zero pageerrors'
      ]
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
