(function(root){
  'use strict';
  let token=null;
  async function request(method='GET',body){
    const response=await fetch('/api/state',{method,cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Não foi possível acessar o banco do workspace.');
    return result;
  }
  // Somente migração: nenhuma gravação ou exclusão no IndexedDB antigo.
  async function legacy(){
    if(!root.indexedDB)return null;
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open('profor-onasp-2026');let absent=false;
      req.onupgradeneeded=()=>{absent=true;req.transaction.abort();};
      req.onerror=()=>absent?resolve(null):reject(new Error('Não foi possível ler o banco antigo. Exporte seu backup antes de continuar.'));
      req.onsuccess=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('state')){db.close();resolve(null);return;}
        const tx=db.transaction('state','readonly'),store=tx.objectStore('state');
        const current=store.get('current'),recovery=store.get('recovery');
        tx.oncomplete=()=>{db.close();resolve({state:current.result,recovery:recovery.result||null});};
        tx.onerror=()=>{db.close();reject(new Error('Falha ao ler o banco antigo.'));};
      };
    });
  }
  async function open(){
    if(location.protocol==='file:')throw new Error('Abra INICIAR SISTEMA.cmd para acessar os dados da pasta. O HTML aberto diretamente não grava o banco.');
    const current=await request();token=current.token;
    if(!current.exists){
      const old=await legacy(),state=old?.state||Profor.initialState();
      Profor.validateState(state);
      const saved=await request('POST',{state,expected:current.state.revision,token,recovery:old?.recovery});token=saved.token;
    }
  }
  async function read(key='current'){
    const result=await request();
    if(key==='current'){token=result.token;return result.state;}
    return result.recovery;
  }
  async function save(state,expected,{restore=false}={}){
    Profor.validateState(state);
    const result=await request('POST',{state,expected,token,restore});token=result.token;return result.state;
  }
  root.ProforStore={open,read,save,legacy};
})(globalThis);
