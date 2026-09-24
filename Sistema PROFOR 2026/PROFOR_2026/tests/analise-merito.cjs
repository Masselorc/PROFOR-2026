'use strict';

/*
 * Teste de integração ISOLADO da aba de Mérito: textos oficiais na própria tela e
 * lista de ação: aceite em um clique e demais resultados no formulário.
 *   node "Sistema PROFOR 2026/PROFOR_2026/tests/analise-merito.cjs"
 *
 * Não inicia servidor, não usa perfil persistente, não lê/grava dados/registros.
 * /api/state é atendido em memória; nenhuma escrita chega ao banco real.
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
const PROPOSAL_ID = '990888';
const ITENS = [
  'Objeto do instrumento',
  'Caracterização dos Interesses Recíprocos',
  'Público-alvo',
  'Problema a resolver',
  'Resultados esperados',
  'Destinação à Ouvidoria de Serviços Penais',
  'Vinculação aos objetivos e diretrizes do PROFOR/ONASP',
  'Capacidade técnica e gerencial',
  'Instituição da Ouvidoria Específica de Serviços Penais',
  'Adesão ao Fala.BR'
];
/* Nomes por posição, para as verificações não dependerem de índice solto. */
const [OBJETO, CARACTERIZACAO, PUBLICO_ALVO, PROBLEMA, RESULTADOS, DESTINACAO, OBJETIVOS, CAPACIDADE, OUVIDORIA, FALA_BR] = ITENS;
const TEXTOS = {
  caracterizacao: 'Integração de esforços entre o Ministério da Justiça/SENAPPEN e a SEAP para estruturar a Ouvidoria de Serviços Penais do estado.',
  publicoAlvo: 'Pessoas privadas de liberdade, seus familiares, operadores do direito e servidores do sistema penitenciário.',
  problema: 'Déficit de infraestrutura física, mobiliária e tecnológica na Ouvidoria, que limita o acolhimento presencial.',
  resultados: 'Ouvidoria plenamente aparelhada e redução no tempo de resposta a manifestações.',
  relacao: 'A proposta alinha-se estritamente ao PROFOR/ONASP ao prever o aparelhamento físico e tecnológico do setor.',
  capacidade: 'A Secretaria dispõe de estrutura organizacional e quadro próprio de servidores efetivos para a execução.',
  justificativa: ''
};
const STATIC_PATHS = new Set([
  '/PROFOR_2026.html', '/styles.css', '/domain.js', '/bandeiras-uf.js',
  '/storage.js', '/transferegov.js', '/report.js', '/app.js', '/favicon.ico'
]);
const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pageErrors = [];

function fixture() {
  const state = D.initialState();
  state.revision = 5;
  const proposal = D.createProposal({
    id: PROPOSAL_ID, numero: '990888/2026', uf: 'AP', programa: D.PROGRAM,
    proponente: 'FIXTURE ISOLADA — NÃO É DADO REAL', cnpj: '', orgao: '',
    objeto: 'Aquisição de mobiliários e equipamentos para a ouvidoria de serviços penais',
    situacao: 'Proposta/Plano de Trabalho Enviado para Análise',
    data: '2026-09-01', repasse: 10000, contrapartida: 100, global: 10100,
    vigenciaInicio: '2026-11-23', vigenciaFim: '2028-05-19',
    pad: [{ id: '11', descricao: 'PAD 11 fictício', quantidade: '2', unitario: 5050, total: 10100 }]
  });
  D.setTextos(proposal, TEXTOS, 'Fixture isolada');
  /* Avaliação antiga da extinta Habilitação: precisa sobreviver no banco sem ser
     exibida nem exigida. */
  const antiga = { status: 'ok', note: 'Avaliação antiga preservada', document: '', url: '', at: D.now() };
  proposal.reviews.habilitacao = { identificacao: clone(antiga), prazo: clone(antiga), condicoes: clone(antiga) };
  state.proposals.push(proposal);
  D.validateState(state);
  return state;
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({
      serviceWorkers: 'block', acceptDownloads: false,
      locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport: { width: 1440, height: 1000 }
    });
    let memory = clone(fixture());
    let token = hash(memory);
    const blocked = [];
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
        assert.equal(body.expected, memory.revision, 'expected deve ser a revisão corrente');
        D.validateState(body.state);
        const next = clone(body.state);
        next.revision = memory.revision + 1;
        memory = next;
        token = hash({ parent: token, state: memory });
        return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ exists: true, state: clone(memory), token }) });
      }
      if (url.origin === ORIGIN && ['GET', 'HEAD'].includes(request.method()) && STATIC_PATHS.has(url.pathname)) return route.continue();
      blocked.push(request.url());
      return route.abort('blockedbyclient');
    });

    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto(`${URL}#proposta/${PROPOSAL_ID}/analise`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Mérito', exact: true }).waitFor();
    const modal = page.locator('#modal');
    /* Localiza a linha pelo título exato do item: um item pode citar o nome de
       outro dentro do próprio texto de referência. */
    const linha = item => page.locator('#tab-content tbody tr').filter({ has: page.getByRole('button', { name: item, exact: true }) });
    const controle = item => linha(item).locator('[data-status-dropdown]');
    const escolher = async (root, value) => {
      await root.locator('[data-status-toggle]').click();
      await root.locator('[data-status-popover]').waitFor();
      await root.locator(`[data-status-value="${value}"]`).click();
    };
    const editarDetalhes = async root => {
      await root.locator('[data-status-toggle]').click();
      await root.locator('[data-status-details]').click();
    };

    // 1. Estrutura: a aba de Mérito com os itens, sem Habilitação.
    const itens = await page.locator('#tab-content tbody tr .review-title button.review-open').allInnerTexts();
    assert.deepEqual(itens, ITENS);
    const secoes = await page.locator('#tab-content section h2').allInnerTexts();
    assert.deepEqual(secoes, ['Mérito'], 'Uma única seção: sem Habilitação e sem o antigo card de Ouvidoria e Fala.BR');
    assert.equal(await page.getByRole('button', { name: 'Editar informações', exact: true }).count(), 1, 'O acesso ao formulário institucional continua na aba');
    assert.doesNotMatch(await page.locator('#tab-content').innerText(), /Ouvidoria e Fala\.BR/, 'O card institucional foi extinto');
    const abas = await page.locator('nav.tabs a').allInnerTexts();
    assert.deepEqual(abas.map(x => x.trim()), ['Dados', 'Mérito', 'Plano de Aplicação Detalhado', 'Requisitos da Proposta', 'Requisitos para Formalização', 'Diligências', 'Histórico']);

    // 2. Cada item mostra, na própria tela, apenas o texto que é dele.
    const textosDoItem = linha(CARACTERIZACAO).locator('.oficial');
    assert.equal(await textosDoItem.count(), 1, 'O item traz um bloco: o texto que lhe corresponde');
    assert.equal(await textosDoItem.first().locator('details, summary').count(), 0, 'O texto não é expansível');
    assert.equal(await textosDoItem.first().locator('.texto-oficial').isVisible(), true, 'Texto completo fica sempre visível');
    assert.ok((await textosDoItem.first().locator('.texto-oficial').innerText()).includes(TEXTOS.caracterizacao), 'O texto oficial completo aparece no painel');
    assert.equal(await modal.isVisible(), false, 'Nenhuma janela foi aberta');
    /* Um item por campo, sem aglutinação: cada linha tem só o seu texto. */
    const esperado = [
      [CARACTERIZACAO, TEXTOS.caracterizacao, TEXTOS.publicoAlvo],
      [PUBLICO_ALVO, TEXTOS.publicoAlvo, TEXTOS.problema],
      [PROBLEMA, TEXTOS.problema, TEXTOS.resultados],
      [RESULTADOS, TEXTOS.resultados, TEXTOS.relacao],
      [OBJETIVOS, TEXTOS.relacao, TEXTOS.capacidade],
      [CAPACIDADE, TEXTOS.capacidade, TEXTOS.caracterizacao]
    ];
    for (const [item, proprio, alheio] of esperado) {
      const texto = await linha(item).innerText();
      assert.ok(texto.includes(proprio), `“${item}” mostra o próprio texto`);
      assert.ok(!texto.includes(alheio), `“${item}” não mostra texto de outro item`);
    }
    /* A linha do objeto mostra o próprio objeto, sem o rótulo da extração oficial. */
    const linhaDoObjeto = await linha(OBJETO).innerText();
    assert.ok(linhaDoObjeto.includes('Aquisição de mobiliários e equipamentos para a ouvidoria de serviços penais'), 'A linha do objeto mostra o objeto da proposta');
    assert.doesNotMatch(linhaDoObjeto, /extração oficial/i, 'A linha do objeto não cita a extração oficial');
    assert.equal(await linha(OBJETO).locator('.oficial').count(), 1, 'O objeto aparece por inteiro no painel');
    assert.equal(await linha(DESTINACAO).locator('.oficial').count(), 0, 'Item sem texto da origem não inventa conteúdo');
    assert.equal(await linha(OUVIDORIA).locator('.oficial').count(), 0, 'Item institucional sem dado registrado não mostra texto');
    assert.doesNotMatch(await linha(OUVIDORIA).innerText(), /Não informada|Nenhum link registrado|Situação registrada/, 'Nada de mensagem de ausência na linha');

    // 3. Um único controle na Ação: a lista com os resultados possíveis.
    const cabecalhos = await page.locator('#tab-content thead th').allInnerTexts();
    assert.deepEqual(cabecalhos.map(x => x.trim()), ['Requisito', 'Resultado', 'Ação'], 'A coluna Documento não existe no Mérito');
    for (const item of ITENS) {
      const acao = linha(item).locator('td').last();
      assert.equal(await linha(item).locator('td').count(), 3, `“${item}”: três colunas por linha`);
      assert.equal(await acao.locator('[data-status-dropdown]').count(), 1, `“${item}”: um único controle na ação`);
      assert.equal(await acao.locator('select').count(), 0, `“${item}”: sem select HTML nativo`);
      const esperado = /Instituição da Ouvidoria/.test(item) ? ['Analisar', 'Conformidade', 'Ausente']
        : /Fala\.BR/.test(item) ? ['Analisar', 'Já aderiu', 'Previsto no Plano de Trabalho', 'Sem previsão']
        : ['Analisar', 'Atende', 'Atendido com observação', 'Em diligência', 'Não atende'];
      assert.deepEqual(await acao.locator('.status-option>span:nth-child(2)').allInnerTexts(), esperado, `“${item}”: opções da ação`);
      assert.equal(await acao.locator('.status-option .status-icon').count() >= esperado.length, true, `“${item}”: cada status tem ícone`);
      assert.equal(await acao.locator('.status-options [data-status-details]').count(), 0, 'Editar detalhes não é opção do listbox');
      assert.equal(await acao.locator('.status-divider + [data-status-details]').count(), 1, 'Editar detalhes fica depois do divisor');
    }

    // 3a. Acessibilidade e teclado do popover.
    const acessivel = controle(CARACTERIZACAO), gatilho = acessivel.locator('[data-status-toggle]');
    assert.equal(await gatilho.getAttribute('aria-expanded'), 'false');
    await gatilho.focus();
    await page.keyboard.press('Enter');
    assert.equal(await gatilho.getAttribute('aria-expanded'), 'true', 'Enter abre o menu');
    assert.equal(await acessivel.locator('[role="listbox"]').isVisible(), true);
    assert.equal(await acessivel.locator('[role="option"][aria-selected="true"]').count(), 1, 'Status atual marcado por aria-selected');
    const dimensoes = await acessivel.evaluate(root => ({ trigger: root.querySelector('[data-status-toggle]').getBoundingClientRect().width, menu: root.querySelector('[data-status-popover]').getBoundingClientRect().width }));
    assert.ok(dimensoes.menu >= dimensoes.trigger, 'Popover não pode ser mais estreito que o pill');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    assert.equal(await gatilho.getAttribute('aria-expanded'), 'false', 'Escape fecha o menu');
    assert.equal(await gatilho.evaluate(el => el === document.activeElement), true, 'Escape devolve o foco ao pill');
    await page.keyboard.press('Space');
    assert.equal(await gatilho.getAttribute('aria-expanded'), 'true', 'Space abre o menu');
    await page.locator('#tab-content h2').click();
    assert.equal(await gatilho.getAttribute('aria-expanded'), 'false', 'Clique externo fecha o menu');

    // 3b2. Adesão ao Fala.BR: análise direta simplificada (sem modal).
    const listaFalaBR = controle(FALA_BR);
    await escolher(listaFalaBR,'ok');
    await page.waitForTimeout(200);
    assert.equal(memory.proposals[0].reviews.merito.falaBRAdesao.status, 'ok');
    assert.equal(await linha(FALA_BR).locator('td').nth(1).innerText(), 'Já aderiu');
    assert.match(await listaFalaBR.locator('[data-status-toggle]').getAttribute('class'), /tom-ok/, '“Já aderiu” fica verde');
    await escolher(listaFalaBR,'obs');
    await page.waitForTimeout(200);
    assert.equal(memory.proposals[0].reviews.merito.falaBRAdesao.status, 'obs', 'A escolha grava diretamente Previsto');
    assert.equal(await linha(FALA_BR).locator('td').nth(1).innerText(), 'Previsto no Plano de Trabalho');
    assert.match(await controle(FALA_BR).locator('[data-status-toggle]').getAttribute('class'), /tom-ok/, '“Previsto no Plano de Trabalho” também fica verde');
    await escolher(controle(FALA_BR),'no');
    await page.waitForTimeout(200);
    assert.equal(memory.proposals[0].reviews.merito.falaBRAdesao.status, 'no', 'Sem previsão grava diretamente');
    assert.equal(await linha(FALA_BR).locator('td').nth(1).innerText(), 'Sem previsão');
    assert.match(await controle(FALA_BR).locator('[data-status-toggle]').getAttribute('class'), /tom-aviso/, '“Sem previsão” fica em amarelo');
    assert.deepEqual(D.semJustificativa(memory.proposals[0]), [], 'Sem previsão não vira pendência de justificativa');

    // 3b. Instituição da Ouvidoria: análise direta simplificada (sem modal), ausência é situação prevista, com cláusula suspensiva.
    const itemOuvidoria = OUVIDORIA;
    await escolher(controle(itemOuvidoria),'no');
    await page.waitForTimeout(200);
    assert.equal(memory.proposals[0].reviews.merito.ouvidoriaInstituida.status, 'no', 'Ausente grava diretamente no estado');
    const textoOuvidoria = await linha(itemOuvidoria).innerText();
    assert.match(textoOuvidoria, /cláusula suspensiva do Convênio/i, 'Ausente gera o alerta de cláusula suspensiva');
    assert.equal(await linha(itemOuvidoria).locator('td').nth(1).innerText(), 'Ausente', 'O resultado acompanha a palavra Ausente');
    /* A lista de decisão precisa ficar amarela (aviso), não vermelha: a ausência
       é situação prevista no edital, não uma não conformidade. */
    const listaOuvidoria = controle(itemOuvidoria).locator('[data-status-toggle]');
    assert.match(await listaOuvidoria.getAttribute('class'), /tom-aviso/, '“Ausente” usa o tom de aviso');
    assert.doesNotMatch(await listaOuvidoria.getAttribute('class'), /tom-no/, '“Ausente” não usa o tom vermelho');
    const cores = await listaOuvidoria.evaluate(el => { const c = getComputedStyle(el); return { texto: c.color, fundo: c.backgroundColor }; });
    assert.deepEqual(cores, { texto: 'rgb(128, 81, 23)', fundo: 'rgb(255, 244, 220)' }, 'Cores efetivas do amarelo institucional');
    assert.deepEqual(D.semJustificativa(memory.proposals[0]), [], 'Ausência prevista no edital não vira pendência de justificativa');
    assert.ok(!D.blockers(memory.proposals[0]).some(x => /sem justificativa/.test(x)), 'A conclusão não fica bloqueada por essa ausência');
    await escolher(controle(itemOuvidoria),'ok');
    await page.waitForTimeout(200);
    assert.doesNotMatch(await linha(itemOuvidoria).innerText(), /cláusula suspensiva/i, 'Conformidade não mostra o alerta');

    // 4. Marcar conformidade grava direto, sem janela.
    const gravacoesAntes = posts.length;
    await escolher(controle(OBJETO),'ok');
    await page.waitForTimeout(200);
    assert.equal(await modal.isVisible(), false, 'Marcar não abre janela');
    assert.equal(posts.length, gravacoesAntes + 1, 'Marca com um POST');
    assert.equal(memory.proposals[0].reviews.merito.objeto.status, 'ok');
    assert.equal(await linha(OBJETO).locator('td').nth(1).innerText(), 'Atende', 'Resultado passa a Atende');
    assert.match(await controle(OBJETO).locator('[data-status-toggle]').getAttribute('class'), /tom-ok/, 'O pill fica verde');
    assert.ok((await linha(CARACTERIZACAO).innerText()).includes('Integração de esforços'), 'O texto oficial continua na tela depois de marcar');

    // 5. Resultado negativo abre o formulário e só grava depois da justificativa.
    const gravacoesAntesDaNegativa = posts.length;
    await escolher(controle(RESULTADOS),'no');
    await modal.waitFor();
    assert.equal(await modal.locator('select[name="status"]').inputValue(), 'no', 'O formulário herda Não atende');
    assert.equal(posts.length, gravacoesAntesDaNegativa, 'A escolha negativa não grava antes do formulário');
    await modal.locator('textarea[name="note"]').fill('Resultado esperado insuficientemente demonstrado.');
    await modal.getByRole('button', { name: 'Salvar', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.equal(memory.proposals[0].reviews.merito.resultados.status, 'no');
    assert.equal(await linha(RESULTADOS).locator('td').nth(1).innerText(), 'Não atende');
    assert.equal(posts.length, gravacoesAntesDaNegativa + 1, 'Salvar o formulário faz uma gravação');
    assert.match(await controle(RESULTADOS).locator('[data-status-toggle]').getAttribute('class'), /tom-no/, 'O pill negativo fica vermelho');

    // 6. O detalhe permite voltar a Não analisado sem apagar os demais campos.
    await editarDetalhes(controle(OBJETO));
    await modal.waitFor();
    await modal.locator('select[name="status"]').selectOption('na');
    await modal.getByRole('button', { name: 'Salvar', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.equal(memory.proposals[0].reviews.merito.objeto.status, 'na');
    assert.equal(await linha(OBJETO).locator('td').nth(1).innerText(), 'Não analisado');
    assert.equal(memory.proposals[0].reviews.merito.objeto.note, '', 'Voltar atrás não inventa observação');

    // 7. O detalhe continua acessível pelo nome do item (observação, documento, diligência).
    await linha(CARACTERIZACAO).locator('button.review-open').click();
    await modal.waitFor();
    const detalhe = await modal.innerText();
    assert.match(detalhe, /Analisar requisito/);
    assert.match(detalhe, /Observação \/ justificativa/);
    assert.equal(await modal.locator('select[name="status"]').count(), 1, 'O detalhe mantém o resultado completo');
    assert.equal(await modal.locator('textarea[name="note"]').count(), 1, 'O detalhe é onde se escreve a justificativa');
    assert.equal(await modal.locator('#review-diligence').count(), 1, 'O detalhe mantém o vínculo de diligência');
    assert.equal(await modal.locator('#review-diligence').isVisible(), false, 'Diligência só aparece quando o resultado é Em diligência');
    await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });

    // 8. O mesmo fluxo vale no PAD: Compatível grava; outra escolha abre o formulário.
    await page.getByRole('link', { name: 'Plano de Aplicação Detalhado', exact: true }).click();
    const acaoPad = page.locator('tr[data-pad-item="11"] [data-status-dropdown]');
    await acaoPad.waitFor();
    assert.deepEqual(await acaoPad.locator('.status-option>span:nth-child(2)').allInnerTexts(), ['Analisar', 'Compatível', 'Compatível com observação', 'Em diligência', 'Não compatível']);
    const postsAntesPad = posts.length;
    await escolher(acaoPad,'ok');
    await page.waitForTimeout(200);
    assert.equal(memory.proposals[0].reviews.pad['11'].status, 'ok', 'Compatível grava em um clique');
    assert.equal(posts.length, postsAntesPad + 1, 'Compatível faz um POST');
    assert.match(await acaoPad.locator('[data-status-toggle]').getAttribute('class'), /tom-ok/, 'Compatível deixa o pill verde');
    await escolher(acaoPad,'no');
    await modal.waitFor();
    assert.equal(await modal.locator('select[name="status"]').inputValue(), 'no', 'Não compatível abre o formulário no resultado escolhido');
    assert.equal(memory.proposals[0].reviews.pad['11'].status, 'ok', 'Cancelar pode preservar o aceite anterior');
    await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });

    // 9. As duas telas de requisitos usam Atende imediato e formulário nos demais casos.
    for (const [aba, resultado] of [['Requisitos da Proposta', 'obs'], ['Requisitos para Formalização', 'no']]) {
      await page.getByRole('link', { name: aba, exact: true }).click();
      await page.locator('#tab-content h2').filter({ hasText: aba }).waitFor();
      const acao = page.locator('.req-table tbody tr').first().locator('[data-status-dropdown]');
      assert.deepEqual((await acao.locator('.status-option>span:nth-child(2)').allInnerTexts()).slice(0, 5), ['Analisar', 'Atende', 'Atendido com observação', 'Em diligência', 'Não atende'], `${aba}: opções corretas`);
      const itemId = D.rows(memory.proposals[0], aba === 'Requisitos da Proposta' ? 'proposta' : 'formalizacao')[0][0];
      await escolher(acao,'ok');
      await page.waitForTimeout(200);
      assert.equal(D.reviewOf(memory.proposals[0], aba === 'Requisitos da Proposta' ? 'proposta' : 'formalizacao', itemId).status, 'ok', `${aba}: Atende grava direto`);
      assert.match(await acao.locator('[data-status-toggle]').getAttribute('class'), /tom-ok/, `${aba}: Atende fica verde`);
      await escolher(acao,resultado);
      await modal.waitFor();
      assert.equal(await modal.locator('select[name="status"]').inputValue(), resultado, `${aba}: outro resultado abre o formulário predefinido`);
      await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await modal.waitFor({ state: 'hidden' });
    }

    // 10. Avaliação antiga da Habilitação continua no banco e é ignorada pela tela.
    assert.equal(memory.proposals[0].reviews.habilitacao.identificacao.status, 'ok');
    assert.equal(D.groupProgress(memory.proposals[0], 'habilitacao').total, 0);
    assert.ok(!D.blockers(memory.proposals[0]).some(x => /Habilita/i.test(x)));
    D.validateState(memory);

    // 11. Rota antiga não quebra; painel segue sem a coluna de Habilitação.
    await page.goto(`${URL}#proposta/${PROPOSAL_ID}/habilitacao`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Dados da proposta', exact: true }).waitFor();
    await page.goto(`${URL}#painel`, { waitUntil: 'domcontentloaded' });
    await page.locator('table tbody tr').first().waitFor();
    const cabecalhosDoPainel = await page.locator('table thead th').allInnerTexts();
    assert.ok(!cabecalhosDoPainel.some(x => /Habilita/i.test(x)), 'Painel sem coluna de Habilitação');
    assert.ok(posts.length >= 2, 'As marcações foram gravadas');

    assert.deepEqual(blocked, [], 'A UI acessou apenas rotas previstas');
    assert.deepEqual(pageErrors, [], 'Nenhum pageerror é aceitável');

    console.log(JSON.stringify({
      status: 'passed', isolated: true, realDatabaseWrites: 0, pageerrors: pageErrors.length,
      itens, secoes, abas, postsDeGravacao: posts.length,
      statusFinais: Object.fromEntries(Object.entries(memory.proposals[0].reviews.merito).map(([k, v]) => [k, v.status]))
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
