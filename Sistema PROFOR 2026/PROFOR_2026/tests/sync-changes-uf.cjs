'use strict';

/*
 * Teste de integração ISOLADO da tabela de alterações do diálogo de sincronização.
 *   node "Sistema PROFOR 2026/PROFOR_2026/tests/sync-changes-uf.cjs"
 *
 * Verifica que cada alteração identifica a proposta pela UF, ao lado do número.
 * Não inicia servidor, não usa perfil persistente, não lê/grava dados/registros.
 * /api/state e /api/sync são atendidos em memória; nenhuma extração real é baixada
 * e nenhum byte do banco real é escrito.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const playwrightPath = process.env.PROFOR_PLAYWRIGHT_PATH ||
  (fs.existsSync('C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright')
    ? 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright'
    : 'C:/Users/marcelo.cortez/AppData/Local/Programs/nodejs/node-v24.15.0-win-x64/node_modules/playwright');
const { chromium } = require(playwrightPath);
const D = require('../domain.js');

const ORIGIN = 'http://127.0.0.1:8766';
const URL = `${ORIGIN}/PROFOR_2026.html`;
const STATIC_PATHS = new Set([
  '/PROFOR_2026.html', '/styles.css', '/domain.js', '/bandeiras-uf.js',
  '/storage.js', '/transferegov.js', '/report.js', '/app.js', '/favicon.ico'
]);
const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pageErrors = [];

const imported = (id, uf, numero, overrides = {}) => ({
  id, numero, uf, programa: D.PROGRAM, proponente: `FIXTURE ISOLADA ${uf} — NÃO É DADO REAL`,
  cnpj: '', orgao: '', objeto: 'Teste do diálogo de sincronização', situacao: 'Proposta/Plano de Trabalho Enviado para Análise',
  data: '2026-09-01', repasse: 10000, contrapartida: 100, global: 10100,
  pad: [{ id: '11', descricao: 'PAD 11 fictício', quantidade: '2', unitario: 5050, total: 10100 }], ...overrides
});

function seed() {
  const state = D.initialState();
  state.revision = 4;
  const ap = D.createProposal(imported('990001', 'AP', '990001/2026'));
  state.proposals.push(ap);
  D.validateState(state);
  return state;
}

/* O que o servidor local devolveria: a proposta AP com o PAD alterado e uma
   proposta PE nova — duas linhas de alteração, duas UFs diferentes. */
function successfulSyncPayload() {
  const changed = imported('990001', 'AP', '990001/2026');
  changed.pad[0].quantidade = '3';
  changed.pad[0].total = 15150;
  changed.objeto = 'Objeto atualizado na origem';
  const nova = imported('990002', 'PE', '990002/2026');
  return {
    unchanged: false,
    proposals: [changed, nova],
    source: { url: 'https://api-publica.transferegov.gestao.gov.br/downloads', files: [1, 2, 3, 4] },
    stats: { durationMs: 63000, padItems: 2 },
    warnings: ['PE: 6 propostas no programa. Conferência manual necessária.']
  };
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({
      serviceWorkers: 'block', acceptDownloads: false,
      locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport: { width: 1440, height: 1000 }
    });
    let memory = clone(seed());
    let token = hash(memory);
    const blocked = [];
    const posts = [];
    let syncCalls = 0;
    D.validateState(memory);

    await context.route('**/*', async route => {
      const request = route.request();
      const url = new globalThis.URL(request.url());
      const method = request.method();
      const json = body => route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });
      if (url.origin === ORIGIN && url.pathname === '/api/state') {
        if (method === 'GET') return json({ exists: true, state: clone(memory), token, recovery: null });
        if (method === 'POST') {
          const body = request.postDataJSON();
          posts.push(clone(body));
          assert.equal(body.expected, memory.revision, 'expected deve ser a revisão corrente');
          assert.equal(body.token, token, 'token deve ser o do último GET/POST');
          D.validateState(body.state);
          const next = clone(body.state);
          next.revision = memory.revision + 1;
          memory = next;
          token = hash({ parent: token, state: memory });
          return json({ exists: true, state: clone(memory), token });
        }
      }
      if (url.origin === ORIGIN && url.pathname === '/api/sync' && method === 'GET') {
        syncCalls++;
        return json(successfulSyncPayload());
      }
      if (url.origin === ORIGIN && ['GET', 'HEAD'].includes(method) && STATIC_PATHS.has(url.pathname)) return route.continue();
      blocked.push({ method, url: request.url() });
      return route.abort('blockedbyclient');
    });

    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.locator('nav.sidebar, aside').first().waitFor();

    await page.locator('[data-action="sync"]').first().click();
    await page.locator('#modal[open]').waitFor();
    await page.getByRole('heading', { name: 'Sincronização concluída' }).waitFor();

    const rows = await page.locator('#modal-content tbody tr').evaluateAll(trs => trs.map(tr => {
      const cells = [...tr.querySelectorAll('td')];
      const tag = tr.querySelector('.uf-tag');
      return {
        columns: cells.length,
        numero: (cells[0]?.querySelector('.proposal-number')?.textContent || tr.innerText).replace('⧉', '').trim(),
        campo: cells[2]?.textContent.trim(),
        tag: tag ? tag.textContent.trim() : '',
        titulo: tag ? tag.getAttribute('title') : ''
      };
    }));
    const headers = await page.locator('#modal-content thead th').allInnerTexts();

    // Duas alterações: PAD e objeto da proposta AP, mais a proposta PE nova.
    assert.deepEqual(headers, ['Proposta', 'UF', 'Campo', 'Antes', 'Depois'], 'Cabeçalho da tabela de alterações');
    assert.ok(rows.length >= 3, `Esperadas ao menos 3 alterações, veio ${rows.length}`);
    assert.ok(rows.every(r => r.columns === 5), 'Toda linha tem 5 colunas');
    const ufs = [...new Set(rows.map(r => r.tag))].sort();
    assert.deepEqual(ufs, ['AP', 'PE'], 'Cada linha indica a UF da respectiva proposta');
    const ap = rows.find(r => r.numero.startsWith('990001/2026'));
    const pe = rows.find(r => r.numero.startsWith('990002/2026'));
    assert.equal(ap.tag, 'AP', 'Proposta 990001/2026 identificada como AP');
    assert.equal(pe.tag, 'PE', 'Proposta 990002/2026 identificada como PE');
    assert.equal(ap.titulo, 'Amapá', 'Nome da UF disponível no title');
    assert.equal(pe.titulo, 'Pernambuco', 'Nome da UF disponível no title');
    const pad = rows.find(r => r.campo === 'pad');
    assert.equal(pad.numero, '990001/2026', 'Número formatado sem zeros artificiais');
    assert.equal(pad.tag, 'AP', 'A linha do PAD traz a UF da proposta alterada');

    // A mesma tabela alimenta a conferência da importação offline.
    const html = await page.locator('#modal-content').innerHTML();
    assert.match(html, /class="uf-tag"[^>]*title="Pernambuco"[^>]*>PE</, 'UF renderizada como etiqueta com nome acessível');

    assert.ok(syncCalls >= 1, 'A sincronização foi acionada uma vez');
    assert.ok(posts.length >= 1, 'O resultado validado foi gravado em memória');
    assert.ok(posts.every(p => p.restore === false), 'Sincronização comum não é restauração');
    assert.equal(memory.proposals.length, 2, 'Banco em memória recebeu as duas propostas');
    assert.deepEqual(blocked, [], 'A UI acessou apenas as rotas previstas');
    assert.deepEqual(pageErrors, [], 'Nenhum pageerror é aceitável');

    console.log(JSON.stringify({
      status: 'passed', isolated: true, realDatabaseWrites: 0, syncCalls, statePosts: posts.length,
      pageerrors: pageErrors.length, headers, changes: rows
    }, null, 2));
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(JSON.stringify({ status: 'failed', message: error.message, pageErrorDetails: pageErrors }, null, 2));
    process.exitCode = 1;
  });
}
