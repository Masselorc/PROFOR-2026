/* Regras puras. Valores monetários são inteiros de centavos. */
(function (root) {
  'use strict';
  const UFS = {AP:'Amapá', AM:'Amazonas', BA:'Bahia', CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás', MG:'Minas Gerais', PA:'Pará', PE:'Pernambuco', RN:'Rio Grande do Norte', RS:'Rio Grande do Sul', RR:'Roraima', SE:'Sergipe'};
  const PROGRAM = '3000020260022';
  /* Lista de Conferência da celebração — autos, SEI nº 36183977 ("Lista de
     conferência dos requisitos para CELEBRAÇÃO de instrumentos nos termos da
     Portaria Conjunta MGI/MF/CGU nº 28, de 21 de maio de 2024"). Para cada item:
     · `label`         — título curto usado nas telas e no relatório;
     · `sub`           — o teor restante da coluna "Requisitos" da lista, transcrito;
     · `fundamentacao` — coluna "Fundamentação" da lista;
     · `comprovacao`   — coluna "Comprovação" da lista;
     · `aba`           — onde o requisito é conferido:
         'proposta'     → requisitos analisados na Nota Técnica 231 (SEI 33381502)
                          e no Parecer 15 (SEI 33369201), na análise da proposta;
         'formalizacao' → requisitos conferidos no ato da celebração. */
  const CELEBRACAO = [
    {id:'1',aba:'formalizacao',label:'Cadastro atualizado no Transferegov.br',sub:'',
     fundamentacao:'Art. 8º, §§ 2º e 3º, e art. 33, I, da Portaria Conjunta MGI/MF/CGU nº 33, de 2023',
     comprovacao:'Inserção na aba "Participantes" no Transferegov.br.'},
    {id:'1.1',aba:'formalizacao',label:'Delegação de competência',sub:'Quando houver, assinado pelo(a) Governador(a); caso não haja Delegação de Competência, o(a) Governador(a) assinará o Termo de Convênio como INTERVENIENTE (conforme art. 38, § 3º da Portaria Conjunta nº 33/2023). Normativo delegando ou Declaração de Delegação de Competência — modelo anexo 1 (p. 6).',
     fundamentacao:'Art. 38, § 3º, da Portaria Conjunta MGI/MF/CGU nº 33, de 2023',
     comprovacao:'Inserção na aba "Requisitos para celebração" no Transferegov.br.'},
    {id:'2',aba:'proposta',label:'Proposta de trabalho',sub:'',
     fundamentacao:'Art. 18 da Portaria Conjunta MGI/MF/CGU nº 33, de 2023',
     comprovacao:'Preenchimento e envio pelo Transferegov.br para análise do concedente.'},
    {id:'3',aba:'proposta',label:'Plano de trabalho',sub:'',
     fundamentacao:'Art. 20 da Portaria Conjunta MGI/MF/CGU nº 33, de 2023',
     comprovacao:'Preenchimento e envio pelo Transferegov.br para análise do concedente.'},
    {id:'4',aba:'proposta',label:'Termo de Referência',sub:'Nos termos do art. 7º, II, da Portaria Conjunta MGI/MF/CGU nº 28, de 2024. Assinado pelo Responsável Técnico que elaborou o Projeto Básico ou Termo de Referência e pelo Gestor responsável pelo órgão de Administração Penitenciária do Estado.',
     fundamentacao:'Art. 7º da Portaria Conjunta MGI/MF/CGU nº 28, de 2024',
     comprovacao:'Inserção na aba "Projeto Básico/Termo de Referência" no Transferegov.br.'},
    {id:'5',aba:'proposta',label:'Plano de Sustentabilidade',sub:'Através do Termo de Referência, atestando a continuidade da política pública, a manutenção dos equipamentos e os esforços para que haja fruição por parte do público-alvo beneficiado pelo projeto. Ou declaração assinada pelo Responsável Técnico que elaborou o Termo de Referência e pelo Gestor responsável pelo órgão de Administração Penitenciária do Estado, conforme modelo anexo 2 (p. 7).',
     fundamentacao:'Art. 7º da Portaria Conjunta MGI/MF/CGU nº 28, de 2024',
     comprovacao:'Inserção na aba "Requisitos para celebração" no Transferegov.br.'},
    {id:'6',aba:'proposta',label:'Declaração de Compatibilidade de Preços e propostas orçamentárias',sub:'Atestando que as propostas estão com preços compatíveis aos praticados no mercado, consoante o que consta no art. 23 da Lei nº 14.133/2021 e no art. 21 da Portaria Conjunta MGI/MF/CGU nº 33, de 2023, assim como apresentação de 03 (três) propostas orçamentárias para aquisição de equipamentos e materiais de consumo, equipamentos em geral, bem como contratação de terceiros, pessoa jurídica e/ou física. Declaração assinada pelo Gestor responsável pelo órgão de Administração Penitenciária do Estado, conforme modelo anexo 3 (p. 8).',
     fundamentacao:'Art. 21 da Portaria Conjunta MGI/MF/CGU nº 33, de 2023',
     comprovacao:'Inserção na aba "Requisitos para celebração" no Transferegov.br.'},
    {id:'7',aba:'proposta',label:'Declaração de Contrapartida detalhada e Quadro de Detalhamento de Despesas',sub:'Deve ser baseada no Quadro de Detalhamento de Despesas — QDD, observando os limites estabelecidos no programa pelo concedente. O QDD (extrato de publicação), do convenente, deve demonstrar a existência de dotação orçamentária específica que garanta a contrapartida. Declaração assinada pelo Gestor responsável pelo órgão de Administração Penitenciária do Estado, conforme modelo anexo 4 (p. 9), e extrato de publicação do QDD.',
     fundamentacao:'Arts. 32, §§ 1º e 2º, e 33, V, da Portaria Conjunta MGI/MF/CGU nº 33, de 2023',
     comprovacao:'Inserção na aba "Dados" no Transferegov.br.'},
    {id:'8',aba:'formalizacao',label:'Atendimento à Resolução CNPCP nº 1, de 29 de abril de 2008',sub:'Extrato de publicação do Plano Diretor do Sistema Penitenciário Estadual ou declaração de sua existência, de acordo com a Resolução CNPCP nº 1/2008, assinada pelo Gestor responsável pelo órgão de Administração Penitenciária do Estado, conforme modelo anexo 5 (p. 10).',
     fundamentacao:'Resolução CNPCP nº 1, de 29 de abril de 2008',
     comprovacao:'Inserção na aba "Requisitos para celebração" no Transferegov.br.'},
    {id:'9',aba:'formalizacao',label:'Atendimento à Portaria Interministerial MJSP nº 210, de 16 de janeiro de 2014 (PNAMPE)',sub:'Declaração assinada pelo Gestor responsável pelo órgão de Administração Penitenciária do Estado, conforme modelo anexo 6 (p. 11).',
     fundamentacao:'Art. 13 da Portaria Interministerial nº 210, de 16 de janeiro de 2014',
     comprovacao:'Inserção na aba "Requisitos para celebração" no Transferegov.br.'},
    {id:'10',aba:'formalizacao',label:'Declaração de não duplicidade do objeto',sub:'Comprovando a inexistência de convênio ou proposta, com outros órgãos do Poder Executivo Federal, com o mesmo objeto do pleito apresentado ao SENAPPEN. Declaração assinada pelo Gestor responsável pelo órgão de Administração Penitenciária do Estado, conforme modelo anexo 7 (p. 12).',
     fundamentacao:'Acórdão nº 972/2018 — Plenário do TCU, de 02/05/2018',
     comprovacao:'Inserção na aba "Requisitos para celebração" no Transferegov.br.'},
    {id:'11',aba:'proposta',label:'Declaração de Capacidade Técnica e Gerencial',sub:'Existência de área gestora dos recursos recebidos por transferência voluntária da União, com atribuições definidas para gestão, celebração, execução e prestação de contas, com lotação de, no mínimo, um servidor ou empregado público efetivo, em cumprimento ao Acórdão nº 1.905, de 2017, do Plenário do Tribunal de Contas da União. Declaração do Chefe do Poder Executivo ou do Secretário de Finanças, válida no mês da assinatura, conforme modelo anexo 8 (p. 13).',
     fundamentacao:'Art. 29, VII, da Portaria Conjunta MGI/MF/CGU nº 33, de 2023',
     comprovacao:'Inserção na aba "Dados" no Transferegov.br.'},
    {id:'12',aba:'formalizacao',label:'Inexistência de legislação de cobrança de taxa de administração',sub:'Declaração de inexistência, na localidade de execução do objeto, de legislação do proponente que estabeleça a cobrança de taxa de administração de contrato, em consonância com a vedação do art. 21, parágrafo único, inciso I, da Portaria Conjunta nº 33/2023. Declaração do Chefe do Poder Executivo ou do Secretário de Finanças, válida no mês da assinatura, conforme modelo anexo 8 (p. 13).',
     fundamentacao:'Art. 29, XXXIV, da Portaria Conjunta MGI/MF/CGU nº 33, de 2023',
     comprovacao:'Inserção na aba "Requisitos para celebração" no Transferegov.br.'},
    {id:'13',aba:'formalizacao',label:'Regularidade na relação de empresas públicas e sociedades de economia mista',sub:'Declaração de regularidade no fornecimento da relação das empresas públicas e das sociedades de economia mista ao Registro Público de Empresas Mercantis e Atividades Afins, nos termos do art. 92 da Lei nº 13.303, de 30 de junho de 2016. Declaração do Chefe do Poder Executivo ou do Secretário de Finanças, válida no mês da assinatura, conforme modelo anexo 9 (p. 14).',
     fundamentacao:'Art. 29, XX, da Portaria Conjunta MGI/MF/CGU nº 33, de 2023',
     comprovacao:'Inserção na aba "Requisitos para celebração" no Transferegov.br.'},
    {id:'14',aba:'formalizacao',label:'Regularidade na contratação de operação de crédito',sub:'Declaração de regularidade na contratação de operação de crédito com instituição financeira, nos termos do art. 33 da Lei Complementar nº 101, de 2000. Declaração do Chefe do Poder Executivo ou do Secretário de Finanças, juntamente com o comprovante de remessa da declaração para o respectivo Tribunal de Contas, válida até a data limite de publicação do relatório subsequente, conforme modelo anexo 9 (p. 14).',
     fundamentacao:'Art. 29, XXXII, da Portaria Conjunta MGI/MF/CGU nº 33, de 2023',
     comprovacao:'Inserção na aba "Requisitos para celebração" no Transferegov.br.'},
    {id:'15',aba:'formalizacao',label:'Limite das dívidas consolidada e mobiliária',sub:'Declaração de regularidade no cumprimento do limite das dívidas consolidada e mobiliária, nos termos do art. 25, § 1º, inciso IV, alínea "c", da Lei Complementar nº 101, de 2000. Declaração do Chefe do Poder Executivo ou do Secretário de Finanças, válida até a data limite de publicação do relatório subsequente, conforme modelo anexo 10 (p. 15).',
     fundamentacao:'Art. 29, XXIX, da Portaria Conjunta MGI/MF/CGU nº 33, de 2023',
     comprovacao:'Inserção na aba "Requisitos para celebração" no Transferegov.br.'},
    {id:'16',aba:'formalizacao',label:'Limite de inscrição em restos a pagar',sub:'Declaração de regularidade no cumprimento do limite de inscrição em restos a pagar, nos termos do art. 25, § 1º, inciso IV, alínea "c", da Lei Complementar nº 101, de 2000. Declaração do Chefe do Poder Executivo ou do Secretário de Finanças, válida até a data limite de publicação do relatório subsequente, conforme modelo anexo 10 (p. 15).',
     fundamentacao:'Art. 29, XXX, da Portaria Conjunta MGI/MF/CGU nº 33, de 2023',
     comprovacao:'Inserção na aba "Requisitos para celebração" no Transferegov.br.'},
    {id:'17',aba:'formalizacao',label:'Limite de despesa total com pessoal',sub:'Declaração de regularidade no cumprimento do limite de despesa total com pessoal de todos os Poderes e órgãos listados no art. 20 da Lei Complementar nº 101, de 2000, inclusive as Defensorias Públicas, nos termos do art. 25, § 1º, inciso IV, alínea "c", da Lei Complementar nº 101, de 2000. Declaração do Chefe do Poder Executivo ou do Secretário de Finanças, juntamente com o comprovante de remessa da declaração para o respectivo Tribunal de Contas, válida até a data limite de publicação do relatório subsequente, conforme modelo anexo 10 (p. 15).',
     fundamentacao:'Art. 29, XXXI, da Portaria Conjunta MGI/MF/CGU nº 33, de 2023',
     comprovacao:'Inserção na aba "Requisitos para celebração" no Transferegov.br.'},
    {id:'18',aba:'formalizacao',label:'Destinação dos precatórios da educação básica',sub:'Declaração de regularidade na destinação dos precatórios correspondentes ao rateio dos percentuais destinados aos profissionais do magistério e aos demais profissionais da educação básica, estabelecido no art. 47-A, §§ 1º e 2º, da Lei nº 14.113, de 2020, e no art. 3º da Lei nº 14.325, de 12 de abril de 2022. Declaração do Chefe do Poder Executivo, do Secretário de Finanças ou de Educação, juntamente com o comprovante de remessa da declaração para o respectivo Tribunal de Contas, válida no mês da assinatura, conforme anexo 11 (p. 16).',
     fundamentacao:'Art. 29, XXXIII, da Portaria Conjunta MGI/MF/CGU nº 33, de 2023',
     comprovacao:'Inserção na aba "Requisitos para celebração" no Transferegov.br.'},
    {id:'19',aba:'formalizacao',label:'CAUC e comprovações admitidas',sub:'Obs.: na pendência de comprovação no CAUC, os requisitos dos incisos abaixo descritos podem ser comprovados com as declarações apontadas nos respectivos anexos — art. 29, II c/c § 6º: anexo 12 (p. 17); art. 29, XV: anexo 13 (p. 18); art. 29, XVI: anexo 13 (p. 18).',
     fundamentacao:'Art. 29, I, II, III, IV, V, VI, VIII, IX, X, XI, XII, XIII, XIV, XV, XVI, XVII, XVIII, XIX, XXI, XXII, XXIII, XXIV, XXV, XXVI, XXVII e XXVIII da Portaria Conjunta MGI/MF/CGU nº 33, de 2023',
     comprovacao:'Inserção na aba "Requisitos para celebração" no Transferegov.br.'}
  ];
  /* As duas abas em que a Lista de Conferência é conferida. A ordem é a de tela. */
  const ABAS_CELEBRACAO = [
    {id:'proposta',titulo:'Requisitos da Proposta',nota:'Requisitos analisados na proposta — Nota Técnica 231 (SEI 33381502) e Parecer 15 (SEI 33369201). A fundamentação e a comprovação são as da Lista de Conferência dos autos, SEI nº 36183977.'},
    {id:'formalizacao',titulo:'Requisitos para Formalização',nota:'Requisitos conferidos no ato da celebração, na aba "Requisitos para celebração" do Transferegov.br. A fundamentação e a comprovação são as da Lista de Conferência dos autos, SEI nº 36183977.'}
  ];
  /* As duas abas dividem a MESMA coleção `reviews.celebracao`: a divisão é de
     tela. Assim a análise já gravada, o histórico, os vínculos de diligência
     (`celebracao:<item>`) e os backups anteriores continuam válidos, sem migração
     e sem estado duplicado. */
  const storage = g => ABAS_CELEBRACAO.some(a => a.id === g) ? 'celebracao' : g;
  const TAB_LABELS = {dados:'Dados',analise:'Mérito',merito:'Mérito',pad:'Plano de Aplicação Detalhado',proposta:'Requisitos da Proposta',formalizacao:'Requisitos para Formalização',diligencias:'Diligências',historico:'Histórico'};
  const PENDENCIA = {merito:'Mérito',pad:'PAD',proposta:'Requisitos da Proposta',formalizacao:'Requisitos para Formalização'};
  /* A antiga aba Habilitação foi extinta a pedido do analista. As três exigências
     da etapa de habilitação do Edital (item 8) são: cadastro atualizado no
     Transferegov.br, envio da proposta no prazo e a verificação das condições do
     item 4 — as duas primeiras já são verificadas na origem e no painel, e a
     terceira se dilui nos itens específicos de mérito, PAD, proposta e
     formalização, cada um examinado individualmente. Não há mais requisito
     genérico de condições da proposta. As avaliações antigas continuam gravadas
     em `reviews.habilitacao` nos bancos já existentes: a validação e a tela
     percorrem apenas as listas abaixo, sem migrar nem apagar nada.
     Os itens de mérito que vêm da proposta são examinados com o texto oficial da
     origem, um item por campo — objeto, justificativa, público-alvo, problema,
     resultados, relação com os objetivos e capacidade técnica —, e não com texto
     digitado pelo analista. Nenhum item aglutina vários campos.
     Os cinco últimos itens de mérito são institucionais (Ouvidoria e Fala.BR):
     cada um é analisado e registrado individualmente, e a linha mostra o dado
     registrado no bloco “Ouvidoria e Fala.BR”, que continua sendo onde se edita. */
  const REQUIREMENTS = {
    merito: [['objeto','Objeto do instrumento'],['justificativa','Caracterização dos Interesses Recíprocos'],['publicoAlvo','Público-alvo'],['problema','Problema a resolver'],['resultados','Resultados esperados'],['destinacao','Destinação à Ouvidoria de Serviços Penais'],['objetivos','Vinculação aos objetivos e diretrizes do PROFOR/ONASP'],['capacidade','Capacidade técnica e gerencial'],['ouvidoriaInstituida','Instituição da Ouvidoria Específica de Serviços Penais'],['falaBRAdesao','Adesão ao Fala.BR']],
    celebracao: CELEBRACAO.map(x=>[x.id,x.label])
  };
  const STATUSES = {na:'Não analisado',ok:'Atende',obs:'Atendido com observação',diligencia:'Em diligência',no:'Não atende',reanalise:'Requer nova análise'};
  const DSTATUS = {aberta:'Aberta',aguardando:'Aguardando resposta',recebida:'Resposta recebida',saneada:'Saneada / atendida',nao_saneada:'Não saneada'};
  const CATEGORIES = ['VALOR GLOBAL','VALOR DE REPASSE','VALOR DE CONTRAPARTIDA','PLANO DE APLICAÇÃO DETALHADO','PESQUISA DE PREÇOS','PLANO DE TRABALHO','METAS / ETAPAS / CRONOGRAMAS','INSTITUIÇÃO DA OUVIDORIA','ANEXO / DOCUMENTO','CAPACIDADE TÉCNICA E GERENCIAL','HABILITAÇÃO','OUTRO'];
  /* Textos oficiais da proposta, buscados sob demanda no arquivo público
     `siconv_justificativas_proposta.zip`. Ficam FORA de `imported` de propósito:
     a sincronização substitui `imported` pelo retrato da extração e apagaria os
     textos, que não vêm no arquivo de propostas. Cada campo é texto livre do
     ente federativo, transcrito sem edição. */
  const CAMPOS_TEXTOS = {caracterizacao:'Caracterização dos interesses recíprocos',publicoAlvo:'Público-alvo',problema:'Problema a ser resolvido',resultados:'Resultados esperados',relacao:'Relação entre a proposta e os objetivos e diretrizes do programa',capacidade:'Capacidade técnica e gerencial',justificativa:'Justificativa'};
  const clone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
  const now = () => new Date().toISOString();
  const uid = () => globalThis.crypto.randomUUID();
  const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function assert(test, message) { if (!test) throw new Error(message); }
  function validateSei(sei) {
    assert(sei && typeof sei==='object' && !Array.isArray(sei) && typeof sei.number==='string' && typeof sei.url==='string','Cadastro do processo SEI inválido.');
    assert(Boolean(sei.number.trim())===Boolean(sei.url.trim()),'Informe o número e o link do processo SEI, ou deixe ambos vazios para remover o cadastro.');
    safeLink(sei.url);
  }
  function validateTextos(textos) {
    assert(textos && typeof textos==='object' && !Array.isArray(textos),'Textos oficiais inválidos.');
    assert(typeof textos.at==='string' && textos.at,'Textos oficiais sem data de obtenção.');
    for(const campo of Object.keys(CAMPOS_TEXTOS)) {
      assert(typeof textos[campo]==='string',`Texto oficial inválido: ${campo}.`);
      assert(textos[campo].length<=200000,`Texto oficial excessivo: ${campo}.`);
    }
  }
  /* Guarda os textos oficiais de UMA proposta. `dados` traz os campos crus do
     arquivo público; o que não vier vira texto vazio, sem inventar conteúdo. */
  function setTextos(p,dados,actor) {
    const after={at:now()};
    for(const campo of Object.keys(CAMPOS_TEXTOS)) after[campo]=String(dados?.[campo] ?? '').trim();
    validateTextos(after);
    const before=p.textos || null;
    p.textos=after;log(p,'Textos oficiais da proposta obtidos',before,after,actor);
    return after;
  }
  function setSei(p,data,actor) {
    const after={number:data.number.trim(),url:data.url.trim()};
    validateSei(after);after.url=safeLink(after.url);
    const before=p.sei || {number:'',url:''};
    p.sei=after;log(p,'Processo SEI da proposta atualizado',before,after,actor);
  }
  function safeLink(value) {
    if (!value) return '';
    const url = new URL(value);
    assert(['https:','http:'].includes(url.protocol) && !url.username && !url.password, 'Use um link HTTP ou HTTPS sem credenciais.');
    return url.href;
  }
  function moneyBR(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    let s = String(value).trim().replace(/^R\$\s*/, '');
    assert(/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s), `Valor monetário inválido: ${value}. Use o formato brasileiro.`);
    s = s.replace(/\./g,'');
    const [a,b=''] = s.split(',');
    const result = Number(BigInt(a) * 100n + BigInt(b.padEnd(2,'0')));
    assert(Number.isSafeInteger(result), 'Valor monetário fora do limite seguro.');
    return result;
  }
  function quantityBR(value) {
    let s = String(value ?? '').trim();
    assert(/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,6})?$/.test(s), 'Quantidade ausente ou inválida.');
    s = s.replace(/\./g,'').replace(',','.');
    assert(Number(s)>0 && Number(s)<=1e9,'Quantidade deve ser positiva e não exceder um bilhão.');
    return s;
  }
  function multiply(quantity, cents) {
    assert(typeof quantity==='string' && /^\d+(?:\.\d{1,6})?$/.test(quantity),'Quantidade decimal inválida.');
    assert(Number.isSafeInteger(cents) && cents>=0,'Valor unitário inválido.');
    const [a,b=''] = quantity.split('.');
    const scale = 10n ** BigInt(b.length);
    const result = Number(((BigInt(a)*scale+BigInt(b || '0'))*BigInt(cents)+scale/2n)/scale);
    assert(Number.isSafeInteger(result),'Total do item fora do limite seguro.');
    return result;
  }
  /* No Transferegov, total e quantidade são as entradas e o unitário é o
     quociente arredondado para centavos. Reconstituir o total multiplicando o
     unitário arredondado gera falsos desvios em dízimas (por exemplo, total/3).
     O cálculo abaixo usa inteiros/BigInt e arredondamento half-up, sem ponto
     flutuante, inclusive quando a quantidade possui casas decimais. */
  function unitFromTotal(quantity,totalCents) {
    assert(typeof quantity==='string' && /^\d+(?:\.\d{1,6})?$/.test(quantity) && Number(quantity)>0,'Quantidade decimal inválida.');
    assert(Number.isSafeInteger(totalCents) && totalCents>=0,'Total do item inválido.');
    const [a,b='']=quantity.split('.'),scale=10n**BigInt(b.length),divisor=BigInt(a+b);
    const numerator=BigInt(totalCents)*scale;
    const result=Number((2n*numerator+divisor)/(2n*divisor));
    assert(Number.isSafeInteger(result),'Valor unitário calculado fora do limite seguro.');
    return result;
  }
  function unitMatchesTotal(item) { return item.unitario===unitFromTotal(item.quantidade,item.total); }
  function dateISO(s) {
    if (!s) return '';
    const value = /^\d{2}\/\d{2}\/\d{4}$/.test(s) ? s.split('/').reverse().join('-') : s;
    assert(/^\d{4}-\d{2}-\d{2}$/.test(value),'Data inválida.');
    const date = new Date(value+'T12:00:00Z');
    assert(!Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10)===value,'Data inexistente.');
    return value;
  }
  function addDays(iso,n) {
    if (!iso) return '';
    const date = new Date(dateISO(iso)+'T12:00:00Z'); date.setUTCDate(date.getUTCDate()+n); return date.toISOString().slice(0,10);
  }
  function addMonths(iso,n) {
    if (!iso) return '';
    const date = new Date(dateISO(iso)+'T12:00:00Z');
    const day = date.getUTCDate(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth()+n);
    const last = new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
    date.setUTCDate(Math.min(day,last)); return date.toISOString().slice(0,10);
  }
  /* Dez dias corridos, excluído o dia inicial, prorrogando sábado/domingo.
     Novos registros usam a comunicação. deadlineBase mantém apenas a validação
     compatível com prazos legados baseados na ciência. Não há calendário de feriados. */
  function deadline(science) {
    const base = addDays(science,10); let adjusted=base;
    while(adjusted && [0,6].includes(new Date(adjusted+'T12:00:00Z').getUTCDay())) adjusted=addDays(adjusted,1);
    return {base,adjusted};
  }
  const deadlineBase=(science,communication)=>deadline(science || communication);
  const fmtMoney = n => n===null || n===undefined ? 'Não informado' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
  const fmtDate = s => s ? s.slice(0,10).split('-').reverse().join('/') : 'Não informada';
  /* A origem às vezes omite o zero inicial. O identificador persistido permanece
     intacto; esta função normaliza somente apresentação, cópia e exportação. */
  function fmtProposalNumber(value) {
    const text=String(value ?? '').trim(),match=text.match(/^(\d+)\/(\d{4})$/);
    return match ? `${match[1].padStart(6,'0')}/${match[2]}` : text;
  }
  /* Formatação oficial de CNPJ: 14 dígitos no padrão XX.XXX.XXX/XXXX-XX.
     Trata também números com zeros à esquerda omitidos na extração. */
  function fmtCnpj(value) {
    const digits=String(value ?? '').replace(/\D/g, '');
    if(!digits) return '';
    const padded=digits.length<=14 ? digits.padStart(14,'0') : digits;
    const match=padded.match(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/);
    return match ? `${match[1]}.${match[2]}.${match[3]}/${match[4]}-${match[5]}` : String(value ?? '').trim();
  }
  const localToday = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
  const blankReview = () => ({status:'na',note:'',document:'',url:'',at:null,attachments:[]});
  function initialState() { return {schemaVersion:1,revision:0,proposals:[],sync:null,lastBackup:null}; }
  /* Por que o PAD aparece vazio. São DUAS causas diferentes e a tela precisa
     distingui-las, porque a providência é oposta:
       'nao-carregado' — o arquivo do PAD não veio na última sincronização (modo
                         rápido, `pad` nulo): basta sincronizar de novo na
                         modalidade completa;
       'sem-itens'     — o arquivo foi lido e a proposta realmente NÃO tem item
                         publicado nos dados abertos do Transferegov: nada a
                         corrigir aqui, a conferência fica pendente na origem. */
  function padSituacao(p,sync) {
    const pad=p?.imported?.pad;
    if(pad===null || pad===undefined) return {key:'nao-carregado',titulo:'PAD não carregado',
      detalhe:`A última sincronização foi a rápida, que não baixa o arquivo do Plano de Aplicação Detalhado${sync?.at?`, feita em ${fmtDate(sync.at)}`:''}. Use "Sincronizar com o Transferegov" na modalidade completa para carregá-lo.`};
    if(!pad.length) return {key:'sem-itens',titulo:'Sem itens publicados na origem',
      detalhe:'O arquivo oficial do Plano de Aplicação Detalhado foi lido e não há nenhum item para esta proposta: o plano ainda não consta dos dados abertos do Transferegov. Não é falha do sistema nem do arquivo local — a conferência do PAD fica pendente na origem.'};
    return {key:'com-itens',titulo:`${pad.length} item(ns) publicado(s)`,detalhe:''};
  }
  function log(p,event,before=null,after=null,actor='Sistema') { p.history.push({at:now(),event,actor,before:clone(before),after:clone(after)}); }
  function validateImported(i) {
    assert(i && typeof i==='object','Dados da proposta ausentes.');
    for(const key of ['id','numero','uf','programa','proponente','cnpj','orgao','objeto','situacao','data']) assert(typeof i[key]==='string',`Campo inválido: ${key}.`);
    assert(/^\d{1,80}$/.test(i.id),'ID da proposta inválido.');
    assert(i.numero.trim() && Object.hasOwn(UFS,i.uf) && i.programa===PROGRAM,'Proposta, UF ou programa fora do escopo.');
    dateISO(i.data);
    /* Vigência (prazo de execução) vem da extração oficial; ausente nos bancos
       anteriores à importação dessas colunas. */
    for(const key of ['vigenciaInicio','vigenciaFim']) {
      if(i[key]===undefined) continue;
      assert(typeof i[key]==='string',`Campo inválido: ${key}.`);
      dateISO(i[key]);
    }
    for(const key of ['repasse','contrapartida','global']) assert(i[key]===null || (Number.isSafeInteger(i[key]) && i[key]>=0),`Valor inválido: ${key}.`);
    assert(i.pad===null || Array.isArray(i.pad),'PAD inválido.');
    const ids=new Set();
    for(const item of i.pad || []) {
      assert(typeof item.id==='string' && /^\d{1,100}$/.test(item.id) && !ids.has(item.id),'ID de item ausente ou duplicado.'); ids.add(item.id);
      assert(typeof item.descricao==='string' && item.descricao.trim(),'Descrição do PAD ausente.');
      assert(Number(item.quantidade)>0,'Quantidade deve ser positiva.'); multiply(item.quantidade,item.unitario);
      assert(Number.isSafeInteger(item.total) && item.total>=0,'Total do item inválido.');
    }
    return i;
  }
  function createProposal(imported) {
    validateImported(imported);
    const p={id:imported.id,imported:clone(imported),reviews:{},diligences:[],ouvidoria:{status:'na',signature:'',url:'',note:'',clause:false},falaBR:'na',conclusion:null,history:[]};
    for(const [group,rows] of Object.entries(REQUIREMENTS)) p.reviews[group]=Object.fromEntries(rows.map(([id])=>[id,blankReview()]));
    p.reviews.pad=Object.fromEntries((imported.pad || []).map(x=>[x.id,blankReview()]));
    log(p,'Proposta importada',null,imported); return p;
  }
  function syncProposals(state,incoming,source) {
    const next=clone(state); const changes=[]; const ids=new Set();
    for(const i of incoming) {
      validateImported(i); assert(!ids.has(i.id),'ID de proposta repetido na importação.'); ids.add(i.id);
      let p=next.proposals.find(x=>x.id===i.id);
      /* Proposta apagada pelo analista continua apagada após a sincronização: a
         origem não sabe da exclusão, então o estado local é preservado. Nada é
         removido do banco — só o painel é que deixa de exibi-la. */
      /* `uf` acompanha cada alteração para a tela de sincronização identificar a
         proposta pelo estado, e não só pelo número. */
      if(!p) { p=createProposal(i); next.proposals.push(p); changes.push({id:i.id,numero:i.numero,uf:i.uf,field:'Proposta',before:null,after:'Nova proposta'}); continue; }
      assert(i.uf===p.imported.uf,'UF de uma proposta existente foi alterada. Confira a origem antes de importar.');
      if(p.isDeleted){p.imported.pad=clone(i.pad===null?p.imported.pad:i.pad);continue;}
      const fresh=clone(i); if(fresh.pad===null) fresh.pad=clone(p.imported.pad);
      const changed=Object.keys(fresh).filter(k=>JSON.stringify(fresh[k])!==JSON.stringify(p.imported[k]));
      if(!changed.length) continue;
      for(const key of changed) changes.push({id:i.id,numero:i.numero,uf:i.uf,field:key,before:clone(p.imported[key]),after:clone(fresh[key])});
      if(changed.some(k=>k!=='pad')) for(const group of ['merito']) for(const review of Object.values(p.reviews[group] || {})) if(review.status!=='na') review.status='reanalise';
      for(const item of fresh.pad || []) {
        const old=(p.imported.pad || []).find(x=>x.id===item.id);
        if(!p.reviews.pad[item.id]) p.reviews.pad[item.id]=blankReview();
        else if(JSON.stringify(old)!==JSON.stringify(item) && p.reviews.pad[item.id].status!=='na') { p.reviews.pad[item.id].status='reanalise'; log(p,`Conferência do item ${item.id} invalidada`,old,item); }
      }
      log(p,'Dados da origem alterados; conferir análise',p.imported,fresh);
      p.imported=fresh;
      if(p.conclusion) {log(p,'Conclusão requer nova confirmação após importação',p.conclusion,null);p.conclusion=null;}
    }
    next.sync={at:now(),source,count:incoming.length};
    return {state:next,changes};
  }
  /* `group` pode ser uma das duas abas de celebração; nesse caso a lista sai
     filtrada pela aba e a leitura/gravação continua em `reviews.celebracao`.
     Grupo sem lista própria (a extinta Habilitação, por exemplo) devolve lista
     vazia: as chaves antigas continuam no banco, mas não são analisadas. */
  function rows(p,group) {
    if(group==='pad') return (p.imported.pad || []).map(i=>[i.id,i.descricao]);
    if(ABAS_CELEBRACAO.some(a=>a.id===group)) return REQUIREMENTS.celebracao.filter(([id])=>celebracaoItem(id).aba===group);
    return REQUIREMENTS[group] || [];
  }
  function celebracaoItem(id) { return CELEBRACAO.find(x=>x.id===id) || null; }
  /* Metadados apenas quando o item pertence de fato à celebração: ids do PAD são
     números livres vindos da extração e podem coincidir com os itens 1 a 19. */
  function metaRequisito(group,id) { return storage(group)==='celebracao' ? celebracaoItem(id) : null; }
  function reviewOf(p,group,id) { return p.reviews[storage(group)][id]; }
  /* Nome da aba em que o requisito é conferido — usado nas diligências e nos
     vínculos, que guardam a chave de armazenamento (`celebracao:<item>`). */
  function tabLabel(group,id) {
    const g=storage(group);
    if(g==='celebracao') return TAB_LABELS[celebracaoItem(id)?.aba] || 'Celebração';
    return TAB_LABELS[g] || g;
  }
  function referenceRows(p) { return Object.keys(p.reviews).flatMap(g=>rows(p,g).map(([id,label])=>({ref:g+':'+id,group:g,tab:tabLabel(g,id),id,label,review:reviewOf(p,g,id)}))); }
  function pending(p) { return referenceRows(p).filter(r=>r.review.status==='diligencia' && !p.diligences.some(d=>d.ref===r.ref && d.status!=='saneada')); }
  function finance(p) {
    const i=p.imported, items=i.pad;
    const complete=[i.repasse,i.contrapartida,i.global].every(x=>Number.isSafeInteger(x));
    const sum=(items || []).reduce((a,x)=>a+x.total,0);
    const errors=(items || []).filter(x=>!unitMatchesTotal(x));
    return {complete,sum,composition:complete && i.repasse+i.contrapartida===i.global,padComplete:!!items?.length,pad:!!items?.length && Number.isSafeInteger(sum) && sum===i.global,errors,ok:complete && i.repasse+i.contrapartida===i.global && !!items?.length && sum===i.global && !errors.length};
  }
  /* Resultado negativo que o próprio edital admite — a ausência da Ouvidoria (que
     vira cláusula suspensiva, no prazo de nove meses) e a falta de previsão de
     adesão ao Fala.BR (adesão preferencial). Nesses itens o resultado conta como
     registrado e não vira pendência de justificativa: são situações a acompanhar,
     não não conformidades a sanar. */
  const RESULTADO_PREVISTO = new Set(['ouvidoriaInstituida','falaBRAdesao']);
  const accepted = (r,id) => ['ok','obs'].includes(r.status) || (r.status==='no' && RESULTADO_PREVISTO.has(id));
  function groupProgress(p,g) { const rs=rows(p,g); return {done:rs.filter(([id])=>accepted(reviewOf(p,g,id),id)).length,total:rs.length}; }
  function blockers(p,celebration=false) {
    const b=[];
    /* Grupos sem lista própria ficam fora da contagem: um grupo vazio não pode
       bloquear a conclusão nem inflar as pendências. */
    for(const g of ['merito','pad',...(celebration?ABAS_CELEBRACAO.map(a=>a.id):[])]) { const v=groupProgress(p,g); if(!v.total)continue; if(v.done!==v.total)b.push(`${PENDENCIA[g] || g}: ${v.done}/${v.total} atendidos`); }
    const f=finance(p);
    if(!f.complete)b.push('Valores da proposta incompletos');
    else if(!f.composition)b.push('Repasse + contrapartida diverge do valor global');
    if(!f.padComplete)b.push('PAD sem itens importados'); else if(!f.pad)b.push('Somatório do PAD diverge do valor global');
    if(f.errors.length)b.push(`${f.errors.length} item(ns) com valor unitário incompatível com total ÷ quantidade`);
    if(pending(p).length)b.push('Marcação de diligência sem registro ativo');
    const sem=semJustificativa(p);
    if(sem.length)b.push(`${sem.length} item(ns) marcado(s) como não conforme sem justificativa`);
    if(p.diligences.some(d=>d.status!=='saneada'))b.push('Diligência ainda não saneada');
    if(celebration && p.ouvidoria.status!=='instituida' && !(p.ouvidoria.status==='pendente' && p.ouvidoria.clause)) b.push('Confirmar instituição da Ouvidoria ou aplicação da cláusula suspensiva');
    return [...new Set(b)];
  }
  /* Etapa da proposta NO TRANSFEREGOV, lida da extração oficial (campo SIT_PROPOSTA).
     Não confundir com situation(), que é o andamento da análise aqui no sistema.
     Semântica conferida em fonte primária (SEI nº 36184012 e tutorial "Dados da
     Proposta – Convenente"): "Proposta/Plano de Trabalho Cadastrados" aparece logo
     após "Cadastrar Proposta" e ANTES de "Enviar para Análise" — a proposta existe
     e tem número, mas ainda não foi submetida à análise; só depois do envio a
     situação passa a "Proposta/Plano de Trabalho Enviado para Análise". */
  const SOURCE_STATES = {
    cadastrada:{label:'Em elaboração', tone:'warn', note:'Proposta criada e salva no Transferegov, mas ainda NÃO enviada para análise. Não chega ao concedente enquanto o envio não ocorrer.'},
    enviada:{label:'Enviada para análise', tone:'good', note:'Proposta cadastrada e enviada para análise — é a que consta como "Proposta/Plano de Trabalho Enviado para Análise" nos dados abertos.'},
    rejeitada:{label:'Rejeitada na origem', tone:'bad', note:'Proposta/plano de trabalho rejeitados na origem.'},
    desconhecida:{label:'Status não mapeado — conferir na origem', tone:'warn', note:'A extração trouxe uma situação não prevista neste sistema. Confira a proposta na origem antes de decidir.'}
  };
  function sourceState(imported) {
    const raw=String(imported?.situacao ?? '');
    const s=raw.toLocaleLowerCase('pt-BR');
    if(!s.trim())return {key:'desconhecida',raw,indefinida:true,...SOURCE_STATES.desconhecida};
    if(s.includes('cadastrad') || s.includes('elabora'))return {key:'cadastrada',raw,indefinida:false,...SOURCE_STATES.cadastrada};
    if(s.includes('enviad'))return {key:'enviada',raw,indefinida:false,...SOURCE_STATES.enviada};
    if(s.includes('rejeit') || s.includes('cancelad') || s.includes('indeferid'))return {key:'rejeitada',raw,indefinida:false,...SOURCE_STATES.rejeitada};
    return {key:'desconhecida',raw,indefinida:true,...SOURCE_STATES.desconhecida};
  }
  /* Situação geral da UF a partir das propostas dela. Regra do analista:
     cadastro não é envio — se houver AO MENOS UMA proposta enviada para análise,
     a UF aparece como "Enviada para análise", mesmo com outras em elaboração. */
  function ufState(proposals) {
    const ativas=(proposals || []).filter(p=>!p.isDeleted);
    if(ativas.some(p=>sourceState(p.imported).key==='enviada'))return {key:'enviada',label:'Enviada para análise',tone:'good'};
    if(ativas.length)return {key:'elaboracao',label:'Em elaboração',tone:'warn'};
    return {key:'sem',label:'Sem proposta importada',tone:''};
  }
  /* Ordem de exibição: primeiro as enviadas (da mais antiga para a mais recente,
     por data de envio/cadastramento), depois as demais, e por número estável. */
  function orderBySend(proposals) {
    const enviada=p=>sourceState(p.imported).key==='enviada'?0:1;
    return (proposals || []).slice().sort((a,b)=>{
      const ea=enviada(a),eb=enviada(b);
      if(ea!==eb)return ea-eb;
      if(ea===0){const da=a.imported.data||'',db=b.imported.data||'';if(da!==db)return da<db?-1:1;}
      return String(a.imported.numero||'').localeCompare(String(b.imported.numero||''),'pt-BR');
    });
  }
  function activeProposals(s) { return (s.proposals || []).filter(p=>!p.isDeleted); }
  function deletedProposals(s) { return (s.proposals || []).filter(p=>p.isDeleted); }
  /* Marcar como apagada registra o ator e a hora e guarda o retrato no histórico.
     Nada é removido do banco: a proposta sai do painel e continua podendo voltar. */
  function deleteProposal(p,actor='Usuário local') {
    assert(p && !p.isDeleted,'Esta proposta já está apagada.');
    log(p,'Proposta apagada do painel',clone(p.imported),null,actor);
    p.isDeleted=true;p.deletedAt=now();p.deletedBy=actor;
    return p;
  }
  function restoreProposal(p,actor='Usuário local') {
    assert(p && p.isDeleted,'Esta proposta não está apagada.');
    const antes={isDeleted:true,deletedAt:p.deletedAt,deletedBy:p.deletedBy};
    p.isDeleted=false;p.deletedAt=null;p.deletedBy='';
    log(p,'Proposta restaurada para o painel',antes,{isDeleted:false},actor);
    return p;
  }
  function situation(p) {
    if(p?.imported && sourceState(p.imported).key==='cadastrada')return 'Em elaboração na origem';
    if(pending(p).length || p.diligences.some(d=>d.status!=='saneada'))return 'Em diligência';
    if(referenceRows(p).some(r=>r.review.status==='reanalise'))return 'Requer nova análise';
    if(p.conclusion && !blockers(p,true).length)return p.ouvidoria.status==='pendente'?'Formalização com cláusula suspensiva':'Apta à celebração';
    if(p.conclusion)return 'Pendente de celebração';
    return 'Em análise';
  }
  function setReview(p,group,id,data,actor,opts={}) {
    assert(rows(p,group).some(r=>r[0]===id),'Requisito não encontrado.');
    assert(Object.hasOwn(STATUSES,data.status) && data.status!=='reanalise','Status inválido.');
    /* A marcação direta de conformidade (sem formulário) pode gravar 'não atende'
       sem justificativa no mesmo instante; a justificativa passa a ser cobrada
       como pendência que impede a conclusão técnica, e não como bloqueio da
       marcação. Ver `semJustificativa`. */
    assert(opts.allowEmptyNote || !['obs','diligencia','no'].includes(data.status) || data.note.trim(),'Informe a observação ou justificativa.');
    const g=storage(group);
    const before=clone(p.reviews[g][id]);
    const attachments=Array.isArray(data.attachments)?data.attachments:(Array.isArray(before?.attachments)?clone(before.attachments):[]);
    const after={status:data.status,note:data.note.trim(),document:data.document.trim(),url:safeLink(data.url.trim()),at:now(),attachments};
    assert(!after.url || after.document,'Dê um nome ao documento vinculado.');
    p.reviews[g][id]=after; log(p,`Avaliação: ${g} / ${id}`,before,after,actor);
    if(p.conclusion && g!=='celebracao') {log(p,'Conclusão reaberta por alteração da análise',p.conclusion,null,actor);p.conclusion=null;}
  }
  function addAttachment(p,group,id,file,actor) {
    assert(rows(p,group).some(r=>r[0]===id),'Requisito não encontrado.');
    assert(file && typeof file==='object','Arquivo inválido.');
    assert(typeof file.name==='string' && file.name.trim(),'Nome do arquivo obrigatório.');
    assert(typeof file.data==='string' && file.data.startsWith('data:'),'Conteúdo do arquivo em formato inválido.');
    assert(Number.isSafeInteger(file.size) && file.size>0 && file.size<=25*1024*1024,'Arquivo vazio ou maior que 25 MB.');
    const g=storage(group);
    const r=p.reviews[g][id];
    assert(r,'Requisito não encontrado.');
    if(!Array.isArray(r.attachments)) r.attachments=[];
    const att={
      id:file.id || ('att-'+uid()),
      name:file.name.trim().slice(0,255),
      size:file.size,
      type:file.type || 'application/octet-stream',
      data:file.data,
      uploadedAt:now(),
      uploadedBy:actor || 'Analista',
      note:typeof file.note==='string'?file.note.trim().slice(0,500):''
    };
    r.attachments.push(att);
    log(p,`Anexo adicionado ao requisito ${id}: ${att.name}`,null,{name:att.name,size:att.size},actor);
    return att;
  }
  function removeAttachment(p,group,id,attachmentId,actor) {
    assert(rows(p,group).some(r=>r[0]===id),'Requisito não encontrado.');
    const g=storage(group);
    const r=p.reviews[g][id];
    assert(r && Array.isArray(r.attachments),'Requisito sem anexos.');
    const idx=r.attachments.findIndex(a=>a.id===attachmentId);
    assert(idx>=0,'Anexo não encontrado.');
    const removed=r.attachments.splice(idx,1)[0];
    log(p,`Anexo removido do requisito ${id}: ${removed.name}`,{name:removed.name},null,actor);
    return removed;
  }
  /* Marcação direta, sem formulário: `true` = conformidade, `false` = não
     conformidade, `null` = volta a "não analisado", ou o próprio status, para
     itens com mais de duas decisões (a adesão ao Fala.BR tem três). Observação,
     documento e link já registrados são preservados — só o analista os apaga. */
  function markReview(p,group,id,valor,actor) {
    const r=reviewOf(p,group,id);
    assert(r,'Requisito não encontrado.');
    const status=valor===null?'na':valor===true?'ok':valor===false?'no':valor;
    assert(typeof status==='string' && Object.hasOwn(STATUSES,status) && status!=='reanalise','Marcação inválida.');
    setReview(p,group,id,{status,note:r.note,document:r.document,url:r.url},actor,{allowEmptyNote:true});
    return reviewOf(p,group,id);
  }
  /* Itens marcados como não conformes sem justificativa registrada. Sustentam o
     bloqueio da conclusão: a marcação em um clique é permitida, a conclusão sem
     justificativa não. A exceção é a instituição da Ouvidoria: ali a ausência é
     situação prevista no edital (a instituição vira cláusula suspensiva, no prazo
     de nove meses), e não uma não conformidade a justificar. */
  const AUSENCIA_PREVISTA = RESULTADO_PREVISTO;
  function semJustificativa(p) {
    return referenceRows(p).filter(x=>x.review.status==='no' && !x.review.note.trim() && !AUSENCIA_PREVISTA.has(x.id)).map(x=>({ref:x.ref,tab:x.tab,label:x.label}));
  }
  /* Item cujo resultado negativo é admitido pelo edital — não vira pendência. */
  const resultadoPrevisto = id => RESULTADO_PREVISTO.has(id);
  /* Rótulo do resultado em itens com decisões próprias: a mesma palavra aparece
     na lista, no relatório e no histórico, em vez do rótulo genérico. */
  const ROTULOS_DE_ITEM={ouvidoriaInstituida:{no:'Ausente'},falaBRAdesao:{ok:'Já aderiu',obs:'Previsto no Plano de Trabalho',no:'Sem previsão'}};
  const rotuloDoResultado = (id,status) => ROTULOS_DE_ITEM[id]?.[status] || STATUSES[status];
  function saveDiligence(p,data,actor) {
    assert(CATEGORIES.includes(data.category),'Categoria inválida.');
    assert(!data.ref || referenceRows(p).some(r=>r.ref===data.ref),'Vínculo inválido.');
    assert(data.request.trim(),'Informe a providência solicitada.');
    assert(Object.hasOwn(DSTATUS,data.status),'Situação inválida.');
    for(const field of ['communication','science','response'])dateISO(data[field]);
    // Ciência antiga é histórico; novos vencimentos dependem só da comunicação.
    assert(!data.response || (!!data.communication && data.response>=data.communication),'Resposta exige comunicação e não pode ser anterior a ela.');
    if(['aguardando','recebida','saneada','nao_saneada'].includes(data.status))assert(data.communication,'Informe a data da comunicação.');
    if(['recebida','saneada'].includes(data.status))assert(data.response,'Informe a data da resposta.');
    if(['saneada','nao_saneada'].includes(data.status))assert(data.note.trim(),'Registre a conclusão do analista na observação.');
    const calculated=deadline(data.communication);
    const old=p.diligences.find(x=>x.id===data.id);
    // Prazo derivado: nunca aceitar vencimento ou conferência enviados pelo formulário.
    // Os registros anteriores permanecem no histórico, sem migração silenciosa do banco.
    const after={...data,science:old?.science || data.science || '',id:old?.id || uid(),at:now(),base:calculated.base,due:calculated.adjusted,automaticDeadline:true,confirmed:false,calendarNote:old?.calendarNote || ''};
    log(p,old?'Diligência atualizada':'Diligência cadastrada',old || null,after,actor);
    if(old)p.diligences[p.diligences.indexOf(old)]=after; else p.diligences.push(after);
    if(p.conclusion) { log(p,'Conclusão reaberta por diligência',p.conclusion,null,actor); p.conclusion=null; }
    return after;
  }
  function mayResolveReference(p,d) { return d.status==='saneada' && !!d.ref && !p.diligences.some(x=>x.ref===d.ref && x.status!=='saneada'); }
  function diligenceLabel(d) { return (d.automaticDeadline || d.confirmed) && d.due && !d.response && !['saneada','nao_saneada'].includes(d.status) && d.due<localToday() ? 'Prazo expirado' : DSTATUS[d.status]; }
  /* Requisito criado depois do último salvamento não tem entrada em
     `reviews` no banco antigo — foi o caso do item de conteúdo da proposta no
     Mérito. A normalização preenche a entrada em branco antes da validação, o
     que permite acrescentar ou retirar requisito sem migração e sem quebrar
     registro antigo. É idempotente e não toca em nada já avaliado. */
  function normalizeState(state) {
    for(const p of state?.proposals || []) {
      if(!p.reviews || typeof p.reviews!=='object') continue;
      for(const group of [...Object.keys(REQUIREMENTS),'pad']) {
        if(!p.reviews[group] || typeof p.reviews[group]!=='object') p.reviews[group]={};
        for(const [id] of rows(p,group)) {
          if(!p.reviews[group][id]) p.reviews[group][id]=blankReview();
          else if(!Array.isArray(p.reviews[group][id].attachments)) p.reviews[group][id].attachments=[];
        }
      }
    }
    return state;
  }
  function validateState(state) {
    assert(state?.schemaVersion===1 && Number.isSafeInteger(state.revision) && state.revision>=0 && Array.isArray(state.proposals),'Backup incompatível ou incompleto.');
    normalizeState(state);
    const ids=new Set();
    for(const p of state.proposals) {
      validateImported(p.imported); assert(p.id===p.imported.id && !ids.has(p.id),'Proposta duplicada ou ID incompatível.'); ids.add(p.id);
      assert(p.isDeleted===undefined || typeof p.isDeleted==='boolean','Marcação de proposta apagada inválida.');
      if(p.isDeleted){assert(p.deletedAt===null || p.deletedAt===undefined || typeof p.deletedAt==='string','Data de exclusão inválida.');assert(p.deletedBy===undefined || typeof p.deletedBy==='string','Autor da exclusão inválido.');}
      if(p.sei!==undefined)validateSei(p.sei);
      if(p.textos!==undefined)validateTextos(p.textos);
      assert(p.reviews && Array.isArray(p.history) && Array.isArray(p.diligences) && p.ouvidoria,'Análise incompleta no backup.');
      /* Só os grupos com lista própria são conferidos; a extinta Habilitação
         permanece no banco antigo sem ser validada nem exibida. */
      for(const group of [...Object.keys(REQUIREMENTS),'pad']) {
        assert(p.reviews[group] && typeof p.reviews[group]==='object','Checklist ausente.');
        for(const [id] of rows(p,group)) {
          const r=p.reviews[group][id]; assert(r && Object.hasOwn(STATUSES,r.status),'Status de análise inválido.');
          for(const k of ['note','document','url'])assert(typeof r[k]==='string','Campo de análise inválido.');
          /* 'não atende' sem justificativa é aceito no banco porque a marcação em
             um clique grava assim; a justificativa é cobrada como pendência que
             bloqueia a conclusão (`semJustificativa`), não como recusa do dado. */
          /* 'não atende' e 'atendido com observação' podem chegar sem nota por
             marcação direta na lista: a justificativa é cobrada como pendência
             que bloqueia a conclusão (`semJustificativa`), não como recusa do
             dado. O formulário continua exigindo justificativa ao salvar. */
          safeLink(r.url); assert(r.status!=='diligencia' || r.note.trim(),'Justificativa ausente no backup.');
          if(r.attachments!==undefined){
            assert(Array.isArray(r.attachments),'Lista de anexos do requisito inválida.');
            for(const a of r.attachments){
              assert(a && typeof a==='object','Anexo inválido.');
              assert(typeof a.id==='string' && a.id.trim(),'ID do anexo obrigatório.');
              assert(typeof a.name==='string' && a.name.trim(),'Nome do anexo obrigatório.');
              assert(typeof a.data==='string' && a.data.startsWith('data:'),'Conteúdo do anexo em formato inválido.');
              assert(Number.isSafeInteger(a.size) && a.size>0,'Tamanho do anexo inválido.');
              assert(typeof a.uploadedAt==='string' && a.uploadedAt,'Data de envio do anexo obrigatória.');
            }
          }
        }
      }
      assert(['na','instituida','pendente'].includes(p.ouvidoria.status) && ['na','aderido','previsto','nao_previsto'].includes(p.falaBR),'Situação institucional inválida.');
      assert(typeof p.ouvidoria.clause==='boolean','Cláusula suspensiva inválida.');
      for(const k of ['signature','url','note'])assert(typeof p.ouvidoria[k]==='string','Informação institucional incompleta.');
      dateISO(p.ouvidoria.signature); safeLink(p.ouvidoria.url);
      const dids=new Set();
      for(const d of p.diligences) {
        assert(typeof d.id==='string' && !dids.has(d.id),'ID de diligência inválido.'); dids.add(d.id);
        assert(CATEGORIES.includes(d.category) && Object.hasOwn(DSTATUS,d.status),'Diligência inválida.');
        for(const k of ['request','ref','communication','science','response','due','note','calendarNote'])assert(typeof d[k]==='string','Diligência incompleta.');
        for(const k of ['communication','science','response','due'])dateISO(d[k]);
        assert(typeof d.confirmed==='boolean' && d.request.trim(),'Conferência ou providência inválida.');
        assert(d.automaticDeadline===undefined || typeof d.automaticDeadline==='boolean','Modo de prazo inválido.');
        if(d.automaticDeadline){
          const calculated=deadline(d.communication);
          assert(d.base===calculated.base && d.due===calculated.adjusted && !d.confirmed,'Vencimento automático incompatível com a comunicação.');
        }else assert(!d.science || (d.communication && d.science>=d.communication),'Ciência incompatível com a comunicação.');
        assert(!d.response || (d.communication && d.response>=d.communication),'Resposta incompatível com a comunicação.');
        assert(!['recebida','saneada'].includes(d.status) || d.response,'Resposta obrigatória para este status.');
        assert(!['saneada','nao_saneada'].includes(d.status) || d.note.trim(),'Conclusão da diligência ausente.');
        assert(!d.confirmed || (d.communication && d.due>=deadlineBase(d.science,d.communication).adjusted && d.calendarNote.trim()),'Vencimento confirmado sem base de prazo ou conferência válida.');
        assert(!d.ref || Object.keys(p.reviews).some(g=>Object.keys(p.reviews[g]).some(id=>g+':'+id===d.ref)),'Vínculo inexistente no backup.');
      }
      for(const h of p.history)assert(h && typeof h.at==='string' && typeof h.event==='string' && typeof h.actor==='string','Histórico inválido.');
      assert(p.conclusion===null || (typeof p.conclusion?.actor==='string' && typeof p.conclusion?.at==='string'),'Conclusão inválida.');
    }
    return state;
  }
  function csvCell(value) { let s=String(value ?? ''); if(/^[\s]*[=+@-]/.test(s))s="'"+s; return '"'+s.replace(/"/g,'""')+'"'; }
  function exportCSV(state) {
    const lines=[['UF','Proposta','Proponente','Repasse','Contrapartida','Valor global','Situação','Pendências sem diligência']];
    /* Só propostas ativas: as apagadas estão fora das telas e das exportações. */
    for(const p of (state.proposals || []).filter(x=>!x.isDeleted))lines.push([p.imported.uf,fmtProposalNumber(p.imported.numero),p.imported.proponente,...['repasse','contrapartida','global'].map(k=>p.imported[k]===null?'':(p.imported[k]/100).toFixed(2).replace('.',',')),situation(p),pending(p).length]);
    return '\uFEFF'+lines.map(r=>r.map(csvCell).join(';')).join('\r\n');
  }
  const api={UFS,PROGRAM,REQUIREMENTS,CELEBRACAO,ABAS_CELEBRACAO,TAB_LABELS,celebracaoItem,metaRequisito,reviewOf,tabLabel,rows,STATUSES,DSTATUS,CATEGORIES,CAMPOS_TEXTOS,clone,now,uid,esc,assert,safeLink,setSei,setTextos,moneyBR,quantityBR,multiply,unitFromTotal,unitMatchesTotal,dateISO,addDays,addMonths,deadline,deadlineBase,fmtMoney,fmtDate,fmtProposalNumber,fmtCnpj,localToday,initialState,createProposal,validateImported,syncProposals,log,referenceRows,pending,finance,groupProgress,blockers,situation,sourceState,SOURCE_STATES,ufState,orderBySend,activeProposals,deletedProposals,deleteProposal,restoreProposal,setReview,markReview,addAttachment,removeAttachment,resultadoPrevisto,rotuloDoResultado,semJustificativa,saveDiligence,mayResolveReference,diligenceLabel,validateState,normalizeState,exportCSV,padSituacao};
  if(typeof module!=='undefined')module.exports=api; else root.Profor=api;
})(globalThis);
