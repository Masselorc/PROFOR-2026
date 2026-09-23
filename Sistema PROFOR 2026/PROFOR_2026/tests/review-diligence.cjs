'use strict';

/*
 * Teste de integração ISOLADO do formulário Analisar → Em diligência.
 * Implementado para execução manual SOMENTE após autorização de que a UI está pronta:
 *   node "Sistema PROFOR 2026/PROFOR_2026/tests/review-diligence.cjs"
 *
 * Não inicia servidor, não importa workspace-store.cjs, não usa perfil persistente,
 * não lê/grava dados/registros e não escreve relatórios, capturas ou backups.
 * Todas as chamadas /api/state são atendidas em memória ANTES da navegação.
 * /api/sync e qualquer requisição fora da lista de recursos estáticos são bloqueadas.
 * O servidor existente fornece exclusivamente HTML, JavaScript e CSS.
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
const PROPOSAL_ID = '990001';
const PAD_ID = '11';
const REF = `pad:${PAD_ID}`;
const DOCUMENT = 'Documento PAD preexistente — fixture isolada';
const DOCUMENT_URL = 'https://example.invalid/documento-pad-11';
const ORIGINAL_NOTE = 'Conferência anterior do PAD 11 — preservar o texto ao trocar Resultado.';
const FIELD_NAMES = ['category', 'communication', 'response', 'status', 'note', 'due'];
const STATIC_PATHS = new Set([
  '/PROFOR_2026.html', '/styles.css', '/domain.js', '/bandeiras-uf.js',
  '/storage.js', '/transferegov.js', '/report.js', '/app.js', '/favicon.ico'
]);
const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const results = [];
const pageErrors = [];

function fixture() {
  const state = D.initialState();
  state.revision = 7;
  const proposal = D.createProposal({
    id: PROPOSAL_ID, numero: '990001/2026', uf: 'AP', programa: D.PROGRAM,
    proponente: 'FIXTURE ISOLADA — NÃO É DADO REAL', cnpj: '', orgao: '',
    objeto: 'Teste do formulário de análise e diligência',
    situacao: 'Proposta/Plano de Trabalho Enviado para Análise', data: '2026-09-01',
    repasse: 10000, contrapartida: 100, global: 10100,
    pad: [{ id: PAD_ID, descricao: 'PAD 11 fictício', quantidade: '2', unitario: 5050, total: 10100 }]
  });
  D.setReview(proposal, 'pad', PAD_ID, {
    status: 'obs', note: ORIGINAL_NOTE, document: DOCUMENT, url: DOCUMENT_URL
  }, 'Fixture isolada');
  state.proposals.push(proposal);
  D.validateState(state);
  return state;
}

function addDiligence(state, overrides = {}) {
  const data = {
    id: '', ref: REF, category: 'PLANO DE APLICAÇÃO DETALHADO', request: ORIGINAL_NOTE,
    communication: '2026-09-01', science: '2026-09-02', response: '',
    status: 'aguardando', note: 'Observação original da diligência', due: '2026-09-14',
    confirmed: true, calendarNote: 'Calendário sintético de teste; nenhuma validação jurídica real.',
    ...overrides
  };
  const saved = D.saveDiligence(state.proposals[0], data, 'Fixture isolada');
  // Simula um registro legado carregado, não uma nova conferência pelo formulário.
  const deadline = D.deadlineBase(data.science, data.communication);
  Object.assign(saved, { base: deadline.base, due: data.confirmed ? data.due : deadline.adjusted,
    automaticDeadline: false, confirmed: data.confirmed, calendarNote: data.calendarNote });
  return saved;
}

async function scenario(browser, name, seed, run) {
  if (process.env.PROFOR_TEST_FILTER && !name.includes(process.env.PROFOR_TEST_FILTER)) return;
  const context = await browser.newContext({
    serviceWorkers: 'block', acceptDownloads: false,
    locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport: { width: 1440, height: 1000 }
  });
  let memory = clone(seed);
  let token = hash(memory);
  let recovery = null;
  const posts = [];
  const routeErrors = [];
  const blocked = [];
  const dialogs = [];
  const initialErrorCount = pageErrors.length;
  let gets = 0;
  D.validateState(memory);

  // Uma única guarda fail-closed: nunca usar route.fetch() ou fallback para API.
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new globalThis.URL(request.url());
    const method = request.method();
    if (url.origin === ORIGIN && url.pathname === '/api/state') {
      const json = body => route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });
      if (method === 'GET') {
        gets++;
        return json({ exists: true, state: clone(memory), token, recovery: clone(recovery) });
      }
      if (method === 'POST') {
        const attempt = { body: null, saved: null };
        posts.push(attempt); // Conta tentativas também, não só gravações aceitas.
        try {
          const body = request.postDataJSON();
          attempt.body = clone(body);
          assert.equal(body.expected, memory.revision, 'expected deve ser a revisão corrente');
          assert.equal(body.token, token, 'token deve ser o devolvido pelo último GET/POST');
          assert.equal(body.state.revision, memory.revision, 'cliente envia a revisão anterior');
          assert.equal(body.restore, false, 'análise comum não é uma restauração');
          D.validateState(body.state);
          const next = clone(body.state);
          next.revision = memory.revision + 1;
          memory = next;
          token = hash({ parent: token, state: memory });
          attempt.saved = clone(memory);
          // Mesmo envelope do workspace-store.save, consumido por storage.js.
          return json({ exists: true, state: clone(memory), token });
        } catch (error) {
          routeErrors.push(error.message);
          return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: error.message }) });
        }
      }
    }
    if (url.origin === ORIGIN && ['GET', 'HEAD'].includes(method) && STATIC_PATHS.has(url.pathname)) {
      return route.continue();
    }
    blocked.push({ method, url: request.url() });
    return route.abort('blockedbyclient'); // Inclui /api/sync, suas subrotas e qualquer mutação real.
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
  const field = suffix => modal.locator(`[name="d_${suffix}"]`);
  const review = () => memory.proposals[0].reviews.pad[PAD_ID];
  const proposal = () => memory.proposals[0];
  const snapshot = () => clone(memory);

  async function openReview() {
    const root = page.locator(`[data-status-dropdown][data-group="pad"][data-id="${PAD_ID}"]`);
    await root.locator('[data-status-toggle]').click();
    await root.locator('[data-status-details]').click();
    await page.locator('#modal[open]').waitFor();
    await modal.locator('select[name="status"]').waitFor();
  }
  async function result(value) {
    await modal.locator('select[name="status"]').selectOption(value);
  }
  async function automaticFields(prefix = 'd_') {
    for (const name of ['science', 'confirmed', 'calendarNote']) assert.equal(await modal.locator(`[name="${prefix}${name}"]`).count(), 0, `${name} não deve ser coletado`);
    assert.equal(await modal.locator('#deadline-preview, #review-deadline-preview').count(), 0, 'Sem avisos de prazo');
    assert.doesNotMatch(await modal.innerText(), /10 dias corridos|Confira feriados|Conferi feriados|Vencimento sugerido|Data-base:|ciência|conferência do calendário/i);
    assert.equal(await modal.locator(`[name="${prefix}due"]`).evaluate(el => el.type === 'date' && el.readOnly), true, 'Vencimento somente leitura');
  }
  async function deadlineUpdates(prefix = 'd_') {
    for (const type of ['input', 'change']) {
      for (const [value, expected] of [['2026-09-01', '2026-09-11'], ['2026-09-02', '2026-09-14'], ['', '']]) {
        await modal.locator(`[name="${prefix}communication"]`).evaluate((el, update) => {
          el.value = update.value;
          el.dispatchEvent(new Event(update.type, { bubbles: true }));
        }, { value, type });
        assert.equal(await modal.locator(`[name="${prefix}due"]`).inputValue(), expected, `${type}: atualizar/limpar vencimento`);
      }
    }
  }
  async function diligenceVisibility(visible) {
    const fields = modal.locator('#review-diligence');
    await fields.waitFor({ state: visible ? 'visible' : 'hidden' });
    for (const suffix of FIELD_NAMES) {
      assert.equal(await field(suffix).isVisible(), visible, `d_${suffix}: visibilidade para diligência = ${visible}`);
    }
    await automaticFields();
  }
  function preservedDocument() {
    assert.equal(review().document, DOCUMENT, 'Nome do documento PAD preexistente foi alterado');
    assert.equal(review().url, DOCUMENT_URL, 'Link PAD preexistente foi alterado');
  }
  async function settle() {
    // Janela curta e delimitada para detectar POST duplicado após a conclusão da UI.
    await page.waitForTimeout(200);
    assert.deepEqual(routeErrors, [], 'Contrato de persistência em memória violado');
    assert.deepEqual(blocked, [], 'A UI tentou acessar uma API/recurso não autorizado');
    assert.equal(pageErrors.length, initialErrorCount, 'A página emitiu pageerror');
  }
  async function saveOnce() {
    const before = posts.length;
    const revision = memory.revision;
    await modal.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.locator('#modal[open]').waitFor({ state: 'hidden' });
    await settle();
    assert.equal(posts.length, before + 1, 'Salvar review + diligência exige exatamente um POST');
    assert.equal(memory.revision, revision + 1, 'Salvar deve consumir somente uma revisão');
    preservedDocument();
    return posts[before];
  }
  async function cancel() {
    const before = snapshot(), count = posts.length;
    await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.locator('#modal[open]').waitFor({ state: 'hidden' });
    await settle();
    assert.equal(posts.length, count, 'Cancelar não pode emitir POST');
    assert.deepEqual(snapshot(), before, 'Cancelar não pode alterar review/diligências/histórico');
  }
  async function validFields() {
    await field('category').selectOption('PLANO DE APLICAÇÃO DETALHADO');
    await field('communication').fill('2026-09-01');
    await field('response').fill('2026-09-03');
    await field('status').selectOption('recebida');
    await field('note').fill('Resposta recebida; ainda depende de conferência.');
    assert.equal(await field('due').inputValue(), '2026-09-11');
  }
  async function rejectedSave(message) {
    const before = snapshot(), count = posts.length;
    await modal.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#form-error')?.textContent.trim());
    assert.match(await modal.locator('#form-error').innerText(), message);
    assert.equal(await modal.evaluate(el => el.open), true, 'Erro deve manter o modal aberto');
    await settle();
    assert.equal(posts.length, count, 'Data inválida não pode chegar à persistência');
    assert.deepEqual(snapshot(), before, 'Validação inválida não pode alterar review/diligência');
    // Não basta comparar o mock: reabrir a UI depois do cancelamento verifica o
    // estado fechado em app.js, impedindo mutação parcial anterior ao saveDiligence.
    await cancel();
    await openReview();
    assert.equal(await modal.locator('[name="status"]').inputValue(), before.proposals[0].reviews.pad[PAD_ID].status);
    assert.equal(await modal.locator('textarea[name="note"]').inputValue(), before.proposals[0].reviews.pad[PAD_ID].note);
    await cancel();
  }

  try {
    await page.goto(`${URL}#proposta/${PROPOSAL_ID}/pad`, { waitUntil: 'networkidle' });
    await page.locator(`[data-status-dropdown][data-group="pad"][data-id="${PAD_ID}"]`).waitFor();
    assert.ok(gets >= 2, 'storage.open/read devem carregar o envelope simulado');
    assert.equal(posts.length, 0, 'exists:true não pode disparar migração/gravação inicial');
    await run({ page, modal, field, result, openReview, diligenceVisibility, automaticFields, deadlineUpdates, validFields,
      saveOnce, rejectedSave, cancel, snapshot, proposal, review, posts, dialogs, preservedDocument });
    await settle();
    assert.ok(dialogs.every(d => d.type === 'confirm' && /Descartar as alterações/.test(d.message)), 'Diálogo inesperado');
    results.push({ scenario: name, status: 'passed', stateGets: gets, statePosts: posts.length, pageerrors: pageErrors.length - initialErrorCount });
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    await scenario(browser, 'Visibilidade condicional, texto reaproveitado e cancelamento', fixture(), async t => {
      await t.openReview();
      await t.diligenceVisibility(false);
      assert.equal(await t.modal.locator('[name="document"], [name="url"]').count(), 0, 'PAD não oferece edição de documento/link');
      await t.modal.locator('textarea[name="note"]').fill('Texto digitado antes de selecionar diligência.');
      await t.result('diligencia');
      await t.diligenceVisibility(true);
      assert.equal(await t.modal.locator('textarea[name="note"]').evaluate(el => {
        const label = el.closest('label').cloneNode(true);
        label.querySelector('textarea').remove();
        return label.textContent.trim();
      }), 'Providência solicitada / justificativa');
      assert.equal(await t.modal.locator('textarea[name="note"]').inputValue(), 'Texto digitado antes de selecionar diligência.');
      assert.equal(await t.modal.locator('[name="request"], [name="d_request"]').count(), 0, 'Não deve haver segunda providência duplicando note');
      for (const status of ['na', 'ok', 'obs', 'no']) {
        await t.result(status);
        await t.diligenceVisibility(false);
        assert.equal(await t.modal.locator('textarea[name="note"]').inputValue(), 'Texto digitado antes de selecionar diligência.');
      }
      await t.result('diligencia');
      await t.validFields();
      await t.cancel();
      assert.ok(t.dialogs.some(d => /Descartar as alterações/.test(d.message)), 'Cancelar formulário alterado deve pedir confirmação');
      await t.openReview();
      assert.equal(await t.modal.locator('[name="status"]').inputValue(), 'obs');
      assert.equal(await t.modal.locator('textarea[name="note"]').inputValue(), ORIGINAL_NOTE);
      await t.cancel();
    });

    await scenario(browser, 'Criação + ref atômica e reabertura/edição sem duplicata', fixture(), async t => {
      await t.openReview();
      await t.result('diligencia');
      await t.diligenceVisibility(true);
      assert.equal(await t.modal.locator('textarea[name="note"]').inputValue(), ORIGINAL_NOTE);
      await t.validFields();
      const post = await t.saveOnce();
      assert.equal(post.body.state.proposals[0].reviews.pad[PAD_ID].status, 'diligencia');
      assert.equal(post.body.state.proposals[0].diligences.length, 1, 'Mesmo POST deve conter review E diligência');
      const first = clone(t.proposal().diligences[0]);
      assert.ok(first.id);
      assert.equal(first.ref, REF, 'PAD 11 não pode ser confundido com celebracao:11');
      assert.equal(first.request, ORIGINAL_NOTE);
      assert.equal(first.category, 'PLANO DE APLICAÇÃO DETALHADO');
      assert.equal(first.communication, '2026-09-01');
      assert.equal(first.science, '', 'Ciência não é mais coletada no cadastro');
      assert.equal(first.response, '2026-09-03');
      assert.equal(first.status, 'recebida');
      assert.equal(first.note, 'Resposta recebida; ainda depende de conferência.');
      assert.equal(first.base, '2026-09-11');
      assert.equal(first.due, '2026-09-11');
      assert.equal(first.automaticDeadline, true);
      assert.equal(first.confirmed, false);
      assert.equal(first.calendarNote, '');
      assert.deepEqual(D.pending(t.proposal()), [], 'Não pode restar marcação sem registro ativo');
      await t.page.reload({ waitUntil: 'networkidle' });
      await t.openReview();
      await t.diligenceVisibility(true);
      for (const name of FIELD_NAMES) assert.equal(await t.field(name).inputValue(), first[name], `Reabrir deve carregar d_${name}`);
      await t.modal.locator('textarea[name="note"]').fill('Providência revisada sem criar duplicata.');
      await t.field('note').fill('Observação de acompanhamento revisada.');
      await t.saveOnce();
      assert.equal(t.proposal().diligences.length, 1);
      assert.equal(t.proposal().diligences[0].id, first.id, 'Reabrir deve reutilizar id');
      assert.equal(t.proposal().diligences[0].request, 'Providência revisada sem criar duplicata.');
      assert.equal(t.review().note, t.proposal().diligences[0].request);
      assert.equal(t.proposal().diligences[0].note, 'Observação de acompanhamento revisada.');
    });

    const existing = fixture();
    const active = clone(addDiligence(existing));
    const closed = clone(addDiligence(existing, { status: 'saneada', response: '2026-09-03', note: 'Já saneada', request: 'Não alterar registro saneado.' }));
    await scenario(browser, 'Reutiliza diligência ativa já existente e preserva saneada', existing, async t => {
      await t.openReview();
      await t.result('diligencia');
      await t.diligenceVisibility(true);
      assert.equal(await t.field('communication').inputValue(), active.communication);
      assert.equal(await t.field('status').inputValue(), active.status);
      assert.equal(await t.field('due').inputValue(), '2026-09-11', 'Abertura recalcula sem ciência antiga');
      await t.modal.locator('textarea[name="note"]').fill('Providência atualizada da diligência ativa preexistente.');
      await t.saveOnce();
      assert.equal(t.proposal().diligences.length, 2, 'Não criar terceira diligência');
      const updated = t.proposal().diligences.find(d => d.id === active.id);
      assert.equal(updated.request, t.review().note);
      assert.equal(updated.science, active.science);
      assert.equal(updated.calendarNote, active.calendarNote);
      assert.equal(updated.due, '2026-09-11');
      assert.equal(updated.automaticDeadline, true);
      assert.equal(updated.confirmed, false);
      assert.deepEqual(t.proposal().diligences.find(d => d.id === closed.id), closed, 'Saneada não pode ser reaberta/alterada implicitamente');
    });

    const multiple = fixture();
    const first = clone(addDiligence(multiple, { note: 'Primeira diligência: não alterar' }));
    const second = clone(addDiligence(multiple, { category: 'PESQUISA DE PREÇOS', note: 'Segunda diligência: editar explicitamente', communication: '2026-09-04', science: '', due: '', confirmed: false, calendarNote: '' }));
    await scenario(browser, 'Mais de uma ativa exige seleção por d_id', multiple, async t => {
      await t.openReview();
      await t.result('diligencia');
      const selector = t.modal.locator('select[name="d_id"]');
      await selector.waitFor({ state: 'visible' });
      const ids = await selector.locator('option').evaluateAll(options => options.map(o => o.value));
      assert.ok(ids.includes(first.id) && ids.includes(second.id), 'Seletor deve identificar cada diligência ativa por id');
      await selector.selectOption(second.id);
      assert.equal(await t.field('category').inputValue(), second.category);
      assert.equal(await t.field('communication').inputValue(), second.communication);
      assert.equal(await t.field('note').inputValue(), second.note);
      await t.modal.locator('textarea[name="note"]').fill('Somente a segunda diligência recebe esta providência.');
      await t.field('note').fill('Segunda diligência atualizada via seletor.');
      await t.saveOnce();
      assert.equal(t.proposal().diligences.length, 2);
      assert.deepEqual(t.proposal().diligences.find(d => d.id === first.id), first);
      assert.equal(t.proposal().diligences.find(d => d.id === second.id).request, t.review().note);
      assert.equal(t.proposal().diligences.find(d => d.id === second.id).note, 'Segunda diligência atualizada via seletor.');
    });

    await scenario(browser, 'Datas inválidas não persistem nem mutam review em memória', fixture(), async t => {
      const cases = [
        { label: 'resposta anterior', field: 'response', value: '2026-08-31', error: /Resposta.*anterior/ },
        ...['communication', 'response'].map(field => ({ label: `data inexistente em ${field}`, field, value: '2026-02-30', raw: true, error: /Data inexistente|Data inválida/ }))
      ];
      for (const item of cases) {
        await t.openReview();
        await t.result('diligencia');
        await t.modal.locator('textarea[name="note"]').fill(`Texto que não pode vazar após erro: ${item.label}`);
        await t.validFields();
        if (item.raw) {
          // input[type=date] sanitiza 30/02 para vazio. Injetar no formdata
          // testa o parser defensivo do submit sem chamar métodos do domínio
          // nem disparar o preview de ciência com um valor artificial.
          await t.modal.locator('form').evaluate((form, invalid) => {
            form.addEventListener('formdata', event => event.formData.set(`d_${invalid.field}`, invalid.value), { once: true });
          }, { field: item.field, value: item.value });
        } else {
          await t.field(item.field).fill(item.value);
          await t.field(item.field).blur();
        }
        await t.rejectedSave(item.error);
      }
    });

    await scenario(browser, 'Resultados não-diligência ignoram campos ocultos e não criam registro', fixture(), async t => {
      for (const status of ['ok', 'obs', 'no', 'na']) {
        await t.openReview();
        await t.result('diligencia');
        await t.validFields();
        await t.field('response').fill('2026-08-31'); // Inválida, mas irrelevante após mudar Resultado.
        await t.result(status);
        await t.diligenceVisibility(false);
        await t.modal.locator('textarea[name="note"]').fill(`Análise ${status}, sem diligência.`);
        await t.saveOnce();
        assert.equal(t.review().status, status);
        assert.equal(t.proposal().diligences.length, 0, 'Campos ocultos não autorizam criação de diligência');
      }
    });
    assert.deepEqual(pageErrors, [], 'Nenhum pageerror é aceitável');
    console.log(JSON.stringify({ status: 'passed', isolated: true, pageerrors: pageErrors.length, scenarios: results }, null, 2));
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(JSON.stringify({ status: 'failed', message: error.message, stack: error.stack, pageerrors: pageErrors.length, pageErrorDetails: pageErrors, completedScenarios: results }, null, 2));
    process.exitCode = 1;
  });
}
