'use strict';

const {runAndPersist}=require('./sync-service.cjs');

async function main(run=runAndPersist){
  try{
    const summary=await run({onMessage:message=>console.log(`[${new Date().toISOString()}] ${message}`)});
    console.log('Resumo:',JSON.stringify(summary));
    process.exitCode=0;
  }catch(err){
    console.error(`[${new Date().toISOString()}] ERRO: ${err.message}`);
    process.exitCode=1;
  }
}

if(require.main===module)main();
module.exports={main};
