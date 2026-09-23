async (page) => {
  // Executar com playwright-cli run-code --filename=tests/ui-flow.js.
  // Usa somente o perfil isolado profor-qa, inicialmente vazio ou sem análises.
  // Fluxo novo: o botão principal é "↻ Sincronizar com o Transferegov"
  // (#import-open). A rota /api/sync é interceptada com um payload determinístico,
  // sem rede e sem depender da origem pública. O anexo de CSV continua sendo
  // exercitado, porque é a contingência oferecida dentro do diálogo de sincronização.
  const root='./';
  // O runner pode apontar para uma origem efêmera (porta 0) e offline; sem isso,
  // mantém-se o servidor local padrão em http://127.0.0.1:8766.
  const base=page.__PROFOR_BASE || 'http://127.0.0.1:8766';
  const step=name=>{page.__PROFOR_STEP=name;};
  const verify=(ok,msg)=>{if(!ok)throw new Error(msg);};
  const chooseStatus=async(root,value)=>{await root.locator('[data-status-toggle]').click();await root.locator(`[data-status-value="${value}"]`).click();};
  const editStatus=async root=>{await root.locator('[data-status-toggle]').click();await root.locator('[data-status-details]').click();};
  const outcomes=[];
  const syncPath='**/api/sync*';
  // O perfil profor-qa é persistente entre execuções. Zera o banco local antes de
  // começar para que o teste seja determinístico (o teste antigo assumia perfil vazio).
  const resetStore=async target=>{
    for(let attempt=0;attempt<3;attempt++){
      const current=await target.evaluate(()=>ProforStore.read());
      if(!current.proposals.length)return;
      try{await target.evaluate(async()=>{const s=await ProforStore.read();await ProforStore.save({...Profor.initialState(),revision:s.revision,proposals:[]},s.revision);});return;}
      catch{/* revisão mudou: relê e tenta de novo */}
    }
    throw new Error('Não foi possível zerar o banco local do perfil de teste.');
  };
  // Propostas fictícias servidas pela rota interceptada. O teste não semeia o
  // banco: começa vazio e depende da sincronização, que é o caminho real do usuário.
  const proposal101={id:'101',numero:'TESTE-101/2026',uf:'AP',programa:'3000020260022',proponente:'DADOS FICTÍCIOS — TESTE',cnpj:'',orgao:'',objeto:'Exclusivo para teste automatizado',situacao:'Teste',data:'2026-09-15',repasse:10000,contrapartida:100,global:10100,pad:[{id:'11',descricao:'Item fictício',quantidade:'2',unitario:5050,total:10100}]};
  const proposal102={id:'102',numero:'TESTE-102/2026',uf:'PE',programa:'3000020260022',proponente:'DADOS FICTÍCIOS — SEGUNDA',cnpj:'',orgao:'',objeto:'Segunda proposta fictícia do teste',situacao:'Teste',data:'2026-09-16',repasse:20000,contrapartida:200,global:20200,pad:[{id:'21',descricao:'Item fictício B',quantidade:'1',unitario:20200,total:20200}]};
  const buildPayload=(pad,unchanged)=>({
    proposals:[proposal101,pad?proposal102:{...proposal102,pad:null}],
    warnings:['PE: proposta fictícia para teste automatizado.'],
    source:{kind:'transferegov-downloads',url:'https://api-publica.transferegov.gestao.gov.br/downloads',pad,listedAt:'2026-09-15T12:00:00.000Z',blobs:[],files:[{name:'siconv_programa.zip',bytes:11123607,rows:2}]},
    stats:{programIds:1,proposalIds:2,proposals:2,padItems:pad?2:0,durationMs:1234},
    ...(unchanged?{unchanged:true,cachedAt:'2026-09-15T12:00:05.000Z'}:{})
  });
  const calls=[];
  const callIndex=()=>calls.length;
  await page.route(syncPath,async route=>{
    const url=route.request().url();
    calls.push(url);
    const index=callIndex();
    const pad=!/[?&]pad=0(?:&|$)/.test(url);
    // Segunda chamada simula cache quente do servidor: mesmo payload com unchanged.
    await route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(buildPayload(pad,index>1))});
  });

  await page.goto(`${base}/PROFOR_2026.html`);
  await page.getByRole('heading',{name:'Visão geral das propostas',exact:true}).waitFor();
  await resetStore(page);
  calls.length=0; // o interceptador vive na página: zera o contador junto com o banco
  await page.reload();
  await page.getByRole('heading',{name:'Visão geral das propostas',exact:true}).waitFor();
  // Banco local vazio: é exatamente o cenário do defeito do cache quente.
  const before=await page.evaluate(()=>ProforStore.read());
  verify(before.proposals.length===0,'Perfil de teste deveria começar sem propostas');
  verify((await page.locator('main').innerText()).includes('pronto para receber as propostas'),'Estado vazio do painel ausente');

  // Dispara a sincronização pelo caminho principal da página.
  step('sincronização inicial');
  const primary=page.getByRole('button',{name:'↻ Sincronizar com o Transferegov',exact:true});
  verify(await primary.count()===1,'Botão principal de sincronização ausente');
  await primary.click();
  const dialogTitle=page.getByRole('heading',{name:'Sincronizar com o Transferegov',exact:true});
  // O diálogo abre e pode ser substituído pelo resumo em poucos milissegundos:
  // espera a abertura pelo DOM e confere o título como asserção, sem corrida.
  await page.locator('#modal[open]').waitFor();
  verify((await page.locator('#modal-title').innerText()).trim().length>0,'Diálogo de sincronização sem título');
  // Enquanto o servidor responde, o diálogo mostra progresso. A resposta aqui é
  // imediata (rota interceptada), então o estado "executando" não é observável.
  verify((await page.getByRole('status').innerText()).length>0,'Diálogo de sincronização sem etapa de progresso');

  // Resumo da sincronização (o diálogo troca para "Sincronização concluída").
  await page.getByRole('heading',{name:'Sincronização concluída',exact:true}).waitFor();
  const summary=await page.getByRole('dialog').innerText();
  verify(summary.includes('2 proposta(s)'),'Resumo não informa as 2 propostas recebidas');
  verify(summary.includes('2 alteração(ões)'),'Resumo não informa as 2 alterações registradas');
  verify(summary.includes('PE') && summary.includes('AP'),'Resumo não informa as UFs cobertas');
  // A contingência offline continua oferecida ao final da sincronização.
  verify(await page.getByRole('button',{name:'Modo offline: anexar arquivos CSV',exact:true}).count()===1,'Contingência de anexo CSV ausente no diálogo');
  verify(calls.length===1 && calls[0].includes('/api/sync'),'A rota /api/sync não foi chamada exatamente uma vez');
  verify(calls[0].includes('force=1'),'Primeira sincronização com banco local vazio deveria forçar a extração');
  outcomes.push('Sincronização pelo botão principal: diálogo, progresso, resumo com 2 propostas e 2 UFs');

  // Fecha pelo cabeçalho do diálogo (o botão de canto tem nome acessível "Fechar janela").
  await page.locator('#modal-close').click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('link',{name:'▦ Painel geral',exact:true}).click();

  // Regressão do cache quente: o servidor responde `unchanged:true` COM payload.
  // O banco local já tem propostas, então a conferência é registrada sem perder dado.
  step('cache quente (unchanged com payload)');
  verify(await page.locator('#modal').evaluate(el=>el.open)===false,'O diálogo anterior ficou aberto');
  await page.getByRole('button',{name:'↻ Sincronizar com o Transferegov',exact:true}).click();
  await page.locator('#modal[open]').waitFor();
  await page.getByRole('heading',{name:'Nenhuma alteração desde a última sincronização',exact:true}).waitFor();
  const warmSummary=await page.getByRole('dialog').innerText();
  verify(warmSummary.includes('2 proposta(s)'),'Resposta com unchanged não trouxe as propostas para o resumo');
  await page.locator('#modal-close').click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  const afterWarm=await page.evaluate(()=>ProforStore.read());
  verify(afterWarm.proposals.length===2,'Banco local perdeu propostas após resposta unchanged');
  verify(calls.length===2 && !calls[1].includes('force='),'Segunda sincronização com banco preenchido não deveria forçar a extração');

  await page.getByRole('link',{name:'TESTE-101/2026',exact:true}).click();
  await page.getByRole('heading',{name:'Amapá / AP'}).waitFor();
  outcomes.push('Sincronização gravou a extração no banco local e o painel abriu a proposta');
  step('análise da proposta');
  await page.getByRole('button',{name:'Concluir análise técnica',exact:true}).click();
  verify((await page.getByRole('dialog').innerText()).includes('Há pendências'),'Conclusão deveria estar bloqueada');
  await page.getByRole('button',{name:'Voltar à análise'}).click();
  await page.getByRole('link',{name:'Plano de Aplicação Detalhado',exact:true}).click();
  await chooseStatus(page.locator('[data-status-dropdown][data-group="pad"]'),'diligencia');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  verify((await page.getByRole('alert').innerText()).includes('observação'),'Justificativa vazia deveria ser rejeitada');
  await page.getByRole('textbox',{name:'Providência solicitada / justificativa',exact:true}).fill('Pedir pesquisa — teste');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  const integrated=await page.evaluate(()=>ProforStore.read());
  const integratedProposal=integrated.proposals.find(p=>p.id==='101');
  verify(integratedProposal.diligences.length===1 && integratedProposal.diligences[0].ref==='pad:11','Diligência não criada junto com a análise');
  verify(integratedProposal.diligences[0].request==='Pedir pesquisa — teste','Providência não reaproveitou a justificativa');
  outcomes.push('Bloqueio da conclusão, justificativa obrigatória e criação integrada da diligência');
  await editStatus(page.locator('[data-status-dropdown][data-group="pad"]'));
  await page.getByLabel('Providência solicitada / justificativa',{exact:true}).fill('Apresentar pesquisa de preços — dado fictício de teste');
  await page.getByLabel('Data da comunicação',{exact:true}).fill('2026-09-16');
  await page.getByLabel('Data da resposta',{exact:true}).fill('2026-09-18');
  await page.getByRole('combobox',{name:'Situação',exact:true}).selectOption('saneada');
  await page.getByLabel('Observação / conclusão',{exact:true}).fill('Comprovado em teste');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await page.getByRole('heading',{name:'Diligência saneada',exact:true}).waitFor();
  let db=await page.evaluate(()=>ProforStore.read());
  verify(db.proposals.find(p=>p.id==='101').reviews.pad['11'].status==='diligencia','Saneamento atualizou requisito sem confirmação');
  await page.getByRole('button',{name:'Sim, atualizar',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  outcomes.push('Saneamento exige confirmação separada do requisito');
  await editStatus(page.locator('[data-status-dropdown][data-group="pad"]'));
  verify(await page.getByRole('dialog').locator('[name="document"], [name="url"]').count()===0,'PAD não deve exibir campos de documento');
  await page.getByRole('combobox',{name:'Resultado',exact:true}).focus();
  await page.keyboard.press('Tab');
  verify(await page.getByRole('textbox',{name:'Observação / justificativa',exact:true}).evaluate(el=>el===document.activeElement),'Tab de Resultado não focou Observação');
  outcomes.push('Navegação por Tab do Resultado para a observação após saneamento');
  for(const [tab,count] of [['Mérito',10]]){
    await page.getByRole('link',{name:tab,exact:true}).click();
    await page.locator('#tab-content h2').filter({hasText:tab}).waitFor({state:'visible'});
    for(let index=0;index<count;index++){
      await chooseStatus(page.locator('[data-status-dropdown][data-group="merito"]').nth(index),'ok');
    }
  }
  await page.getByRole('button',{name:'Concluir análise técnica',exact:true}).click();
  await page.getByRole('button',{name:'Registrar conclusão técnica',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  verify((await page.locator('main').innerText()).includes('Pendente de celebração'),'Celebração não deveria estar apta');
  await page.getByRole('button',{name:'Editar informações',exact:true}).click();
  await page.getByRole('combobox',{name:'Instituição da Ouvidoria',exact:true}).selectOption('pendente');
  await page.getByLabel('Confirmei a aplicabilidade da cláusula suspensiva no instrumento.').check();
  await page.getByLabel('Data da assinatura',{exact:true}).fill('2026-09-15');
  await page.getByRole('combobox',{name:'Adesão ao Fala.BR',exact:true}).selectOption('nao_previsto');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  /* A Lista de Conferência dos autos (SEI nº 36183977) é conferida em duas abas,
     antes de "Diligências": 7 itens na proposta e 13 na formalização — os mesmos 20
     itens de antes, gravados na MESMA coleção `reviews.celebracao`. */
  const abas=[['Requisitos da Proposta',7],['Requisitos para Formalização',13]];
  for(const [aba,count] of abas){
    await page.getByRole('link',{name:aba,exact:true}).click();
    /* O handler de hashchange roda depois do clique: espera o título da NOVA aba
       antes de contar, senão a contagem cai na tabela da aba anterior. */
    await page.locator('#tab-content h2').filter({hasText:aba}).first().waitFor({state:'visible'});
    const linhas=await page.locator('.req-table tbody tr').count();
    verify(linhas===count,`Aba ${aba}: ${linhas} linha(s) para ${count} requisito(s)`);
    for(let index=0;index<count;index++){
      await chooseStatus(page.locator('[data-status-dropdown]').nth(index),'ok');
    }
  }
  db=await page.evaluate(()=>ProforStore.read());
  verify(Object.values(target().reviews.celebracao).every(r=>r.status==='ok'),'Os 20 itens de celebração não ficaram atendidos nas duas abas');
  verify(Object.keys(target().reviews).join(',')==='habilitacao,merito,celebracao,pad','A divisão em abas criou coleção de estado própria');
  verify((await page.locator('main').innerText()).includes('Formalização com cláusula suspensiva'),'Cláusula e Fala.BR impediram formalização');
  outcomes.push('31 análises pela interface (1 PAD + 10 de mérito + 7 da proposta + 13 da formalização na mesma coleção); conclusão técnica separada da celebração; cláusula e Fala.BR');
  step('relatório e backup');
  await page.getByRole('button',{name:'Gerar relatório',exact:true}).click();
  verify(await page.getByRole('heading',{name:'13. Situação final da análise',exact:true}).count()===1,'Relatório incompleto');
  verify(await page.getByRole('heading',{name:'10. Requisitos da Proposta',exact:true}).count()===1,'Relatório sem a aba da proposta');
  verify(await page.getByRole('heading',{name:'11. Requisitos para Formalização',exact:true}).count()===1,'Relatório sem a aba da formalização');
  const reportDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'Salvar HTML',exact:true}).click();
  await (await reportDownload).saveAs(root+'output/playwright/relatorio-teste.html');
  await page.getByRole('button',{name:'Fechar janela',exact:true}).click();
  await page.getByRole('button',{name:'⇩ Backup e exportação',exact:true}).click();
  const backupDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'Exportar backup JSON',exact:true}).click();
  await (await backupDownload).saveAs(root+'output/playwright/backup-teste.json');
  await page.getByLabel('Restaurar backup JSON',{exact:true}).setInputFiles(root+'output/playwright/backup-teste.json');
  await page.getByRole('button',{name:'Validar restauração',exact:true}).click();
  await page.getByRole('button',{name:'Restaurar este backup',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  const persisted=await page.evaluate(async()=>({state:await ProforStore.read(),recovery:await ProforStore.read('recovery')}));
  verify(persisted.state.proposals.length===2 && persisted.recovery.proposals.length===2,'Restauração ou recuperação falhou');
  outcomes.push('Downloads HTML/JSON, restauração transacional e cópia de recuperação');
  await page.getByLabel('Buscar proposta ou proponente').fill('NÃO EXISTE');
  verify(await page.getByText('Nenhuma proposta corresponde aos filtros.',{exact:true}).count()===1,'Filtro sem resultado falhou');
  await page.getByLabel('Buscar proposta ou proponente').fill('');
  await page.setViewportSize({width:390,height:844});
  verify(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow horizontal da página');
  await page.screenshot({path:root+'output/playwright/painel-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('link',{name:'TESTE-101/2026',exact:true}).click();
  await page.getByRole('link',{name:'Plano de Aplicação Detalhado',exact:true}).click();
  await page.screenshot({path:root+'output/playwright/pad-testado.png',fullPage:true});
  outcomes.push('Pesquisa, estado vazio e layout 390px sem overflow da página');

  // Contingência offline: o anexo de CSV dentro do diálogo de sincronização.
  step('contingência offline (anexo CSV)');
  await page.getByRole('link',{name:'▦ Painel geral',exact:true}).click();
  await page.getByRole('button',{name:'↻ Sincronizar com o Transferegov',exact:true}).click();
  await dialogTitle.waitFor();
  await page.getByRole('button',{name:'Modo offline: anexar arquivos CSV',exact:true}).click();
  await page.getByRole('heading',{name:'Modo offline: anexar arquivos CSV do Transferegov',exact:true}).waitFor();
  for(const [field,file] of [['program','siconv_programa.csv'],['links','siconv_programa_proposta.csv'],['proposal','siconv_proposta.csv'],['pad','siconv_plano_aplicacao_detalhado.csv']])await page.locator(`[name="${field}"]`).setInputFiles(root+'tests/fixtures/'+file);
  await page.getByRole('button',{name:'Conferir importação',exact:true}).click();
  await page.getByRole('heading',{name:'Conferir importação',exact:true}).waitFor();
  await page.getByRole('button',{name:'Confirmar importação',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  const afterImport=await page.evaluate(()=>ProforStore.read());
  verify(afterImport.proposals.some(p=>p.id==='101'),'Contingência offline não preservou a proposta do teste');
  outcomes.push('Contingência offline de anexo CSV dentro do diálogo de sincronização');

  const historyEvents=(await page.evaluate(()=>ProforStore.read())).proposals.length;
  console.log(JSON.stringify({passed:outcomes,syncCalls:calls.length,proposals:persisted.state.proposals.length,historyEvents}));
}
