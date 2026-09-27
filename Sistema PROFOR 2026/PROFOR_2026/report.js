(function(root){
  'use strict';
  const D=root.Profor, e=D.esc;
  const STYLE=`<style>
    .profor-report{--pr-ink:#17313d;--pr-muted:#526571;--pr-brand:#155b67;--pr-line:#d7e2e6;--pr-soft:#f2f7f8;font:10.5pt/1.45 Arial,sans-serif;color:var(--pr-ink);max-width:920px;margin:0 auto;overflow-wrap:anywhere}
    .profor-report *{box-sizing:border-box}
    .profor-report h1,.profor-report h2,.profor-report h3,.profor-report h4,.profor-report p,.profor-report dl,.profor-report ul{margin:0}
    .profor-report .pr-header{border-top:5px solid var(--pr-brand);border-radius:8px;background:var(--pr-soft);padding:20px 22px;margin-bottom:20px}
    .profor-report .pr-kicker{font-size:8pt;font-weight:700;letter-spacing:.13em;color:var(--pr-brand);text-transform:uppercase}
    .profor-report h1{font-size:20pt;line-height:1.2;letter-spacing:-.02em;margin:8px 0 13px;color:var(--pr-ink)}
    .profor-report .pr-head-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:13px}
    .profor-report .pr-head-grid div{background:#fff;border:1px solid var(--pr-line);border-radius:6px;padding:7px 10px}
    .profor-report .pr-head-grid span{display:block;color:var(--pr-muted);font-size:8pt;text-transform:uppercase;letter-spacing:.04em}
    .profor-report .pr-head-grid strong{display:block;font-size:11pt;margin-top:2px}
    .profor-report .pr-intro{font-size:9pt;color:var(--pr-muted)}
    .profor-report .pr-section{margin:0 0 20px}
    .profor-report h2{font-size:12pt;color:var(--pr-brand);border-bottom:2px solid var(--pr-line);padding-bottom:6px;margin:0 0 10px;break-after:avoid-page}
    .profor-report h3{font-size:10pt;line-height:1.35;color:var(--pr-ink)}
    .profor-report h4{font-size:8pt;text-transform:uppercase;letter-spacing:.04em;color:var(--pr-muted);margin-bottom:5px}
    .profor-report .pr-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
    .profor-report .pr-fact{border:1px solid var(--pr-line);border-radius:5px;padding:7px 10px;min-width:0;break-inside:avoid-page}
    .profor-report .pr-wide{grid-column:1/-1}
    .profor-report dt,.profor-report .pr-label{font-size:8pt;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--pr-muted)}
    .profor-report dd{margin:3px 0 0;white-space:pre-wrap}
    .profor-report .pr-values{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .profor-report .pr-value{background:var(--pr-soft);border:1px solid var(--pr-line);border-radius:6px;padding:10px;break-inside:avoid-page}
    .profor-report .pr-value strong{display:block;font-size:14pt;margin-top:3px;font-variant-numeric:tabular-nums;color:var(--pr-brand)}
    .profor-report .pr-item{border:1px solid var(--pr-line);border-radius:6px;padding:10px 12px;margin-bottom:8px;background:#fff}
    .profor-report .pr-item-compact{padding:6px 8px;margin-bottom:4px}
    .profor-report .pr-item-compact .pr-item-head{margin-bottom:2px}
    .profor-report .pr-item-compact .pr-item-meta{gap:4px;margin-top:4px}
    .profor-report .pr-item-compact .pr-item-meta div{padding:3px 5px}
    .profor-report .pr-item-compact .pr-docs{margin-top:5px;padding-top:4px}
    .profor-report .pr-item-compact .pr-docs li{padding:3px 0}
    .profor-report .pr-item-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px;break-after:avoid-page}
    .profor-report .pr-item-head h3{flex:1;min-width:0}
    .profor-report .pr-item p{white-space:pre-wrap}
    .profor-report .pr-detail{margin-top:7px}
    .profor-report .pr-detail p{margin-top:2px}
    .profor-report .pr-item-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px}
    .profor-report .pr-item-meta div{background:var(--pr-soft);padding:5px 7px;border-radius:4px}
    .profor-report .pr-item-meta strong{display:block;margin-top:2px;font-variant-numeric:tabular-nums}
    .profor-report .pr-status{display:inline-block;flex:none;max-width:42%;border-radius:999px;border:1px solid #c9d6dc;background:#edf2f4;color:#425766;padding:3px 9px;font-size:8pt;font-weight:700;line-height:1.25;text-align:center}
    .profor-report .pr-status[data-status="ok"],.profor-report .pr-status[data-status="obs"]{border-color:#b8dcca;background:#ebf7ef;color:#176040}
    .profor-report .pr-status[data-status="diligencia"],.profor-report .pr-status[data-status="reanalise"]{border-color:#efd39b;background:#fff7e7;color:#805117}
    .profor-report .pr-status[data-status="no"]{border-color:#ecc3c8;background:#fdf0f1;color:#a42c37}
    .profor-report .pr-docs{margin-top:9px;padding-top:8px;border-top:1px solid var(--pr-line)}
    .profor-report .pr-docs ul{list-style:none;padding:0}
    .profor-report .pr-docs li{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid #edf1f2;break-inside:avoid-page}
    .profor-report .pr-docs li:last-child{border-bottom:0}
    .profor-report .pr-docs li>span:first-child{min-width:0}
    .profor-report .pr-docs .pr-status{max-width:38%}
    .profor-report .pr-note{font-size:8.5pt;color:var(--pr-muted);margin:0 0 9px}
    .profor-report .pr-table{width:100%;border-collapse:collapse;table-layout:fixed}
    .profor-report .pr-table th,.profor-report .pr-table td{padding:6px 8px;border-bottom:1px solid var(--pr-line);text-align:left;vertical-align:top;overflow-wrap:anywhere}
    .profor-report .pr-table th{width:42%;color:var(--pr-muted);font-weight:600;background:var(--pr-soft)}
    .profor-report .pr-table tr{break-inside:avoid-page}
    .profor-report .pr-list{padding-left:20px}
    .profor-report .pr-list li{margin-bottom:4px}
    .profor-report .pr-final{border-left:4px solid var(--pr-brand);background:var(--pr-soft);padding:10px 12px}
    .profor-report .pr-final p+p{margin-top:5px}
    @media(max-width:640px){.profor-report .pr-head-grid,.profor-report .pr-values{grid-template-columns:1fr}.profor-report .pr-facts{grid-template-columns:1fr}.profor-report .pr-item-head{display:block}.profor-report .pr-item-head .pr-status{margin-top:6px;max-width:100%}}
    @page{size:A4;margin:0}
    @media print{
      html,body{margin:0!important;background:#fff!important}
      dialog:has(.profor-report){border:0!important;width:100%!important;max-width:none!important;max-height:none!important;margin:0!important;box-shadow:none!important}
      dialog:has(.profor-report) #modal-content{padding:0!important}
      .profor-report{max-width:none;padding:14mm 14mm 12mm;font-size:9pt;line-height:1.35;print-color-adjust:exact;-webkit-print-color-adjust:exact}
      .profor-report .pr-header{border-top:0;border-bottom:3px solid var(--pr-brand);border-radius:0;padding:0 0 10px;background:#fff;margin-bottom:14px}
      .profor-report h1{font-size:17pt;margin:5px 0 9px}
      .profor-report h2{font-size:11pt;margin-bottom:8px}
      .profor-report .pr-section{margin-bottom:14px}
      .profor-report .pr-item{padding:8px 10px;margin-bottom:6px}
      .profor-report .pr-head-grid,.profor-report .pr-values,.profor-report .pr-item-head,.profor-report .pr-docs li{break-inside:avoid-page}
    }
  </style>`;
  function value(raw,fallback='Não informado'){const text=String(raw??'').trim();return text || fallback;}
  function fact(label,raw,wide=false){return `<div class="pr-fact${wide?' pr-wide':''}"><dt>${e(label)}</dt><dd>${e(value(raw))}</dd></div>`;}
  function row(label,raw){return `<tr><th scope="row">${e(label)}</th><td>${e(value(raw))}</td></tr>`;}
  function table(rows){return `<table class="pr-table"><tbody>${rows.map(([label,raw])=>row(label,raw)).join('')}</tbody></table>`;}
  function detail(label,raw){const text=String(raw??'').trim();return text?`<div class="pr-detail"><span class="pr-label">${e(label)}</span><p>${e(text)}</p></div>`:'';}
  function statusKey(review){return Object.hasOwn(D.STATUSES,review?.status)?review.status:'na';}
  function statusBadge(review,label){const key=statusKey(review);return `<span class="pr-status" data-status="${e(key)}">${e(label || D.STATUSES[key])}</span>`;}
  function documentNames(review){
    const attachments=Array.isArray(review?.attachments)?review.attachments.map(a=>String(a?.name??'').trim()).filter(Boolean):[];
    const manual=String(review?.document??'').trim();
    return manual && !attachments.some(name=>name.toLocaleLowerCase('pt-BR')===manual.toLocaleLowerCase('pt-BR'))?[manual,...attachments]:attachments;
  }
  function documents(review,label){
    const names=documentNames(review);
    return names.length?`<div class="pr-docs"><h4>Documentos vinculados</h4><ul>${names.map(name=>`<li><span>${e(name)}</span>${statusBadge(review,label)}</li>`).join('')}</ul></div>`:'';
  }
  function card(title,review,content='',label='',compact=false){
    return `<div class="pr-item${compact?' pr-item-compact':''}"><div class="pr-item-head"><h3>${e(title)}</h3>${statusBadge(review,label)}</div>${content}${documents(review,label)}</div>`;
  }
  function section(title,content){return `<section class="pr-section"><h2>${e(title)}</h2>${content}</section>`;}
  function html(p){
    const i=p.imported,sections=[];
    let n=1;
    const numbered=(title,content)=>sections.push(section(`${n++}. ${title}`,content));
    const lastImport=p.history.filter(h=>h.event.includes('importada')||h.event.includes('origem')).at(-1)?.at;
    numbered('Identificação da proposta',`<dl class="pr-facts">
      ${fact('Processo SEI da proposta',p.sei?.number || 'Não cadastrado')}
      ${fact('Programa',D.PROGRAM)}
      ${fact('Proposta',D.fmtProposalNumber(i.numero))}
      ${fact('UF',i.uf)}
      ${fact('Proponente',i.proponente,true)}
      ${fact('CNPJ',D.fmtCnpj(i.cnpj) || i.cnpj)}
      ${fact('Início da vigência',D.fmtDate(i.vigenciaInicio))}
      ${fact('Fim da vigência',D.fmtDate(i.vigenciaFim))}
      ${fact('Última importação com alteração',D.fmtDate(lastImport),true)}
      ${fact('Objeto',i.objeto,true)}
    </dl>`);
    numbered('Valores',`<div class="pr-values">
      <div class="pr-value"><span class="pr-label">Repasse</span><strong>${e(D.fmtMoney(i.repasse))}</strong></div>
      <div class="pr-value"><span class="pr-label">Contrapartida</span><strong>${e(D.fmtMoney(i.contrapartida))}</strong></div>
      <div class="pr-value"><span class="pr-label">Valor global</span><strong>${e(D.fmtMoney(i.global))}</strong></div>
    </div>`);
    if(p.textos){
      const campos=Object.entries(D.CAMPOS_TEXTOS).filter(([key])=>String(p.textos[key]||'').trim());
      const content=campos.length?campos.map(([key,label])=>`<div class="pr-item"><h3>${e(label)}</h3><div class="pr-detail"><p>${e(p.textos[key])}</p></div></div>`).join(''):'<p>Não há texto da origem para esta proposta.</p>';
      numbered('Projeto apresentado',content);
    }
    const merit=D.rows(p,'merito').map(([id,label])=>{
      const review=D.reviewOf(p,'merito',id);
      return card(label,review,detail('Observação',review?.note),D.rotuloDoResultado(id,statusKey(review)));
    }).join('');
    numbered('Avaliação de mérito',merit);
    const pad=(i.pad||[]).map(item=>{
      const review=p.reviews.pad?.[item.id];
      const values=`<div class="pr-item-meta">
        <div><span class="pr-label">Quantidade</span><strong>${e(value(item.quantidade))}</strong></div>
        <div><span class="pr-label">Unitário</span><strong>${e(D.fmtMoney(item.unitario))}</strong></div>
        <div><span class="pr-label">Total</span><strong>${e(D.fmtMoney(item.total))}</strong></div>
      </div>`;
      return card(item.descricao,review,values+detail('Observação',review?.note),'',true);
    }).join('');
    numbered('Plano de aplicação detalhado',pad || '<p>Nenhum item do PAD disponível nesta extração.</p>');
    numbered('Instituição da Ouvidoria',table([
      ['Situação',p.ouvidoria.status==='instituida'?'Instituída':p.ouvidoria.status==='pendente'?'Pendente':'Não informada'],
      ['Cláusula suspensiva aplicável confirmada',p.ouvidoria.clause?'Sim':'Não'],
      ['Prazo de referência (nove meses)',p.ouvidoria.status==='instituida'?'Sim':'Não'],
      ['Ato normativo registrado',p.ouvidoria.url?'Sim':'Não']
    ]));
    for(const tab of D.ABAS_CELEBRACAO){
      if(tab.id!=='proposta')continue;
      const requirements=D.CELEBRACAO.filter(item=>item.aba===tab.id).map(item=>{
        const review=p.reviews.celebracao[item.id];
        const title=`${item.label}${item.sub?' — '+item.sub:''}`;
        const details=detail('Fundamentação',item.fundamentacao)+detail('Observação',review?.note);
        return card(title,review,details);
      }).join('');
      numbered(tab.titulo,requirements);
    }
    numbered('Situação final da análise',`<div class="pr-final"><p><strong>${e(D.situation(p))}.</strong></p></div>`);
    return STYLE+`<article class="profor-report" lang="pt-BR">
      <header class="pr-header">
        <div class="pr-kicker">PROFOR / ONASP 2026 · Relatório técnico</div>
        <h1>Relatório de análise da proposta</h1>
        <div class="pr-head-grid">
          <div><span>Proposta</span><strong>${e(D.fmtProposalNumber(i.numero))}</strong></div>
          <div><span>Unidade federativa</span><strong>${e(i.uf)}</strong></div>
          <div><span>Emissão</span><strong>${e(D.fmtDate(D.localToday()))}</strong></div>
        </div>
        <p class="pr-intro">Documento auxiliar gerado a partir dos dados importados do Transferegov e das análises registradas no sistema. Confira os autos antes de incorporá-lo ao SEI.</p>
      </header>
      ${sections.join('')}
    </article>`;
  }
  root.ProforReport={html};
})(globalThis);
