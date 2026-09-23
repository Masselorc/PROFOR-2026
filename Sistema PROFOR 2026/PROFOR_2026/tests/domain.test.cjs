const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../domain.js');
const T=require('../transferegov.js');
const fs=require('node:fs');
const path=require('node:path');
function data(overrides={}) {return {id:'101',numero:'TESTE-101/2026',uf:'AP',programa:D.PROGRAM,proponente:'DADOS FICTÍCIOS — TESTE',cnpj:'',orgao:'',objeto:'Exclusivo para teste automatizado',situacao:'Teste',data:'2026-09-15',repasse:10000,contrapartida:100,global:10100,pad:[{id:'11',descricao:'Item fictício',quantidade:'2',unitario:5050,total:10100}],...overrides};}
function ready(){const p=D.createProposal(data());for(const r of D.referenceRows(p))p.reviews[r.group][r.id].status='ok';p.ouvidoria.status='instituida';return p;}
test('centavos e vazio sem conversão silenciosa a zero',()=>{assert.equal(D.moneyBR('200.200,20'),20020020);assert.equal(D.moneyBR('0'),0);assert.equal(D.moneyBR(''),null);assert.throws(()=>D.moneyBR('NaN'));assert.throws(()=>D.moneyBR('-1,00'));assert.throws(()=>D.moneyBR('1.2345'));});
test('multiplicação decimal exata e arredondamento',()=>{assert.equal(D.multiply('3',10),30);assert.equal(D.multiply('1.5',101),152);assert.equal(D.multiply('0.01',100),1);assert.equal(D.quantityBR('1.000,25'),'1000.25');assert.throws(()=>D.quantityBR('0'));});
test('unitário derivado do total aceita dízimas sem falso erro',()=>{assert.equal(D.multiply('3',522933),1568799);assert.equal(D.unitFromTotal('3',1568800),522933);assert.equal(D.unitFromTotal('4',244063),61016);assert.equal(D.unitFromTotal('1.5',152),101);assert.equal(D.unitMatchesTotal({quantidade:'3',unitario:522933,total:1568800}),true);assert.equal(D.unitMatchesTotal({quantidade:'3',unitario:522934,total:1568800}),false);});
test('ausência de PAD e valores não equivale a consistência',()=>{const p=D.createProposal(data({pad:null,repasse:null}));assert.equal(D.finance(p).ok,false);assert.ok(D.blockers(p).length);});
test('controles financeiros independentes',()=>{const p=ready();assert.equal(D.finance(p).ok,true);p.imported.pad[0].quantidade='3';assert.equal(D.finance(p).errors.length,1);assert.equal(D.finance(p).pad,true);p.imported.contrapartida=0;assert.equal(D.finance(p).composition,false);});
test('datas inexistentes e mês civil',()=>{assert.throws(()=>D.dateISO('31/02/2026'));assert.equal(D.addMonths('2026-05-31',9),'2027-02-28');assert.equal(D.addMonths('2026-09-15',9),'2027-06-15');});
test('diligência exclui ciência e prorroga fim de semana',()=>{assert.deepEqual(D.deadline('2026-09-16'),{base:'2026-09-26',adjusted:'2026-09-28'});assert.deepEqual(D.deadline(''),{base:'',adjusted:''});assert.deepEqual(D.deadlineBase('','2026-09-16'),{base:'2026-09-26',adjusted:'2026-09-28'});assert.deepEqual(D.deadlineBase('2026-09-10','2026-09-16'),{base:'2026-09-20',adjusted:'2026-09-21'});});
test('estado inicial possui 14 UFs e 20 itens de celebração',()=>{assert.equal(Object.keys(D.UFS).length,14);assert.equal(D.REQUIREMENTS.celebracao.length,20);assert.equal(D.initialState().proposals.length,0);});
test('importação idempotente e ausência de exclusão por omissão',()=>{let s=D.syncProposals(D.initialState(),[data()],'teste').state;const again=D.syncProposals(s,[data()],'teste');assert.equal(again.changes.length,0);assert.equal(D.syncProposals(s,[],'teste').state.proposals.length,1);});
test('sincronização preserva observação, vínculo e diligência; invalida PAD',()=>{const p=ready();p.reviews.pad['11'].note='Pesquisa conferida';p.conclusion={actor:'Teste',at:D.now()};const s={...D.initialState(),proposals:[p]};const changed=data();changed.pad[0].quantidade='1';const out=D.syncProposals(s,[changed],'teste').state.proposals[0];assert.equal(out.reviews.pad['11'].status,'reanalise');assert.equal(out.reviews.pad['11'].note,'Pesquisa conferida');assert.equal(out.conclusion,null);assert.equal(p.reviews.pad['11'].status,'ok');});
test('PAD não fornecido preserva o PAD anterior; PAD vazio remove itens importados',()=>{const s={...D.initialState(),proposals:[ready()]};assert.equal(D.syncProposals(s,[data({pad:null})],'teste').state.proposals[0].imported.pad.length,1);assert.equal(D.syncProposals(s,[data({pad:[]})],'teste').state.proposals[0].imported.pad.length,0);});
test('alteração de sincronização identifica a proposta pela UF',()=>{const nova=D.syncProposals(D.initialState(),[data()],'teste').changes;assert.deepEqual(nova.map(c=>[c.numero,c.uf,c.field]),[['TESTE-101/2026','AP','Proposta']]);const s=D.syncProposals(D.initialState(),[data()],'teste').state;const alterada=data();alterada.pad[0].quantidade='3';const changes=D.syncProposals(s,[alterada],'teste').changes;assert.ok(changes.length>0);assert.ok(changes.every(c=>c.uf==='AP' && c.numero==='TESTE-101/2026'),'Toda alteração deve trazer número e UF da proposta.');});
test('múltiplas propostas da mesma UF não colidem',()=>{const s=D.syncProposals(D.initialState(),[data(),data({id:'102',numero:'TESTE-102/2026'})],'teste');assert.equal(s.state.proposals.length,2);assert.throws(()=>D.syncProposals(D.initialState(),[data(),data()],'teste'));});
test('número da proposta recebe zero à esquerda só na apresentação',()=>{assert.equal(D.fmtProposalNumber('35250/2026'),'035250/2026');assert.equal(D.fmtProposalNumber('135250/2026'),'135250/2026');assert.equal(D.fmtProposalNumber('TESTE-101/2026'),'TESTE-101/2026');});
test('formatação de CNPJ aplica máscara XX.XXX.XXX/XXXX-XX e trata zeros à esquerda',()=>{assert.equal(D.fmtCnpj('07954530000118'),'07.954.530/0001-18');assert.equal(D.fmtCnpj('7954530000118'),'07.954.530/0001-18');assert.equal(D.fmtCnpj('07.954.530/0001-18'),'07.954.530/0001-18');assert.equal(D.fmtCnpj(''),'');assert.equal(D.fmtCnpj(null),'');assert.equal(D.fmtCnpj(undefined),'');});
test('requisito exige justificativa nos estados críticos e permite limpar campos',()=>{const p=ready();assert.throws(()=>D.setReview(p,'merito','destinacao',{status:'no',note:'',document:'',url:''},'Teste'));D.setReview(p,'merito','destinacao',{status:'ok',note:'',document:'',url:''},'Teste');assert.equal(p.reviews.merito.destinacao.note,'');});
test('links executáveis e credenciais são rejeitados',()=>{assert.throws(()=>D.safeLink('javascript:alert(1)'));assert.throws(()=>D.safeLink('https://user:pass@example.com'));assert.equal(D.safeLink('https://example.com'),'https://example.com/');assert.equal(D.esc('<script>'),'&lt;script&gt;');});
test('Fala.BR e cláusula suspensiva não impedem conclusão técnica',()=>{const p=ready();p.falaBR='nao_previsto';p.ouvidoria.status='pendente';p.ouvidoria.clause=true;assert.deepEqual(D.blockers(p),[]);assert.deepEqual(D.blockers(p,true),[]);p.conclusion={actor:'Teste',at:D.now()};assert.equal(D.situation(p),'Formalização com cláusula suspensiva');p.ouvidoria.clause=false;assert.ok(D.blockers(p,true).length);});
test('diligência sem registro impede conclusão',()=>{const p=ready();p.reviews.pad['11'].status='diligencia';assert.equal(D.pending(p).length,1);assert.ok(D.blockers(p).includes('Marcação de diligência sem registro ativo'));});
const diligence=(overrides={})=>({ref:'pad:11',category:'PLANO DE APLICAÇÃO DETALHADO',request:'Comprovar o item fictício',communication:'2026-09-15',science:'2026-09-15',response:'',due:'',confirmed:false,calendarNote:'',status:'aberta',note:'',...overrides});
test('saneamento exige resposta e decisão não é aplicada ao requisito',()=>{const p=ready();p.reviews.pad['11'].status='diligencia';assert.throws(()=>D.saveDiligence(p,diligence({status:'saneada',note:'Ok'}),'Teste'));const d=D.saveDiligence(p,diligence({status:'saneada',note:'Conferido',response:'2026-09-16'}),'Teste');assert.equal(p.reviews.pad['11'].status,'diligencia');assert.equal(D.mayResolveReference(p,d),true);D.saveDiligence(p,diligence(),'Teste');assert.equal(D.mayResolveReference(p,d),false);});
test('vencimento automático ignora edição manual e dispensa conferência',()=>{const p=ready();const d=D.saveDiligence(p,diligence({communication:'2020-09-15',science:'2020-09-16',confirmed:true,due:'2099-01-01',calendarNote:''}),'Teste');assert.equal(d.due,'2020-09-25');assert.equal(d.automaticDeadline,true);assert.equal(d.confirmed,false);assert.equal(d.calendarNote,'');assert.equal(D.diligenceLabel(d),'Prazo expirado');assert.equal(D.validateState({...D.initialState(),proposals:[p]}).proposals[0],p);});
test('prazo recalcula ao editar comunicação e limpa quando ela está vazia',()=>{const p=ready();const first=D.saveDiligence(p,diligence(),'Teste');const updated=D.saveDiligence(p,diligence({id:first.id,communication:'2026-09-16'}),'Teste');assert.equal(updated.due,'2026-09-28');assert.equal(updated.science,'2026-09-15');D.validateState({...D.initialState(),proposals:[p]});const blank=D.saveDiligence(p,diligence({id:first.id,communication:''}),'Teste');assert.equal(blank.due,'');assert.equal(blank.base,'');assert.notEqual(D.diligenceLabel(blank),'Prazo expirado');D.validateState({...D.initialState(),proposals:[p]});});
test('backup valida cálculo automático e preserva registros legados',()=>{const p=ready();const d=D.saveDiligence(p,diligence(),'Teste');const s={...D.initialState(),proposals:[p]};d.due='2026-09-26';assert.throws(()=>D.validateState(s),/Vencimento automático/);delete d.automaticDeadline;d.confirmed=true;d.calendarNote='Conferência histórica';D.validateState(s);const saved=D.saveDiligence(p,{...d,communication:'2026-09-16'},'Teste');assert.equal(saved.due,'2026-09-28');assert.equal(saved.calendarNote,'Conferência histórica');assert.equal(saved.confirmed,false);D.validateState(s);});
test('prazo sem ciência usa a data da comunicação como base',()=>{const p=ready();const d=D.saveDiligence(p,diligence({communication:'2026-09-16',science:'',confirmed:true,due:'2026-09-28',calendarNote:'Feriados conferidos'}),'Teste');assert.equal(d.base,'2026-09-26');assert.equal(d.due,'2026-09-28');assert.equal(d.science,'');assert.equal(D.diligenceLabel(d),D.DSTATUS.aberta);});
test('backup valida versão, status e duplicação',()=>{const s={...D.initialState(),proposals:[ready()]};assert.equal(D.validateState(s),s);assert.throws(()=>D.validateState({...s,schemaVersion:2}));assert.throws(()=>D.validateState({...s,proposals:[ready(),ready()]}));s.proposals[0].reviews.merito.destinacao.status='inventado';assert.throws(()=>D.validateState(s));});
test('textos oficiais ficam fora de imported e sobrevivem à sincronização',()=>{
  const p=ready();
  const textos=D.setTextos(p,{caracterizacao:'  Interesses recíprocos.  ',publicoAlvo:'Pessoas privadas de liberdade',problema:'Déficit de infraestrutura',resultados:'',relacao:'Alinhada ao PROFOR',capacidade:'Estrutura própria',justificativa:''},'Teste');
  assert.equal(textos.caracterizacao,'Interesses recíprocos.','Campos são aparados');
  assert.equal(textos.resultados,'','Campo ausente vira texto vazio, sem inventar conteúdo');
  assert.ok(textos.at,'Guarda a data de obtenção');
  assert.deepEqual(Object.keys(textos).sort(),['at','capacidade','caracterizacao','justificativa','problema','publicoAlvo','relacao','resultados']);
  assert.equal(p.history.at(-1).actor,'Teste');
  assert.equal(p.imported.textos,undefined,'Textos não entram no retrato da extração');
  const s={...D.initialState(),proposals:[p]};
  D.validateState(s);
  const sincronizado=D.syncProposals(s,[{...data(),objeto:'Objeto atualizado na origem'}],'teste').state.proposals[0];
  assert.deepEqual(sincronizado.textos,textos,'A sincronização não apaga os textos oficiais');
  assert.equal(sincronizado.imported.objeto,'Objeto atualizado na origem');
});
test('textos oficiais inválidos são recusados sem alterar a proposta',()=>{
  const p=ready(),before=D.clone(p);
  assert.throws(()=>D.setTextos(p,{caracterizacao:'x'.repeat(200001)},'Teste'),/excessivo/,'Texto acima do limite é recusado');
  assert.deepEqual(p,before);
  p.textos={at:D.now(),caracterizacao:'ok'};
  assert.throws(()=>D.validateState({...D.initialState(),proposals:[p]}),/Texto oficial inválido/,'Falta de campo é recusada');
  p.textos=D.setTextos(ready(),{caracterizacao:'ok'},'Teste');p.textos.publicoAlvo=42;
  assert.throws(()=>D.validateState({...D.initialState(),proposals:[p]}),/Texto oficial inválido/,'Campo não textual é recusado');
  p.textos=D.setTextos(ready(),{caracterizacao:'ok'},'Teste');delete p.textos.at;
  assert.throws(()=>D.validateState({...D.initialState(),proposals:[p]}),/sem data de obtenção/);
  const vazio=D.setTextos(ready(),null,'Teste');
  assert.equal(Object.entries(vazio).filter(([k])=>k!=='at').every(([,v])=>v===''),true,'Origem sem texto guarda campos vazios, nunca conteúdo inventado');
  const legado=ready();assert.equal(legado.textos,undefined);D.validateState({...D.initialState(),proposals:[legado]});
});
test('marcação direta de conformidade grava em um clique e cobra justificativa depois',()=>{
  const p=ready(),s={...D.initialState(),proposals:[p]};
  D.markReview(p,'merito','destinacao',true,'Teste');
  assert.equal(D.reviewOf(p,'merito','destinacao').status,'ok','Conformidade grava como atende');
  assert.deepEqual(D.semJustificativa(p),[]);
  D.markReview(p,'merito','destinacao',false,'Teste');
  assert.equal(D.reviewOf(p,'merito','destinacao').status,'no','Não conformidade grava como não atende');
  assert.deepEqual(D.semJustificativa(p).map(x=>x.ref),['merito:destinacao'],'Item sem justificativa é identificado');
  assert.ok(D.blockers(p).some(x=>/sem justificativa/.test(x)),'A conclusão fica bloqueada até justificar');
  D.validateState(s); // O banco aceita a marcação direta; a cobrança é pendência, não recusa do dado.
  D.setReview(p,'merito','destinacao',{status:'no',note:'Não comprova o item 4.2 do edital.',document:'',url:''},'Teste');
  assert.deepEqual(D.semJustificativa(p),[]);
  assert.ok(!D.blockers(p).some(x=>/sem justificativa/.test(x)),'Justificar libera a conclusão');
  D.markReview(p,'merito','destinacao',true,'Teste');
  assert.equal(D.reviewOf(p,'merito','destinacao').note,'Não comprova o item 4.2 do edital.','Remarcar preserva a observação');
  D.markReview(p,'merito','destinacao',null,'Teste');
  assert.equal(D.reviewOf(p,'merito','destinacao').status,'na','Clicar no botão já marcado volta a não analisado');
  assert.equal(D.reviewOf(p,'merito','destinacao').note,'Não comprova o item 4.2 do edital.','Voltar atrás não apaga a observação');
  assert.throws(()=>D.setReview(p,'merito','destinacao',{status:'no',note:'',document:'',url:''},'Teste'),/justificativa/,'O formulário continua exigindo justificativa');
  assert.throws(()=>D.markReview(p,'merito','destinacao','sim','Teste'),/Marcação inválida/);
  assert.equal(p.history.filter(h=>/Avaliação: merito \/ destinacao/.test(h.event)).length,5,'Toda marcação entra no histórico');
});
test('clone preserva undefined sem lançar "undefined is not valid JSON"',()=>{
  assert.equal(D.clone(undefined),undefined);
  assert.deepEqual(D.clone({a:1}),{a:1});
});
test('sincronização de banco antigo sem vigência não quebra (regressão 21/09/2026)',()=>{
  const semVigencia=data();
  assert.ok(!('vigenciaInicio' in semVigencia) && !('vigenciaFim' in semVigencia),'fixture antiga não tem vigência');
  const s={...D.initialState(),proposals:[D.createProposal(semVigencia)]};
  D.validateState(s);
  const comVigencia={...data(),vigenciaInicio:'2026-09-11',vigenciaFim:'2028-03-11'};
  D.validateImported(comVigencia);
  const out=D.syncProposals(s,[comVigencia],'teste');
  const campos=out.changes.map(c=>c.field);
  assert.ok(campos.includes('vigenciaInicio') && campos.includes('vigenciaFim'));
  const vig=out.changes.find(c=>c.field==='vigenciaInicio');
  assert.equal(vig.before,undefined);
  assert.equal(vig.after,'2026-09-11');
  assert.equal(out.state.proposals[0].imported.vigenciaInicio,'2026-09-11');
});
test('CSV protege fórmulas de planilha',()=>{const s={...D.initialState(),proposals:[D.createProposal(data({proponente:'=HYPERLINK("https://example.com")'}))]};assert.match(D.exportCSV(s),/"'=HYPERLINK/);});
test('parser CSV aceita aspas, quebras e chunks de um caractere',()=>{const result=[];const parser=T.csvParser(row=>result.push(row));for(const c of '\uFEFFA;B\r\n"a;\nb";"c""d"\r\n')parser.feed(c);parser.finish();assert.deepEqual(result,[['A','B'],['a;\nb','c"d']]);const bad=T.csvParser(()=>{});bad.feed('"abc');assert.throws(()=>bad.finish());});
test('adaptador cruza programa e propostas pelos IDs oficiais',async()=>{
  const file=name=>new File([fs.readFileSync(path.join(__dirname,'fixtures',name))],name);
  const files={program:file('siconv_programa.csv'),links:file('siconv_programa_proposta.csv'),proposal:file('siconv_proposta.csv'),pad:file('siconv_plano_aplicacao_detalhado.csv')};
  const result=await T.importFiles(files);assert.equal(result.proposals.length,1);assert.equal(result.proposals[0].id,'101');assert.equal(result.proposals[0].global,10100);assert.equal(result.proposals[0].pad[0].id,'11');assert.equal(result.proposals[0].orgao,'');
});
/* --- Apagar e restaurar propostas, e situação geral da UF --- */
test('situação da UF: havendo uma enviada, prevalece "Enviada para análise"',()=>{
  const enviada=D.createProposal(data({id:'201',numero:'A/2026',situacao:'Proposta/Plano de Trabalho Enviado para Análise'}));
  const elaborando=D.createProposal(data({id:'202',numero:'B/2026',situacao:'Proposta/Plano de Trabalho Cadastrados'}));
  assert.equal(D.ufState([elaborando]).key,'elaboracao');
  assert.equal(D.ufState([enviada]).key,'enviada');
  assert.equal(D.ufState([elaborando,enviada]).key,'enviada');
  /* Vocabulário do Transferegov: enviada para análise = "Enviada para análise";
     salva e ainda não enviada = "Em elaboração". O termo da enviada foi escolhido
     para casar com o literal da extração ("...Enviado para Análise") e evitar
     leitura invertida ao lado do texto oficial. */
  assert.equal(D.ufState([enviada,elaborando]).label,'Enviada para análise');
  assert.equal(D.ufState([elaborando]).label,'Em elaboração');
  assert.equal(D.ufState([]).label,'Sem proposta importada');
  const apagada=D.createProposal(data({id:'203',numero:'C/2026',situacao:'Proposta/Plano de Trabalho Enviado para Análise'}));
  D.deleteProposal(apagada,'Teste');
  assert.equal(D.ufState([apagada,elaborando]).key,'elaboracao','apagada não pode influenciar a situação da UF');
});
test('ordenação por envio: enviadas primeiro, da mais antiga para a mais nova',()=>{
  const criar=(id,numero,dia,situacao)=>D.createProposal(data({id,numero,data:dia,situacao}));
  const recente=criar('301','3/2026','2026-09-14','Proposta/Plano de Trabalho Enviado para Análise');
  const antiga=criar('302','1/2026','2026-09-08','Proposta/Plano de Trabalho Enviado para Análise');
  const elaborando=criar('303','2/2026','2026-09-11','Proposta/Plano de Trabalho Cadastrados');
  const ordem=D.orderBySend([recente,elaborando,antiga]).map(x=>x.imported.numero);
  assert.deepEqual(ordem,['1/2026','3/2026','2/2026']);
});
test('apagar tira do painel sem excluir do banco; restaurar devolve',()=>{
  const s={...D.initialState(),proposals:[D.createProposal(data())]};
  assert.equal(D.activeProposals(s).length,1);
  const proposta=s.proposals[0];
  D.deleteProposal(proposta,'Fulano');
  assert.equal(proposta.isDeleted,true);
  assert.equal(typeof proposta.deletedAt,'string');
  assert.equal(proposta.deletedBy,'Fulano');
  assert.equal(D.activeProposals(s).length,0);
  assert.equal(D.deletedProposals(s).length,1);
  assert.equal(s.proposals.length,1,'a proposta não é removida do banco');
  assert.equal(proposta.history.at(-1).event,'Proposta apagada do painel');
  assert.equal(D.validateState(s),s,'estado com proposta apagada continua válido');
  D.restoreProposal(proposta,'Fulano');
  assert.equal(proposta.isDeleted,false);
  assert.equal(proposta.deletedBy,'');
  assert.equal(D.activeProposals(s).length,1);
  assert.equal(D.deletedProposals(s).length,0);
  assert.equal(proposta.history.at(-1).event,'Proposta restaurada para o painel');
  assert.throws(()=>D.restoreProposal(proposta,'Fulano'),/não está apagada/);
  D.deleteProposal(proposta,'Fulano');
  assert.throws(()=>D.deleteProposal(proposta,'Fulano'),/já está apagada/);
});
test('proposta apagada continua apagada após sincronizar',()=>{
  const p=D.createProposal(data());
  D.deleteProposal(p,'Fulano');
  const s={...D.initialState(),proposals:[p]};
  const depois=D.syncProposals(s,[data()],'teste').state;
  assert.equal(depois.proposals[0].isDeleted,true,'a sincronização não pode ressuscitar proposta apagada');
  assert.equal(D.activeProposals(depois).length,0);
  /* e a restauração volta a participar */
  D.restoreProposal(depois.proposals[0],'Fulano');
  assert.equal(D.activeProposals(depois).length,1);
});
test('exportação CSV ignora propostas apagadas',()=>{
  const a=D.createProposal(data({id:'401',numero:'X/2026'}));
  const b=D.createProposal(data({id:'402',numero:'Y/2026'}));
  D.deleteProposal(b,'Teste');
  const csv=D.exportCSV({...D.initialState(),proposals:[a,b]});
  assert.match(csv,/X\/2026/);
  assert.ok(!csv.includes('Y/2026'),'proposta apagada não pode sair no CSV');
});
/* A etapa da proposta na origem é diferente do andamento da análise aqui no sistema.
   "Proposta/Plano de Trabalho Cadastrados" é o estado anterior a "Enviar para Análise"
   (SEI nº 36184012): a proposta existe e tem número, mas não foi submetida. */
test('etapa na origem: cadastrada ainda não foi enviada para análise',()=>{
  assert.equal(D.sourceState({situacao:'Proposta/Plano de Trabalho Cadastrados'}).key,'cadastrada');
  assert.equal(D.sourceState({situacao:'Proposta/Plano de Trabalho em Elaboração'}).key,'cadastrada');
  assert.equal(D.sourceState({situacao:'Proposta/Plano de Trabalho Enviado para Análise'}).key,'enviada');
  assert.equal(D.sourceState({situacao:'Proposta/Plano de Trabalho Rejeitados'}).key,'rejeitada');
  assert.equal(D.sourceState({situacao:''}).key,'desconhecida');
  assert.equal(D.sourceState({situacao:'Situação nunca vista'}).key,'desconhecida');
  assert.equal(D.sourceState({situacao:''}).indefinida,true);
  assert.equal(D.sourceState({situacao:'Proposta/Plano de Trabalho Cadastrados'}).indefinida,false);
  assert.equal(D.sourceState({situacao:'Perfeita para análise'}).key,'desconhecida');
  /* Vocabulário exibido ao analista, decidido com o usuário em 15/09/2026:
     não enviada -> "Em elaboração"; enviada para análise -> "Enviada para análise"
     (escolhido para casar com o literal "…Enviado para Análise" da extração).
     O texto literal continua acessível em `.raw`, para auditoria. */
  assert.equal(D.sourceState({situacao:'Proposta/Plano de Trabalho Cadastrados'}).label,'Em elaboração');
  assert.equal(D.sourceState({situacao:'Proposta/Plano de Trabalho Enviado para Análise'}).label,'Enviada para análise');
  assert.equal(D.sourceState({situacao:'Proposta/Plano de Trabalho Cadastrados'}).raw,'Proposta/Plano de Trabalho Cadastrados');
  assert.equal(D.sourceState({situacao:'Nunca vista'}).label,'Status não mapeado — conferir na origem');
});
test('situação mostra "Em elaboração na origem" quando a proposta não foi enviada',()=>{
  assert.equal(D.situation(ready()),'Em análise');
  assert.equal(D.situation(D.createProposal(data({situacao:'Proposta/Plano de Trabalho Cadastrados'}))),'Em elaboração na origem','andamento ONASP da proposta ainda não enviada');
  assert.equal(D.situation(D.createProposal(data({situacao:'Proposta/Plano de Trabalho Enviado para Análise'}))),'Em análise');
  const enviada=ready();enviada.imported.situacao='Proposta/Plano de Trabalho Enviado para Análise';enviada.conclusion={actor:'Teste',at:D.now()};
  assert.equal(D.situation(enviada),'Apta à celebração');
});
test('etapa da origem não altera PAD, valores nem bloqueios da análise',()=>{
  const a=D.createProposal(data({situacao:'Proposta/Plano de Trabalho Cadastrados'}));
  const b=D.createProposal(data({situacao:'Proposta/Plano de Trabalho Enviado para Análise'}));
  assert.equal(D.finance(a).ok,D.finance(b).ok);
  assert.deepEqual(D.blockers(a),D.blockers(b));
  assert.equal(a.imported.pad.length,b.imported.pad.length);
});
/* --- Requisitos da Proposta x Requisitos para Formalização ---
   A Lista de Conferência dos autos (SEI nº 36183977) é conferida em duas etapas: os
   itens analisados na proposta (Nota Técnica 231, SEI 33381502, e Parecer 15, SEI
   33369201) e os conferidos no ato da celebração. A divisão é de TELA: as duas abas
   leem e gravam a mesma coleção `reviews.celebracao`, sem estado duplicado, sem
   migração de banco e sem invalidar vínculos de diligência ou backups anteriores. */
test('as duas abas de celebração cobrem os 20 itens da lista, sem sobreposição',()=>{
  const proposta=D.ABAS_CELEBRACAO.find(a=>a.id==='proposta'),formal=D.ABAS_CELEBRACAO.find(a=>a.id==='formalizacao');
  assert.ok(proposta && formal);
  assert.equal(proposta.titulo,'Requisitos da Proposta');
  assert.equal(formal.titulo,'Requisitos para Formalização');
  const idsProposta=D.CELEBRACAO.filter(x=>x.aba==='proposta').map(x=>x.id);
  const idsFormal=D.CELEBRACAO.filter(x=>x.aba==='formalizacao').map(x=>x.id);
  /* Itens 2, 3, 4, 5, 6, 7 e 11 são os analisados nos dois pareceres dos autos. */
  assert.deepEqual(idsProposta,['2','3','4','5','6','7','11']);
  assert.equal(idsProposta.length+idsFormal.length,20);
  assert.equal(new Set([...idsProposta,...idsFormal]).size,20);
  assert.deepEqual([...idsProposta,...idsFormal].sort(),D.REQUIREMENTS.celebracao.map(([id])=>id).sort());
});
test('cada item da Lista de Conferência traz fundamentação e comprovação transcritas',()=>{
  for(const x of D.CELEBRACAO){
    assert.ok(['proposta','formalizacao'].includes(x.aba),`aba inválida no item ${x.id}`);
    assert.ok(x.label.trim(),`título ausente no item ${x.id}`);
    assert.ok(x.fundamentacao.trim(),`fundamentação ausente no item ${x.id}`);
    assert.ok(x.comprovacao.trim(),`comprovação ausente no item ${x.id}`);
  }
  /* Subtexto do item 1.1, conferido contra os autos. */
  const d=D.celebracaoItem('1.1');
  assert.equal(d.label,'Delegação de competência');
  assert.match(d.sub,/INTERVENIENTE \(conforme art\. 38, § 3º da Portaria Conjunta nº 33\/2023\)/);
  assert.match(d.sub,/modelo anexo 1 \(p\. 6\)/);
  assert.match(d.fundamentacao,/Art\. 38, § 3º/);
  assert.match(d.comprovacao,/Requisitos para celebração/);
  const cauc=D.celebracaoItem('19');
  assert.match(cauc.fundamentacao,/Art\. 29, I, II, III/);
  assert.match(cauc.comprovacao,/Requisitos para celebração/);
});
test('as duas abas gravam no mesmo item, sem estado duplicado',()=>{
  const p=D.createProposal(data());
  assert.deepEqual(Object.keys(p.reviews),['merito','celebracao','pad'],'Habilitação deixou de existir como grupo de análise');
  assert.deepEqual(D.rows(p,'habilitacao'),[],'grupo extinto devolve lista vazia, sem quebrar telas antigas');
  assert.equal(D.groupProgress(p,'habilitacao').total,0);
  assert.ok(!D.blockers(p).some(x=>/Habilita/i.test(x)),'grupo vazio não pode bloquear a conclusão');
  D.setReview(p,'proposta','4',{status:'ok',note:'TR conferido',document:'TR.pdf',url:''},'Teste');
  assert.equal(D.reviewOf(p,'proposta','4').status,'ok');
  assert.equal(p.reviews.celebracao['4'].status,'ok','a aba não cria coleção própria');
  assert.equal(D.groupProgress(p,'proposta').done,1);
  assert.equal(D.groupProgress(p,'formalizacao').done,0);
  assert.equal(D.groupProgress(p,'celebracao').done,1);
  D.setReview(p,'formalizacao','1.1',{status:'obs',note:'Confere ressalva',document:'',url:''},'Teste');
  assert.equal(p.reviews.celebracao['1.1'].status,'obs');
  assert.equal(D.groupProgress(p,'formalizacao').done,1);
  assert.equal(D.groupProgress(p,'proposta').done,1);
  assert.throws(()=>D.setReview(p,'proposta','1.1',{status:'ok',note:'',document:'',url:''},'Teste'),/Requisito não encontrado/,'item 1.1 é da formalização');
});
test('aba e vínculo de diligência mantêm a chave de armazenamento (celebracao:<item>)',()=>{
  const p=ready();
  assert.equal(D.tabLabel('proposta','2'),'Requisitos da Proposta');
  assert.equal(D.tabLabel('formalizacao','1.1'),'Requisitos para Formalização');
  assert.equal(D.tabLabel('celebracao','1.1'),'Requisitos para Formalização');
  assert.equal(D.tabLabel('merito','destinacao'),'Mérito');
  const refs=D.referenceRows(p).filter(r=>r.group==='celebracao');
  assert.equal(refs.length,20);
  assert.equal(refs.find(r=>r.id==='1.1').ref,'celebracao:1.1');
  assert.equal(refs.find(r=>r.id==='1.1').tab,'Requisitos para Formalização');
  /* id numérico do PAD não pode herdar metadados da celebração */
  assert.equal(D.metaRequisito('pad','11'),null);
  assert.equal(D.metaRequisito('habilitacao','prazo'),null);
  assert.equal(D.metaRequisito('proposta','11').label,'Declaração de Capacidade Técnica e Gerencial');
});
test('pendências nomeiam as duas abas; conclusão técnica segue sem elas',()=>{
  const p=D.createProposal(data());
  const b=D.blockers(p,true);
  assert.ok(b.includes('Requisitos da Proposta: 0/7 atendidos'),b.join(' | '));
  assert.ok(b.includes('Requisitos para Formalização: 0/13 atendidos'));
  assert.ok(!b.some(x=>x.startsWith('celebracao:')),'nome do grupo não pode vazar para a tela');
  assert.ok(!D.blockers(p).some(x=>x.startsWith('Requisitos')),'celebração não bloqueia a conclusão técnica');
});
test('backup anterior (reviews.celebracao) continua válido nas duas abas',()=>{
  const p=ready();
  const s=JSON.parse(JSON.stringify({...D.initialState(),proposals:[p]}));
  assert.equal(D.validateState(s),s);
  assert.equal(D.reviewOf(s.proposals[0],'proposta','4').status,'ok');
  assert.equal(D.reviewOf(s.proposals[0],'formalizacao','1.1').status,'ok');
  /* Requisito ausente no banco antigo é completado em branco (nunca como
     atendido), o que permite criar ou retirar item sem migração; status
     inválido continua sendo recusado. */
  delete s.proposals[0].reviews.celebracao['19'];
  assert.equal(D.validateState(s),s);
  assert.equal(D.reviewOf(s.proposals[0],'proposta','19').status,'na');
  s.proposals[0].reviews.celebracao['19'].status='inventado';
  assert.throws(()=>D.validateState(s),/Status de análise inválido/);
});
/* --- Por que a aba PAD aparece vazia ---
   São duas causas opostas e a tela precisa dizer qual é: o arquivo do PAD não foi
   baixado (sincronização rápida, `pad` nulo) ou o arquivo foi lido e a proposta
   realmente não tem item publicado nos dados abertos do Transferegov (`pad` vazio).
   Medido nos dados oficiais em 15/09/2026: das 12 propostas do programa, só a
   RS 35250/2026 tem itens (14); nenhuma das 6 de PE tem, nem a única já enviada. */
test('PAD vazio distingue "não carregado" de "sem itens publicados na origem"',()=>{
  const semArquivo=D.createProposal(data({pad:null}));
  const semItens=D.createProposal(data({pad:[]}));
  const comItens=D.createProposal(data());
  const sync={at:'2026-09-15T15:36:00.000Z',source:{pad:true},count:12};
  assert.equal(D.padSituacao(semArquivo,sync).key,'nao-carregado');
  assert.match(D.padSituacao(semArquivo,sync).detalhe,/sincronização foi a rápida/);
  assert.match(D.padSituacao(semArquivo,sync).detalhe,/15\/09\/2026/);
  assert.equal(D.padSituacao(semArquivo,null).key,'nao-carregado','sem sincronização registrada ainda é "não carregado"');
  assert.equal(D.padSituacao(semItens,sync).key,'sem-itens');
  assert.match(D.padSituacao(semItens,sync).detalhe,/Não é falha do sistema/);
  assert.equal(D.padSituacao(comItens,sync).key,'com-itens');
  assert.equal(D.padSituacao(comItens,sync).titulo,'1 item(ns) publicado(s)');
  assert.equal(D.padSituacao(comItens,sync).detalhe,'');
  /* Nos dois casos a aba fica sem itens conferíveis e o financeiro acusa PAD completo ausente. */
  assert.equal(D.finance(semArquivo).padComplete,false);
  assert.equal(D.finance(semItens).padComplete,false);
  assert.equal(D.finance(comItens).padComplete,true);
});
test('gestão de anexos por requisito: adicionar, listar, remover, validar limites e integridade',()=>{
  const p=ready();
  const fileValido={name:'termo_referencia.pdf',size:102400,type:'application/pdf',data:'data:application/pdf;base64,JVBERi0xLjQK...',note:'TR assinado SEI 12345'};
  const att=D.addAttachment(p,'proposta','4',fileValido,'Marcelo');
  assert.ok(att.id.startsWith('att-'));
  assert.equal(att.name,'termo_referencia.pdf');
  assert.equal(att.uploadedBy,'Marcelo');
  assert.equal(p.reviews.celebracao['4'].attachments.length,1);
  assert.equal(p.reviews.celebracao['4'].attachments[0].name,'termo_referencia.pdf');
  assert.ok(p.history.some(h=>h.event.includes('Anexo adicionado ao requisito 4')));

  /* setReview subsequente preserva os anexos existentes */
  D.setReview(p,'proposta','4',{status:'ok',note:'Análise aprovada',document:'TR',url:''},'Marcelo');
  assert.equal(p.reviews.celebracao['4'].attachments.length,1);

  /* Rejeição de arquivo acima de 25 MB */
  assert.throws(()=>D.addAttachment(p,'proposta','4',{name:'pesado.zip',size:26*1024*1024,data:'data:application/zip;base64,...'},'Marcelo'),/maior que 25 MB/);

  /* Rejeição de arquivo com data inválido ou sem nome */
  assert.throws(()=>D.addAttachment(p,'proposta','4',{name:'',size:100,data:'data:text/plain;base64,QQ=='},'Marcelo'),/Nome do arquivo/);
  assert.throws(()=>D.addAttachment(p,'proposta','4',{name:'x.pdf',size:100,data:'http://invalido'},'Marcelo'),/formato inválido/);

  /* Remoção de anexo */
  const removed=D.removeAttachment(p,'proposta','4',att.id,'Marcelo');
  assert.equal(removed.id,att.id);
  assert.equal(p.reviews.celebracao['4'].attachments.length,0);
  assert.ok(p.history.some(h=>h.event.includes('Anexo removido do requisito 4')));
});
