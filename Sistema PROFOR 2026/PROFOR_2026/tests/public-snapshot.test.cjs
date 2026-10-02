'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const D = require('../domain.js');
const { projectPublicState } = require('../../../tools/build_public_docs.cjs');
const { createStore } = require('../workspace-store.cjs');
const docsFile = path.resolve(__dirname, '../../../docs/dados_publicos.js');
const os=require('node:os');
const {build,MIRRORS}=require('../../../tools/build_public_docs.cjs');
const {syntheticState}=require('./fixtures/state.cjs');
test('6: gerador sintético isolado preserva todos os campos; espelho e modo só código',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-public-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const state=syntheticState();state.proposals[0].businessUnknown={preservar:true};state.proposals[0].isDeleted=true;
 build({state,history:[],outputDir:dir,quiet:true});const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(dir,'dados_publicos.js'),'utf8'),context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.window.PROFOR_PUBLIC_DATA.proposals)),state.proposals);const before=fs.readFileSync(path.join(dir,'dados_publicos.js'));
 build({outputDir:dir,mirrorOnly:true,quiet:true});assert.deepEqual(fs.readFileSync(path.join(dir,'dados_publicos.js')),before);
 for(const name of MIRRORS)assert.deepEqual(fs.readFileSync(path.join(dir,name)),fs.readFileSync(path.join(__dirname,'..',name)));
 assert.throws(()=>build({recordsDir:path.join(dir,'absent'),outputDir:dir,quiet:true}),/Banco real indisponível/);assert.deepEqual(fs.readFileSync(path.join(dir,'dados_publicos.js')),before);
});
test('6: todos os vínculos do snapshot real preservam grupo/item sem colisão entre PAD e celebração',()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync(docsFile,'utf8'),context);const state=context.window.PROFOR_PUBLIC_DATA;
 let links=0;for(const p of state.proposals)for(const d of p.diligences){if(!d.ref)continue;links++;const [group,id]=d.ref.split(':');assert.ok(p.reviews[group]?.[id],`Vínculo sem avaliação preservada: ${d.ref}`);assert.equal(D.canonicalRef(group,id),d.ref);const current=D.referenceRows(p).find(r=>r.ref===d.ref);if(current)assert.equal(current.tab,D.tabLabel(group,id));}
 assert.equal(links,state.proposals.reduce((n,p)=>n+p.diligences.filter(d=>d.ref).length,0));
});

test('projeção pública reflete com exatidão o estado canônico do sistema local', () => {
  const store = createStore(path.resolve(__dirname, '../dados/registros'));
  const loaded = store.load();
  const state = loaded.state;
  const history = store.history();

  const result = projectPublicState(state, history);
  D.validateState(result);
  assert.equal(result.revision, state.revision);
  assert.equal(result.proposals.length, state.proposals.length);
  assert.equal(D.activeProposals(result).length, D.activeProposals(state).length);
  assert.equal(D.deletedProposals(result).length, D.deletedProposals(state).length);
  assert.deepEqual(result.sync, state.sync);
  assert.equal(result.syncHistory.length, history.length);
});

test('docs/dados_publicos.js reproduz o banco do sistema e valida regras de domínio', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(docsFile, 'utf8'), context);
  const result = context.window.PROFOR_PUBLIC_DATA;
  const store = createStore(path.resolve(__dirname, '../dados/registros'));
  const state = store.load().state;
  D.validateState(result);
  assert.equal(result.revision, state.revision, 'Snapshot deve ser da revisão local atual');
  assert.equal(result.proposals.length, state.proposals.length);
  assert.equal(D.activeProposals(result).length, D.activeProposals(state).length);
  assert.equal(D.deletedProposals(result).length, D.deletedProposals(state).length);
  assert.deepEqual(JSON.parse(JSON.stringify(result.proposals)), state.proposals, 'Snapshot deve conter todos os dados atuais das propostas');
  assert.deepEqual(JSON.parse(JSON.stringify(result.sync)), state.sync);
  assert.ok(Array.isArray(result.syncHistory));
  assert.equal(result.syncHistory.length, store.history().length);
});
