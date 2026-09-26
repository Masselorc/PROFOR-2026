'use strict';
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const D=require('./domain.js');
const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
const fail=(message,status=409)=>Object.assign(new Error(message),{status});
const dayBR=at=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date(at));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const value=x=>x===undefined?null:D.clone(x);
/* Compara somente dados trazidos pela origem. Datas de conferência dos textos
   e revisões manuais não são novidades importadas. Cada transição conta uma vez,
   inclusive quando o mesmo campo muda de novo no mesmo dia. */
function importedChanges(before,after){
  const previous=new Map((before?.proposals||[]).map(p=>[p.id,p]));
  const changes=[];
  for(const proposal of after.proposals){
    const old=previous.get(proposal.id);
    const base={id:proposal.id,numero:proposal.imported.numero,uf:proposal.imported.uf};
    for(const key of new Set([...Object.keys(old?.imported||{}),...Object.keys(proposal.imported)])){
      if(key==='id' || same(old?.imported?.[key],proposal.imported[key]))continue;
      changes.push({...base,field:key,before:value(old?.imported?.[key]),after:value(proposal.imported[key])});
    }
    for(const [key,label] of Object.entries(D.CAMPOS_TEXTOS)){
      if(same(old?.textos?.[key],proposal.textos?.[key]) || !proposal.textos)continue;
      changes.push({...base,field:`Texto: ${label}`,before:value(old?.textos?.[key]),after:value(proposal.textos[key])});
    }
  }
  return changes;
}
function validateSyncRun(run){
  if(run===undefined)return;
  if(!run || typeof run!=='object' || Array.isArray(run) || typeof run.startedAt!=='string' || !Number.isFinite(Date.parse(run.startedAt)) || !Array.isArray(run.activity) || run.activity.length>10000)throw fail('Registro de sincronização inválido.',400);
  if(run.finishedAt!==undefined && (typeof run.finishedAt!=='string' || !Number.isFinite(Date.parse(run.finishedAt))))throw fail('Data de conclusão inválida.',400);
  for(const line of run.activity)if(!line || typeof line.at!=='string' || !Number.isFinite(Date.parse(line.at)) || typeof line.message!=='string' || line.message.length>4000)throw fail('Linha de atividade inválida.',400);
}
// Cada gravação é imutável; o OneDrive preserva ramos concorrentes.
function createStore(directory){
  function chain(){
    fs.mkdirSync(directory,{recursive:true});
    const records=new Map();
    for(const name of fs.readdirSync(directory).filter(n=>n.endsWith('.json'))){
      let text,record;
      try{
        text=fs.readFileSync(path.join(directory,name),'utf8');record=JSON.parse(text);
        if(record.format!==1 || !(record.parent===null || /^[a-f0-9]{64}$/.test(record.parent)))throw Error();
        D.validateState(record.state);if(record.recovery)D.validateState(record.recovery);validateSyncRun(record.syncRun);
      }catch{throw fail('Arquivo de dados inválido ou incompleto: '+name+'. Aguarde o OneDrive ou recupere uma cópia íntegra.',503);}
      records.set(digest(text),record);
    }
    const parents=new Set([...records.values()].map(r=>r.parent).filter(Boolean));
    for(const parent of parents)if(!records.has(parent))throw fail('O OneDrive ainda não trouxe todo o histórico do banco. Aguarde a sincronização completa.',503);
    const heads=[...records.keys()].filter(id=>!parents.has(id));
    if(heads.length>1)throw fail('Há alterações concorrentes de duas máquinas. As versões foram preservadas em dados/registros. É necessário reconciliá-las antes de continuar.');
    const token=heads[0]||null;
    const ordered=[];let cursor=token;
    while(cursor){ordered.push({id:cursor,record:records.get(cursor)});cursor=records.get(cursor).parent;}
    ordered.reverse();
    return {token,ordered};
  }
  function load(){
    const {token,ordered}=chain(),record=ordered.at(-1)?.record;
    return {token,state:record?.state||D.initialState(),recovery:record?.recovery||null,exists:!!record};
  }
  function history(){
    const {ordered}=chain(),entries=[];
    for(let index=1;index<ordered.length;index++){
      const {id,record}=ordered[index],previous=ordered[index-1].record;
      const syncChanged=record.state.sync?.at && record.state.sync.at!==previous.state.sync?.at;
      const candidate=record.syncRun?.finishedAt||(syncChanged?record.state.sync.at:record.savedAt);
      const at=Number.isFinite(Date.parse(candidate))?candidate:record.savedAt;
      const textChanged=record.state.proposals.some(p=>{
        const old=previous.state.proposals.find(x=>x.id===p.id);
        return p.history.slice(old?.history.length||0).some(item=>item.event.startsWith('Textos oficiais')) && Object.keys(D.CAMPOS_TEXTOS).some(key=>!same(old?.textos?.[key],p.textos?.[key]));
      });
      if(!record.syncRun && !syncChanged && !textChanged)continue;
      const changes=importedChanges(previous.state,record.state);
      const activity=record.syncRun?[...record.syncRun.activity,{at:record.savedAt,message:'Gravação confirmada no banco local.'}]:[];
      entries.push({id,at,date:dayBR(at),changes,activity,reconstructed:!record.syncRun,source:syncChanged?record.state.sync?.source||'':'Textos oficiais',proposals:syncChanged?record.state.sync?.count??null:null});
    }
    return entries;
  }
  function save({state,expected,token,restore=false,recovery=null,syncRun}){
    try{D.validateState(state);if(recovery)D.validateState(recovery);validateSyncRun(syncRun);}catch(err){throw fail(err.message,400);}
    const old=load();
    if(token!==old.token || expected!==old.state.revision)throw fail('O banco foi alterado em outra aba ou máquina. Recarregue a página antes de salvar.');
    if(syncRun && (!state.sync?.at || state.sync.at===old.state.sync?.at))throw fail('Registro de sincronização sem atualização correspondente do banco.',400);
    const next=D.clone(state);next.revision=expected+1;
    const record={format:1,parent:old.token,savedAt:new Date().toISOString(),nonce:crypto.randomUUID(),state:next,recovery:restore?old.state:(old.recovery||(!old.exists?recovery:null))};
    if(syncRun)record.syncRun={startedAt:syncRun.startedAt,finishedAt:record.savedAt,activity:syncRun.activity};
    const text=JSON.stringify(record,null,2)+'\n',id=digest(text);
    const temporary=path.join(directory,id+'.tmp');
    const fd=fs.openSync(temporary,'wx');
    try{fs.writeFileSync(fd,text,'utf8');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(temporary,path.join(directory,id+'.json'));
    return {token:id,state:next,exists:true};
  }
  return {load,save,history};
}
module.exports={createStore,importedChanges};
