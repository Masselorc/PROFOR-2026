'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const D=require('../domain.js');
const {syntheticProposal}=require('./fixtures/state.cjs');
const {createStore}=require('../workspace-store.cjs');
function ready(status){
 const p=syntheticProposal();
 for(const r of D.referenceRows(p))D.markReview(p,r.group,r.id,true,'Teste');
 D.setReview(p,'pad','11',{status,note:status==='diligencia'?'Conferir item':'',document:'',url:''},'Teste',{allowEmptyNote:true});
 D.saveDiligence(p,{ref:'pad:11',category:'PLANO DE APLICAÇÃO DETALHADO',request:'Conferir item sintético',communication:'2026-09-15',science:'',response:'',status:'aberta',note:'',calendarNote:'',confirmed:false,due:''},'Teste');
 return p;
}
for(const result of ['favoravel','desfavoravel'])for(const status of ['diligencia','no'])test(`concluir ${result} com PAD ${status}, diligência aberta e campos vazios, persistindo sem encerrar pendências`,t=>{
 const p=ready(status),ds=D.clone(p.diligences),reviews=D.clone(p.reviews);
 assert.deepEqual(D.conclusionBlocks(p,result),[]);
 const c=D.confirmConclusion(p,{result,note:'',reference:'',expectedEvidence:D.technicalEvidence(p),operationId:'conclusao-teste'},'Analista');
 assert.equal(c.note,'');assert.equal(c.reference,'');assert.equal(c.result,result);assert.equal(D.conclusionCurrent(p),true);
 assert.deepEqual(p.diligences,ds);assert.deepEqual(p.reviews,reviews);assert.equal(D.aptForCelebration(p),false);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-conclusion-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=createStore(dir),saved=store.save({state:{...D.initialState(),proposals:[p]},expected:0,token:null});
 assert.deepEqual(store.load().state,saved.state);assert.equal(store.load().state.proposals[0].conclusion.reference,'');
 assert.throws(()=>D.confirmConclusion(p,{result,expectedEvidence:D.technicalEvidence(p),operationId:'conclusao-teste'},'Analista'),/já foi registrada/);
});
test('campos omitidos são opcionais, mas autoria e evidência atual permanecem obrigatórias',()=>{
 const p=ready('diligencia');
 assert.throws(()=>D.confirmConclusion(p,{result:'favoravel',expectedEvidence:'antiga'},'Analista'),/evidências mudaram/);
 assert.throws(()=>D.confirmConclusion(p,{result:'favoravel',expectedEvidence:D.technicalEvidence(p)},''),/Autor/);
 D.confirmConclusion(p,{result:'favoravel',expectedEvidence:D.technicalEvidence(p)},'Analista');
 assert.equal(p.conclusion.reference,'');assert.equal(p.conclusion.note,'');
});
