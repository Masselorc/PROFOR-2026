'use strict';
/* Rodada completa isolada. Reutiliza os runtimes informados por ambiente;
 * não instala dependências, inicia a aplicação operacional ou publica dados.
 * Executar na aplicação: node tests/run-seis-correcoes.cjs
 * Logs ficam em output/seis-correcoes-2026-10-02/final (fora do Git).
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {spawnSync,execFileSync}=require('node:child_process');
const APP=path.resolve(__dirname,'..'),ROOT=path.resolve(APP,'../..');
const OUTPUT=path.join(ROOT,'output/seis-correcoes-2026-10-02/final');
const {MIRRORS}=require('../../../tools/build_public_docs.cjs');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const manifest=path.join(ROOT,'output/seis-correcoes-2026-10-02/backup/manifesto.json');
function checkRecords(){
 if(!fs.existsSync(manifest))throw Error('Manifesto inicial do banco não disponível. Preserve e verifique o backup antes da rodada.');
 const baseline=JSON.parse(fs.readFileSync(manifest,'utf8').replace(/^\uFEFF/,''));
 const records=path.join(APP,'dados/registros');
 const actual=walk(records).map(file=>({name:path.relative(records,file),sha256:hash(file).toUpperCase(),bytes:fs.statSync(file).size})).sort((a,b)=>a.name.localeCompare(b.name));
 const expected=baseline.records.slice().sort((a,b)=>a.name.localeCompare(b.name));
 if(JSON.stringify(actual)!==JSON.stringify(expected.map(x=>({name:x.name,sha256:x.sha256,bytes:x.bytes}))))throw Error('Arquivos ou hashes do banco divergem da linha de base. Nenhuma restauração automática foi feita.');
 if(hash(path.join(ROOT,'docs/dados_publicos.js')).toUpperCase()!==baseline.snapshotSha256)throw Error('Snapshot operacional diverge da linha de base.');
 for(const item of expected){const file=path.join(path.dirname(manifest),'registros',item.name);if(hash(file).toUpperCase()!==item.sha256)throw Error('Backup divergente.');}
 return {files:actual.length,bytes:actual.reduce((n,f)=>n+f.bytes,0),unchanged:true,backupVerified:true,snapshotUnchanged:true};
}
fs.mkdirSync(OUTPUT,{recursive:true});
const start=new Date().toISOString(),results=[],protectionBefore=checkRecords();
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
const branch=execFileSync('git',['branch','--show-current'],{cwd:ROOT,encoding:'utf8'}).trim();
const testedFiles=walk(APP).filter(f=>!/[\\/](dados|output|\.cache|logs|node_modules)[\\/]/.test(f)&&/\.(js|cjs|css|html)$/.test(f));
const testedHashes=testedFiles.map(f=>({file:path.relative(ROOT,f),sha256:hash(f)}));
function run(name,args){
 const at=new Date().toISOString();process.stdout.write(name+' ... ');
 const result=spawnSync(process.execPath,args,{cwd:APP,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,env:process.env});
 const output=(result.stdout||'')+(result.stderr||'')+(result.error?'\n'+result.error.message:'');
 fs.writeFileSync(path.join(OUTPUT,name+'.log'),output);
 const entry={name,command:[process.execPath,...args],startedAt:at,finishedAt:new Date().toISOString(),exitCode:result.status,status:result.status===0?'PASS':'FAIL'};
 if(name==='node-tests'){
  for(const key of ['tests','pass','fail','cancelled','skipped','todo'])entry[key]=Number(output.match(new RegExp('(?:^|\\n)# '+key+' (\\d+)'))?.[1]??0);
  if(!entry.tests){entry.status='FAIL';entry.reason='Resumo TAP ausente; nenhuma aprovação inferida.';}
 }
 results.push(entry);console.log(entry.status);
}
const nodeTests=fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.cjs')).sort().map(f=>'tests/'+f);
run('node-tests',['--test','--test-reporter=tap',...nodeTests]);
for(const name of ['prioridades-ui','seis-correcoes-ui','analise-merito','anexos-requisitos','review-diligence','textos-oficiais','pad-batch','pad-filters','painel-expand','public-pages','sync-changes-uf','cnpj-format','proposal-sei'])run(name,['tests/'+name+'.cjs']);
const mirrors=MIRRORS.map(name=>({name,equal:hash(path.join(APP,name))===hash(path.join(ROOT,'docs',name)),sha256:hash(path.join(APP,name))}));
const protectionAfter=checkRecords();
const codeUnchanged=testedHashes.every(item=>hash(path.join(ROOT,item.file))===item.sha256);
const initialSha='fa05e8ab3bd1d220c28bb657dc0fea8e12bec773',prefix='Sistema PROFOR 2026/PROFOR_2026/';
const audited=file=>execFileSync('git',['show',initialSha+':'+prefix+file],{cwd:ROOT,maxBuffer:8*1024*1024});
const sandbox={module:{exports:{}},URL,crypto:globalThis.crypto};vm.runInNewContext(audited('domain.js').toString(),sandbox);
const before=sandbox.module.exports,D=require('../domain.js');
const preservation={
 constants:Object.fromEntries(['PROGRAM','UFS','REQUIREMENTS','CELEBRACAO','ABAS_CELEBRACAO','CATEGORIES','CAMPOS_TEXTOS','STATUSES','DSTATUS'].map(k=>[k,JSON.stringify(D[k])===JSON.stringify(before[k])])),
 money:Object.fromEntries(['moneyBR','quantityBR','multiply','unitFromTotal','unitMatchesTotal'].map(k=>[k,D[k].toString()===before[k].toString()])),
 technicalFingerprintV1:D.technicalEvidence.toString()===before.technicalEvidence.toString(),
 core:Object.fromEntries(['workspace-store.cjs','server.cjs','sync-service.cjs','transferegov-sync.cjs','sync-apply.js','sincronizar-profor.cjs','storage.js','transferegov.js'].map(f=>[f,audited(f).equals(fs.readFileSync(path.join(APP,f)))]))
};
const preserved=[...Object.values(preservation.constants),...Object.values(preservation.money),preservation.technicalFingerprintV1,...Object.values(preservation.core)].every(Boolean);
const result={startedAt:start,finishedAt:new Date().toISOString(),sha,branch,delivery:'sem commit',node:process.version,platform:process.platform,architecture:process.arch,timezone:'America/Sao_Paulo',results,mirrors,protectionBefore,protectionAfter,codeUnchanged,preservation,testedHashes};
fs.writeFileSync(path.join(OUTPUT,'resultado.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({nodeTests:results[0],harnesses:results.length-1,mirrorsEqual:mirrors.every(x=>x.equal),protection:protectionAfter,codeUnchanged,preserved},null,2));
if(results.some(x=>x.status!=='PASS')||mirrors.some(x=>!x.equal)||!codeUnchanged||!preserved)process.exitCode=1;
