/**
 * Testes automatizados da seleção de tópicos e exportação XLSX no Relatório de Análise (PROFOR 2026).
 * Valida as APIs ProforReport.html, ProforReport.xlsx e a interação na interface com Playwright.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const playwrightPath = process.env.PROFOR_PLAYWRIGHT_PATH ||
  (fs.existsSync('C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright')
    ? 'C:/Users/marcelo.cortez/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright'
    : 'C:/Users/marcelo.cortez/AppData/Local/Programs/nodejs/node-v24.15.0-win-x64/node_modules/playwright');
const { chromium } = require(playwrightPath);
const {fulfillStatic}=require('./ui-static.cjs');
const {syntheticProposal,syntheticState}=require('./fixtures/state.cjs');
const os=require('node:os');

const ROOT_DIR = path.resolve(__dirname, '..');
global.globalThis = global;
global.window = global;

const D = require(path.join(ROOT_DIR, 'domain.js'));
global.Profor = D;
const ProforReport = require(path.join(ROOT_DIR, 'report.js'));

// Lê o arquivo ZIP/XLSX efetivamente gerado, sem substituir o exportador por
// uma segunda implementação. Todos os dados e arquivos são sintéticos.
function workbook(p,topics,name='fixture') {
  const dir=process.env.PROFOR_REPORT_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(),'profor-report-'));
  fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,`${name}.xlsx`);
  fs.writeFileSync(file,Buffer.from(ProforReport.xlsx(p,topics===undefined?{}:{topics})));
  try {
    const script=`import json,openpyxl,sys\nw=openpyxl.load_workbook(sys.argv[1])\nprint(json.dumps({s.title:{'rows':list(s.values),'types':[[c.data_type for c in r] for r in s]} for s in w},ensure_ascii=True))`;
    return JSON.parse(execFileSync(process.env.PROFOR_PYTHON || 'python',['-c',script,file],{encoding:'utf8'}));
  } finally {if(!process.env.PROFOR_REPORT_OUTPUT)fs.rmSync(dir,{recursive:true,force:true});}
}
function records(sheet) {const [headers,...rows]=sheet.rows;return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));}
function extraction(status,at,source,extra={}) {return {version:1,status,at,source,received:3,accepted:3,rejected:0,reasons:[],...extra};}
function reportFixture() {
  const initial=syntheticProposal(),items=['11','12','13'].map((id,index)=>({...initial.imported.pad[0],id,descricao:`Item ${index+1}`}));
  const p=D.createProposal({...initial.imported,pad:items,padExtraction:extraction('complete','2026-09-10T10:00:00Z','origem íntegra sintética')});
  D.setTextos(p,{capacidade:'Capacidade sintética',caracterizacao:'Caracterização sintética'},'Fixture');
  const refs={pad:items.map(i=>i.id),merito:['objeto','justificativa','publicoAlvo'],celebracao:D.CELEBRACAO.filter(i=>i.aba==='proposta').slice(0,3).map(i=>i.id)};
  for(const [g,ids] of Object.entries(refs)) {
    for(const id of ids)D.setReview(p,g,id,{status:'ok',note:`Nota ${g}:${id}`,document:`Documento ${id}`,url:'',attachments:[]},'Revisor sintético');
    delete p.reviews[g][ids[1]].evidence;
    p.reviews[g][ids[2]].evidence.fingerprint='fnv64-v1:0000000000000000';
  }
  return {p,refs};
}

test('XLSX: cada decisão positiva preserva validade própria em exportação integral e tópicos isolados',()=>{
  const {p,refs}=reportFixture();
  const specs=[['pad','PAD','pad'],['merito','Merito','merito'],['proposta','Requisitos','celebracao']];
  for(const topics of [undefined,...specs.map(([topic])=>[topic])]) {
    const wb=workbook(p,topics,`validade-${topics?.[0]||'integral'}`);
    assert.deepEqual(wb.Base_Dados.rows[0].slice(0,14),['proposta','uf','processo_sei','topico_id','topico_nome','item','descricao_conteudo','quantidade','valor_unitario','valor_total','status_analise','observacao_analista','fundamentacao','documentos_anexos']);
    for(const [topic,sheet,g] of specs.filter(([topic])=>!topics||topics.includes(topic))) {
      const rows=records(wb[sheet]);
      for(const [index,id] of refs[g].entries()) {
        const expected=index===0?'Atual verificável':index===1?'Legada sem referência verificável':'Desatualizada; reanálise necessária';
        assert.equal(rows[index].validade_avaliacao,expected,`${sheet} ${id}: status positivo precisa de validade explícita`);
        assert.equal(rows[index].status_analise,D.STATUSES.ok);
        assert.equal(rows[index].autor_avaliacao,'Revisor sintético');
        assert.ok(rows[index].data_avaliacao);
        assert.equal(rows[index].observacao,`Nota ${g}:${id}`);
        const base=records(wb.Base_Dados).filter(r=>r.topico_id===topic)[index];
        assert.equal(base.validade_avaliacao,expected);
        if(index>0)assert.ok(base.motivo_validade);
      }
      if(sheet==='PAD') {
        assert.equal(rows[0].quantidade,2.5);assert.equal(rows[0].valor_unitario,40.4);assert.equal(rows[0].valor_total,101);
        assert.equal(wb.PAD.types[1][2],'n');assert.equal(wb.PAD.types[1][3],'n');
      }
    }
  }
});

test('XLSX: PAD preservado, candidato rejeitado e referência íntegra mantêm origem e data distintas',()=>{
  const {p}=reportFixture(),partial=extraction('partial','2026-09-20T12:00:00Z','tentativa incompleta sintética',{received:2,accepted:1,rejected:1,reasons:[{line:2,itemId:'88',reason:'Quantidade inválida sintética'}]});
  const state={...D.initialState(),proposals:[p]};
  const incoming={...D.clone(p.imported),pad:[{...p.imported.pad[0],id:'77',descricao:'CANDIDATO NÃO VIGENTE'}],padExtraction:partial};
  const preserved=D.syncProposals(state,[incoming],'simulação isolada').state.proposals[0];
  for(const topics of [undefined,...ProforReport.availableTopics(preserved).map(t=>[t.id])]) {
    const wb=workbook(preserved,topics,`preservado-${topics?.[0]||'integral'}`),base=records(wb.Base_Dados);
    assert.ok(base.every(r=>r.pad_estado_extracao==='Importação incompleta do PAD'));
    assert.ok(base.every(r=>/Último PAD íntegro preservado/.test(r.pad_referencia_itens)));
    assert.ok(base.every(r=>r.pad_origem_referencia==='origem íntegra sintética'));
    assert.ok(base.every(r=>r.pad_data_referencia==='2026-09-10T10:00:00Z'));
    assert.ok(base.every(r=>r.pad_origem_tentativa==='tentativa incompleta sintética'&&r.pad_data_tentativa==='2026-09-20T12:00:00Z'));
    assert.ok(base.every(r=>r.pad_itens_rejeitados===1&&r.pad_candidatos_nao_vigentes===1));
    assert.ok(base.every(r=>r.pad_motivos_rejeicao.includes('Quantidade inválida sintética')));
    if(wb.PAD) {
      assert.equal(records(wb.PAD).length,3);assert.ok(records(wb.PAD).every(r=>r.descricao!=='CANDIDATO NÃO VIGENTE'));
      assert.ok(records(wb.PAD).every(r=>r.pad_origem_referencia==='origem íntegra sintética'));
    }
  }
  const noReference=D.createProposal({...D.clone(incoming),id:'990901'});
  const wbEmpty=workbook(noReference,['pad'],'incompleto-sem-referencia');
  assert.ok(wbEmpty.PAD,'Apenas PAD incompleto sem itens precisa de aba interpretável');
  assert.match(records(wbEmpty.PAD)[0].pad_referencia_itens,/Não há PAD íntegro anterior/);
  assert.equal(records(wbEmpty.PAD)[0].pad_origem_referencia,'Não informado');
  assert.equal(records(wbEmpty.PAD)[0].pad_data_referencia,'Não verificável');
  const recovered=D.syncProposals({...D.initialState(),proposals:[preserved]},[{...D.clone(p.imported),padExtraction:extraction('complete','2026-09-25T10:00:00Z','recuperação íntegra sintética')}],'simulação isolada').state.proposals[0];
  const wbRecovered=workbook(recovered,['pad'],'pad-recuperado');
  assert.ok(records(wbRecovered.PAD).every(r=>r.pad_origem_referencia==='recuperação íntegra sintética'&&r.pad_data_referencia==='2026-09-25T10:00:00Z'));
  assert.ok(records(wbRecovered.PAD).every(r=>r.pad_candidatos_nao_vigentes===0));
});

test('Relatórios: ficha institucional completa preserva dados legados, notas e URLs inertes',()=>{
  const p=syntheticProposal();p.history=[];
  p.ouvidoria={status:'pendente',signature:'2026-09-01',url:'https://exemplo.invalid/ato?x=1&y=2',note:'Nota institucional '+('texto longo '.repeat(35)),clause:true,referenciaAto:'Ato sintético 45/2026',clauseNote:'Condição registrada sintética'};p.falaBR='previsto';
  p.reviews.merito.ouvidoriaInstituida.note='Nota da avaliação distinta';
  const before=JSON.stringify(p),html=ProforReport.html(p,{topics:['ouvidoria']}),wb=workbook(p,['ouvidoria'],'institucional-legado');
  const rows=records(wb.Base_Dados);
  for(const raw of ['2026-09-01',p.ouvidoria.url,p.ouvidoria.note,p.ouvidoria.referenciaAto,p.ouvidoria.clauseNote])assert.ok(rows.some(r=>r.descricao_conteudo===raw),`Campo institucional ausente: ${raw.slice(0,60)}`);
  assert.match(html,/Ato sintético 45\/2026/);assert.match(html,/Condição registrada sintética/);assert.match(html,/Nota institucional/);assert.match(html,/https:\/\/exemplo\.invalid\/ato\?x=1&amp;y=2/);
  assert.match(html,/Prazo de referência \(nove meses\)/);assert.match(html,/Ato normativo registrado/);assert.match(html,/Cláusula suspensiva aplicável confirmada/);
  assert.ok(rows.some(r=>/Fala\.BR/.test(r.item)&&/previst/i.test(r.descricao_conteudo)));
  for(const topics of [undefined,['ouvidoria']]) {
    const rows=records(workbook(p,topics,`institucional-${topics?'isolado':'integral'}`).Base_Dados);
    for(const field of D.institutionalFields(p))assert.ok(rows.some(r=>r.item===field.label&&r.descricao_conteudo===field.value),`Ficha compartilhada: ${field.key}`);
  }
  assert.equal(JSON.stringify(p),before,'Consulta e exportação não gravam na proposta');
  p.ouvidoria.url='javascript:alert(1)';p.ouvidoria.note='<script>alert(2)</script>';
  const unsafe=ProforReport.html(p,{topics:['ouvidoria']});
  assert.doesNotMatch(unsafe,/<script>|href="javascript:/);assert.match(unsafe,/javascript:alert\(1\)/);assert.match(unsafe,/&lt;script&gt;alert\(2\)&lt;\/script&gt;/);assert.match(unsafe,/URL inválida|Protocolo não permitido/);
  const unsafeRows=records(workbook(p,['ouvidoria'],'institucional-url-invalida').Base_Dados);
  assert.ok(unsafeRows.some(r=>r.descricao_conteudo==='javascript:alert(1)'));assert.ok(unsafeRows.some(r=>/URL inválida/.test(r.descricao_conteudo)));
  const missing=syntheticProposal(),missingRows=records(workbook(missing,['ouvidoria'],'institucional-ausente').Base_Dados);
  assert.match(ProforReport.html(missing,{topics:['ouvidoria']}),/Ato normativo registrado<\/th><td>Não informado<\/td>/);
  for(const field of D.institutionalFields(missing))assert.ok(missingRows.some(r=>r.item===field.label&&r.descricao_conteudo===field.value));
  // Uma decisão com impressão compatível também depende do fato institucional;
  // não basta exportar obs como atendimento quando falta instituição/cláusula.
  const conflict=syntheticProposal(),review=conflict.reviews.merito.ouvidoriaInstituida;
  Object.assign(review,{status:'obs',note:'Observação legada preservada',actor:'Autor legado',at:'2026-09-01T10:00:00Z'});review.evidence=D.evidenceOf(conflict,'merito','ouvidoriaInstituida');
  const conflictRows=records(workbook(conflict,['ouvidoria'],'institucional-conflito').Base_Dados),decision=conflictRows.find(r=>r.item==='Avaliação da Ouvidoria');
  assert.equal(decision.status_analise,D.rotuloDoResultado('ouvidoriaInstituida','obs'));
  assert.equal(decision.validade_avaliacao,'Conflito institucional; resolução necessária');assert.equal(decision.observacao_analista,'Observação legada preservada');
  assert.match(ProforReport.html(conflict,{topics:['ouvidoria']}),/Conflito institucional; resolução necessária/);
});

test('Relatórios: conclusão histórica incompatível exige reanálise para ambos os resultados',()=>{
  for(const result of ['favoravel','desfavoravel']) {
    const p=syntheticProposal();p.conclusion={result,actor:'Autor preservado',at:'2026-09-01T10:00:00Z',reference:'Referência histórica',note:'Justificativa preservada',evidence:{version:1,fingerprint:'fnv64-v1:0000000000000000'}};
    const html=ProforReport.html(p,{topics:['situacao']}),wb=workbook(p,['situacao'],`conclusao-${result}`),rows=records(wb.Base_Dados);
    assert.match(html,/Desatualizada; reanálise necessária/);assert.match(html,/Autor preservado/);assert.match(html,/Justificativa preservada/);
    const row=rows.find(r=>r.item==='Conclusão técnica');assert.equal(row.descricao_conteudo,result);assert.equal(row.validade_avaliacao,'Desatualizada; reanálise necessária');assert.equal(row.autor_avaliacao,'Autor preservado');
  }
});

test('ProforReport: filtragem de tópicos e renumeração sequencial HTML', async () => {
  const p=syntheticProposal();
  assert.ok(p, 'Proposta do RS encontrada');

  const available = ProforReport.availableTopics(p);
  assert.ok(available.length >= 7, 'Pelo menos 7 tópicos disponíveis');
  assert.ok(available.some(t => t.id === 'pad'), 'Tópico PAD disponível');
  assert.ok(available.some(t => t.id === 'identificacao'), 'Tópico Identificação disponível');

  // Caso 1: Sem opções (padrão)
  const fullHtml = ProforReport.html(p);
  assert.match(fullHtml, /1\.\s+Identificação da proposta/);
  assert.match(fullHtml, /2\.\s+Valores/);
  assert.match(fullHtml, /Plano de aplicação detalhado/);
  assert.doesNotMatch(fullHtml, /Relatório de análise da proposta/);
  assert.doesNotMatch(fullHtml, /Documento auxiliar gerado a partir dos dados/);

  // Caso 2: Apenas PAD
  const padOnlyHtml = ProforReport.html(p, { topics: ['pad'] });
  assert.match(padOnlyHtml, /1\.\s+Plano de aplicação detalhado/);
  assert.doesNotMatch(padOnlyHtml, /Identificação da proposta/);
  assert.doesNotMatch(padOnlyHtml, /Valores<\/h2>/);
  assert.doesNotMatch(padOnlyHtml, /Avaliação de mérito<\/h2>/);

  // Caso 3: Seleção arbitrária (Valores e Situação final)
  const customHtml = ProforReport.html(p, { topics: ['valores', 'situacao'] });
  assert.match(customHtml, /1\.\s+Valores/);
  assert.match(customHtml, /2\.\s+Situação final da análise/);
  assert.doesNotMatch(customHtml, /Identificação da proposta/);
  assert.doesNotMatch(customHtml, /Plano de aplicação detalhado/);

  // Caso 4: Nenhum tópico selecionado
  const emptyHtml = ProforReport.html(p, { topics: [] });
  assert.match(emptyHtml, /Nenhum tópico selecionado para o relatório/);
  assert.doesNotMatch(emptyHtml, /<section class="pr-section">/);
});

test('ProforReport: exportação XLSX estruturada como banco de dados para IAs', async () => {
  const p=syntheticProposal();
  assert.ok(p, 'Proposta do RS encontrada');

  // Caso 1: XLSX completo com todos os tópicos
  const fullBytes = ProforReport.xlsx(p);
  assert.ok(fullBytes instanceof Uint8Array, 'Deve retornar um Uint8Array');
  assert.ok(fullBytes.length > 3000, 'Arquivo gerado deve conter bytes válidos de ZIP/XLSX');

  const tmpFull = path.join(os.tmpdir(), `profor-full-${process.pid}.xlsx`);
  fs.writeFileSync(tmpFull, Buffer.from(fullBytes));

  // Validação estrita via Python openpyxl (o mesmo motor usado por Pandas/IAs)
  const pyCheckFull = `
import openpyxl
wb = openpyxl.load_workbook(r'${tmpFull}')
assert 'Base_Dados' in wb.sheetnames, 'Aba Base_Dados obrigatória'
assert 'PAD' in wb.sheetnames, 'Aba PAD especializada presente'
ws = wb['Base_Dados']
rows = list(ws.iter_rows(values_only=True))
assert len(rows) > 10, 'Base_Dados deve conter dezenas de linhas'
headers = rows[0]
assert 'proposta' in headers and 'uf' in headers and 'topico_nome' in headers, 'Cabeçalhos relacionais presentes'
ws_pad = wb['PAD']
pad_rows = list(ws_pad.iter_rows(values_only=True))
assert len(pad_rows) > 1, 'Aba PAD deve conter itens'
assert isinstance(pad_rows[1][2], (int, float)), 'Quantidade deve ser numérica'
assert isinstance(pad_rows[1][3], (int, float)), 'Valor unitário deve ser numérico'
assert pad_rows[1][2] == 2.5, 'Quantidade fracionária preservada'
assert pad_rows[1][3] == 40.4, 'Centavos convertidos para reais no unitário'
assert pad_rows[1][4] == 101, 'Centavos convertidos para reais no total'
print('FULL_OK')
`;
  const fullOut = execFileSync(process.env.PROFOR_PYTHON || 'python', [], { input: pyCheckFull, encoding: 'utf-8' });
  assert.match(fullOut, /FULL_OK/);
  fs.unlinkSync(tmpFull);

  // Caso 2: XLSX com "Apenas PAD"
  const padBytes = ProforReport.xlsx(p, { topics: ['pad'] });
  const tmpPad = path.join(os.tmpdir(), `profor-pad-${process.pid}.xlsx`);
  fs.writeFileSync(tmpPad, Buffer.from(padBytes));

  const pyCheckPad = `
import openpyxl
wb = openpyxl.load_workbook(r'${tmpPad}')
assert 'Base_Dados' in wb.sheetnames
assert 'PAD' in wb.sheetnames
assert 'Merito' not in wb.sheetnames, 'Mérito não deve estar presente'
assert 'Requisitos' not in wb.sheetnames, 'Requisitos não deve estar presente'
ws = wb['Base_Dados']
for r in list(ws.iter_rows(values_only=True))[1:]:
    assert r[3] == 'pad', f'Todos os tópicos em Base_Dados devem ser pad, veio: {r[3]}'
print('PAD_ONLY_OK')
`;
  const padOut = execFileSync(process.env.PROFOR_PYTHON || 'python', [], { input: pyCheckPad, encoding: 'utf-8' });
  assert.match(padOut, /PAD_ONLY_OK/);
  fs.unlinkSync(tmpPad);
});

test('UI: Modal de relatório com botão Salvar XLSX, atalhos e download', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const docsRoot=path.resolve(ROOT_DIR,'..','..','docs');
  await context.route('**/*',route=>{
    const url=new URL(route.request().url()),name=path.basename(url.pathname);
    if(name==='dados_publicos.js')return route.fulfill({contentType:'text/javascript',body:`window.PROFOR_PUBLIC_DATA=${JSON.stringify(syntheticState())};`});
    if(['domain.js','sync-apply.js','bandeiras-uf.js','styles.css','report.js','app.js'].includes(name))return fulfillStatic(route,ROOT_DIR);
    return fulfillStatic(route,docsRoot);
  });
  await page.goto('http://127.0.0.1:9880/index.html', { waitUntil: 'domcontentloaded' });

  // Abre detalhes da proposta RS
  await page.waitForSelector('tr.uf-row');
  const firstRow = page.locator('tr.uf-row').first();
  await firstRow.click();
  await page.waitForSelector('.btn-detail');
  await page.locator('.btn-detail').first().click();

  // Aguarda tela da proposta carregar e clica em "Gerar relatório"
  await page.waitForSelector('button[data-action="report"]');
  await page.click('button[data-action="report"]');

  // Valida que o modal abriu com a barra de filtros
  await page.waitForSelector('.report-filter-bar');
  const checkboxes = page.locator('#report-topics-list input[type="checkbox"]');
  const totalCheckboxes = await checkboxes.count();
  assert.ok(totalCheckboxes >= 7, 'Existem checkboxes de tópicos suficientes');

  // Botão "Salvar XLSX" presente e habilitado
  const xlsxBtn = page.locator('button[data-action="save-xlsx"]');
  assert.ok(await xlsxBtn.isVisible(), 'Botão Salvar XLSX deve estar visível');
  assert.equal(await xlsxBtn.isDisabled(), false, 'Botão Salvar XLSX deve estar habilitado inicialmente');

  // Testa download do XLSX
  const downloadPromise = page.waitForEvent('download');
  await xlsxBtn.click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /PROFOR_RELATORIO_.*\.xlsx$/);

  // Testa atalho "Apenas PAD"
  await page.click('[data-action="report-select-pad"]');
  const padChecked = await page.locator('#report-topics-list input[value="pad"]').isChecked();
  assert.equal(padChecked, true, 'PAD deve continuar marcado');
  assert.equal(await xlsxBtn.isDisabled(), false, 'Salvar XLSX deve permanecer habilitado');

  // Testa atalho "Nenhum"
  await page.click('[data-action="report-select-none"]');
  assert.equal(await xlsxBtn.isDisabled(), true, 'Botão Salvar XLSX deve desabilitar sem seleção');

  // Marca individualmente "Valores"
  await page.locator('#report-topics-list input[value="valores"]').check();
  assert.equal(await xlsxBtn.isDisabled(), false, 'Botão Salvar XLSX deve reabilitar com 1 tópico');

  // Testa atalho "Todos"
  await page.click('[data-action="report-select-all"]');
  assert.equal(await xlsxBtn.isDisabled(), false);

  await browser.close();
});

test('UI HTTP isolada: Botão Salvar XLSX funciona sem servidor real', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname==='/api/state')return route.fulfill({json:{exists:true,state:syntheticState(),token:'fixture',recovery:null}});if(url.pathname.startsWith('/api/'))return route.abort();return fulfillStatic(route);});
  await page.goto('http://127.0.0.1:9879/PROFOR_2026.html');
  await page.waitForSelector('tr.uf-row');
  await page.locator('tr.uf-row').first().click();
  await page.waitForSelector('.btn-detail');
  await page.locator('.btn-detail').first().click();

  await page.waitForSelector('button[data-action="report"]');
  await page.click('button[data-action="report"]');

  await page.waitForSelector('.report-filter-bar');
  const xlsxBtn = page.locator('button[data-action="save-xlsx"]');
  assert.ok(await xlsxBtn.isVisible(), 'Botão Salvar XLSX deve estar visível no servidor local');

  // Testa download do XLSX no servidor local
  const downloadPromise = page.waitForEvent('download');
  await xlsxBtn.click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /\.xlsx$/);

  await browser.close();
});
