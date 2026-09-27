'use strict';

const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const D=require('./domain.js');
const {applySyncResult}=require('./sync-apply.js');
const {createStore}=require('./workspace-store.cjs');
const transferegov=require('./transferegov-sync.cjs');

const ACTOR='Sincronização automática';
const ROOT=__dirname;
// Trava somente desta máquina. A concorrência entre computadores é validada
// pelo token/revision/expected do workspace-store.cjs no momento da gravação.
const defaultLockPath=()=>path.join(os.tmpdir(),`profor-2026-${os.hostname().replace(/[^a-z0-9.-]/gi,'_')}.lock`);

function processAlive(pid){
  if(!Number.isInteger(pid)||pid<=0)return false;
  try{process.kill(pid,0);return true;}
  catch(err){if(err.code==='ESRCH')return false;if(err.code==='EPERM')return true;throw err;}
}
function acquireLock(lockPath,startedAt){
  fs.mkdirSync(path.dirname(lockPath),{recursive:true});
  const identity={hostname:os.hostname(),pid:process.pid,startedAt};
  let fd;
  try{fd=fs.openSync(lockPath,'wx');}
  catch(err){
    if(err.code!=='EEXIST')throw err;
    let existing;
    try{existing=JSON.parse(fs.readFileSync(lockPath,'utf8'));}
    catch{throw new Error(`Trava de sincronização ilegível em ${lockPath}; confira antes de removê-la.`);}
    if(existing.hostname!==identity.hostname || processAlive(existing.pid))throw new Error(`Já existe uma sincronização automática em andamento nesta máquina (${lockPath}).`);
    fs.unlinkSync(lockPath);
    try{fd=fs.openSync(lockPath,'wx');}
    catch(retryError){if(retryError.code==='EEXIST')throw new Error(`Outra sincronização adquiriu a trava local (${lockPath}).`);throw retryError;}
  }
  try{fs.writeSync(fd,JSON.stringify(identity)+'\n');}
  catch(err){try{fs.closeSync(fd);}catch{}try{fs.unlinkSync(lockPath);}catch{}throw err;}
  return {fd,identity};
}
function releaseLock(lockPath,lock,warnings){
  try{fs.closeSync(lock.fd);}catch(err){warnings.push(`Não foi possível fechar a trava local: ${err.message}`);}
  try{
    const current=JSON.parse(fs.readFileSync(lockPath,'utf8'));
    if(current.hostname===lock.identity.hostname && current.pid===lock.identity.pid && current.startedAt===lock.identity.startedAt)fs.unlinkSync(lockPath);
  }catch(err){warnings.push(`Não foi possível remover a trava local: ${err.message}`);}
}

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
  const lockPath=options.lockPath===undefined?defaultLockPath():options.lockPath;
  const activity=[],warnings=[];
  let lock;
  const record=message=>{
    const line={at:new Date().toISOString(),message:String(message)};
    activity.push(line);
    if(typeof options.onMessage==='function')options.onMessage(line.message);
  };
  const event=data=>{
    if(data && (data.kind==='stage' || data.kind==='action') && typeof data.message==='string')record(data.message);
  };
  try{
    if(lockPath)lock=acquireLock(lockPath,startedAt);
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
    const applied=applySyncResult(initial.state,{proposals:incoming,textos:texts.textos,textosFaltando:texts.faltando},ACTOR,syncLabel(result.source,!incoming.length?'extração sem propostas':result.unchanged===true?'extração reaproveitada pelo servidor':''));
    const {state:next,changes,textsChecked,textsChanged}=applied;
    warnings.push(...applied.warnings);
    if(applied.empty)record('A origem não trouxe propostas. Preservando o banco local.');
    next.sync.at=newSyncAt(initial.state.sync?.at);
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
    if(lock)releaseLock(lockPath,lock,warnings);
  }
}

module.exports={runAndPersist,defaultLockPath};
