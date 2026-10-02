/** Gera consulta integral em modo leitura e espelha os módulos canônicos.
 * Uso: node tools/build_public_docs.cjs [--mirror-only]
 * Testes: build({state, history, outputDir, quiet:true}) em saída temporária.
 * Não publica, sincroniza a origem ou grava o banco operacional.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT_DIR=path.resolve(__dirname,'..');
const SYSTEM_DIR=path.join(ROOT_DIR,'Sistema PROFOR 2026','PROFOR_2026');
const DOCS_DIR=path.join(ROOT_DIR,'docs');
const D=require(path.join(SYSTEM_DIR,'domain.js'));
const {createStore}=require(path.join(SYSTEM_DIR,'workspace-store.cjs'));
const MIRRORS=['domain.js','sync-apply.js','bandeiras-uf.js','styles.css','report.js','app.js'];
const COMPLEMENTS=['index.html','public-storage.js','.nojekyll','programa/tutorial-concedente-analise.pdf','programa/edital-37-dou.pdf','programa/portaria-327-2024.pdf','programa/decreto-11531-2023.pdf','programa/in-65-2021.pdf','programa/tutorial-envio-proposta.pdf','programa/requisitos-celebracao-pc28.pdf','programa/edital-38-sei.html'];
function projectPublicState(state,history){
  // Dados completos: avaliações, anexos, diligências, histórico e exclusões.
  // Token da cadeia é externo ao estado; não integra a projeção.
  return {...D.clone(state),syncHistory:D.clone(Array.isArray(history)?history:[])};
}
function build(options={}){
  const outputDir=path.resolve(options.outputDir||DOCS_DIR),say=options.quiet?()=>{}:console.log;
  if(outputDir===DOCS_DIR)for(const name of COMPLEMENTS)if(!fs.existsSync(path.join(outputDir,name)))throw new Error(`Complemento obrigatório ausente: ${name}`);
  let publicState,updatedAt;
  if(!options.mirrorOnly){
    let state=options.state,history=options.history;
    if(!state){
      const store=createStore(options.recordsDir||path.join(SYSTEM_DIR,'dados','registros')),loaded=store.load();
      if(!loaded.exists)throw new Error('Banco real indisponível: use --mirror-only. Snapshot anterior preservado.');
      state=loaded.state;history=store.history();
    }
    D.validateState(D.clone(state));publicState=projectPublicState(state,history);D.validateState(publicState);
    updatedAt=options.updatedAt||new Date().toISOString();
    if(!Number.isFinite(Date.parse(updatedAt)))throw new Error('Data de geração inválida.');
  }
  fs.mkdirSync(outputDir,{recursive:true});
  if(publicState){
    const target=path.join(outputDir,'dados_publicos.js'),temp=target+'.tmp';
    const js=`/** Snapshot integral de consulta PROFOR/ONASP 2026. Gerado em ${updatedAt}.
 * Não editar manualmente. Use tools/build_public_docs.cjs. */
window.PROFOR_PUBLIC_UPDATED_AT = ${JSON.stringify(updatedAt)};
window.PROFOR_PUBLIC_DATA = ${JSON.stringify(publicState,null,2)};
`;
    fs.writeFileSync(temp,js,'utf8');fs.renameSync(temp,target);
    say(`Snapshot local gerado: revisão ${publicState.revision}, ${publicState.proposals.length} propostas (${D.activeProposals(publicState).length} ativas).`);
  }
  for(const file of MIRRORS)fs.copyFileSync(path.join(SYSTEM_DIR,file),path.join(outputDir,file));
  say('Módulos canônicos espelhados; nenhuma publicação executada.');
  return {outputDir,revision:publicState?.revision??null,updatedAt:updatedAt||null,mirrors:MIRRORS.slice()};
}
if(require.main===module){const args=process.argv.slice(2);if(args.some(x=>x!=='--mirror-only'))throw new Error('Única opção CLI: --mirror-only');build({mirrorOnly:args.includes('--mirror-only')});}
module.exports={projectPublicState,build,MIRRORS};
