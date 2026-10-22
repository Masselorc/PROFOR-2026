'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require(process.env.PROFOR_PUBLIC_DOMAIN_TEST || '../../../docs/domain.js');
test('publicação mostra conclusão favorável vigente com pendência posterior preservada',()=>{
  const p=D.createProposal({id:'101',numero:'TESTE-101/2026',uf:'AP',programa:D.PROGRAM,proponente:'DADOS FICTÍCIOS',cnpj:'',orgao:'',objeto:'Teste de publicação',situacao:'Proposta/Plano de Trabalho Enviado para Análise',data:'2026-09-15',repasse:10000,contrapartida:100,global:10100,pad:[{id:'11',descricao:'Item fictício',quantidade:'2',unitario:5050,total:10100}]});
  for(const r of D.referenceRows(p))D.markReview(p,r.group,r.id,true,'Teste');
  p.diligences.push({id:'pendencia-teste',ref:'celebracao:4',request:'Ausente o TR.',status:'aberta'});
  D.confirmConclusion(p,{result:'favoravel',reference:'Evidências sintéticas',expectedEvidence:D.technicalEvidence(p),operationId:D.uid()},'Teste');
  assert.equal(D.situation(p),'Aprovada');
  assert.equal(p.diligences[0].status,'aberta');
  p.imported.objeto+=' alterado';
  assert.equal(D.situation(p),'Requer nova análise');
});
