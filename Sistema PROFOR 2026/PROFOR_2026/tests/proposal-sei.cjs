'use strict';

/*
 * Integração ISOLADA do cadastro de processo SEI por proposta.
 * Modelo: tests/review-diligence.cjs. Executar após implementação da UI:
 *   PROFOR_PLAYWRIGHT_PATH=<playwright> node tests/proposal-sei.cjs
 *
 * NÃO inicia servidor nem importa workspace-store.cjs; NÃO lê ou grava dados/,
 * registros, backups, relatórios ou capturas. Contextos efêmeros, sem downloads
 * ou service workers. /api/state é atendido APENAS em memória, antes do goto.
 * O servidor existente fornece somente recursos estáticos da lista explícita.
 * Qualquer outra API, recurso externo ou WebSocket é bloqueado (fail-closed).
 */
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PROFOR_PLAYWRIGHT_PATH || 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
const D = require('../domain.js');
const ORIGIN = 'http://127.0.0.1:8766';
const APP_URL = `${ORIGIN}/PROFOR_2026.html`;
const IDS = ['990011', '990012'];
const ACTOR = 'Analista — fixture SEI isolada';
const FIRST = { number: '08016.990011/2026-11', url: 'https://example.invalid/sei/processo-990011' };
const EDITED = { number: '08016.990011/2026-22', url: 'https://example.invalid/sei/processo-990011-editado?teste=1&origem=fixture' };
const SECOND = { number: '08016.990012/2026-33', url: 'https://example.invalid/sei/processo-990012' };
const EMPTY = { number: '', url: '' };
const STATIC_PATHS = new Set([
  '/PROFOR_2026.html', '/styles.css', '/domain.js', '/bandeiras-uf.js',
  '/storage.js', '/transferegov.js', '/report.js', '/app.js', '/favicon.ico', '/assets/profor.ico',
  ...Object.keys(D.UFS).map(uf => `/assets/bandeiras/${uf.toLowerCase()}.svg`)
]);
const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const results = [];
const pageErrors = [];

function fixture() {
  const state = D.initialState();
  state.revision = 7;
  for (const [index, id] of IDS.entries()) {
    const p = D.createProposal({
      id, numero: `${id}/2026`, uf: index ? 'AM' : 'AP', programa: D.PROGRAM,
      proponente: 'FIXTURE SEI ISOLADA — NÃO É DADO REAL', cnpj: '', orgao: '',
      objeto: 'Cadastro de processo SEI por proposta — teste isolado',
      situacao: 'Proposta/Plano de Trabalho Enviado para Análise', data: '2026-09-01',
      repasse: 10000, contrapartida: 100, global: 10100,
      pad: [{ id: '11', descricao: 'PAD fictício', quantidade: '2', unitario: 5050, total: 10100 }]
    });
    delete p.sei; // Legado explicitamente sem a propriedade opcional.
    state.proposals.push(p);
  }
  D.validateState(state);
  return state;
}

function domainContract() {
  assert.equal(typeof D.setSei, 'function', 'Implementação deve exportar D.setSei');
  const state = fixture(), p = state.proposals[0], other = clone(state.proposals[1]);
  const original = clone(p), blockers = D.blockers(p), situation = D.situation(p);
  D.setSei(p, { number: `  ${FIRST.number}  `, url: `  ${FIRST.url}  ` }, ACTOR);
  assert.deepEqual(p.sei, FIRST, 'setSei deve remover espaços das extremidades');
  assert.equal(p.history.length, original.history.length + 1);
  assert.equal(p.history.at(-1).actor, ACTOR);
  assert.deepEqual(D.blockers(p), blockers, 'SEI não muda requisitos de análise');
  assert.equal(D.situation(p), situation);
  for (const invalid of [
    { number: FIRST.number, url: '' }, { number: ' ', url: FIRST.url },
    { number: FIRST.number, url: 'javascript:alert(1)' },
    { number: FIRST.number, url: 'https://usuario:senha@example.invalid/processo' }
  ]) {
    const before = clone(p);
    assert.throws(() => D.setSei(p, invalid, ACTOR), undefined, 'Número/link incompletos ou inseguros devem ser rejeitados');
    assert.deepEqual(p, before, 'Validação não pode produzir mutação parcial');
  }
  D.setSei(p, EDITED, ACTOR);
  assert.deepEqual(p.sei, EDITED);
  D.setSei(p, { number: '  ', url: '  ' }, ACTOR);
  assert.deepEqual(p.sei || EMPTY, EMPTY, 'Limpar ambos remove o cadastro');
  assert.deepEqual(state.proposals[1], other, 'Domínio não pode modificar outra proposta');
  D.validateState(state);
  results.push({ scenario: 'Contrato puro: legado, trim, validação atômica, edição, limpeza e isolamento', status: 'passed' });
}

async function scenario(browser, name, run) {
  const context = await browser.newContext({
    serviceWorkers: 'block', acceptDownloads: false, locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo', viewport: { width: 1440, height: 1000 }
  });
  let memory = fixture(), token = hash(memory), gets = 0, expectedActor = 'Usuário local';
  const posts = [], routeErrors = [], blocked = [], dialogs = [];
  const errorsBefore = pageErrors.length;
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const json = body => route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });
    if (url.origin === ORIGIN && url.pathname === '/api/state') {
      if (method === 'GET') {
        gets++;
        return json({ exists: true, state: clone(memory), token, recovery: null });
      }
      if (method === 'POST') {
        posts.push({ body: null });
        try {
          const body = request.postDataJSON();
          posts.at(-1).body = clone(body);
          assert.equal(body.expected, memory.revision, 'expected deve ser a revisão corrente');
          assert.equal(body.token, token, 'token deve corresponder ao envelope corrente');
          assert.equal(body.state.revision, memory.revision, 'Cliente envia revisão anterior');
          assert.equal(body.restore, false, 'Cadastro SEI não é restauração');
          D.validateState(body.state);
          const next = clone(body.state);
          next.revision = memory.revision + 1;
          memory = next;
          token = hash({ parent: token, state: memory });
          return json({ exists: true, state: clone(memory), token });
        } catch (error) {
          routeErrors.push(error.message);
          return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: error.message }) });
        }
      }
    }
    // Jamais usar route.fetch/fallback para APIs ou permitir mutações ao servidor.
    if (url.origin === ORIGIN && ['GET', 'HEAD'].includes(method) && STATIC_PATHS.has(url.pathname)) return route.continue();
    blocked.push({ method, url: request.url() });
    return route.abort('blockedbyclient');
  });
  await context.routeWebSocket('**/*', socket => {
    blocked.push({ method: 'WEBSOCKET', url: socket.url() });
    socket.close(); // Nunca conectar ao servidor.
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => pageErrors.push({ scenario: name, message: error.message }));
  page.on('dialog', async dialog => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    if (dialog.type() === 'confirm' && /Descartar as alterações/.test(dialog.message())) await dialog.accept();
    else await dialog.dismiss();
  });
  const modal = page.locator('#modal');
  const field = name => modal.locator(`[name="${name}"]`);
  const proposal = (id = IDS[0]) => memory.proposals.find(p => p.id === id);
  async function settle() {
    await page.waitForTimeout(200); // Janela delimitada para detectar POST duplicado.
    assert.deepEqual(routeErrors, [], 'Contrato de persistência em memória violado');
    assert.deepEqual(blocked, [], 'UI tentou uma API/recurso não autorizado (requisição bloqueada)');
    assert.equal(pageErrors.length, errorsBefore, 'Página não deve emitir pageerror');
  }
  async function actor() {
    // Confirmado no modelo: review-diligence.cjs não preenche #analyst.
    // app.js atual usa actor() = 'Usuário local'; versões com seletor usam fixture.
    if (await page.locator('#analyst').count()) {
      await page.locator('#analyst').fill(ACTOR);
      await page.locator('#analyst').blur();
      expectedActor = ACTOR;
    }
  }
  async function navigate(id = IDS[0]) {
    await page.goto(`${APP_URL}#proposta/${id}/dados`, { waitUntil: 'networkidle' });
    await page.locator('[data-action="sei"]').waitFor();
    await actor();
  }
  async function display(sei) {
    const registered = Boolean(sei?.number && sei?.url);
    assert.equal(await page.locator('[data-action="sei"]').innerText(), registered ? 'Editar processo' : 'Cadastrar processo');
    const links = page.locator('.sei-process a');
    assert.equal(await links.count(), registered ? 1 : 0);
    if (registered) {
      assert.equal((await links.innerText()).trim(), sei.number);
      assert.equal(await links.getAttribute('href'), sei.url);
      assert.equal(await links.getAttribute('target'), '_blank');
      assert.match(await links.getAttribute('rel'), /\bnoopener\b/);
      assert.match(await links.getAttribute('rel'), /\bnoreferrer\b/);
      // Só inspecionar o link: não navegar para o SEI real ou externo.
    }
  }
  async function open(expected = EMPTY) {
    await page.locator('[data-action="sei"]').click();
    await page.locator('#modal[open]').waitFor();
    for (const name of ['number', 'url']) assert.equal(await field(name).inputValue(), expected?.[name] || '', `Modal deve preservar ${name}`);
  }
  async function fill(sei) {
    await field('number').fill(sei.number);
    await field('url').fill(sei.url);
  }
  async function save(sei, id = IDS[0]) {
    const count = posts.length, before = clone(memory), historyLength = proposal(id).history.length;
    await modal.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.locator('#modal[open]').waitFor({ state: 'hidden' });
    await settle();
    assert.equal(posts.length, count + 1, 'Salvar deve emitir exatamente um POST em memória');
    assert.equal(memory.revision, before.revision + 1);
    assert.deepEqual(proposal(id).sei || EMPTY, sei);
    assert.equal(proposal(id).history.length, historyLength + 1);
    assert.equal(proposal(id).history.at(-1).actor, expectedActor);
    for (const other of before.proposals.filter(p => p.id !== id)) assert.deepEqual(proposal(other.id), other, 'Proposta vizinha deve permanecer integralmente intacta');
    const unaffected = p => { const copy = clone(p); delete copy.sei; delete copy.history; return copy; };
    assert.deepEqual(unaffected(proposal(id)), unaffected(before.proposals.find(p => p.id === id)), 'SEI não altera análise, valores ou dados importados');
    await display(sei);
  }
  async function cancel() {
    const before = clone(memory), count = posts.length;
    await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.locator('#modal[open]').waitFor({ state: 'hidden' });
    await settle();
    assert.equal(posts.length, count, 'Cancelar não persiste');
    assert.deepEqual(memory, before, 'Cancelar não altera cadastro/histórico');
  }
  async function reject(invalid, expected = EMPTY) {
    await open(expected);
    await fill(invalid);
    const before = clone(memory), count = posts.length;
    await modal.getByRole('button', { name: 'Salvar', exact: true }).click();
    await settle();
    assert.equal(await modal.evaluate(el => el.open), true, 'Dados inválidos mantêm modal aberto');
    assert.ok(await modal.locator('form').evaluate(form => !form.checkValidity() || Boolean(form.querySelector('#form-error')?.textContent.trim())), 'Validação nativa ou erro visível deve explicar rejeição');
    assert.equal(posts.length, count, 'Inválidos não chegam à persistência');
    assert.deepEqual(memory, before);
    await cancel();
    await open(expected); // Detectar também mutação indevida no estado fechado de app.js.
    await cancel();
  }
  try {
    await navigate();
    assert.ok(gets >= 2, 'storage.open/read devem obter o estado simulado');
    assert.equal(posts.length, 0, 'Legado sem SEI não deve gerar migração/gravação inicial');
    await run({ page, navigate, display, open, fill, save, cancel, reject, proposal, posts });
    await settle();
    assert.ok(dialogs.every(d => d.type === 'confirm' && /Descartar as alterações/.test(d.message)), 'Diálogo inesperado');
    results.push({ scenario: name, status: 'passed', stateGets: gets, statePosts: posts.length, blockedRequests: blocked.length, pageerrors: pageErrors.length - errorsBefore });
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  } finally {
    await context.close();
  }
}

async function main() {
  domainContract();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    await scenario(browser, 'Legado vazio, salvar, recarregar/preservar, editar, cancelar, isolamento e limpar', async t => {
      await t.display(EMPTY);
      await t.open();
      await t.fill({ number: `  ${FIRST.number}  `, url: `  ${FIRST.url}  ` });
      await t.save(FIRST);
      const persisted = clone(t.proposal());
      const postCount = t.posts.length;
      await t.page.reload({ waitUntil: 'networkidle' });
      await t.display(FIRST);
      assert.deepEqual(t.proposal(), persisted, 'Reload deve preservar estado inteiro');
      assert.equal(t.posts.length, postCount, 'Reload não gera POST');
      await t.open(FIRST);
      await t.fill(EDITED);
      await t.save(EDITED);
      await t.open(EDITED);
      await t.fill(SECOND);
      await t.cancel();
      await t.display(EDITED);
      await t.open(EDITED);
      await t.cancel();
      await t.navigate(IDS[1]);
      await t.display(EMPTY);
      await t.open();
      await t.fill(SECOND);
      await t.save(SECOND, IDS[1]);
      await t.navigate();
      await t.display(EDITED);
      await t.open(EDITED);
      await t.fill(EMPTY);
      await t.save(EMPTY);
      await t.page.reload({ waitUntil: 'networkidle' });
      await t.display(EMPTY);
      await t.open();
      await t.cancel();
      await t.navigate(IDS[1]);
      await t.display(SECOND);
      assert.deepEqual(t.proposal(IDS[1]).sei, SECOND, 'Limpar proposta A não apaga B');
      assert.equal(t.posts.length, 4, 'Cadastro A, edição A, cadastro B e limpeza A: quatro POSTs');
    });
    await scenario(browser, 'Cancelar cadastro vazio e rejeitar pares incompletos/links inseguros sem persistir', async t => {
      await t.open();
      await t.fill(FIRST);
      await t.cancel();
      await t.display(EMPTY);
      await t.open();
      await t.cancel();
      for (const invalid of [
        { number: FIRST.number, url: '' }, { number: '', url: FIRST.url },
        { number: FIRST.number, url: 'javascript:alert(1)' },
        { number: FIRST.number, url: 'https://usuario:senha@example.invalid/processo' }
      ]) await t.reject(invalid);
      assert.equal(t.posts.length, 0);
    });
    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({ status: 'passed', isolated: true, realDatabaseWrites: 0, pageerrors: 0, scenarios: results }, null, 2));
  } finally {
    await browser.close();
  }
}

if (require.main === module) main().catch(error => {
  console.error(JSON.stringify({ status: 'failed', message: error.message, stack: error.stack, pageErrorDetails: pageErrors, completedScenarios: results }, null, 2));
  process.exitCode = 1;
});
