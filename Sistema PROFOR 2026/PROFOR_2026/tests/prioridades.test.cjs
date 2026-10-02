'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const D=require('../domain.js');
const A=require('../sync-apply.js');
const {createStore}=require('../workspace-store.cjs');
function data(id='101',extra={}){return {id,numero:`TESTE-${id}/2026`,uf:'AP',programa:D.PROGRAM,proponente:'FIXTURE SINTÉTICA',cnpj:'',orgao:'',objeto:'Objeto fictício',situacao:'Proposta/Plano de Trabalho Enviado para Análise',data:'2026-09-15',repasse:10000,contrapartida:100,global:10100,pad:[{id:'11',descricao:'Item fictício',quantidade:'2',unitario:5050,total:10100}],...extra};}
function state(p=D.createProposal(data())){return {...D.initialState(),proposals:[p]};}
function extraction(rows,items=[data(),data('102')]){const proposals=new Map(items.map(i=>[i.id,{...D.clone(i),pad:[]} ]));const c=D.padCollector(proposals,'fixture.csv','2026-10-02T12:00:00Z');rows.forEach(r=>c.row(r));c.finish();return [...proposals.values()];}
const row=(extra={})=>({ID_PROPOSTA:'101',ID_ITEM_PAD:'11',DESCRICAO_ITEM:'Item fictício',QTD_ITEM:'2',VALOR_UNITARIO_ITEM:'50,50',VALOR_TOTAL_ITEM:'101,00',...extra});
test('3: parcial preserva PAD íntegro, notas, anexos e persiste alerta; íntegra resolve com histórico',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-prioridades-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const store=createStore(dir);
 const p=D.createProposal(data());p.reviews.pad['11'].note='Nota preservada';
 const initial=store.save({state:state(p),expected:0,token:null});
 const incoming=extraction([row(),row({ID_ITEM_PAD:'12',QTD_ITEM:'inválido',VALOR_TOTAL_ITEM:'0,00'})]);
 const applied=A.applySyncResult(initial.state,{proposals:incoming,textos:{},textosFaltando:['101','102']});
 assert.deepEqual(applied.state.proposals[0].imported.pad,p.imported.pad);assert.equal(applied.state.proposals[0].reviews.pad['11'].note,p.reviews.pad['11'].note);
 assert.equal(applied.state.proposals[0].padImport.rejected,1);assert.ok(applied.warnings.some(w=>/incompleto/.test(w)));
 store.save({state:applied.state,expected:initial.state.revision,token:initial.token});const reloaded=store.load().state;
 assert.equal(D.padSituacao(reloaded.proposals[0]).key,'incompleto');
 const recovered=D.syncProposals(reloaded,extraction([row()]),'fixture').state.proposals[0];assert.equal(recovered.padImport.status,'complete');assert.ok(recovered.history.some(h=>h.event.includes('alerta resolvido')));
});
test('3: duplicata, rejeição sem efeito no total e falha não atribuível bloqueiam o conjunto afetado',()=>{
 for(const rows of [[row(),row()],[row(),row({ID_ITEM_PAD:'12',QTD_ITEM:'0',VALOR_TOTAL_ITEM:'0,00'})],[row(),row({ID_PROPOSTA:''})]]){
   const items=extraction(rows),out=D.syncProposals(state(),items,'fixture').state;assert.equal(out.proposals[0].padImport.status,'partial');assert.deepEqual(out.proposals[0].imported.pad,data().pad);
   if(rows[1].ID_PROPOSTA==='')assert.equal(out.proposals[1].imported.pad,null);
 }
});
test('3: vazio íntegro, não solicitado e parcial sem referência são estados distintos',()=>{
 const empty=D.syncProposals(state(),extraction([]),'fixture').state.proposals[0];assert.equal(D.padSituacao(empty).key,'sem-itens');
 const partial=D.syncProposals(D.initialState(),extraction([row({QTD_ITEM:'0'})]),'fixture').state.proposals[0];assert.equal(partial.imported.pad,null);assert.equal(D.padSituacao(partial).key,'incompleto');
 const quick=D.syncProposals(state(),[data('101',{pad:null})],'fixture').state.proposals[0];assert.deepEqual(quick.imported.pad,data().pad);
});
module.exports={data,state};
function ready(){const p=D.createProposal(data());D.setTextos(p,{capacidade:'Capacidade fictícia',publicoAlvo:'Público fictício'},'Teste');for(const r of D.referenceRows(p))D.markReview(p,r.group,r.id,true,'Teste');return p;}
function conclude(p,result='favoravel',extra={}){return D.confirmConclusion(p,{result,reference:'Fixture — itens e fontes conferidos',note:result==='desfavoravel'?'Resultado negativo justificado':'',expectedEvidence:D.technicalEvidence(p),operationId:D.uid(),...extra},'Teste');}
test('4: dependências seletivas, no-op de texto e horário não invalidam; alteração de capacidade reabre 11',()=>{
 const p=ready();conclude(p);const first=D.clone(p.reviews);D.setTextos(p,{capacidade:'Capacidade fictícia',publicoAlvo:'Público fictício'},'Teste');assert.deepEqual(p.reviews,first);assert.ok(p.conclusion);
 D.setTextos(p,{capacidade:'Outra capacidade',publicoAlvo:'Público fictício'},'Teste');assert.equal(p.reviews.merito.capacidade.status,'reanalise');assert.equal(p.reviews.celebracao['11'].status,'reanalise');assert.equal(p.reviews.merito.publicoAlvo.status,'ok');assert.equal(p.conclusion,null);assert.equal(p.history.findLast(h=>h.event==='Reanálise: merito:capacidade').before.status,'ok');
});
test('4: mudança administrativa conserva mérito; contrapartida reabre apenas dependentes documentais',()=>{
 const p=ready();conclude(p);const admin=D.syncProposals(state(p),[data('101',{proponente:'Nome corrigido'})],'fixture').state.proposals[0];assert.ok(admin.conclusion);assert.equal(admin.reviews.merito.capacidade.status,'ok');
 const out=D.syncProposals(state(admin),[data('101',{contrapartida:200})],'fixture').state.proposals[0];assert.equal(out.reviews.celebracao['7'].status,'reanalise');assert.equal(out.reviews.celebracao['6'].status,'ok');assert.ok(out.conclusion,'Trabalho técnico independente preservado');assert.equal(D.aptForCelebration(out),false);
});
test('4: item alterado com mesmo ID/total exige reanálise, inclusive após apagar, sincronizar e restaurar',()=>{
 const p=ready();p.reviews.pad['11'].note='Nota histórica';D.deleteProposal(p,'Teste');const i=data();i.pad[0].descricao='Descrição alterada';const out=D.syncProposals(state(p),[i],'fixture').state.proposals[0];assert.equal(out.isDeleted,true);assert.equal(out.reviews.pad['11'].status,'reanalise');D.restoreProposal(out,'Teste');assert.equal(out.reviews.pad['11'].status,'reanalise');assert.equal(out.reviews.pad['11'].note,'Nota histórica');
});
test('4: documento substituído/removido reabre avaliação, preserva histórico e separa celebração',()=>{
 const p=ready();conclude(p);D.addAttachment(p,'formalizacao','9',{name:'fixture.txt',data:'data:text/plain;base64,eA==',size:1},'Teste');assert.equal(p.reviews.celebracao['9'].status,'reanalise');assert.ok(p.conclusion);assert.equal(p.history.findLast(h=>h.event==='Reanálise: celebracao:9').before.status,'ok');
 D.markReview(p,'formalizacao','9',true,'Teste');D.removeAttachment(p,'formalizacao','9',p.reviews.celebracao['9'].attachments[0].id,'Teste');assert.equal(p.reviews.celebracao['9'].status,'reanalise');
});
test('5: aritmética íntegra não é revisão; PAD entra uma vez no denominador e negativos justificados contam trabalho',()=>{
 const p=D.createProposal(data());assert.equal(D.finance(p).ok,true);assert.equal(D.groupProgress(p,'pad').done,0);assert.equal(D.reviewProgress(p).total,D.REQUIREMENTS.merito.length+D.REQUIREMENTS.celebracao.length+1);
 D.setReview(p,'pad','11',{status:'no',note:'Preço incompatível conferido',document:'',url:''},'Teste');assert.equal(D.groupProgress(p,'pad').done,1);assert.equal(D.groupProgress(p,'pad').accepted,0);assert.ok(D.blockers(p).length);
 p.imported.pad[0].unitario++;assert.equal(D.finance(p).pad,true);assert.equal(D.finance(p).errors.length,1);
});
test('1/5: conclusão favorável persistente, resultado desfavorável sem aptidão e controles posteriores independentes',()=>{
 const p=ready();for(const r of D.rows(p,'celebracao'))D.markReview(p,'celebracao',r[0],null,'Teste');conclude(p);assert.equal(p.conclusion.result,'favoravel');assert.equal(D.situation(p),'Pendente de celebração');
 const negative=ready();D.setReview(negative,'merito','destinacao',{status:'no',note:'Destinação incompatível',document:'',url:''},'Teste');conclude(negative,'desfavoravel');assert.equal(D.reviewProgress(negative).percent,100);assert.equal(D.situation(negative),'Análise técnica desfavorável');assert.equal(D.aptForCelebration(negative),false);assert.match(D.exportCSV(state(negative)),/desfavoravel/);
});
test('1: bloqueio superveniente, evidência alterada e submissão repetida não registram conclusão',()=>{
 const p=ready(),evidence=D.technicalEvidence(p),id=D.uid();D.markReview(p,'pad','11',null,'Teste');assert.throws(()=>conclude(p,'favoravel',{expectedEvidence:evidence}),/PAD/);assert.equal(p.conclusion,null);
 const q=ready(),old=D.technicalEvidence(q);D.setTextos(q,{capacidade:'Nova'},'Teste');for(const r of D.referenceRows(q))if(r.review.status==='reanalise')D.markReview(q,r.group,r.id,true,'Teste');assert.throws(()=>conclude(q,'favoravel',{expectedEvidence:old}),/evidências mudaram/);
 const r=ready();conclude(r,'favoravel',{operationId:id});const before=r.history.length;assert.throws(()=>conclude(r,'favoravel',{operationId:id}),/já foi registrada/);assert.equal(r.history.length,before);
});
test('5: terminal não saneada admite resultado desfavorável; aguardando resposta permanece aberta',()=>{
 const p=ready();const d={ref:'pad:11',category:'PLANO DE APLICAÇÃO DETALHADO',request:'Comprovar item',communication:'2026-09-15',science:'',response:'',status:'nao_saneada',note:'Não comprovado',calendarNote:'',confirmed:false,due:''};D.saveDiligence(p,d,'Teste');D.setReview(p,'pad','11',{status:'diligencia',note:'Não comprovado',document:'',url:''},'Teste');conclude(p,'desfavoravel');assert.equal(D.situation(p),'Análise técnica desfavorável');assert.equal(p.reviews.pad['11'].status,'diligencia');
 D.saveDiligence(p,{...p.diligences[0],status:'aguardando'},'Teste');assert.equal(p.conclusion,null);assert.throws(()=>conclude(p,'desfavoravel'),/Diligência aberta/);assert.equal(p.diligences[0].status,'aguardando');
});
test('5/7: estados oficiais negativos/desconhecidos nunca aptos; Fala.BR não bloqueante e cláusula expressa',()=>{
 for(const situacao of ['Rejeitada','Cancelada','Indeferida','Situação nunca vista','não enviada mas cadastrada depois']){const p=ready();p.imported.situacao=situacao;conclude(p);assert.equal(D.aptForCelebration(p),false);assert.notEqual(D.situation(p),'Apta à celebração');assert.equal(p.imported.situacao,situacao);}
 const p=ready();D.markReview(p,'merito','falaBRAdesao','no','Teste');D.markReview(p,'merito','ouvidoriaInstituida','no','Teste');D.setInstitution(p,{ouvidoria:{...p.ouvidoria,clause:true},falaBR:p.falaBR},'Teste');D.markReview(p,'merito','ouvidoriaInstituida','no','Teste');conclude(p);assert.equal(p.ouvidoria.status,'pendente');assert.equal(p.falaBR,'nao_previsto');assert.equal(D.situation(p),'Formalização com cláusula suspensiva');
});
test('7: edição de fato reabre dependentes; decisão direta atualiza fato e parecer atomicamente sem loop',()=>{
 const p=ready();conclude(p);D.setInstitution(p,{ouvidoria:{...p.ouvidoria,status:'pendente'},falaBR:p.falaBR},'Teste');assert.equal(p.conclusion,null);assert.equal(p.reviews.merito.ouvidoriaInstituida.status,'reanalise');assert.equal(D.aptForCelebration(p),false);
 D.markReview(p,'merito','falaBRAdesao','obs','Teste');assert.equal(p.falaBR,'previsto');assert.equal(p.reviews.merito.falaBRAdesao.status,'obs');assert.equal(D.reviewCurrent(p,'merito','falaBRAdesao'),true);
 const before=D.clone(p);assert.throws(()=>D.setInstitution(p,{ouvidoria:{...p.ouvidoria,signature:'inexistente'},falaBR:'aderido'},'Teste'));assert.deepEqual(p,before);
});
test('6: referências canônicas distinguem abas e colisão de PAD; normalização legada é conservadora/idempotente',()=>{
 const p=D.createProposal(data());p.reviews.merito.falaBRAdesao={...p.reviews.merito.falaBRAdesao,status:'ok',note:'Legado',extra:'Preservar'};p.falaBR='nao_previsto';const s=state(p);D.normalizeState(s);const once=D.clone(s);D.normalizeState(s);assert.deepEqual(s,once);assert.equal(p.reviews.merito.falaBRAdesao.evidence.fingerprint,null);assert.equal(p.reviews.merito.falaBRAdesao.extra,'Preservar');assert.equal(D.institutionalConflicts(p).length,1);
 assert.equal(D.canonicalRef('proposta','11'),'celebracao:11');assert.equal(D.canonicalRef('formalizacao','9'),'celebracao:9');assert.equal(D.canonicalRef('pad','11'),'pad:11');
});
test('8: filtros combinados correspondem à mesma proposta; filtros de origem e controle são centrais',()=>{
 const a=ready(),b=D.createProposal(data('102',{proponente:'Segunda proposta'}));a.imported.pad[0].total++;assert.equal(D.matchesFilters(a,{search:'Segunda',control:'financial'}),false);assert.equal(D.matchesFilters(b,{search:'Segunda',control:'financial'}),false);assert.equal(D.matchesFilters(b,{search:'Segunda',control:'merito',source:'enviada'}),true);
});
test('4: assinaturas não dependem da ordem de propriedades, de itens ou do relógio de consulta',()=>{
 const p=ready();const before=D.evidenceOf(p,'merito','capacidade');p.textos={...Object.fromEntries(Object.entries(p.textos).reverse()),at:'2027-01-01T00:00:00Z'};assert.deepEqual(D.evidenceOf(p,'merito','capacidade'),before);
 const padBefore=D.evidenceOf(p,'celebracao','6');p.imported.pad=p.imported.pad.map(i=>Object.fromEntries(Object.entries(i).reverse())).reverse();assert.deepEqual(D.evidenceOf(p,'celebracao','6'),padBefore);
});
