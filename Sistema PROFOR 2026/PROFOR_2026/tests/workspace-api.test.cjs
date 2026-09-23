const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const D=require('../domain.js');
test('API real: salva em disco, rejeita origem externa e versão antiga; arquivo não é servido',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-api-'));
  for(const name of ['server.cjs','workspace-store.cjs','domain.js','transferegov-sync.cjs'])fs.copyFileSync(path.join(__dirname,'..',name),path.join(dir,name));
  // Porta efêmera apenas na cópia isolada, nunca no aplicativo do usuário.
  const serverFile=path.join(dir,'server.cjs');
  fs.writeFileSync(serverFile,fs.readFileSync(serverFile,'utf8').replace('const PORT = 8766;','const PORT = 0;').replace("if (!HOSTS.has(req.headers.host))","if (!req.headers.host.startsWith('127.0.0.1:'))").replace("server.listen(PORT, '127.0.0.1', () => console.log('PROFOR: http://127.0.0.1:8766/PROFOR_2026.html — Ctrl+C para encerrar.'));","server.listen(PORT, '127.0.0.1', () => console.log('TEST_PORT='+server.address().port));"));
  const child=spawn(process.execPath,[serverFile],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  t.after(async()=>{const ended=new Promise(resolve=>child.once('exit',resolve));child.kill();await ended;fs.rmSync(dir,{recursive:true,force:true});});
  const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Servidor não iniciou')),10000);child.once('error',reject);child.stderr.on('data',d=>{clearTimeout(timer);reject(Error(String(d)));});child.stdout.on('data',d=>{const m=String(d).match(/TEST_PORT=(\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
  const base='http://127.0.0.1:'+port;
  const initial=await (await fetch(base+'/api/state')).json();assert.equal(initial.exists,false);
  const body=JSON.stringify({state:D.initialState(),expected:0,token:null});
  const post=origin=>fetch(base+'/api/state',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body});
  assert.equal((await post('https://example.com')).status,403);assert.equal((await post('null')).status,403);
  const savedResponse=await post('http://127.0.0.1:8766');assert.equal(savedResponse.status,200);const saved=await savedResponse.json();
  assert.equal((await post('http://127.0.0.1:8766')).status,409);
  assert.equal((await (await fetch(base+'/api/state')).json()).token,saved.token);
  assert.equal(fs.readdirSync(path.join(dir,'dados','registros')).length,1);
  assert.equal((await fetch(base+'/dados/registros/'+saved.token+'.json')).status,404);
});
