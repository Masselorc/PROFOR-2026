'use strict';
const D=require('../../domain.js');
function syntheticProposal(){
 const p=D.createProposal({id:'990900',numero:'TESTE-990900/2026',uf:'RS',programa:D.PROGRAM,proponente:'DADOS FICTÍCIOS ISOLADOS',cnpj:'',orgao:'',objeto:'Objeto de teste',situacao:'Proposta/Plano de Trabalho Enviado para Análise',data:'2026-09-15',repasse:10000,contrapartida:100,global:10100,pad:[{id:'11',descricao:'Item sintético',quantidade:'2.5',unitario:4040,total:10100}]});
 D.setTextos(p,{capacidade:'Texto oficial sintético',caracterizacao:'Caracterização sintética'},'Fixture');return p;
}
module.exports={syntheticProposal,syntheticState:()=>({...D.initialState(),proposals:[syntheticProposal()]})};
