'use strict';

const fs=require('node:fs');
const path=require('node:path');
const D=require('./domain.js');
const {createStore}=require('./workspace-store.cjs');
const transferegov=require('./transferegov-sync.cjs');

const ACTOR='Sincronização automática';
const ROOT=__dirname;

function syncLabel(source,note=''){
  const files=Array.isArray(source?.files)?source.files.length:Array.isArray(source?.blobs)?source.blobs.length:0;
  return `${source?.url || 'https://api-publica.transferegov.gestao.gov.br/downloads'} · sincronização completa (com PAD)${files?` · ${files} arquivo(s)`:''}${note?` · ${note}`:''}`;
}

function newSyncAt(previous){
  const current=Date.now(),prior=Date.parse(previous||'');
  return new Date(Number.isFinite(prior)?Math.max(current,prior+1):current).toISOString();
}

async function runAndPersist(options={}){
  const started=Date.now(),startedAt=new Date(started).toISOString();
  const store=options.store || createStore(path.join(ROOT,'dados','registros'));
  const source=options.source || transferegov;
  const lockPath=options.lockPath===undefined?path.join(ROOT,'logs','sincronizacao.lock'):options.lockPath;
  const activity=[],warnings=[];
  let lockFd;
  const record=message=>{
    const line={at:new Date().toISOString(),message:String(message)};
    activity.push(line);
    if(typeof options.onMessage==='function')options.onMessage(line.message);
  };
  const event=data=>{
    if(data && (data.kind==='stage' || data.kind==='action') && typeof data.message==='string')record(data.message);
  };
  try{
    if(lockPath){
      fs.mkdirSync(path.dirname(lockPath),{recursive:true});
      try{lockFd=fs.openSync(lockPath,'wx');}
      catch(err){if(err.code==='EEXIST')throw new Error('Já existe uma sincronização automática em andamento (logs/sincronizacao.lock).');throw err;}
      fs.writeSync(lockFd,`${process.pid} ${startedAt}\n`);
    }
    record('Iniciando sincronização automática de propostas, PAD e textos oficiais.');
    const initial=store.load();
    const force=!initial.state.proposals.length;
    record('Banco local carregado; consultando o Transferegov.');
    const result=await source.sync({pad:true,force,allowEmpty:true,onEvent:event});
    D.assert(result && Array.isArray(result.proposals),'A origem não retornou uma lista de propostas.');
    if(Array.isArray(result.warnings))warnings.push(...result.warnings.filter(x=>typeof x==='string'));
    const incoming=result.proposals;
    const ids=incoming.map(p=>p.id);
    let texts={textos:{},faltando:[]};
    if(ids.length){
      record(`Consultando textos oficiais de ${ids.length} proposta(s).`);
      texts=await source.fetchProposalTexts(ids,message=>record(message),{maxIds:ids.length,onEvent:event});
      D.assert(texts && texts.textos && typeof texts.textos==='object' && !Array.isArray(texts.textos) && Array.isArray(texts.faltando),'A origem não retornou os textos oficiais esperados.');
    }
    const found=new Set(ids),missing=new Set(texts.faltando);
    D.assert(missing.size===texts.faltando.length && [...missing].every(id=>found.has(id)),'A lista de textos ausentes é inconsistente.');
    for(const id of found)D.assert(Object.hasOwn(texts.textos,id)||missing.has(id),`A origem não informou os textos da proposta ${id}.`);

    let next,changes=[],textsChecked=0,textsChanged=0;
    if(!incoming.length){
      warnings.push('A extração oficial não trouxe propostas; os dados locais foram preservados.');
      record('A origem não trouxe propostas. Preservando o banco local.');
      next=D.clone(initial.state);
      next.sync={at:newSyncAt(initial.state.sync?.at),source:syncLabel(result.source,'extração sem propostas'),count:0};
    }else{
      const preview=D.syncProposals(initial.state,incoming,syncLabel(result.source,result.unchanged===true?'extração reaproveitada pelo servidor':''),ACTOR);
      next=preview.state;changes=preview.changes;
      for(const proposal of next.proposals){
        if(!found.has(proposal.id)||!Object.hasOwn(texts.textos,proposal.id))continue;
        const current=texts.textos[proposal.id];
        D.assert(current && typeof current==='object' && !Array.isArray(current),`Textos inválidos da proposta ${proposal.id}.`);
        textsChecked++;
        const equal=Object.keys(D.CAMPOS_TEXTOS).every(field=>proposal.textos?.[field]===String(current[field]??'').trim());
        if(equal){
          const before=proposal.textos.at;
          proposal.textos.at=D.now();
          D.log(proposal,'Textos oficiais conferidos sem alteração',{at:before},{at:proposal.textos.at},ACTOR);
        }else{
          D.setTextos(proposal,current,ACTOR);
          textsChanged++;
        }
      }
      next.sync.at=newSyncAt(initial.state.sync?.at);
      if(missing.size)warnings.push(`${missing.size} proposta(s) sem texto na extração oficial; os textos locais anteriores foram preservados.`);
    }
    D.validateState(next);
    record(`Gravando propostas, PAD e textos oficiais; ${changes.length} alteração(ões) de dados e ${textsChanged} alteração(ões) de textos.`);
    try{
      store.save({state:next,expected:initial.state.revision,token:initial.token,syncRun:{startedAt,activity}});
    }catch(err){
      if(/alterado em outra aba ou máquina|concorrentes/.test(err.message))throw new Error(`Conflito de concorrência: o banco mudou durante a sincronização. Nada desta execução foi gravado. ${err.message}`);
      throw err;
    }
    record('Sincronização concluída; gravação confirmada no banco local.');
    const finishedAt=new Date().toISOString();
    return {startedAt,finishedAt,durationMs:Date.now()-started,proposals:incoming.length,ufs:[...new Set(incoming.map(p=>p.uf))].sort(),padItems:incoming.reduce((sum,p)=>sum+(p.pad?.length||0),0),textsChecked,textsChanged,changesDetected:changes.length,warnings,cacheUsed:result.unchanged===true};
  }finally{
    if(lockFd!==undefined){fs.closeSync(lockFd);fs.unlinkSync(lockPath);}
  }
}

module.exports={runAndPersist};
