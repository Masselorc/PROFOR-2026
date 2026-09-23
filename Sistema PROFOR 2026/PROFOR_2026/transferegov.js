/* Adaptador das quatro extrações oficiais, cabeçalhos conferidos em 15/09/2026. */
(function(root) {
  'use strict';
  const D=typeof module!=='undefined'?require('./domain.js'):root.Profor;
  function csvParser(onRow) {
    let row=[],field='',quoted=false,afterQuote=false,bom=true;
    function endField(){row.push(field);field='';}
    function endRow(){endField();if(row.some(x=>x!==''))onRow(row);row=[];}
    return {
      feed(text) {
        for(const c of text) {
          if(bom){bom=false;if(c==='\uFEFF')continue;}
          if(quoted) { if(c==='"'){quoted=false;afterQuote=true;}else field+=c; }
          else if(afterQuote && c==='"'){field+='"';quoted=true;afterQuote=false;}
          else if(c===';'){endField();afterQuote=false;}
          else if(c==='\n'){endRow();afterQuote=false;}
          else if(c==='\r'){/* CRLF outside a quoted value */}
          else if(c==='"' && field==='' && !afterQuote){quoted=true;}
          else {D.assert(!afterQuote,'CSV inválido após fechamento de aspas.');D.assert(c!=='"','Aspas inesperadas no CSV.');field+=c;}
        }
      },
      finish(){D.assert(!quoted,'CSV truncado: aspas não fechadas.');if(field || row.length)endRow();}
    };
  }
  async function scan(file,required,onRow,encoding='utf-8') {
    D.assert(file,'Selecione todos os arquivos obrigatórios.');D.assert(/\.csv$/i.test(file.name),'Extraia os ZIPs e selecione os arquivos CSV.');
    let headers; let count=0;
    const parser=csvParser(cells=>{
      if(!headers){headers=cells.map(x=>x.trim());D.assert(new Set(headers).size===headers.length,'Cabeçalho duplicado.');for(const k of required)D.assert(headers.includes(k),`${file.name}: coluna ${k} ausente.`);return;}
      count++; D.assert(cells.length===headers.length,`${file.name}: linha lógica ${count+1} tem quantidade incorreta de colunas.`);
      const row=Object.create(null);headers.forEach((h,i)=>row[h]=cells[i]);onRow(row);
    });
    const reader=file.stream().getReader(),decoder=new TextDecoder(encoding,{fatal:true});
    try{while(true){const {value,done}=await reader.read();if(done)break;parser.feed(decoder.decode(value,{stream:true}));}parser.feed(decoder.decode());parser.finish();D.assert(headers,'Arquivo vazio.');}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    return count;
  }
  async function importFiles(files,progress=()=>{},encoding='utf-8') {
    const programs=new Set(),proposalIds=new Set(),proposals=new Map(),warnings=[];
    progress('Lendo programas…');
    await scan(files.program,['ID_PROGRAMA','COD_PROGRAMA'],r=>{if(r.COD_PROGRAMA.trim()===D.PROGRAM)programs.add(r.ID_PROGRAMA.trim());},encoding);
    D.assert(programs.size,'Programa 3000020260022 não localizado no arquivo de programas.');
    progress('Cruzando programas e propostas…');
    await scan(files.links,['ID_PROGRAMA','ID_PROPOSTA'],r=>{if(programs.has(r.ID_PROGRAMA.trim()))proposalIds.add(r.ID_PROPOSTA.trim());},encoding);
    progress('Lendo propostas do programa…');
    await scan(files.proposal,['ID_PROPOSTA','UF_PROPONENTE','NR_PROPOSTA','IDENTIF_PROPONENTE','NM_PROPONENTE','OBJETO_PROPOSTA','SIT_PROPOSTA','DIA_PROPOSTA','DIA_INIC_VIGENCIA_PROPOSTA','DIA_FIM_VIGENCIA_PROPOSTA','VL_REPASSE_PROP','VL_CONTRAPARTIDA_PROP','VL_GLOBAL_PROP'],r=>{
      if(!proposalIds.has(r.ID_PROPOSTA.trim()))return;
      D.assert(Object.hasOwn(D.UFS,r.UF_PROPONENTE.trim()),`UF fora do edital na proposta ${r.NR_PROPOSTA}. Confira a extração.`);
      const item={id:r.ID_PROPOSTA.trim(),numero:r.NR_PROPOSTA.trim(),uf:r.UF_PROPONENTE.trim(),programa:D.PROGRAM,cnpj:r.IDENTIF_PROPONENTE.trim(),proponente:r.NM_PROPONENTE,orgao:'',objeto:r.OBJETO_PROPOSTA,situacao:r.SIT_PROPOSTA,data:D.dateISO(r.DIA_PROPOSTA.trim()),vigenciaInicio:D.dateISO(r.DIA_INIC_VIGENCIA_PROPOSTA.trim()),vigenciaFim:D.dateISO(r.DIA_FIM_VIGENCIA_PROPOSTA.trim()),repasse:D.moneyBR(r.VL_REPASSE_PROP),contrapartida:D.moneyBR(r.VL_CONTRAPARTIDA_PROP),global:D.moneyBR(r.VL_GLOBAL_PROP),pad:files.pad?[]:null};
      D.assert(!proposals.has(item.id),`Proposta duplicada: ${item.id}.`);proposals.set(item.id,item);
    },encoding);
    D.assert([...proposalIds].every(id=>proposals.has(id)),'Extrações inconsistentes: há propostas vinculadas ao programa ausentes do arquivo de propostas.');
    if(files.pad){progress('Lendo itens do plano de aplicação…');await scan(files.pad,['ID_PROPOSTA','ID_ITEM_PAD','DESCRICAO_ITEM','QTD_ITEM','VALOR_UNITARIO_ITEM','VALOR_TOTAL_ITEM'],r=>{
      const p=proposals.get(r.ID_PROPOSTA.trim());if(!p)return;
      p.pad.push({id:r.ID_ITEM_PAD.trim(),descricao:r.DESCRICAO_ITEM,quantidade:D.quantityBR(r.QTD_ITEM),unitario:D.moneyBR(r.VALOR_UNITARIO_ITEM),total:D.moneyBR(r.VALOR_TOTAL_ITEM)});
    },encoding);}
    else warnings.push('PAD não fornecido: itens existentes serão preservados; propostas novas ficarão sem PAD.');
    const result=[...proposals.values()];result.forEach(D.validateImported);
    for(const uf of Object.keys(D.UFS))if(result.filter(p=>p.uf===uf).length>1)warnings.push(`${uf}: mais de uma proposta. Conferência manual necessária.`);
    return {proposals:result,warnings,source:Object.values(files).filter(Boolean).map(f=>f.name).join(', ')};
  }
  const api={csvParser,scan,importFiles};if(typeof module!=='undefined')module.exports=api;else root.Transferegov=api;
})(globalThis);
