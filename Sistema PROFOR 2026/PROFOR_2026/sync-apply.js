/* Aplicação pura da extração; compartilhada pelo navegador e pelo Node.js. */
(function(root,factory){
  const api=factory(typeof module==='object' && module.exports ? require('./domain.js') : root.Profor);
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.ProforSyncApply=api;
})(globalThis,function(D){
  'use strict';
  function applySyncResult(state,result,actor='Sistema',source=''){
    D.assert(result && Array.isArray(result.proposals),'A origem não retornou uma lista de propostas.');
    D.assert(result.textos && typeof result.textos==='object' && !Array.isArray(result.textos) && Array.isArray(result.textosFaltando),'A origem não retornou os textos oficiais esperados.');
    const ids=new Set(result.proposals.map(p=>p.id));
    const missing=new Set(result.textosFaltando);
    D.assert(missing.size===result.textosFaltando.length && [...missing].every(id=>ids.has(id)),'A lista de textos ausentes é inconsistente.');
    for(const id of ids)D.assert(Object.hasOwn(result.textos,id)||missing.has(id),`A origem não informou os textos da proposta ${id}.`);
    const warnings=[];
    if(!result.proposals.length){
      const next=D.clone(state);
      next.sync={at:D.now(),source,count:0};
      warnings.push('A extração oficial não trouxe propostas; os dados locais foram preservados.');
      return {state:next,changes:[],textsChecked:0,textsChanged:0,warnings,empty:true};
    }
    const preview=D.syncProposals(state,result.proposals,source,actor);
    for(const p of preview.state.proposals)if(ids.has(p.id) && p.padImport?.status==='partial')warnings.push(`Proposta ${p.imported.numero}: PAD incompleto; referência anterior preservada. ${p.padImport.reasons.map(r=>r.reason).join(' ')}`);
    let textsChecked=0,textsChanged=0;
    for(const proposal of preview.state.proposals){
      if(!ids.has(proposal.id)||!Object.hasOwn(result.textos,proposal.id))continue;
      const current=result.textos[proposal.id];
      D.assert(current && typeof current==='object' && !Array.isArray(current),`Textos inválidos da proposta ${proposal.id}.`);
      textsChecked++;
      const equal=Object.keys(D.CAMPOS_TEXTOS).every(field=>proposal.textos?.[field]===String(current[field]??'').trim());
      if(equal){
        const before=proposal.textos.at;
        proposal.textos.at=D.now();
        D.log(proposal,'Textos oficiais conferidos sem alteração',{at:before},{at:proposal.textos.at},actor);
      }else{D.setTextos(proposal,current,actor);textsChanged++;}
    }
    if(missing.size)warnings.push(`${missing.size} proposta(s) sem texto na extração oficial; os textos locais anteriores foram preservados.`);
    return {state:preview.state,changes:preview.changes,textsChecked,textsChanged,warnings,empty:false};
  }
  return {applySyncResult};
});
