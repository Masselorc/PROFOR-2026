'use strict';

/*
 * Teste de integração ISOLADO da busca sob demanda dos textos oficiais da proposta.
 *   node "Sistema PROFOR 2026/PROFOR_2026/tests/textos-oficiais.cjs"
 *
 * Não inicia servidor, não baixa nada da origem, não usa perfil persistente e não
 * lê/grava dados/registros. /api/state e /api/sync/textos são atendidos em memória.
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
const A = '990901';
const B = '990902';
const STATIC_PATHS = new Set([
  '/PROFOR_2026.html', '/styles.css', '/domain.js', '/bandeiras-uf.js',
  '/storage.js', '/transferegov.js', '/report.js', '/app.js', '/favicon.ico'
]);
const TEXTOS_A = {
  caracterizacao: 'Integração de esforços entre a União e o estado para estruturar a Ouvidoria.',
  publicoAlvo: 'Pessoas privadas de liberdade, familiares e servidores.',
  problema: 'Déficit de infraestrutura física, mobiliária e tecnológica na Ouvidoria.',
  resultados: 'Ouvidoria plenamente aparelhada e redução no tempo de resposta.',
  relacao: 'A proposta alinha-se ao PROFOR/ONASP com bens de capital.',
  capacidade: 'O órgão dispõe de quadro próprio de servidores efetivos.',
  justificativa: ''
};
const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pageErrors = [];
const results = [];

function fixture() {
  const state = D.initialState();
  state.revision = 9;
  for (const [id, uf, numero] of [[A, 'AP', '990901/2026'], [B, 'PE', '990902/2026']]) {
    state.proposals.push(D.createProposal({
      id, numero, uf, programa: D.PROGRAM, proponente: `FIXTURE ISOLADA ${uf} — NÃO É DADO REAL`,
      cnpj: '', orgao: '', objeto: 'Aquisição de bens permanentes para a ouvidoria de serviços penais',
      situacao: 'Proposta/Plano de Trabalho Enviado para Análise', data: '2026-09-01',
      repasse: 10000, contrapartida: 100, global: 10100,
      vigenciaInicio: '2026-11-23', vigenciaFim: '2028-05-19',
      pad: [{ id: '11', descricao: 'PAD 11 fictício', quantidade: '2', unitario: 5050, total: 10100 }]
    }));
  }
  D.validateState(state);
  return state;
}

async function scenario(browser, name, responder, run) {
  if (process.env.PROFOR_TEST_FILTER && !name.includes(process.env.PROFOR_TEST_FILTER)) return;
  const context = await browser.newContext({
    serviceWorkers: 'block', acceptDownloads: false,
    locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport: { width: 1440, height: 1000 }
  });
  let memory = clone(fixture());
  let token = hash(memory);
  const posts = [];
  const blocked = [];
  const chamadas = [];
  const initialErrors = pageErrors.length;
  D.validateState(memory);
  /* Resposta JSON reaproveitada pelo mock e pelos cenários. */
  const reply = (route, body) => route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });

  await context.route('**/*', async route => {
    const request = route.request();
    const url = new globalThis.URL(request.url());
    const json = body => reply(route, body);
    if (url.origin === ORIGIN && url.pathname === '/api/state') {
      if (request.method() === 'GET') return json({ exists: true, state: clone(memory), token, recovery: null });
      const body = request.postDataJSON();
      posts.push(clone(body));
      assert.equal(body.expected, memory.revision, 'expected deve ser a revisão corrente');
      D.validateState(body.state);
      const next = clone(body.state);
      next.revision = memory.revision + 1;
      memory = next;
      token = hash({ parent: token, state: memory });
      return json({ exists: true, state: clone(memory), token });
    }
    if (url.origin === ORIGIN && url.pathname === '/api/sync' && request.method() === 'GET') {
      /* Origem sem novidades: a UI conclui a sincronização e oferece a busca dos
         textos no próprio resultado — é por esse botão que o fluxo é exercitado. */
      return json({ unchanged: true, proposals: clone(memory.proposals.map(p => p.imported)), source: { url: 'https://api-publica.transferegov.gestao.gov.br/downloads', files: [1, 2, 3, 4] }, stats: { durationMs: 1200, padItems: 0 } });
    }
    if (url.origin === ORIGIN && url.pathname === '/api/sync/textos' && request.method() === 'GET') {
      chamadas.push(url.searchParams.get('ids'));
      return responder(route, url, json);
    }
    if (url.origin === ORIGIN && ['GET', 'HEAD'].includes(request.method()) && STATIC_PATHS.has(url.pathname)) return route.continue();
    blocked.push(request.url());
    return route.abort('blockedbyclient');
  });

  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => pageErrors.push({ scenario: name, message: error.message }));
  page.on('dialog', async dialog => { await dialog.accept(); });

  const modal = page.locator('#modal[open]');
  /* A janela de sincronização dispara a sincronização sozinha; com o mock de
     origem sem novidades ela conclui e o resultado traz o botão da busca. */
  const abrirBusca = async () => {
    await page.locator('[data-action="sync"]').first().click();
    await page.locator('#modal[open]').waitFor();
    await page.getByRole('heading', { name: /Nenhuma alteração desde a última sincronização|Sincronização concluída/ }).waitFor();
    await page.locator('[data-action="textos"]').click();
  };
  const conclusao = async () => {
    await page.getByRole('heading', { name: /Textos oficiais guardados|Buscar textos das propostas/ }).waitFor();
    await page.waitForTimeout(200);
    return modal.innerText();
  };

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-action="sync"]').first().waitFor();
  await run({ page, modal, abrirBusca, conclusao, memory: () => memory, posts, chamadas, blocked, reply,
    postsComTextos: () => posts.filter(b => b.state.proposals.some(p => p.textos)) });
  assert.deepEqual(blocked, [], 'A UI acessou apenas as rotas previstas');
  assert.equal(pageErrors.length, initialErrors, 'A página emitiu pageerror');
  results.push({ scenario: name, status: 'passed', pageerrors: pageErrors.length, statePosts: posts.length });
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    await scenario(browser, 'Busca guarda os textos e o item de Mérito passa a exibi-los', (route, url, json) => {
      const ids = (url.searchParams.get('ids') || '').split(',');
      assert.deepEqual(ids.sort(), [A, B].sort(), 'A busca pede as propostas do banco');
      return json({ textos: { [A]: TEXTOS_A }, faltando: [B], stats: { durationMs: 654000, rows: 1157816, found: 1, entry: 'siconv_justificativas_proposta.csv' } });
    }, async t => {
      await t.abrirBusca();
      const texto = await t.conclusao();
      assert.match(texto, /1 proposta\(s\) receberam os textos oficiais/i, 'Resumo informa quantas propostas receberam textos');
      assert.match(texto, /654,0 s/, 'Resumo informa a duração no servidor');
      assert.match(texto, /Sem texto no arquivo público: 1 proposta/i, 'Avisa a proposta sem texto no arquivo');
      const grava = t.postsComTextos();
      assert.equal(grava.length, 1, 'Grava os textos com um único POST');
      const salvo = grava[0].state.proposals.find(p => p.id === A);
      assert.equal(salvo.textos.publicoAlvo, TEXTOS_A.publicoAlvo);
      assert.ok(salvo.textos.at, 'Registra a data de obtenção');
      assert.equal(salvo.imported.textos, undefined, 'Textos ficam fora do retrato da extração');
      assert.equal(grava[0].state.proposals.find(p => p.id === B).textos, undefined, 'Proposta sem texto no arquivo não é alterada');
      await t.modal.getByRole('button', { name: 'Fechar', exact: true }).click();

      // Os textos passam a aparecer na própria aba de Mérito, um item por campo.
      await t.page.goto(`${URL}#proposta/${A}/analise`, { waitUntil: 'domcontentloaded' });
      await t.page.getByRole('heading', { name: 'Mérito', exact: true }).waitFor();
      const linhaJustificativa = t.page.locator('tbody tr').filter({ hasText: 'Caracterização dos Interesses Recíprocos' });
      const naLista = await linhaJustificativa.innerText();
      assert.ok(naLista.includes('Integração de esforços'), 'A justificativa aparece na própria lista');
      assert.ok((await t.page.locator('tbody tr').filter({ hasText: 'Público-alvo' }).innerText()).includes('Pessoas privadas de liberdade'), 'O público-alvo aparece no próprio item');
      assert.ok((await t.page.locator('tbody tr').filter({ hasText: 'Problema a resolver' }).innerText()).includes('Déficit de infraestrutura'), 'O problema aparece no próprio item');
      assert.ok((await t.page.locator('tbody tr').filter({ hasText: 'Resultados esperados' }).innerText()).includes('plenamente aparelhada'), 'Os resultados aparecem no próprio item');
      const linhaObjeto = await t.page.locator('tbody tr').filter({ hasText: 'Objeto do instrumento' }).innerText();
      assert.ok(linhaObjeto.includes('Aquisição de bens permanentes'), 'O objeto aparece na própria linha');
      assert.doesNotMatch(linhaObjeto, /extração oficial/i, 'A linha do objeto não repete o rótulo da extração oficial');
      assert.equal(await t.modal.isVisible(), false, 'Nada de janela para ver o texto');
      await linhaJustificativa.locator('button.review-open').click();
      await t.modal.waitFor();
      const form = await t.modal.innerText();
      assert.ok(form.includes(TEXTOS_A.caracterizacao), 'A caracterização aparece no detalhe do item');
      assert.doesNotMatch(form, /ainda não foram buscados/i, 'Sem aviso de texto ausente quando ele existe');
      assert.match(form, /Transcrição do arquivo público da origem/i, 'Diz de onde veio o texto');
      assert.equal(await t.modal.locator('.texto-oficial').count(), 1, 'Só o campo daquele item (justificativa vazia não gera bloco)');
      await t.modal.getByRole('button', { name: 'Cancelar', exact: true }).click();

      // Os itens de texto exibem o texto oficial correspondente, sem aglutinar.
      for (const [item, esperado] of [['Vinculação aos objetivos e diretrizes do PROFOR/ONASP', TEXTOS_A.relacao], ['Capacidade técnica e gerencial', TEXTOS_A.capacidade]]) {
        const conteudoItem = await t.page.locator('tbody tr').filter({ hasText: item }).innerText();
        assert.ok(conteudoItem.includes(esperado), `Item "${item}" mostra o texto na lista`);
        assert.equal(await t.page.locator('tbody tr').filter({ hasText: 'Metas, etapas/fases e cronogramas' }).count(), 0, 'O item de metas foi eliminado da lista');
        await t.page.locator('tbody tr').filter({ hasText: item }).locator('button.review-open').click();
        await t.modal.waitFor();
        assert.ok((await t.modal.innerText()).includes(esperado), `Item "${item}" mostra o texto oficial correspondente`);
        await t.modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
        await t.modal.waitFor({ state: 'hidden' });
      }
    });

    await scenario(browser, 'Cancelar a busca não grava nada', () => new Promise(() => {}), async t => {
      await t.abrirBusca();
      await t.modal.getByRole('button', { name: 'Cancelar busca' }).click();
      await t.page.getByText(/busca foi interrompida/i).waitFor();
      await t.page.waitForTimeout(200);
      assert.equal(t.postsComTextos().length, 0, 'Cancelar não grava textos');
      assert.match(await t.modal.innerText(), /Nada foi gravado no banco local/i);
    });

    await scenario(browser, 'Falha do servidor e arquivo sem texto não gravam nem mentem', (route, url, json) => json({ textos: {}, faltando: [A, B], stats: { durationMs: 900, rows: 10, found: 0 } }), async t => {
      // Primeiro: servidor responde com erro.
      await t.page.route('**/api/sync/textos*', route => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Falha ao baixar a extração oficial.' }) }));
      await t.abrirBusca();
      await t.page.getByText(/HTTP 502/).waitFor();
      await t.page.waitForTimeout(150);
      assert.equal(t.postsComTextos().length, 0, 'Erro do servidor não grava');
      assert.match(await t.modal.innerText(), /Falha ao baixar a extração oficial/, 'Mensagem do servidor é mostrada');
      await t.page.unroute('**/api/sync/textos*');
      // Depois: arquivo lido, mas sem texto para nenhuma proposta.
      await t.page.getByRole('button', { name: 'Fechar', exact: true }).click();
      await t.abrirBusca();
      const texto = await t.conclusao();
      assert.match(texto, /não trouxe texto para nenhuma das 2 proposta/i, 'Diz que o arquivo não trouxe texto');
      assert.match(texto, /Nada foi alterado/i);
      assert.equal(t.postsComTextos().length, 0, 'Arquivo sem texto não grava');
    });
  } finally {
    await browser.close();
  }
  assert.deepEqual(pageErrors, [], 'Nenhum pageerror é aceitável');
  console.log(JSON.stringify({ status: 'passed', isolated: true, realDatabaseWrites: 0, pageerrors: pageErrors.length, scenarios: results }, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(JSON.stringify({ status: 'failed', message: error.message, pageErrorDetails: pageErrors, completedScenarios: results }, null, 2));
    process.exitCode = 1;
  });
}
