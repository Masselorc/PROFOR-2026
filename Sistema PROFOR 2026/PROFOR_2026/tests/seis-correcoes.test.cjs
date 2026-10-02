'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const D=require('../domain.js');
const {createStore}=require('../workspace-store.cjs');
function data(extra={}){return {id:'101',numero:'TESTE-101/2026',uf:'AP',programa:D.PROGRAM,proponente:'FIXTURE SINTÉTICA',cnpj:'',orgao:'',objeto:'Objeto sintético',situacao:'Proposta/Plano de Trabalho Enviado para Análise',data:'2026-09-15',repasse:10000,contrapartida:100,global:10100,pad:[{id:'11',descricao:'Item sintético',quantidade:'2',unitario:5050,total:10100}],...extra};}
function state(p){return {...D.initialState(),proposals:[p]};}
function ready(){const p=D.createProposal(data());for(const r of D.referenceRows(p))D.markReview(p,r.group,r.id,true,'Analista da fixture');return p;}
function diligence(ref,status='saneada'){return {ref,category:'PLANO DE APLICAÇÃO DETALHADO',request:'Conferir documentação sintética',communication:'2026-09-15',science:'',response:status==='saneada'?'2026-09-16':'',status,note:status==='saneada'?'Atendida com documento sintético':'',calendarNote:'',confirmed:false,due:''};}
function conclude(p,result){return D.confirmConclusion(p,{result,reference:'Documento sintético de conferência',note:result==='desfavoravel'?'Conclusão negativa expressa':'Nota favorável preservada',expectedEvidence:D.technicalEvidence(p),operationId:'operation-'+result},'Analista da fixture');}

test('1: PAD/mérito -> celebração invalida ambos resultados e preserva conclusão/histórico',()=>{
 for(const result of ['favoravel','desfavoravel'])for(const ref of ['pad:11','merito:objeto']){
  const p=ready(),d=D.saveDiligence(p,diligence(ref),'Teste');conclude(p,result);const before=D.clone(p.conclusion);
  D.saveDiligence(p,{...d,ref:'celebracao:3'},'Teste');
  assert.equal(D.situation(p),'Requer nova análise',result+' '+ref);
  assert.equal(p.conclusion.result,before.result);for(const k of ['actor','at','note','reference','evidence','operationId'])assert.deepEqual(p.conclusion[k],before[k]);
  assert.equal(D.conclusionCurrent(p),false);assert.ok(p.conclusion.reanalysis);assert.equal(D.aptForCelebration(p),false);
  assert.deepEqual(p.history.findLast(h=>h.event.includes('reaberta por diligência')).before,before);
 }
});

test('1: celebração -> PAD/mérito e edição técnica material exigem reanálise',()=>{
 for(const result of ['favoravel','desfavoravel'])for(const ref of ['pad:11','merito:objeto']){
  const p=ready(),d=D.saveDiligence(p,diligence('celebracao:3'),'Teste');conclude(p,result);D.saveDiligence(p,{...d,ref},'Teste');assert.equal(D.conclusionCurrent(p),false);assert.equal(p.conclusion.result,result);
  const q=ready(),e=D.saveDiligence(q,diligence(ref),'Teste');conclude(q,result);D.saveDiligence(q,{...e,request:'Nova providência material'},'Teste');assert.equal(D.conclusionCurrent(q),false);
 }
});

test('1: no-op e edição exclusivamente de celebração preservam evidência e conclusão',()=>{
 for(const result of ['favoravel','desfavoravel'])for(const ref of ['pad:11','merito:objeto','celebracao:3']){
  const p=ready(),d=D.saveDiligence(p,diligence(ref),'Teste');conclude(p,result);const before=D.clone(p.conclusion),evidence=D.technicalEvidence(p),history=p.history.length;
  D.saveDiligence(p,D.clone(d),'Teste');assert.deepEqual(p.conclusion,before);assert.equal(D.technicalEvidence(p),evidence);assert.equal(p.history.length,history);
  if(ref.startsWith('celebracao:')){D.saveDiligence(p,{...d,request:'Providência de celebração alterada'},'Teste');assert.deepEqual(p.conclusion,before);assert.equal(D.conclusionCurrent(p),true);}
 }
});

test('1: conclusão legada/divergente é detectada sem gravação ou associação retroativa',()=>{
 for(const result of ['favoravel','desfavoravel'])for(const divergent of [false,true]){
  const p=ready();conclude(p,result);if(divergent)p.conclusion.evidence.fingerprint='fnv64-v1:0000000000000000';else delete p.conclusion.evidence;
  const before=D.clone(p);assert.equal(D.situation(p),'Requer nova análise');assert.equal(D.conclusionCurrent(p),false);assert.equal(D.aptForCelebration(p),false);assert.deepEqual(p,before);
  D.normalizeState(state(p));assert.equal(p.conclusion.evidence?.fingerprint,divergent?'fnv64-v1:0000000000000000':undefined);
 }
});

test('1: confirmação revalida evidência, operationId permanece único após reanálise',()=>{
 const p=ready(),expectedEvidence=D.technicalEvidence(p);conclude(p,'favoravel');const c=D.clone(p.conclusion);D.saveDiligence(p,diligence('pad:11'),'Teste');
 assert.throws(()=>D.confirmConclusion(p,{result:'favoravel',reference:'Referência',expectedEvidence,operationId:'novo'},'Teste'),/evidências mudaram/);
 assert.throws(()=>D.confirmConclusion(p,{result:'favoravel',reference:'Referência',expectedEvidence:D.technicalEvidence(p),operationId:c.operationId},'Teste'),/já foi registrada/);
 assert.equal(p.conclusion.result,c.result);assert.equal(D.conclusionCurrent(p),false);
});

test('1: store temporário persiste reanálise e rejeita conflito/erro sem gravar metade',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-seis-domain-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const store=createStore(dir),p=ready(),d=D.saveDiligence(p,diligence('pad:11'),'Teste');conclude(p,'desfavoravel');
 const first=store.save({state:state(p),expected:0,token:null}),draft=D.clone(first.state);D.saveDiligence(draft.proposals[0],{...d,ref:'celebracao:3'},'Teste');
 const saved=store.save({state:draft,expected:first.state.revision,token:first.token}),reloaded=store.load();assert.deepEqual(reloaded.state,saved.state);assert.equal(D.situation(reloaded.state.proposals[0]),'Requer nova análise');assert.equal(reloaded.state.proposals[0].conclusion.result,'desfavoravel');
 const hashes=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>fs.readFileSync(path.join(dir,f),'utf8'));
 assert.throws(()=>store.save({state:draft,expected:first.state.revision,token:first.token}),/outra aba ou máquina/);
 const original=fs.renameSync;fs.renameSync=()=>{throw Error('Falha de escrita sintética');};try{assert.throws(()=>store.save({state:D.clone(saved.state),expected:saved.state.revision,token:saved.token}),/Falha de escrita/);}finally{fs.renameSync=original;}
 assert.deepEqual(store.load(),reloaded);assert.deepEqual(fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>fs.readFileSync(path.join(dir,f),'utf8')),hashes);
});

test('3: observação não torna Ouvidoria ausente/pendente sem cláusula conforme',()=>{
 for(const fact of ['na','pendente']){const p=ready();D.setInstitution(p,{ouvidoria:{...p.ouvidoria,status:fact,clause:false}},'Teste');D.setReview(p,'merito','ouvidoriaInstituida',{status:'obs',note:'Observação não comprova instituição',document:'',url:''},'Teste');
  assert.equal(p.ouvidoria.status,fact);assert.equal(p.reviews.merito.ouvidoriaInstituida.status,'obs');assert.equal(D.reviewCurrent(p,'merito','ouvidoriaInstituida'),false);assert.equal(D.groupProgress(p,'merito').accepted,D.REQUIREMENTS.merito.length-1);assert.ok(D.institutionalConflicts(p).some(c=>c.id==='ouvidoriaInstituida'));assert.ok(D.conclusionBlocks(p).length);
 }
});

test('3: matriz institucional explicita todos os estados sem alterar fatos/notas legados',()=>{
 for(const fact of ['na','instituida','pendente'])for(const clause of [false,true])for(const status of Object.keys(D.STATUSES)){
  const p=ready();p.ouvidoria={...p.ouvidoria,status:fact,clause};const r=p.reviews.merito.ouvidoriaInstituida;r.status=status;r.note='Nota legada preservada';r.evidence=D.evidenceOf(p,'merito','ouvidoriaInstituida');const before=D.clone(p);
  const expected=status==='ok'?fact==='instituida':status==='no'?fact==='pendente':status==='obs'?(fact==='instituida'||fact==='pendente'&&clause):false;
  assert.equal(D.institutionalAssessment(p,'ouvidoriaInstituida').accepted,expected,`${fact}/${clause}/${status}`);assert.deepEqual(p,before);
  const s=state(p);D.normalizeState(s);const once=D.clone(s);D.normalizeState(s);assert.deepEqual(s,once);assert.equal(r.note,'Nota legada preservada');assert.equal(p.ouvidoria.status,fact);
 }
});

test('3: observação compatível, cláusula expressa e Fala.BR seguem regras existentes',()=>{
 for(const [fact,clause] of [['instituida',false],['pendente',true]]){
  const p=ready();D.setInstitution(p,{ouvidoria:{...p.ouvidoria,status:fact,clause}},'Teste');D.setReview(p,'merito','ouvidoriaInstituida',{status:'obs',note:'Observação compatível',document:'Ato sintético',url:''},'Teste');assert.equal(D.reviewCurrent(p,'merito','ouvidoriaInstituida'),true);assert.equal(p.ouvidoria.status,fact);assert.equal(p.ouvidoria.clause,clause);assert.equal(D.groupProgress(p,'merito').accepted,D.REQUIREMENTS.merito.length);
  for(const status of ['obs','no']){D.setReview(p,'merito','falaBRAdesao',{status,note:'Nota Fala.BR',document:'',url:''},'Teste');assert.equal(D.reviewCurrent(p,'merito','falaBRAdesao'),true);assert.deepEqual(D.blockers(p),[]);}
  conclude(p,'favoravel');assert.equal(D.aptForCelebration(p),true);assert.equal(D.situation(p),fact==='pendente'?'Formalização com cláusula suspensiva':'Apta à celebração');
 }
});

test('3/5: validade diferencia legado, desatualizado, conflito e revisão verificável',()=>{
 const p=ready();assert.equal(D.reviewValidity(p,'pad','11').key,'current');delete p.reviews.pad['11'].evidence;assert.equal(D.reviewValidity(p,'pad','11').key,'legacy');D.markReview(p,'pad','11',true,'Teste');p.imported.pad[0].descricao+=' alterado';assert.equal(D.reviewValidity(p,'pad','11').key,'stale');
 p.ouvidoria.status='na';const r=p.reviews.merito.ouvidoriaInstituida;r.status='obs';r.evidence=D.evidenceOf(p,'merito','ouvidoriaInstituida');assert.equal(D.reviewValidity(p,'merito','ouvidoriaInstituida').key,'institutional-conflict');
});

test('5: PAD preservado retém origem/data da última extração íntegra sem inventar legado',()=>{
 const complete={version:1,status:'complete',source:'íntegra-fixture.csv',at:'2026-09-15T12:00:00Z',received:1,accepted:1,rejected:0,reasons:[]};const p=D.createProposal(data({padExtraction:complete}));
 const partial={version:1,status:'partial',source:'incompleta-fixture.csv',at:'2026-10-02T12:00:00Z',received:2,accepted:1,rejected:1,reasons:[{line:2,itemId:'12',reason:'Quantidade inválida'}]};
 const q=D.syncProposals(state(p),[data({padExtraction:partial})],'fixture').state.proposals[0],c=D.padReferenceContext(q);assert.equal(c.preserved,true);assert.equal(c.reference.source,complete.source);assert.equal(c.reference.at,complete.at);assert.equal(c.attempt.source,partial.source);assert.equal(c.candidateCount,1);assert.deepEqual(q.imported.pad,p.imported.pad);
 const legacy=D.syncProposals(state(D.createProposal(data())),[data({padExtraction:partial})],'fixture').state.proposals[0];assert.equal(D.padReferenceContext(legacy).reference.at,null);assert.equal(D.padReferenceContext(legacy).reference.source,null);
 const empty=D.syncProposals(D.initialState(),[data({padExtraction:partial})],'fixture').state.proposals[0];assert.equal(D.padReferenceContext(empty).hasReference,false);
 const recovered=D.syncProposals(state(q),[data({padExtraction:{...complete,at:'2026-10-03T12:00:00Z'}})],'fixture').state.proposals[0];assert.equal(D.padReferenceContext(recovered).preserved,false);assert.equal(D.padReferenceContext(recovered).reference.at,'2026-10-03T12:00:00Z');
});

test('6: modelo institucional preserva todos os campos reais e desconhecidos sem executar URL',()=>{
 const p=ready();p.ouvidoria={status:'pendente',signature:'2026-09-20',url:'javascript:alert(1)',note:'<img src=x onerror=alert(1)> '+('nota longa '.repeat(60)),clause:true,atoNormativo:{numero:'Ato sintético',data:'2026-09-20'},extra:'Valor desconhecido preservado'};p.falaBR='previsto';const before=D.clone(p),fields=D.institutionalFields(p);
 for(const k of Object.keys(p.ouvidoria))assert.ok(fields.some(f=>f.key==='ouvidoria.'+k));assert.ok(fields.some(f=>f.key==='falaBR'));assert.equal(fields.find(f=>f.key==='ouvidoria.url').value,p.ouvidoria.url);assert.equal(fields.find(f=>f.key==='ouvidoria.url').safeUrl,null);assert.deepEqual(p,before);
});

test('6: URL institucional legada insegura permanece texto; nova edição rejeita sem mutação',t=>{
 const p=ready();p.ouvidoria.url='javascript:alert(1)';const s=state(p),before=D.clone(s);D.validateState(s);assert.deepEqual(s,before);assert.equal(D.institutionalFields(p).find(f=>f.key==='ouvidoria.url').safeUrl,null);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-seis-url-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const store=createStore(dir);store.save({state:s,expected:0,token:null});assert.equal(store.load().state.proposals[0].ouvidoria.url,p.ouvidoria.url);
 const original=D.clone(p);assert.throws(()=>D.setInstitution(p,{ouvidoria:{...p.ouvidoria,note:'Edição nova'}},'Teste'),/HTTP ou HTTPS/);assert.deepEqual(p,original);
});

test('1: fingerprint auditado versão 1 mantém at da diligência e leitura/no-op preservam conclusão',()=>{
 function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v??null);}
 function originalEvidence(p){const values={refs:D.referenceRows(p).filter(r=>['merito','pad'].includes(r.group)).map(r=>({ref:r.ref,evidence:D.evidenceOf(p,r.group,r.id),review:{status:r.review.status,note:r.review.note,at:r.review.at}})).sort((a,b)=>a.ref.localeCompare(b.ref)),padIncomplete:p.padImport?.status==='partial',ouvidoria:p.ouvidoria,falaBR:p.falaBR,diligences:p.diligences.filter(d=>!d.ref.startsWith('celebracao:')).slice().sort((a,b)=>a.id.localeCompare(b.id))};let n=14695981039346656037n;for(const c of canonical(values)){n^=BigInt(c.codePointAt(0));n=BigInt.asUintN(64,n*1099511628211n);}return 'fnv64-v1:'+n.toString(16).padStart(16,'0');}
 for(const result of ['favoravel','desfavoravel']){const p=ready(),d=D.saveDiligence(p,diligence('pad:11'),'Teste');conclude(p,result);p.conclusion.evidence.fingerprint=originalEvidence(p);const before=D.clone(p);assert.equal(D.conclusionCurrent(p),true);D.normalizeState(state(p));assert.deepEqual(p,before);D.saveDiligence(p,D.clone(d),'Teste');assert.deepEqual(p,before);const celebration=D.saveDiligence(p,diligence('celebracao:3'),'Teste');D.saveDiligence(p,{...celebration,request:'Nova providência apenas de celebração'},'Teste');assert.equal(D.conclusionCurrent(p),true);assert.equal(p.conclusion.evidence.fingerprint,originalEvidence(p));}
});

test('1: no-op de diligência confirmada legada conserva prazo e conclusão com payload real do formulário',()=>{
 for(const result of ['favoravel','desfavoravel'])for(const full of [true,false]){
  const p=ready(),d=D.saveDiligence(p,diligence('pad:11'),'Teste');delete d.automaticDeadline;d.science='2026-09-15';d.confirmed=true;d.calendarNote='Conferência histórica sintética';d.unknown={nota:'Campo legado preservado'};
  conclude(p,result);const before=D.clone(p),payload=full?D.clone(d):Object.fromEntries(['id','ref','category','request','communication','response','status','note'].map(k=>[k,d[k]]));if(!full)payload.science='';
  const saved=D.saveDiligence(p,payload,'Teste');assert.deepEqual(p,before);assert.equal(saved,d);assert.equal(D.conclusionCurrent(p),true);assert.equal(d.confirmed,true);assert.equal(d.automaticDeadline,undefined);assert.deepEqual(d.unknown,{nota:'Campo legado preservado'});
  D.saveDiligence(p,{...payload,communication:'2026-09-16'},'Teste');assert.equal(p.diligences[0].automaticDeadline,true);assert.equal(p.diligences[0].confirmed,false);assert.equal(p.diligences[0].due,'2026-09-28');assert.equal(p.diligences[0].science,before.diligences[0].science);assert.deepEqual(p.diligences[0].unknown,before.diligences[0].unknown);assert.equal(D.conclusionCurrent(p),false);assert.equal(p.conclusion.result,result);
 }
});

test('regressão: terminais, centavos e quantidades fracionárias conservam contratos',()=>{
 for(const status of Object.keys(D.DSTATUS))assert.equal(D.diligenceTerminal({status}),['saneada','nao_saneada'].includes(status));
 const p=D.createProposal(data({pad:[{id:'11',descricao:'Quantidade fracionária',quantidade:'2.5',unitario:4040,total:10100}]}));assert.equal(D.finance(p).ok,true);assert.equal(D.unitFromTotal('2.5',10100),4040);assert.equal(D.finance(p).sum,10100);
});
