(function(root){
  'use strict';
  const D=root.Profor, e=D.esc;
  function table(headers,rows){return `<table style="border-collapse:collapse;width:100%"><thead><tr>${headers.map(h=>`<th style="border:1px solid #999;padding:8px;text-align:left">${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td style="border:1px solid #999;padding:8px">${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
  function html(p){
    const i=p.imported,f=D.finance(p);
    const sections=[];
    const section=(title,content)=>sections.push(`<h2 style="font-size:14pt;margin-top:24px">${title}</h2>${content}`);
    /* Numeração corrente: a seção dos textos oficiais é condicional, e a
       numeração seguinte não pode depender de ela existir. */
    let n=1;
    const numerada=(title,content)=>section(`${n++}. ${title}`,content);
    numerada('Identificação da proposta',table(['Campo','Dado'],[['Processo SEI da proposta',p.sei?.number || 'Não cadastrado'],['Link do processo SEI',p.sei?.url || 'Não cadastrado'],['Programa',D.PROGRAM],['Proposta',D.fmtProposalNumber(i.numero)],['UF',i.uf],['Proponente',i.proponente],['CNPJ',D.fmtCnpj(i.cnpj) || i.cnpj || 'Não informado'],['Status no Transferegov',D.sourceState(i).label],['Situação informada na extração oficial (SIT_PROPOSTA)',i.situacao || 'Não informada nesta extração'],['Objeto',i.objeto],['Início da vigência na extração oficial',D.fmtDate(i.vigenciaInicio)],['Fim da vigência na extração oficial',D.fmtDate(i.vigenciaFim)],['Data da última importação com alteração',D.fmtDate(p.history.filter(h=>h.event.includes('importada') || h.event.includes('origem')).at(-1)?.at)]]));
    numerada('Valores',table(['Repasse','Contrapartida','Valor global'],[[i.repasse,i.contrapartida,i.global].map(D.fmtMoney)]));
    /* Textos oficiais da proposta: transcrição da origem, guardada sob demanda.
       A seção só aparece quando os textos foram obtidos — o relatório não anuncia
       dado que não tem, e a análise continua sendo a do analista. */
    if(p.textos){
      const campos=Object.entries(D.CAMPOS_TEXTOS).filter(([k])=>String(p.textos[k]||'').trim());
      numerada('Textos oficiais da proposta',(campos.length?table(['Campo','Transcrição'],campos.map(([k,label])=>[label,p.textos[k]])):'<p>A origem não traz texto para esta proposta.</p>')
        +`<p style="font-size:10pt;color:#444">Transcrição do arquivo público da origem, obtida em ${e(D.fmtDate(p.textos.at))}. Confira com a consulta pública da proposta antes de citar.</p>`);
    }
    /* A antiga seção de Habilitação foi suprimida com a extinção da aba: a etapa de
       habilitação do Edital é verificada na origem e nos itens específicos. */
    numerada('Avaliação de mérito',table(['Requisito','Resultado','Observação','Documento / link'],D.rows(p,'merito').map(([id,label])=>{const r=D.reviewOf(p,'merito',id);return[label,D.rotuloDoResultado(id,r.status),r.note,[r.document,r.url].filter(Boolean).join(' — ')];})));
    numerada('Plano de aplicação detalhado',table(['Item','Descrição','Quantidade','Unitário','Total','Análise','Observação'],(i.pad || []).map(x=>[x.id,x.descricao,x.quantidade,D.fmtMoney(x.unitario),D.fmtMoney(x.total),D.STATUSES[p.reviews.pad[x.id].status],p.reviews.pad[x.id].note])));
    numerada('Consistência financeira',table(['Controle','Resultado'],[['Composição do valor global',!f.complete?'Dados incompletos':f.composition?'Consistente':'Divergente'],['Somatório do PAD',D.fmtMoney(f.sum)],['PAD igual ao global',!f.padComplete?'PAD ausente':f.pad?'Sim':'Não'],['Valores unitários incompatíveis com total ÷ quantidade',String(f.errors.length)]]));
    numerada('Instituição da Ouvidoria',table(['Campo','Registro'],[['Situação',p.ouvidoria.status==='na'?'Não informada':p.ouvidoria.status],['Cláusula suspensiva aplicável confirmada',p.ouvidoria.clause?'Sim':'Não'],['Assinatura',D.fmtDate(p.ouvidoria.signature)],['Prazo de referência (nove meses)',D.fmtDate(D.addMonths(p.ouvidoria.signature,9))],['Ato normativo',p.ouvidoria.url],['Observação',p.ouvidoria.note]]));
    numerada('Adesão ao Fala.BR',`<p>${e({na:'Não informada',aderido:'Já aderido',previsto:'Adesão prevista no Plano de Trabalho',nao_previsto:'Adesão não prevista no Plano de Trabalho'}[p.falaBR])}. Campo informativo.</p>`);
    numerada('Diligências',table(['Categoria / vínculo','Providência','Comunicação','Prazo','Resposta','Situação','Observação'],p.diligences.map(d=>[d.category+' / '+d.ref,d.request,D.fmtDate(d.communication)+(d.science?' (ciência: '+D.fmtDate(d.science)+')':''),D.fmtDate(d.due),D.fmtDate(d.response),D.diligenceLabel(d),d.note])));
    /* A Lista de Conferência dos autos (SEI nº 36183977) é conferida em duas etapas:
       os itens analisados na proposta (Nota Técnica 231 / Parecer 15) e os conferidos
       no ato da celebração. Cada seção reproduz o subtexto, a fundamentação e a
       comprovação da lista, para o relatório poder ser conferido contra os autos. */
    for(const aba of D.ABAS_CELEBRACAO){
      section(`${n++}. ${aba.titulo}`,`<p style="font-size:10pt;color:#444">${e(aba.nota)}</p>`+table(['Item','Requisito','Fundamentação','Comprovação','Resultado','Observação','Documento / link'],D.CELEBRACAO.filter(x=>x.aba===aba.id).map(x=>{const r=p.reviews.celebracao[x.id];return [x.id,x.sub?`${x.label} — ${x.sub}`:x.label,x.fundamentacao,x.comprovacao,D.STATUSES[r.status],r.note,[r.document,r.url].filter(Boolean).join(' — ')];})));
    }
    section(`${n++}. Pendências`,D.blockers(p,true).length?`<ul>${D.blockers(p,true).map(b=>`<li>${e(b)}</li>`).join('')}</ul>`:'<p>Nenhuma pendência operacional identificada pelos controles implementados.</p>');
    section(`${n++}. Situação final da análise`,`<p>${e(D.situation(p))}.</p><p>${p.conclusion?`Conclusão técnica registrada por ${e(p.conclusion.actor)} em ${e(D.fmtDate(p.conclusion.at))}.`:'Conclusão técnica ainda não registrada pelo analista.'}</p>`);
    return `<article style="font-family:Arial,sans-serif;font-size:11pt;color:#111;line-height:1.5"><h1 style="font-size:16pt">Relatório de análise — PROFOR/ONASP 2026</h1><p>Documento auxiliar gerado em ${e(D.fmtDate(D.localToday()))}. Dados importados do Transferegov; resultados manuais identificados no histórico. Conferir com os autos antes de incorporar ao SEI.</p>${sections.join('')}</article>`;
  }
  root.ProforReport={html};
})(globalThis);
