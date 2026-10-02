const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {createStore}=require('../workspace-store.cjs');
const D=require('../domain.js');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-store-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return {dir,store:createStore(dir)};}
function put(store,state=D.initialState(),restore=false){const old=store.load();return store.save({state,token:old.token,expected:old.state.revision,restore});}
test('persiste após reinício e mantém recuperação de restauração',t=>{
  const {dir,store}=fixture(t);const first=put(store);const next=D.clone(first.state);next.lastBackup='2026-09-16T12:00:00Z';put(store,next,true);
  const reopened=createStore(dir).load();assert.equal(reopened.state.lastBackup,next.lastBackup);assert.deepEqual(reopened.recovery,first.state);assert.equal(fs.readdirSync(dir).length,2);
});
test('rejeita aba desatualizada e dados inválidos sem alterar arquivos',t=>{
  const {dir,store}=fixture(t);put(store);assert.throws(()=>store.save({state:D.initialState(),expected:0,token:null}),/outra aba/);
  assert.throws(()=>store.save({state:{},expected:1,token:store.load().token}),/incompatível/);assert.equal(fs.readdirSync(dir).length,1);
});
test('OneDrive: preserva ramos offline e bloqueia conflito',t=>{
  const a=fixture(t),b=fixture(t);put(a.store);
  for(const name of fs.readdirSync(a.dir))fs.copyFileSync(path.join(a.dir,name),path.join(b.dir,name));
  put(a.store);put(b.store);
  for(const name of fs.readdirSync(b.dir))if(!fs.existsSync(path.join(a.dir,name)))fs.copyFileSync(path.join(b.dir,name),path.join(a.dir,name));
  assert.equal(fs.readdirSync(a.dir).length,3);assert.throws(()=>a.store.load(),/concorrentes/);
});
test('histórico parcialmente sincronizado e arquivo corrompido falham sem recriar banco',t=>{
  const {dir,store}=fixture(t);const first=put(store);put(store);fs.unlinkSync(path.join(dir,first.token+'.json'));assert.throws(()=>store.load(),/todo o histórico/);
  fs.writeFileSync(path.join(dir,'corrompido.json'),'{');assert.throws(()=>store.load(),/inválido/);
});
test('cliente migra IndexedDB uma vez e funciona em outro navegador sem IndexedDB',async t=>{
  const {store}=fixture(t);const legacyState=D.initialState();legacyState.lastBackup='2026-09-15T10:00:00Z';let reads=0;
  const indexedDB={open(){reads++;const req={};queueMicrotask(()=>{req.result={objectStoreNames:{contains:()=>true},close(){},transaction(){const tx={objectStore(){return {get(key){return {result:key==='current'?legacyState:null};}}}};queueMicrotask(()=>tx.oncomplete());return tx;}};req.onsuccess();});return req;}};
  function client(idb){const ctx={Profor:D,location:{protocol:'http:'},indexedDB:idb,fetch:async(url,options)=>{try{const result=options.method==='POST'?store.save(JSON.parse(options.body)):store.load();return {ok:true,json:async()=>result};}catch(e){return {ok:false,json:async()=>({error:e.message})};}}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../storage.js'),'utf8'),ctx);return ctx.ProforStore;}
  const first=client(indexedDB);await first.open();assert.equal((await first.read()).lastBackup,legacyState.lastBackup);assert.equal(reads,1);
  const second=client(undefined);await second.open();assert.equal((await second.read()).lastBackup,legacyState.lastBackup);
  const a=await first.read(),b=await second.read();await first.save(a,a.revision);await assert.rejects(second.save(b,b.revision),/outra aba/);
});
test('alternância entre duas cópias completas preserva a cadeia sem simular garantia do OneDrive',t=>{
 const a=fixture(t),b=fixture(t);put(a.store);
 const copy=(from,to)=>{for(const name of fs.readdirSync(from))if(!fs.existsSync(path.join(to,name)))fs.copyFileSync(path.join(from,name),path.join(to,name));};
 copy(a.dir,b.dir);let next=D.clone(b.store.load().state);next.lastBackup='2026-10-02T12:00:00Z';put(b.store,next);copy(b.dir,a.dir);
 assert.equal(a.store.load().token,b.store.load().token);next=D.clone(a.store.load().state);next.lastBackup='2026-10-02T13:00:00Z';put(a.store,next);copy(a.dir,b.dir);
 assert.deepEqual(a.store.load(),b.store.load());assert.equal(fs.readdirSync(a.dir).length,3);
});
test('falha simulada no rename não publica registro parcial; revisão/token intactos permitem recuperar',t=>{
 const {dir,store}=fixture(t);put(store);const before=store.load(),names=fs.readdirSync(dir),rename=fs.renameSync;
 fs.renameSync=function(){throw new Error('Falha de disco no rename');};
 try{assert.throws(()=>store.save({state:before.state,expected:before.state.revision,token:before.token}),/Falha de disco/);}finally{fs.renameSync=rename;}
 assert.deepEqual(store.load(),before);assert.deepEqual(fs.readdirSync(dir).filter(name=>name.endsWith('.json')),names);
 // Um .tmp interrompido não é registro da cadeia e é ignorado pelo contrato existente.
 const recovered=store.save({state:before.state,expected:before.state.revision,token:before.token});
 assert.equal(recovered.state.revision,before.state.revision+1);assert.equal(store.load().token,recovered.token);
});
