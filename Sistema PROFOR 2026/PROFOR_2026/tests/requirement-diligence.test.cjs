'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const D=require('../domain.js'),{createStore}=require('../workspace-store.cjs');
function proposal(uf='RS'){
  return D.createProposal({id:'101',numero:'TESTE-101/2026',uf,programa:D.PROGRAM,proponente:'FIXTURE ISOLADA',cnpj:'',orgao:'',objeto:'Teste',situacao:'Proposta/Plano de Trabalho Enviado para Análise',data:'2026-09-15',repasse:10000,contrapartida:100,global:10100,pad:[{id:'11',descricao:'PAD fictício',quantidade:'2',unitario:5050,total:10100}]});
}
function diligence(p,ref='celebracao:11',scope='requirement',extra={}){
  return D.saveDiligence(p,{ref,scope,category:'OUTRO',request:'Providência fictícia',communication:'2026-09-16',science:'',response:'',status:'aberta',note:'Nota preservada',...extra},'Teste');
}
const closureLogs=p=>p.history.filter(h=>h.event==='Diligência encerrada por atendimento do requisito');
test('Atende baixa apenas vínculo canônico exclusivo e preserva datas/documentos/PAD',()=>{
  const p=proposal(),d=diligence(p),wrong=diligence(p,'pad:11'),independent=diligence(p,'celebracao:11','independent');
  const before=D.clone(d),pad=D.clone(p.reviews.pad),docs=D.clone(p.reviews.celebracao['11'].attachments);
  D.markReview(p,'proposta','11',true,'Analista');
  assert.equal(d.status,'baixada');assert.equal(wrong.status,'aberta');assert.equal(independent.status,'aberta');
  for(const key of ['request','note','communication','science','response','due','base','calendarNote','confirmed','automaticDeadline'])assert.deepEqual(d[key],before[key]);
  assert.deepEqual(p.reviews.pad,pad);assert.deepEqual(p.reviews.celebracao['11'].attachments,docs);
  assert.equal(d.closedByReview.ref,'celebracao:11');assert.equal(d.closedByReview.actor,'Analista');assert.ok(Date.parse(d.closedByReview.at));assert.match(d.closedByReview.reason,/Não comprova entrega/);
  assert.equal(D.diligenceTerminal(d),true);assert.equal(D.mayResolveReference(p,d),false);assert.notEqual(D.diligenceLabel(d),'Prazo expirado');
  assert.equal(p.diligences.filter(d=>!D.diligenceTerminal(d)).length,2);
  assert.equal(closureLogs(p).length,1);D.reconcileDiligences(p);D.markReview(p,'proposta','11',true,'Analista');assert.equal(closureLogs(p).length,1);
  D.validateState({...D.initialState(),proposals:[p]});
});
test('todos os Estados e grupos, múltiplas diligências exclusivas, sem presumir resposta',()=>{
  for(const uf of Object.keys(D.UFS))for(const [group,id] of [['merito','destinacao'],['proposta','11'],['formalizacao','12'],['pad','11']]){
    const p=proposal(uf),ref=D.canonicalRef(group,id),a=diligence(p,ref),b=diligence(p,ref,'requirement',{communication:''}),legacy=diligence(p,ref,undefined);
    delete legacy.scope;
    D.markReview(p,group,id,true,'Analista');assert.equal(a.status,'baixada');assert.equal(b.status,'baixada');assert.equal(b.communication,'');assert.equal(b.response,'');assert.equal(legacy.status,'aberta');assert.match(D.diligenceReviewIssue(p,legacy),/revise o alcance/);
    assert.equal(closureLogs(p).length,2);
  }
});
test('obs/no/reanalise e decisões sem evidência vigente não autorizam baixa',()=>{
  for(const status of ['obs','no','diligencia','na']){const p=proposal(),d=diligence(p);D.markReview(p,'proposta','11',status,'Teste');assert.equal(d.status,'aberta');}
  const p=proposal();D.markReview(p,'proposta','11',true,'Teste');p.reviews.celebracao['11'].evidence.fingerprint='desatualizado';const d=diligence(p);assert.equal(d.status,'aberta');assert.match(D.diligenceReviewIssue(p,d),/nova conferência/);
});
test('RS/celebracao:11 legado de anexação em Dados permanece aberto e sinalizado',()=>{
  const state=createStore(path.resolve(__dirname,'../dados/registros')).load().state,p=state.proposals.find(p=>p.imported.uf==='RS'),snapshot=D.clone(p);
  const d=p.diligences.find(d=>d.ref==='celebracao:11' && d.request.includes('aba/guia de Dados'));
  assert.ok(d,'Caso real encontrado pelo ref exato; texto apenas confirma a obrigação auditada');assert.equal(p.reviews.celebracao['11'].status,'ok');
  D.reconcileDiligences(p);assert.deepEqual(p,snapshot);assert.match(D.diligenceReviewIssue(p,d),/Nenhuma anexação foi presumida/);
  assert.equal(D.celebracaoItem('11').aba,'proposta');
});
test('classificação explícita preserva prazo legado; independente não baixa; exclusiva baixa',()=>{
  const p=proposal(),d=diligence(p,'celebracao:11','review');Object.assign(d,{automaticDeadline:false,confirmed:true,due:'2026-09-29',calendarNote:'Prazo histórico conferido'});
  D.markReview(p,'proposta','11',true,'Teste');const before=D.clone(d);
  let saved=D.saveDiligence(p,{...d,scope:'independent'},'Analista');assert.equal(saved.status,'aberta');assert.match(D.diligenceReviewIssue(p,saved),/obrigação independente/);
  saved=D.saveDiligence(p,{...saved,scope:'requirement'},'Analista');assert.equal(saved.status,'baixada');for(const key of ['due','base','confirmed','automaticDeadline','communication','response','note','calendarNote'])assert.deepEqual(saved[key],before[key]);
});
test('persistência, conflito atômico, reload e sincronização sem duplicar baixas',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-reconcile-'));try{
    const store=createStore(dir),initial=store.load(),p=proposal();const a=diligence(p),b=diligence(p,'celebracao:12');const state={...D.initialState(),proposals:[p]};
    const first=store.save({state,expected:initial.state.revision,token:initial.token});const next=D.clone(first.state);
    for(const id of ['11','12'])D.markReview(next.proposals[0],id==='11'?'proposta':'formalizacao',id,true,'Lote');
    const second=store.save({state:next,expected:first.state.revision,token:first.token});assert.equal(closureLogs(second.state.proposals[0]).length,2);
    assert.throws(()=>store.save({state:next,expected:first.state.revision,token:first.token}),/alterado/);assert.deepEqual(store.load().state,second.state);assert.equal(store.load().token,second.token);
    const loaded=createStore(dir).load(),preview=D.syncProposals(loaded.state,[loaded.state.proposals[0].imported],'Fixture');
    const third=store.save({state:preview.state,expected:loaded.state.revision,token:loaded.token});assert.equal(closureLogs(third.state.proposals[0]).length,2);
    for(const id of [a.id,b.id])assert.equal(third.state.proposals[0].diligences.find(d=>d.id===id).status,'baixada');
    assert.equal(D.pending(third.state.proposals[0]).length,0);assert.ok(!D.blockers(third.state.proposals[0],true).includes('Diligência ainda não saneada'));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('conciliação no store corrige inconsistência inequívoca sem alterar a entrada',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-reconcile-'));try{const store=createStore(dir),loaded=store.load(),p=proposal(),d=diligence(p);D.markReview(p,'proposta','11',true,'Teste');d.status='aberta';delete d.closedByReview;p.history=p.history.filter(h=>h.event!=='Diligência encerrada por atendimento do requisito');const state={...D.initialState(),proposals:[p]},before=D.clone(state);const saved=store.save({state,expected:loaded.state.revision,token:loaded.token});assert.deepEqual(state,before);assert.equal(saved.state.proposals[0].diligences[0].status,'baixada');assert.equal(closureLogs(saved.state.proposals[0]).length,1);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('baixa não pode ser forjada pelo formulário nem aceita sem motivo/data/ref',()=>{
  const p=proposal(),d=diligence(p);assert.throws(()=>D.saveDiligence(p,{...d,status:'baixada'},'Teste'),/Baixa automática/);d.status='baixada';assert.throws(()=>D.validateState({...D.initialState(),proposals:[p]}),/Baixa automática sem/);
});
