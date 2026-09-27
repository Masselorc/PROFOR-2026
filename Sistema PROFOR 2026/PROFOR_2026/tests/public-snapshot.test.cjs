'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const D=require('../domain.js');
const {projectPublicState}=require('../../../tools/build_public_docs.cjs');
const docsFile=path.resolve(__dirname,'../../../docs/dados_publicos.js');
const privateKeys=new Set(['reviews','diligences','history','attachments','note','document','url','ouvidoria','falaBR','conclusion','sei','lastBackup','isDeleted','deletedAt','deletedBy','token','expected','activity','source']);
function verify(value,where='snapshot'){
  if(!value||typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)){
    assert.ok(!privateKeys.has(key),`${where}.${key} é privado`);
    verify(child,`${where}.${key}`);
  }
}
test('projeção publica somente campos oficiais e não copia conteúdo interno',()=>{
  const imported={id:'1',numero:'000001/2026',uf:'AP',programa:D.PROGRAM,cnpj:'',proponente:'Teste',orgao:'',objeto:'Objeto público',situacao:'Enviada',data:'2026-09-01',vigenciaInicio:'',vigenciaFim:'',repasse:100,contrapartida:0,global:100,pad:[{id:'11',descricao:'Item público',quantidade:'1',unitario:100,total:100}]};
  const proposal=D.createProposal(imported);
  proposal.reviews.pad['11'].note='SEGREDO-INTERNO';
  proposal.reviews.pad['11'].attachments=[{id:'anexo',data:'data:application/pdf;base64,AAAA'}];
  proposal.diligences=[{request:'SEGREDO-DILIGENCIA'}];
  proposal.history=[{event:'SEGREDO-HISTORICO'}];
  const state={...D.initialState(),proposals:[proposal],sync:{at:'2026-09-01T00:00:00Z',source:'SEGREDO-OPERACIONAL',count:1}};
  const result=projectPublicState(state,[{date:'2026-09-01',at:'2026-09-01T00:00:00Z',source:'SEGREDO-OPERACIONAL',activity:[{message:'SEGREDO-ATIVIDADE'}],changes:[{numero:imported.numero,uf:'AP',field:'objeto',before:'Antes',after:'Depois'},{numero:imported.numero,uf:'AP',field:'note',before:'',after:'SEGREDO-INTERNO'}]}]);
  verify(result);
  assert.equal(result.proposals[0].imported.pad[0].id,undefined);
  assert.deepEqual(result.sync,{at:'2026-09-01T00:00:00Z'});
  assert.equal(result.syncHistory[0].changes.length,1);
  assert.doesNotMatch(JSON.stringify(result),/SEGREDO-|data:application/);
});
test('docs/dados_publicos.js não contém estruturas privadas',()=>{
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(docsFile,'utf8'),context);
  const result=context.window.PROFOR_PUBLIC_DATA;
  verify(result);
  assert.doesNotMatch(JSON.stringify(result),/data:[^\s"']+/i);
  assert.equal(result.proposals.length,9);
});
