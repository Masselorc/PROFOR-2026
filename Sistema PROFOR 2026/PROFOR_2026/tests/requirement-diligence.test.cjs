'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const D=require('../domain.js'),{createStore}=require('../workspace-store.cjs');
const reason='Encerrada por confirmação de conformidade do requisito';
function proposal(uf='RS',id='101'){
 return D.createProposal({id,numero:'TESTE-'+id+'/2026',uf,programa:D.PROGRAM,proponente:'FIXTURE ISOLADA',cnpj:'',orgao:'',objeto:'Teste',situacao:'Proposta/Plano de Trabalho Enviado para Análise',data:'2026-09-15',repasse:10000,contrapartida:100,global:10100,pad:[{id:'11',descricao:'PAD fictício',quantidade:'2',unitario:5050,total:10100}]});
}
function diligence(p,ref='celebracao:11',extra={}){
 return D.saveDiligence(p,{ref,category:'OUTRO',request:'Anexar documento na aba Dados do Transferegov',communication:'2026-09-16',science:'',response:'',status:'aberta',note:'Nota preservada',...extra},'Teste');
}
const closureLogs=p=>p.history.filter(h=>h.event==='Diligência encerrada por atendimento do requisito');
test('conformidade fecha antigos e anexação por proposta/grupo/item, sem scope, URL ou anexo',()=>{
 const p=proposal(),other=proposal('RN','102'),d=diligence(p),wrong=diligence(p,'pad:11'),otherD=diligence(other),previous=D.clone(d),pad=D.clone(p.reviews.pad),otherBefore=D.clone(other);
 const same=diligence(p,'celebracao:11',{scope:'independent'});
 D.markReview(p,'proposta','11',true,'Analista');
 assert.equal(d.status,'baixada');assert.equal(same.status,'baixada');assert.equal(wrong.status,'aberta');assert.equal(otherD.status,'aberta');assert.deepEqual(other,otherBefore);
 for(const key of ['request','note','communication','science','response','due','base','calendarNote','confirmed','automaticDeadline'])assert.deepEqual(d[key],previous[key]);
 assert.deepEqual(p.reviews.pad,pad);assert.equal(p.reviews.celebracao['11'].document,'');assert.equal(p.reviews.celebracao['11'].url,'');assert.deepEqual(p.reviews.celebracao['11'].attachments,[]);
 assert.deepEqual({...d.closedByReview,at:undefined},{proposalId:p.id,group:'celebracao',item:'11',ref:'celebracao:11',at:undefined,reason,actor:'Analista',confirmedBy:'Analista'});
 assert.ok(Date.parse(d.closedByReview.at));assert.equal(D.diligenceTerminal(d),true);assert.notEqual(D.diligenceLabel(d),'Prazo expirado');
 assert.equal(closureLogs(p).length,2);D.reconcileDiligences(p);D.markReview(p,'proposta','11',true,'Analista');assert.equal(closureLogs(p).length,2);D.validateState({...D.initialState(),proposals:[p,other]});
});
test('todos os Estados e grupos, qualquer scope ou sua ausência, sem presumir resposta',()=>{
 for(const uf of Object.keys(D.UFS))for(const [group,id] of [['merito','destinacao'],['proposta','11'],['formalizacao','12'],['pad','11']]){
  const p=proposal(uf),ref=D.canonicalRef(group,id),ds=[undefined,'review','independent','requirement'].map(scope=>diligence(p,ref,{scope,communication:''}));
  D.markReview(p,group,id,true,'Analista');for(const d of ds){assert.equal(d.status,'baixada');assert.equal(d.communication,'');assert.equal(d.response,'');}assert.equal(closureLogs(p).length,4);
 }
});
test('não transforma pendências em conformidade; Atende legado dispensa metadados de evidência',()=>{
 for(const status of ['obs','no','diligencia','na','reanalise']){const p=proposal(),d=diligence(p);p.reviews.celebracao['11'].status=status;const before=D.clone(p.reviews);D.reconcileDiligences(p);assert.equal(d.status,'aberta');assert.deepEqual(p.reviews,before);}
 const p=proposal(),d=diligence(p);p.reviews.celebracao['11'].status='ok';delete p.reviews.celebracao['11'].evidence;delete p.reviews.celebracao['11'].actor;D.reconcileDiligences(p);assert.equal(d.status,'baixada');assert.equal(d.closedByReview.actor,undefined);assert.equal(d.closedByReview.confirmedBy,undefined);assert.equal(closureLogs(p)[0].actor,'Sistema');D.validateState({...D.initialState(),proposals:[p]});
});
test('RS/celebracao:11 já Atende encerra a diligência real de anexação sem mudar análise',()=>{
 const state=createStore(path.resolve(__dirname,'../dados/registros')).load().state,p=D.clone(state.proposals.find(p=>p.imported.uf==='RS')),d=p.diligences.find(d=>d.id==='4459db9d-14c2-4cf9-8d5b-854f3c5cc04f');
 assert.equal(d.ref,'celebracao:11');assert.equal(p.reviews.celebracao['11'].status,'ok');assert.match(d.request,/aba\/guia de Dados/);
 // Reproduz o registro anterior mesmo após conciliação operacional; a fixture não é gravada.
 d.status='aberta';delete d.closedByReview;delete d.scope;const reviews=D.clone(p.reviews),before=D.clone(d),count=closureLogs(p).length;
 assert.deepEqual(D.reconcileDiligences(p),[d.id]);assert.equal(d.closedByReview.reason,reason);assert.deepEqual(p.reviews,reviews);
 for(const k of ['communication','response','due','base','request','note','science'])assert.deepEqual(d[k],before[k]);assert.equal(closureLogs(p).length,count+1);assert.deepEqual(D.reconcileDiligences(p),[]);assert.equal(closureLogs(p).length,count+1);
});
test('vínculo parcial, órfão ou contraditório não baixa por semelhança de texto',()=>{
 for(const extra of [{ref:'11'},{ref:'formalizacao:11'},{proposalId:'102'},{group:'pad'},{item:'1'}]){const p=proposal(),d=diligence(p);Object.assign(d,extra);p.reviews.celebracao['11'].status='ok';assert.deepEqual(D.reconcileDiligences(p),[]);assert.equal(d.status,'aberta');assert.match(D.diligenceReviewIssue(p,d),/Vínculo/);}
 const p=proposal(),d=diligence(p,'pad:11');p.reviews.pad['11'].status='ok';p.imported.pad=[];assert.deepEqual(D.reconcileDiligences(p),[]);assert.equal(d.status,'aberta');assert.match(D.diligenceReviewIssue(p,d),/requisito atual/);
});
test('lote, conflito atômico, reload e sincronização mantêm baixa única',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-reconcile-'));try{
  const store=createStore(dir),initial=store.load(),p=proposal(),other=proposal('RN','102');const a=diligence(p),b=diligence(p,'celebracao:12'),otherD=diligence(other),state={...D.initialState(),proposals:[p,other]};
  const first=store.save({state,expected:initial.state.revision,token:initial.token}),next=D.clone(first.state);
  for(const id of ['11','12'])D.markReview(next.proposals[0],id==='11'?'proposta':'formalizacao',id,true,'Lote');
  const second=store.save({state:next,expected:first.state.revision,token:first.token});assert.equal(closureLogs(second.state.proposals[0]).length,2);assert.deepEqual(second.state.proposals[1],first.state.proposals[1]);assert.equal(second.state.proposals[1].diligences.find(d=>d.id===otherD.id).status,'aberta');
  assert.throws(()=>store.save({state:next,expected:first.state.revision,token:first.token}),/alterado/);assert.deepEqual(store.load().state,second.state);
  const loaded=createStore(dir).load(),preview=D.syncProposals(loaded.state,loaded.state.proposals.map(p=>p.imported),'Fixture');
  D.reconcileStateDiligences(preview.state);const third=store.save({state:preview.state,expected:loaded.state.revision,token:loaded.token});assert.equal(closureLogs(third.state.proposals[0]).length,2);for(const id of [a.id,b.id])assert.equal(third.state.proposals[0].diligences.find(d=>d.id===id).status,'baixada');assert.equal(D.pending(third.state.proposals[0]).length,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('persistência aplica decisão recebida sem afetar outra proposta não editada',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-reconcile-'));try{
  const store=createStore(dir),initial=store.load(),p=proposal(),other=proposal('RN','102');diligence(p);diligence(other);const first=store.save({state:{...D.initialState(),proposals:[p,other]},expected:initial.state.revision,token:initial.token});
  const next=D.clone(first.state);next.proposals[0].reviews.celebracao['11'].status='ok';const untouched=D.clone(next.proposals[1]),saved=store.save({state:next,expected:first.state.revision,token:first.token});assert.equal(saved.state.proposals[0].diligences[0].status,'baixada');assert.deepEqual(saved.state.proposals[1],untouched);assert.equal(closureLogs(saved.state.proposals[0]).length,1);
  const repeated=store.save({state:saved.state,expected:saved.state.revision,token:saved.token});assert.equal(closureLogs(repeated.state.proposals[0]).length,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('conciliação global alcança decisões existentes, idempotente e sem mudar análises',()=>{
 const p=proposal(),d=diligence(p);p.reviews.celebracao['11'].status='ok';const state={...D.initialState(),proposals:[p]},reviews=D.clone(p.reviews);assert.deepEqual(D.reconcileStateDiligences(state),[{proposal:p.id,id:d.id}]);assert.equal(d.status,'baixada');assert.deepEqual(p.reviews,reviews);assert.deepEqual(D.reconcileStateDiligences(state),[]);assert.equal(closureLogs(p).length,1);
});
test('baixa não pode ser forjada pelo formulário nem aceita sem motivo/data/ref',()=>{
 const p=proposal(),d=diligence(p);assert.throws(()=>D.saveDiligence(p,{...d,status:'baixada'},'Teste'),/Baixa automática/);d.status='baixada';assert.throws(()=>D.validateState({...D.initialState(),proposals:[p]}),/Baixa automática sem/);
});
