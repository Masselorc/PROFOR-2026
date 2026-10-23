'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../domain.js'),{syntheticProposal}=require('./fixtures/state.cjs');
function proposal(id,uf,result){
 const p=syntheticProposal();p.id=id;p.imported.id=id;p.imported.uf=uf;
 for(const row of D.referenceRows(p))D.markReview(p,row.group,row.id,true,'Fixture');
 if(result)D.confirmConclusion(p,{result,expectedEvidence:D.technicalEvidence(p)},'Fixture');
 return p;
}
test('cards contam UFs distintas por conclusão técnica, sem depender de envio ou aptidão',()=>{
 const approved=proposal('1','RS','favoravel');
 D.setReview(approved,'celebracao','4',{status:'diligencia',note:'Conferir TR',document:'',url:''},'Fixture');
 D.saveDiligence(approved,{ref:'celebracao:4',category:'OUTRO',request:'Pendência de formalização',communication:'2026-09-15',science:'',response:'',status:'aberta',note:'',calendarNote:'',confirmed:false,due:''},'Fixture');
 assert.equal(D.aptForCelebration(approved),false);
 const stale=proposal('4','RN','favoravel');stale.conclusion.reanalysis={at:D.now(),reason:'Nova evidência'};
 const deleted=proposal('5','AP','favoravel');deleted.isDeleted=true;
 const state={...D.initialState(),proposals:[approved,proposal('2','RS','favoravel'),proposal('3','MG'),stale,deleted,proposal('6','BA','desfavoravel'),proposal('7','MG')]};
 assert.deepEqual(D.panelSummary(state),{eligible:14,registered:4,inAnalysis:2,approved:1});
});
test('painel vazio mantém elegíveis sem inventar propostas',()=>{
 assert.deepEqual(D.panelSummary(D.initialState()),{eligible:14,registered:0,inAnalysis:0,approved:0});
});
