'use strict';
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const D=require('./domain.js');
const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
const fail=(message,status=409)=>Object.assign(new Error(message),{status});
// Cada gravação é imutável; o OneDrive preserva ramos concorrentes.
function createStore(directory){
  function load(){
    fs.mkdirSync(directory,{recursive:true});
    const records=new Map();
    for(const name of fs.readdirSync(directory).filter(n=>n.endsWith('.json'))){
      let text,record;
      try{
        text=fs.readFileSync(path.join(directory,name),'utf8');record=JSON.parse(text);
        if(record.format!==1 || !(record.parent===null || /^[a-f0-9]{64}$/.test(record.parent)))throw Error();
        D.validateState(record.state);if(record.recovery)D.validateState(record.recovery);
      }catch{throw fail('Arquivo de dados inválido ou incompleto: '+name+'. Aguarde o OneDrive ou recupere uma cópia íntegra.',503);}
      records.set(digest(text),record);
    }
    const parents=new Set([...records.values()].map(r=>r.parent).filter(Boolean));
    for(const parent of parents)if(!records.has(parent))throw fail('O OneDrive ainda não trouxe todo o histórico do banco. Aguarde a sincronização completa.',503);
    const heads=[...records.keys()].filter(id=>!parents.has(id));
    if(heads.length>1)throw fail('Há alterações concorrentes de duas máquinas. As versões foram preservadas em dados/registros. É necessário reconciliá-las antes de continuar.');
    const token=heads[0]||null,record=records.get(token);
    return {token,state:record?.state||D.initialState(),recovery:record?.recovery||null,exists:!!record};
  }
  function save({state,expected,token,restore=false,recovery=null}){
    try{D.validateState(state);if(recovery)D.validateState(recovery);}catch(err){throw fail(err.message,400);}
    const old=load();
    if(token!==old.token || expected!==old.state.revision)throw fail('O banco foi alterado em outra aba ou máquina. Recarregue a página antes de salvar.');
    const next=D.clone(state);next.revision=expected+1;
    const record={format:1,parent:old.token,savedAt:new Date().toISOString(),nonce:crypto.randomUUID(),state:next,recovery:restore?old.state:(old.recovery||(!old.exists?recovery:null))};
    const text=JSON.stringify(record,null,2)+'\n',id=digest(text);
    const temporary=path.join(directory,id+'.tmp');
    const fd=fs.openSync(temporary,'wx');
    try{fs.writeFileSync(fd,text,'utf8');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(temporary,path.join(directory,id+'.json'));
    return {token:id,state:next,exists:true};
  }
  return {load,save};
}
module.exports={createStore};
