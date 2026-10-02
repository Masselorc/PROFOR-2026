'use strict';
const {fulfillStatic}=require('./ui-static.cjs');

/*
 * Teste de integração ISOLADO da sincronização conjunta dos textos oficiais da proposta.
 *   node "Sistema PROFOR 2026/PROFOR_2026/tests/textos-oficiais.cjs"
 *
 * Não inicia servidor, não baixa nada da origem, não usa perfil persistente e não
 * lê/grava dados/registros. /api/state e /api/sync são atendidos em memória.
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
  '/PROFOR_2026.html', '/styles.css', '/domain.js', '/sync-apply.js', '/bandeiras-uf.js',
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

/* O HEAD usa Atualizar Dados com propostas/PAD/textos em uma transação;
 * o antigo botão "Buscar textos" foi removido antes desta manutenção. */
async function scenario(browser,name,payload,run,prepare=()=>{}) {
 const context=await browser.newContext({serviceWorkers:'block',locale:'pt-BR',timezoneId:'America/Sao_Paulo',viewport:{width:1366,height:768}});
 let memory=fixture();prepare(memory);let token=hash(memory);const posts=[],blocked=[];
 const control={failure:0};
 await context.route('**/*',async route=>{
  const req=route.request(),url=new globalThis.URL(req.url());
  if(url.origin!==ORIGIN){blocked.push(req.url());return route.abort();}
  if(url.pathname==='/api/state'){
   if(req.method()==='GET')return route.fulfill({json:{exists:true,state:clone(memory),token,recovery:null}});
   const body=req.postDataJSON();assert.equal(body.expected,memory.revision);assert.equal(body.token,token);D.validateState(body.state);posts.push(clone(body));memory=clone(body.state);memory.revision++;token=hash(memory);return route.fulfill({json:{state:clone(memory),token,exists:true}});
  }
  if(url.pathname==='/api/sync/history')return route.fulfill({json:{entries:[]}});
  if(url.pathname==='/api/sync'){
   if(control.failure)return route.fulfill({status:502,json:{error:'Falha de extração simulada'}});
   if(payload===null)return new Promise(()=>{});
   return route.fulfill({json:{proposals:memory.proposals.map(p=>p.imported),textos:payload.textos,textosFaltando:payload.faltando,unchanged:true,source:{url:'fixture',files:[]},stats:{proposals:2,padItems:2,durationMs:100},warnings:[]}});
  }
  return fulfillStatic(route);
 });
 const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));page.setDefaultTimeout(10000);
 await page.goto(URL);await page.locator('[data-action="sync"]').waitFor();
 const start=async()=>{await page.locator('[data-action="sync"]').first().click();await page.locator('[data-action="sync-start"]').click();};
 const complete=async()=>{await page.waitForFunction(()=>document.querySelector('#sync-percent')?.textContent==='100%');return page.locator('#sync-summary').innerText();};
 try{await run({page,start,complete,posts,memory:()=>memory,control});assert.deepEqual(blocked,[]);results.push({scenario:name,status:'passed',statePosts:posts.length});}finally{await context.close();}
}
async function main(){const browser=await chromium.launch({headless:true});try{
 await scenario(browser,'Textos oficiais íntegros, revisão seletiva e gravação única',{textos:{[A]:TEXTOS_A},faltando:[B]},async t=>{
  await t.start();const summary=await t.complete();assert.match(summary,/1 texto\(s\) conferido\(s\)/);assert.match(summary,/sem texto.*preservados/i);assert.equal(t.posts.length,1);
  const p=t.memory().proposals[0];assert.equal(p.textos.publicoAlvo,TEXTOS_A.publicoAlvo);assert.equal(p.reviews.merito.capacidade.status,'reanalise');assert.equal(p.reviews.celebracao['11'].status,'reanalise');assert.equal(p.reviews.merito.objeto.status,'ok');
  await t.page.locator('#modal-close').click();await t.page.goto(`${URL}#proposta/${A}/analise`);await t.page.getByRole('heading',{name:'Mérito',exact:true}).waitFor();
  for(const [id,field] of [['justificativa','caracterizacao'],['publicoAlvo','publicoAlvo'],['problema','problema'],['resultados','resultados'],['objetivos','relacao'],['capacidade','capacidade']]){
   const row=t.page.locator('tr').filter({has:t.page.locator(`button.review-open[data-id="${id}"]`)});assert.ok((await row.innerText()).includes(TEXTOS_A[field]));
   await row.locator('button.review-open').click();assert.ok((await t.page.locator('#modal-content').innerText()).includes(TEXTOS_A[field]));await t.page.locator('#modal-close').click();
  }
 },s=>{D.setTextos(s.proposals[0],{capacidade:'Capacidade anterior'},'Fixture');for(const r of D.referenceRows(s.proposals[0]))D.markReview(s.proposals[0],r.group,r.id,true,'Fixture');});
 await scenario(browser,'No-op de texto preserva decisões atuais',{textos:{[A]:TEXTOS_A},faltando:[B]},async t=>{const before=clone(t.memory().proposals[0].reviews);await t.start();await t.complete();assert.deepEqual(t.memory().proposals[0].reviews,before);},s=>{D.setTextos(s.proposals[0],TEXTOS_A,'Fixture');D.markReview(s.proposals[0],'merito','capacidade',true,'Fixture');});
 await scenario(browser,'Texto ausente preserva fonte e parecer anteriores',{textos:{},faltando:[A,B]},async t=>{const before=clone(t.memory().proposals[0].textos);await t.start();await t.complete();assert.deepEqual(t.memory().proposals[0].textos,before);assert.equal(t.memory().proposals[0].reviews.merito.capacidade.status,'ok');},s=>{D.setTextos(s.proposals[0],TEXTOS_A,'Fixture');D.markReview(s.proposals[0],'merito','capacidade',true,'Fixture');});
 await scenario(browser,'Falha HTTP não grava conteúdo parcial',{textos:{},faltando:[A,B]},async t=>{t.control.failure=502;await t.start();await t.page.waitForFunction(()=>document.querySelector('#form-error')?.textContent.length>0);assert.equal(t.posts.length,0);});
 await scenario(browser,'Cancelar a atualização não grava textos',null,async t=>{await t.start();await t.page.locator('[data-action="sync-cancel"]').click();await t.page.waitForFunction(()=>document.querySelector('#sync-actions [data-action="sync-start"]'));assert.equal(t.posts.length,0);});
 }finally{await browser.close();}assert.deepEqual(pageErrors,[]);console.log(JSON.stringify({status:'passed',realDatabaseWrites:0,scenarios:results}));}
main().catch(e=>{console.error(e);process.exitCode=1;});
