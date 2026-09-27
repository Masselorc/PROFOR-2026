'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const D=require('../domain.js');
const {createStore}=require('../workspace-store.cjs');
const {runAndPersist}=require('../sync-service.cjs');

function data(id='101',overrides={}){
  return {id,numero:`TESTE-${id}/2026`,uf:'AP',programa:D.PROGRAM,proponente:'DADOS FICTÍCIOS — TESTE',cnpj:'',orgao:'',objeto:'Teste automatizado',situacao:'Teste',data:'2026-09-15',repasse:10000,contrapartida:100,global:10100,pad:[{id:'11',descricao:'Item fictício',quantidade:'2',unitario:5050,total:10100}],...overrides};
}
function setup(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-headless-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const store=createStore(path.join(dir,'registros'));
  return {dir,store,lockPath:path.join(dir,'sync.lock')};
}
function saved(store,state){const old=store.load();return store.save({state,expected:old.state.revision,token:old.token});}
function source(proposals,textos={},faltando=[]){
  return {sync:async options=>{
    assert.equal(options.pad,true);
    assert.equal(options.allowEmpty,true);
    return {proposals,source:{url:'https://api-publica.transferegov.gestao.gov.br/downloads',files:[{}]},warnings:[],unchanged:false};
  },fetchProposalTexts:async()=>({textos,faltando})};
}

test('sincronização completa preserva análises, diligências e exclusão; atualiza PAD e textos',async t=>{
  const {store,lockPath}=setup(t);
  const active=D.createProposal(data());
  active.reviews.pad['11'].status='ok';
  active.reviews.pad['11'].note='Análise local';
  D.saveDiligence(active,{ref:'pad:11',category:'PLANO DE APLICAÇÃO DETALHADO',request:'Comprovar o item fictício',communication:'2026-09-15',science:'2026-09-15',response:'',due:'',confirmed:false,calendarNote:'',status:'aberta',note:''},'Teste');
  const deleted=D.createProposal(data('102'));deleted.isDeleted=true;
  saved(store,{...D.initialState(),proposals:[active,deleted]});
  const changed=data('101',{pad:[{id:'11',descricao:'Item alterado',quantidade:'2',unitario:5050,total:10100}]});
  const summary=await runAndPersist({store,lockPath,source:source([changed,data('102'),data('103')],{'101':{caracterizacao:'Texto novo'},'102':{},'103':{}},[])});
  const state=store.load().state;
  assert.equal(summary.proposals,3);assert.equal(summary.padItems,3);assert.equal(summary.textsChecked,3);
  assert.equal(state.proposals[0].reviews.pad['11'].status,'reanalise');
  assert.equal(state.proposals[0].reviews.pad['11'].note,'Análise local');
  assert.deepEqual(state.proposals[0].diligences,active.diligences);
  assert.equal(state.proposals[1].isDeleted,true);
  assert.equal(state.proposals[0].textos.caracterizacao,'Texto novo');
  assert.ok(state.proposals[0].history.some(h=>h.actor==='Sincronização automática'));
  assert.equal(store.history().length,1);
  assert.ok(store.history()[0].activity.some(x=>x.message.includes('Iniciando sincronização')));
  assert.equal(fs.existsSync(lockPath),false);
  assert.equal(require.cache[require.resolve('../server.cjs')],undefined);
});

test('texto igual recebe conferência, texto ausente preserva valor anterior',async t=>{
  const {store,lockPath}=setup(t);
  const a=D.createProposal(data());const b=D.createProposal(data('102'));
  D.setTextos(a,{caracterizacao:'Igual'},'Teste');D.setTextos(b,{caracterizacao:'Preservado'},'Teste');
  saved(store,{...D.initialState(),proposals:[a,b]});
  const out=await runAndPersist({store,lockPath,source:source([data(),data('102')],{'101':{caracterizacao:'Igual'}},['102'])});
  const [one,two]=store.load().state.proposals;
  assert.equal(out.textsChecked,1);assert.equal(out.textsChanged,0);
  assert.ok(one.history.some(h=>h.event==='Textos oficiais conferidos sem alteração' && h.actor==='Sincronização automática'));
  assert.equal(two.textos.caracterizacao,'Preservado');assert.equal(out.warnings.length,1);
});

test('extração vazia preserva propostas e registra execução',async t=>{
  const {store,lockPath}=setup(t);saved(store,{...D.initialState(),proposals:[D.createProposal(data())]});
  await runAndPersist({store,lockPath,source:source([])});
  assert.equal(store.load().state.proposals.length,1);
  assert.equal(store.load().state.sync.count,0);assert.equal(store.history().length,1);
});

test('conflito token/revision impede sobrescrita',async t=>{
  const {store,lockPath}=setup(t);saved(store,D.initialState());
  const fake=source([data()],{'101':{}});
  fake.fetchProposalTexts=async()=>{const changed=D.clone(store.load().state);changed.lastBackup=D.now();saved(store,changed);return {textos:{'101':{}},faltando:[]};};
  await assert.rejects(runAndPersist({store,lockPath,source:fake}),/Conflito de concorrência/);
  assert.equal(store.load().state.proposals.length,0);assert.equal(store.load().state.revision,2);
  assert.equal(fs.existsSync(lockPath),false);
});

test('erro de download não grava estado incompleto',async t=>{
  const {store,lockPath}=setup(t);saved(store,D.initialState());
  const before=store.load();
  await assert.rejects(runAndPersist({store,lockPath,source:{sync:async()=>{throw new Error('Falha no download');}}}),/Falha no download/);
  assert.equal(store.load().token,before.token);assert.equal(store.history().length,0);
  assert.equal(fs.existsSync(lockPath),false);
});

test('trava impede duas execuções headless simultâneas',async t=>{
  const {store,lockPath}=setup(t);let release;
  const fake={sync:()=>new Promise(resolve=>{release=()=>resolve({proposals:[],source:{},warnings:[]});})};
  const first=runAndPersist({store,lockPath,source:fake});
  await assert.rejects(runAndPersist({store,lockPath,source:fake}),/Já existe uma sincronização automática/);
  release();await first;assert.equal(fs.existsSync(lockPath),false);
});

test('CLI retorna código zero em sucesso e não zero em erro',()=>{
  const cli=path.join(__dirname,'..','sincronizar-profor.cjs');
  for(const [fail,expected] of [[false,0],[true,1]]){
    const script=`require(${JSON.stringify(cli)}).main(async()=>${fail?'Promise.reject(new Error("falha simulada"))':'({proposals:1})'})`;
    const result=spawnSync(process.execPath,['-e',script],{encoding:'utf8'});
    assert.equal(result.status,expected,result.stderr);
  }
});
