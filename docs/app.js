/* Interface local. Alterações são explícitas e gravadas em transação. */
(function(){
  'use strict';
  const D=Profor,e=D.esc,$=s=>document.querySelector(s);
  const applySyncResult=ProforSyncApply.applySyncResult;
  const isReadOnly=()=>Boolean(window.PROFOR_READ_ONLY);
  /* Consulta editorial do programa no Acesso Livre em 26/09/2026.
     Arquivos são cópias de consulta já existentes no projeto, não downloads
     verificados dos anexos da sessão do Transferegov. */
  const PROGRAM = Object.freeze({
    code: '3000020260022',
    agencyCode: '30000',
    searchUrl: 'https://discricionarias.transferegov.sistema.gov.br/voluntarias/programa/ConsultarPrograma/ConsultarPrograma.do',
    consultedAt: '26/09/2026',
    title: 'Programa de Fortalecimento das Ouvidorias de Serviços Penais – PROFOR/ONASP',
    facts: [
      ['Código do Programa', '3000020260022'],
      ['Órgão', '30000 - Ministério da Justiça e Segurança Pública'],
      ['Órgão executor', '30907 - Fundo Penitenciário Nacional'],
      ['Tipo de instrumento', 'Convênio'],
      ['Subtipo do instrumento', 'Não possui subtipo'],
      ['Qualificação da proposta', 'Proposta Voluntária'],
      ['Programa atende a', 'Administração Pública Estadual ou do Distrito Federal'],
      ['Categoria', 'Equipamentos'],
      ['Exige aceite de licitação', 'Sim'],
      ['Início do recebimento de propostas', '19/08/2026'],
      ['Fim do recebimento de propostas', '30/09/2026'],
      ['Ação orçamentária', '21BP5116'],
      ['Estados habilitados', 'AP, AM, BA, CE, ES, GO, MG, PA, PE, RN, RS, RR, SE, DF'],
      ['Projeto estruturante ou calamidade', 'Não'],
      ['Deve apresentar Plano de Trabalho', 'Sim'],
      ['Aceita proponente não cadastrado', 'Não'],
      ['Possui chamamento público', 'Não'],
      ['Fundamento legal informado no portal', 'Portaria Conjunta MGI/MF/CGU nº 28/2024; Portaria Conjunta MGI/MF/CGU nº 33/2023; Decreto nº 11.531/2023.'],
      ['Data de disponibilização', '19/08/2026'],
      ['Situação de disponibilização', 'Disponibilizado']
    ],
    description: 'Seleção de propostas de unidades federativas elegíveis para aparelhamento e fortalecimento das ouvidorias estaduais e distrital de serviços penais, com aquisição de bens permanentes e melhoria da capacidade institucional de atendimento.',
    observation: 'A proposta deve observar as diretrizes do programa e ser apresentada no Transferegov por órgão gestor responsável pela administração do sistema penitenciário da unidade federativa. Consulte o texto integral no Acesso Livre e no edital.',
    selection: 'O portal informa duas etapas eliminatórias: habilitação e avaliação de mérito. A análise considera os requisitos do edital, a adequação ao objeto e a capacidade técnica e gerencial. Consulte o texto integral no Acesso Livre.',
    investment: [['Equipamentos', 'Equipamentos']],
    counterpart: [
      ['Descrição', '0,1% a 10% nas áreas da Sudene, Sudam e Sudeco; 2% a 20% nos demais entes. Consulte a regra integral no Acesso Livre.'],
      ['Percentual mínimo exibido no portal', '0.01'],
      ['Percentual máximo em bens exibido no portal', '0.0'],
      ['Aceita contrapartida em bens', 'Não']
    ],
    dataFile: { title: 'Edital nº 38/2026 (SEI, HTML)', portalName: 'SEI_36994294_Edital_38.pdf', href: 'programa/edital-38-sei.html', note: 'Cópia do documento SEI em HTML; formato diferente do PDF anexado ao portal.' },
    attachments: [
      { title: 'Tutorial do concedente: análise da proposta', portalName: '9. Concedente_Análise dos Dados da Proposta_Convênios_V2.pdf', href: 'programa/tutorial-concedente-analise.pdf', note: 'Manual oficial local relacionado; identidade com o anexo do portal não verificada.' },
      { title: 'Edital nº 37/2026', portalName: 'SEI_36536532_Edital_37.pdf', href: 'programa/edital-37-dou.pdf', note: 'Cópia publicada no DOU; não é o mesmo arquivo PDF anexado ao portal.' },
      { title: 'Portaria nº 327/2024', portalName: 'SEI_MJ___27792372___Portaria_nA__ (2).pdf', href: 'programa/portaria-327-2024.pdf', note: 'Cópia do processo SEI; identidade com o anexo do portal não verificada.' },
      { title: 'Decreto nº 11.531/2023', portalName: 'D11531 (1).pdf', href: 'programa/decreto-11531-2023.pdf', note: 'Cópia do processo SEI; identidade com o anexo do portal não verificada.' },
      { title: 'Instrução Normativa SEGES/ME nº 65/2021', portalName: 'INSTRUCAO_NORMATIVA_SEGES_ME_NA_A___65__DE_7_DE_JULHO_DE_2021___Portal_de_Compras_do_Governo_Federal.pdf', href: 'programa/in-65-2021.pdf', note: 'Cópia do processo SEI; identidade com o anexo do portal não verificada.' },
      { title: 'Tutorial: envio da proposta pelo convenente', portalName: '6_tutorial_tr_envio_da_proposta_convenios_convenente (2).pdf', href: 'programa/tutorial-envio-proposta.pdf', note: 'Cópia do processo SEI; identidade com o anexo do portal não verificada.' },
      { title: 'Requisitos para celebração, Portaria Conjunta nº 28/2024', portalName: 'PC_28.2024___Requisitos___Celebracao__2_ (2).pdf', href: 'programa/requisitos-celebracao-pc28.pdf', note: 'Cópia do processo SEI; identidade com o anexo do portal não verificada.' }
    ]
  });
  let state, selected=null, activeTab='dados',programTab='dados',view='painel',busy=false,modalDirty=false,noticeTimer,focusReturn,syncRun=null,statusDropdownOpen=null;
  let syncHistory=null,historyLoading=null,calendarStart=null,selectedHistoryDay=null,lastCalendarWheel=0;
  const filters={search:'',uf:'',source:'',status:'',control:''};
  /* Filtros do PAD são temporários: nenhum dado da análise é alterado. */
  let padSearch='',padItemSearch='',padSearchOwner=null,padSelectorOpen=false,padStatusOpen=false,padBatchAction='';
  const padSelectedItems=new Set();
  const padSelectedStatuses=new Set();
  const padBatchItems=new Set();
  /* UFs com o resumo da proposta expandido no painel (estado só da interface). */
  const expand=new Set();
  /* O mesmo, para a tela de propostas apagadas. */
  const expandDel=new Set();
  /* Requisitos com a linha expandida (estado só da interface, por aba e id: `${g}:${id}`). */
  const expandedReqs=new Set();
  const summaryClosed=new Set(),expandedDescriptions=new Set();
  let conclusionContext=null,conclusionSubmitting=false;
  /* Rótulos e ORDEM das abas vêm do domínio: as duas abas de celebração
     ("Requisitos da Proposta" e "Requisitos para Formalização") ficam antes de
     "Diligências", conforme a Lista de Conferência dos autos (SEI nº 36183977). */
  const tabNames=D.TAB_LABELS;
  function toast(message,error=false){clearTimeout(noticeTimer);$('#notice').textContent=message;$('#notice').classList.toggle('failure',error);$('#notice').hidden=false;if(!error)noticeTimer=setTimeout(()=>$('#notice').hidden=true,7000);}
  /* O sistema é local e não exige identificação pessoal para registrar ações. */
  function actor(){return 'Usuário local';}
  function current(){return state.proposals.find(p=>p.id===selected && !p.isDeleted);}
  /* Texto para interpolar em HTML. Um objeto (ou arranjo/função) aqui vira
     "[object Object]" na tela: é erro de programação, e falha alto é melhor do
     que imprimir lixo. Nulo e indefinido seguem como texto vazio, como já faz
     `e` — dado ausente na extração não deve derrubar a tela inteira. */
  function texto(valor,contexto){
    const tipo=valor===null?'nulo':Array.isArray(valor)?'arranjo':typeof valor;
    D.assert(!['object','function','symbol'].includes(tipo),`${contexto}: era esperado texto e chegou ${tipo}.`);
    return valor;
  }
  const textoHtml=(valor,contexto)=>e(texto(valor,contexto));
  function badge(text,kind=''){return `<span class="badge ${kind}">${textoHtml(text,'Selo')}</span>`;}
  function reviewBadge(r){return badge(D.STATUSES[r.status],['ok','obs'].includes(r.status)?'good':r.status==='no'?'bad':['diligencia','reanalise'].includes(r.status)?'warn':'');}
  function progress(p,g){const r=D.groupProgress(p,g);return badge(`${r.done} / ${r.total}`,r.total && r.done===r.total?'good':'');}
  function options(map,value){return Object.entries(map).map(([key,label])=>`<option value="${e(key)}" ${key===value?'selected':''}>${e(label)}</option>`).join('');}
  function extracted(value,fallback='Não informado nesta extração'){const s=String(value ?? '').trim();return s && s!=='.' ? s : fallback;}
  function button(label,action,extra='',kind=''){return `<button type="button" class="${kind}" data-action="${action}" ${extra}>${label}</button>`;}
  function proposalNumber(value){return D.fmtProposalNumber(value);}
  function proposalCopyButton(value){const n=proposalNumber(value);return `<button type="button" class="copy-proposal" data-action="copy-proposal" data-number="${e(n)}" title="Copiar número da proposta" aria-label="Copiar proposta ${e(n)}">⧉</button>`;}
  function cnpjCopyButton(value){const c=D.fmtCnpj(value);if(!c)return '';return `<button type="button" class="copy-cnpj" data-action="copy-cnpj" data-cnpj="${e(c)}" title="Copiar CNPJ" aria-label="Copiar CNPJ ${e(c)}">⧉</button>`;}
  /* UF ao lado do número da proposta: sigla visível e nome por extenso acessível. */
  function ufTag(uf){const sigla=String(uf ?? '').trim();if(!sigla)return '';return `<span class="uf-tag" title="${textoHtml(D.UFS[sigla] || sigla,'UF da proposta')}">${textoHtml(sigla,'UF da proposta')}</span>`;}
  function proposalLink(id,value,context){const n=proposalNumber(value);return `<span class="proposal-number"><a href="${e(consultaPublica(id))}" target="_blank" rel="noopener noreferrer" title="Abrir proposta no Transferegov (Acesso Livre)" aria-label="Abrir proposta ${e(n)} no Transferegov (Acesso Livre)">${textoHtml(n,context+': número')}</a>${proposalCopyButton(n)}</span>`;}
  /* Atalhos para o Transferegov (Acesso Livre), à esquerda abaixo das abas da proposta.
     Dados e PAD usam o endereço de detalhe com `idProposta`, que fixa a proposta
     correta mesmo com outra proposta aberta na sessão (conferido no Acesso Livre).
     Requisitos e Anexos usam os endereços diretos indicados pelo usuário, que não
     carregam `idProposta` na URL e leem a proposta da sessão do Acesso Livre:
     `_proposta/Requisitos/listarRequisitosDocumentos.jsf` (tela de Requisitos para
     Celebração) e `ListarAnexosGenericos/AnexosExibirAnexosProposta.do` (listagem
     de anexos). Se a sessão estiver com outra proposta, o Transferegov exibe essa
     outra proposta: nesse caso, clicar primeiro em Dados fixa a sessão na proposta
     correta e em seguida usar Requisitos/Anexos. */
  function transferegovBox(p){
    const numero=proposalNumber(p.imported.numero);
    const alvo=' target="_blank" rel="noopener noreferrer"';
    const item=(rotulo,href,titulo,aria)=>`<a class="tgov-btn" href="${e(href)}"${alvo} title="${e(titulo)}" aria-label="${e(aria)}">${e(rotulo)}</a>`;
    const REQUISITOS_URL='https://discricionarias.transferegov.sistema.gov.br/voluntarias/_proposta/Requisitos/listarRequisitosDocumentos.jsf';
    const ANEXOS_URL='https://discricionarias.transferegov.sistema.gov.br/voluntarias/ListarAnexosGenericos/AnexosExibirAnexosProposta.do';
    return `<div class="tgov-box" aria-label="Atalhos para o Transferegov"><span class="tgov-brand">Transferegov <small>Acesso Livre</small></span><div class="tgov-actions">${item('Dados',consultaPublica(p.id,''),`Abrir os dados da proposta ${numero} no Transferegov (Acesso Livre)`,`Abrir dados da proposta ${numero} no Transferegov (Acesso Livre)`)}${item('PAD',consultaPublica(p.id,'DetalharBensProposta'),`Abrir o Plano de Aplicação Detalhado da proposta ${numero} no Transferegov (Acesso Livre)`,`Abrir Plano de Aplicação Detalhado da proposta ${numero} no Transferegov (Acesso Livre)`)}${item('Requisitos',REQUISITOS_URL,`Abrir os Requisitos para Celebração no Transferegov (Acesso Livre). Se exibir outra proposta, clique antes em Dados para fixar a proposta ${numero} na sessão`,`Abrir Requisitos para Celebração no Transferegov (Acesso Livre)`)}${item('Anexos',ANEXOS_URL,`Abrir a listagem de anexos no Transferegov (Acesso Livre). Se exibir outra proposta, clique antes em Dados para fixar a proposta ${numero} na sessão`,`Abrir listagem de anexos no Transferegov (Acesso Livre)`)}</div></div>`;
  }
  function link(r){return r.url?`<a href="${e(D.safeLink(r.url))}" target="_blank" rel="noopener noreferrer">${e(r.document || 'Documento')}</a>`:e(r.document || '—');}
  async function persist(next,opts={}){
    if(isReadOnly())throw new Error('Ambiente de consulta pública (somente leitura).');
    D.assert(!busy,'Aguarde a gravação em andamento.');
    const expected=opts.restore?state.revision:next.revision;
    if(expected!==state.revision){$('#save-state').textContent='Conflito de revisão — alteração não salva';$('#save-state').dataset.state='conflict';throw Object.assign(new Error('A revisão mudou; reabra a ação antes de salvar.'),{status:409});}busy=true;$('#save-state').textContent='Salvando…';$('#save-state').dataset.state='saving';
    try{state=await ProforStore.save(next,expected,opts);$('#save-state').textContent=`Salvo localmente · revisão ${state.revision} · ${new Date().toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})} (Brasília)`;$('#save-state').dataset.state='saved';renderSideNav();}
    catch(err){$('#save-state').textContent=err.status===409?'Conflito de revisão — recarregue e confira os dados':'Falha ao salvar — alteração não confirmada';$('#save-state').dataset.state=err.status===409?'conflict':'error';throw err;}
    finally{busy=false;}
  }
  async function change(fn){D.assert(!isReadOnly(),'Consulta pública: alteração indisponível.');D.assert(!busy,'Aguarde a gravação em andamento.');const next=D.clone(state);const p=next.proposals.find(x=>x.id===selected);fn(p,next);await persist(next);render();}
  function closeModal(){if(busy)return; if(modalDirty && !confirm('Descartar as alterações ainda não salvas deste formulário?'))return;cancelSync('closed');$('#modal').close();modalDirty=false;}
  function modal(title,html){if(!$('#modal').open){const el=document.activeElement;focusReturn={id:el?.id,dataset:{...el?.dataset}};}$('#modal-title').textContent=title;$('#modal-content').innerHTML=html;modalDirty=false;if(!$('#modal').open)$('#modal').showModal();}
  function formError(err){const el=$('#form-error');if(el){el.textContent=err.message;el.focus();}else toast(err.message,true);}
  function formEnd(label='Salvar'){return `<p id="form-error" class="error-message" role="alert" tabindex="-1"></p><div class="dialog-actions">${button('Cancelar','close')}<button class="primary" type="submit">${label}</button></div>`;}
  function bindForm(handler){const form=$('#modal-content form');form.addEventListener('input',()=>modalDirty=true);form.addEventListener('submit',async event=>{event.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;try{await handler(new FormData(form));}catch(err){formError(err);}finally{submit.disabled=false;}});}
  function saved(message){modalDirty=false;$('#modal').close();toast(message);}
  /* `view` é a tela sem proposta selecionada: painel, programa, apagadas ou registros. */
  function route(){const from=document.activeElement?.getAttribute('href');const parts=location.hash.slice(1).split('/');const prevSelected=selected,prevTab=activeTab,prevView=view;selected=parts[0]==='proposta'?parts[1]:null;if(!selected)view=['apagadas','registros','programa'].includes(parts[0])?parts[0]:'painel';
    if(view==='programa')programTab=['dados','investimento','contrapartida','anexos','despesas'].includes(parts[1])?parts[1]:'dados';
    if(view==='registros' && prevView!=='registros'){selectedHistoryDay=null;calendarStart=null;}
    /* Roteamento: 'analise' é a aba de Mérito; a chave antiga 'merito' continua
       roteável para não quebrar favoritos. A extinta aba 'habilitacao' cai em
       'dados', porque não existe mais como seção. */
    const aba=parts[2];
    activeTab=Object.hasOwn(tabNames,aba)?aba:'dados';
    if(activeTab==='merito')activeTab='analise';
    if(activeTab==='pad' && (prevSelected!==selected || prevTab!=='pad')){padSearch='';padItemSearch='';padSearchOwner=null;padSelectedItems.clear();padSelectedStatuses.clear();padBatchItems.clear();padBatchAction='';padSelectorOpen=false;padStatusOpen=false;}
    if(prevSelected!==selected || prevTab!==activeTab)expandedReqs.clear();
    render();if(from===location.hash){const next=[...document.querySelectorAll('.tabs a')].find(a=>a.getAttribute('href')===from);(next || $('#main')).focus();}}
  function render(){
    if(!state)return;
    const publico=isReadOnly();
    /* O item "Ligar servidor" só faz sentido quando a página foi aberta pelo
       arquivo HTML (file://): na origem do servidor ele é sempre desnecessário,
       porque o caminho normal é o atalho "INICIAR SISTEMA". */
    const origemArquivo=location.protocol==='file:';
    const menuServidor=$('#server-open');
    if(menuServidor)menuServidor.hidden=!origemArquivo || publico;
    const menuDeleted=$('#nav-deleted');
    if(menuDeleted)menuDeleted.hidden=false;
    const menuRecords=$('#nav-records');
    const rotuloLocal=document.querySelector('.local-label');
    if(rotuloLocal && publico){
      rotuloLocal.textContent='● Consulta pública';
      rotuloLocal.classList.add('public-label');
    }
    $('#nav-panel').classList.toggle('active',!selected && view==='painel');
    $('#nav-program')?.classList.toggle('active',!selected && view==='programa');
    $('#nav-deleted').classList.toggle('active',!selected && view==='apagadas');
    if(menuRecords)menuRecords.classList.toggle('active',!selected && view==='registros');
    if(selected){
      const p=state.proposals.find(x=>x.id===selected);
      if(!p){$('#main').innerHTML='<h1>Proposta não localizada</h1><a href="#painel">Voltar ao painel</a>';return;}
      if(p.isDeleted){$('#main').innerHTML=`<a class="back" href="#apagadas">← Voltar às propostas apagadas</a><h1>Proposta apagada</h1><div class="info warning">A proposta <span class="proposal-number"><strong>${e(proposalNumber(p.imported.numero))}</strong>${proposalCopyButton(p.imported.numero)}</span> (${e(p.imported.uf)}) está apagada do painel e fora das telas de gestão. Restaure-a para voltar a analisar.</div><div class="actions">${isReadOnly()?'':button('↺ Restaurar proposta','restore-proposal',`data-id="${e(p.id)}"`,'primary')}${button('Ver apagadas','ver-apagadas')}</div>`;return;}
      renderProposal(p);
    }
    else if(view==='programa')renderProgram();
    else if(view==='apagadas')renderDeleted();
    else if(view==='registros')renderRecords();
    else renderPanel();
    /* O contador de apagadas no menu acompanha o estado atual. */
    renderSideNav();
  }
  /* Tela de propostas apagadas: mesma linguagem do painel, por UF, com expansão
     e o botão de restaurar no lugar do botão de apagar. */
  function renderDeleted(){
    const apagadas=D.deletedProposals(state);
    const ufsComApagadas=deletedUfs().length;
    $('#main').innerHTML=`<div class="page-head"><div><div class="eyebrow">PROFOR / ONASP 2026</div><h1>Propostas apagadas</h1><p class="muted">Propostas retiradas do painel e das demais telas de gestão. Continuam no banco local e não entram nas sincronizações. Restaure para devolvê-las ao acompanhamento.</p></div></div>
      <div class="stats"><div class="stat"><strong>${apagadas.length}</strong><span>Proposta(s) apagada(s)</span></div><div class="stat"><strong>${ufsComApagadas}</strong><span>UF(s) com proposta apagada</span></div><div class="stat"><strong>${D.activeProposals(state).length}</strong><span>Proposta(s) ativas no painel</span></div></div>
      <section class="section"><div class="section-head"><h2>Apagadas por UF</h2><small>da mais recente para a mais antiga</small></div>
      <div class="filters"><label class="search">Buscar proposta ou proponente<input id="del-search" type="search" value="${e(filters.search)}" placeholder="Número, nome ou UF"></label><label>UF<select id="del-uf">${options({'':'Todas as UFs',...D.UFS},filters.uf)}</select></label></div>
      <div class="table-wrap"><table class="table-fit del-table"><colgroup><col class="c-expand"><col class="c-uf"><col class="c-proposta"><col class="c-valor"><col class="c-tempo"><col class="c-flag"><col class="c-status"></colgroup><thead><tr><th class="cell-center c-expand-th" scope="col"><span class="sr-only">Expandir linha</span></th><th class="cell-center">Unidade Federativa</th><th class="cell-center">Proposta</th><th class="cell-center">Valor global</th><th class="cell-center">Apagada em</th><th class="cell-center">Outras</th><th class="cell-center">Status</th></tr></thead><tbody id="del-rows"></tbody></table></div></section>
      ${!apagadas.length?'<div class="info">Nenhuma proposta apagada. Ao usar “Apagar proposta” no painel, ela aparece aqui e pode ser restaurada a qualquer momento.</div>':''}
      <p class="source">Apagar não exclui o registro: ele permanece no banco local com o histórico, e você pode restaurá-lo. A origem (Transferegov) não é alterada.</p>`;
    $('#del-search').addEventListener('input',ev=>{filters.search=ev.target.value;renderRows('apagadas');});
    $('#del-uf').addEventListener('change',ev=>{filters.uf=ev.target.value;renderRows('apagadas');});
    renderRows('apagadas');
  }
  async function refreshHistory(force=false){
    if(historyLoading)await historyLoading;
    if(syncHistory && !force)return syncHistory;
    historyLoading=ProforStore.history().then(entries=>{
      D.assert(Array.isArray(entries),'Lista de registros inválida.');
      syncHistory=entries;
      return entries;
    });
    try{return await historyLoading;}finally{historyLoading=null;}
  }
  function shiftCalendarDay(day,amount){const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+amount);return date.toISOString().slice(0,10);}
  function calendarWeek(day){return shiftCalendarDay(day,-new Date(`${day}T12:00:00Z`).getUTCDay());}
  function dateLabel(day){return new Intl.DateTimeFormat('pt-BR',{dateStyle:'full',timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`));}
  function historyTime(at){return new Date(at).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit'});}
  function historyCounts(){const counts=new Map();for(const entry of syncHistory||[])counts.set(entry.date,(counts.get(entry.date)||0)+visibleHistoryChanges(entry.changes).length);return counts;}
  function calendarHtml(){
    const today=D.localToday(),counts=historyCounts(),middle=shiftCalendarDay(calendarStart,21),month=middle.slice(0,7);
    const title=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${middle}T12:00:00Z`));
    const weekdays=['D','S','T','Q','Q','S','S'].map((day,index)=>`<span aria-label="${['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'][index]}">${day}</span>`).join('');
    const days=Array.from({length:42},(_,index)=>{
      const day=shiftCalendarDay(calendarStart,index),count=counts.get(day)||0;
      const label=`${dateLabel(day)}${count?` · ${count} ${count===1?'dado novo':'dados novos'}`:''}`;
      const classes=['calendar-day',day.slice(0,7)!==month?'outside':'',day===today?'today':'',day===selectedHistoryDay?'selected':''].filter(Boolean).join(' ');
      return `<button type="button" class="${classes}" data-action="history-day" data-day="${day}" title="${e(label)}" aria-label="${e(label)}" ${day===selectedHistoryDay?'aria-current="date"':''}><span>${Number(day.slice(8))}</span>${count?'<i class="calendar-dot" aria-hidden="true"></i>':''}</button>`;
    }).join('');
    return `<section class="records-calendar section" aria-label="Calendário de atualizações"><div class="calendar-heading"><h2 aria-live="polite">${e(title)}</h2><div><button type="button" class="calendar-arrow" data-action="history-prev" aria-label="Voltar uma semana">‹</button><button type="button" class="calendar-arrow" data-action="history-next" aria-label="Avançar uma semana">›</button></div></div><div class="calendar-weekdays">${weekdays}</div><div class="calendar-grid">${days}</div><button type="button" class="calendar-today" data-action="history-today">Voltar para hoje</button></section>`;
  }
  function historyActivityHtml(entry){
    if(entry.reconstructed)return '<p class="source">As versões antigas guardam o Antes/Depois, mas não as linhas de atividade da execução.</p>';
    return `<ol class="history-log">${entry.activity.map(line=>`<li><time>${e(historyTime(line.at))}</time><span>${e(line.message)}</span></li>`).join('')}</ol>`;
  }
  function historyDayHtml(){
    if(!selectedHistoryDay)return '';
    const entries=(syncHistory||[]).filter(item=>item.date===selectedHistoryDay);
    if(!entries.length)return '';
    const groupsByRun=entries.map(entry=>({entry,changes:visibleHistoryChanges(entry.changes)}));
    const changeCount=groupsByRun.reduce((total,run)=>total+run.changes.length,0);
    const groups=groupsByRun.filter(run=>run.changes.length).map(({entry,changes})=>`<div class="history-change-group"><h3>Atualização às ${e(historyTime(entry.at))} <span>${changes.length} ${changes.length===1?'alteração':'alterações'}</span></h3>${syncChangesHtml(changes)}</div>`).join('');
    const runs=groupsByRun.map(({entry,changes},index)=>`<details class="history-run" ${index===entries.length-1?'open':''}><summary><strong>${e(historyTime(entry.at))}</strong><span>${changes.length?`${changes.length} campo(s) alterado(s)`:'Sem dados novos'}</span>${entry.reconstructed?'<small>Reconstruído das versões do banco</small>':''}</summary>${entry.source?`<p class="source">Origem: ${e(entry.source)}</p>`:''}${historyActivityHtml(entry)}</details>`).join('');
    return `<section class="section records-day"><div class="section-head"><div><h2>${e(dateLabel(selectedHistoryDay))}</h2><p class="source">${entries.length} atualização(ões) concluída(s) · ${changeCount} alteração(ões) de campo</p></div></div><div class="section-body">${changeCount?groups:'<p class="info">Sem dados novos no dia.</p>'}<h3>Execuções e registros de atividade</h3>${runs}</div></section>`;
  }
  function renderRecords(){
    if(!syncHistory){
      $('#main').innerHTML='<div class="page-head"><div><h1>Registros de atualização</h1><p class="muted">Carregando o histórico do banco local…</p></div></div>';
      refreshHistory().then(()=>{if(view==='registros')renderRecords();}).catch(err=>{if(view==='registros')$('#main').innerHTML=`<h1>Registros de atualização</h1><div class="info error">${e(err.message)}</div>`;});
      return;
    }
    if(!calendarStart)calendarStart=calendarWeek(D.localToday().slice(0,7)+'-01');
    if(!selectedHistoryDay)selectedHistoryDay=syncHistory.slice().reverse().find(entry=>visibleHistoryChanges(entry.changes).length)?.date||syncHistory.at(-1)?.date||null;
    $('#main').innerHTML=`<div class="page-head"><div><div class="eyebrow">PROFOR / ONASP 2026</div><h1>Registros de atualização</h1><p class="muted">Histórico das atualizações concluídas. Selecione uma data para consultar as mudanças e o registro de atividade.</p></div></div><div class="records-layout"><div id="records-detail">${historyDayHtml()}</div>${calendarHtml()}</div>`;
  }
  function moveCalendar(weeks){calendarStart=shiftCalendarDay(calendarStart,weeks*7);renderRecords();}
  /* Submenu do painel lateral: uma linha por proposta localizada, no padrão
     "UF - NNNNN/AAAA", em ordem alfabética de UF e de número. */
  function renderSideNav(){
    if(isReadOnly()){
      const saveStateEl=$('#save-state');
      if(saveStateEl){
        const stamp=at=>new Date(at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' (Brasília, UTC−3)';
        const dt=window.PROFOR_PUBLIC_UPDATED_AT ? stamp(window.PROFOR_PUBLIC_UPDATED_AT) : '';
        saveStateEl.textContent=`Consulta pública · ${dt?'Snapshot gerado em '+dt:'Geração não informada'} · Última sincronização da origem: ${state.sync?.at?stamp(state.sync.at):'não informada'}`;
      }
    }
    const menuServidor=$('#server-open');
    if(menuServidor)menuServidor.onclick=()=>{
      modal('Abrir o sistema com o servidor ligado',`<p>Os dados ficam guardados <strong>por origem</strong>: o que já foi sincronizado pertence ao endereço do servidor, e não a esta janela aberta pelo arquivo HTML — por isso o painel aparece vazio aqui.</p><p>Feche esta janela e abra o sistema pelo <strong>atalho da Área de Trabalho</strong>, ou pelo arquivo <strong>INICIAR SISTEMA.cmd</strong>, na pasta do sistema: ele liga o servidor local e abre o sistema no endereço certo, com os dados carregados.</p><div class="dialog-actions">${button('Fechar','close')}</div>`);
    };
    const nav=$('#uf-props-nav');
    const contador=$('#del-count');
    /* O contador do menu só aparece quando há proposta apagada; zero fica oculto. */
    if(contador){const n=state?D.deletedProposals(state).length:0;contador.textContent=n>0?String(n):'';}
    if(!nav)return;
    /* Só as propostas ativas: as apagadas saem do acompanhamento e ficam na
       tela própria, acessível pelo item "Propostas apagadas". */
    const itens=D.activeProposals(state)
      .map(p=>({p,numero:proposalNumber(p.imported.numero),txt:`${p.imported.uf} - ${proposalNumber(p.imported.numero)}`}))
      .sort((a,b)=>a.txt.localeCompare(b.txt,'pt-BR'));
    nav.innerHTML=itens.length
      ? itens.map(({p,numero,txt})=>`<span class="side-proposal"><a href="#proposta/${e(p.id)}/dados" title="${e(p.imported.proponente)} — ${e(txt)}">${ufFlag(p.imported.uf,D.UFS[p.imported.uf])} <span class="side-uf">${e(txt)}</span></a>${proposalCopyButton(numero)}</span>`).join('')
      : '<p class="side-empty">Nenhuma proposta ativa no banco local. Use “Sincronização”, ou o atalho da Área de Trabalho para abrir o sistema com o servidor ligado.</p>';
  }
  function toggleProposalNav(){
    const nav=$('#uf-props-nav'),btn=$('#props-open');
    if(!nav||!btn)return;
    const abrir=nav.hidden;
    nav.hidden=!abrir;
    btn.setAttribute('aria-expanded',abrir?'true':'false');
    btn.classList.toggle('open',abrir);
    if(abrir)renderSideNav();
  }
  function renderProgram(){
    const p=PROGRAM;
    const tabs=[['dados','Dados'],['investimento','Item de Investimento'],['contrapartida','Regras de Contrapartida'],['anexos','Anexos'],['despesas','Lista de Item - Tipo de Despesa']];
    const fields=items=>`<dl class="program-facts">${items.map(([label,value])=>`<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>`;
    const localOrigin=['127.0.0.1','localhost'].includes(location.hostname) || location.protocol==='file:' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname) || location.hostname.toLowerCase().startsWith('mj-');
    const file=f=>`<li class="program-file"><strong>${e(f.title)}</strong><a class="program-open" href="${e(localOrigin?new URL(f.href,'https://masselorc.github.io/PROFOR-2026/').href:f.href)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir ${e(f.title)} em nova guia">Abrir ↗</a></li>`;
    let content='';
    if(programTab==='dados')content=`<div class="program-panel">${fields([['Nome do programa',p.title],...p.facts])}<div class="program-text"><h2>Descrição</h2><p>${e(p.description)}</p><h2>Observação</h2><p>${e(p.observation)}</p><h2>Critérios de seleção</h2><p>${e(p.selection)}</p><p class="source">Os textos acima são sínteses. O teor integral consta no Transferegov e no edital.</p></div><h2>Arquivo exibido em Dados</h2><ul class="program-files">${file(p.dataFile)}</ul></div>`;
    else if(programTab==='investimento')content=`<div class="program-panel"><div class="table-wrap"><table><thead><tr><th>Item de investimento</th><th>Categoria</th></tr></thead><tbody>${p.investment.map(row=>`<tr><td>${e(row[0])}</td><td>${e(row[1])}</td></tr>`).join('')}</tbody></table></div></div>`;
    else if(programTab==='contrapartida')content=`<div class="program-panel">${fields(p.counterpart)}<p class="source">Valores reproduzidos como exibidos no Acesso Livre em ${e(p.consultedAt)}. Consulte a regra integral no portal.</p></div>`;
    else if(programTab==='anexos')content=`<div class="program-panel"><ul class="program-files">${p.attachments.map(file).join('')}</ul><p class="source program-file-source">Cópias de consulta do projeto; confira os originais no Transferegov.${localOrigin?' No acesso local, a abertura dos arquivos exige internet.':''}</p></div>`;
    else content='<div class="program-panel"><p class="program-empty">Nenhum registro encontrado nas listas de arquivos novos ou salvos na consulta ao Transferegov.</p></div>';
    $('#main').innerHTML=`<div class="page-head program-head"><div><div class="eyebrow">PROFOR / ONASP 2026</div><h1>Programa</h1><p class="muted">${e(p.title)}</p></div></div>
      <section class="section program-access" aria-label="Acesso ao programa no Transferegov"><div class="program-access-top"><span class="program-brand"><span class="program-brand-icon" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="tgov-brand">Transferegov <small>Acesso Livre</small></span></span><a class="program-portal-button" href="${e(p.searchUrl)}" target="_blank" rel="noopener noreferrer">Consultar programa no Transferegov ↗</a></div><p>Na consulta, preencha os dois campos:</p><div class="program-codes"><div><span>Código do Órgão</span><strong>${e(p.agencyCode)}</strong>${button('Copiar','copy-program-code',`data-code="${e(p.agencyCode)}" aria-label="Copiar código do órgão"`,'program-copy')}</div><div><span>Código do Programa</span><strong>${e(p.code)}</strong>${button('Copiar','copy-program-code',`data-code="${e(p.code)}" aria-label="Copiar código do programa"`,'program-copy')}</div></div><p class="source">Dados consultados no Acesso Livre em ${e(p.consultedAt)}. A situação oficial pode ter mudado; confira no portal.</p></section>
      <nav class="tabs program-tabs" aria-label="Seções do programa">${tabs.map(([key,label])=>`<a href="#programa/${key}" class="${programTab===key?'active':''}" ${programTab===key?'aria-current="page"':''}>${e(label)}</a>`).join('')}</nav><section class="section program-section" aria-label="${e(tabs.find(([key])=>key===programTab)[1])}">${content}</section>`;
  }
  function renderPanel(){
    /* Só propostas ativas: as apagadas saem do painel e das demais telas de
       gestão e acompanhamento. Novas evidências continuam invalidando avaliações antes de eventual restauração. */
    const ps=D.activeProposals(state),apagadas=D.deletedProposals(state);
    const received=new Set(ps.map(p=>p.imported.uf)).size;
    const pendingCount=ps.reduce((n,p)=>n+D.pending(p).length,0);
    const apt=ps.filter(D.aptForCelebration).length;
    const enviadas=new Set(ps.filter(p=>D.sourceState(p.imported).key==='enviada').map(p=>p.imported.uf)).size;
    const acoesPainel=button('⇩ Exportação','export')+button('↻ Sincronização','sync','','primary');
    const subPainel='Acompanhe a análise, as diligências e a preparação para celebração.';
    const fontePainel=`Última sincronização: ${state.sync?e(new Date(state.sync.at).toLocaleString('pt-BR')):'ainda não realizada'}${state.sync?.source?` · origem: ${e(String(state.sync.source))}`:''}. Dados locais são uma fotografia da extração e não comprovam recebimento ou situação atual no Transferegov.`;
    $('#main').innerHTML=`<div class="page-head"><div><div class="eyebrow">PROFOR / ONASP 2026</div><h1>Visão geral das propostas</h1><p class="muted">${subPainel}</p></div><div class="page-actions">${acoesPainel}</div></div>
      <div class="stats dashboard-stats" aria-label="Resumo de todas as propostas ativas, antes dos filtros">
        <div class="stat stat-eligible"><div class="stat-header"><span class="stat-label">UFs elegíveis</span><span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></span></div><strong class="stat-value">14</strong><span class="stat-note">UFs do edital</span></div>
        <div class="stat stat-received"><div class="stat-header"><span class="stat-label">UFs com proposta importada</span><span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h4M10 13h6M10 17h6"/></svg></span></div><strong class="stat-value">${received}</strong><span class="stat-note">De 14 elegíveis</span></div>
        <div class="stat stat-sent"><div class="stat-header"><span class="stat-label">UFs com envio para análise</span><span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-8-8 18-2-8-8-2Z"/><path d="m11 13 6-6"/></svg></span></div><strong class="stat-value">${enviadas}</strong><span class="stat-note">Envio registrado</span></div>
        <div class="stat stat-active"><div class="stat-header"><span class="stat-label">Propostas ativas</span><span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg></span></div><strong class="stat-value">${ps.length}</strong><span class="stat-note">${apagadas.length?`${apagadas.length} apagada(s) fora do painel`:'No painel'}</span></div>
        <div class="stat stat-ready"><div class="stat-header"><span class="stat-label">Aptas pelos controles locais</span><span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg></span></div><strong class="stat-value">${apt}</strong><span class="stat-note">Controles locais</span></div>
      </div>
      <section class="section" aria-label="Acompanhamento por UF"><h2 class="sr-only">Acompanhamento por UF</h2>
      <div class="filters panel-filters"><label class="search">Buscar proposta ou proponente<input id="search" type="search" value="${e(filters.search)}" placeholder="Número, nome ou UF"></label><label>UF<select id="filter-uf">${options({'':'Todas as UFs',...D.UFS},filters.uf)}</select></label><label>Status no Transferegov<select id="filter-source">${options({'':'Todos os status',...Object.fromEntries(SOURCE_CHAVES.map(k=>[k,SOURCE_ROTULO[k]]))},filters.source)}</select></label><label>Status<select id="filter-status">${options(Object.fromEntries(['','Sem proposta importada',...STATUS_PROPOSTA].map(x=>[x,x || 'Todos os status'])),filters.status)}</select></label><label>Controle<select id="filter-control">${options({'':'Todos os controles',financial:'Inconsistência financeira',unlinked:'Diligência sem registro',ouvidoria:'Ouvidoria pendente',merito:'Mérito pendente',proposta:'Requisitos da Proposta pendentes',formalizacao:'Requisitos para Formalização pendentes'},filters.control)}</select></label></div>
      <p id="panel-filter-count" class="source" role="status" aria-live="polite"></p><div class="table-wrap"><table class="table-fit"><colgroup><col class="c-expand"><col class="c-uf"><col class="c-proposta"><col class="c-valor"><col class="c-ctrl"><col class="c-dilig"><col class="c-ctrl"><col class="c-status"><col class="c-detalhar"></colgroup><thead><tr><th class="cell-center c-expand-th" scope="col"><span class="sr-only">Expandir linha</span></th><th class="cell-center">Unidade Federativa</th><th class="cell-center">Proposta</th><th class="cell-center">Valor global</th><th class="cell-center">Mérito</th><th class="cell-center">Diligências</th><th class="cell-center" title="Requisitos da Proposta + Requisitos para Formalização">Celebração</th><th class="cell-center">Status</th><th class="cell-center c-detalhar-th" scope="col"><span class="sr-only">Ações</span></th></tr></thead><tbody id="uf-rows"></tbody></table></div></section>
      ${!ps.length?'<div class="info"><strong>Seu painel está pronto para receber as propostas.</strong><br>Use “Sincronização” para baixar automaticamente as extrações oficiais; o modo offline de anexar arquivos CSV fica como contingência. Nenhuma proposta foi presumida ou criada neste banco.</div>':''}
      <section class="section"><div class="section-head"><h2>Controles de consistência</h2></div><div class="section-body consistency"><span>${badge(String(ps.filter(p=>D.finance(p).ok).length),'good')} Valores consistentes</span><span>${badge(String(ps.filter(p=>!D.finance(p).ok).length),'bad')} Dados financeiros ausentes ou divergentes</span><span>${badge(String(pendingCount),pendingCount?'bad':'')} Diligências sem registro</span><span>${badge(String(ps.filter(p=>p.ouvidoria.status==='pendente').length),'warn')} Ouvidorias pendentes</span>${apagadas.length?`<span>${badge(String(apagadas.length),'bad')} Propostas apagadas (fora do painel)</span>`:''}</div></section>
      <p class="source">${fontePainel}</p>`;
    $('#search').addEventListener('input',ev=>{filters.search=ev.target.value;renderRows();});
    for(const key of ['uf','source','status','control'])$('#filter-'+key).addEventListener('change',ev=>{filters[key]=ev.target.value;renderRows();});
    renderRows();
  }
  /* Bandeiras OFICIAIS das 14 UFs do edital, obtidas do Wikimedia Commons e
     embutidas em `bandeiras-uf.js` como PNG (96x64 e 48x32). O desenho é o
     original, sem alteração; origem, títulos e licenças em
     `assets/bandeiras/FONTES.md`, e os SVG originais ficam naquela pasta.
     NÃO usar o par de indicadores regionais do Unicode: os códigos "PE" e "SE"
     colidem com códigos de país e o navegador desenharia as bandeiras do Peru e
     da Suécia. */
  const BANDEIRAS=(typeof BANDEIRAS_UF!=='undefined'?BANDEIRAS_UF:null);
  function ufFlag(uf,rotulo=''){
    /* O código da UF é sempre texto. Se algum dia chegar um objeto aqui, falhar
       alto é melhor do que renderizar "[object Object]" na tabela. */
    D.assert(typeof uf==='string' && /^[A-Z]{2}$/.test(uf),`Bandeira: código de UF inválido (${typeof uf}).`);
    texto(rotulo,'Bandeira: nome da UF');
    const b=BANDEIRAS&&BANDEIRAS[uf];
    if(!b)return '';
    const nome=typeof rotulo==='string'?rotulo:'';
    const label=nome?`Bandeira de ${nome}`:`Bandeira ${uf}`;
    /* <img> com o dobro de resolução para telas 2x; sem requisição externa. */
    return `<img class="uf-flag" src="data:image/png;base64,${b.png96}" width="24" height="16" alt="${e(label)}" title="${e(label)}" loading="lazy" decoding="async">`;
  }
  /* Nome oficial da UF a partir do código. É a única fonte do nome: antes o nome
     vinha, por engano, da LISTA de propostas da UF, e a interpolação imprimia
     "[object Object]" na célula e no resumo. */
  function nomeUf(uf){return D.UFS[uf] || uf;}
  function ufTone(sit){
    if(['Apta à celebração'].includes(sit))return 'tom-ok';
    if(['Em diligência','Em elaboração na origem','Requer nova análise','Formalização com cláusula suspensiva'].includes(sit))return 'tom-aviso';
    if(['Apagada do painel','Análise técnica desfavorável'].includes(sit))return 'tom-no';
    return 'tom-neutro';
  }
  /* Célula da UF: bandeira, sigla e nome em disposição horizontal e centralizada.
     Com mais de uma proposta na UF, a contagem de propostas é indicada no badge.
     O botão de expansão (.row-expand) fica em coluna dedicada (coluna 0). */
  function ufCell(uf,name,ps,modo='ativas'){
    texto(uf,'Célula da UF: código');texto(name,'Célula da UF: nome');texto(modo,'Célula da UF: modo');
    const flag=ufFlag(uf,name);
    const multi=ps.length>1?`<span class="cell-sub uf-multi">(${ps.length} correspondentes)</span>`:'';
    return `<div class="uf">${flag}<span class="uf-pill uf-code">${textoHtml(uf,'Célula da UF: código')}</span><span class="uf-nome uf-name">${textoHtml(name,'Célula da UF: nome')}</span>${multi}</div>`;
  }
  /* Resumo da linha expandida. Sem proposta, não inventa dado nenhum. */
  function rowSummary(uf,name,ps,modo='ativas',sit=''){
    texto(uf,'Resumo da UF: código');texto(name,'Resumo da UF: nome');texto(modo,'Resumo da UF: modo');
    const apagadas=modo==='apagadas';
    if(!ps.length)return `<div class="expansion-wrap"><div class="expansion-header"><div class="expansion-header-info"><span class="expansion-eyebrow">Resumo Executivo da UF</span><h3 class="expansion-title"><span class="uf-cell">${ufFlag(uf,name)}<span class="uf-code">${textoHtml(uf,'UF')}</span></span> ${textoHtml(name,'Resumo da UF: nome')}</h3></div><div class="expansion-badges">${sitBadge(sit||'Sem proposta importada')}</div></div><div class="row-card"><p class="muted"><strong>${textoHtml(name,'Resumo da UF: nome')} (${textoHtml(uf,'Resumo da UF: código')})</strong> não tem proposta vinculada ao programa ${textoHtml(D.PROGRAM,'Resumo da UF: programa')} na última extração. A ausência na extração não exclui uma proposta local já cadastrada.</p><p class="source">Use “Sincronização” para atualizar. O banco desta origem é separado do banco do arquivo HTML.</p></div></div>`;
    const cards=ps.map(p=>{
      const i=p.imported,f=D.finance(p),s=D.sourceState(i),pSit=D.situation(p),padState=D.padSituacao(p,state.sync);
      const faltam=['Repasse','Contrapartida','Valor global'].filter((_,n)=>[i.repasse,i.contrapartida,i.global][n]===null);
      const avisos=[];
      if(faltam.length)avisos.push(`${faltam.join(', ')} sem valor na extração`);
      if(!f.composition && f.complete)avisos.push('repasse + contrapartida difere do valor global');
      if(padState.key==='incompleto' || !f.padComplete)avisos.push(`${padState.titulo}: ${padState.detalhe}`);
      else if(!f.pad)avisos.push('somatório do PAD difere do valor global');
      if(f.errors.length)avisos.push(`${f.errors.length} item(ns) com valor unitário incompatível com total ÷ quantidade`);
      const pend=D.pending(p).length, dilig=p.diligences.filter(d=>!D.diligenceTerminal(d)).length,encerradas=p.diligences.filter(d=>d.status==='nao_saneada').length;
      return `<div class="row-card${apagadas?' row-card-deleted':''}">
        <div class="row-card-head">
          <div class="row-card-title">${proposalLink(p.id,i.numero,'Resumo')}<span class="muted">${textoHtml(i.proponente,'Resumo: proponente')}</span></div>
          <div class="row-card-actions">
            ${!apagadas?`<a class="btn-detail" href="#proposta/${textoHtml(p.id,'Resumo: proposta')}/dados">Abrir análise →</a>`:''}
            ${isReadOnly()?'':(apagadas?button('↺ Restaurar proposta','restore-proposal',`data-id="${textoHtml(p.id,'Resumo: proposta')}"`,'primary'):button('🗑 Apagar proposta','delete-proposal',`data-id="${textoHtml(p.id,'Resumo: proposta')}"`,'danger'))}
          </div>
        </div>
        <dl class="row-grid">
          <div><dt>Situação da análise</dt><dd>${sitBadge(pSit)}</dd></div>
          <div><dt>Status no Transferegov</dt><dd>${badge(s.label,s.tone)}<span class="cell-sub">${textoHtml(s.raw||'sem valor na extração','Resumo: texto do status na origem')}</span></dd></div>
          <div><dt>${apagadas?'Apagada em':'Cadastramento'}</dt><dd>${apagadas?textoHtml(D.fmtDate(p.deletedAt)+' · '+D.fmtDate(p.imported.data),'Resumo: datas'):textoHtml(D.fmtDate(i.data),'Resumo: data')}</dd></div>
          <div><dt>CNPJ</dt><dd>${textoHtml(D.fmtCnpj(i.cnpj)||'não informado','Resumo: CNPJ')}${D.fmtCnpj(i.cnpj)?cnpjCopyButton(i.cnpj):''}</dd></div>
          <div><dt>Valores</dt><dd>Repasse ${textoHtml(D.fmtMoney(i.repasse),'Resumo: repasse')} · Contrapartida ${textoHtml(D.fmtMoney(i.contrapartida),'Resumo: contrapartida')} · Global ${textoHtml(D.fmtMoney(i.global),'Resumo: valor global')}</dd></div>
          <div><dt>Itens do PAD</dt><dd>${padState.key==='incompleto'?textoHtml(padState.titulo+' — '+padState.detalhe,'Resumo: PAD incompleto'):(i.pad||[]).length?`${i.pad.length} item(ns)${f.pad?' — soma confere com o global':' — soma difere do global'}`:textoHtml(padState.titulo,'Resumo: PAD')}</dd></div>
          <div><dt>Vigência na origem</dt><dd>${i.vigenciaInicio||i.vigenciaFim?`${textoHtml(D.fmtDate(i.vigenciaInicio),'Resumo: início da vigência')} a ${textoHtml(D.fmtDate(i.vigenciaFim),'Resumo: fim da vigência')}`:'não informada na extração'}</dd></div>
          <div><dt>Controles</dt><dd>Mérito ${D.groupProgress(p,'merito').done}/${D.groupProgress(p,'merito').total} · Requisitos da Proposta ${D.groupProgress(p,'proposta').done}/${D.groupProgress(p,'proposta').total} · Requisitos para Formalização ${D.groupProgress(p,'formalizacao').done}/${D.groupProgress(p,'formalizacao').total}</dd></div>
          <div><dt>Diligências</dt><dd>${dilig} aberta(s)${encerradas?` · ${encerradas} encerrada(s) não saneada(s)`:''}${pend?` · <strong>${pend} marcação(ões) sem registro</strong>`:''}</dd></div>
        </dl>
        ${apagadas?'<p class="source">Fora das telas de gestão. Sincronizações podem atualizar suas evidências, preservando a exclusão. Use “Restaurar proposta” para devolvê-la ao painel.</p>':''}
        ${avisos.length?`<p class="source warn-text">A conferir: ${textoHtml(avisos.join(' · '),'Resumo: avisos')}.</p>`:''}
        ${i.objeto?`<div class="row-objeto"><span class="cell-sub">Objeto</span><div class="row-objeto-text">${textoHtml(i.objeto,'Resumo: objeto')}</div></div>`:'<p class="source">Objeto não informado nesta extração.</p>'}
      </div>`;
    }).join('');
    const rodape=apagadas
      ? 'Propostas apagadas ficam guardadas no banco. Evidências importadas continuam sendo conferidas; a exclusão permanece até restauração explícita.'
      : (isReadOnly() ? 'Resumo informativo gerado a partir da base oficial do PROFOR / ONASP 2026.' : 'Resumo informativo gerado a partir da extração. Apagar uma proposta a retira do painel e das demais telas de gestão, sem removê-la do banco.');
    return `<div class="expansion-wrap"><div class="expansion-header"><div class="expansion-header-info"><span class="expansion-eyebrow">Resumo Executivo da UF</span><h3 class="expansion-title"><span class="uf-cell">${ufFlag(uf,name)}<span class="uf-code">${textoHtml(uf,'UF')}</span></span> ${textoHtml(name,'Resumo da UF: nome')}</h3></div><div class="expansion-badges">${ps.length>1?`<span class="head-badge">${ps.length} proposta(s) correspondente(s)</span>`:''}${sitBadge(sit)}</div></div>${cards}<p class="source">${rodape}</p></div>`;
  }
  function deletedWhen(p){return p.deletedAt?e(new Date(p.deletedAt).toLocaleString('pt-BR')):'não registrada';}
  /* ---- UFs a partir das duas listas ----
     As duas funções devolvem pares [código da UF, propostas da UF]: o nome
     oficial sai de `nomeUf`, nunca do conteúdo da lista. */
  /* Apagadas: as UFs que têm proposta apagada, em ordem alfabética de UF, e as
     propostas da UF da mais recente para a mais antiga. */
  function deletedUfs(){
    const mapa=new Map();
    for(const p of D.deletedProposals(state)){
      if(!mapa.has(p.imported.uf))mapa.set(p.imported.uf,[]);
      mapa.get(p.imported.uf).push(p);
    }
    return [...mapa.entries()]
      .map(([uf,ps])=>[uf,ps.slice().sort((a,b)=>String(b.deletedAt||'').localeCompare(String(a.deletedAt||'')))])
      .sort((a,b)=>a[0].localeCompare(b[0],'pt-BR'));
  }
  /* Ativas: as 14 UFs do edital, na ordem do cadastro. O par devolvido é
     [código da UF, propostas da UF já ordenadas por envio] — o NOME oficial sai
     de `nomeUf`, nunca da lista de propostas. */
  function activeUfs(){
    const porUf=new Map();
    for(const p of D.activeProposals(state)){
      if(!porUf.has(p.imported.uf))porUf.set(p.imported.uf,[]);
      porUf.get(p.imported.uf).push(p);
    }
    return Object.keys(D.UFS).map(uf=>[uf,D.orderBySend(porUf.get(uf)||[])]);
  }
  /* ---- Colunas de estado ----
     "Status no Transferegov" é a situação da ORIGEM (extração oficial), com o
     termo conciso e o texto literal logo abaixo, para auditoria. "Status
     Proposta" é o andamento do NOSSO trabalho: a análise ONASP da proposta de
     referência da UF. As duas colunas não podem repetir a mesma informação. */
  function ufSituation(ps,modo){
    if(modo==='apagadas')return ps.length===1?'Apagada do painel':`${ps.length} propostas apagadas`;
    /* Referência da UF: a primeira da ordem de envio (a enviada mais antiga, se
       houver). Sem proposta, não inventa andamento nenhum. */
    return ps.length?D.situation(ps[0]):'Sem proposta importada';
  }
  /* Rótulos do filtro "Status no Transferegov" derivados do DOMÍNIO, para o filtro
     nunca sair do vocabulário (antes era um mapa fixo aqui, que ficou para trás
     quando o par de termos mudou). A chave é a do domínio; o texto vem de lá. */
  const SOURCE_SITUACAO={cadastrada:'Proposta/Plano de Trabalho Cadastrados',enviada:'Proposta/Plano de Trabalho Enviado para Análise',rejeitada:'Proposta/Plano de Trabalho Rejeitados',desconhecida:''};
  const SOURCE_CHAVES=Object.keys(SOURCE_SITUACAO);
  const SOURCE_ROTULO=Object.fromEntries(SOURCE_CHAVES.map(k=>[k,D.sourceState({situacao:SOURCE_SITUACAO[k]}).label]));
  /* Vocabulário do "Status Proposta" — as mesmas saídas de D.situation(), na
     ordem de precedência do domínio. */
  const STATUS_PROPOSTA=['Em elaboração na origem','Em análise','Em diligência','Requer nova análise','Análise técnica desfavorável','Apta à celebração','Pendente de celebração','Formalização com cláusula suspensiva'];
  const SIT_CLASSES={'Apta à celebração':'good','Em análise':'work','Análise técnica desfavorável':'bad','Em diligência':'warn','Em elaboração na origem':'warn','Requer nova análise':'warn','Formalização com cláusula suspensiva':'warn','Pendente de celebração':'','Sem proposta importada':'','Apagada do painel':'bad'};
  function sitBadge(rotulo){return badge(rotulo,SIT_CLASSES[rotulo]!==undefined?SIT_CLASSES[rotulo]:'');}
  /* ---- Molde da linha ----
     As colunas de cada modo, na MESMA ordem do <thead>. O molde monta um <td>
     por coluna desta lista: assim a linha tem, por construção, o mesmo número
     de células do cabeçalho, inclusive na UF sem proposta (que antes somava uma
     célula à mão e criava uma coluna inexistente, torta e altíssima). */
  const COLUNAS={
    ativas:['expand','uf','proposta','valor','merito','diligencias','celebracao','situacao','detalhar'],
    apagadas:['expand','uf','proposta','valor','apagada-em','outras','situacao']
  };
  /* Células da linha de UF, uma por coluna declarada acima. Todas as colunas
     recebem `cell-center` (inclusive a primeira, Unidade Federativa, conforme
     alinhamento centralizado solicitado). */
  function celulasDaLinha(modo,uf,name,lista,sit,aberto=false){
    const p=lista[0]||null;
    const vazio='—';
    const proposta=p?proposalLink(p.id,p.imported.numero,'Linha'):vazio;
    const valor=p?textoHtml(D.fmtMoney(p.imported.global),'Linha: valor global'):vazio;
    /* Status na origem: termo conciso com o texto literal da extração logo abaixo. */
    const etapa=p?sourceBadge(p):vazio;
    const abertas=p?p.diligences.filter(d=>!D.diligenceTerminal(d)).length:0;
    const semRegistro=p?D.pending(p).length:0;
    const tom=ufTone(sit);
    const chevronSvg=`<svg class="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    const expandBtn=`<button type="button" class="row-expand ${tom}" data-action="toggle-uf-expand" data-uf="${textoHtml(uf,'UF')}" data-modo="${textoHtml(modo,'Modo')}" aria-expanded="${aberto?'true':'false'}" aria-controls="summary-${textoHtml(uf,'UF')}" aria-label="${aberto?'Recolher proposta de '+textoHtml(name,'UF'):'Expandir proposta de '+textoHtml(name,'UF')}" title="Clique para ${aberto?'recolher':'ver as propostas desta UF'}"><span class="chevron" aria-hidden="true">${chevronSvg}</span></button>`;
    const conteudo={
      expand:`<td class="cell-center c-expand-td">${expandBtn}</td>`,
      uf:`<td class="cell-center">${ufCell(uf,name,lista,modo)}</td>`,
      proposta:`<td class="cell-center">${proposta}</td>`,
      valor:`<td class="number">${valor}</td>`,
      etapa:`<td class="cell-center">${etapa}</td>`,
      merito:`<td class="cell-ctrl cell-center">${p?progress(p,'merito'):vazio}</td>`,
      celebracao:`<td class="cell-ctrl cell-center">${p?progress(p,'celebracao'):vazio}</td>`,
      diligencias:`<td class="cell-dilig cell-center">${p?`<span class="cell-count">${abertas} aberta(s)</span>${semRegistro?`<span class="cell-sub">${semRegistro} sem registro</span>`:''}`:vazio}</td>`,
      'apagada-em':`<td class="cell-center">${p?deletedWhen(p):vazio}</td>`,
      outras:`<td class="cell-center">${p&&lista.length>1?`e mais ${lista.length-1}`:vazio}</td>`,
      situacao:`<td class="cell-center">${sitBadge(sit)}</td>`,
      detalhar:`<td class="cell-center c-detalhar-td">${p?`<a class="btn-detail" href="#proposta/${textoHtml(p.id,'Linha: proposta')}/dados">detalhar</a>`:vazio}</td>`
    };
    const celulas=COLUNAS[modo].map(coluna=>conteudo[coluna]);
    D.assert(celulas.every(c=>c!==undefined),`Linha da UF ${uf}: coluna sem célula no modo ${modo}.`);
    return celulas.join('');
  }
  /* Uma linha por UF. `modo` é 'ativas' (painel) ou 'apagadas'. */
  function renderRows(modo='ativas'){
    const ufs=modo==='apagadas'?deletedUfs():activeUfs();
    const abertoSet=modo==='apagadas'?expandDel:expand;
    const colunas=COLUNAS[modo];
    let html='',matchedCount=0,matchedUfs=0,matchedTotal=0,missingValue=false;
    for(const [uf,lista] of ufs){
      if(filters.uf && filters.uf!==uf)continue;
      const name=nomeUf(uf);
      const matching=lista.filter(p=>D.matchesFilters(p,filters));
      if(lista.length && !matching.length)continue;
      if(!lista.length && (filters.source || filters.control || (filters.status && filters.status!=='Sem proposta importada') || (filters.search && !`${uf} ${name}`.toLocaleLowerCase('pt-BR').includes(filters.search.toLocaleLowerCase('pt-BR')))))continue;
      const correspondentes=matching;matchedCount+=matching.length;if(matching.length)matchedUfs++;for(const proposal of matching){if(proposal.imported.global===null)missingValue=true;else matchedTotal+=proposal.imported.global;}
      const sit=correspondentes.length?ufSituation(correspondentes,modo):'Sem proposta importada';
      const aberto=abertoSet.has(uf);
      const celulas=celulasDaLinha(modo,uf,name,correspondentes,sit,aberto);
      html+=`<tr class="uf-row${aberto?' open row-is-expanded':''}${modo==='apagadas'?' uf-row-deleted':''}" data-uf="${textoHtml(uf,'Linha: UF')}" data-modo="${textoHtml(modo,'Linha: modo')}" tabindex="0" aria-expanded="${aberto?'true':'false'}" title="Clique para ${aberto?'recolher':'ver as propostas desta UF'}">${celulas}</tr>`;
      if(aberto)html+=`<tr class="uf-summary row-summary-detail" id="summary-${textoHtml(uf,'UF')}"><td colspan="${colunas.length}">${rowSummary(uf,name,correspondentes,modo,sit)}</td></tr>`;
    }
    const alvo=modo==='apagadas'?$('#del-rows'):$('#uf-rows');
    if(alvo){
      /* Guarda de estrutura: o molde e o cabeçalho vêm de fontes diferentes
         (esta lista e o HTML da tela). Se alguém mexer só em um dos dois, a
         conferência denuncia na hora em vez de entortar a tabela na tela. */
      const tabela=alvo.closest('table');
      const colunasCabecalho=tabela?tabela.querySelectorAll('thead th').length:0;
      D.assert(!colunasCabecalho || colunasCabecalho===colunas.length,`Tabela do modo ${modo}: ${colunas.length} célula(s) por linha para ${colunasCabecalho} coluna(s) no cabeçalho.`);
      const count=$('#panel-filter-count');if(modo==='ativas' && count)count.textContent=`${matchedCount} proposta(s) correspondentes em ${matchedUfs} UF(s) · Total filtrado: ${D.fmtMoney(matchedTotal)}${missingValue?' (há valores não informados)':''}. Os indicadores acima abrangem todas as propostas ativas.`;
      alvo.innerHTML=html || `<tr><td colspan="${colunas.length}" class="empty">${modo==='apagadas'?'Nenhuma proposta apagada.':'Nenhuma proposta corresponde aos filtros.'}</td></tr>`;
    }
  }
  /* Status na origem: termo conciso no selo e o texto OFICIAL da extração logo
     abaixo, em letra pequena, para conferência e auditoria. */
  function sourceBadge(p){
    const s=D.sourceState(p.imported);
    return `${badge(s.label,s.tone)}<span class="cell-sub">${textoHtml(s.raw||'sem valor na extração','Status no Transferegov: texto da extração')}</span>`;
  }
  function editSei(){
    const p=current(),sei=p.sei || {number:'',url:''};
    modal('Processo SEI da proposta',`<form class="form-stack"><label>Número do processo SEI<input name="number" value="${e(sei.number)}" autocomplete="off"></label><label>Link de acesso ao processo<input name="url" type="url" value="${e(sei.url)}" autocomplete="off"></label><p class="source">Cadastro exclusivo desta proposta. Para removê-lo, deixe os dois campos vazios.</p>${formEnd()}</form>`);
    bindForm(async fd=>{const data=Object.fromEntries(fd);await change(p=>D.setSei(p,data,actor()));saved('Processo SEI salvo.');});
  }
  /* Painel didático e executivo de resultado consolidado da proposta,
     inspirado no padrão do projeto Parâmetros Mínimos. Mostra situação,
     checklist dos critérios obrigatórios, equação financeira e escala de progresso. */
  function renderResultSection(p){
    const i=p.imported, sit=D.situation(p), f=D.finance(p),padState=D.padSituacao(p,state.sync);
    const mProg=D.groupProgress(p,'merito'), pProg=D.groupProgress(p,'proposta'), fProg=D.groupProgress(p,'formalizacao'),padProg=D.groupProgress(p,'pad'),all=D.reviewProgress(p);
    const totalDone=all.done,totalReqs=all.total,pct=all.percent;
    const abertas=p.diligences.filter(d=>!D.diligenceTerminal(d)).length;
    const semReg=D.pending(p).length;
    const allPass=sit==='Apta à celebração';
    const isWarn=['Em diligência','Requer nova análise','Formalização com cláusula suspensiva','Pendente de celebração','Em elaboração na origem'].includes(sit);
    const pillTom=allPass?'status-pass':isWarn?'status-fail':'status-neutral';

    const iconPass=`<svg class="status-icon-svg" viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`;
    const iconFail=`<svg class="status-icon-svg" viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`;
    const iconInfo=`<svg class="status-icon-svg" viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`;
    const statusSvg=allPass?iconPass:isWarn?iconFail:iconInfo;

    const padOk=f.ok && padProg.accepted===padProg.total && p.padImport?.status!=='partial';
    const meritoOk=mProg.accepted===mProg.total;
    const propOk=pProg.accepted===pProg.total;
    const formOk=fProg.accepted===fProg.total;
    const encerradasSemSaneamento=p.diligences.filter(d=>d.status==='nao_saneada').length;
    const diligOk=abertas===0 && semReg===0 && encerradasSemSaneamento===0;

    return `<section class="section result-section" aria-label="Resultado consolidado da análise técnica">
      <div class="result-header">
        <div class="result-title-group">
          <h2>Resultado da Análise Técnica</h2>
          <span class="result-subtitle">${textoHtml(D.UFS[i.uf]||i.uf,'Painel: UF')} — ${textoHtml(i.proponente,'Painel: proponente')} · Proposta nº ${e(proposalNumber(i.numero))}</span>
        </div>
        <div class="result-badge-status">
          <span class="status-pill-lg ${pillTom}">
            ${statusSvg}
            <span>${textoHtml(sit,'Painel: situação da proposta')}</span>
          </span>
        </div>
      </div>

      <div class="result-body">
        <div class="result-overview-col">
          <div class="result-criteria-box">
            <span class="criteria-header-title">Critérios e Etapas de Conformidade (Edital nº 37/2026)</span>
            <ul class="criteria-list">
              <li class="criteria-item ${meritoOk?'crit-pass':'crit-warn'}">
                <span class="crit-icon">${meritoOk?'✓':'!'}</span>
                <div class="crit-info">
                  <strong>1. Análise de Mérito (10 itens)</strong>
                  <span>${meritoOk?'Todos os itens de mérito atendidos e atuais':`${mProg.done} de ${mProg.total} itens revisados`}</span>
                </div>
              </li>
              <li class="criteria-item ${padOk?'crit-pass':'crit-warn'}">
                <span class="crit-icon">${padOk?'✓':'!'}</span>
                <div class="crit-info">
                  <strong>2. Plano de Aplicação Detalhado (PAD)</strong><span>${padProg.done}/${padProg.total} revisados · ${padProg.total-padProg.done} pendentes · ${f.errors.length} divergência(s) unitária(s)</span>
                  <span>${padState.key==='incompleto' || !f.padComplete?textoHtml(padState.titulo+' — '+padState.detalhe,'Painel: situação do PAD'):f.pad?`Soma do PAD (${textoHtml(D.fmtMoney(f.sum),'Painel: soma PAD')}) confere com o valor global`:`Soma do PAD (${textoHtml(D.fmtMoney(f.sum),'Painel: soma PAD')}) diverge do global (${textoHtml(D.fmtMoney(i.global),'Painel: global')})`}</span>
                </div>
              </li>
              <li class="criteria-item ${propOk?'crit-pass':'crit-warn'}">
                <span class="crit-icon">${propOk?'✓':'!'}</span>
                <div class="crit-info">
                  <strong>3. Requisitos da Proposta (Celebração)</strong>
                  <span>${propOk?'Requisitos da proposta atendidos e atuais':`${pProg.done}/${pProg.total} revisados · ${pProg.accepted} atendidos e atuais`}</span>
                </div>
              </li>
              <li class="criteria-item ${formOk?'crit-pass':'crit-warn'}">
                <span class="crit-icon">${formOk?'✓':'!'}</span>
                <div class="crit-info">
                  <strong>4. Requisitos para Formalização (Celebração)</strong>
                  <span>${formOk?'Todos os 13 requisitos de formalização conferidos e atendidos':`${fProg.done}/${fProg.total} revisados · ${fProg.accepted} atendidos e atuais`}</span>
                </div>
              </li>
              <li class="criteria-item ${diligOk?'crit-pass':'crit-warn'}">
                <span class="crit-icon">${diligOk?'✓':'!'}</span>
                <div class="crit-info">
                  <strong>5. Diligências e Condições Especiais</strong>
                  <span>${diligOk?'Nenhuma pendência ou diligência não saneada':`${abertas} diligência(s) aberta(s)${encerradasSemSaneamento?` · ${encerradasSemSaneamento} encerrada(s) não saneada(s)`:''}${semReg?` · ${semReg} marcação(ões) sem registro`:''}`}</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div class="result-score-col">
          <div class="score-equation-wrapper">
            <span class="card-eyebrow">Composição Financeira da Proposta</span>
            <div class="score-equation">
              <div class="score-kpi-card">
                <span class="kpi-label">Repasse Federal</span>
                <div class="kpi-value"><strong>${textoHtml(D.fmtMoney(i.repasse),'Painel: repasse')}</strong></div>
                <span class="kpi-sub">Fundo Penitenciário (FUNPEN)</span>
              </div>
              <span class="score-operator">+</span>
              <div class="score-kpi-card">
                <span class="kpi-label">Contrapartida</span>
                <div class="kpi-value"><strong>${textoHtml(D.fmtMoney(i.contrapartida),'Painel: contrapartida')}</strong></div>
                <span class="kpi-sub">Ente federativo</span>
              </div>
              <span class="score-operator">=</span>
              <div class="score-kpi-card score-kpi-final">
                <span class="kpi-label">Valor Global</span>
                <div class="kpi-value final-val"><strong>${textoHtml(D.fmtMoney(i.global),'Painel: global')}</strong></div>
                <span class="kpi-sub">Total do instrumento</span>
              </div>
            </div>
          </div>

          <div class="score-gauge-box">
            <div class="gauge-header">
              <span>Progresso da revisão humana</span>
              <strong id="gauge-score-val">${totalDone} / ${totalReqs} itens revisados (${pct}%)</strong>
            </div>
            <div class="gauge-track">
              <div id="final-score-fill" class="gauge-fill ${pct===100?'gauge-fill-pass':'gauge-fill-fail'}" style="width:${pct}%;"></div>
              <div class="gauge-marker gauge-marker-100 ${pct===100?'marker-pass':(pct>0?'marker-warn':'marker-zero')}" style="left:${pct}%;" title="Revisão atual: ${pct}% revisado (${totalDone} de ${totalReqs} requisitos)">
                <div class="marker-line"></div>
                <span class="marker-label" style="transform:translateX(-${pct}%);">${pct}% completo</span>
              </div>
            </div>
            <div class="gauge-footer">
              <span>0%</span>
              <span class="gauge-target">Revisão concluída não significa aprovação</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="result-footnote">
        <p>ℹ️ <strong>Processo de Referência:</strong> SEI nº 08016.010062/2026-18 · Edital nº 37/2026 · Programa 3000020260022 · Recursos do Fundo Penitenciário Nacional (FUNPEN). ${p.sei?.number?`Processo SEI exclusivo: <a href="${e(D.safeLink(p.sei.url))}" target="_blank" rel="noopener noreferrer">${e(p.sei.number)}</a> · `:''}Decisões e comprovações de conformidade permanecem sob responsabilidade do analista.</p>
      </div>
    </section>`;
  }
  function renderProposal(p){
    const i=p.imported;
    $('#main').innerHTML=`<a class="back" href="#painel">← Voltar ao painel</a>
      <div class="page-head">
        <div>
          <div class="eyebrow"><span class="uf-cell">${ufFlag(i.uf,D.UFS[i.uf])}<span class="uf-code">${e(i.uf)}</span></span> <span class="muted">·</span> <span>PROPOSTA <span class="proposal-number">${e(proposalNumber(i.numero))}${proposalCopyButton(i.numero)}</span></span></div>
          <h1>${e(D.UFS[i.uf])} <span class="muted">/ ${i.uf}</span></h1>
          <p class="muted">${e(i.proponente)}</p>
          <div class="page-head-badges">
            <span class="head-badge"><span class="head-badge-lbl">Processo SEI:</span> ${p.sei?.number?`<span class="sei-process"><a href="${e(D.safeLink(p.sei.url))}" target="_blank" rel="noopener noreferrer">${e(p.sei.number)}</a></span>`: '<span class="muted">Não cadastrado</span>'}${p.sei?.number?proposalCopyButton(p.sei.number):''} ${isReadOnly()?'':button(p.sei?.number?'Editar processo':'Cadastrar processo','sei','','sei-edit')}</span>
          </div>
        </div>
        <div class="actions">${button('Gerar relatório','report')}${isReadOnly()?'':button(p.conclusion?'Rever conclusão':'Concluir análise técnica','conclude','','primary')}</div>
      </div>
      <details class="review-summary" data-proposal-summary="${e(p.id)}" ${summaryClosed.has(p.id)?'':'open'}><summary>Resumo da revisão · ${D.reviewProgress(p).done}/${D.reviewProgress(p).total} revisados · PAD ${D.groupProgress(p,'pad').done}/${D.groupProgress(p,'pad').total} · ${D.finance(p).errors.length} divergência(s) unitária(s) · ${D.blockers(p,true).length} pendência(s) de aptidão</summary>${renderResultSection(p)}</details>
      ${D.institutionalConflicts(p).length?'<div class="info warning">Conflito legado entre fato institucional e parecer. Os dois registros foram preservados; confira em Mérito → Editar informações.</div>':''}
      ${p.conclusion?`<p class="info">Conclusão técnica: ${e(({favoravel:'Favorável',desfavoravel:'Desfavorável'})[p.conclusion.result]||'Legada, sem referência verificável')} · ${e(p.conclusion.actor)} · ${e(D.fmtDate(p.conclusion.at))}${p.conclusion.reference?` · Evidências: ${e(p.conclusion.reference)}`:''}${p.conclusion.note?` · Justificativa: ${e(p.conclusion.note)}`:''}</p>`:''}
      ${D.pending(p).length?`<div class="info error">${D.pending(p).length} pendência(s) marcada(s) como diligência sem registro ativo. ${isReadOnly()?'':'<a href="#proposta/'+e(p.id)+'/diligencias">Cadastrar diligência</a>'}</div>`:''}
      <nav class="tabs dim-tabs" aria-label="Seções da proposta">${Object.entries(tabNames).filter(([id])=>id!=='merito').map(([id,name])=>`<a data-tab="${id}" class="${id===activeTab?'active':''}" ${id===activeTab?'aria-current="page"':''} href="#proposta/${e(p.id)}/${id}">${name}</a>`).join('')}</nav>${transferegovBox(p)}<div id="tab-content"></div>`;
    document.querySelector('[data-proposal-summary]')?.addEventListener('toggle',ev=>{const el=ev.currentTarget;if(el.open)summaryClosed.delete(el.dataset.proposalSummary);else summaryClosed.add(el.dataset.proposalSummary);});
    if(activeTab==='dados')renderData(p);
    else if(activeTab==='diligencias')renderDiligences(p);
    else if(activeTab==='historico')renderHistory(p);
    else if(activeTab==='analise')renderAnalise(p);
    else if(activeTab==='proposta'||activeTab==='formalizacao')renderRequisitos(p,activeTab);
    else renderReviews(p,activeTab);
  }
  function renderData(p){
    const i=p.imported;
    const vigencia=(i.vigenciaInicio||i.vigenciaFim)?`${D.fmtDate(i.vigenciaInicio)} a ${D.fmtDate(i.vigenciaFim)}`:'Não informada na extração';
    const cnpjFmt=D.fmtCnpj(i.cnpj);
    const nomeEstado=D.UFS[i.uf] || i.uf;
    const s=D.sourceState(i);

    const ouvStatus=p.ouvidoria?.status;
    const ouvLabel=ouvStatus==='instituida'?'Instituída':ouvStatus==='pendente'?'Pendente de instituição':'Não informada';
    const ouvTone=ouvStatus==='instituida'?'good':ouvStatus==='pendente'?'warn':'';

    const falaStatus=p.falaBR;
    const falaLabel=falaStatus==='aderido'?'Já aderido':falaStatus==='previsto'?'Previsto no Plano de Trabalho':falaStatus==='nao_previsto'?'Não previsto no Plano de Trabalho':'Não informada';
    const falaTone=falaStatus==='aderido'?'good':falaStatus==='previsto'?'info':falaStatus==='nao_previsto'?'warn':'';

    $('#tab-content').innerHTML=`<section class="section data-proposal-section">
      <div class="section-head">
        <div>
          <h2>Dados da proposta</h2>
          <small>Extração oficial do Transferegov.br e dados institucionais</small>
        </div>
        <span class="data-origin-badge">Transferegov.br • Programa 3000020260022</span>
      </div>
      <div class="section-body data-sections-body">
        <!-- Bloco 1: Identificação Institucional e Vigência -->
        <div class="data-group-block">
          <div class="data-group-header">
            <span class="card-eyebrow">Identificação Institucional e Vigência</span>
          </div>
          <dl class="data-card-grid data-grid-identificacao">
            <div class="data-card-block">
              <dt>Número da proposta</dt>
              <dd>
                ${proposalLink(p.id,i.numero,'Dados')}
              </dd>
              <span class="data-card-sub">Identificador oficial na plataforma</span>
            </div>

            <div class="data-card-block">
              <dt>CNPJ</dt>
              <dd>
                <span class="cnpj-value">${e(cnpjFmt || 'Não informado')}</span>
                ${cnpjFmt?cnpjCopyButton(cnpjFmt):''}
              </dd>
              <span class="data-card-sub">Cadastro Nacional da Pessoa Jurídica</span>
            </div>

            <div class="data-card-block">
              <dt>Unidade Federativa</dt>
              <dd class="data-uf-val">
                ${ufFlag(i.uf,nomeEstado)}
                <span><strong>${e(nomeEstado)}</strong> / ${e(i.uf)}</span>
              </dd>
              <span class="data-card-sub">Ente federativo convenente</span>
            </div>

            <div class="data-card-block data-col-span-2">
              <dt>Órgão / entidade proponente</dt>
              <dd title="${e(i.proponente || '')}">${e(i.proponente || 'Não informado nesta extração')}</dd>
              <span class="data-card-sub">Secretaria ou órgão responsável</span>
            </div>

            <div class="data-card-block">
              <dt>Data de cadastramento</dt>
              <dd>${e(D.fmtDate(i.data))}</dd>
              <span class="data-card-sub">Registro inicial no sistema</span>
            </div>

            <div class="data-card-block data-col-span-3">
              <dt>Vigência na origem</dt>
              <dd>${e(vigencia)}</dd>
              <span class="data-card-sub">Período de execução constante da proposta</span>
            </div>
          </dl>
        </div>

        <!-- Bloco 2: Situação Oficial e Condições Institucionais -->
        <div class="data-group-block">
          <div class="data-group-header">
            <span class="card-eyebrow">Situação Oficial e Condições Institucionais</span>
          </div>
          <dl class="data-card-grid data-grid-status">
            <div class="data-card-block">
              <dt>Status no Transferegov</dt>
              <dd>
                ${badge(s.label,s.tone)}
              </dd>
              <span class="data-card-sub" title="${e(i.situacao || '')}">${e(i.situacao || 'Situação oficial na plataforma')}</span>
            </div>

            <div class="data-card-block">
              <dt>Instituição da Ouvidoria</dt>
              <dd>
                ${badge(ouvLabel,ouvTone)}
              </dd>
              <span class="data-card-sub">Requisito do Edital nº 37/2026</span>
            </div>

            <div class="data-card-block">
              <dt>Adesão ao Fala.BR</dt>
              <dd>
                ${badge(falaLabel,falaTone)}
              </dd>
              <span class="data-card-sub">Canal integrado de ouvidoria</span>
            </div>
          </dl>
        </div>

        <!-- Bloco 4: Objeto do Instrumento -->
        <div class="data-group-block">
          <div class="data-group-header">
            <span class="card-eyebrow">Objeto do Instrumento</span>
          </div>
          <dl class="data-objeto-dl">
            <div class="data-card-block data-objeto-box">
              <dt>Descrição oficial do objeto</dt>
              <dd class="data-objeto-text texto-oficial">${e(extracted(i.objeto))}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>`;
  }
  /* A antiga seção “Ouvidoria e Fala.BR” foi extinta: os cinco dados dela viraram
     itens de mérito analisados um a um. O que resta é o aviso de instituição
     pendente e o botão que abre o formulário onde esses dados são registrados. */
  function avisoInstitucional(p){
    if(p.ouvidoria.status!=='pendente')return '';
    return `<div class="info warning">Instituição pendente. ${p.ouvidoria.clause?'Aplicabilidade de cláusula suspensiva confirmada pelo analista.':'Confirme a aplicabilidade de cláusula suspensiva no instrumento.'}</div>`;
  }
  /* ---- As duas abas de celebração ----
     A Lista de Conferência dos autos (SEI nº 36183977) é conferida em duas etapas:
     "Requisitos da Proposta" (itens analisados na Nota Técnica 231, SEI 33381502, e
     no Parecer 15, SEI 33369201) e "Requisitos para Formalização" (itens conferidos
     no ato da celebração). Cada linha traz o item, o requisito com o subtexto da
     lista, a fundamentação e a comprovação transcritas, o resultado e o documento.
     As duas abas leem e gravam a MESMA coleção (`reviews.celebracao`): a divisão é
     de tela, sem estado duplicado e sem migração de banco. */
  function fmtFileSize(bytes){
    if(!bytes || bytes<=0)return '0 B';
    if(bytes<1024)return bytes+' B';
    if(bytes<1024*1024)return (bytes/1024).toFixed(1)+' KB';
    return (bytes/(1024*1024)).toFixed(1)+' MB';
  }
  function fileIcon(name){
    const ext=(name || '').split('.').pop().toLowerCase();
    if(ext==='pdf')return 'PDF';
    if(['doc','docx','odt'].includes(ext))return 'DOC';
    if(['xls','xlsx','csv'].includes(ext))return 'XLS';
    if(['png','jpg','jpeg','webp'].includes(ext))return 'IMG';
    if(['zip','rar','7z'].includes(ext))return 'ZIP';
    return '📎';
  }
  function renderAttachmentCard(att){
    return `<div class="attachment-card" data-att-id="${e(att.id)}">
      <div class="attachment-icon-box" aria-hidden="true">${fileIcon(att.name)}</div>
      <div class="attachment-content">
        <span class="attachment-name" title="${e(att.name)}">${e(att.name)}</span>
        <div class="attachment-meta">
          <span>${fmtFileSize(att.size)}</span>
          <span>•</span>
          <span>${D.fmtDate(att.uploadedAt)}</span>
          ${att.uploadedBy?`<span>• ${e(att.uploadedBy)}</span>`:''}
        </div>
        ${att.note?`<div class="attachment-note">${e(att.note)}</div>`:''}
        <div class="attachment-actions">
          <a href="${e(att.data)}" download="${e(att.name)}" class="att-action-btn att-download" target="_blank" rel="noopener noreferrer">⬇ Baixar</a>
          ${isReadOnly()?'':`<button type="button" class="att-action-btn att-delete" data-del-att="${e(att.id)}" title="Excluir anexo">🗑 Excluir</button>`}
        </div>
      </div>
    </div>`;
  }
  function renderExpansionDetail(p,g,x,r){
    const atts=Array.isArray(r.attachments)?r.attachments:[];
    const safeId=String(x.id).replace(/[^a-z0-9_-]/gi,'-');
    const countLabel=atts.length===1?'1 anexo':`${atts.length} anexos`;
    const statusLabel=D.STATUSES[r.status] || 'Não analisado';
    const statusTone=r.status==='ok'?'badge-good':r.status==='diligencia'?'badge-warn':r.status==='no'?'badge-bad':'badge-neutral';
    return `<div class="expansion-wrap">
      <div class="expansion-header">
        <div class="expansion-header-info">
          <span class="expansion-eyebrow">Documentação e Comprovações do Requisito</span>
          <h3 class="expansion-title">Item ${e(x.id)} — ${e(x.label)}</h3>
        </div>
        <div class="expansion-badges">
          <span class="head-badge ${statusTone}"><span class="head-badge-lbl">Situação:</span> ${e(statusLabel)}</span>
          <span class="head-badge"><span class="head-badge-lbl">Arquivos:</span> ${e(countLabel)}</span>
        </div>
      </div>
      <div class="attachment-section">
        <div class="attachment-section-title">Arquivos e Documentos Anexados (${atts.length})</div>
        ${atts.length?`<div class="attachment-grid">${atts.map(renderAttachmentCard).join('')}</div>`:`<div class="attachment-empty">${isReadOnly()?'Nenhum arquivo anexado a este requisito na base de consulta.':'Nenhum arquivo anexado a este requisito até o momento. Utilize o formulário abaixo para anexar comprovantes, declarações ou pareceres em PDF, DOCX, imagem ou planilha.'}</div>`}
      </div>
      ${isReadOnly()?'':`<div class="expansion-upload-box">
        <div class="expansion-upload-header">
          <strong>Anexar Novo Arquivo</strong>
          <small class="muted">Formatos aceitos: PDF, DOC/DOCX, ODT, XLS/XLSX, PNG, JPG (até 25 MB)</small>
        </div>
        <div class="file-dropzone" id="dropzone-${safeId}" tabindex="0" role="button" aria-label="Selecione ou arraste um arquivo para anexar">
          <span class="dropzone-icon" aria-hidden="true">📁</span>
          <span class="dropzone-text">Clique para selecionar ou arraste o arquivo aqui</span>
          <span class="dropzone-hint">O arquivo será salvo com segurança no banco local da proposta</span>
        </div>
        <input type="file" id="file-input-${safeId}" class="hidden-file-input" accept=".pdf,.doc,.docx,.odt,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.zip">
        <div id="file-preview-${safeId}" class="file-selected-info" hidden>
          <div>
            <span class="file-selected-name" id="file-name-${safeId}"></span>
            <span class="file-selected-size" id="file-size-${safeId}"></span>
          </div>
          <button type="button" class="quiet" id="btn-cancel-file-${safeId}" title="Remover seleção" style="padding:2px 8px;min-height:24px;font-size:.75rem">✕ Cancelar</button>
        </div>
        <div class="upload-form-row">
          <label>
            Descrição ou Referência SEI (opcional)
            <input type="text" id="file-note-${safeId}" class="att-note-input" maxlength="250" placeholder="Ex.: Parecer Técnico, Declaração Anexo 1 (SEI 1234567)">
          </label>
        </div>
        <div class="upload-actions">
          <button type="button" class="primary" id="btn-upload-${safeId}" disabled>Anexar ao requisito</button>
        </div>
      </div>`}
    </div>`;
  }
  function bindExpansionDetail(detailTr,p,g,x){
    if(isReadOnly())return;
    const safeId=String(x.id).replace(/[^a-z0-9_-]/gi,'-');
    const dropzone=detailTr.querySelector('#dropzone-'+safeId);
    const fileInput=detailTr.querySelector('#file-input-'+safeId);
    const preview=detailTr.querySelector('#file-preview-'+safeId);
    const nameEl=detailTr.querySelector('#file-name-'+safeId);
    const sizeEl=detailTr.querySelector('#file-size-'+safeId);
    const cancelBtn=detailTr.querySelector('#btn-cancel-file-'+safeId);
    const noteInput=detailTr.querySelector('#file-note-'+safeId);
    const uploadBtn=detailTr.querySelector('#btn-upload-'+safeId);
    let selectedFile=null;
    function resetSelection(){
      selectedFile=null;
      if(fileInput)fileInput.value='';
      if(preview)preview.hidden=true;
      if(dropzone)dropzone.hidden=false;
      if(uploadBtn){uploadBtn.disabled=true;uploadBtn.textContent='Anexar ao requisito';}
    }
    function onFileSelected(file){
      if(!file)return;
      if(file.size>25*1024*1024){
        alert('O arquivo selecionado tem '+fmtFileSize(file.size)+', excedendo o limite máximo de 25 MB.');
        resetSelection();
        return;
      }
      selectedFile=file;
      if(nameEl)nameEl.textContent=file.name;
      if(sizeEl)sizeEl.textContent=' ('+fmtFileSize(file.size)+')';
      if(preview)preview.hidden=false;
      if(dropzone)dropzone.hidden=true;
      if(uploadBtn)uploadBtn.disabled=false;
    }
    if(dropzone && fileInput){
      dropzone.onclick=()=>fileInput.click();
      dropzone.onkeydown=e=>{if(e.key==='Enter' || e.key===' '){e.preventDefault();fileInput.click();}};
      dropzone.ondragover=e=>{e.preventDefault();dropzone.classList.add('dragover');};
      dropzone.ondragleave=()=>dropzone.classList.remove('dragover');
      dropzone.ondrop=e=>{e.preventDefault();dropzone.classList.remove('dragover');if(e.dataTransfer?.files?.[0])onFileSelected(e.dataTransfer.files[0]);};
      fileInput.onchange=()=>{if(fileInput.files?.[0])onFileSelected(fileInput.files[0]);};
    }
    if(cancelBtn)cancelBtn.onclick=resetSelection;
    if(uploadBtn){
      uploadBtn.onclick=async()=>{
        if(!selectedFile)return;
        uploadBtn.disabled=true;
        uploadBtn.textContent='Gravando arquivo…';
        const reader=new FileReader();
        reader.onload=async()=>{
          try{
            const dataUrl=reader.result;
            const note=noteInput?noteInput.value.trim():'';
            const userName=actor();
            await change(currP=>{
              D.addAttachment(currP,g,x.id,{name:selectedFile.name,size:selectedFile.size,type:selectedFile.type,data:dataUrl,note},userName);
            });
            saved('Arquivo anexado com sucesso!');
          }catch(err){
            alert(err.message || 'Erro ao salvar o anexo.');
            uploadBtn.disabled=false;
            uploadBtn.textContent='Anexar ao requisito';
          }
        };
        reader.readAsDataURL(selectedFile);
      };
    }
    detailTr.querySelectorAll('[data-del-att]').forEach(btn=>{
      btn.onclick=async e=>{
        e.stopPropagation();
        const attId=btn.getAttribute('data-del-att');
        if(!confirm('Deseja realmente remover este arquivo anexo?'))return;
        try{
          const userName=actor();
          await change(currP=>{
            D.removeAttachment(currP,g,x.id,attId,userName);
          });
          saved('Anexo removido.');
        }catch(err){
          alert(err.message || 'Erro ao remover o anexo.');
        }
      };
    });
  }
  function initRequisitosExpansion(table,p,g,itens){
    if(!table)return;
    function toggleRow(id){
      const key=`${g}:${id}`;
      if(expandedReqs.has(key))expandedReqs.delete(key);
      else {
        expandedReqs.clear();
        expandedReqs.add(key);
      }
      render();
    }
    table.addEventListener('click',event=>{
      if(event.target.closest('tr.row-summary-detail'))return;
      const interactive=event.target.closest('a, button, input, select, textarea, [data-status-dropdown], .status-option');
      if(interactive && !interactive.classList.contains('row-expand') && !interactive.closest('.row-expand'))return;
      const row=event.target.closest('tr[data-req-row]');
      if(row)toggleRow(row.getAttribute('data-id'));
    });
    table.addEventListener('keydown',event=>{
      if(event.key!=='Enter' && event.key!==' ')return;
      if(event.target.closest('tr.row-summary-detail'))return;
      const interactive=event.target.closest('a, button, input, select, textarea, [data-status-dropdown]');
      if(interactive && !interactive.classList.contains('row-expand') && !interactive.closest('.row-expand'))return;
      const row=event.target.closest('tr[data-req-row]');
      if(row){event.preventDefault();toggleRow(row.getAttribute('data-id'));}
    });
    table.querySelectorAll('tr.row-summary-detail').forEach(detailTr=>{
      const idMatch=detailTr.id.match(/^detail-[^-]+-(.+)$/);
      if(!idMatch)return;
      const safeId=idMatch[1];
      const item=itens.find(it=>String(it.id).replace(/[^a-z0-9_-]/gi,'-')===safeId);
      if(item)bindExpansionDetail(detailTr,p,g,item);
    });
  }
  /* Decisões por item. O padrão é Conformidade / Não Conformidade; dois itens têm
     decisões próprias:
     · instituição da Ouvidoria — Conformidade ou Ausente (a ausência é situação
       prevista no edital e vira cláusula suspensiva do convênio);
     · adesão ao Fala.BR — Já aderiu e Previsto no Plano de Trabalho em verde,
       Sem previsão em amarelo (a adesão é preferencial, não obrigatória).
     `tom` define a cor da lista e do selo de resultado na linha. */
  const OPCOES_DA_ACAO={
    ouvidoriaInstituida:[{valor:'ok',rotulo:'Conformidade',tom:'ok'},{valor:'no',rotulo:'Ausente',tom:'aviso'}],
    falaBRAdesao:[{valor:'ok',rotulo:'Já aderiu',tom:'ok'},{valor:'obs',rotulo:'Previsto no Plano de Trabalho',tom:'ok'},{valor:'no',rotulo:'Sem previsão',tom:'aviso'}]
  };
  const OPCOES_PADRAO=[{valor:'ok',rotulo:'Atende',tom:'ok'},{valor:'obs',rotulo:'Atendido com observação',tom:'info'},{valor:'diligencia',rotulo:'Em diligência',tom:'aviso'},{valor:'no',rotulo:'Não atende',tom:'no'}];
  const OPCOES_PAD=[{valor:'ok',rotulo:'Compatível',tom:'ok'},{valor:'obs',rotulo:'Compatível com observação',tom:'info'},{valor:'diligencia',rotulo:'Em diligência',tom:'aviso'},{valor:'no',rotulo:'Não compatível',tom:'no'}];
  const opcoesDoItem=(g,id)=>g==='pad'?OPCOES_PAD:(g==='merito' && OPCOES_DA_ACAO[id]) || OPCOES_PADRAO;
  const opcaoAtual=(g,id,status)=>opcoesDoItem(g,id).find(o=>o.valor===status) || null;
  const tomDoResultado=tom=>tom==='ok'?'good':tom==='aviso'?'warn':'bad';
  const STATUS_VISUAL={
    na:{tom:'neutro',icone:'E916'},ok:{tom:'ok',icone:'E73E'},obs:{tom:'info',icone:'E946'},
    diligencia:{tom:'aviso',icone:'E823'},no:{tom:'no',icone:'E711'},reanalise:{tom:'aviso',icone:'E72C'}
  };
  const statusVisual=(status,tom='')=>({...(STATUS_VISUAL[status] || STATUS_VISUAL.na),...(tom?{tom}: {})});
  const statusIcon=(codigo,classe='')=>`<span class="status-icon ${classe}" aria-hidden="true">&#x${codigo};</span>`;
  const statusMenuId=(g,id)=>`status-menu-${String(g+'-'+id).replace(/[^a-z0-9_-]/gi,'-')}`;

  function renderRequisitos(p,g){
    const aba=D.ABAS_CELEBRACAO.find(a=>a.id===g);
    D.assert(aba,`Aba de celebração desconhecida: ${g}.`);
    const itens=D.rows(p,g).map(([id,label])=>{
      const meta=D.metaRequisito(g,id);
      D.assert(meta && meta.aba===g,`Sem metadados da Lista de Conferência para o item ${id} da aba ${g}.`);
      return {...meta,id,label};
    });
    const revisão=D.groupProgress(p,g),aceitos=revisão.accepted;
    $('#tab-content').innerHTML=`<section class="section"><div class="section-head"><h2>${textoHtml(aba.titulo,'Aba de celebração: título')}</h2><span class="source">${revisão.done}/${revisão.total} revisados · ${aceitos} atendidos e atuais</span></div>
      <div class="section-body"><p class="source">${textoHtml(aba.nota,'Aba de celebração: nota')}</p></div>
      <div class="table-wrap"><table class="req-table"><colgroup><col class="c-req-item"><col class="c-req"><col class="c-req-fund"><col class="c-req-comp"><col class="c-req-res"><col class="c-req-acao"></colgroup><thead><tr><th>Item</th><th>Requisito</th><th>Fundamentação</th><th>Comprovação</th><th>Resultado</th><th>Ação</th></tr></thead><tbody>${itens.map(x=>{
        const r=D.reviewOf(p,g,x.id);
        const atual=opcaoAtual(g,x.id,r.status);
        const visualAtual=statusVisual(r.status,atual?.tom || '');
        const safeId=String(x.id).replace(/[^a-z0-9_-]/gi,'-');
        const attCount=Array.isArray(r.attachments)?r.attachments.length:0;
        const isExpanded=expandedReqs.has(`${g}:${x.id}`);
        const mainRow=`<tr data-req-row data-group="${e(g)}" data-id="${e(x.id)}" class="${isExpanded?'row-is-expanded':''}" tabindex="0" aria-expanded="${isExpanded?'true':'false'}" aria-controls="detail-${e(g)}-${safeId}">
        <td class="req-item">
          <div class="req-item-col-wrapper">
            <button type="button" class="row-expand tom-${e(visualAtual.tom)}" aria-expanded="${isExpanded?'true':'false'}" aria-controls="detail-${e(g)}-${safeId}" aria-label="Expandir anexos do item ${e(x.id)}" title="Ver anexos, documentos e comprovações">
              <svg class="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
            <span class="req-item-code">${textoHtml(x.id,'Requisito: item')}</span>
            ${attCount?`<span class="attachment-pill" title="${attCount} anexo(s) salvo(s)">📎 ${attCount}</span>`:''}
          </div>
        </td>
        <td class="review-title req-title">${textoHtml(x.label,'Requisito: título')}${x.sub?`<div class="review-note">${textoHtml(x.sub,'Requisito: subtexto da Lista de Conferência')}</div>`:''}${r.note?`<div class="review-note"><strong>Observação:</strong> ${textoHtml(r.note,'Requisito: observação')}</div>`:''}</td>
        <td class="req-fund">${descriptionHtml(p,g,x.id+'-fund',x.fundamentacao)}</td>
        <td class="req-comp">${textoHtml(x.comprovacao,'Requisito: comprovação')}</td>
        <td class="cell-center">${reviewBadge(r)}${evidenceNotice(p,g,x.id)}</td>
        <td class="cell-ctrl cell-center"><div class="review-actions">${acaoDeAnalise(p,g,x.id,r)}${!isReadOnly() && D.pending(p).some(pending=>pending.ref==='celebracao:'+x.id)?button('Criar diligência','diligence',`data-ref="${e('celebracao:'+x.id)}"`):''}</div></td></tr>`;
        const detailRow=isExpanded?`<tr class="row-summary-detail" id="detail-${e(g)}-${safeId}"><td colspan="6">${renderExpansionDetail(p,g,x,r)}</td></tr>`:'';
        return mainRow+detailRow;
      }).join('')}</tbody></table></div></section>`;
    initRequisitosExpansion($('#tab-content table.req-table'),p,g,itens);
  }
  /* Aba de Mérito. A antiga aba Habilitação foi extinta: a etapa de habilitação do
     Edital é verificada na origem e nos itens específicos, e a análise continua
     gravada em `reviews.merito`. Avaliações antigas de `reviews.habilitacao`
     permanecem no banco, sem serem exibidas nem exigidas. */
  function renderAnalise(p){
    $('#tab-content').innerHTML=renderReviews(p,'merito',{secao:true});
  }
  /* Um único controle na coluna Ação, em todas as telas. O aceite simples é
     gravado imediatamente; as demais escolhas abrem o formulário completo já
     no resultado escolhido. Uma análise existente pode ser reaberta pela opção
     final, inclusive quando o resultado atual já é o desejado. */
  function acaoDeAnalise(p,g,id,r){
    const opcoes=opcoesDoItem(g,id),atual=opcaoAtual(g,id,r.status);
    const nome=D.rows(p,g).find(x=>x[0]===id)[1];
    const menuId=statusMenuId(g,id),rotuloAtual=atual?.rotulo || (r.status==='na'?'Analisar':D.STATUSES[r.status]);
    const visualAtual=statusVisual(r.status,atual?.tom || '');
    if(isReadOnly()){
      return `<button type="button" class="status-pill tom-${e(visualAtual.tom)}" data-action="review" data-group="${e(g)}" data-id="${e(id)}" aria-haspopup="dialog" aria-label="Ver detalhes do item ${e(nome)}: ${e(rotuloAtual)}" title="Ver detalhes da análise">${statusIcon(visualAtual.icone)}<span class="status-pill-label">${e(rotuloAtual)}</span>${statusIcon('E890')}</button>`;
    }
    const reanalise=r.status==='reanalise'?`<button type="button" class="status-option tom-aviso" role="option" aria-selected="true" aria-disabled="true" disabled>${statusIcon(STATUS_VISUAL.reanalise.icone)}<span>${e(D.STATUSES.reanalise)}</span></button>`:'';
    const opcoesHtml=[{valor:'na',rotulo:'Analisar',tom:'neutro'},...opcoes].map(o=>{
      const visual=statusVisual(o.valor,o.tom);
      return `<button type="button" class="status-option tom-${e(visual.tom)}" role="option" aria-selected="${o.valor===r.status?'true':'false'}" data-status-value="${e(o.valor)}">${statusIcon(visual.icone)}<span>${e(o.rotulo)}</span>${o.valor===r.status?statusIcon('E73E','status-selected-check'):''}</button>`;
    }).join('');
    return `<div class="status-dropdown" data-status-dropdown data-group="${e(g)}" data-id="${e(id)}">
      <button type="button" class="status-pill tom-${e(visualAtual.tom)}" data-status-toggle aria-haspopup="listbox" aria-expanded="false" aria-controls="${e(menuId)}" aria-label="Analisar o item ${e(nome)}: ${e(rotuloAtual)}">${statusIcon(visualAtual.icone)}<span class="status-pill-label">${e(rotuloAtual)}</span>${statusIcon('E70D','status-chevron')}</button>
      <div class="status-popover" id="${e(menuId)}" data-status-popover hidden>
        <div class="status-options" role="listbox" aria-label="Status de ${e(nome)}">${reanalise}${opcoesHtml}</div>
        <div class="status-divider" role="separator"></div>
        <button type="button" class="status-details" data-status-details>${statusIcon('E70F')}<span>Editar detalhes</span></button>
      </div>
    </div>`;
  }
  async function selecionarAnalise(grupo,item,valor){
    const antes=D.reviewOf(current(),grupo,item).status;
    if(valor==='detalhes'){editReview(grupo,item);return;}
    if(valor===antes && D.reviewCurrent(current(),grupo,item))return;
    if(valor!=='na' && !opcoesDoItem(grupo,item).some(o=>o.valor===valor))return;
    const direto = grupo === 'merito' && (item === 'ouvidoriaInstituida' || item === 'falaBRAdesao');
    if(direto){
      const nome=D.rows(current(),grupo).find(x=>x[0]===item)[1];
      await change(p=>D.markReview(p,grupo,item,valor,actor()));
      const agora=D.reviewOf(current(),grupo,item).status;
      const rotulo=opcaoAtual(grupo,item,agora)?.rotulo || D.STATUSES[agora];
      toast(`“${nome}”: ${rotulo}.`);
      return;
    }
    if(valor!=='ok'){editReview(grupo,item,valor);return;}
    const nome=D.rows(current(),grupo).find(x=>x[0]===item)[1];
    await change(p=>D.markReview(p,grupo,item,true,actor()));
    const agora=D.reviewOf(current(),grupo,item).status;
    const rotulo=opcaoAtual(grupo,item,agora)?.rotulo || D.STATUSES[agora];
    toast(`“${nome}”: ${rotulo}.`);
  }
  function closeStatusDropdown(restoreFocus=false){
    const root=statusDropdownOpen;
    if(!root)return;
    const trigger=root.querySelector('[data-status-toggle]'),popover=root.querySelector('[data-status-popover]');
    if(popover)popover.hidden=true;
    if(trigger)trigger.setAttribute('aria-expanded','false');
    root.classList.remove('open');
    statusDropdownOpen=null;
    if(restoreFocus && trigger?.isConnected)trigger.focus();
  }
  function positionStatusPopover(root){
    const trigger=root.querySelector('[data-status-toggle]'),popover=root.querySelector('[data-status-popover]');
    if(!trigger||!popover)return;
    const rect=trigger.getBoundingClientRect(),gap=6,edge=8;
    popover.style.minWidth=Math.ceil(rect.width)+'px';
    popover.style.maxWidth=`calc(100vw - ${edge*2}px)`;
    const width=popover.offsetWidth,height=popover.offsetHeight;
    const left=Math.max(edge,Math.min(rect.left,window.innerWidth-width-edge));
    const below=rect.bottom+gap,above=rect.top-height-gap;
    const top=below+height<=window.innerHeight-edge||above<edge?below:above;
    popover.style.left=Math.round(left)+'px';popover.style.top=Math.round(top)+'px';
  }
  function openStatusDropdown(root,focusWhere='selected'){
    if(statusDropdownOpen===root){closeStatusDropdown(true);return;}
    closeStatusDropdown(false);
    const trigger=root.querySelector('[data-status-toggle]'),popover=root.querySelector('[data-status-popover]');
    if(!trigger||!popover||trigger.disabled)return;
    statusDropdownOpen=root;root.classList.add('open');popover.hidden=false;trigger.setAttribute('aria-expanded','true');
    positionStatusPopover(root);
    const enabled=[...popover.querySelectorAll('.status-option:not(:disabled),.status-details:not(:disabled)')];
    const selected=popover.querySelector('.status-option[aria-selected="true"]:not(:disabled)');
    const target=focusWhere==='last'?enabled.at(-1):focusWhere==='first'?enabled[0]:selected||enabled[0];
    target?.focus();
  }
  async function runStatusChoice(control,valor){
    const root=control.closest('[data-status-dropdown]'),trigger=root?.querySelector('[data-status-toggle]');
    if(!root||!trigger)return;
    const {group,id}=root.dataset,proposalId=selected,scrollY=window.scrollY;
    D.assert(!isReadOnly(),'Consulta pública: avaliação indisponível.');
    closeStatusDropdown(false);
    trigger.disabled=true;root.classList.add('disabled');trigger.setAttribute('aria-busy','true');
    try{await selecionarAnalise(group,id,valor);}
    finally{if(trigger.isConnected){trigger.disabled=false;root.classList.remove('disabled');trigger.removeAttribute('aria-busy');}if(selected===proposalId && !$('#modal').open){const equivalent=[...document.querySelectorAll('[data-status-dropdown]')].find(el=>el.dataset.group===group && el.dataset.id===id)?.querySelector('[data-status-toggle]');equivalent?.focus({preventScroll:true});window.scrollTo({top:scrollY});}}
  }
  /* Textos oficiais na própria lista, sempre completos e visíveis dentro do
     painel. Cada item mostra só o que é dele — nenhum item aglutina campos de
     outro. O nome do campo não se repete no texto; o rótulo só aparece quando
     o item reúne mais de um valor, para distinguir um do outro. */
  function blocoOficial(rotulo,texto,contexto){
    const titulo=rotulo?`<strong class="oficial-label">${textoHtml(rotulo,contexto+': rótulo')}</strong>`:'';
    return `<div class="oficial">${titulo}<div class="texto-oficial">${textoHtml(texto,contexto+': texto')}</div></div>`;
  }
  /* Dado registrado que sustenta cada item institucional de mérito. A linha mostra
     o que está gravado no formulário institucional; o que ainda não foi registrado
     simplesmente não aparece — nada de “Não informada” preenchendo a linha. */
  const OUVIDORIA_LABEL={na:'',instituida:'Instituída',pendente:'Pendente de instituição'};
  const FALABR_LABEL={na:'',aderido:'Já aderido',previsto:'Prevista no Plano de Trabalho',nao_previsto:'Não prevista no Plano de Trabalho'};
  function dadosDoItem(p,id){
    const o=p.ouvidoria;
    switch(id){
      case 'ouvidoriaInstituida':return [['Situação registrada',OUVIDORIA_LABEL[o.status]]];
      case 'falaBRAdesao':return [['Situação registrada',FALABR_LABEL[p.falaBR]]];
      default:return [];
    }
  }
  function textosInlineHtml(p,id){
    /* Cada valor da linha entra como um bloco; o rótulo fica guardado para ser
       usado só quando houver mais de um valor no mesmo item. */
    const valores=[];
    if(id==='objeto'){
      const objeto=extracted(p.imported.objeto,'');
      if(objeto)valores.push({rotulo:'',texto:objeto});
    }
    const t=p.textos;
    if(t)for(const c of TEXTOS_DO_ITEM[id] || []){
      const texto=String(t[c]||'').trim();
      if(texto)valores.push({rotulo:D.CAMPOS_TEXTOS[c],texto});
    }
    for(const [rotulo,valor] of dadosDoItem(p,id)) if(valor)valores.push({rotulo,texto:valor});
    const comRotulo=valores.length>1;
    return valores.map(v=>blocoOficial(comRotulo?v.rotulo:'',v.texto,'Item de mérito')).join('');
  }
  function fmtQty(value){
    /* Quantidade decimal textual com ponto: "1234.5" -> "1.234,5". */
    const s=String(value ?? '').trim();
    if(!/^\d+(?:\.\d{1,6})?$/.test(s))return s;
    const [a,b='']=s.split('.');
    return a.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(b?','+b:'');
  }
  function pctBR(value){
    return (value*100).toFixed(1).replace('.',',')+'%';
  }
  function padItemKey(item,index){return item.id?`id:${item.id}`:`row:${index}`;}
  function renderReviews(p,g,opts={}){
    const pad=g==='pad',merito=g==='merito',f=D.finance(p),ps=pad?D.padSituacao(p,state.sync):null;
    if(pad && padSearchOwner!==p.id){padSearch='';padItemSearch='';padSearchOwner=p.id;padSelectedItems.clear();padSelectedStatuses.clear();padBatchItems.clear();padBatchAction='';padSelectorOpen=false;padStatusOpen=false;}
    const padItems=pad?(p.imported.pad || []):[];
    const padKeys=new Set(padItems.map(padItemKey));
    if(pad)for(const key of padSelectedItems)if(!padKeys.has(key))padSelectedItems.delete(key);
    if(pad)for(const id of padBatchItems)if(!padItems.some(item=>item.id===id))padBatchItems.delete(id);
    const selectorScroll=pad?($('#pad-item-options')?.scrollTop || 0):0;
    const busca=padSearch.trim().toLocaleLowerCase('pt-BR');
    const filtroPadAtivo=Boolean(busca || padSelectedItems.size || padSelectedStatuses.size);
    const linhasPad=padItems.filter((item,index)=>(!padSelectedItems.size || padSelectedItems.has(padItemKey(item,index))) && (!busca || `${item.descricao}`.toLocaleLowerCase('pt-BR').includes(busca)) && (!padSelectedStatuses.size || padSelectedStatuses.has(D.reviewOf(p,'pad',item.id).status)));
    const padStatusOptions=[{valor:'na',rotulo:'Analisar'},...OPCOES_PAD,{valor:'reanalise',rotulo:D.STATUSES.reanalise}];
    const batchVisible=linhasPad.filter(item=>padBatchItems.has(item.id)).length;
    const batchHidden=padBatchItems.size-batchVisible;
    const batchEnabled=pad && !isReadOnly() && padItems.length>0;
    const batchBar=batchEnabled?`<div class="pad-batch-bar" aria-label="Ação conjunta no PAD"><p id="pad-batch-count" role="status" aria-live="polite">${padBatchItems.size} ${padBatchItems.size===1?'item selecionado':'itens selecionados'}${batchHidden?` · ${batchHidden} fora dos filtros atuais`:''}.</p><div class="actions"><button id="pad-batch-clear" type="button" class="quiet" ${padBatchItems.size?'':'disabled'}>Limpar seleção</button><select id="pad-batch-action" aria-label="Ação para os itens selecionados">${options({'':'Escolha a ação',na:'Analisar',...Object.fromEntries(OPCOES_PAD.map(o=>[o.valor,o.rotulo]))},padBatchAction)}</select><button id="pad-batch-apply" type="button" class="primary" ${padBatchItems.size&&padBatchAction?'':'disabled'}>Aplicar</button></div></div>`:'';
    const somaVisivel=linhasPad.reduce((a,x)=>a+x.total,0);
    const padReview=D.groupProgress(p,'pad');
    const diffCents=Number.isSafeInteger(f.sum) && Number.isSafeInteger(p.imported.global)?f.sum-p.imported.global:null;
    const cobertura=(Number.isSafeInteger(f.sum) && Number.isSafeInteger(p.imported.global) && p.imported.global>0)?Math.min(1,f.sum/p.imported.global):null;
    const semItens=pad
      ? `<tr><td colspan="6" class="empty">${filtroPadAtivo?'Nenhum item corresponde aos filtros. Limpe a busca ou use “Exibir todos”.':ps.key==='incompleto'?'Importação incompleta: nenhum PAD íntegro disponível para conferir. Consulte a candidata e as rejeições acima.':`Nenhum item do PAD para conferir nesta proposta${ps.key==='nao-carregado'?' — o arquivo não foi carregado nesta base.':' — o plano de aplicação detalhado ainda não consta dos dados abertos do Transferegov.'}`}</td></tr>`
      : `<tr><td colspan="${merito?3:4}" class="empty">Nenhum item nesta lista para esta proposta.</td></tr>`;
    const cartoesPad=pad?`<div class="section-body pad-cards">
        <div class="pad-totals">
          <div class="pad-total"><span class="pad-total-label">Soma do PAD</span><strong>${D.fmtMoney(f.sum)}</strong><span class="pad-total-sub">${padReview.done}/${padReview.total} revisados · ${f.errors.length} divergência(s) · ${padItems.length} ${padItems.length===1?'item previsto':'itens previstos'}</span></div>
          <div class="pad-total"><span class="pad-total-label">Valor global</span><strong>${D.fmtMoney(p.imported.global)}</strong><span class="pad-total-sub">extração oficial</span></div>
          <div class="pad-total"><span class="pad-total-label">Diferença</span><strong class="${diffCents===null?'':diffCents===0?'pad-diff-ok':'pad-diff-bad'}">${diffCents===null?'Não calculável':(diffCents===0?'R$ 0,00':D.fmtMoney(diffCents))}</strong><span class="pad-total-sub">${diffCents===null?'valores ausentes na extração':diffCents===0?'soma confere com o global':'soma diverge do global'}</span></div>
        </div>
        ${cobertura===null||cobertura>=1?'':`<div class="pad-cover" role="img" aria-label="Cobertura do PAD sobre o valor global: ${pctBR(cobertura)}"><div class="pad-cover-bar" style="width:${(cobertura*100).toFixed(1)}%"></div></div>`}
        ${ps.key==='com-itens'?'':`<div class="info warning"><strong>${textoHtml(ps.titulo,'PAD: situação')}.</strong> ${textoHtml(ps.detalhe,'PAD: motivo')}</div>`}
        ${p.padImport?.status==='partial'?`<details class="info warning"><summary>Inspecionar extração candidata e rejeições (sem aplicação ao PAD oficial)</summary><p>Fonte: ${e(p.padImport.source)} · ${e(D.fmtDate(p.padImport.at))} · ${p.padImport.received} recebida(s), ${p.padImport.accepted} aceita(s), ${p.padImport.rejected} rejeição(ões).</p><ul>${p.padImport.reasons.map(r=>`<li>Linha ${r.line}${r.itemId?' · item '+e(r.itemId):''}: ${e(r.reason)}</li>`).join('')}</ul><p>Candidata parcial, conservada somente para inspeção:</p><ul>${(p.padImport.candidate||[]).map(i=>`<li>${e(i.descricao)} · quantidade ${e(fmtQty(i.quantidade))} · total ${e(D.fmtMoney(i.total))}</li>`).join('')}</ul></details>`:''}
        ${padItems.length?`<div class="filters pad-filter">
          <label class="search">Buscar item do PAD<input id="pad-search" type="search" value="${e(padSearch)}" placeholder="Descrição do item" autocomplete="off"></label>
          <div class="pad-select-control"><span id="pad-select-label" class="pad-filter-label">Selecionar itens do PAD</span>
            <details id="pad-item-selector" class="pad-selector" ${padSelectorOpen?'open':''}>
              <summary aria-labelledby="pad-select-label pad-selection-count"><span id="pad-selection-count">${padSelectedItems.size?`${padSelectedItems.size} ${padSelectedItems.size===1?'item selecionado':'itens selecionados'}`:'Todos os itens'}</span></summary>
              <div class="pad-selector-panel"><p>Busque e marque um ou mais itens. Limpar esta busca mantém a seleção. Sem seleção, todos são exibidos.</p>
                <div class="pad-option-search"><label for="pad-option-search">Buscar na lista de itens<input id="pad-option-search" type="search" value="${e(padItemSearch)}" placeholder="Digite para localizar um item" autocomplete="off" aria-controls="pad-item-options" aria-describedby="pad-option-count"></label><button id="pad-option-clear" type="button" class="quiet">Limpar busca</button></div>
                <p id="pad-option-count" role="status" aria-live="polite"></p>
                <fieldset id="pad-item-options" class="pad-item-options"><legend class="sr-only">Itens do plano de aplicação detalhado</legend>${padItems.map((item,index)=>`<label class="pad-item-option"><input id="pad-pick-${index}" type="checkbox" data-pad-select="${e(padItemKey(item,index))}" ${padSelectedItems.has(padItemKey(item,index))?'checked':''}><span><span class="pad-option-number">${index+1}.</span> ${e(item.descricao)}<small>${D.fmtMoney(item.total)}</small></span></label>`).join('')}</fieldset>
              </div>
            </details>
          </div>
          <div class="pad-select-control pad-status-control"><span id="pad-status-label" class="pad-filter-label">Filtrar por ação</span>
            <details id="pad-status-selector" class="pad-selector" ${padStatusOpen?'open':''}>
              <summary aria-labelledby="pad-status-label pad-status-count"><span id="pad-status-count">${padSelectedStatuses.size?`${padSelectedStatuses.size} ${padSelectedStatuses.size===1?'ação selecionada':'ações selecionadas'}`:'Todas as ações'}</span></summary>
              <div class="pad-selector-panel pad-status-panel"><p>Marque uma ou mais ações. Sem seleção, todas são exibidas.</p>
                <fieldset id="pad-status-options" class="pad-item-options"><legend class="sr-only">Resultados da coluna Ação</legend>${padStatusOptions.map(option=>{const count=padItems.filter(item=>D.reviewOf(p,'pad',item.id).status===option.valor).length;return `<label class="pad-item-option"><input id="pad-status-${e(option.valor)}" type="checkbox" data-pad-status="${e(option.valor)}" ${padSelectedStatuses.has(option.valor)?'checked':''}><span>${e(option.rotulo)}<small>${count} ${count===1?'item':'itens'}</small></span></label>`;}).join('')}</fieldset>
              </div>
            </details>
          </div>
          <button id="pad-show-all" type="button" class="quiet" ${filtroPadAtivo?'':'disabled'}>Exibir todos</button>
          <p id="pad-filter-count" class="pad-filter-count" role="status" aria-live="polite">Exibindo ${linhasPad.length} de ${padItems.length} itens${padSelectedItems.size&&busca?' · seleção combinada com a busca':''}.</p>
        </div>`:''}
      </div>`:'';
    const rodapePad=pad&&padItems.length?`<tfoot><tr><td><strong>Total (${filtroPadAtivo?`${linhasPad.length} de ${padItems.length} itens`:padItems.length===1?'1 item':`${padItems.length} itens`})</strong></td><td></td><td></td><td class="number cell-right"><strong>${D.fmtMoney(somaVisivel)}</strong></td><td></td><td></td></tr></tfoot>`:'';
    const titulo=pad?`<a href="${e(consultaPublica(p.id,'DetalharBensProposta'))}" target="_blank" rel="noopener noreferrer" title="Abrir o plano de aplicação detalhado no Transferegov (Acesso Livre)" aria-label="Abrir o plano de aplicação detalhado da proposta ${e(proposalNumber(p.imported.numero))} no Transferegov (Acesso Livre)">${e(tabNames[g])}</a>`:e(tabNames[g]);
    const html=`<section class="section"><div class="section-head"><h2>${titulo}</h2>${(merito && !isReadOnly())?button('Editar informações','institution'):''}</div>
      ${merito&&avisoInstitucional(p)?`<div class="section-body">${avisoInstitucional(p)}</div>`:''}
      ${cartoesPad}
      ${batchBar}
      <div class="table-wrap"><table class="${pad?'pad-table':'review-table'}"><colgroup>${pad?'<col class="c-pad-item"><col class="c-pad-qtd"><col class="c-pad-unit"><col class="c-pad-total"><col class="c-pad-conf"><col class="c-pad-acao">':''}</colgroup><thead><tr><th scope="col">${batchEnabled?'<label class="pad-batch-heading"><input id="pad-batch-header" type="checkbox" aria-label="Selecionar todos os itens exibidos">Item</label>':pad?'Item':'Requisito'}</th>${pad?'<th scope="col" class="cell-right pad-case">Qtd</th><th scope="col" class="cell-right pad-case">Valor unitário</th><th scope="col" class="cell-right pad-case">Valor total</th>':''}<th scope="col" class="${pad?'pad-th-conf':''}">${pad?'Conferência':'Resultado'}</th>${!pad&&!merito?'<th scope="col">Documento</th>':''}<th scope="col" class="cell-center pad-th-action">Ação</th></tr></thead><tbody>${pad
        ? linhasPad.map(item=>{const [id,label]=[item.id,item.descricao];const r=D.reviewOf(p,g,id);const divergente=!D.unitMatchesTotal(item);const parte=f.sum>0?item.total/f.sum:null;return `<tr data-pad-item="${e(id)}" ${batchEnabled && padBatchItems.has(id)?'class="pad-batch-selected"':''}><td class="pad-desc">${batchEnabled?`<div class="pad-batch-row"><input id="pad-batch-${e(id)}" type="checkbox" data-pad-batch="${e(id)}" aria-label="Selecionar ${e(label)} para ação conjunta" ${padBatchItems.has(id)?'checked':''}>${descriptionHtml(p,g,id,label)}</div>`:descriptionHtml(p,g,id,label)}</td><td class="number cell-right">${e(fmtQty(item.quantidade))}</td><td class="number cell-right">${D.fmtMoney(item.unitario)}${divergente?badge('Divergente','bad'):''}</td><td class="number cell-right">${D.fmtMoney(item.total)}${parte===null?'':`<span class="cell-sub pad-share"><span class="pad-share-bar" style="--w:${(parte*100).toFixed(1)}%"></span>${e(pctBR(parte))}</span>`}</td><td class="pad-conf">${reviewBadge(r)}${evidenceNotice(p,g,id)}</td><td class="cell-center pad-actions"><div class="review-actions">${acaoDeAnalise(p,g,id,r)}${!isReadOnly() && D.pending(p).some(pending=>pending.ref===g+':'+id)?button('Criar diligência','diligence',`data-ref="${e(g+':'+id)}"`):''}</div></td></tr>`;}).join('') || semItens
        : D.rows(p,g).map(([id,label])=>{const r=D.reviewOf(p,g,id);const opcao=opcaoAtual(g,id,r.status),custom=merito&&!!OPCOES_DA_ACAO[id];const ausente=id==='ouvidoriaInstituida' && r.status==='no';const resultado=(custom && opcao)?badge(opcao.rotulo,tomDoResultado(opcao.tom)):reviewBadge(r);const titulo=(merito && !isReadOnly())?`<button type="button" class="review-open" data-action="review" data-group="${e(g)}" data-id="${e(id)}" title="Abrir o detalhe do item: observação, documento, diligência e histórico">${e(label)}</button>`:e(label);return `<tr><td class="review-title">${titulo}${textosInlineHtml(p,id)}${r.note?`<div class="review-note">${e(r.note)}</div>`:''}${ausente?`<div class="info warning review-alert">A instituição da Ouvidoria Específica de Serviços Penais será cláusula suspensiva do Convênio.</div>`:''}</td><td>${resultado}${evidenceNotice(p,g,id)}</td>${merito?'':`<td>${link(r)}</td>`}<td class="${merito?'cell-center':''}"><div class="review-actions">${acaoDeAnalise(p,g,id,r)}${!isReadOnly() && D.pending(p).some(pending=>pending.ref===g+':'+id)?button('Criar diligência','diligence',`data-ref="${e(g+':'+id)}"`):''}</div></td></tr>`;}).join('') || semItens}</tbody>${rodapePad}</table></div></section>`;
    if(opts.secao)return html;
    $('#tab-content').innerHTML=html;
    if(pad){
      if(batchEnabled){
        const refreshBatch=focusId=>{renderReviews(p,g);document.getElementById(focusId)?.focus({preventScroll:true});};
        const header=$('#pad-batch-header');
        header.checked=linhasPad.length>0 && batchVisible===linhasPad.length;
        header.indeterminate=batchVisible>0 && batchVisible<linhasPad.length;
        header.disabled=!linhasPad.length;
        header.addEventListener('change',()=>{for(const item of linhasPad){if(header.checked)padBatchItems.add(item.id);else padBatchItems.delete(item.id);}refreshBatch(header.id);});
        $('#pad-batch-clear').addEventListener('click',()=>{padBatchItems.clear();refreshBatch('pad-batch-header');});
        $('#pad-batch-action').addEventListener('change',ev=>{padBatchAction=ev.target.value;$('#pad-batch-apply').disabled=!padBatchItems.size || !padBatchAction;});
        $('#pad-batch-apply').addEventListener('click',applyPadBatch);
        document.querySelectorAll('[data-pad-batch]').forEach(input=>input.addEventListener('change',()=>{if(input.checked)padBatchItems.add(input.dataset.padBatch);else padBatchItems.delete(input.dataset.padBatch);refreshBatch(input.id);}));
      }
      const statusSelector=$('#pad-status-selector');
      if(statusSelector){
        statusSelector.addEventListener('toggle',()=>{padStatusOpen=statusSelector.open;});
        statusSelector.addEventListener('keydown',ev=>{if(ev.key==='Escape' && statusSelector.open){ev.preventDefault();padStatusOpen=false;statusSelector.open=false;statusSelector.querySelector('summary').focus();}});
        $('#pad-status-options').addEventListener('change',ev=>{
          const input=ev.target.closest('[data-pad-status]');if(!input)return;
          if(input.checked)padSelectedStatuses.add(input.dataset.padStatus);else padSelectedStatuses.delete(input.dataset.padStatus);
          padStatusOpen=true;renderReviews(p,g);document.getElementById(input.id)?.focus({preventScroll:true});
        });
      }
      const selector=$('#pad-item-selector');
      if(selector){
        selector.addEventListener('toggle',()=>{padSelectorOpen=selector.open;if(selector.open && document.activeElement===selector.querySelector('summary'))$('#pad-option-search')?.focus();});
        selector.addEventListener('keydown',ev=>{if(ev.key==='Escape' && selector.open){ev.preventDefault();padSelectorOpen=false;selector.open=false;selector.querySelector('summary').focus();}});
      }
      const selectionList=$('#pad-item-options');
      if(selectionList){
        const optionSearch=$('#pad-option-search'),clearSearch=$('#pad-option-clear');
        const normalize=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
        const filterOptions=()=>{
          const query=normalize(padItemSearch.trim());let count=0;
          selectionList.querySelectorAll('.pad-item-option').forEach((option,index)=>{option.hidden=!normalize(padItems[index].descricao).includes(query);if(!option.hidden)count++;});
          $('#pad-option-count').textContent=count?`${count} ${count===1?'item encontrado':'itens encontrados'} de ${padItems.length}.`:'Nenhum item encontrado. Tente outro texto.';
          clearSearch.disabled=!padItemSearch;
        };
        const clearOptions=()=>{padItemSearch='';optionSearch.value='';filterOptions();selectionList.scrollTop=0;optionSearch.focus();};
        optionSearch.addEventListener('input',()=>{padItemSearch=optionSearch.value;filterOptions();selectionList.scrollTop=0;});
        optionSearch.addEventListener('keydown',ev=>{if(ev.key==='Escape' && padItemSearch){ev.preventDefault();ev.stopPropagation();clearOptions();}});
        clearSearch.addEventListener('click',clearOptions);
        filterOptions();
        selectionList.scrollTop=selectorScroll;
        selectionList.addEventListener('change',ev=>{
          const input=ev.target.closest('[data-pad-select]');if(!input)return;
          if(input.checked)padSelectedItems.add(input.dataset.padSelect);else padSelectedItems.delete(input.dataset.padSelect);
          const focusId=input.id;padSelectorOpen=true;renderReviews(p,g);document.getElementById(focusId)?.focus({preventScroll:true});
        });
      }
      const showAll=$('#pad-show-all');
      if(showAll)showAll.addEventListener('click',()=>{padSearch='';padItemSearch='';padSelectedItems.clear();padSelectedStatuses.clear();padSelectorOpen=false;padStatusOpen=false;renderReviews(p,g);$('#pad-search')?.focus();});
      const buscaEl=$('#pad-search');
      if(buscaEl){
        buscaEl.addEventListener('input',ev=>{padSearch=ev.target.value;renderReviews(p,g);const again=$('#pad-search');if(again){again.focus();again.setSelectionRange(again.value.length,again.value.length);}});
        buscaEl.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&ev.target.value){ev.preventDefault();padSearch='';renderReviews(p,g);const again=$('#pad-search');if(again)again.focus();}});
      }
    }
  }
  function applyPadBatch(){
    if(isReadOnly() || busy || !padBatchItems.size || !padBatchAction)return;
    const p=current(),proposalId=p.id,items=p.imported.pad.filter(item=>padBatchItems.has(item.id));
    D.assert(items.length,'Selecione pelo menos um item do PAD.');
    const ids=items.map(item=>item.id),status=padBatchAction,action=status==='na'?'Analisar':OPCOES_PAD.find(o=>o.valor===status)?.rotulo;
    D.assert(action,'Escolha uma ação válida.');
    const noteNeeded=['obs','no','diligencia'].includes(status),integrated=status==='diligencia';
    const active=id=>p.diligences.filter(d=>d.ref==='pad:'+id && d.status!=='saneada');
    const multiple=integrated?items.filter(item=>active(item.id).length>1):[];
    modal('Aplicar ação aos itens',`<p><strong>${e(action)}</strong> para <strong>${items.length} ${items.length===1?'item selecionado':'itens selecionados'}</strong>.</p><details><summary>Ver itens selecionados</summary><ul class="pad-batch-preview">${items.map(item=>`<li>${e(item.descricao)}</li>`).join('')}</ul></details><form class="form-stack">${noteNeeded?`<label>${integrated?'Providência solicitada / justificativa':'Observação / justificativa'}<textarea name="note" maxlength="10000" ${integrated || items.some(item=>!D.reviewOf(p,'pad',item.id).note.trim())?'required':''}></textarea></label><p class="source">O texto preenchido será aplicado a todos os itens selecionados.${integrated?'':' Deixe vazio para manter as observações existentes.'}</p>`:''}${integrated?`<fieldset class="form-stack"><legend>Diligência</legend><label>Data da comunicação (opcional)<input name="communication" type="date"></label><label>Observação da diligência (opcional)<textarea name="d_note" maxlength="10000"></textarea></label>${multiple.map(item=>`<label>Diligência a atualizar: ${e(item.descricao)}<select name="d_${e(item.id)}" required>${options({'':'Selecione',...Object.fromEntries(active(item.id).map(d=>[d.id,d.request]))},'')}</select></label>`).join('')}<p class="source">Cada item terá sua própria diligência. Se já existir uma aberta, ela será atualizada.</p></fieldset>`:''}${formEnd('Aplicar')}</form>`);
    bindForm(async fd=>{
      D.assert(current()?.id===proposalId,'A proposta mudou. Abra novamente a ação conjunta.');
      const next=D.clone(state),proposal=next.proposals.find(item=>item.id===proposalId),name=actor();
      const commonNote=String(fd.get('note') || '').trim();
      for(const id of ids){
        D.assert(proposal.imported.pad.some(item=>item.id===id),'Um item selecionado não consta mais do PAD.');
        const review=D.reviewOf(proposal,'pad',id),note=commonNote || review.note;
        if(review.status!==status || review.note!==note || !D.reviewCurrent(proposal,'pad',id))D.setReview(proposal,'pad',id,{...review,status,note},name);
        if(integrated){
          const linked=proposal.diligences.filter(d=>d.ref==='pad:'+id && d.status!=='saneada');
          const old=linked.length===1?linked[0]:linked.find(d=>d.id===fd.get('d_'+id));
          D.assert(linked.length<=1 || old,'Selecione a diligência de cada item com mais de uma aberta.');
          D.saveDiligence(proposal,{...old,id:old?.id || '',ref:'pad:'+id,category:'PLANO DE APLICAÇÃO DETALHADO',request:note,communication:fd.get('communication') || old?.communication || '',science:old?.science || '',response:old?.response || '',status:old?.status || 'aberta',note:String(fd.get('d_note') || '').trim() || old?.note || ''},name);
        }
      }
      await persist(next);padBatchItems.clear();padBatchAction='';render();saved(`${action} aplicado a ${items.length} ${items.length===1?'item':'itens'}.`);
    });
  }
  function viewReview(p,group,id,r,label){
    const field=(name,title,value,multiline=false)=>`<label>${e(title)}${multiline?`<textarea name="${e(name)}" rows="6" readonly>${e(value || '')}</textarea>`:`<input name="${e(name)}" value="${e(value || '')}" readonly>`}</label>`;
    const resultado=opcaoAtual(group,id,r.status)?.rotulo || D.STATUSES[r.status];
    const diligences=p.diligences.filter(d=>d.ref===D.canonicalRef(group,id));
    const details=diligences.map(d=>'<fieldset><legend>Diligência vinculada</legend>'+businessDiligenceHtml(p,d)+'</fieldset>').join('');
    modal('Detalhes da análise',`<p><strong>${textoHtml(D.tabLabel(group,id),'Consulta: aba')}</strong></p><p>${textoHtml(label,'Consulta: item')}</p><div class="form-stack">${field('status','Resultado',resultado)}${field('note',r.status==='diligencia'?'Providência solicitada / justificativa':'Observação / justificativa',r.note,true)}${r.document?field('document','Nome do documento',r.document):''}${r.url?`<p>${link(r)}</p>`:''}${evidenceNotice(p,group,id)}${attachmentsHtml(r)}${details}</div><div class="dialog-actions">${button('Fechar','close')}</div>`);
  }
  function editReview(group,id,initialStatus=''){
    const p=current(),r=D.reviewOf(p,group,id),label=D.rows(p,group).find(x=>x[0]===id)[1];
    if(isReadOnly()){viewReview(p,group,id,r,label);return;}
    const meta=D.metaRequisito(group,id);
    const states={...D.STATUSES};delete states.reanalise;
    for(const opcao of opcoesDoItem(group,id))states[opcao.valor]=opcao.rotulo;
    /* No PAD o formulário não coleta documento: os valores já gravados são
       preservados no reenvio, e link sem nome continua sendo recusado pelo domínio. */
    const docFields=group==='pad'?'':`<label>Nome do documento<input name="document" value="${e(r.document)}" maxlength="250"></label><label>Link do documento (opcional)<input type="url" name="url" value="${e(r.url)}"></label>`;
    const docData=group==='pad'?{document:r.document,url:r.url}:null;
    const contexto=`${textoHtml(D.tabLabel(group,id),'Analisar: aba')} — ${textoHtml(label,'Analisar: requisito')}`;
    /* No item do objeto, a conferência parte do objeto e da vigência da extração
       oficial; nos demais itens da proposta, do texto oficial correspondente
       (`p.textos`, obtido sob demanda do arquivo público). Item sem texto no banco
       não inventa conteúdo: aponta a consulta pública da proposta. */
    const objetoVigencia=group==='merito' && id==='objeto'?`<dl class="data-grid"><div class="wide"><dt>Objeto na extração oficial</dt><dd>${textoHtml(extracted(p.imported.objeto),'Analisar: objeto importado')}</dd></div><div><dt>Início da vigência</dt><dd>${textoHtml(D.fmtDate(p.imported.vigenciaInicio),'Analisar: início da vigência')}</dd></div><div><dt>Fim da vigência</dt><dd>${textoHtml(D.fmtDate(p.imported.vigenciaFim),'Analisar: fim da vigência')}</dd></div></dl>`:'';
    const origem=objetoVigencia+textosOficiaisHtml(p,id);
    const lista=(meta?`<dl class="data-grid"><div><dt>Fundamentação</dt><dd>${textoHtml(meta.fundamentacao,'Analisar: fundamentação')}</dd></div><div><dt>Comprovação</dt><dd>${textoHtml(meta.comprovacao,'Analisar: comprovação')}</dd></div></dl>`:'')+origem;
    const ref=D.referenceRows(p).find(x=>x.id===id && x.review===r)?.ref;
    D.assert(ref,'Vínculo do requisito não encontrado.');
    const active=p.diligences.filter(d=>d.ref===ref && d.status!=='saneada');
    let old=active.length===1?active[0]:null;
    const initial=old || {category:group==='pad'?'PLANO DE APLICAÇÃO DETALHADO':group==='habilitacao'?'HABILITAÇÃO':'OUTRO',communication:'',science:'',response:'',status:'aberta',note:'',due:'',confirmed:false,calendarNote:''};
    const statusInicial=initialStatus || (r.status==='reanalise'?'na':r.status);
    modal('Analisar requisito',`<p><strong>${contexto}</strong></p><p>${textoHtml(label,'Analisar: requisito')}</p>${meta&&meta.sub?`<p class="source">${textoHtml(meta.sub,'Analisar: subtexto da Lista de Conferência')}</p>`:''}${lista}<form class="form-stack"><label>Resultado<select name="status">${options(states,statusInicial)}</select></label><label><span id="review-note-label">Observação / justificativa</span><textarea name="note" maxlength="10000">${e(r.note)}</textarea></label>${docFields}<fieldset id="review-diligence" class="form-stack" hidden disabled><legend>Diligência vinculada ao item</legend>${active.length>1?`<label>Diligência a atualizar<select name="d_id" required>${options({'':'Selecione uma diligência',...Object.fromEntries(active.map(d=>[d.id,d.request]))},'')}</select></label>`:''}<p id="review-diligence-info" class="source"></p>${reviewDiligenceFields(initial)}</fieldset>${formEnd()}</form>`);
    const form=$('#modal-content form'),fields=$('#review-diligence'),note=form.elements.note;
    let analysisNote=r.note,request=old?.request || r.note;
    const preview=()=>{form.elements.d_due.value=D.deadline(form.elements.d_communication.value).adjusted;};
    const toggle=()=>{
      const enabled=form.elements.status.value==='diligencia';
      if(enabled){request=note.value;}else{analysisNote=note.value;}
      if(!note.value.trim())note.value=enabled?(request || analysisNote):(analysisNote || request);
      fields.hidden=!enabled;fields.disabled=!enabled;
      $('#review-note-label').textContent=enabled?'Providência solicitada / justificativa':'Observação / justificativa';
      $('#review-diligence-info').textContent=old?'Ao salvar, esta diligência será atualizada, sem criar outra.':active.length>1?'Escolha a diligência ativa a atualizar. Nenhuma nova será criada.':'Ao salvar, a análise e a nova diligência serão registradas juntas. O texto acima será a providência solicitada.';
    };
    form.elements.status.addEventListener('change',toggle);
    for(const event of ['input','change'])form.elements.d_communication.addEventListener(event,()=>{try{preview();}catch(err){formError(err);}});
    form.elements.d_id?.addEventListener('change',()=>{
      old=active.find(d=>d.id===form.elements.d_id.value) || null;
      const values=old || initial;
      for(const key of ['category','communication','response','status','note'])form.elements['d_'+key].value=values[key];
      if(old){note.value=old.request;request=old.request;}
      preview();toggle();
    });
    preview();toggle();
    bindForm(async fd=>{
      const name=actor(),data={status:fd.get('status'),note:fd.get('note'),document:fd.get('document'),url:fd.get('url'),...(docData || {})};
      const integrated=data.status==='diligencia';let recorded;
      if(integrated)D.assert(active.length<=1 || old,'Selecione a diligência a atualizar.');
      const diligence=integrated?{id:old?.id || '',ref,request:data.note.trim(),science:old?.science || '',...Object.fromEntries(['category','communication','response','status','note'].map(k=>[k,fd.get('d_'+k)]))}:null;
      await change(p=>{D.setReview(p,group,id,data,name);if(diligence)recorded=D.saveDiligence(p,diligence,name);});
      modalDirty=false;
      if(recorded && D.mayResolveReference(current(),recorded) && (!old || old.status!=='saneada')){
        modal('Diligência saneada',`<p>A pendência foi saneada. Deseja alterar o requisito vinculado para atendido?</p><div class="dialog-actions">${button('Não, manter status','close')}${button('Sim, atualizar','resolve-ref',`data-ref="${e(recorded.ref)}"`,'primary')}</div>`);
      }else saved(integrated?'Análise e diligência salvas.':'Análise salva.');
    });
  }
  function reviewDiligenceFields(d){
    return `<label>Categoria<select name="d_category">${options(Object.fromEntries(D.CATEGORIES.map(x=>[x,x])),d.category)}</select></label><label>Data da comunicação<input type="date" name="d_communication" value="${e(d.communication)}"></label><label>Vencimento<input type="date" name="d_due" readonly value="${e(D.deadline(d.communication).adjusted)}"></label><div class="forms-grid"><label>Data da resposta<input type="date" name="d_response" value="${e(d.response)}"></label><label>Situação<select name="d_status">${options(D.DSTATUS,d.status)}</select></label></div><label>Observação / conclusão<textarea name="d_note">${e(d.note)}</textarea></label>`;
  }
  function editInstitution(){const p=current(),o=p.ouvidoria;modal('Ouvidoria e Fala.BR',`<form class="form-stack"><label>Instituição da Ouvidoria<select name="status">${options({na:'Não informada',instituida:'Instituída',pendente:'Pendente de instituição'},o.status)}</select></label><label class="checkline"><input name="clause" type="checkbox" ${o.clause?'checked':''}>Confirmei a aplicabilidade da cláusula suspensiva no instrumento.</label><label>Data da assinatura<input name="signature" type="date" value="${e(o.signature)}"></label><label>Link do ato normativo (opcional)<input name="url" type="url" value="${e(o.url)}"></label><label>Adesão ao Fala.BR<select name="falaBR">${options({na:'Não informada',aderido:'Já aderido',previsto:'Prevista no Plano de Trabalho',nao_previsto:'Não prevista no Plano de Trabalho'},p.falaBR)}</select></label><label>Observação<textarea name="note">${e(o.note)}</textarea></label>${formEnd()}</form>`);bindForm(async fd=>{const name=actor(),data=Object.fromEntries(fd);D.dateISO(data.signature);D.safeLink(data.url);await change(p=>{D.setInstitution(p,{ouvidoria:{status:data.status,signature:data.signature,url:data.url,note:data.note,clause:fd.has('clause') && data.status==='pendente'},falaBR:data.falaBR},name);});saved('Informações institucionais salvas.');});}
  function businessDiligenceHtml(p,d){
    const ref=D.referenceRows(p).find(r=>r.ref===d.ref);
    const fields=[['Categoria',d.category],['Requisito vinculado',ref?ref.tab+' · '+ref.label:d.ref||'Sem vínculo'],['Providência solicitada',d.request],['Comunicação',D.fmtDate(d.communication)],['Ciência histórica',D.fmtDate(d.science)],['Vencimento',D.fmtDate(d.due)],['Resposta',D.fmtDate(d.response)],['Situação',D.diligenceLabel(d)],['Observação / conclusão',d.note],['Conferência histórica de expediente',d.calendarNote],['Prazo automático',d.automaticDeadline?'Sim':'Não'],['Conferência histórica registrada',d.confirmed?'Sim':'Não']];
    return '<dl class="data-grid">'+fields.map(([label,value])=>`<div class="wide"><dt>${e(label)}</dt><dd class="business-text">${e(value||'Não informado')}</dd></div>`).join('')+'</dl>';
  }
  function viewDiligence(id){const p=current(),d=p.diligences.find(d=>d.id===id);D.assert(d,'Diligência não encontrada.');modal('Detalhes da diligência',businessDiligenceHtml(p,d)+`<div class="dialog-actions">${button('Fechar','close')}</div>`);}
  function attachmentsHtml(r){return (r.attachments||[]).length?'<ul>'+r.attachments.map(a=>`<li><a href="${e(a.data)}" download="${e(a.name)}">${e(a.name)}</a> · ${e(a.note||'')}</li>`).join('')+'</ul>':'';}
  function evidenceNotice(p,g,id){const r=D.reviewOf(p,g,id);if(r.status==='na' || D.reviewCurrent(p,g,id))return '';return `<p class="source warn-text">${e(r.reanalysis?.reason||'Avaliação sem referência atual verificável; requer confirmação humana.')}${r.reanalysis?.fields?' Campos: '+e(r.reanalysis.fields.join(', ')):''}</p>`;}
  function descriptionHtml(p,g,id,label){const key=p.id+':'+D.canonicalRef(g,id),preview=label.length>180?label.slice(0,180)+'…':label;return `<details class="item-description" data-description="${e(key)}" ${expandedDescriptions.has(key)?'open':''}><summary><span class="pad-desc-text">${e(preview)}</span><span class="description-action">Ver conteúdo completo / recolher</span></summary><div class="business-text">${e(label)}</div></details>`;}
  function renderDiligences(p){
    const unlinked=D.pending(p);
    const unlinkedItems=unlinked.map(r=>`<div class="info warning">${e(r.tab+' → '+r.label)} ${isReadOnly()?'':button('Criar diligência','diligence',`data-ref="${e(r.ref)}"`)}</div>`).join('') || '<p class="muted">Nenhuma marcação sem registro ativo.</p>';
    const novaBtn=isReadOnly()?'':button('Nova diligência','diligence','','primary');
    $('#tab-content').innerHTML=`<section class="section"><div class="section-head"><h2>Pendências sem diligência cadastrada: ${unlinked.length}</h2></div><div class="section-body">${unlinkedItems}</div></section><section class="section"><div class="section-head"><h2>Diligências registradas</h2>${novaBtn}</div><div class="table-wrap"><table><thead><tr><th>Categoria / providência</th><th>Vencimento</th><th>Situação</th><th>Ação</th></tr></thead><tbody>${p.diligences.map((d,n)=>`<tr><td><strong>${n+1}. ${e(d.category)}</strong><div class="review-note">${e(d.request)}</div><span class="source">${e(D.referenceRows(p).find(r=>r.ref===d.ref)?.label || d.ref || 'Sem vínculo')}</span></td><td>${D.fmtDate(d.due)}</td><td>${badge(D.diligenceLabel(d),d.status==='saneada'?'good':'warn')}</td><td>${button('Ver detalhes','view-diligence',`data-id="${e(d.id)}"`)}${isReadOnly()?'':button('Editar','diligence',`data-id="${e(d.id)}"`)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Nenhuma diligência cadastrada.</td></tr>'}</tbody></table></div></section>`;
  }
  function editDiligence(id,ref=''){
    const p=current(),old=p.diligences.find(d=>d.id===id);const d=old || {ref,category:ref.startsWith('pad:')?'PLANO DE APLICAÇÃO DETALHADO':ref.startsWith('habilitacao:')?'HABILITAÇÃO':'OUTRO',request:'',communication:'',science:'',response:'',status:'aberta',note:'',due:'',confirmed:false,calendarNote:''};
    modal(old?'Atualizar diligência':'Criar diligência',`<form class="form-stack"><label>Categoria<select name="category">${options(Object.fromEntries(D.CATEGORIES.map(x=>[x,x])),d.category)}</select></label><label>Item, requisito ou documento relacionado<select name="ref">${options({'':'Sem vínculo',...Object.fromEntries(D.referenceRows(p).map(r=>[r.ref,`${r.tab} · ${r.label}${r.review.document?' / '+r.review.document:''}`]))},d.ref)}</select></label><label>Providência solicitada<textarea name="request" required>${e(d.request)}</textarea></label><label>Data da comunicação<input type="date" name="communication" value="${d.communication}"></label><label>Vencimento<input type="date" name="due" readonly value="${e(D.deadline(d.communication).adjusted)}"></label><div class="forms-grid"><label>Data da resposta<input type="date" name="response" value="${d.response}"></label><label>Situação<select name="status">${options(D.DSTATUS,d.status)}</select></label></div><label>Observação / conclusão<textarea name="note">${e(d.note)}</textarea></label>${formEnd()}</form>`);
    const preview=()=>{$('[name=due]').value=D.deadline($('[name=communication]').value).adjusted;};preview();
    for(const event of ['input','change'])$('[name=communication]').addEventListener(event,()=>{try{preview();}catch(err){formError(err);}});
    $('[name=category]').addEventListener('change',()=>{const cat=$('[name=category]').value;for(const opt of $('[name=ref]').options){opt.hidden=!!opt.value && ((cat==='PLANO DE APLICAÇÃO DETALHADO' && !opt.value.startsWith('pad:')) || (cat==='ANEXO / DOCUMENTO' && !D.referenceRows(p).some(r=>r.ref===opt.value && r.review.document)));}if($('[name=ref]').selectedOptions[0]?.hidden)$('[name=ref]').value='';});
    bindForm(async fd=>{const name=actor();let recorded;const data={...Object.fromEntries(['ref','category','request','communication','response','status','note'].map(k=>[k,fd.get(k)])),id:old?.id || '',science:old?.science || ''};await change(p=>{recorded=D.saveDiligence(p,data,name);});modalDirty=false;
      if(D.mayResolveReference(current(),recorded) && (!old || old.status!=='saneada')){
        modal('Diligência saneada',`<p>A pendência foi saneada. Deseja alterar o requisito vinculado para atendido?</p><div class="dialog-actions">${button('Não, manter status','close')}${button('Sim, atualizar','resolve-ref',`data-ref="${e(recorded.ref)}"`,'primary')}</div>`);
      }else saved('Diligência salva.');
    });
  }
  function renderHistory(p){$('#tab-content').innerHTML=`<section class="section"><div class="section-head"><h2>Histórico de alterações</h2><small>${p.history.length} registro(s)</small></div><div class="section-body"><ol class="timeline">${p.history.slice().reverse().map(h=>`<li><small>${e(new Date(h.at).toLocaleString('pt-BR'))} · ${e(h.actor)}</small><strong>${e(h.event)}</strong><details><summary>Ver dados anteriores e posteriores</summary><pre>${e(JSON.stringify({antes:h.before,depois:h.after},null,2))}</pre></details></li>`).join('')}</ol></div></section>`;}
  function conclusion(){
    D.assert(!isReadOnly(),'Consulta pública: conclusão indisponível.');
    const p=current();conclusionContext={proposalId:p.id,revision:state.revision,evidence:D.technicalEvidence(p),operationId:D.uid()};
    modal('Conclusão da análise técnica',`<p>Registre o resultado técnico. Os requisitos posteriores de celebração continuam em suas próprias abas.</p><form class="form-stack" id="conclusion-form"><label>Resultado<select name="result">${options({favoravel:'Favorável',desfavoravel:'Desfavorável'},p.conclusion?.result||'favoravel')}</select></label><label>Justificativa<textarea name="note">${e(p.conclusion?.note||'')}</textarea></label><label>Referência das evidências consideradas<textarea name="reference" required>${e(p.conclusion?.reference||'')}</textarea></label><div id="conclusion-blocks" class="info warning"></div><p id="form-error" class="error-message" role="alert" tabindex="-1"></p><div class="dialog-actions">${button('Cancelar','close')}${button('Registrar conclusão técnica','confirm-conclusion','','primary')}</div></form>`);
    const form=$('#conclusion-form');
    const update=()=>{const b=D.conclusionBlocks(current(),form.elements.result.value);$('#conclusion-blocks').textContent=b.length?b.join(' · '):'Controles atuais permitem registrar este resultado.';};
    form.addEventListener('input',()=>modalDirty=true);form.elements.result.addEventListener('change',update);form.addEventListener('submit',ev=>{ev.preventDefault();confirmConclusionNow().catch(formError);});update();
  }
  async function confirmConclusionNow(){
    if(conclusionSubmitting)return;
    D.assert(!isReadOnly(),'Consulta pública: conclusão indisponível.');
    const ctx=conclusionContext,form=$('#conclusion-form'),btn=$('[data-action="confirm-conclusion"]');
    D.assert(ctx && form && ctx.proposalId===selected && ctx.revision===state.revision,'A revisão mudou. Reabra e confira a conclusão.');
    const input=Object.fromEntries(new FormData(form));conclusionSubmitting=true;btn.disabled=true;
    try{
      const persisted=await ProforStore.checkCurrent(ctx.revision),next=D.clone(persisted),p=next.proposals.find(x=>x.id===ctx.proposalId && !x.isDeleted);
      D.assert(p,'Proposta indisponível.');D.confirmConclusion(p,{...input,expectedEvidence:ctx.evidence,operationId:ctx.operationId},actor());
      await persist(next);conclusionContext=null;render();saved('Conclusão técnica registrada e salva localmente.');
    }catch(err){formError(err);if(err.status===409){$('#save-state').textContent='Conflito de revisão — conclusão não salva';$('#save-state').dataset.state='conflict';}throw err;}
    finally{conclusionSubmitting=false;if(btn.isConnected)btn.disabled=false;}
  }
  /* Sincronização automática: a interface apenas chama o servidor local e grava o resultado no banco. */
  const SYNC_PATH='/api/sync',SYNC_TIMEOUT_MS=45*60*1000;
  const SYNC_SERVER_HELP=location.protocol==='file:'
    ?'Esta página foi aberta diretamente do arquivo (file://), e nesse modo o navegador não pode baixar as extrações do Transferegov; nada foi gravado no banco local. Abra o sistema pelo atalho da Área de Trabalho ou pelo arquivo “INICIAR SISTEMA.cmd”, na pasta do sistema, para ligar o servidor e abrir a sincronização.'
    :'Não foi possível falar com o servidor local; nada foi gravado no banco local. Abra o sistema pelo atalho “PROFOR 2026” na Área de Trabalho ou pelo arquivo “INICIAR SISTEMA.cmd”, na pasta do sistema. Alternativa manual: execute “node server.cjs” na pasta do sistema e use http://127.0.0.1:8766/PROFOR_2026.html.';
  function syncClock(ms){const s=Math.max(0,Math.floor(ms/1000));return s<60?`${s} s`:`${Math.floor(s/60)} min ${String(s%60).padStart(2,'0')} s`;}
  function syncBytes(n){const fmt=value=>value.toLocaleString('pt-BR',{maximumFractionDigits:1});return n<1024?`${fmt(n)} B`:n<1048576?`${fmt(n/1024)} KB`:`${fmt(n/1048576)} MB`;}
  function syncFailure(kind,message){const err=new Error(message);err.syncKind=kind;return err;}
  function syncLabel(source,pad,note=''){
    const files=Array.isArray(source?.files)?source.files.length:Array.isArray(source?.blobs)?source.blobs.length:0;
    return `${source?.url || 'https://api-publica.transferegov.gestao.gov.br/downloads'} · ${pad?'sincronização completa (com PAD)':'sincronização rápida (sem PAD)'}${files?` · ${files} arquivo(s)`:''}${note?` · ${note}`:''}`;
  }
  function syncStep(text){const el=$('#sync-step');if(el)el.textContent=text;}
  function syncLog(message,at=Date.now()){
    const timestamp=new Date(at).toISOString();
    if(syncRun)syncRun.activity.push({at:timestamp,message:String(message)});
    const log=$('#sync-activity');if(!log)return;
    const item=document.createElement('li');
    const time=document.createElement('time');time.textContent=historyTime(timestamp);
    const line=document.createElement('span');line.textContent=message;
    item.append(time,line);log.append(item);
    while(log.children.length>200)log.firstElementChild.remove();
    log.scrollTop=log.scrollHeight;
  }
  function syncActions(mode){
    const el=$('#sync-actions');if(!el)return;
    if(mode==='running')el.innerHTML=button('Cancelar atualização','sync-cancel','','danger');
    else if(mode==='saving')el.innerHTML='<button type="button" disabled>Gravando no banco local…</button>';
    else el.innerHTML=button('Atualizar Dados','sync-start','','primary');
  }
  function syncFail(message,kind='error'){
    const el=$('#form-error');
    if(el){el.className=kind==='error'?'error-message':'source';el.textContent=message;el.focus();}
    syncStep(kind==='error'?'Não foi possível concluir a sincronização.':'Sincronização interrompida.');
    syncLog(kind==='error'?`ERRO: ${message}`:message);
    syncActions('idle');if(kind==='error')toast(message,true);
  }
  function syncDataFail(detail){syncFail(`A resposta do servidor local não pôde ser usada: ${detail}. Nada foi gravado no banco local e as propostas já cadastradas foram preservadas.`);}
  function syncReadText(res,onBytes){
    const reader=res.body?.getReader();
    if(!reader)return res.text();
    return new Promise((resolve,reject)=>{
      const decoder=new TextDecoder('utf-8');let total=0,text='';
      const pump=()=>reader.read().then(({value,done})=>{
        if(done){resolve(text+decoder.decode());return;}
        total+=value.byteLength;onBytes(total);text+=decoder.decode(value,{stream:true});pump();
      },reject);
      pump();
    });
  }
  function syncStartTimers(run){
    run.timer=setInterval(()=>{const el=$('#sync-elapsed');if(el)el.textContent=syncClock(Date.now()-run.started);},1000);
    run.timeout=setTimeout(()=>{run.reason=run.reason || 'timeout';run.controller.abort();},SYNC_TIMEOUT_MS);
  }
  function syncStopTimers(run){clearInterval(run.timer);clearInterval(run.poll);clearTimeout(run.timeout);if(syncRun===run)syncRun=null;}
  function cancelSync(reason='user'){if(syncRun){syncRun.reason=syncRun.reason || reason;syncRun.controller.abort();}}
  function syncWarningsHtml(warnings){return warnings.length?warnings.map(w=>`<div class="info warning">${e(w)}</div>`).join(''):'';}
  function syncStatsHtml(stats){
    if(!stats || typeof stats!=='object')return '';
    const items=[];
    if(Number.isFinite(stats.proposals))items.push(`${stats.proposals} proposta(s) no servidor`);
    if(Number.isFinite(stats.padItems))items.push(`${stats.padItems} item(ns) de PAD`);
    if(Number.isFinite(stats.durationMs))items.push(`duração no servidor: ${(stats.durationMs/1000).toFixed(1).replace('.',',')} s`);
    return items.length?`<p class="source">${e(items.join(' · '))}</p>`:'';
  }
  function syncStatsBadge(stats){return stats && Number.isFinite(stats.durationMs)?`<span>${badge(`servidor: ${(stats.durationMs/1000).toFixed(1).replace('.',',')} s`)}</span>`:'';}
  function syncPadBadge(stats){return stats && Number.isFinite(stats.padItems)?`<span>${badge(`${stats.padItems} item(ns) de PAD recebidos`)}</span>`:'';}
  const SYNC_FIELD_LABELS={numero:'Número da proposta',uf:'UF',programa:'Programa',proponente:'Proponente',cnpj:'CNPJ',orgao:'Órgão',objeto:'Objeto',situacao:'Situação',data:'Data da proposta',vigenciaInicio:'Início da vigência',vigenciaFim:'Fim da vigência',repasse:'Valor de repasse',contrapartida:'Contrapartida',global:'Valor global',pad:'Plano de Aplicação Detalhado'};
  function syncFieldLabel(field){return SYNC_FIELD_LABELS[field]||field;}
  function padBusinessKey(item){return JSON.stringify([item.descricao,Number(item.quantidade),item.unitario,item.total]);}
  function padChangedItems(value,other){
    const remaining=new Map();
    for(const item of Array.isArray(other)?other:[]){const key=padBusinessKey(item);remaining.set(key,(remaining.get(key)||0)+1);}
    return value.filter(item=>{const key=padBusinessKey(item),count=remaining.get(key)||0;if(count){remaining.set(key,count-1);return false;}return true;});
  }
  function visibleHistoryChanges(changes){return changes.filter(change=>change.field!=='pad' || !Array.isArray(change.before) || !Array.isArray(change.after) || padChangedItems(change.before,change.after).length || padChangedItems(change.after,change.before).length);}
  function syncPadItemHtml(item){
    const quantity=Number(item.quantidade);
    const formattedQuantity=Number.isFinite(quantity)?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:6}).format(quantity):String(item.quantidade??'—');
    const unit=Number.isSafeInteger(item.unitario)?D.fmtMoney(item.unitario):'—';
    const total=Number.isSafeInteger(item.total)?D.fmtMoney(item.total):'—';
    return `<li><strong>${e(item.descricao||'Item sem descrição')}</strong><span>Quantidade: ${e(formattedQuantity)} · Unitário: ${e(unit)} · Total: ${e(total)}</span></li>`;
  }
  function syncPadValueHtml(value,other){
    if(value===null || value===undefined)return '<span class="muted">Em branco</span>';
    if(!Array.isArray(value))return '<span class="muted">Formato do plano indisponível</span>';
    const changed=padChangedItems(value,other);
    const total=value.length,number=changed.length;
    return `<div class="pad-change-count">${total} ${total===1?'item':'itens'} no plano</div>${number?`<details class="pad-change-details"><summary>Ver ${number} ${number===1?'item diferente':'itens diferentes'}</summary><ul>${changed.map(syncPadItemHtml).join('')}</ul></details>`:''}`;
  }
  function syncValueHtml(field,value,other){
    if(field==='pad')return syncPadValueHtml(value,other);
    if(value===null || value===undefined)return '<span class="muted">Em branco</span>';
    if(['repasse','contrapartida','global'].includes(field) && Number.isSafeInteger(value))return e(D.fmtMoney(value));
    if(['data','vigenciaInicio','vigenciaFim'].includes(field) && typeof value==='string' && /^\d{4}-\d{2}-\d{2}/.test(value))return e(D.fmtDate(value));
    if(typeof value==='object')return '<span class="muted">Dados estruturados atualizados.</span>';
    const raw=String(value);
    if(!raw)return '<span class="muted">Em branco</span>';
    if(raw.length<=240)return `<span class="change-value">${e(raw)}</span>`;
    return `<div class="change-preview">${e(raw.slice(0,170))}…</div><details class="change-value change-long"><summary>Ver texto completo</summary><div>${e(raw)}</div></details>`;
  }
  function syncChangesHtml(changes){
    const visible=visibleHistoryChanges(changes);
    if(!visible.length)return '<p class="muted">Nenhuma alteração de campo.</p>';
    return `<div class="change-list">${visible.map(c=>`<article class="change-card"><div class="change-card-head"><div><span class="change-field">${e(syncFieldLabel(c.field))}</span><span class="change-proposal">Proposta <span class="proposal-number">${e(proposalNumber(c.numero))}${proposalCopyButton(c.numero)}</span> ${ufTag(c.uf)}</span></div></div><div class="change-pair"><div class="change-side change-before"><div class="change-side-label">Antes</div><div class="change-side-content">${syncValueHtml(c.field,c.before,c.after)}</div></div><div class="change-side change-after"><div class="change-side-label">Depois</div><div class="change-side-content">${syncValueHtml(c.field,c.after,c.before)}</div></div></div></article>`).join('')}</div>`;
  }
  function lastChangeHtml(){
    if(!syncHistory)return '<p class="source">Carregando a última alteração…</p>';
    const entry=syncHistory.slice().reverse().find(item=>visibleHistoryChanges(item.changes).length);
    if(!entry)return '<p class="source">Nenhuma alteração registrada nas versões disponíveis do banco.</p>';
    return `<p class="source">${e(new Date(entry.at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} · ${visibleHistoryChanges(entry.changes).length} campo(s) alterado(s)${entry.reconstructed?' · reconstruído das versões anteriores':''}</p>${syncChangesHtml(entry.changes)}`;
  }
  function renderLastChange(){const el=$('#last-sync-changes');if(el)el.innerHTML=lastChangeHtml();}
  function loadLastChange(force=false){refreshHistory(force).then(()=>{
    renderLastChange();
    const result=$('#sync-current-result'),latest=syncHistory.at(-1);
    if(result && latest){const count=visibleHistoryChanges(latest.changes).length;result.textContent=count?`${count} campo(s) alterado(s) nesta atualização.`:'Sem dados novos nesta atualização.';}
    if(view==='registros')renderRecords();
  }).catch(err=>{const el=$('#last-sync-changes');if(el)el.textContent=`Não foi possível ler o histórico: ${err.message}`;});}
  function syncDialogHtml(){
    return `<div class="sync-monitor"><div class="sync-progress-head"><span id="sync-step" role="status" aria-live="polite">Pronto para atualizar propostas, PAD e textos oficiais.</span><strong id="sync-percent">0%</strong></div><progress id="sync-progress" max="100" value="0" aria-label="Progresso da atualização">0%</progress><p class="source"><span id="sync-elapsed">0 s</span> · <span id="sync-stage">Aguardando início</span> · <span id="sync-received">0 de 14 operações</span></p></div>
      <section class="sync-activity" aria-label="Registro da atualização"><h3>Registro da atualização</h3><ol id="sync-activity" role="log" aria-live="polite" aria-relevant="additions"></ol></section>
      <div id="sync-summary" aria-live="polite"></div>
      <section class="section sync-last"><div class="section-head"><h3>Última alteração registrada</h3></div><div class="section-body" id="last-sync-changes">${lastChangeHtml()}</div></section>
      <p id="form-error" class="error-message" role="alert" tabindex="-1"></p>
      <div class="dialog-actions" id="sync-actions">${button('Atualizar Dados','sync-start','','primary')}</div>`;
  }
  /* Cada item de análise mostra o trecho que o ente federativo registrou na
     origem, transcrito sem edição. Item sem texto correspondente não inventa
     conteúdo: aponta a consulta pública. */
  const TEXTOS_DO_ITEM={justificativa:['caracterizacao','justificativa'],publicoAlvo:['publicoAlvo'],problema:['problema'],resultados:['resultados'],objetivos:['relacao'],capacidade:['capacidade']};
  const consultaPublica=(id,destino='')=>`https://discricionarias.transferegov.sistema.gov.br/voluntarias/ConsultarProposta/ResultadoDaConsultaDePropostaDetalharProposta.do?idProposta=${encodeURIComponent(id)}&destino=${encodeURIComponent(destino)}&idConvenio=`;
  function textosOficiaisHtml(p,id){
    const campos=TEXTOS_DO_ITEM[id] || [];
    if(!campos.length)return '';
    const link=`<a href="${e(consultaPublica(p.imported.id))}" target="_blank" rel="noopener noreferrer">abrir a consulta pública desta proposta no Transferegov</a>`;
    const t=p.textos;
    if(!t)return `<p class="source">Os textos oficiais desta proposta ainda não estão neste banco. Use <strong>Sincronização → Atualizar Dados</strong> para atualizar propostas e textos juntos. Também é possível ${link}.</p>`;
    const partes=campos.filter(c=>String(t[c]||'').trim()).map(c=>`<div class="wide"><dt>${textoHtml(D.CAMPOS_TEXTOS[c],'Textos oficiais: rótulo')}</dt><dd><div class="texto-oficial">${textoHtml(t[c],'Textos oficiais: '+c)}</div></dd></div>`);
    if(!partes.length)return `<p class="source">A origem não traz texto para este item nesta proposta. Confira ${link}.</p>`;
    return `<dl class="data-grid">${partes.join('')}</dl><p class="source">Transcrição do arquivo público da origem, obtida em ${textoHtml(D.fmtDate(t.at),'Textos oficiais: data')} · ${link}.</p>`;
  }
  function syncRestart(){
    if(syncRun){toast('Já existe uma sincronização em andamento. Aguarde ou cancele a operação.',true);return;}
    modal('Atualizar dados',syncDialogHtml());
    loadLastChange();
    startSync();
  }
  function syncDialog(){
    if(!state)return;
    if(syncRun){toast('Já existe uma sincronização em andamento. Aguarde ou cancele a operação.',true);return;}
    if(isReadOnly()){
      modal('Sincronização',`<p>A sincronização com o Transferegov é executada no sistema local (ou pelo agendamento automático) e publicada no GitHub Pages via <strong>ATUALIZAR_GITHUB_PAGES.cmd</strong>.</p><p>Para atualizar os dados, execute a sincronização no seu computador e envie as alterações ao GitHub.</p><div class="dialog-actions">${button('Fechar','close')}</div>`);
      return;
    }
    if(location.protocol==='file:'){
      modal('Atualizar dados',`<p>Esta janela foi aberta pelo arquivo HTML (<strong>file://</strong>). Nesse modo o navegador não pode baixar as extrações do Transferegov — não é falha do botão: a API pública não autoriza o download direto pelo navegador, e esta página não consegue nem consultar o servidor local.</p><p><strong>Para sincronizar:</strong> feche esta janela e abra o sistema pelo atalho <strong>PROFOR 2026</strong> da Área de Trabalho (ou pelo arquivo <strong>INICIAR SISTEMA.cmd</strong>, na pasta do sistema). Ele liga o servidor local e abre o sistema no endereço certo; lá o botão Atualizar Dados funciona.</p><div class="info warning">Os dados locais ficam guardados por origem: o que já foi sincronizado pertence ao endereço do servidor, e não a esta janela aberta pelo arquivo HTML. Por isso o painel aparece vazio aqui.</div><div class="dialog-actions">${button('Modo offline: anexar arquivos CSV','import')}${button('Fechar','close')}</div>`);
      return;
    }
    modal('Atualizar dados',syncDialogHtml());
    syncLog('Pronto. Clique em Atualizar Dados para iniciar.');
    loadLastChange();
  }
  /* Chegou pelo protocolo (?sync=1)? Então sincroniza sozinho, sem novo clique. */
  function runAutoSyncFromQuery(){
    let auto=false;
    try{auto=new URLSearchParams(location.search).get('sync')==='1';}catch{auto=false;}
    if(!auto)return;
    try{history.replaceState(null,'',location.pathname+location.hash);}catch{/* URL segue com ?sync=1 */}
    syncRestart();
  }
  async function startSync(){
    D.assert(!isReadOnly(),'Consulta pública: sincronização indisponível.');
    if(syncRun){toast('Já existe uma sincronização em andamento. Aguarde ou cancele a operação.',true);return;}
    const run={controller:new AbortController(),started:Date.now(),pad:true,reason:'',id:crypto.randomUUID(),activity:[]};
    syncRun=run;syncStartTimers(run);
    const errorEl=$('#form-error');if(errorEl){errorEl.className='error-message';errorEl.textContent='';}
    const log=$('#sync-activity');if(log)log.replaceChildren();
    const bar=$('#sync-progress'),percent=$('#sync-percent');if(bar)bar.value=0;if(percent)percent.textContent='0%';
    const stage=$('#sync-stage');if(stage)stage.textContent='iniciando';
    const received=$('#sync-received');if(received)received.textContent='aguardando os dados da etapa';
    const summary=$('#sync-summary');if(summary)summary.replaceChildren();
    syncStep('Servidor local acionado: atualizando propostas, PAD e textos oficiais.');
    syncLog('Iniciando atualização de propostas, PAD e textos oficiais.');
    syncActions('running');
    const force=!state.proposals.length;
    const applyProgress=data=>{
      if(syncRun!==run || !data || typeof data!=='object')return;
      if(typeof data.message==='string')syncStep(data.message);
      const stage=$('#sync-stage');if(stage)stage.textContent=data.step>0?`etapa ${data.step} de ${data.steps}`:'iniciando';
      const bar=$('#sync-progress'),percent=$('#sync-percent'),detail=$('#sync-received');
      const measurable=Number.isFinite(data.loaded) && Number.isFinite(data.total) && data.total>0;
      const overall=Number.isFinite(data.percent)?Math.max(0,Math.min(99,data.percent)):0;
      if(bar)bar.value=overall;
      if(percent)percent.textContent=`${overall}%`;
      if(detail)detail.textContent=measurable?`${syncBytes(data.loaded)} de ${syncBytes(data.total)} processados nesta operação`:'aguardando a conclusão desta operação';
      if(Array.isArray(data.actions)){
        for(const action of data.actions){
          if(!Number.isInteger(action.seq) || action.seq<=(run.lastActionSeq||0))continue;
          syncLog(action.message,action.at);
          run.lastActionSeq=action.seq;
        }
      }
      if(measurable && typeof data.message==='string'){
        const progressStep=Number.isInteger(data.step)?data.step:0;
        const decile=Math.min(10,Math.floor(10*data.loaded/data.total));
        if(progressStep!==run.lastLoggedStep){run.lastLoggedStep=progressStep;run.lastLoggedDecile=-1;}
        if(decile>run.lastLoggedDecile && data.loaded>0){
          run.lastLoggedDecile=decile;
          syncLog(`${data.message} ${syncBytes(data.loaded)} de ${syncBytes(data.total)} (${decile*10}%).`);
        }
      }
    };
    const pollProgress=async()=>{
      if(run.controller.signal.aborted)return;
      if(run.polling)return run.polling;
      run.polling=(async()=>{
        try{const response=await fetch(`/api/sync/progress?run=${encodeURIComponent(run.id)}`,{signal:run.controller.signal,cache:'no-store'});if(response.ok)applyProgress(await response.json());}catch{/* a resposta principal continua responsável por informar falhas */}
      })();
      try{await run.polling;}finally{run.polling=null;}
    };
    run.poll=setInterval(pollProgress,800);
    let text;
    try{
      const res=await fetch(`${SYNC_PATH}?pad=1${force?'&force=1':''}&run=${encodeURIComponent(run.id)}`,{signal:run.controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
      if(!res.ok){
        let detail='';try{detail=(await res.json()).error || '';}catch{/* servidor sem corpo JSON */}
        throw syncFailure('origem',`O servidor local respondeu HTTP ${res.status} e não concluiu a sincronização${detail?`: ${detail}`:'. Confira a conexão e tente novamente.'}`);
      }
      await pollProgress();
      text=await syncReadText(res,()=>{});
    }catch(err){
      syncStopTimers(run);
      if(err.name==='AbortError'){
        if(run.reason==='timeout')syncFail(`A sincronização excedeu o limite de ${SYNC_TIMEOUT_MS/60000} minutos e foi interrompida. Nada foi gravado no banco local; verifique a conexão e tente novamente.`);
        else if(run.reason!=='closed')syncFail('A sincronização foi cancelada. Nada foi gravado no banco local.',run.reason==='user'?'info':'error');
        return;
      }
      if(err.syncKind==='origem')syncFail(err.message);else syncFail(SYNC_SERVER_HELP);
      return;
    }
    syncActions('saving');syncLog('Download concluído. Validando e gravando os dados locais.');
    let payload;
    try{payload=JSON.parse(text);}catch{payload=null;}
    if(!payload || typeof payload!=='object' || Array.isArray(payload)){syncStopTimers(run);syncDataFail('o conteúdo recebido não é um objeto JSON');return;}
    const warnings=Array.isArray(payload.warnings)?payload.warnings.filter(w=>typeof w==='string'):[];
    const source=payload.source && typeof payload.source==='object'?payload.source:null;
    const cached=payload.unchanged===true;
    if(!Array.isArray(payload.proposals)){syncStopTimers(run);syncDataFail('a resposta não traz a lista de propostas (campo “proposals”)');return;}
    if(!payload.textos || typeof payload.textos!=='object' || Array.isArray(payload.textos) || !Array.isArray(payload.textosFaltando)){
      syncStopTimers(run);syncDataFail('a resposta não traz os textos oficiais; reinicie o servidor local para carregar a versão atualizada');return;
    }
    if(!payload.proposals.length){
      const label=syncLabel(source,run.pad,'extração sem propostas');
      try{
        syncStep('A extração não trouxe propostas. Preservando o banco local…');
        syncLog('A extração oficial não trouxe propostas. Preservando o banco local.');
        const applied=applySyncResult(state,payload,actor(),label);
        await persist(applied.state,{syncRun:{startedAt:new Date(run.started).toISOString(),activity:run.activity}});
        syncLog('Gravação confirmada no banco local.');
      }catch(err){syncStopTimers(run);syncDataFail(err.message);return;}
      syncStopTimers(run);syncHistory=null;render();modalDirty=false;
      const bar=$('#sync-progress'),percent=$('#sync-percent');if(bar)bar.value=100;if(percent)percent.textContent='100%';
      syncStep('Atualização concluída sem propostas na extração.');syncActions('idle');
      const summary=$('#sync-summary');if(summary)summary.innerHTML=`<p id="sync-current-result">Sem dados novos nesta atualização.</p><div class="info warning">A extração oficial não trouxe propostas. Os dados locais foram preservados.</div>${syncStatsHtml(payload.stats)}${syncWarningsHtml(warnings)}`;
      loadLastChange();
      toast('A extração não trouxe propostas do programa; nenhum dado local foi removido.');
      return;
    }
    syncStep(`Validando ${payload.proposals.length} proposta(s) recebida(s)…`);
    syncLog(`Validando ${payload.proposals.length} proposta(s) recebida(s).`);
    const localWasEmpty=!state.proposals.length;
    let preview,textosConferidos=0,textosAlterados=0;
    try{
      preview=applySyncResult(state,payload,actor(),syncLabel(source,run.pad,cached?'extração reaproveitada pelo servidor':''));
      textosConferidos=preview.textsChecked;textosAlterados=preview.textsChanged;
      warnings.push(...preview.warnings);
    }catch(err){syncStopTimers(run);syncDataFail(err.message);return;}
    try{
      syncStep(`Gravando ${preview.changes.length} alteração(ões) de dados e ${textosAlterados} alteração(ões) de textos no banco local…`);
      syncLog('Gravando propostas, PAD e textos no banco local.');
      await persist(preview.state,{syncRun:{startedAt:new Date(run.started).toISOString(),activity:run.activity}});
      syncLog('Gravação confirmada no banco local.');
      const bar=$('#sync-progress'),percent=$('#sync-percent');if(bar)bar.value=100;if(percent)percent.textContent='100%';
    }catch(err){syncStopTimers(run);syncDataFail(err.message);return;}
    syncStopTimers(run);syncHistory=null;render();modalDirty=false;
    const ufs=[...new Set(preview.state.proposals.map(p=>p.imported.uf))].sort();
    const when=preview.state.sync.at;
    const cachedNote=cached?`<div class="info">${localWasEmpty?'O servidor reaproveitou a extração recente de propostas; os textos oficiais foram consultados nesta execução.':'A extração de propostas foi reaproveitada porque sua geração não mudou; os textos oficiais foram consultados nesta execução.'}</div>`:'';
    syncStep('Atualização concluída e gravada no banco local.');
    if(summary)summary.innerHTML=`<p id="sync-current-result">Conferindo alterações registradas…</p><p><strong>${payload.proposals.length} proposta(s)</strong> recebida(s) · ${textosConferidos} texto(s) conferido(s) · ${textosAlterados} texto(s) alterado(s).</p>${cachedNote}<div class="consistency"><span>${badge(`${ufs.length} de ${Object.keys(D.UFS).length} UFs cobertas`,'good')} ${e(ufs.join(', '))}</span>${syncPadBadge(payload.stats)}${syncStatsBadge(payload.stats)}</div><p class="source">Concluída em ${e(new Date(when).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))}.</p>${syncWarningsHtml(warnings)}`;
    syncActions('idle');
    loadLastChange();
    toast(`Sincronização concluída: ${payload.proposals.length} proposta(s) e ${textosConferidos} texto(s) conferido(s).`);
  }
  function importDialog(){modal('Modo offline: anexar arquivos CSV do Transferegov',`<p>Programa <strong>${D.PROGRAM}</strong>. Modo offline de contingência: baixe e extraia os ZIPs no <a href="https://api-publica.transferegov.gestao.gov.br/downloads" target="_blank" rel="noopener noreferrer">portal oficial de dados</a> e selecione os CSVs abaixo. O caminho principal é <strong>Sincronização → Atualizar Dados</strong>, que dispensa qualquer anexo.</p><form class="form-stack"><label>1. Programas — siconv_programa.csv<input name="program" type="file" accept=".csv" required></label><label>2. Programas / propostas — siconv_programa_proposta.csv<input name="links" type="file" accept=".csv" required></label><label>3. Propostas — siconv_proposta.csv<input name="proposal" type="file" accept=".csv" required></label><label>4. Plano de aplicação detalhado (opcional)<input name="pad" type="file" accept=".csv"></label><label>Codificação dos CSVs<select name="encoding"><option value="utf-8">UTF-8 (extração oficial atual)</option><option value="windows-1252">Windows-1252 (extrações antigas)</option></select></label><p id="import-progress" role="status"></p>${formEnd('Conferir importação')}</form>`);bindForm(async fd=>{const startedAt=D.now(),activity=[{at:startedAt,message:'Iniciando importação manual de arquivos CSV.'}];const files=Object.fromEntries(['program','links','proposal','pad'].map(k=>[k,fd.get(k)?.size?fd.get(k):null]));const result=await Transferegov.importFiles(files,msg=>{$('#import-progress').textContent=msg;activity.push({at:D.now(),message:msg});},fd.get('encoding'));const preview=D.syncProposals(state,result.proposals,result.source);modalDirty=false;modal('Conferir importação',`<p><strong>${result.proposals.length} proposta(s)</strong> vinculada(s) ao programa. ${preview.changes.length} alteração(ões) detectada(s).</p>${result.warnings.map(w=>`<div class="info warning">${e(w)}</div>`).join('')}${syncChangesHtml(preview.changes)}<p id="form-error" class="error-message" role="alert"></p><div class="dialog-actions">${button('Cancelar','close')}<button id="commit-import" class="primary">Confirmar importação</button></div>`);$('#commit-import').onclick=async()=>{const btn=$('#commit-import');btn.disabled=true;try{activity.push({at:D.now(),message:'Gravando importação manual no banco local.'});await persist(preview.state,{syncRun:{startedAt,activity}});syncHistory=null;render();saved('Importação concluída e salva no banco local.');}catch(err){formError(err);btn.disabled=false;}};});}
  function download(name,type,content){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function backupDialog(){if(isReadOnly()){modal('Exportação de consulta',`<p>Consulta pública em modo de leitura.</p>${button('Exportar CSV','csv')}${button('Fechar','close')}`);return;}modal('Backup e exportação',`<p>O banco fica na pasta dados/registros do sistema e acompanha o workspace pelo OneDrive. Antes de trocar de máquina, feche o sistema e aguarde a sincronização do OneDrive nas duas máquinas.</p><p>Última exportação solicitada: ${state.lastBackup?e(new Date(state.lastBackup).toLocaleString('pt-BR')):'nenhuma'}.</p><div class="actions">${button('Exportar backup JSON','backup','','primary')}${button('Exportar CSV','csv')}${button('Exportar cópia de recuperação','recovery')}${button('Resgatar banco antigo deste navegador','legacy')}</div><hr><form class="form-stack"><label>Restaurar backup JSON<input type="file" name="backup" accept=".json" required></label><p class="source">A restauração substitui o banco atual. A versão anterior ficará preservada como cópia de recuperação local.</p>${formEnd('Validar restauração')}</form>`);bindForm(async fd=>{const file=fd.get('backup');D.assert(file.size<50*1024*1024,'Backup acima do limite de 50 MB.');const imported=D.validateState(JSON.parse(await file.text()));modalDirty=false;modal('Confirmar restauração',`<p>Substituir ${state.proposals.length} proposta(s) local(is) pelas ${imported.proposals.length} proposta(s) deste backup?</p><p>A cópia do banco atual será preservada antes da substituição.</p><p id="form-error" class="error-message" role="alert"></p><div class="dialog-actions">${button('Cancelar','close')}<button id="restore-confirm" class="primary">Restaurar este backup</button></div>`);$('#restore-confirm').onclick=async()=>{const btn=$('#restore-confirm');btn.disabled=true;try{await persist(imported,{restore:true});selected=null;location.hash='painel';render();saved('Backup restaurado. A versão anterior foi preservada.');}catch(err){formError(err);btn.disabled=false;}};});}
  let activeReportTopics=null;
  function selectedReportTopics(){
    if(!activeReportTopics){
      const p=current();
      activeReportTopics=new Set(ProforReport.availableTopics(p).map(t=>t.id));
    }
    return activeReportTopics;
  }
  function currentReportHtml(){
    return ProforReport.html(current(),{topics:[...selectedReportTopics()]});
  }
  function updateReportPreview(){
    const preview=$('#report-preview');
    if(!preview)return;
    const topics=[...selectedReportTopics()];
    preview.innerHTML=ProforReport.html(current(),{topics});
    const hasAny=topics.length>0;
    const actions=document.querySelectorAll('.report-actions button');
    actions.forEach(b=>{b.disabled=!hasAny;});
  }
  function report(){
    const p=current();
    const available=ProforReport.availableTopics(p);
    activeReportTopics=new Set(available.map(t=>t.id));
    const checkboxes=available.map(t=>`
      <label class="report-topic-item">
        <input type="checkbox" name="report_topic" value="${e(t.id)}" checked>
        <span>${e(t.label)}</span>
      </label>
    `).join('');
    modal('Relatório de análise',`
      <div class="report-filter-bar">
        <div class="report-filter-head">
          <span class="report-filter-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Tópicos do relatório:
          </span>
          <div class="report-filter-shortcuts">
            <button type="button" class="btn-filter-shortcut" data-action="report-select-all" title="Selecionar todos os tópicos">Todos</button>
            <button type="button" class="btn-filter-shortcut" data-action="report-select-pad" title="Selecionar apenas o Plano de Aplicação Detalhado">Apenas PAD</button>
            <button type="button" class="btn-filter-shortcut" data-action="report-select-none" title="Desmarcar todos">Nenhum</button>
          </div>
        </div>
        <div class="report-topics-grid" id="report-topics-list">
          ${checkboxes}
        </div>
      </div>
      <div class="actions report-actions">
        ${button('Copiar texto','copy-text')}
        ${button('Copiar HTML para SEI','copy-html')}
        ${button('Salvar HTML','save-report')}
        ${button('Salvar XLSX','save-xlsx')}
        ${button('Imprimir / salvar PDF','print','','primary')}
      </div>
      <div class="report" id="report-preview">${ProforReport.html(p,{topics:[...activeReportTopics]})}</div>
    `);
    const listEl=$('#report-topics-list');
    if(listEl){
      listEl.addEventListener('change',()=>{
        const checked=[...listEl.querySelectorAll('input[type="checkbox"]:checked')].map(c=>c.value);
        activeReportTopics=new Set(checked);
        updateReportPreview();
      });
    }
  }
  const PUBLIC_ACTIONS=new Set(['close','review','view-diligence','sync','export','csv','report','report-select-all','report-select-none','report-select-pad','save-report','save-xlsx','print','copy-text','copy-html','copy-program-code','copy-proposal','copy-cnpj','history-day','history-prev','history-next','history-today','toggle-uf-expand','toggle-uf','ver-apagadas']);
  async function handleAction(target){const action=target.dataset.action;
    if(isReadOnly() && !PUBLIC_ACTIONS.has(action))throw new Error('Consulta pública: ação de alteração indisponível.');
    if(action==='close')closeModal();else if(action==='import')importDialog();else if(action==='sync')syncDialog();else if(action==='sync-start')startSync();else if(action==='history-day'){selectedHistoryDay=target.dataset.day;renderRecords();document.querySelector(`[data-action="history-day"][data-day="${selectedHistoryDay}"]`)?.focus();}else if(action==='history-prev' || action==='history-next'){moveCalendar(action==='history-prev'?-1:1);document.querySelector(`[data-action="${action}"]`)?.focus();}else if(action==='history-today'){selectedHistoryDay=D.localToday();calendarStart=calendarWeek(selectedHistoryDay.slice(0,7)+'-01');renderRecords();document.querySelector('[data-action="history-today"]')?.focus();}else if(action==='export')backupDialog();else if(action==='sync-cancel')cancelSync('user');else if(action==='sync-retry')syncRestart();else if(action==='review')editReview(target.dataset.group,target.dataset.id);else if(action==='sei')editSei();else if(action==='institution')editInstitution();else if(action==='view-diligence')viewDiligence(target.dataset.id);else if(action==='diligence')editDiligence(target.dataset.id,target.dataset.ref);else if(action==='conclude')conclusion();else if(action==='confirm-conclusion')await confirmConclusionNow();else if(action==='report')report();else if(action==='copy-program-code'){await navigator.clipboard.writeText(target.dataset.code);toast(`Código ${target.dataset.code} copiado.`);}else if(action==='copy-proposal'){await navigator.clipboard.writeText(target.dataset.number);toast(`Proposta ${target.dataset.number} copiada.`);}else if(action==='copy-cnpj'){await navigator.clipboard.writeText(target.dataset.cnpj);toast(`CNPJ ${target.dataset.cnpj} copiado.`);}
    else if(action==='report-select-all'){
      const listEl=$('#report-topics-list');
      if(listEl){
        listEl.querySelectorAll('input[type="checkbox"]').forEach(c=>{c.checked=true;});
        activeReportTopics=new Set([...listEl.querySelectorAll('input[type="checkbox"]')].map(c=>c.value));
        updateReportPreview();
      }
    }
    else if(action==='report-select-none'){
      const listEl=$('#report-topics-list');
      if(listEl){
        listEl.querySelectorAll('input[type="checkbox"]').forEach(c=>{c.checked=false;});
        activeReportTopics=new Set();
        updateReportPreview();
      }
    }
    else if(action==='report-select-pad'){
      const listEl=$('#report-topics-list');
      if(listEl){
        listEl.querySelectorAll('input[type="checkbox"]').forEach(c=>{c.checked=(c.value==='pad');});
        activeReportTopics=new Set(['pad']);
        updateReportPreview();
      }
    }
    else if(action==='resolve-ref'){const ref=target.dataset.ref,name=actor();const ds=current().diligences.filter(d=>d.ref===ref);D.assert(ds.length && ds.every(d=>d.status==='saneada'),'Ainda existe diligência não saneada.');const [g,id]=ref.split(':');await change(p=>D.setReview(p,g,id,{...D.reviewOf(p,g,id),status:'ok'},name));saved('Requisito atualizado com confirmação do analista.');}
    else if(action==='toggle-uf-expand' || action==='toggle-uf'){
      const uf=target.dataset.uf,modo=target.dataset.modo==='apagadas'?'apagadas':'ativas';
      const conjunto=modo==='apagadas'?expandDel:expand;
      if(conjunto.has(uf))conjunto.delete(uf);else conjunto.add(uf);
      renderRows(modo);
      const btn=document.querySelector(`button.row-expand[data-uf="${uf}"][data-modo="${modo}"]`) || document.querySelector(`button.row-expand[data-uf="${uf}"]`);
      if(btn)btn.focus();
    }
    else if(action==='delete-proposal'){await confirmDeleteProposal(target.dataset.id);}
    else if(action==='restore-proposal'){await confirmRestoreProposal(target.dataset.id);}
    else if(action==='ver-apagadas'){selected=null;location.hash='apagadas';}
    else if(action==='backup'){const next=D.clone(state);next.lastBackup=D.now();await persist(next);download(`PROFOR_2026_BACKUP_${D.localToday()}.json`,'application/json',JSON.stringify(state,null,2));toast('Download solicitado. Confira o arquivo na pasta de downloads.');backupDialog();}
    else if(action==='csv'){download(`PROFOR_2026_${D.localToday()}.csv`,'text/csv;charset=utf-8',D.exportCSV(state));toast('Exportação CSV solicitada.');}
    else if(action==='legacy'){const old=await ProforStore.legacy();D.assert(old?.state,'Nenhum banco antigo encontrado neste navegador e endereço.');download('PROFOR_BANCO_ANTIGO.json','application/json',JSON.stringify(old.state,null,2));toast('Backup antigo exportado. Use Restaurar backup JSON para importá-lo.');}
    else if(action==='recovery'){const recovery=await ProforStore.read('recovery');D.assert(recovery,'Ainda não existe cópia de recuperação de uma restauração.');download(`PROFOR_2026_RECUPERACAO_${D.localToday()}.json`,'application/json',JSON.stringify(recovery,null,2));toast('Download da cópia de recuperação solicitado.');}
    else if(action==='save-report'){download(`PROFOR_RELATORIO_${current().id}.html`,'text/html;charset=utf-8','<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Relatório PROFOR</title><body>'+currentReportHtml()+'</body></html>');}
    else if(action==='save-xlsx'){
      const p=current();
      const topics=[...selectedReportTopics()];
      const xlsxBytes=ProforReport.xlsx(p,{topics});
      download(`PROFOR_RELATORIO_${p.id}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xlsxBytes);
      toast('Planilha XLSX gerada para análise por IA.');
    }
    else if(action==='print')window.print();
    else if(action==='copy-text' || action==='copy-html'){
      const html=currentReportHtml(),text=$('#report-preview').innerText;
      try{if(action==='copy-html' && navigator.clipboard?.write && window.ClipboardItem)await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);else await navigator.clipboard.writeText(text);toast('Relatório copiado.');}
      catch{modal('Copiar relatório',`<p>O navegador não liberou a área de transferência. Selecione e copie o conteúdo abaixo; para preservar a formatação, use também “Salvar HTML”.</p><textarea id="copy-fallback" rows="16">${e(action==='copy-html'?html:text)}</textarea><div class="dialog-actions">${button('Fechar','close')}</div>`);$('#copy-fallback').select();}
    }
  }
  /* ---- Apagar e restaurar proposta ----
     Apagar tira a proposta do painel e das demais telas de gestão sem apagar o registro. Evidências importadas ainda são atualizadas e invalidadas
     quando mudam; a proposta continua apagada até "Restaurar". */
  async function confirmDeleteProposal(id){
    const p=state.proposals.find(x=>x.id===id);
    D.assert(p && !p.isDeleted,'Proposta não encontrada ou já apagada.');
    modal('Apagar proposta',`<p>Apagar a proposta <span class="proposal-number"><strong>${e(proposalNumber(p.imported.numero))}</strong>${proposalCopyButton(p.imported.numero)}</span> (${e(p.imported.uf)} · ${e(p.imported.proponente)})?</p><div class="info"><strong>O que acontece:</strong><ul><li>ela sai do painel e das telas de gestão e acompanhamento;</li><li>as evidências importadas continuam sendo conferidas, preservando a exclusão e exigindo reanálise quando mudam;</li><li><strong>não</strong> é excluída do banco: o histórico é preservado e ela pode ser restaurada depois, na tela “Propostas apagadas”;</li><li>a origem no Transferegov não é alterada.</li></ul></div><p id="form-error" class="error-message" role="alert" tabindex="-1"></p><div class="dialog-actions">${button('Cancelar','close')}<button class="danger" type="button" data-action="delete-proposal-now" data-id="${e(id)}">Apagar do painel</button></div>`);
  }
  async function confirmRestoreProposal(id){
    const p=state.proposals.find(x=>x.id===id);
    D.assert(p && p.isDeleted,'Proposta não encontrada ou não está apagada.');
    modal('Restaurar proposta',`<p>Restaurar a proposta <span class="proposal-number"><strong>${e(proposalNumber(p.imported.numero))}</strong>${proposalCopyButton(p.imported.numero)}</span> (${e(p.imported.uf)} · ${e(p.imported.proponente)})?</p><div class="info">Ela volta ao painel e às demais telas de gestão, com as evidências e pendências de reanálise registradas durante a exclusão. O histórico e as análises anteriores são preservados.</div><div class="dialog-actions">${button('Cancelar','close')}<button class="primary" type="button" data-action="restore-proposal-now" data-id="${e(id)}">Restaurar</button></div>`);
  }
  async function deleteProposalNow(id){
    const nome=actor();
    const next=D.clone(state);const p=next.proposals.find(x=>x.id===id);
    D.deleteProposal(p,nome);
    await persist(next);
    if(selected===id){selected=null;location.hash='painel';return;}
    render();
    saved('Proposta apagada do painel. Ela continua em “Propostas apagadas” e pode ser restaurada.');
  }
  async function restoreProposalNow(id){
    const nome=actor();
    const next=D.clone(state);const p=next.proposals.find(x=>x.id===id);
    D.restoreProposal(p,nome);
    await persist(next);
    render();
    saved('Proposta restaurada: voltou ao painel e à sincronização.');
  }
  /* Delegação: ações, abertura do submenu de propostas e expansão das linhas.
     Clique em link dentro da linha (bandeira, sigla, número, nome) navega e NÃO
     expande; clique no resto da linha de UF expande e recolhe o resumo. */
  /* Dropdown de status: botão/pill e popover próprio, sem depender do select
     nativo. A ação de detalhes fica fora do listbox e separada por divisor. */
  document.addEventListener('click',ev=>{
    const padSelector=$('#pad-item-selector');
    if(padSelector?.open && !ev.target.closest('#pad-item-selector')){padSelector.open=false;padSelectorOpen=false;}
    const padStatusSelector=$('#pad-status-selector');
    if(padStatusSelector?.open && !ev.target.closest('#pad-status-selector')){padStatusSelector.open=false;padStatusOpen=false;}
    const toggle=ev.target.closest('[data-status-toggle]');
    if(toggle){ev.preventDefault();openStatusDropdown(toggle.closest('[data-status-dropdown]'));return;}
    const statusOption=ev.target.closest('[data-status-value]');
    if(statusOption){ev.preventDefault();runStatusChoice(statusOption,statusOption.dataset.statusValue).catch(formError);return;}
    const statusDetails=ev.target.closest('[data-status-details]');
    if(statusDetails){ev.preventDefault();runStatusChoice(statusDetails,'detalhes').catch(formError);return;}
    if(statusDropdownOpen&&!ev.target.closest('[data-status-dropdown]'))closeStatusDropdown(false);
    if(ev.target.closest('.skip')){ev.preventDefault();$('#main').focus();return;}
    if(ev.target.closest('#props-open')){ev.preventDefault();toggleProposalNav();return;}
    if(isReadOnly() && ev.target.closest('[data-action="delete-proposal-now"],[data-action="restore-proposal-now"],[data-status-value],[data-status-details]')){toast('Consulta pública: alteração indisponível.',true);return;}
    if(ev.target.closest('[data-action="delete-proposal-now"]')){const b=ev.target.closest('[data-action]');deleteProposalNow(b.dataset.id).catch(formError);return;}
    if(ev.target.closest('[data-action="restore-proposal-now"]')){const b=ev.target.closest('[data-action]');restoreProposalNow(b.dataset.id).catch(formError);return;}
    if(ev.target.closest('tr[data-uf] a'))return;
    const t=ev.target.closest('[data-action]');
    if(t){handleAction(t).catch(formError);return;}
    const ufRow=ev.target.closest('tr[data-uf]');
    if(ufRow){
      const uf=ufRow.dataset.uf,modo=ufRow.dataset.modo==='apagadas'?'apagadas':'ativas';
      const conjunto=modo==='apagadas'?expandDel:expand;
      if(conjunto.has(uf))conjunto.delete(uf);else conjunto.add(uf);
      renderRows(modo);
      const novo=document.querySelector(`tr[data-uf="${uf}"][data-modo="${modo}"]`);
      if(novo)novo.focus();
    }
  });
  document.addEventListener('wheel',ev=>{
    if(view!=='registros' || !ev.target.closest?.('.records-calendar') || Math.abs(ev.deltaY)<6)return;
    ev.preventDefault();
    if(Date.now()-lastCalendarWheel<220)return;
    lastCalendarWheel=Date.now();moveCalendar(ev.deltaY>0?1:-1);
  },{passive:false});
  /* Teclado do status-pill: Enter/Espaço e setas abrem; setas/Home/End percorrem
     o menu; Escape fecha e devolve o foco; Tab fecha sem prender o usuário. */
  document.addEventListener('keydown',ev=>{
    const toggle=ev.target.closest?.('[data-status-toggle]');
    if(toggle){
      if(['Enter',' '].includes(ev.key)){ev.preventDefault();openStatusDropdown(toggle.closest('[data-status-dropdown]'));return;}
      if(['ArrowDown','ArrowUp'].includes(ev.key)){ev.preventDefault();openStatusDropdown(toggle.closest('[data-status-dropdown]'),ev.key==='ArrowUp'?'last':'selected');return;}
    }
    const menuItem=ev.target.closest?.('.status-option,.status-details');
    if(menuItem){
      const root=menuItem.closest('[data-status-dropdown]'),items=[...root.querySelectorAll('.status-option:not(:disabled),.status-details:not(:disabled)')],index=items.indexOf(menuItem);
      if(ev.key==='Escape'){ev.preventDefault();closeStatusDropdown(true);return;}
      if(ev.key==='Tab'){closeStatusDropdown(false);return;}
      if(['ArrowDown','ArrowUp','Home','End'].includes(ev.key)){
        ev.preventDefault();
        const next=ev.key==='Home'?0:ev.key==='End'?items.length-1:ev.key==='ArrowDown'?(index+1)%items.length:(index-1+items.length)%items.length;
        items[next]?.focus();return;
      }
    }
    if(!['Enter',' '].includes(ev.key))return;
    const linha=ev.target.closest && ev.target.closest('tr[data-uf]');
    if(!linha || ev.target.closest('a,[data-action]'))return;
    ev.preventDefault();
    const uf=linha.dataset.uf,modo=linha.dataset.modo==='apagadas'?'apagadas':'ativas';
    const conjunto=modo==='apagadas'?expandDel:expand;
    if(conjunto.has(uf))conjunto.delete(uf);else conjunto.add(uf);
    renderRows(modo);
    const novo=document.querySelector(`tr[data-uf="${uf}"][data-modo="${modo}"]`);
    if(novo)novo.focus();
  });
  document.addEventListener('toggle',ev=>{const el=ev.target;if(el.matches?.('[data-description]')){if(el.open)expandedDescriptions.add(el.dataset.description);else expandedDescriptions.delete(el.dataset.description);}},true);
  window.addEventListener('resize',()=>closeStatusDropdown(false));
  document.addEventListener('scroll',()=>{if(statusDropdownOpen)positionStatusPopover(statusDropdownOpen);},true);
  const modalEl=$('#modal');
  if(modalEl){
    modalEl.addEventListener('close',()=>{modalDirty=false;const target=focusReturn?.id?document.getElementById(focusReturn.id):[...document.querySelectorAll('[data-action]')].find(el=>focusReturn?.dataset.action && Object.entries(focusReturn.dataset).every(([k,v])=>el.dataset[k]===v));target?.focus();});
    modalEl.addEventListener('cancel',ev=>{ev.preventDefault();closeModal();});
  }
  const modalCloseBtn=$('#modal-close');
  if(modalCloseBtn)modalCloseBtn.onclick=closeModal;
  window.addEventListener('hashchange',route);window.addEventListener('beforeunload',ev=>{if(modalDirty || busy || syncRun){ev.preventDefault();ev.returnValue='';}});
  (async()=>{try{await ProforStore.open();state=D.validateState(D.clone(await ProforStore.read()));$('#save-state').textContent=`Banco do workspace disponível · revisão ${state.revision}`;$('#save-state').dataset.state='ready';renderSideNav();route();runAutoSyncFromQuery();}catch(err){$('#save-state').textContent='Banco indisponível';$('#save-state').dataset.state='error';$('#main').innerHTML=`<h1>Não foi possível abrir o banco local</h1><div class="info error">${e(err.message)}</div><p>Abra INICIAR SISTEMA.cmd na pasta do workspace. Aguarde o OneDrive concluir a sincronização antes de usar esta máquina.</p>`;}})();
})();
