'use strict';

/*
 * Teste de integração ISOLADO para expansão de linha e gestão de anexos:
 * Requisitos da Proposta e Requisitos para Formalização.
 *   node "tests/anexos-requisitos.cjs"
 */
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const playwrightPath = process.env.PROFOR_PLAYWRIGHT_PATH ||
  (fs.existsSync('C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright')
    ? 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright'
    : 'C:/Users/marcelo.cortez/AppData/Local/Programs/nodejs/node-v24.15.0-win-x64/node_modules/playwright');
const { chromium } = require(playwrightPath);
const D = require('../domain.js');

const ORIGIN = 'http://127.0.0.1:8766';
const URL = `${ORIGIN}/PROFOR_2026.html`;
const PROPOSAL_ID = '990888';

const STATIC_PATHS = new Set([
  '/PROFOR_2026.html', '/styles.css', '/domain.js', '/bandeiras-uf.js',
  '/storage.js', '/transferegov.js', '/report.js', '/app.js', '/favicon.ico'
]);

const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pageErrors = [];

function fixture() {
  const state = D.initialState();
  state.revision = 1;
  const proposal = D.createProposal({
    id: PROPOSAL_ID, numero: '990888/2026', uf: 'PE', programa: D.PROGRAM,
    proponente: 'Secretaria de Administração Penitenciária de PE', cnpj: '00.000.000/0001-00', orgao: 'SEAP/PE',
    objeto: 'Estruturação da Ouvidoria de Serviços Penais de PE',
    situacao: 'Proposta/Plano de Trabalho Enviado para Análise',
    data: '2026-09-01', repasse: 50000000, contrapartida: 500000, global: 50500000,
    vigenciaInicio: '2026-11-23', vigenciaFim: '2028-05-19',
    pad: [{ id: '1', descricao: 'Equipamentos', quantidade: '10', unitario: 5050000, total: 50500000 }]
  });
  state.proposals.push(proposal);
  D.validateState(state);
  return state;
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({
      serviceWorkers: 'block', acceptDownloads: true,
      locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport: { width: 1440, height: 1000 }
    });
    let memory = clone(fixture());
    let token = hash(memory);
    const posts = [];

    await context.route('**/*', async route => {
      const request = route.request();
      const url = new globalThis.URL(request.url());
      if (url.origin === ORIGIN && url.pathname === '/api/state') {
        if (request.method() === 'GET') {
          return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ exists: true, state: clone(memory), token, recovery: null }) });
        }
        const body = request.postDataJSON();
        posts.push(clone(body));
        D.validateState(body.state);
        const next = clone(body.state);
        next.revision = memory.revision + 1;
        memory = next;
        token = hash({ parent: token, state: memory });
        return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ exists: true, state: clone(memory), token }) });
      }
      if (url.origin === ORIGIN && ['GET', 'HEAD'].includes(request.method()) && STATIC_PATHS.has(url.pathname)) return route.continue();
      return route.abort('blockedbyclient');
    });

    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('dialog', dialog => dialog.accept());

    // 1. Abrir na aba "Requisitos da Proposta"
    await page.goto(`${URL}#proposta/${PROPOSAL_ID}/proposta`, { waitUntil: 'domcontentloaded' });
    await page.locator('#tab-content h2').filter({ hasText: 'Requisitos da Proposta' }).first().waitFor({ state: 'visible' });

    // 2. Linhas iniciais da tabela devem ser exatamente 7 e SEM coluna Documento
    let rows = await page.locator('.req-table tbody tr').count();
    assert.equal(rows, 7, `Aba Requisitos da Proposta deve ter 7 linhas iniciais, obteve ${rows}`);
    const headers = await page.locator('.req-table thead th').allInnerTexts();
    assert.ok(!headers.some(h => /documento/i.test(h)), 'Não deve haver coluna de Documento no cabeçalho da tabela');
    assert.deepEqual(headers.map(h => h.trim().toUpperCase()), ['ITEM', 'REQUISITO', 'FUNDAMENTAÇÃO', 'COMPROVAÇÃO', 'RESULTADO', 'AÇÃO']);

    // 3. Expandir o item 4 (Termo de Referência)
    const rowItem4 = page.locator('tr[data-req-row][data-id="4"]');
    assert.equal(await rowItem4.count(), 1, 'Linha do item 4 deve existir');
    const expandBtn = rowItem4.locator('.row-expand');
    assert.ok((await expandBtn.getAttribute('class')).includes('tom-neutro'), 'Setinha deve ter o tom da análise atual (tom-neutro)');
    await expandBtn.click();

    // 4. Detalhe expandido aparece no DOM
    const detailRow = page.locator('tr.row-summary-detail#detail-proposta-4');
    await detailRow.waitFor({ state: 'visible' });
    assert.equal(await rowItem4.getAttribute('aria-expanded'), 'true');
    const attSection = detailRow.locator('.attachment-section');
    assert.ok(await attSection.isVisible(), 'Área de anexos deve aparecer quando a linha for expandida');

    // 5. Exibe aviso de nenhum anexo inicialmente
    const emptyNotice = detailRow.locator('.attachment-empty');
    assert.ok(await emptyNotice.isVisible(), 'Deve exibir aviso de nenhum anexo inicialmente');

    // 6. Simular anexo de arquivo PDF
    const fileInput = detailRow.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'termo_referencia_pe.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 ... dados ficticios de teste ...')
    });

    // 7. Campo de pré-visualização fica visível e preenche descrição
    const previewBox = detailRow.locator('.file-selected-info');
    await previewBox.waitFor({ state: 'visible' });
    await detailRow.locator('input.att-note-input').fill('TR aprovado pelo Secretário (SEI 33381502)');

    // 8. Clicar em "Anexar ao requisito"
    const uploadBtn = detailRow.locator('button.primary').filter({ hasText: 'Anexar ao requisito' });
    assert.equal(await uploadBtn.isEnabled(), true, 'Botão anexar deve estar habilitado após seleção de arquivo');
    await uploadBtn.click();

    // 9. Espera confirmação e renderização do card
    const attCard = detailRow.locator('.attachment-card');
    await attCard.waitFor({ state: 'visible' });
    const attName = await attCard.locator('.attachment-name').innerText();
    assert.equal(attName, 'termo_referencia_pe.pdf');
    const attNote = await attCard.locator('.attachment-note').innerText();
    assert.equal(attNote, 'TR aprovado pelo Secretário (SEI 33381502)');

    // 10. Pill de anexo na linha-mãe
    const pill = rowItem4.locator('.attachment-pill');
    assert.ok(await pill.isVisible(), 'Pill 📎 1 deve estar visível na linha');
    assert.match(await pill.innerText(), /📎\s*1/);

    // 11. Validação de persistência na memória
    const storedAttachments = memory.proposals[0].reviews.celebracao['4'].attachments;
    assert.equal(storedAttachments.length, 1);
    assert.equal(storedAttachments[0].name, 'termo_referencia_pe.pdf');
    assert.ok(storedAttachments[0].data.startsWith('data:application/pdf;base64,'));

    // 12. Testar download nativo
    const downloadLink = attCard.locator('a.att-download');
    assert.ok((await downloadLink.getAttribute('href')).startsWith('data:application/pdf;base64,'));
    assert.equal(await downloadLink.getAttribute('download'), 'termo_referencia_pe.pdf');

    // 13. Excluir anexo
    const delBtn = attCard.locator('button.att-delete');
    await delBtn.click();
    await emptyNotice.waitFor({ state: 'visible' });
    assert.equal(memory.proposals[0].reviews.celebracao['4'].attachments.length, 0, 'Anexo deve ter sido removido do estado');
    assert.equal(await rowItem4.locator('.attachment-pill').count(), 0, 'Pill deve ser removida quando não há anexos');

    // 14. Fechar linha expandida
    await expandBtn.click();
    assert.equal(await detailRow.count(), 0, 'Linha de detalhe deve ser removida ao fechar');
    rows = await page.locator('.req-table tbody tr').count();
    assert.equal(rows, 7, `Após recolhimento, devem restar exatamente 7 linhas`);

    // 15. Navegar para "Requisitos para Formalização"
    await page.getByRole('link', { name: 'Requisitos para Formalização', exact: true }).click();
    await page.locator('#tab-content h2').filter({ hasText: 'Requisitos para Formalização' }).first().waitFor({ state: 'visible' });
    const formRows = await page.locator('.req-table tbody tr').count();
    assert.equal(formRows, 13, `Aba Requisitos para Formalização deve ter exatamente 13 linhas`);

    // 16. Testar expansão do item 1.1 e alteração de tom da setinha
    const row11 = page.locator('tr[data-req-row][data-id="1.1"]');
    const expand11 = row11.locator('.row-expand');
    assert.ok((await expand11.getAttribute('class')).includes('tom-neutro'), 'Setinha 1.1 inicialmente tom-neutro');
    await expand11.click();
    const detail11 = page.locator('tr.row-summary-detail#detail-formalizacao-1-1');
    await detail11.waitFor({ state: 'visible' });
    assert.ok(await detail11.locator('.attachment-section').isVisible(), 'Área de anexos visível na linha expandida de formalização');

    // 17. Ao alterar a análise para Atende, a setinha passa a ter tom-ok
    const statusPill11 = row11.locator('[data-status-toggle]');
    await statusPill11.click();
    await row11.locator('.status-popover button[data-status-value="ok"]').click();
    const updatedExpand11 = page.locator('tr[data-req-row][data-id="1.1"] .row-expand.tom-ok');
    await updatedExpand11.waitFor({ state: 'visible' });
    assert.ok((await updatedExpand11.getAttribute('class')).includes('tom-ok'), 'Setinha deve mudar para tom-ok ao selecionar Atende');

    // 18. Não deve haver erros no console da página
    assert.equal(pageErrors.length, 0, `Erros na página detectados: ${pageErrors.join(' | ')}`);

    console.log(JSON.stringify({
      status: 'passed',
      isolated: true,
      scenarios: [
        'Sem coluna Documento nas tabelas principais; documento visível apenas no detalhe expandido',
        'Setinha da expansão com a mesma cor do status da análise (dinâmico: neutro -> ok)',
        'Contagem exata inicial de linhas preservada nas duas abas (7 e 13)',
        'Expansão e fechamento dinâmico sem poluir o DOM quando fechado',
        'Upload de arquivo, geração de base64, gravação de metadados e pill de anexo',
        'Download nativo via data:URI com nome original',
        'Exclusão de anexo e atualização reativa de contadores',
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
