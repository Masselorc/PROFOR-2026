const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert');

const playwrightPath = process.env.PROFOR_PLAYWRIGHT_PATH ||
  (fs.existsSync('C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright')
    ? 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright'
    : 'C:/Users/marcelo.cortez/AppData/Local/Programs/nodejs/node-v24.15.0-win-x64/node_modules/playwright');
const { chromium } = require(playwrightPath);

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  // Teste com docs/index.html (consulta pública estática)
  const docsUrl = 'file:///' + path.resolve(__dirname, '../../../docs/index.html').replace(/\\/g, '/');
  console.log('1. Abrindo docs/index.html...');
  await page.goto(docsUrl);
  await page.waitForSelector('#uf-rows tr.uf-row', { timeout: 10000 });

  // 1. Proposta de MG (0% completo)
  console.log('2. Navegando para proposta de MG (0%)...');
  const rowMG = page.locator('#uf-rows tr.uf-row[data-uf="MG"]');
  await rowMG.locator('button.row-expand').click();
  const summaryMG = page.locator('tr#summary-MG');
  await summaryMG.waitFor({ state: 'visible' });
  await summaryMG.locator('a.btn-detail').first().click();
  await page.waitForSelector('.score-gauge-box');

  const markerMg = page.locator('.score-gauge-box .gauge-marker');
  const labelMg = markerMg.locator('.marker-label');
  const textMg = await labelMg.innerText();
  console.log('   MG marker text:', textMg);
  assert.strictEqual(textMg, '0% completo', 'Deveria exibir "0% completo"');
  
  const markerMgStyle = await markerMg.getAttribute('style');
  console.log('   MG marker style:', markerMgStyle);
  assert(markerMgStyle.includes('left: 0%') || markerMgStyle.includes('left:0%'), 'Marker deveria estar em left: 0%');

  const gaugeBoxMg = page.locator('.score-gauge-box');
  const artifactDir = 'C:/Users/marcelo.cortez/.gemini/antigravity/brain/5307e7b8-eab1-44af-b1f7-31284bcc5730';
  await gaugeBoxMg.screenshot({ path: path.join(artifactDir, 'gauge_marker_0pct.png') });
  console.log('   Screenshot gravado: gauge_marker_0pct.png');

  // 2. Proposta do RS (33% completo)
  console.log('3. Navegando para proposta do RS...');
  await page.locator('a.back').click();
  await page.waitForSelector('#uf-rows tr.uf-row');

  const rowRS = page.locator('#uf-rows tr.uf-row[data-uf="RS"]');
  await rowRS.locator('button.row-expand').click();
  const summaryRS = page.locator('tr#summary-RS');
  await summaryRS.waitFor({ state: 'visible' });
  await summaryRS.locator('a.btn-detail').first().click();
  await page.waitForSelector('.score-gauge-box');

  const markerRs = page.locator('.score-gauge-box .gauge-marker');
  const labelRs = markerRs.locator('.marker-label');
  const textRs = await labelRs.innerText();
  console.log('   RS marker text:', textRs);
  assert.match(textRs, /^\d+% completo$/, 'Deveria exibir "x% completo"');

  const markerRsStyle = await markerRs.getAttribute('style');
  console.log('   RS marker style:', markerRsStyle);

  const gaugeBoxRs = page.locator('.score-gauge-box');
  await gaugeBoxRs.screenshot({ path: path.join(artifactDir, 'gauge_marker_rs.png') });
  console.log('   Screenshot gravado: gauge_marker_rs.png');

  // 3. Simula visual de 100% completo com espera de transição CSS
  console.log('4. Verificando visual de 100%...');
  await page.evaluate(() => {
    const marker = document.querySelector('.gauge-marker');
    const fill = document.querySelector('#final-score-fill');
    const label = document.querySelector('.marker-label');
    const scoreVal = document.querySelector('#gauge-score-val');
    if (marker && fill && label && scoreVal) {
      marker.className = 'gauge-marker gauge-marker-100 marker-pass';
      marker.style.left = '100%';
      label.style.transform = 'translateX(-100%)';
      label.textContent = '100% completo';
      fill.className = 'gauge-fill gauge-fill-pass';
      fill.style.width = '100%';
      scoreVal.textContent = '30 / 30 requisitos (100%)';
    }
  });
  await page.waitForTimeout(400);
  await gaugeBoxRs.screenshot({ path: path.join(artifactDir, 'gauge_marker_100pct.png') });
  console.log('   Screenshot gravado: gauge_marker_100pct.png');

  assert.strictEqual(errors.length, 0, `Erros de página encontrados: ${errors.join('; ')}`);
  console.log('Sucesso! Todos os testes de marcador móvel passaram com 0 erros.');

  await browser.close();
})();
