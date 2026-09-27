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
const path = require('node:path');
const { createHash } = require('node:crypto');
const playwrightPath = process.env.PROFOR_PLAYWRIGHT_PATH || 'playwright';
const { chromium } = require(playwrightPath);
const D = require('../domain.js');

const ORIGIN = 'http://127.0.0.1:8766';
const URL = `${ORIGIN}/PROFOR_2026.html`;
const STATIC_PATHS = new Set([
  '/PROFOR_2026.html', '/styles.css', '/domain.js', '/sync-apply.js', '/bandeiras-uf.js',
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
    textos: {'990001':{},'990002':{}},
    textosFaltando: [],
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
      if (url.origin === ORIGIN && url.pathname === '/api/sync/history' && method === 'GET') return json({entries:[]});
      if (url.origin === ORIGIN && url.pathname === '/api/sync/progress' && method === 'GET') return json({});
      if (url.origin === ORIGIN && ['GET', 'HEAD'].includes(method) && STATIC_PATHS.has(url.pathname)) {
        if(url.pathname==='/favicon.ico')return route.fulfill({status:204,body:''});
        const body=fs.readFileSync(path.join(__dirname,'..',url.pathname.slice(1)));
        const contentType=url.pathname.endsWith('.html')?'text/html; charset=utf-8':url.pathname.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8';
        return route.fulfill({status:200,contentType,body});
      }
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
    await page.locator('[data-action="sync-start"]').click();
    await page.waitForFunction(()=>document.querySelector('#sync-progress')?.value===100);

    assert.match(await page.locator('#sync-summary').innerText(),/2 proposta\(s\).*2 texto\(s\) conferido\(s\)/);
    assert.equal(memory.proposals.find(p=>p.id==='990001').imported.objeto,'Objeto atualizado na origem');
    assert.equal(memory.proposals.find(p=>p.id==='990001').imported.pad[0].quantidade,'3');
    assert.ok(memory.proposals.some(p=>p.id==='990002' && p.imported.uf==='PE'));

    assert.ok(syncCalls >= 1, 'A sincronização foi acionada uma vez');
    assert.ok(posts.length >= 1, 'O resultado validado foi gravado em memória');
    assert.ok(posts.every(p => p.restore === false), 'Sincronização comum não é restauração');
    assert.equal(memory.proposals.length, 2, 'Banco em memória recebeu as duas propostas');
    assert.deepEqual(blocked, [], 'A UI acessou apenas as rotas previstas');
    assert.deepEqual(pageErrors, [], 'Nenhum pageerror é aceitável');

    console.log(JSON.stringify({
      status: 'passed', isolated: true, realDatabaseWrites: 0, syncCalls, statePosts: posts.length,
      pageerrors: pageErrors.length, proposals: memory.proposals.length
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
