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
      .report-filter-bar,.report-actions{display:none!important}
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
  const TOPICS=[
    {id:'identificacao',label:'Identificação da proposta'},
    {id:'valores',label:'Valores'},
    {id:'projeto',label:'Projeto apresentado',requiresText:true},
    {id:'merito',label:'Avaliação de mérito'},
    {id:'pad',label:'Plano de aplicação detalhado (PAD)'},
    {id:'ouvidoria',label:'Instituição da Ouvidoria'},
    {id:'proposta',label:'Requisitos da Proposta'},
    {id:'situacao',label:'Situação final da análise'}
  ];
  function availableTopics(p){
    const hasText=Boolean(p.textos && Object.values(p.textos).some(t=>String(t||'').trim()));
    return TOPICS.filter(t=>!t.requiresText || hasText);
  }
  function html(p,options={}){
    const i=p.imported,sections=[];
    const selected=options.topics?new Set(options.topics):null;
    let n=1;
    const isTopicIncluded=id=>!selected || selected.has(id);
    const numbered=(id,title,content)=>{
      if(!isTopicIncluded(id))return;
      sections.push(section(`${n++}. ${title}`,content));
    };
    const lastImport=p.history.filter(h=>h.event.includes('importada')||h.event.includes('origem')).at(-1)?.at;
    numbered('identificacao','Identificação da proposta',`<dl class="pr-facts">
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
    numbered('valores','Valores',`<div class="pr-values">
      <div class="pr-value"><span class="pr-label">Repasse</span><strong>${e(D.fmtMoney(i.repasse))}</strong></div>
      <div class="pr-value"><span class="pr-label">Contrapartida</span><strong>${e(D.fmtMoney(i.contrapartida))}</strong></div>
      <div class="pr-value"><span class="pr-label">Valor global</span><strong>${e(D.fmtMoney(i.global))}</strong></div>
    </div>`);
    if(p.textos){
      const campos=Object.entries(D.CAMPOS_TEXTOS).filter(([key])=>String(p.textos[key]||'').trim());
      const content=campos.length?campos.map(([key,label])=>`<div class="pr-item"><h3>${e(label)}</h3><div class="pr-detail"><p>${e(p.textos[key])}</p></div></div>`).join(''):'<p>Não há texto da origem para esta proposta.</p>';
      numbered('projeto','Projeto apresentado',content);
    }
    const merit=D.rows(p,'merito').map(([id,label])=>{
      const review=D.reviewOf(p,'merito',id);
      return card(label,review,detail('Observação',review?.note),D.rotuloDoResultado(id,statusKey(review)));
    }).join('');
    numbered('merito','Avaliação de mérito',merit);
    const pad=(i.pad||[]).map(item=>{
      const review=p.reviews.pad?.[item.id];
      const values=`<div class="pr-item-meta">
        <div><span class="pr-label">Quantidade</span><strong>${e(value(item.quantidade))}</strong></div>
        <div><span class="pr-label">Unitário</span><strong>${e(D.fmtMoney(item.unitario))}</strong></div>
        <div><span class="pr-label">Total</span><strong>${e(D.fmtMoney(item.total))}</strong></div>
      </div>`;
      return card(item.descricao,review,values+detail('Observação',review?.note),'',true);
    }).join('');
    numbered('pad','Plano de aplicação detalhado',pad || '<p>Nenhum item do PAD disponível nesta extração.</p>');
    numbered('ouvidoria','Instituição da Ouvidoria',table([
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
      numbered('proposta',tab.titulo,requirements);
    }
    numbered('situacao','Situação final da análise',`<div class="pr-final"><p><strong>${e(D.situation(p))}.</strong></p></div>`);
    const bodyContent=sections.length>0
      ? sections.join('')
      : '<div class="pr-final" style="text-align:center;padding:24px 16px;"><p><strong>Nenhum tópico selecionado para o relatório.</strong></p><p class="source" style="margin-top:4px;">Marque ao menos uma caixa de seleção acima para exibir o conteúdo.</p></div>';
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
      ${bodyContent}
    </article>`;
  }

  /* ---- Gerador de Planilha XLSX (formato banco de dados tabular para IAs) ---- */
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function colLetter(col) {
    let s = '';
    col += 1;
    while (col > 0) {
      const m = (col - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      col = Math.floor((col - m) / 26);
    }
    return s;
  }

  function xmlEscape(val) {
    return String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function buildSheetXml(sheet) {
    let rowsXml = '';
    let colsXml = '';
    if (sheet.data.length > 0) {
      const numCols = sheet.data[0].length;
      colsXml = '<cols>';
      for (let c = 0; c < numCols; c++) {
        let maxLen = 10;
        for (let r = 0; r < Math.min(sheet.data.length, 100); r++) {
          const val = sheet.data[r][c];
          if (val !== null && val !== undefined) {
            maxLen = Math.max(maxLen, String(val).length);
          }
        }
        const width = Math.min(Math.max(maxLen + 3, 12), 60);
        colsXml += `<col min="${c + 1}" max="${c + 1}" width="${width}" customWidth="1"/>`;
      }
      colsXml += '</cols>';
    }

    sheet.data.forEach((row, rIdx) => {
      const rowNum = rIdx + 1;
      let cellsXml = '';
      row.forEach((cell, cIdx) => {
        const ref = `${colLetter(cIdx)}${rowNum}`;
        if (cell === null || cell === undefined || cell === '') return;
        const isHeader = rIdx === 0;
        if (typeof cell === 'number' && !isHeader && Number.isFinite(cell)) {
          const styleId = Number.isInteger(cell) ? 3 : 2;
          cellsXml += `<c r="${ref}" s="${styleId}"><v>${cell}</v></c>`;
        } else {
          const styleId = isHeader ? 1 : 0;
          cellsXml += `<c r="${ref}" t="inlineStr" s="${styleId}"><is><t xml:space="preserve">${xmlEscape(cell)}</t></is></c>`;
        }
      });
      rowsXml += `<row r="${rowNum}">${cellsXml}</row>`;
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${colsXml}<sheetData>${rowsXml}</sheetData></worksheet>`;
  }

  function createZip(files) {
    const enc = new TextEncoder();
    const localHeaders = [];
    const centralHeaders = [];
    let offset = 0;
    let totalLength = 0;

    for (const f of files) {
      const nameBytes = enc.encode(f.name);
      const dataBytes = typeof f.data === 'string' ? enc.encode(f.data) : (f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data));
      const crc = crc32(dataBytes);
      const size = dataBytes.length;

      const lh = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(lh.buffer, lh.byteOffset, lh.byteLength);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, 0, true);
      lv.setUint16(12, 0, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true);
      lv.setUint32(22, size, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      lh.set(nameBytes, 30);

      localHeaders.push(lh, dataBytes);
      totalLength += lh.length + dataBytes.length;

      const ch = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(ch.buffer, ch.byteOffset, ch.byteLength);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      ch.set(nameBytes, 46);

      centralHeaders.push(ch);
      totalLength += ch.length;
      offset += lh.length + dataBytes.length;
    }

    const cdOffset = offset;
    let cdSize = 0;
    for (const ch of centralHeaders) cdSize += ch.length;

    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer, eocd.byteOffset, eocd.byteLength);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, cdOffset, true);
    ev.setUint16(20, 0, true);
    totalLength += 22;

    const out = new Uint8Array(totalLength);
    let pos = 0;
    for (const h of localHeaders) {
      out.set(h, pos);
      pos += h.length;
    }
    for (const c of centralHeaders) {
      out.set(c, pos);
      pos += c.length;
    }
    out.set(eocd, pos);

    return out;
  }

  function buildWorkbookZip(sheets) {
    const files = [];

    let sheetOverrides = '';
    sheets.forEach((s, idx) => {
      sheetOverrides += `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
    });
    files.push({
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`
    });

    files.push({
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    });

    let wbRels = '';
    sheets.forEach((s, idx) => {
      wbRels += `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`;
    });
    wbRels += `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
    files.push({
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels}</Relationships>`
    });

    let sheetsXml = '';
    sheets.forEach((s, idx) => {
      sheetsXml += `<sheet name="${xmlEscape(s.name.slice(0, 31))}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`;
    });
    files.push({
      name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetsXml}</sheets></workbook>`
    });

    files.push({
      name: 'xl/styles.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0.00"/>
    <numFmt numFmtId="165" formatCode="#,##0"/>
  </numFmts>
  <fonts count="2">
    <font><name val="Calibri"/><sz val="11"/></font>
    <font><b/><name val="Calibri"/><sz val="11"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE9EEF2"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`
    });

    sheets.forEach((s, idx) => {
      files.push({
        name: `xl/worksheets/sheet${idx + 1}.xml`,
        data: buildSheetXml(s)
      });
    });

    return createZip(files);
  }

  function parseNum(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    const s = String(raw).trim().replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function xlsx(p, options = {}) {
    const i = p.imported;
    const selected = options.topics ? new Set(options.topics) : null;
    const isTopicIncluded = id => !selected || selected.has(id);
    const lastImport = p.history.filter(h => h.event.includes('importada') || h.event.includes('origem')).at(-1)?.at;
    const propNum = D.fmtProposalNumber(i.numero);
    const seiNum = p.sei?.number || 'Não cadastrado';
    const sheets = [];

    // Tabela Mestra: Base_Dados (formato relacional plano perfeitamente legível por IAs)
    const baseRows = [
      [
        'proposta',
        'uf',
        'processo_sei',
        'topico_id',
        'topico_nome',
        'item',
        'descricao_conteudo',
        'quantidade',
        'valor_unitario',
        'valor_total',
        'status_analise',
        'observacao_analista',
        'fundamentacao',
        'documentos_anexos'
      ]
    ];

    function addBaseRow(topicId, topicName, item, desc = null, qtd = null, vUnit = null, vTot = null, status = null, note = null, fund = null, docs = null) {
      baseRows.push([
        propNum,
        i.uf,
        seiNum,
        topicId,
        topicName,
        item,
        desc,
        qtd,
        vUnit,
        vTot,
        status,
        note,
        fund,
        docs
      ]);
    }

    // 1. Identificação da proposta
    if (isTopicIncluded('identificacao')) {
      const topName = 'Identificação da proposta';
      addBaseRow('identificacao', topName, 'Processo SEI', seiNum);
      addBaseRow('identificacao', topName, 'Programa', D.PROGRAM);
      addBaseRow('identificacao', topName, 'Proposta', propNum);
      addBaseRow('identificacao', topName, 'Unidade Federativa', i.uf);
      addBaseRow('identificacao', topName, 'Município', i.municipio);
      addBaseRow('identificacao', topName, 'Proponente', i.proponente);
      addBaseRow('identificacao', topName, 'CNPJ', D.fmtCnpj(i.cnpj));
      addBaseRow('identificacao', topName, 'Situação no Transferegov', i.situacao);
      addBaseRow('identificacao', topName, 'Etapa na origem', D.sourceState(p));
      addBaseRow('identificacao', topName, 'Data de envio para análise', D.fmtDate(i.dataEnvio));
      addBaseRow('identificacao', topName, 'Última alteração importada', D.fmtDate(lastImport));
      addBaseRow('identificacao', topName, 'Objeto', i.objeto);
    }

    // 2. Valores
    if (isTopicIncluded('valores')) {
      const topName = 'Valores';
      const rep = parseNum(i.repasse);
      const ctp = parseNum(i.contrapartida);
      const glb = parseNum(i.global);
      addBaseRow('valores', topName, 'Repasse', null, null, null, rep, 'Informado');
      addBaseRow('valores', topName, 'Contrapartida', null, null, null, ctp, 'Informado');
      addBaseRow('valores', topName, 'Valor global', null, null, null, glb, 'Informado');
    }

    // 3. Projeto apresentado
    if (isTopicIncluded('projeto') && p.textos) {
      const topName = 'Projeto apresentado';
      Object.entries(D.CAMPOS_TEXTOS).forEach(([key, label]) => {
        const txt = String(p.textos[key] || '').trim();
        if (txt) {
          addBaseRow('projeto', topName, label, txt);
        }
      });
    }

    // 4. Avaliação de mérito
    if (isTopicIncluded('merito')) {
      const topName = 'Avaliação de mérito';
      D.rows(p, 'merito').forEach(([id, label]) => {
        const review = D.reviewOf(p, 'merito', id);
        const docs = documentNames(review).join('; ');
        const status = D.rotuloDoResultado(id, statusKey(review)) || D.STATUSES[statusKey(review)];
        addBaseRow('merito', topName, label, null, null, null, null, status, review?.note || null, null, docs || null);
      });
    }

    // 5. Plano de aplicação detalhado (PAD)
    const padItems = i.pad || [];
    if (isTopicIncluded('pad')) {
      const topName = 'Plano de aplicação detalhado (PAD)';
      if (padItems.length > 0) {
        padItems.forEach(item => {
          const review = p.reviews.pad?.[item.id];
          const docs = documentNames(review).join('; ');
          const status = D.STATUSES[statusKey(review)] || 'Não analisado';
          const qtd = parseNum(item.quantidade);
          const vUnit = parseNum(item.unitario);
          const vTot = parseNum(item.total);
          addBaseRow('pad', topName, item.descricao, null, qtd, vUnit, vTot, status, review?.note || null, null, docs || null);
        });
      } else {
        addBaseRow('pad', topName, 'PAD', 'Nenhum item do PAD disponível nesta extração.');
      }
    }

    // 6. Instituição da Ouvidoria
    if (isTopicIncluded('ouvidoria')) {
      const topName = 'Instituição da Ouvidoria';
      const ouvStatus = p.ouvidoria.status === 'instituida' ? 'Instituída' : p.ouvidoria.status === 'pendente' ? 'Pendente' : 'Não informada';
      addBaseRow('ouvidoria', topName, 'Situação', ouvStatus);
      addBaseRow('ouvidoria', topName, 'Cláusula suspensiva aplicável confirmada', p.ouvidoria.clause ? 'Sim' : 'Não');
      addBaseRow('ouvidoria', topName, 'Prazo de referência (nove meses)', p.ouvidoria.status === 'instituida' ? 'Sim' : 'Não');
      addBaseRow('ouvidoria', topName, 'Ato normativo registrado', p.ouvidoria.url ? 'Sim' : 'Não');
      if (p.ouvidoria.note) {
        addBaseRow('ouvidoria', topName, 'Observação', p.ouvidoria.note);
      }
    }

    // 7. Requisitos da Proposta
    if (isTopicIncluded('proposta')) {
      for (const tab of D.ABAS_CELEBRACAO) {
        if (tab.id !== 'proposta') continue;
        D.CELEBRACAO.filter(item => item.aba === tab.id).forEach(item => {
          const review = p.reviews.celebracao[item.id];
          const title = `${item.label}${item.sub ? ' — ' + item.sub : ''}`;
          const docs = documentNames(review).join('; ');
          const status = D.STATUSES[statusKey(review)] || 'Não analisado';
          addBaseRow('proposta', tab.titulo, title, null, null, null, null, status, review?.note || null, item.fundamentacao || null, docs || null);
        });
      }
    }

    // 8. Situação final da análise
    if (isTopicIncluded('situacao')) {
      const topName = 'Situação final da análise';
      addBaseRow('situacao', topName, 'Situação final', D.situation(p));
      const blk = D.blockers(p);
      if (blk.length) addBaseRow('situacao', topName, 'Bloqueios técnicos', blk.join('; '));
      const pend = D.pending(p);
      if (pend.length) addBaseRow('situacao', topName, 'Pendências', pend.join('; '));
    }

    // Se nenhum tópico foi selecionado, insere aviso
    if (baseRows.length === 1) {
      baseRows.push([propNum, i.uf, seiNum, 'nenhum', 'Nenhum tópico selecionado', 'Aviso', 'Marque ao menos um tópico para exportar os dados correspondentes.', null, null, null, null, null, null, null]);
    }

    sheets.push({ name: 'Base_Dados', data: baseRows });

    // Abas adicionais especializadas conforme os tópicos selecionados:
    // Aba PAD
    if (isTopicIncluded('pad') && padItems.length > 0) {
      const padRows = [
        ['item_num', 'descricao', 'quantidade', 'valor_unitario', 'valor_total', 'status_analise', 'observacao', 'documentos']
      ];
      padItems.forEach((item, idx) => {
        const review = p.reviews.pad?.[item.id];
        const docs = documentNames(review).join('; ');
        const status = D.STATUSES[statusKey(review)] || 'Não analisado';
        const qtd = parseNum(item.quantidade);
        const vUnit = parseNum(item.unitario);
        const vTot = parseNum(item.total);
        padRows.push([
          idx + 1,
          item.descricao,
          qtd,
          vUnit,
          vTot,
          status,
          review?.note || null,
          docs || null
        ]);
      });
      sheets.push({ name: 'PAD', data: padRows });
    }

    // Aba Valores
    if (isTopicIncluded('valores')) {
      const valRows = [
        ['tipo_valor', 'valor_reais', 'percentual_global']
      ];
      const rep = parseNum(i.repasse);
      const ctp = parseNum(i.contrapartida);
      const glb = parseNum(i.global);
      valRows.push(['Repasse', rep, glb && rep !== null ? rep / glb : null]);
      valRows.push(['Contrapartida', ctp, glb && ctp !== null ? ctp / glb : null]);
      valRows.push(['Valor global', glb, glb ? 1.0 : null]);
      sheets.push({ name: 'Valores', data: valRows });
    }

    // Aba Mérito
    if (isTopicIncluded('merito')) {
      const meritoRows = [
        ['criterio_id', 'criterio', 'status_analise', 'observacao', 'documentos']
      ];
      D.rows(p, 'merito').forEach(([id, label]) => {
        const review = D.reviewOf(p, 'merito', id);
        const docs = documentNames(review).join('; ');
        const status = D.rotuloDoResultado(id, statusKey(review)) || D.STATUSES[statusKey(review)];
        meritoRows.push([id, label, status, review?.note || null, docs || null]);
      });
      sheets.push({ name: 'Merito', data: meritoRows });
    }

    // Aba Requisitos da Proposta
    if (isTopicIncluded('proposta')) {
      const reqRows = [
        ['item_num', 'requisito', 'fundamentacao', 'status_analise', 'observacao', 'documentos']
      ];
      D.CELEBRACAO.filter(item => item.aba === 'proposta').forEach((item, idx) => {
        const review = p.reviews.celebracao[item.id];
        const title = `${item.label}${item.sub ? ' — ' + item.sub : ''}`;
        const docs = documentNames(review).join('; ');
        const status = D.STATUSES[statusKey(review)] || 'Não analisado';
        reqRows.push([item.id || (idx + 1), title, item.fundamentacao || null, status, review?.note || null, docs || null]);
      });
      sheets.push({ name: 'Requisitos', data: reqRows });
    }

    return buildWorkbookZip(sheets);
  }

  root.ProforReport={html,xlsx,TOPICS,availableTopics};
  if(typeof module!=='undefined')module.exports=root.ProforReport;
})(globalThis);
