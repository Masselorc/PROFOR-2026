/* Interface local. Alterações são explícitas e gravadas em transação. */
(function(){
  'use strict';
  const D=Profor,e=D.esc,$=s=>document.querySelector(s);
  const isReadOnly=()=>Boolean(window.PROFOR_READ_ONLY);
  let state, selected=null, activeTab='dados',view='painel',busy=false,modalDirty=false,noticeTimer,focusReturn,syncRun=null,textosRun=null,statusDropdownOpen=null;
  const filters={search:'',uf:'',source:'',status:'',control:''};
  /* Busca local da aba do PAD: só estado da interface, por proposta. */
  let padSearch='',padSearchOwner=null;
  /* UFs com o resumo da proposta expandido no painel (estado só da interface). */
  const expand=new Set();
  /* O mesmo, para a tela de propostas apagadas. */
  const expandDel=new Set();
  /* Requisitos com a linha expandida (estado só da interface, por aba e id: `${g}:${id}`). */
  const expandedReqs=new Set();
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
  function proposalLink(id,value,context){const n=proposalNumber(value);return `<span class="proposal-number"><a href="#proposta/${textoHtml(id,context+': proposta')}/dados">${textoHtml(n,context+': número')}</a>${proposalCopyButton(n)}</span>`;}
  function link(r){return r.url?`<a href="${e(D.safeLink(r.url))}" target="_blank" rel="noopener noreferrer">${e(r.document || 'Documento')}</a>`:e(r.document || '—');}
  async function persist(next,opts={}){
    if(isReadOnly())throw new Error('Ambiente de consulta pública (somente leitura).');
    D.assert(!busy,'Aguarde a gravação em andamento.');busy=true;$('#save-state').textContent='Salvando…';
    try{state=await ProforStore.save(next,state.revision,opts);$('#save-state').textContent='Salvo na pasta do sistema · '+new Date().toLocaleTimeString('pt-BR');renderSideNav();}
    catch(err){$('#save-state').textContent='Não foi possível salvar';throw err;}
    finally{busy=false;}
  }
  async function change(fn){if(isReadOnly())return;const next=D.clone(state);const p=next.proposals.find(x=>x.id===selected);fn(p,next);await persist(next);render();}
  function closeModal(){if(busy)return; if(modalDirty && !confirm('Descartar as alterações ainda não salvas deste formulário?'))return;cancelSync('closed');$('#modal').close();modalDirty=false;}
  function modal(title,html){if(!$('#modal').open){const el=document.activeElement;focusReturn={id:el?.id,dataset:{...el?.dataset}};}$('#modal-title').textContent=title;$('#modal-content').innerHTML=html;modalDirty=false;if(!$('#modal').open)$('#modal').showModal();}
  function formError(err){const el=$('#form-error');if(el){el.textContent=err.message;el.focus();}else toast(err.message,true);}
  function formEnd(label='Salvar'){return `<p id="form-error" class="error-message" role="alert" tabindex="-1"></p><div class="dialog-actions">${button('Cancelar','close')}<button class="primary" type="submit">${label}</button></div>`;}
  function bindForm(handler){const form=$('#modal-content form');form.addEventListener('input',()=>modalDirty=true);form.addEventListener('submit',async event=>{event.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;try{await handler(new FormData(form));}catch(err){formError(err);}finally{submit.disabled=false;}});}
  function saved(message){modalDirty=false;$('#modal').close();toast(message);}
  /* `view` é a tela sem proposta selecionada: 'painel' ou 'apagadas'. */
  function route(){const from=document.activeElement?.getAttribute('href');const parts=location.hash.slice(1).split('/');const prevSelected=selected,prevTab=activeTab;selected=parts[0]==='proposta'?parts[1]:null;if(!selected)view=parts[0]==='apagadas'?'apagadas':'painel';
    /* Roteamento: 'analise' é a aba de Mérito; a chave antiga 'merito' continua
       roteável para não quebrar favoritos. A extinta aba 'habilitacao' cai em
       'dados', porque não existe mais como seção. */
    const aba=parts[2];
    activeTab=Object.hasOwn(tabNames,aba)?aba:'dados';
    if(activeTab==='merito')activeTab='analise';
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
    const menuImport=$('#import-open');
    if(menuImport)menuImport.hidden=publico;
    const menuBackup=$('#backup-open');
    if(menuBackup)menuBackup.hidden=publico;
    const menuDeleted=$('#nav-deleted');
    if(menuDeleted)menuDeleted.hidden=publico;
    const rotuloLocal=document.querySelector('.local-label');
    if(rotuloLocal && publico){
      rotuloLocal.textContent='● Consulta pública';
      rotuloLocal.classList.add('public-label');
    }
    $('#nav-panel').classList.toggle('active',!selected && view!=='apagadas');
    $('#nav-deleted').classList.toggle('active',!selected && view==='apagadas');
    if(selected){
      const p=state.proposals.find(x=>x.id===selected);
      if(!p){$('#main').innerHTML='<h1>Proposta não localizada</h1><a href="#painel">Voltar ao painel</a>';return;}
      if(p.isDeleted){$('#main').innerHTML=`<a class="back" href="#apagadas">← Voltar às propostas apagadas</a><h1>Proposta apagada</h1><div class="info warning">A proposta <span class="proposal-number"><strong>${e(proposalNumber(p.imported.numero))}</strong>${proposalCopyButton(p.imported.numero)}</span> (${e(p.imported.uf)}) está apagada do painel e fora das telas de gestão. Restaure-a para voltar a analisar.</div><div class="actions">${button('↺ Restaurar proposta','restore-proposal',`data-id="${e(p.id)}"`,'primary')}${button('Ver apagadas','ver-apagadas')}</div>`;return;}
      renderProposal(p);
    }
    else if(view==='apagadas')renderDeleted();
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
  /* Submenu do painel lateral: uma linha por proposta localizada, no padrão
     "UF - NNNNN/AAAA", em ordem alfabética de UF e de número. */
  function renderSideNav(){
    if(isReadOnly()){
      const saveStateEl=$('#save-state');
      if(saveStateEl){
        const dt=window.PROFOR_PUBLIC_UPDATED_AT ? new Date(window.PROFOR_PUBLIC_UPDATED_AT).toLocaleDateString('pt-BR') : '';
        saveStateEl.textContent=dt ? `Dados atualizados em ${dt}` : 'Base de dados pública';
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
      : '<p class="side-empty">Nenhuma proposta ativa no banco local. Use “Sincronizar com o Transferegov”, ou o atalho da Área de Trabalho para abrir o sistema com o servidor ligado.</p>';
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
  function renderPanel(){
    /* Só propostas ativas: as apagadas saem do painel e das demais telas de
       gestão e acompanhamento, e não entram na sincronização. */
    const ps=D.activeProposals(state),apagadas=D.deletedProposals(state);
    const received=new Set(ps.map(p=>p.imported.uf)).size;
    const pendingCount=ps.reduce((n,p)=>n+D.pending(p).length,0);
    const apt=ps.filter(p=>p.conclusion && !D.blockers(p,true).length).length;
    const enviadas=new Set(ps.filter(p=>D.sourceState(p.imported).key==='enviada').map(p=>p.imported.uf)).size;
    const acoesPainel=isReadOnly()
      ? button('⇩ Exportação','export')
      : `${button('⇩ Exportação','export')}${button('↻ Sincronizar com o Transferegov','sync','','primary')}`;
    const subPainel=isReadOnly()
      ? 'Consulta pública das propostas cadastradas e análises técnicas registradas.'
      : 'Acompanhe a análise, as diligências e a preparação para celebração.';
    const fontePainel=isReadOnly()
      ? 'Base de dados pública · Processo SEI 08016.010062/2026-18 · Edital nº 37/2026 · Recursos do FUNPEN'
      : `Última sincronização: ${state.sync?e(new Date(state.sync.at).toLocaleString('pt-BR')):'ainda não realizada'}${state.sync?.source?` · origem: ${e(String(state.sync.source))}`:''}. Dados locais são uma fotografia da extração e não comprovam recebimento ou situação atual no Transferegov.`;
    $('#main').innerHTML=`<div class="page-head"><div><div class="eyebrow">PROFOR / ONASP 2026</div><h1>Visão geral das propostas</h1><p class="muted">${subPainel}</p></div><div class="page-actions">${acoesPainel}</div></div>
      <div class="stats"><div class="stat"><strong>14</strong><span>UFs elegíveis</span></div><div class="stat"><strong>${received}<small> / 14</small></strong><span>UFs com proposta importada</span></div><div class="stat"><strong>${enviadas}</strong><span>UFs com envio para análise</span></div><div class="stat"><strong>${ps.length}</strong><span>Propostas ativas${apagadas.length?` · ${apagadas.length} apagada(s)`:''}</span></div><div class="stat"><strong>${apt}</strong><span>Aptas pelos controles locais</span></div></div>
      <section class="section"><div class="section-head"><h2>Acompanhamento por UF</h2><small>${ps.length} proposta(s) ativa(s)</small></div>
      <div class="filters"><label class="search">Buscar proposta ou proponente<input id="search" type="search" value="${e(filters.search)}" placeholder="Número, nome ou UF"></label><label>UF<select id="filter-uf">${options({'':'Todas as UFs',...D.UFS},filters.uf)}</select></label><label>Status no Transferegov<select id="filter-source">${options({'':'Todos os status',...Object.fromEntries(SOURCE_CHAVES.map(k=>[k,SOURCE_ROTULO[k]]))},filters.source)}</select></label><label>Status<select id="filter-status">${options(Object.fromEntries(['','Sem proposta importada',...STATUS_PROPOSTA].map(x=>[x,x || 'Todos os status'])),filters.status)}</select></label><label>Controle<select id="filter-control">${options({'':'Todos os controles',financial:'Inconsistência financeira',unlinked:'Diligência sem registro',ouvidoria:'Ouvidoria pendente',merito:'Mérito pendente',proposta:'Requisitos da Proposta pendentes',formalizacao:'Requisitos para Formalização pendentes'},filters.control)}</select></label></div>
      <div class="table-wrap"><table class="table-fit"><colgroup><col class="c-expand"><col class="c-uf"><col class="c-proposta"><col class="c-valor"><col class="c-ctrl"><col class="c-dilig"><col class="c-ctrl"><col class="c-status"><col class="c-detalhar"></colgroup><thead><tr><th class="cell-center c-expand-th" scope="col"><span class="sr-only">Expandir linha</span></th><th class="cell-center">Unidade Federativa</th><th class="cell-center">Proposta</th><th class="cell-center">Valor global</th><th class="cell-center">Mérito</th><th class="cell-center">Diligências</th><th class="cell-center" title="Requisitos da Proposta + Requisitos para Formalização">Celebração</th><th class="cell-center">Status</th><th class="cell-center c-detalhar-th" scope="col"><span class="sr-only">Ações</span></th></tr></thead><tbody id="uf-rows"></tbody></table></div></section>
      ${!ps.length?'<div class="info"><strong>Seu painel está pronto para receber as propostas.</strong><br>Use “Sincronizar com o Transferegov” para baixar automaticamente as extrações oficiais; o modo offline de anexar arquivos CSV fica como contingência. Nenhuma proposta foi presumida ou criada neste banco.</div>':''}
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
    if(['Apta à celebração','Em análise'].includes(sit))return 'tom-ok';
    if(['Em diligência','Em elaboração na origem','Requer nova análise','Formalização com cláusula suspensiva'].includes(sit))return 'tom-aviso';
    if(['Apagada do painel'].includes(sit))return 'tom-no';
    return 'tom-neutro';
  }
  /* Célula da UF: bandeira, sigla e nome em disposição horizontal e centralizada.
     Com mais de uma proposta na UF, a contagem de propostas é indicada no badge.
     O botão de expansão (.row-expand) fica em coluna dedicada (coluna 0). */
  function ufCell(uf,name,ps,modo='ativas'){
    texto(uf,'Célula da UF: código');texto(name,'Célula da UF: nome');texto(modo,'Célula da UF: modo');
    const flag=ufFlag(uf,name);
    const multi=ps.length>1?`<span class="cell-sub uf-multi">(${ps.length})</span>`:'';
    return `<div class="uf">${flag}<span class="uf-pill uf-code">${textoHtml(uf,'Célula da UF: código')}</span><span class="uf-nome uf-name">${textoHtml(name,'Célula da UF: nome')}</span>${multi}</div>`;
  }
  /* Resumo da linha expandida. Sem proposta, não inventa dado nenhum. */
  function rowSummary(uf,name,ps,modo='ativas',sit=''){
    texto(uf,'Resumo da UF: código');texto(name,'Resumo da UF: nome');texto(modo,'Resumo da UF: modo');
    const apagadas=modo==='apagadas';
    if(!ps.length)return `<div class="expansion-wrap"><div class="expansion-header"><div class="expansion-header-info"><span class="expansion-eyebrow">Resumo Executivo da UF</span><h3 class="expansion-title"><span class="uf-cell">${ufFlag(uf,name)}<span class="uf-code">${textoHtml(uf,'UF')}</span></span> ${textoHtml(name,'Resumo da UF: nome')}</h3></div><div class="expansion-badges">${sitBadge(sit||'Sem proposta importada')}</div></div><div class="row-card"><p class="muted"><strong>${textoHtml(name,'Resumo da UF: nome')} (${textoHtml(uf,'Resumo da UF: código')})</strong> não tem proposta vinculada ao programa ${textoHtml(D.PROGRAM,'Resumo da UF: programa')} na última extração. A ausência na extração não exclui uma proposta local já cadastrada.</p><p class="source">Use “Sincronizar com o Transferegov” para atualizar. O banco desta origem é separado do banco do arquivo HTML.</p></div></div>`;
    const cards=ps.map(p=>{
      const i=p.imported,f=D.finance(p),s=D.sourceState(i),pSit=D.situation(p);
      const faltam=['Repasse','Contrapartida','Valor global'].filter((_,n)=>[i.repasse,i.contrapartida,i.global][n]===null);
      const avisos=[];
      if(faltam.length)avisos.push(`${faltam.join(', ')} sem valor na extração`);
      if(!f.composition && f.complete)avisos.push('repasse + contrapartida difere do valor global');
      if(!f.padComplete)avisos.push(i.pad===null?'PAD não carregado: a última sincronização foi a rápida, sem o arquivo do plano de aplicação':'sem itens de PAD publicados na extração oficial para esta proposta');
      else if(!f.pad)avisos.push('somatório do PAD difere do valor global');
      if(f.errors.length)avisos.push(`${f.errors.length} item(ns) com valor unitário incompatível com total ÷ quantidade`);
      const pend=D.pending(p).length, dilig=p.diligences.filter(d=>d.status!=='saneada').length;
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
          <div><dt>Itens do PAD</dt><dd>${(i.pad||[]).length?`${i.pad.length} item(ns)${f.pad?' — soma confere com o global':' — soma difere do global'}`:(i.pad===null?'PAD não carregado — sincronize sem a opção rápida':'nenhum item publicado na extração oficial')}</dd></div>
          <div><dt>Vigência na origem</dt><dd>${i.vigenciaInicio||i.vigenciaFim?`${textoHtml(D.fmtDate(i.vigenciaInicio),'Resumo: início da vigência')} a ${textoHtml(D.fmtDate(i.vigenciaFim),'Resumo: fim da vigência')}`:'não informada na extração'}</dd></div>
          <div><dt>Controles</dt><dd>Mérito ${D.groupProgress(p,'merito').done}/${D.groupProgress(p,'merito').total} · Requisitos da Proposta ${D.groupProgress(p,'proposta').done}/${D.groupProgress(p,'proposta').total} · Requisitos para Formalização ${D.groupProgress(p,'formalizacao').done}/${D.groupProgress(p,'formalizacao').total}</dd></div>
          <div><dt>Diligências</dt><dd>${dilig} não saneada(s)${pend?` · <strong>${pend} marcação(ões) sem registro</strong>`:''}</dd></div>
        </dl>
        ${apagadas?'<p class="source">Fora das telas de gestão e das sincronizações. Use “Restaurar proposta” para devolvê-la ao painel.</p>':''}
        ${avisos.length?`<p class="source warn-text">A conferir: ${textoHtml(avisos.join(' · '),'Resumo: avisos')}.</p>`:''}
        ${i.objeto?`<div class="row-objeto"><span class="cell-sub">Objeto</span><div class="row-objeto-text">${textoHtml(i.objeto,'Resumo: objeto')}</div></div>`:'<p class="source">Objeto não informado nesta extração.</p>'}
      </div>`;
    }).join('');
    const rodape=apagadas
      ? 'Propostas apagadas ficam guardadas no banco: não somem da base, apenas saem das telas de gestão e das sincronizações até serem restauradas.'
      : (isReadOnly() ? 'Resumo informativo gerado a partir da base oficial do PROFOR / ONASP 2026.' : 'Resumo informativo gerado a partir da extração. Apagar uma proposta a retira do painel e das demais telas de gestão, sem removê-la do banco.');
    return `<div class="expansion-wrap"><div class="expansion-header"><div class="expansion-header-info"><span class="expansion-eyebrow">Resumo Executivo da UF</span><h3 class="expansion-title"><span class="uf-cell">${ufFlag(uf,name)}<span class="uf-code">${textoHtml(uf,'UF')}</span></span> ${textoHtml(name,'Resumo da UF: nome')}</h3></div><div class="expansion-badges">${ps.length>1?`<span class="head-badge">${ps.length} proposta(s)</span>`:''}${sitBadge(sit)}</div></div>${cards}<p class="source">${rodape}</p></div>`;
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
  const STATUS_PROPOSTA=['Em elaboração na origem','Em análise','Em diligência','Requer nova análise','Apta à celebração','Pendente de celebração','Formalização com cláusula suspensiva'];
  const SIT_CLASSES={'Apta à celebração':'good','Em análise':'good','Em diligência':'warn','Em elaboração na origem':'warn','Requer nova análise':'warn','Formalização com cláusula suspensiva':'warn','Pendente de celebração':'','Sem proposta importada':'','Apagada do painel':'bad'};
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
    const abertas=p?p.diligences.filter(d=>d.status!=='saneada').length:0;
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
    let html='';
    for(const [uf,lista] of ufs){
      if(filters.uf && filters.uf!==uf)continue;
      const name=nomeUf(uf);
      /* Status Proposta (e o filtro homônimo): proposta de referência da UF —
         a primeira da ordem de envio. O filtro de origem usa a mesma linha. */
      const primeiro=lista[0]||null;
      const sit=lista.length?ufSituation(lista,modo):'Sem proposta importada';
      if(filters.status && filters.status!==sit)continue;
      if(filters.source){if(!primeiro || D.sourceState(primeiro.imported).key!==filters.source)continue;}
      if(filters.search && !`${uf} ${name} ${lista.map(p=>proposalNumber(p.imported.numero)+' '+p.imported.proponente).join(' ')}`.toLocaleLowerCase('pt-BR').includes(filters.search.toLocaleLowerCase('pt-BR')))continue;
      if(filters.control){if(!primeiro)continue;const c=filters.control;const ok=lista.some(p=>{if(c==='financial')return !D.finance(p).ok;if(c==='unlinked')return D.pending(p).length>0;if(c==='ouvidoria')return p.ouvidoria.status==='pendente';if(['merito','proposta','formalizacao'].includes(c)){const r=D.groupProgress(p,c);return r.done!==r.total;}return true;});if(!ok)continue;}
      const aberto=abertoSet.has(uf);
      const celulas=celulasDaLinha(modo,uf,name,lista,sit,aberto);
      html+=`<tr class="uf-row${aberto?' open row-is-expanded':''}${modo==='apagadas'?' uf-row-deleted':''}" data-uf="${textoHtml(uf,'Linha: UF')}" data-modo="${textoHtml(modo,'Linha: modo')}" tabindex="0" aria-expanded="${aberto?'true':'false'}" title="Clique para ${aberto?'recolher':'ver as propostas desta UF'}">${celulas}</tr>`;
      if(aberto)html+=`<tr class="uf-summary row-summary-detail" id="summary-${textoHtml(uf,'UF')}"><td colspan="${colunas.length}">${rowSummary(uf,name,lista,modo,sit)}</td></tr>`;
    }
    const alvo=modo==='apagadas'?$('#del-rows'):$('#uf-rows');
    if(alvo){
      /* Guarda de estrutura: o molde e o cabeçalho vêm de fontes diferentes
         (esta lista e o HTML da tela). Se alguém mexer só em um dos dois, a
         conferência denuncia na hora em vez de entortar a tabela na tela. */
      const tabela=alvo.closest('table');
      const colunasCabecalho=tabela?tabela.querySelectorAll('thead th').length:0;
      D.assert(!colunasCabecalho || colunasCabecalho===colunas.length,`Tabela do modo ${modo}: ${colunas.length} célula(s) por linha para ${colunasCabecalho} coluna(s) no cabeçalho.`);
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
    const i=p.imported, sit=D.situation(p), f=D.finance(p);
    const mProg=D.groupProgress(p,'merito'), pProg=D.groupProgress(p,'proposta'), fProg=D.groupProgress(p,'formalizacao');
    const totalDone=mProg.done+pProg.done+fProg.done;
    const totalReqs=mProg.total+pProg.total+fProg.total;
    const pct=totalReqs>0?Math.round((totalDone/totalReqs)*100):0;
    const abertas=p.diligences.filter(d=>d.status!=='saneada').length;
    const semReg=D.pending(p).length;
    const allPass=sit==='Apta à celebração';
    const isWarn=['Em diligência','Requer nova análise','Formalização com cláusula suspensiva','Pendente de celebração','Em elaboração na origem'].includes(sit);
    const pillTom=allPass?'status-pass':sit==='Em análise'?'status-pass':isWarn?'status-fail':'status-neutral';

    const iconPass=`<svg class="status-icon-svg" viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`;
    const iconFail=`<svg class="status-icon-svg" viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`;
    const iconInfo=`<svg class="status-icon-svg" viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`;
    const statusSvg=allPass||sit==='Em análise'?iconPass:isWarn?iconFail:iconInfo;

    const padOk=f.padComplete && f.pad;
    const meritoOk=mProg.done===mProg.total;
    const propOk=pProg.done===pProg.total;
    const formOk=fProg.done===fProg.total;
    const diligOk=abertas===0 && semReg===0;

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
                  <span>${meritoOk?'Todos os 10 itens de mérito aprovados em conformidade':`${mProg.done} de ${mProg.total} itens analisados/em conformidade`}</span>
                </div>
              </li>
              <li class="criteria-item ${padOk?'crit-pass':'crit-warn'}">
                <span class="crit-icon">${padOk?'✓':'!'}</span>
                <div class="crit-info">
                  <strong>2. Plano de Aplicação Detalhado (PAD)</strong>
                  <span>${!f.padComplete?(i.pad===null?'Arquivo do PAD não carregado nesta base':'Sem itens de PAD publicados na extração oficial'):f.pad?`Soma do PAD (${textoHtml(D.fmtMoney(f.sum),'Painel: soma PAD')}) confere com o valor global`:`Soma do PAD (${textoHtml(D.fmtMoney(f.sum),'Painel: soma PAD')}) diverge do global (${textoHtml(D.fmtMoney(i.global),'Painel: global')})`}</span>
                </div>
              </li>
              <li class="criteria-item ${propOk?'crit-pass':'crit-warn'}">
                <span class="crit-icon">${propOk?'✓':'!'}</span>
                <div class="crit-info">
                  <strong>3. Requisitos da Proposta (Celebração)</strong>
                  <span>${propOk?'Todos os 7 requisitos da proposta atendidos (NT nº 231 / Parecer nº 15)':`${pProg.done} de ${pProg.total} requisitos da proposta atendidos`}</span>
                </div>
              </li>
              <li class="criteria-item ${formOk?'crit-pass':'crit-warn'}">
                <span class="crit-icon">${formOk?'✓':'!'}</span>
                <div class="crit-info">
                  <strong>4. Requisitos para Formalização (Celebração)</strong>
                  <span>${formOk?'Todos os 13 requisitos de formalização conferidos e atendidos':`${fProg.done} de ${fProg.total} requisitos de formalização atendidos`}</span>
                </div>
              </li>
              <li class="criteria-item ${diligOk?'crit-pass':'crit-warn'}">
                <span class="crit-icon">${diligOk?'✓':'!'}</span>
                <div class="crit-info">
                  <strong>5. Diligências e Condições Especiais</strong>
                  <span>${diligOk?'Nenhuma pendência ou diligência não saneada':`${abertas} diligência(s) aberta(s)${semReg?` · ${semReg} marcação(ões) sem registro`:''}`}</span>
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
              <span>Aproveitamento Global dos Requisitos</span>
              <strong id="gauge-score-val">${totalDone} / ${totalReqs} requisitos (${pct}%)</strong>
            </div>
            <div class="gauge-track">
              <div id="final-score-fill" class="gauge-fill ${pct===100?'gauge-fill-pass':'gauge-fill-fail'}" style="width:${pct}%;"></div>
              <div class="gauge-marker gauge-marker-100 ${pct===100?'marker-pass':(pct>0?'marker-warn':'marker-zero')}" style="left:${pct}%;" title="Aproveitamento atual: ${pct}% completo (${totalDone} de ${totalReqs} requisitos)">
                <div class="marker-line"></div>
                <span class="marker-label" style="transform:translateX(-${pct}%);">${pct}% completo</span>
              </div>
            </div>
            <div class="gauge-footer">
              <span>0%</span>
              <span class="gauge-target">Meta para celebração: 100% de conformidade</span>
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
      ${renderResultSection(p)}
      ${D.pending(p).length?`<div class="info error">${D.pending(p).length} pendência(s) marcada(s) como diligência sem registro ativo. ${isReadOnly()?'':'<a href="#proposta/'+e(p.id)+'/diligencias">Cadastrar diligência</a>'}</div>`:''}
      <nav class="tabs dim-tabs" aria-label="Seções da proposta">${Object.entries(tabNames).filter(([id])=>id!=='merito').map(([id,name])=>`<a class="${id===activeTab?'active':''}" ${id===activeTab?'aria-current="page"':''} href="#proposta/${e(p.id)}/${id}">${name}</a>`).join('')}</nav><div id="tab-content"></div>`;
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
                <span class="proposal-number">${e(proposalNumber(i.numero))}</span>
                ${proposalCopyButton(i.numero)}
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
    const aceitos=itens.filter(x=>['ok','obs'].includes(D.reviewOf(p,g,x.id).status)).length;
    $('#tab-content').innerHTML=`<section class="section"><div class="section-head"><h2>${textoHtml(aba.titulo,'Aba de celebração: título')}</h2><span class="source">${aceitos} de ${itens.length} requisito(s) atendido(s)</span></div>
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
        <td class="req-fund">${textoHtml(x.fundamentacao,'Requisito: fundamentação')}</td>
        <td class="req-comp">${textoHtml(x.comprovacao,'Requisito: comprovação')}</td>
        <td class="cell-center">${reviewBadge(r)}</td>
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
      return `<span class="status-pill tom-${e(visualAtual.tom)}" style="cursor:default;user-select:none" title="${e(rotuloAtual)}">${statusIcon(visualAtual.icone)}<span class="status-pill-label">${e(rotuloAtual)}</span></span>`;
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
    if(valor===antes)return;
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
    const {group,id}=root.dataset;
    closeStatusDropdown(false);
    trigger.disabled=true;root.classList.add('disabled');trigger.setAttribute('aria-busy','true');
    try{await selecionarAnalise(group,id,valor);}
    finally{if(trigger.isConnected){trigger.disabled=false;root.classList.remove('disabled');trigger.removeAttribute('aria-busy');}}
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
  function renderReviews(p,g,opts={}){
    const pad=g==='pad',merito=g==='merito',f=D.finance(p),ps=pad?D.padSituacao(p,state.sync):null;
    if(pad && padSearchOwner!==p.id){padSearch='';padSearchOwner=p.id;}
    const padItems=pad?(p.imported.pad || []):[];
    const busca=padSearch.trim().toLocaleLowerCase('pt-BR');
    const linhasPad=padItems.filter(item=>!busca || `${item.descricao}`.toLocaleLowerCase('pt-BR').includes(busca));
    const somaVisivel=linhasPad.reduce((a,x)=>a+x.total,0);
    const diffCents=Number.isSafeInteger(f.sum) && Number.isSafeInteger(p.imported.global)?f.sum-p.imported.global:null;
    const cobertura=(Number.isSafeInteger(f.sum) && Number.isSafeInteger(p.imported.global) && p.imported.global>0)?Math.min(1,f.sum/p.imported.global):null;
    const semItens=pad
      ? `<tr><td colspan="6" class="empty">${linhasPad.length?'':`Nenhum item do PAD para conferir nesta proposta${busca?' para esta busca':ps.key==='nao-carregado'?' — o arquivo não foi carregado nesta base.':' — o plano de aplicação detalhado ainda não consta dos dados abertos do Transferegov.'}`}</td></tr>`
      : `<tr><td colspan="${merito?3:4}" class="empty">Nenhum item nesta lista para esta proposta.</td></tr>`;
    const cartoesPad=pad?`<div class="section-body pad-cards">
        <div class="pad-totals">
          <div class="pad-total"><span class="pad-total-label">Soma do PAD</span><strong>${D.fmtMoney(f.sum)}</strong><span class="pad-total-sub">${padItems.length} ${padItems.length===1?'item previsto':'itens previstos'}</span></div>
          <div class="pad-total"><span class="pad-total-label">Valor global</span><strong>${D.fmtMoney(p.imported.global)}</strong><span class="pad-total-sub">extração oficial</span></div>
          <div class="pad-total"><span class="pad-total-label">Diferença</span><strong class="${diffCents===null?'':diffCents===0?'pad-diff-ok':'pad-diff-bad'}">${diffCents===null?'Não calculável':(diffCents===0?'R$ 0,00':D.fmtMoney(diffCents))}</strong><span class="pad-total-sub">${diffCents===null?'valores ausentes na extração':diffCents===0?'soma confere com o global':'soma diverge do global'}</span></div>
        </div>
        ${cobertura===null||cobertura>=1?'':`<div class="pad-cover" role="img" aria-label="Cobertura do PAD sobre o valor global: ${pctBR(cobertura)}"><div class="pad-cover-bar" style="width:${(cobertura*100).toFixed(1)}%"></div></div>`}
        ${ps.key==='com-itens'?'':`<div class="info warning"><strong>${textoHtml(ps.titulo,'PAD: situação')}.</strong> ${textoHtml(ps.detalhe,'PAD: motivo')}</div>`}
        ${padItems.length>1?`<div class="filters pad-filter"><label class="search">Buscar item do PAD<input id="pad-search" type="search" value="${e(padSearch)}" placeholder="Descrição do item" autocomplete="off"></label></div>`:''}
      </div>`:'';
    const rodapePad=pad&&padItems.length?`<tfoot><tr><td><strong>Total (${busca?`${linhasPad.length} de ${padItems.length} itens`:padItems.length===1?'1 item':`${padItems.length} itens`})</strong></td><td></td><td></td><td class="number cell-right"><strong>${D.fmtMoney(somaVisivel)}</strong></td><td></td><td></td></tr></tfoot>`:'';
    const html=`<section class="section"><div class="section-head"><h2>${tabNames[g]}</h2>${(merito && !isReadOnly())?button('Editar informações','institution'):''}</div>
      ${merito&&avisoInstitucional(p)?`<div class="section-body">${avisoInstitucional(p)}</div>`:''}
      ${cartoesPad}
      <div class="table-wrap"><table class="${pad?'pad-table':'review-table'}"><colgroup>${pad?'<col class="c-pad-item"><col class="c-pad-qtd"><col class="c-pad-unit"><col class="c-pad-total"><col class="c-pad-conf"><col class="c-pad-acao">':''}</colgroup><thead><tr><th scope="col">${pad?'Item':'Requisito'}</th>${pad?'<th scope="col" class="cell-right pad-case">Qtd</th><th scope="col" class="cell-right pad-case">Valor unitário</th><th scope="col" class="cell-right pad-case">Valor total</th>':''}<th scope="col" class="${pad?'pad-th-conf':''}">${pad?'Conferência':'Resultado'}</th>${!pad&&!merito?'<th scope="col">Documento</th>':''}<th scope="col" class="cell-center pad-th-action">Ação</th></tr></thead><tbody>${pad
        ? linhasPad.map(item=>{const [id,label]=[item.id,item.descricao];const r=D.reviewOf(p,g,id);const divergente=!D.unitMatchesTotal(item);const parte=f.sum>0?item.total/f.sum:null;return `<tr data-pad-item="${e(id)}"><td class="pad-desc"><span class="pad-desc-text" title="${e(label)}">${e(label)}</span></td><td class="number cell-right">${e(fmtQty(item.quantidade))}</td><td class="number cell-right">${D.fmtMoney(item.unitario)}${divergente?badge('Divergente','bad'):''}</td><td class="number cell-right">${D.fmtMoney(item.total)}${parte===null?'':`<span class="cell-sub pad-share"><span class="pad-share-bar" style="--w:${(parte*100).toFixed(1)}%"></span>${e(pctBR(parte))}</span>`}</td><td class="pad-conf">${reviewBadge(r)}</td><td class="cell-center pad-actions"><div class="review-actions">${acaoDeAnalise(p,g,id,r)}${!isReadOnly() && D.pending(p).some(pending=>pending.ref===g+':'+id)?button('Criar diligência','diligence',`data-ref="${e(g+':'+id)}"`):''}</div></td></tr>`;}).join('') || semItens
        : D.rows(p,g).map(([id,label])=>{const r=D.reviewOf(p,g,id);const opcao=opcaoAtual(g,id,r.status),custom=merito&&!!OPCOES_DA_ACAO[id];const ausente=id==='ouvidoriaInstituida' && r.status==='no';const resultado=(custom && opcao)?badge(opcao.rotulo,tomDoResultado(opcao.tom)):reviewBadge(r);const titulo=(merito && !isReadOnly())?`<button type="button" class="review-open" data-action="review" data-group="${e(g)}" data-id="${e(id)}" title="Abrir o detalhe do item: observação, documento, diligência e histórico">${e(label)}</button>`:e(label);return `<tr><td class="review-title">${titulo}${textosInlineHtml(p,id)}${r.note?`<div class="review-note">${e(r.note)}</div>`:''}${ausente?`<div class="info warning review-alert">A instituição da Ouvidoria Específica de Serviços Penais será cláusula suspensiva do Convênio.</div>`:''}</td><td>${resultado}</td>${merito?'':`<td>${link(r)}</td>`}<td class="${merito?'cell-center':''}"><div class="review-actions">${acaoDeAnalise(p,g,id,r)}${!isReadOnly() && D.pending(p).some(pending=>pending.ref===g+':'+id)?button('Criar diligência','diligence',`data-ref="${e(g+':'+id)}"`):''}</div></td></tr>`;}).join('') || semItens}</tbody>${rodapePad}</table></div></section>`;
    if(opts.secao)return html;
    $('#tab-content').innerHTML=html;
    if(pad){
      const buscaEl=$('#pad-search');
      if(buscaEl){
        buscaEl.addEventListener('input',ev=>{padSearch=ev.target.value;renderReviews(p,g);const again=$('#pad-search');if(again){again.focus();again.setSelectionRange(again.value.length,again.value.length);}});
        buscaEl.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&ev.target.value){ev.preventDefault();padSearch='';renderReviews(p,g);const again=$('#pad-search');if(again)again.focus();}});
      }
    }
  }
  function editReview(group,id,initialStatus=''){
    const p=current(),r=D.reviewOf(p,group,id),label=D.rows(p,group).find(x=>x[0]===id)[1];
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
  function editInstitution(){const p=current(),o=p.ouvidoria;modal('Ouvidoria e Fala.BR',`<form class="form-stack"><label>Instituição da Ouvidoria<select name="status">${options({na:'Não informada',instituida:'Instituída',pendente:'Pendente de instituição'},o.status)}</select></label><label class="checkline"><input name="clause" type="checkbox" ${o.clause?'checked':''}>Confirmei a aplicabilidade da cláusula suspensiva no instrumento.</label><label>Data da assinatura<input name="signature" type="date" value="${e(o.signature)}"></label><label>Link do ato normativo (opcional)<input name="url" type="url" value="${e(o.url)}"></label><label>Adesão ao Fala.BR<select name="falaBR">${options({na:'Não informada',aderido:'Já aderido',previsto:'Prevista no Plano de Trabalho',nao_previsto:'Não prevista no Plano de Trabalho'},p.falaBR)}</select></label><label>Observação<textarea name="note">${e(o.note)}</textarea></label>${formEnd()}</form>`);bindForm(async fd=>{const name=actor(),data=Object.fromEntries(fd);D.dateISO(data.signature);D.safeLink(data.url);await change(p=>{const before={ouvidoria:p.ouvidoria,falaBR:p.falaBR};p.ouvidoria={status:data.status,signature:data.signature,url:data.url,note:data.note,clause:fd.has('clause') && data.status==='pendente'};p.falaBR=data.falaBR;D.log(p,'Informações institucionais atualizadas',before,{ouvidoria:p.ouvidoria,falaBR:p.falaBR},name);});saved('Informações institucionais salvas.');});}
  function renderDiligences(p){
    const unlinked=D.pending(p);
    const unlinkedItems=unlinked.map(r=>`<div class="info warning">${e(r.tab+' → '+r.label)} ${isReadOnly()?'':button('Criar diligência','diligence',`data-ref="${e(r.ref)}"`)}</div>`).join('') || '<p class="muted">Nenhuma marcação sem registro ativo.</p>';
    const novaBtn=isReadOnly()?'':button('Nova diligência','diligence','','primary');
    $('#tab-content').innerHTML=`<section class="section"><div class="section-head"><h2>Pendências sem diligência cadastrada: ${unlinked.length}</h2></div><div class="section-body">${unlinkedItems}</div></section><section class="section"><div class="section-head"><h2>Diligências registradas</h2>${novaBtn}</div><div class="table-wrap"><table><thead><tr><th>Categoria / providência</th><th>Vencimento</th><th>Situação</th><th>Ação</th></tr></thead><tbody>${p.diligences.map((d,n)=>`<tr><td><strong>${n+1}. ${e(d.category)}</strong><div class="review-note">${e(d.request)}</div><span class="source">${e(D.referenceRows(p).find(r=>r.ref===d.ref)?.label || d.ref || 'Sem vínculo')}</span></td><td>${D.fmtDate(d.due)}</td><td>${badge(D.diligenceLabel(d),d.status==='saneada'?'good':'warn')}</td><td>${isReadOnly()?'<span class="muted">—</span>':button('Editar','diligence',`data-id="${e(d.id)}"`)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Nenhuma diligência cadastrada.</td></tr>'}</tbody></table></div></section>`;
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
  function conclusion(){const p=current(),blocks=D.blockers(p);modal('Conclusão da análise técnica',`<p>A conclusão será registrada em nome do analista. Os requisitos de celebração continuam sendo acompanhados em sua própria aba.</p>${blocks.length?`<div class="info error"><strong>Há pendências para concluir:</strong><ul>${blocks.map(x=>`<li>${e(x)}</li>`).join('')}</ul></div><div class="dialog-actions">${button('Voltar à análise','close')}</div>`:`<div class="info">Mérito, PAD e diligências passaram pelos controles operacionais.</div><div class="dialog-actions">${button('Cancelar','close')}${button('Registrar conclusão técnica','confirm-conclusion','','primary')}</div>`}`);}
  /* Sincronização automática: a interface apenas chama o servidor local e grava o resultado no banco. */
  const SYNC_PATH='/api/sync',SYNC_TIMEOUT_MS=12*60*1000;
  const SYNC_SERVER_HELP=location.protocol==='file:'
    ?'Esta página foi aberta diretamente do arquivo (file://), e nesse modo o navegador não pode baixar as extrações do Transferegov; nada foi gravado no banco local. Abra o sistema pelo atalho da Área de Trabalho ou pelo arquivo “INICIAR SISTEMA.cmd”, na pasta do sistema, para ligar o servidor e abrir a sincronização.'
    :'Não foi possível falar com o servidor local; nada foi gravado no banco local. Abra o sistema pelo atalho “PROFOR 2026” na Área de Trabalho ou pelo arquivo “INICIAR SISTEMA.cmd”, na pasta do sistema. Alternativa manual: execute “node server.cjs” na pasta do sistema e use http://127.0.0.1:8766/PROFOR_2026.html.';
  function syncClock(ms){const s=Math.max(0,Math.floor(ms/1000));return s<60?`${s} s`:`${Math.floor(s/60)} min ${String(s%60).padStart(2,'0')} s`;}
  function syncBytes(n){return n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;}
  function syncFailure(kind,message){const err=new Error(message);err.syncKind=kind;return err;}
  function syncLabel(source,pad,note=''){
    const files=Array.isArray(source?.files)?source.files.length:Array.isArray(source?.blobs)?source.blobs.length:0;
    return `${source?.url || 'https://api-publica.transferegov.gestao.gov.br/downloads'} · ${pad?'sincronização completa (com PAD)':'sincronização rápida (sem PAD)'}${files?` · ${files} arquivo(s)`:''}${note?` · ${note}`:''}`;
  }
  function syncStep(text){const el=$('#sync-step');if(el)el.textContent=text;}
  function syncActions(mode){
    const el=$('#sync-actions');if(!el)return;
    if(mode==='running')el.innerHTML=button('Cancelar sincronização','sync-cancel','','danger');
    else if(mode==='saving')el.innerHTML='<button type="button" class="danger" disabled>Gravando no banco local…</button>';
    else el.innerHTML=`${button('Tentar novamente (completa)','sync-retry','','primary')}${button('Sincronização rápida (sem PAD)','sync-fast')}${button('Modo offline: anexar arquivos CSV','import')}${button('Fechar','close')}`;
  }
  function syncFail(message,kind='error'){
    const el=$('#form-error');
    if(el){el.className=kind==='error'?'error-message':'source';el.textContent=message;el.focus();}
    syncStep(kind==='error'?'Não foi possível concluir a sincronização.':'Sincronização interrompida.');
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
  function syncStopTimers(run){clearInterval(run.timer);clearTimeout(run.timeout);if(syncRun===run)syncRun=null;}
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
  function syncChangesHtml(changes){return `<div class="table-wrap"><table><thead><tr><th>Proposta</th><th>UF</th><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead><tbody>${changes.map(c=>`<tr><td><span class="proposal-number">${e(proposalNumber(c.numero))}${proposalCopyButton(c.numero)}</span></td><td>${ufTag(c.uf) || '<span class="muted">—</span>'}</td><td>${e(c.field)}</td><td>${e(c.field==='pad'?`${c.before?.length || 0} itens`:JSON.stringify(c.before))}</td><td>${e(c.field==='pad'?`${c.after?.length || 0} itens`:JSON.stringify(c.after))}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Nenhuma alteração de campo.</td></tr>'}</tbody></table></div>`;}
  function syncDialogHtml(){
    return `<p>Programa <strong>${D.PROGRAM}</strong>. Esta janela dispara a sincronização automática: o servidor local baixa, descompacta e cruza as extrações oficiais do <a href="https://api-publica.transferegov.gestao.gov.br/downloads" target="_blank" rel="noopener noreferrer">portal de dados</a>. Nenhum arquivo precisa ser anexado.</p>
      <div class="info"><p id="sync-step" role="status" aria-live="polite">Preparando a sincronização…</p><p class="source"><span id="sync-elapsed">0 s</span> · <span id="sync-received">aguardando o servidor concluir o download e o cruzamento</span></p></div>
      <p class="source">A sincronização completa inclui o PAD (plano de aplicação detalhado) e pode levar de dezenas de segundos a alguns minutos. A sincronização rápida, sem o PAD, é mais leve e preserva o plano de aplicação já registrado.</p>
      <p id="form-error" class="error-message" role="alert" tabindex="-1"></p>
      <div class="dialog-actions" id="sync-actions"></div>
      <hr>
      <p class="source"><strong>Textos oficiais da proposta</strong> — justificativa, público-alvo, problema a resolver, resultados esperados, relação com os objetivos e capacidade técnica. Vêm do arquivo público <code>siconv_justificativas_proposta.zip</code> (716 MB) e não fazem parte da sincronização: a busca é feita uma vez e fica guardada no banco.</p>
      <div class="dialog-actions">${button('Buscar textos das propostas','textos')}</div>`;
  }
  /* ---------- Textos oficiais da proposta (busca sob demanda) ---------- */
  const TEXTOS_PATH='/api/sync/textos',TEXTOS_TIMEOUT_MS=40*60*1000;
  /* Cada item de análise mostra o trecho que o ente federativo registrou na
     origem, transcrito sem edição. Item sem texto correspondente não inventa
     conteúdo: aponta a consulta pública. */
  const TEXTOS_DO_ITEM={justificativa:['caracterizacao','justificativa'],publicoAlvo:['publicoAlvo'],problema:['problema'],resultados:['resultados'],objetivos:['relacao'],capacidade:['capacidade']};
  const consultaPublica=id=>`https://discricionarias.transferegov.sistema.gov.br/voluntarias/ConsultarProposta/ResultadoDaConsultaDePropostaDetalharProposta.do?idProposta=${encodeURIComponent(id)}&destino=&idConvenio=`;
  function textosOficiaisHtml(p,id){
    const campos=TEXTOS_DO_ITEM[id] || [];
    if(!campos.length)return '';
    const link=`<a href="${e(consultaPublica(p.imported.id))}" target="_blank" rel="noopener noreferrer">abrir a consulta pública desta proposta no Transferegov</a>`;
    const t=p.textos;
    if(!t)return `<p class="source">Os textos oficiais desta proposta ainda não foram buscados neste banco. Use <strong>Buscar textos das propostas</strong>, em Sincronizar: a busca é feita uma vez e fica guardada. Também é possível ${link}.</p>`;
    const partes=campos.filter(c=>String(t[c]||'').trim()).map(c=>`<div class="wide"><dt>${textoHtml(D.CAMPOS_TEXTOS[c],'Textos oficiais: rótulo')}</dt><dd><div class="texto-oficial">${textoHtml(t[c],'Textos oficiais: '+c)}</div></dd></div>`);
    if(!partes.length)return `<p class="source">A origem não traz texto para este item nesta proposta. Confira ${link}.</p>`;
    return `<dl class="data-grid">${partes.join('')}</dl><p class="source">Transcrição do arquivo público da origem, obtida em ${textoHtml(D.fmtDate(t.at),'Textos oficiais: data')} · ${link}.</p>`;
  }
  function textosDialogHtml(){
    return `<p>O servidor local vai baixar o arquivo público <code>siconv_justificativas_proposta.zip</code> e guardar no banco os textos das propostas já cadastradas. São 716 MB — a espera costuma ficar em torno de dez minutos — e a busca só precisa ser repetida se você quiser atualizar os textos.</p>
      <div class="info"><p id="textos-step" role="status" aria-live="polite">Consultando o servidor local…</p><p class="source"><span id="textos-elapsed">0 s</span></p></div>
      <p id="form-error" class="error-message" role="alert" tabindex="-1"></p>
      <div class="dialog-actions">${button('Cancelar busca','textos-cancel','','danger')}</div>`;
  }
  async function buscarTextos(){
    if(syncRun || textosRun){toast('Já existe uma operação em andamento. Aguarde ou cancele.',true);return;}
    const alvos=state.proposals.map(p=>p.id);
    D.assert(alvos.length,'Não há proposta no banco para buscar textos.');
    const run={controller:new AbortController(),started:Date.now()};
    textosRun=run;
    const step=text=>{const el=$('#textos-step');if(el)el.textContent=text;};
    modal('Buscar textos das propostas',textosDialogHtml());
    const relogio=setInterval(()=>{const el=$('#textos-elapsed');if(el)el.textContent=`${Math.round((Date.now()-run.started)/1000)} s`;},1000);
    const parar=()=>{clearInterval(relogio);textosRun=null;};
    const timeout=setTimeout(()=>run.controller.abort(),TEXTOS_TIMEOUT_MS);
    let payload;
    try{
      /* O servidor aceita até 200 identificadores por chamada; bancos maiores
         são buscados em lotes, somando os textos e as ausências. */
      const LOTE=200,textos={},faltando=[];let durationMs=0,rows=0,found=0,entry='';
      for(let i=0;i<alvos.length;i+=LOTE){
        const lote=alvos.slice(i,i+LOTE);
        step(`Baixando e lendo o arquivo público — lote ${Math.floor(i/LOTE)+1} de ${Math.ceil(alvos.length/LOTE)} (${lote.length} proposta(s))…`);
        const res=await fetch(`${TEXTOS_PATH}?ids=${encodeURIComponent(lote.join(','))}`,{signal:run.controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
        if(!res.ok){
          let detalhe='';
          try{detalhe=(await res.json()).error || '';}catch{detalhe='';}
          throw new Error(`O servidor local respondeu HTTP ${res.status} e não concluiu a busca dos textos${detalhe?`: ${detalhe}`:'. Confirme que ele está ligado e atualizado.'}`);
        }
        const parte=await res.json();
        D.assert(parte && typeof parte.textos==='object','A resposta não traz os textos das propostas.');
        Object.assign(textos,parte.textos);
        if(Array.isArray(parte.faltando))faltando.push(...parte.faltando);
        durationMs+=Number.isFinite(parte.stats?.durationMs)?parte.stats.durationMs:0;
        rows=parte.stats?.rows ?? rows;
        found+=Number.isFinite(parte.stats?.found)?parte.stats.found:0;
        entry=parte.stats?.entry || entry;
      }
      payload={textos,faltando,stats:{durationMs,rows,found,entry}};
    }catch(err){
      clearTimeout(timeout);parar();
      if(err.name==='AbortError'){modal('Buscar textos das propostas',`<p>A busca foi interrompida. Nada foi gravado no banco local.</p><div class="dialog-actions">${button('Fechar','close')}</div>`);return;}
      modal('Buscar textos das propostas',`<div class="info error">${e(err.message)}</div><div class="dialog-actions">${button('Tentar novamente','textos','','primary')}${button('Fechar','close')}</div>`);
      return;
    }
    clearTimeout(timeout);parar();
    D.assert(payload && typeof payload.textos==='object','A resposta não traz os textos das propostas.');
    const next=D.clone(state);let aplicados=0;
    for(const p of next.proposals) if(payload.textos[p.id]){D.setTextos(p,payload.textos[p.id],actor());aplicados++;}
    if(!aplicados){modal('Buscar textos das propostas',`<div class="info warning">O arquivo público foi lido e não trouxe texto para nenhuma das ${alvos.length} proposta(s) deste banco. Nada foi alterado.</div><div class="dialog-actions">${button('Fechar','close')}</div>`);return;}
    try{step('Gravando os textos no banco local…');await persist(next);}catch(err){modal('Buscar textos das propostas',`<div class="info error">${e(err.message)}</div><div class="dialog-actions">${button('Fechar','close')}</div>`);return;}
    const faltando=Array.isArray(payload.faltando)?payload.faltando:[];
    const duracao=Number.isFinite(payload.stats?.durationMs)?` em ${(payload.stats.durationMs/1000).toFixed(1).replace('.',',')} s no servidor`:'';
    modal('Textos oficiais guardados',`<p><strong>${aplicados} proposta(s)</strong> receberam os textos oficiais${e(duracao)}. Eles aparecem nos itens de Mérito e ficam guardados no banco: a busca não precisa ser repetida.</p>${faltando.length?`<div class="info warning">Sem texto no arquivo público: ${e(faltando.length)} proposta(s).</div>`:''}<div class="dialog-actions">${button('Fechar','close')}</div>`);
    toast(`Textos oficiais guardados para ${aplicados} proposta(s).`);
  }
  function syncRestart(pad){
    if(syncRun){toast('Já existe uma sincronização em andamento. Aguarde ou cancele a operação.',true);return;}
    modal('Sincronizar com o Transferegov',syncDialogHtml());
    startSync(pad);
  }
  function syncDialog(){
    if(!state)return;
    if(syncRun){toast('Já existe uma sincronização em andamento. Aguarde ou cancele a operação.',true);return;}
    if(location.protocol==='file:'){
      modal('Sincronizar com o Transferegov',`<p>Esta janela foi aberta pelo arquivo HTML (<strong>file://</strong>). Nesse modo o navegador não pode baixar as extrações do Transferegov — não é falha do botão: a API pública não autoriza o download direto pelo navegador, e esta página não consegue nem consultar o servidor local.</p><p><strong>Para sincronizar:</strong> feche esta janela e abra o sistema pelo atalho <strong>PROFOR 2026</strong> da Área de Trabalho (ou pelo arquivo <strong>INICIAR SISTEMA.cmd</strong>, na pasta do sistema). Ele liga o servidor local e abre o sistema no endereço certo; lá o botão Sincronizar funciona.</p><div class="info warning">Os dados locais ficam guardados por origem: o que já foi sincronizado pertence ao endereço do servidor, e não a esta janela aberta pelo arquivo HTML. Por isso o painel aparece vazio aqui.</div><div class="dialog-actions">${button('Modo offline: anexar arquivos CSV','import')}${button('Fechar','close')}</div>`);
      return;
    }
    syncRestart(1);
  }
  /* Chegou pelo protocolo (?sync=1)? Então sincroniza sozinho, sem novo clique. */
  function runAutoSyncFromQuery(){
    let auto=false;
    try{auto=new URLSearchParams(location.search).get('sync')==='1';}catch{auto=false;}
    if(!auto)return;
    try{history.replaceState(null,'',location.pathname+location.hash);}catch{/* URL segue com ?sync=1 */}
    syncRestart(1);
  }
  async function startSync(pad){
    if(syncRun){toast('Já existe uma sincronização em andamento. Aguarde ou cancele a operação.',true);return;}
    const run={controller:new AbortController(),started:Date.now(),pad:!!pad,reason:''};
    syncRun=run;syncStartTimers(run);
    const errorEl=$('#form-error');if(errorEl){errorEl.className='error-message';errorEl.textContent='';}
    const received=$('#sync-received');if(received)received.textContent='aguardando o servidor concluir o download e o cruzamento';
    syncStep(run.pad?'Servidor local acionado: baixando, descompactando e cruzando as extrações oficiais (com PAD). O cronômetro mede a espera — isso pode levar de dezenas de segundos a alguns minutos.':'Servidor local acionado: sincronização rápida (sem PAD). O cronômetro mede a espera.');
    syncActions('running');
    const force=!state.proposals.length;
    let text;
    try{
      const res=await fetch(`${SYNC_PATH}?pad=${run.pad?'1':'0'}${force?'&force=1':''}`,{signal:run.controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
      if(!res.ok)throw syncFailure('origem',`O servidor local respondeu HTTP ${res.status}${res.statusText?` (${res.statusText})`:''} e não concluiu a sincronização. Confirme que ele expõe a rota ${SYNC_PATH}; se a versão do servidor for antiga, tente novamente após atualizá-lo.`);
      syncStep('Servidor local conectado: baixando, descompactando e cruzando as extrações oficiais. Isso pode levar de dezenas de segundos a alguns minutos.');
      text=await syncReadText(res,n=>{const el=$('#sync-received');if(el)el.textContent=`${syncBytes(n)} recebidos`;});
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
    syncActions('saving');
    let payload;
    try{payload=JSON.parse(text);}catch{payload=null;}
    if(!payload || typeof payload!=='object' || Array.isArray(payload)){syncStopTimers(run);syncDataFail('o conteúdo recebido não é um objeto JSON');return;}
    const warnings=Array.isArray(payload.warnings)?payload.warnings.filter(w=>typeof w==='string'):[];
    const source=payload.source && typeof payload.source==='object'?payload.source:null;
    const cached=payload.unchanged===true;
    const stored=cached && Array.isArray(payload.proposals) && payload.proposals.length>0;
    if(cached && !stored){
      const label=syncLabel(source,run.pad,force?'origem sem alterações desde a última execução do servidor':'origem sem alterações');
      try{
        syncStep('A origem não tem alterações. Registrando a conferência no banco local…');
        const next=D.clone(state);next.sync={at:D.now(),source:label,count:Number.isSafeInteger(state.sync?.count)?state.sync.count:state.proposals.length};
        await persist(next);render();
      }catch(err){syncStopTimers(run);syncDataFail(err.message);return;}
      syncStopTimers(run);modalDirty=false;
      if(state.proposals.length){
        modal('Nenhuma alteração desde a última sincronização',`<p>A origem foi consultada em ${e(new Date().toLocaleString('pt-BR'))} e não há alterações desde a última sincronização. A conferência foi registrada no banco local.</p><p class="source">Origem: ${e(label)}</p>${syncStatsHtml(payload.stats)}${syncWarningsHtml(warnings)}<div class="dialog-actions">${button('Sincronização rápida (sem PAD)','sync-fast')}${button('Buscar textos das propostas','textos')}${button('Fechar','close')}</div>`);
        toast('Nenhuma alteração desde a última sincronização.');
      }else{
        modal('Servidor sem novidades e banco local vazio',`<div class="info warning"><strong>O servidor local respondeu que a origem não mudou desde a última execução dele, mas este navegador ainda não tem propostas gravadas.</strong><p>Nada foi removido do banco local. Se esta é a primeira sincronização neste navegador, use “Tentar novamente (completa)” para forçar o servidor a refazer a extração; se persistir, confira o servidor local e o modo offline.</p></div><p class="source">Origem: ${e(label)}</p>${syncStatsHtml(payload.stats)}${syncWarningsHtml(warnings)}<div class="dialog-actions">${button('Tentar novamente (completa)','sync-retry','','primary')}${button('Sincronização rápida (sem PAD)','sync-fast')}${button('Modo offline: anexar arquivos CSV','import')}${button('Fechar','close')}</div>`);
        toast('O servidor informou "sem alterações", mas não há propostas gravadas neste navegador.',true);
      }
      return;
    }
    if(!Array.isArray(payload.proposals)){syncStopTimers(run);syncDataFail('a resposta não traz a lista de propostas (campo “proposals”)');return;}
    if(!payload.proposals.length){
      const label=syncLabel(source,run.pad,'extração sem propostas');
      try{
        syncStep('A extração não trouxe propostas. Preservando o banco local…');
        const next=D.clone(state);next.sync={at:D.now(),source:label,count:0};
        await persist(next);render();
      }catch(err){syncStopTimers(run);syncDataFail(err.message);return;}
      syncStopTimers(run);modalDirty=false;
      modal('Sincronização sem propostas',`<div class="info warning"><strong>A extração oficial não trouxe nenhuma proposta vinculada ao programa ${e(D.PROGRAM)}.</strong><p>Nada foi removido do banco local: as ${state.proposals.length} proposta(s) já cadastrada(s) foram preservadas. A ausência na extração não exclui uma proposta local — confira a origem antes de qualquer decisão. A base pública é atualizada ao longo do dia e pode não publicar o programa neste momento.</p></div><p class="source">Origem: ${e(label)}</p>${syncStatsHtml(payload.stats)}${syncWarningsHtml(warnings)}<div class="dialog-actions">${button('Tentar novamente (completa)','sync-retry','','primary')}${button('Modo offline: anexar arquivos CSV','import')}${button('Fechar','close')}</div>`);
      toast('A extração não trouxe propostas do programa; nenhum dado local foi removido.');
      return;
    }
    syncStep(`Validando ${payload.proposals.length} proposta(s) recebida(s)…`);
    const localWasEmpty=!state.proposals.length;
    let preview;
    try{preview=D.syncProposals(state,payload.proposals,syncLabel(source,run.pad,cached?'extração reaproveitada pelo servidor':''));}catch(err){syncStopTimers(run);syncDataFail(err.message);return;}
    try{syncStep(`Gravando ${preview.changes.length} alteração(ões) no banco local…`);await persist(preview.state);}catch(err){syncStopTimers(run);syncDataFail(err.message);return;}
    syncStopTimers(run);render();modalDirty=false;
    const ufs=[...new Set(preview.state.proposals.map(p=>p.imported.uf))].sort();
    const when=preview.state.sync.at;
    const semAlteracoes=cached && !preview.changes.length;
    const cachedNote=cached?`<div class="info">${localWasEmpty?'Dados obtidos na sincronização: o servidor reaproveitou a extração mais recente e informou que a origem não mudou desde a última execução dele.':'O servidor reaproveitou a extração mais recente e informou que a origem não mudou desde a última execução dele; os dados recebidos foram conferidos.'}</div>`:'';
    modal(semAlteracoes?'Nenhuma alteração desde a última sincronização':'Sincronização concluída',`<p><strong>${payload.proposals.length} proposta(s)</strong> recebida(s) e <strong>${preview.changes.length} alteração(ões)</strong> registrada(s) no banco local.</p>
      ${cachedNote}
      <div class="consistency"><span>${badge(String(payload.proposals.length),'good')} proposta(s) nesta sincronização</span><span>${badge(String(preview.changes.length),preview.changes.length?'warn':'good')} alteração(ões)</span><span>${badge(`${ufs.length} de ${Object.keys(D.UFS).length} UFs cobertas`,'good')} ${e(ufs.join(', '))}</span>${syncPadBadge(payload.stats)}${syncStatsBadge(payload.stats)}</div>
      <p class="source">Origem: ${e(syncLabel(source,run.pad))} · sincronizado em ${e(new Date(when).toLocaleString('pt-BR'))}. Esta é uma fotografia do momento da consulta: a base pública do Transferegov muda ao longo do dia.</p>
      ${run.pad?'':'<div class="info warning">Sincronização rápida: o PAD (plano de aplicação detalhado) não foi baixado nem conferido nesta execução. O plano anterior foi preservado e continua aguardando conferência manual.</div>'}
      ${syncWarningsHtml(warnings)}${syncChangesHtml(preview.changes)}
      <div class="dialog-actions">${button('Buscar textos das propostas','textos')}${button('Modo offline: anexar arquivos CSV','import')}${button('Fechar','close')}</div>`);
    toast(semAlteracoes?'Nenhuma alteração desde a última sincronização.':`Sincronização concluída: ${payload.proposals.length} proposta(s) e ${preview.changes.length} alteração(ões).`);
  }
  function importDialog(){modal('Modo offline: anexar arquivos CSV do Transferegov',`<p>Programa <strong>${D.PROGRAM}</strong>. Modo offline de contingência: baixe e extraia os ZIPs no <a href="https://api-publica.transferegov.gestao.gov.br/downloads" target="_blank" rel="noopener noreferrer">portal oficial de dados</a> e selecione os CSVs abaixo. O caminho principal é <strong>Sincronizar com o Transferegov</strong>, que dispensa qualquer anexo.</p><form class="form-stack"><label>1. Programas — siconv_programa.csv<input name="program" type="file" accept=".csv" required></label><label>2. Programas / propostas — siconv_programa_proposta.csv<input name="links" type="file" accept=".csv" required></label><label>3. Propostas — siconv_proposta.csv<input name="proposal" type="file" accept=".csv" required></label><label>4. Plano de aplicação detalhado (opcional)<input name="pad" type="file" accept=".csv"></label><label>Codificação dos CSVs<select name="encoding"><option value="utf-8">UTF-8 (extração oficial atual)</option><option value="windows-1252">Windows-1252 (extrações antigas)</option></select></label><p id="import-progress" role="status"></p>${formEnd('Conferir importação')}</form>`);bindForm(async fd=>{const files=Object.fromEntries(['program','links','proposal','pad'].map(k=>[k,fd.get(k)?.size?fd.get(k):null]));const result=await Transferegov.importFiles(files,msg=>$('#import-progress').textContent=msg,fd.get('encoding'));const preview=D.syncProposals(state,result.proposals,result.source);modalDirty=false;modal('Conferir importação',`<p><strong>${result.proposals.length} proposta(s)</strong> vinculada(s) ao programa. ${preview.changes.length} alteração(ões) detectada(s).</p>${result.warnings.map(w=>`<div class="info warning">${e(w)}</div>`).join('')}${syncChangesHtml(preview.changes)}<p id="form-error" class="error-message" role="alert"></p><div class="dialog-actions">${button('Cancelar','close')}<button id="commit-import" class="primary">Confirmar importação</button></div>`);$('#commit-import').onclick=async()=>{const btn=$('#commit-import');btn.disabled=true;try{await persist(preview.state);render();saved('Importação concluída e salva no banco local.');}catch(err){formError(err);btn.disabled=false;}};});}
  function download(name,type,content){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function backupDialog(){modal('Backup e exportação',`<p>O banco fica na pasta dados/registros do sistema e acompanha o workspace pelo OneDrive. Antes de trocar de máquina, feche o sistema e aguarde a sincronização do OneDrive nas duas máquinas.</p><p>Última exportação solicitada: ${state.lastBackup?e(new Date(state.lastBackup).toLocaleString('pt-BR')):'nenhuma'}.</p><div class="actions">${button('Exportar backup JSON','backup','','primary')}${button('Exportar CSV','csv')}${button('Exportar cópia de recuperação','recovery')}${button('Resgatar banco antigo deste navegador','legacy')}</div><hr><form class="form-stack"><label>Restaurar backup JSON<input type="file" name="backup" accept=".json" required></label><p class="source">A restauração substitui o banco atual. A versão anterior ficará preservada como cópia de recuperação local.</p>${formEnd('Validar restauração')}</form>`);bindForm(async fd=>{const file=fd.get('backup');D.assert(file.size<50*1024*1024,'Backup acima do limite de 50 MB.');const imported=D.validateState(JSON.parse(await file.text()));modalDirty=false;modal('Confirmar restauração',`<p>Substituir ${state.proposals.length} proposta(s) local(is) pelas ${imported.proposals.length} proposta(s) deste backup?</p><p>A cópia do banco atual será preservada antes da substituição.</p><p id="form-error" class="error-message" role="alert"></p><div class="dialog-actions">${button('Cancelar','close')}<button id="restore-confirm" class="primary">Restaurar este backup</button></div>`);$('#restore-confirm').onclick=async()=>{const btn=$('#restore-confirm');btn.disabled=true;try{await persist(imported,{restore:true});selected=null;location.hash='painel';render();saved('Backup restaurado. A versão anterior foi preservada.');}catch(err){formError(err);btn.disabled=false;}};});}
  function report(){modal('Relatório de análise',`<div class="actions">${button('Copiar texto','copy-text')}${button('Copiar HTML para SEI','copy-html')}${button('Salvar HTML','save-report')}${button('Imprimir / salvar PDF','print')}</div><p class="source">Para PDF, selecione “Salvar como PDF” no diálogo de impressão.</p><div class="report" id="report-preview">${ProforReport.html(current())}</div>`);}
  async function handleAction(target){const action=target.dataset.action;
    if(action==='close')closeModal();else if(action==='import')importDialog();else if(action==='sync')syncDialog();else if(action==='export')backupDialog();else if(action==='sync-cancel')cancelSync('user');else if(action==='sync-retry')syncRestart(1);else if(action==='sync-fast')syncRestart(0);else if(action==='textos'){await buscarTextos();}else if(action==='textos-cancel'){if(textosRun)textosRun.controller.abort();}else if(action==='review')editReview(target.dataset.group,target.dataset.id);else if(action==='sei')editSei();else if(action==='institution')editInstitution();else if(action==='diligence')editDiligence(target.dataset.id,target.dataset.ref);else if(action==='conclude')conclusion();else if(action==='report')report();else if(action==='copy-proposal'){await navigator.clipboard.writeText(target.dataset.number);toast(`Proposta ${target.dataset.number} copiada.`);}else if(action==='copy-cnpj'){await navigator.clipboard.writeText(target.dataset.cnpj);toast(`CNPJ ${target.dataset.cnpj} copiado.`);}
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
    else if(action==='save-report'){download(`PROFOR_RELATORIO_${current().id}.html`,'text/html;charset=utf-8','<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Relatório PROFOR</title><body>'+ProforReport.html(current())+'</body></html>');}
    else if(action==='print')window.print();
    else if(action==='copy-text' || action==='copy-html'){
      const html=ProforReport.html(current()),text=$('#report-preview').innerText;
      try{if(action==='copy-html' && navigator.clipboard?.write && window.ClipboardItem)await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);else await navigator.clipboard.writeText(text);toast('Relatório copiado.');}
      catch{modal('Copiar relatório',`<p>O navegador não liberou a área de transferência. Selecione e copie o conteúdo abaixo; para preservar a formatação, use também “Salvar HTML”.</p><textarea id="copy-fallback" rows="16">${e(action==='copy-html'?html:text)}</textarea><div class="dialog-actions">${button('Fechar','close')}</div>`);$('#copy-fallback').select();}
    }
  }
  /* ---- Apagar e restaurar proposta ----
     Apagar tira a proposta do painel e das demais telas de gestão e a exclui das
     sincronizações; o registro continua no banco local e volta com "Restaurar". */
  async function confirmDeleteProposal(id){
    const p=state.proposals.find(x=>x.id===id);
    D.assert(p && !p.isDeleted,'Proposta não encontrada ou já apagada.');
    modal('Apagar proposta',`<p>Apagar a proposta <span class="proposal-number"><strong>${e(proposalNumber(p.imported.numero))}</strong>${proposalCopyButton(p.imported.numero)}</span> (${e(p.imported.uf)} · ${e(p.imported.proponente)})?</p><div class="info"><strong>O que acontece:</strong><ul><li>ela sai do painel e das telas de gestão e acompanhamento;</li><li>deixa de ser sincronizada, porque está sendo desconsiderada;</li><li><strong>não</strong> é excluída do banco: o histórico é preservado e ela pode ser restaurada depois, na tela “Propostas apagadas”;</li><li>a origem no Transferegov não é alterada.</li></ul></div><p id="form-error" class="error-message" role="alert" tabindex="-1"></p><div class="dialog-actions">${button('Cancelar','close')}<button class="danger" type="button" data-action="delete-proposal-now" data-id="${e(id)}">Apagar do painel</button></div>`);
  }
  async function confirmRestoreProposal(id){
    const p=state.proposals.find(x=>x.id===id);
    D.assert(p && p.isDeleted,'Proposta não encontrada ou não está apagada.');
    modal('Restaurar proposta',`<p>Restaurar a proposta <span class="proposal-number"><strong>${e(proposalNumber(p.imported.numero))}</strong>${proposalCopyButton(p.imported.numero)}</span> (${e(p.imported.uf)} · ${e(p.imported.proponente)})?</p><div class="info">Ela volta ao painel e às demais telas de gestão, e passa a ser sincronizada novamente. O histórico e as análises já registradas são preservados.</div><div class="dialog-actions">${button('Cancelar','close')}<button class="primary" type="button" data-action="restore-proposal-now" data-id="${e(id)}">Restaurar</button></div>`);
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
    const toggle=ev.target.closest('[data-status-toggle]');
    if(toggle){ev.preventDefault();openStatusDropdown(toggle.closest('[data-status-dropdown]'));return;}
    const statusOption=ev.target.closest('[data-status-value]');
    if(statusOption){ev.preventDefault();runStatusChoice(statusOption,statusOption.dataset.statusValue).catch(formError);return;}
    const statusDetails=ev.target.closest('[data-status-details]');
    if(statusDetails){ev.preventDefault();runStatusChoice(statusDetails,'detalhes').catch(formError);return;}
    if(statusDropdownOpen&&!ev.target.closest('[data-status-dropdown]'))closeStatusDropdown(false);
    if(ev.target.closest('.skip')){ev.preventDefault();$('#main').focus();return;}
    if(ev.target.closest('#props-open')){ev.preventDefault();toggleProposalNav();return;}
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
  window.addEventListener('resize',()=>closeStatusDropdown(false));
  document.addEventListener('scroll',()=>{if(statusDropdownOpen)positionStatusPopover(statusDropdownOpen);},true);
  const modalEl=$('#modal');
  if(modalEl){
    modalEl.addEventListener('close',()=>{modalDirty=false;const target=focusReturn?.id?document.getElementById(focusReturn.id):[...document.querySelectorAll('[data-action]')].find(el=>focusReturn?.dataset.action && Object.entries(focusReturn.dataset).every(([k,v])=>el.dataset[k]===v));target?.focus();});
    modalEl.addEventListener('cancel',ev=>{ev.preventDefault();closeModal();});
  }
  const modalCloseBtn=$('#modal-close');
  if(modalCloseBtn)modalCloseBtn.onclick=closeModal;
  const importOpenBtn=$('#import-open');
  if(importOpenBtn)importOpenBtn.onclick=()=>{if(state)syncDialog();};
  const backupOpenBtn=$('#backup-open');
  if(backupOpenBtn)backupOpenBtn.onclick=()=>{if(state)backupDialog();};
  window.addEventListener('hashchange',route);window.addEventListener('beforeunload',ev=>{if(modalDirty || busy || syncRun){ev.preventDefault();ev.returnValue='';}});
  (async()=>{try{await ProforStore.open();state=D.validateState(await ProforStore.read());$('#save-state').textContent='Banco do workspace disponível';renderSideNav();route();runAutoSyncFromQuery();}catch(err){$('#save-state').textContent='Banco indisponível';$('#main').innerHTML=`<h1>Não foi possível abrir o banco local</h1><div class="info error">${e(err.message)}</div><p>Abra INICIAR SISTEMA.cmd na pasta do workspace. Aguarde o OneDrive concluir a sincronização antes de usar esta máquina.</p>`;}})();
})();
