'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Readable}=require('node:stream');
const {EventEmitter}=require('node:events');
const S=require('../transferegov-sync.cjs');
const bytes=Buffer.from('abcdefghij');
const blob={name:'resume-test.zip',bytes:bytes.length,lastModified:'Tue, 06 Oct 2026 11:14:26 GMT',etag:'"v1"'};
function world(t,answer){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'profor-resume-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const calls=[];
  const agentModule={get(url,options,callback){
    const req=new EventEmitter();req.setTimeout=()=>{};req.destroy=err=>{if(err)req.emit('error',err);};
    const call={url:String(url),headers:options.headers};calls.push(call);
    process.nextTick(()=>{const res=answer(call,calls.length);callback(res);});
    return req;
  }};
  return {dir,calls,options:{dir,agentModule,downloadIdleMs:20,retryDelayMs:0}};
}
function response(data,status=200,headers={}){
  const res=Readable.from([data]);res.statusCode=status;res.headers={etag:'"v1"',...headers};return res;
}
function stalled(){
  let pushed=false;const res=new Readable({read(){if(!pushed){pushed=true;this.push(bytes.subarray(0,4));}}});
  res.statusCode=200;res.headers={etag:'"v1"'};return res;
}
test('pausa dispara timeout e retoma exatamente do byte recebido com If-Match',async t=>{
  const retries=[];
  const w=world(t,(_,n)=>n===1?stalled():response(bytes.subarray(4),206,{'content-range':'bytes 4-9/10'}));
  const result=await S.downloadBlob(blob,{...w.options,onRetry:r=>retries.push(r)});
  assert.deepEqual(fs.readFileSync(result.path),bytes);
  assert.equal(w.calls[1].headers.Range,'bytes=4-');assert.equal(w.calls[1].headers['If-Match'],'"v1"');
  assert.equal(retries[0].reason,'network');assert.equal(retries[0].resumed,true);
});
test('conexão encerrada cedo retoma sem duplicar bytes',async t=>{
  const w=world(t,(_,n)=>n===1?response(bytes.subarray(0,4)):response(bytes.subarray(4),206,{'content-range':'bytes 4-9/10'}));
  const result=await S.downloadBlob(blob,w.options);assert.deepEqual(fs.readFileSync(result.path),bytes);
});
test('HTTP 200 na retomada reinicia sem misturar duas gerações de mesmo tamanho',async t=>{
  const next=Buffer.from('0123456789');
  const w=world(t,(_,n)=>n===1?stalled():response(next,200,{etag:'"v2"'}));
  const result=await S.downloadBlob(blob,w.options);assert.deepEqual(fs.readFileSync(result.path),next);
  assert.equal(fs.existsSync(result.path+'.stamp'),false);
});
test('206 com ETag ou intervalo diferente é recusado e preserva cache anterior',async t=>{
  for(const wrong of [{etag:'"v2"','content-range':'bytes 4-9/10'},{'content-range':'bytes 3-9/10'}]){
    const w=world(t,call=>call.url.includes('comp=list')?response(Buffer.from(`<Blobs><Blob><Name>${blob.name}</Name><Properties><Content-Length>10</Content-Length><Last-Modified>${blob.lastModified}</Last-Modified><Etag>"v1"</Etag></Properties></Blob></Blobs>`)):!call.headers.Range?stalled():response(bytes.subarray(4),206,wrong));
    const target=path.join(w.dir,blob.name);fs.writeFileSync(target,'cache anterior');
    await assert.rejects(S.downloadBlob(blob,w.options),err=>err.code==='stale');
    assert.equal(fs.readFileSync(target,'utf8'),'cache anterior');assert.equal(fs.existsSync(target+'.parcial'),false);
  }
});
test('queda de rede durante o corpo preserva os bytes para a retomada',async t=>{
  let first;
  const w=world(t,(_,n)=>{
    if(n>1)return response(bytes.subarray(4),206,{'content-range':'bytes 4-9/10'});
    first=stalled();return first;
  });
  const result=await S.downloadBlob(blob,{...w.options,onBytes:loaded=>{if(loaded===4)first.destroy(Object.assign(new Error('reset'),{code:'ECONNRESET'}));}});assert.deepEqual(fs.readFileSync(result.path),bytes);
  assert.equal(w.calls[1].headers.Range,'bytes=4-');
});
test('cancelamento encerra o corpo e não inicia nova tentativa',async t=>{
  const controller=new AbortController();
  const w=world(t,()=>{const res=stalled();res.once('data',()=>setImmediate(()=>controller.abort()));return res;});
  await assert.rejects(S.downloadBlob(blob,{...w.options,signal:controller.signal}),err=>err.code==='cancelled');
  assert.equal(w.calls.length,1);assert.equal(fs.existsSync(path.join(w.dir,blob.name+'.parcial')),false);
});
test('sem ETag forte nova tentativa reinicia do zero',async t=>{
  const w=world(t,(_,n)=>{if(n===1){const res=stalled();res.headers={etag:'W/"weak"'};return res;}return response(bytes);});
  const result=await S.downloadBlob(blob,w.options);assert.deepEqual(fs.readFileSync(result.path),bytes);
  assert.equal(w.calls[1].headers.Range,undefined);
});
test('falhas repetidas têm limite e removem somente o arquivo parcial',async t=>{
  const w=world(t,()=>stalled());const target=path.join(w.dir,blob.name);fs.writeFileSync(target,'cache anterior');
  await assert.rejects(S.downloadBlob(blob,{...w.options,networkRetries:2}),/após 3 tentativas/);
  assert.equal(fs.readFileSync(target,'utf8'),'cache anterior');assert.equal(w.calls.length,3);
  assert.equal(fs.existsSync(target+'.parcial'),false);
});
