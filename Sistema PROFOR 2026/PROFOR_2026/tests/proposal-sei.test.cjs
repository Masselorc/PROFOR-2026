'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../domain.js');
const imported=id=>({id,numero:id+'/2026',uf:'AP',programa:D.PROGRAM,proponente:'TESTE FICTÍCIO',cnpj:'',orgao:'',objeto:'Teste',situacao:'Teste',data:'2026-09-01',repasse:0,contrapartida:0,global:0,pad:[]});
const fixture=()=>({...D.initialState(),proposals:[D.createProposal(imported('990001')),D.createProposal(imported('990002'))]});
test('SEI manual é individual, auditado e preservado na sincronização e backup',()=>{
  const s=fixture(),p=s.proposals[0];
  D.validateState(s); // Legados sem o campo continuam válidos.
  D.setSei(p,{number:' 00000.000001/2026-00 ',url:' https://example.invalid/processo?a=1&b=2 '},'Teste');
  assert.equal(p.sei.number,'00000.000001/2026-00');
  assert.equal(s.proposals[1].sei,undefined);
  assert.equal(p.history.at(-1).actor,'Teste');
  assert.deepEqual(p.history.at(-1).after,p.sei);
  const synced=D.syncProposals(s,[{...imported('990001'),objeto:'Objeto atualizado'}],'fixture').state;
  const restored=JSON.parse(JSON.stringify(synced));D.validateState(restored);
  assert.deepEqual(restored.proposals[0].sei,p.sei);
  const before=D.clone(p.sei);D.setSei(p,{number:'',url:''},'Teste');
  assert.deepEqual(p.history.at(-1).before,before);
  assert.deepEqual(p.sei,{number:'',url:''});D.validateState(s);
});
test('SEI rejeita cadastro incompleto e links inseguros sem alterar proposta',()=>{
  const s=fixture(),p=s.proposals[0],before=D.clone(p);
  for(const data of [{number:'Número',url:''},{number:'',url:'https://example.invalid'}, {number:'Número',url:'javascript:alert(1)'},{number:'Número',url:'https://user:pass@example.invalid'}]){
    assert.throws(()=>D.setSei(p,data,'Teste'));assert.deepEqual(p,before);
  }
  for(const sei of [null,[],{number:42,url:''},{number:'Número',url:''},{number:'Número',url:'data:text/html,teste'}]){
    p.sei=sei;assert.throws(()=>D.validateState(s));
  }
});
test('relatório não confunde o processo geral com o processo da proposta',()=>{
  globalThis.Profor=D;require('../report.js');
  const p=fixture().proposals[0];
  assert.ok(!globalThis.ProforReport.html(p).includes('08016.010062/2026-18'));
  assert.ok(globalThis.ProforReport.html(p).includes('Não cadastrado'));
  D.setSei(p,{number:'00000.000001/2026-00',url:'https://example.invalid/processo'},'Teste');
  assert.ok(globalThis.ProforReport.html(p).includes(p.sei.number));
  assert.ok(globalThis.ProforReport.html(p).includes(p.sei.url));
});
