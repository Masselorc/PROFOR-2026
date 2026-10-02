# PROFOR/ONASP 2026 — versão local

## Sincronização automática

`SINCRONIZAR_PROFOR.cmd` executa propostas, PAD e textos oficiais pelo Node.js, grava no banco local e termina sem navegador nem `server.cjs`. Sua trava padrão fica em `os.tmpdir()`, identificada pelo hostname; ela impede apenas duas execuções headless na mesma máquina. Entre computadores, a proteção da gravação permanece em `token`, `revision` e `expected` do `workspace-store.cjs`. O OneDrive não atua como lock distribuído.

## Abrir

**Uso normal, um duplo clique: `INICIAR SISTEMA.cmd`** (nesta pasta), ou o **atalho `PROFOR 2026` da Área de Trabalho**, que aponta para ele. O arquivo liga o servidor local **sem janela nenhuma aparecer** e abre o navegador já no sistema, com os dados carregados. Se o servidor já estiver no ar, ele apenas abre a página — nunca cria uma segunda instância. No painel, abra **Sincronização** e clique em **Atualizar Dados**.

Como instalar o atalho da Área de Trabalho (uma única vez): duplo clique em **`INSTALAR ATALHO.cmd`**. Ele cria o atalho `PROFOR 2026` com o ícone do sistema (`assets\profor.ico`), sem exigir administrador. Para remover, apague o atalho da Área de Trabalho — nada mais é alterado.

Caminho manual equivalente, se algum dia for preciso: `node server.cjs` e abra **http://127.0.0.1:8766/PROFOR_2026.html** (acesso local) ou pelo endereço da intranet **http://<IP_DA_MAQUINA>:8766/PROFOR_2026.html** (ex.: `http://10.119.11.37:8766/` ou `http://MJ-0012666669:8766/` para outros usuários da rede). Ctrl+C encerra o servidor. O servidor aceita conexões locais e de rede interna autorizada, recusa `Host` externo/desconhecido, recebe o estado do aplicativo em JSON e não acessa credenciais.

**Se a tela aparecer com aparência antiga** (colunas desalinhadas, texto estranho no lugar de um dado), recarregue a página com **Ctrl+F5** uma vez. O HTML carrega os scripts com assinatura de versão (`?v=…`), gerada a cada alteração, justamente para impedir que o navegador use arquivo antigo; o Ctrl+F5 cobre o caso da página que já estava aberta antes da atualização.

Durante a sincronização, a janela mostra uma barra única de **0 a 100%**, a etapa em curso e um registro cronológico em linhas, com aparência de terminal. O percentual é calculado por 14 operações: consulta das listas, downloads e leituras dos cinco ZIPs, validação e gravação local. Cada operação tem o mesmo peso; downloads e leituras avançam pelos bytes efetivamente processados. O percentual mede operações concluídas, **não estima o tempo restante**. Se a origem entregar um arquivo incompatível e o download recomeçar, o percentual pode recuar para refletir a nova tentativa. Só chega a 100% depois da gravação no banco local.

Abaixo do registro da janela permanece o **Antes/Depois da última atualização que alterou campos**. Uma atualização concluída sem novidades aparece no histórico, mas não substitui essa comparação. Quando houver novos campos alterados, a comparação passa a mostrar a nova execução.

### Registros de atualização

O menu lateral **Registros de atualização** abre o histórico das execuções concluídas. A comparação do dia reúne cada transição de campo em cartões “Antes/Depois”, agrupados por horário; se um campo mudar duas vezes, os dois cartões permanecem. Valores ausentes ou vazios aparecem como **“Em branco”**. Textos longos e listas de itens do PAD podem ser expandidos. O PAD mostra descrição, quantidade e valores, sem IDs internos. Mudanças apenas nos IDs ou na ordem dos itens não entram na contagem visual de alterações. Os registros de atividade de cada execução ficam no bloco do respectivo horário. Dias com atualizações concluídas sem alteração de conteúdo mostram **“Sem dados novos no dia”**; dias sem execução ficam vazios.

O calendário fica à direita no computador, começa no mês vigente e avança ou recua uma semana por clique nas setas ou pela rolagem sobre ele. Hoje recebe destaque. Uma bolinha laranja marca os dias com campos alterados; o texto ao passar o mouse informa a soma das alterações do dia. A data usada é a de Brasília (`America/Sao_Paulo`).

Os registros novos são guardados junto das versões imutáveis do banco em `dados/registros/`, inclusive as linhas do log. O sistema reconstrói comparações antigas a partir das versões consecutivas já preservadas. Linhas de atividade anteriores a esta função não existiam no banco e são identificadas como indisponíveis. A primeira versão disponível é apenas a base de comparação: alterações anteriores a ela não podem ser reconstruídas. Nenhum registro antigo é regravado.

### Abrir o arquivo HTML direto (não recomendado)

Abrir o HTML diretamente mostra a orientação para usar `INICIAR SISTEMA.cmd`. O servidor local é necessário para ler e gravar o banco no workspace.

### Onde ficam os seus dados (importante)

Desde 16/09/2026, o banco fica em **`dados/registros/`**, nesta pasta do sistema. O servidor grava versões JSON imutáveis contendo propostas, análises, diligências e histórico. O navegador acessa esse banco pela API local; limpar seus dados não apaga os arquivos do workspace.

No primeiro acesso, se a pasta ainda não tiver banco, o sistema copia automaticamente o IndexedDB antigo do navegador/endereço atual, preservando o original. Se o banco da pasta já existir, ele prevalece. A opção **Resgatar banco antigo deste navegador**, em Backup e exportação, permite exportar dados legados para conferir e restaurar explicitamente. Dados de outro perfil, máquina ou origem exigem exportação naquele ambiente.

O OneDrive sincroniza a pasta completa. Marque-a como **Sempre manter neste dispositivo**. Feche o sistema, aguarde o envio terminar na máquina de origem e o download terminar na máquina de destino antes de abrir. Não use as duas máquinas simultaneamente: alterações concorrentes são preservadas e bloqueiam novas gravações até reconciliação. A confirmação de salvamento indica gravação local, não envio concluído pelo OneDrive. Consulte `dados/LEIA-ME.md`.

## Primeiro uso

1. Abra `INICIAR SISTEMA.cmd` ou instale o atalho por `INSTALAR ATALHO.cmd`.
2. Confira a revisão disponível. Os registros manuais usam a identificação “Usuário local” já adotada pelo sistema.
3. Clique em **Sincronização** e, na janela, em **Atualizar Dados**. Essa ação baixa, descompacta e cruza as extrações oficiais de propostas e PAD, consulta os textos oficiais das propostas encontradas e grava o conjunto no banco local. Não há nada para anexar nem arquivo para escolher.
4. Acompanhe a barra, a etapa corrente e o registro de atividades. A operação pode ser cancelada; nada é gravado no banco antes do fim.
5. Ao concluir, confira o resumo (propostas, textos atualizados, alterações, UFs cobertas, itens de PAD e hora) e a tabela de alterações. Se a extração de propostas não tiver mudado, o servidor pode reutilizar seu cache; os textos são conferidos na mesma execução.
6. Abra uma proposta e analise cada aba. Use **Analisar**, preencha o resultado e salve. Observações são obrigatórias em estados críticos.
7. Cadastre diligências a partir dos requisitos. Após saneamento, escolha se quer atualizar o requisito. Informe ciência e confira expediente para confirmar vencimento.
8. Conclua a análise técnica quando os controles permitirem. Continue acompanhando o checklist de celebração.
9. Exporte backup JSON ao fim do trabalho. Verifique o download no computador.

### Origem `file://`

Abrir o HTML por `file://` continua servindo para consultar. Nessa origem a página **não consegue nem consultar o servidor local**: medido em 15/09/2026, `fetch` para `http://127.0.0.1:8766` falha e até uma simples imagem é bloqueada. O menu lateral mostra, só nessa origem, o item **“Ligar servidor”**, que explica como abrir pelo atalho. A razão de fundo é a mesma: a API pública não envia cabeçalhos CORS (verificado em 15/09/2026 11:44Z: `OPTIONS` responde **405** e o `GET` não traz `Access-Control-Allow-Origin`), então o navegador nunca consegue baixar os ZIPs direto — o download tem de ser feito pelo processo Node.

### Arquivos que sobraram do caminho antigo

O sistema já teve um protocolo `profor://` para ligar o servidor por um clique dentro do HTML. O atalho da Área de Trabalho tornou-o desnecessário e ele foi retirado da interface. Os dois arquivos que restam são inofensivos e podem ser ignorados: `Configurar atalho de sincronizacao.cmd` (registra a chave `HKCU\Software\Classes\profor`) e `Remove-protocolo.cmd` (remove essa chave). Nenhum deles é necessário para usar o sistema.

### Modo offline (contingência)

O caminho antigo de anexar CSVs continua existindo como **contingência** no sistema e no resumo final da sincronização. Ele é útil quando não há como executar o servidor local. Não é mais o caminho principal e nenhum fluxo obriga a anexar arquivo.

## Sincronização automática — o que foi medido

Medições próprias da verificação independente, em 15/09/2026, com hora UTC:

| Rota | HTTP | Tempo | Resposta | Conteúdo |
|---|---|---|---|---|
| `GET /api/sync/status` | 200 | 0,21 s | 7.147 B | lista 65 blobs, sem baixar os grandes |
| `GET /api/sync/list` | 200 | 0,05 s | 7.033 B | lista simples para diagnóstico |
| `GET /api/sync?pad=0&force=1` | 200 | 40,67 s | 17.230 B | 12 propostas, 7 UFs, `pad` nulo nas 12 |
| `GET /api/sync?pad=1&force=1` | 200 | 83,61 s | 18.686 B | 12 propostas, 7 UFs, 14 itens de PAD |
| `GET /api/sync?pad=1&force=0` | 200 | 0,19 s | 18.741 B | `unchanged: true` **com o payload completo** (12 propostas) |

Medições repetidas em outra rodada, pouco antes, com os mesmos dados: `pad=0` 28,85 s e `pad=1` 55,88 s. A diferença é carga da máquina, não do código. O que importa é a ordem de grandeza: dezenas de segundos, e a origem é consultada de novo a cada execução com `force=1`.

Quando nada mudou na origem, o servidor responde em menos de um segundo **trazendo as propostas de novo** (não apenas um aviso): o campo `unchanged: true` é metadado, e o payload continua sendo aplicado ao banco local.


Tamanhos das extrações usadas (bytes comprimidos → descompactados, medidos por parser próprio):

| Arquivo | Comprimido | Descompactado | Linhas |
|---|---|---|---|
| `siconv_programa.zip` | 11.123.607 | 353.115.576 | 1.257.295 |
| `siconv_programa_proposta.zip` | 6.497.123 | 16.579.150 | 1.158.891 |
| `siconv_proposta.zip` | 205.655.070 | 754.781.379 | 1.157.535 |
| `siconv_plano_aplicacao_detalhado.zip` | 289.931.798 | 1.282.507.227 | 4.886.962 |

Conteúdo apurado nessa medição: **12 propostas** vinculadas ao programa, cobrindo **7 das 14 UFs** (PE com 6 propostas; CE, ES, MG, RN, RS e SE com 1) e **14 itens de PAD**, todos na proposta do RS. A soma dos itens do PAD confere com o valor global daquela proposta (R$ 204.009,52).

### Status e colunas do painel

A tabela principal tem nove colunas: expansão, Unidade Federativa, Proposta, Valor global, Mérito, Diligências, Celebração, Status e ação de detalhe. Mérito, PAD e celebração usam revisão humana atual; conferência aritmética e aceitação são medidas separadas. Celebração reúne os 19 requisitos existentes uma única vez (6 da proposta e 13 da formalização).

Busca, status interno, situação na origem e controle são combinados em cada proposta antes do agrupamento por UF. Linha, resumo, valor e link usam somente as correspondentes. A contagem e o total filtrado são indicados separadamente dos cartões, que representam todas as propostas ativas. UFs sem proposta aparecem quando não há critérios incompatíveis; apagadas permanecem na Lixeira.

A coluna **"Status no Transferegov"** foi removida da tabela principal a pedido do usuário, simplificando o acompanhamento e eliminando qualquer proximidade lexical com a coluna de análise. A situação da extração oficial (`SIT_PROPOSTA`), com seu selo conciso e o texto literal da extração, **continua preservada e acessível**:
- Nos **cartões do resumo expandido** de cada UF (ao clicar na linha ou teclar Enter/Espaço);
- Na **tela de detalhes da proposta** (aba "Dados da proposta");
- No **filtro "Status no Transferegov"** acima da tabela, que permite isolar propostas em elaboração, enviadas ou rejeitadas na origem;
- No **relatório de análise do SEI**.

O par de termos da extração oficial permanece: **"Em elaboração"** (literal "Proposta/Plano de Trabalho Cadastrados") e **"Enviada para análise"** (literal "Proposta/Plano de Trabalho Enviado para Análise").

A distinção importa porque **cadastrar não é enviar**. Conforme o SEI nº 36184012 e o tutorial oficial "Dados da Proposta – Convenente", a situação **"Proposta/Plano de Trabalho Cadastrados"** aparece logo depois de "Cadastrar Proposta" e **antes** de "Enviar para Análise": a proposta existe e tem número, mas ainda não foi submetida — o próprio Transferegov trata "confundir cadastrada com enviada" como erro comum, observando que uma proposta cadastrada e não enviada não produz efeito. Só o envio muda a situação para **"Proposta/Plano de Trabalho Enviado para Análise"**.

**Ressalva de vocabulário (registrada por transparência):** a palavra "elaboração" **não existe** no dado bruto — é o termo aprovado pelo usuário para a proposta ainda não enviada, e por isso o literal fica sempre visível ao lado do selo. O termo "Cadastrada" chegou a ser usado para a proposta enviada numa primeira versão e foi **rejeitado pelo próprio usuário**, justamente porque criava contradição dentro da mesma célula (o literal ali é "…**Enviado** para Análise", e a palavra "**Cadastrados**" pertence ao outro estado) — daí o par atual.

Quando a proposta ainda não foi enviada, a análise aparece como "Em elaboração na origem" em vez de "Em análise". Há um filtro **Status no Transferegov** para isolar cada grupo ("Em elaboração", "Enviada para análise", "Rejeitada na origem" e "Status não mapeado — conferir na origem"). Os rótulos desse filtro são **derivados do domínio** (`D.sourceState(...).label`), e não fixos no código: assim o filtro não pode voltar a divergir do selo exibido na célula. Se a extração trouxer uma situação não prevista, o selo é **"Status não mapeado — conferir na origem"**: o sistema não adivinha.

Na medição de 15/09/2026 (13:34): **11 propostas com "Em elaboração"** e **1 com "Enviada para análise"** (35405/2026, SEAP/PE — a única que chega ao concedente).

O botão da interface executa sempre a sincronização completa, com PAD e textos. A API mantém `?pad=0` apenas para compatibilidade com chamadas anteriores; esse caminho não aparece como opção na interface.

### Por que a aba "Plano de aplicação" pode aparecer vazia

A tela distingue quatro estados; extração incompleta não se confunde com ausência legítima de itens:

1. **"Sem itens publicados na origem"** — o arquivo oficial do PAD foi baixado e lido, e a proposta **realmente não tem nenhum item** nos dados abertos do Transferegov. Não há nada a corrigir no sistema; a conferência fica pendente na origem. A aba mostra a origem e a data da última sincronização.
2. **"PAD não carregado"** — situação herdada de uma sincronização antiga sem PAD ou de um PAD ainda não solicitado. Use o botão único de sincronização para consultar o PAD.

3. **“Importação incompleta do PAD”** — rejeições impedem aplicar o candidato. O último PAD íntegro permanece identificado como antigo; candidato e motivos podem ser consultados separadamente.
4. **PAD íntegro com itens** — itens carregados, com revisão humana própria.

O cartão do resumo expandido também distingue os estados ("nenhum item publicado na extração oficial" × "PAD não carregado — sincronize sem a opção rápida").

**Caso medido em 15/09/2026 nos dados oficiais:** das **12 propostas** do programa, **apenas a RS 35250/2026 tem itens publicados (14)**. **Nenhuma das 6 de Pernambuco** tem — nem a **35405/2026**, a única de PE já **enviada para análise** — e as outras cinco ainda estão "Cadastrados". Ou seja: o PAD não depende do envio da proposta; ele depende de o proponente ter preenchido o plano de aplicação detalhado na plataforma. O arquivo do PAD tem 4.886.962 linhas, e o cruzamento por `ID_PROPOSTA` foi conferido linha a linha (ver `../../tmp/requisitos/`).

**Tempo de execução:** medições anteriores sem o arquivo de textos não representam mais a duração do botão único. O quinto ZIP é grande e precisa ser lido para conferir os textos. A duração depende da rede, da geração dos arquivos e da carga da máquina; a interface mostra o cronômetro e permite interromper a espera. O limite de espera do navegador é de 45 minutos; cada consulta à origem mantém seu próprio limite de inatividade.

### Apagar uma proposta

No resumo expandido de cada UF, cada proposta tem o botão **🗑 Apagar proposta**. Apagar **não exclui**: a proposta sai do painel e de todas as telas de gestão e acompanhamento, sai da exportação CSV das propostas ativas; suas evidências importadas continuam sendo atualizadas e reabrem avaliações dependentes quando mudam, mas continua guardada no banco com o histórico e as análises. Em troca, ela passa a aparecer na tela **🗑 Propostas apagadas** (menu lateral, com contador), onde o botão é **↺ Restaurar proposta** — e então ela volta ao painel com as evidências e pendências atuais, preservando as decisões históricas.

### Ordem das propostas e o Status Proposta da UF

Quando a UF tem mais de uma proposta, o resumo mostra **primeiro as enviadas para análise, da mais antiga para a mais recente**, depois as em elaboração. E a situação exibida na linha é **da UF**: havendo **ao menos uma proposta enviada**, o selo de origem da UF é **"Enviada para análise"** (o Status, em paralelo, mostra "Em análise"), mesmo que outras ainda estejam em elaboração — porque cadastro não é envio.

## O que está implementado

- Sincronização automática pelo servidor local, com cache por assinatura de blob e validação de bytes/ETag contra a listagem da origem.
- Painel das 14 UFs, propostas múltiplas, pesquisa e filtros. O cabeçalho da tela principal conta com os botões **“⇩ Exportação”** e **“↻ Sincronização”**. Cada linha traz a **bandeira oficial da UF** (Wikimedia Commons, arquivada em `assets/bandeiras/`), tem **bandeira/sigla/nome clicáveis** para abrir a proposta e **expande um resumo** da proposta ao clique ou por Enter/Espaço. As propostas da UF aparecem **por envio** (enviadas primeiro, da mais antiga para a mais nova). **Todas as colunas da tabela estão centralizadas** (inclusive Unidade Federativa, proposta, valores, controles e status). O menu lateral tem **“▤ Propostas”**, que lista as propostas no padrão `UF - NNNNN/AAAA` em ordem alfabética.
- **Apagar e restaurar propostas:** apagar retira a proposta do painel, das telas de gestão sem excluí-la do banco; a sincronização preserva a exclusão e invalida decisões cuja evidência mudou; a tela **🗑 Propostas apagadas** lista por UF, com expansão e restauração.
- Importação CSV em blocos com validação e confirmação (modo offline de contingência), origem e comparação de alterações.
- Mérito, **19 requisitos de celebração em duas abas** (ver abaixo) e links de documentos.
- PAD com avaliação manual, três controles financeiros, valores em centavos.
- Atalhos Transferegov (Acesso Livre) à esquerda abaixo das abas de cada proposta: **Dados** e **PAD** abrem a proposta correta em nova guia pelo endereço de detalhe com `idProposta`; **Requisitos** abre direto a tela de Requisitos para Celebração (`_proposta/Requisitos/listarRequisitosDocumentos.jsf`) e **Anexos** abre direto a listagem de anexos (`ListarAnexosGenericos/AnexosExibirAnexosProposta.do`). Essas duas últimas não carregam `idProposta` na URL e leem a proposta da sessão do Acesso Livre: se a sessão estiver com outra proposta, clique antes em **Dados** para fixar a proposta correta e em seguida use Requisitos/Anexos. Exigem sessão de Acesso Livre ativa no navegador.
- Diligências vinculadas, pendências sem cadastro, prazos e saneamento confirmado.
- Instituição da Ouvidoria, prazo de referência de nove meses e Fala.BR informativo.
- Histórico, conclusão técnica com bloqueios, relatório HTML/texto e impressão/PDF.
- Banco no workspace com versões imutáveis, migração do IndexedDB antigo, backup/restauração, recuperação e CSV.

### Requisitos da Proposta e Requisitos para Formalização

Dentro de uma proposta, os requisitos da **Lista de Conferência dos autos** (SEI nº 36183977) são conferidos em **duas abas**, colocadas **antes de "Diligências"**:

- **Requisitos da Proposta** — os **6 itens disponíveis no código atual**, com os textos já existentes da Lista de Conferência: 3 Plano de trabalho, 4 Termo de Referência, 5 Plano de Sustentabilidade, 6 Declaração de Compatibilidade de Preços e propostas orçamentárias, 7 Declaração de Contrapartida detalhada e QDD e 11 Declaração de Capacidade Técnica e Gerencial.
- **Requisitos para Formalização** — os **13 itens** conferidos no ato da celebração, na aba "Requisitos para celebração" do Transferegov.br: 1 Cadastro atualizado, 1.1 Delegação de competência, 8 Resolução CNPCP nº 1/2008, 9 PNAMPE, 10 Não duplicidade do objeto, 12 Taxa de administração, 13 Empresas públicas e sociedades de economia mista, 14 Operação de crédito, 15 Dívidas consolidada e mobiliária, 16 Restos a pagar, 17 Despesa total com pessoal, 18 Precatórios da educação básica e 19 CAUC.

**Em cada linha das duas abas:** o **item**, o **requisito com o subtexto da Lista de Conferência** (por exemplo, o item 1.1: "quando houver, assinado pelo(a) Governador(a); caso não haja Delegação de Competência, o(a) Governador(a) assinará o Termo de Convênio como INTERVENIENTE… Normativo delegando ou Declaração de Delegação de Competência — modelo anexo 1 (p. 6)"), e as colunas **Fundamentação** e **Comprovação** transcritas da mesma lista, além de Resultado, Documento e Ação.

Os **19 itens disponíveis permanecem os mesmos** e ficam gravados em **uma única coleção** (`reviews.celebracao`): a divisão é só de tela. Por isso nada se perde, os vínculos de diligência seguem válidos (`celebracao:<item>`) e **os backups feitos antes da mudança continuam aceitos**. A divisão foi confirmada pelo usuário em 15/09/2026.

No painel, a coluna **Celebração** mostra o progresso dos 19 itens juntos; o filtro **Controle** passou a ter duas opções separadas — "Requisitos da Proposta pendentes" e "Requisitos para Formalização pendentes". No relatório do SEI, as seções **10. Requisitos da Proposta** e **11. Requisitos para Formalização** trazem as colunas da lista.

> **Ressalva:** os textos foram transcritos da lista dos autos. A **vigência e a aplicabilidade de cada remissão normativa continuam exigindo conferência do analista** — o sistema não certifica vigência.

## Limitações deste marco

- A sincronização automática exige o servidor local (`node server.cjs`) e a origem `http://127.0.0.1:8766`. Em `file://` o botão apenas explica a exigência; nesse caso use o modo offline de anexar CSVs. O importador não autentica nem grava no Transferegov/SEI.
- **A base pública é viva e pode servir duas gerações do mesmo arquivo ao mesmo tempo.** Medido em 15/09/2026 (12:14Z): a mesma URL de blob, sem parâmetro, devolvia 11.117.617 bytes (ETag `0x8DF12512881B211`, de 14/09) com **4** propostas; com um parâmetro de cache (`?cb=...`) devolvia 11.236.607 bytes (ETag `0x8DF131A4085E677`, de 15/09) com **12** propostas. A listagem da origem anuncia sempre a versão nova. Por isso o servidor acrescenta um parâmetro próprio a cada download e confere os bytes recebidos contra o tamanho anunciado; **se alguém remover esse parâmetro, a sincronização volta a ingerir em silêncio um snapshot antigo, com 8 propostas a menos.** Esse comportamento está registrado em `IMPLEMENTACAO.md`.
- Números de propostas, UFs e PAD são uma **fotografia** do momento da consulta; a origem é atualizada ao longo do dia. A ausência na extração não exclui uma proposta local.
- Cabeçalhos e formatos foram conferidos na extração oficial em 15/09/2026. A homologação com os registros reais do programa permanece pendente. Não foram importados dados fictícios no banco de uso do usuário.
- `DIA_PROPOSTA` é cadastramento, não prova de envio. Tempestividade é manual. O campo de órgão/entidade proponente fica indisponível: `DESC_ORGAO` não é usado como se fosse órgão do proponente.
- Dias corridos: cálculo depende da ciência. Sábado/domingo são ajustados; feriados e expediente requerem conferência registrada. Prazo da Ouvidoria é referência de mês civil; prorrogações exigem controle do instrumento.
- Checklist reproduz numeração, títulos, subtextos, fundamentação e comprovação dos autos, separados nas duas abas de conferência. Não certifica vigência ou aplicabilidade de cada remissão. Não há aprovação jurídica automatizada.
- Histórico registra as alterações como feitas por “Usuário local”, sem exigir identificação pessoal, autenticação ou garantia de imutabilidade contra edição externa do banco/backup.
- Restauração JSON limitada a arquivos menores que 50 MB. O armazenamento canônico é o workspace; espaço e disponibilidade dos arquivos exigem conferência local. Falha de persistência é exibida; não há fallback silencioso.
- Anexos binários existentes, nomes/links e notas são preservados. Esta manutenção não implementa extensão de prazo formal nem importação de cronogramas.
- Alvos iniciais: Chrome e Edge. O banco é compartilhado pelos navegadores que acessam o mesmo servidor/workspace.

## Manutenção 02/10/2026 — prioridades selecionadas

A referência da auditoria era `d510580d6499f8c21d7149d6b24c4e98d88137f3`; esta execução partiu de `main`, SHA `2894efb3028c623009fea090b7780de7c0edac3c`. Foram confirmados no HEAD o banco imutável, a paridade integral da projeção pública, a coleção compartilhada de celebração, o cálculo monetário e as travas existentes. Não se recriaram esses mecanismos.

| Prioridade | Implementação e arquivos canônicos | Cobertura principal |
|---|---|---|
| 1 | `domain.confirmConclusion`, modal/handler em `app.js`, checagem de token/revisão em `storage.js`, relatório | `prioridades.test.cjs`, `prioridades-ui.cjs` |
| 2 | Cache versão 2, assinatura de todas as fontes usadas e do modo em `transferegov-sync.cjs` | `sync.test.cjs` |
| 3 | Coletor comum do PAD em `domain.js`, ZIP/CSV, aplicação compartilhada, candidato separado e alerta em tela | `sync.test.cjs`, `prioridades.test.cjs`, `headless-sync.test.cjs` |
| 4 | `EVIDENCE_DEPENDENCIES`, assinatura de conteúdo, reanálise seletiva, documentos/anexos e exclusão/restauração | `prioridades.test.cjs`, `textos-oficiais.cjs`, `anexos-requisitos.cjs` |
| 5 | Progresso humano atual, resultado técnico e aptidão separados no domínio, painel, relatório e CSV | `domain.test.cjs`, `prioridades.test.cjs`, `report-topics.test.cjs` |
| 6 | Referência canônica, detalhe integral compartilhado, handlers/adaptador somente leitura e gerador seguro | `prioridades-ui.cjs`, `public-snapshot.test.cjs`, `public-pages.cjs` |
| 7 | `setInstitution`, fato/parecer atômicos, conflito legado visível e reanálise dos dependentes | `prioridades.test.cjs`, `prioridades-ui.cjs`, `analise-merito.cjs` |
| 8 | `matchesFilters` antes de agrupar; correspondentes, links e totais filtrados | `prioridades-ui.cjs`, `pad-filters.cjs`, `painel-expand.cjs` |
| 10 | Resumo/descrição/fundamento expansíveis, foco estável, estado de salvamento acessível e PAD responsivo | `prioridades-ui.cjs`, `pad-batch.cjs`, `pad-filters.cjs` |

### Formato e compatibilidade

`schemaVersion` e o formato do registro imutável continuam em 1. Não se regravam revisões antigas. Normalização em memória é determinística e idempotente; preserva campos desconhecidos, notas, links, anexos, diligências e histórico.

- `review.evidence = {version:1, ref, fingerprint}` registra a referência canônica e o conteúdo considerado. A impressão `fnv64-v1:...` compara conteúdo; não substitui o SHA-256 da cadeia nem certifica autenticidade. Documentos/URLs e conteúdo dos anexos participam da comparação. Hora de consulta, ordem das propriedades e revisão global não participam.
- Avaliação legada sem referência recebe `{version:1, ref, fingerprint:null, legacy:true}`. O resultado histórico fica preservado e visível; não conta como decisão humana atual nem recebe certificação retrospectiva. A confirmação humana cria uma referência atual.
- `review.reanalysis = {at, fields, reason}` explica a mudança. Histórico guarda decisão anterior e posterior completas. Reanálise preserva nota/documento/URL/anexos; alteração só de formalização recalcula aptidão sem apagar conclusão técnica independente.
- `p.padImport = {version:1, status, source, at, received, accepted, rejected, reasons}` registra `complete` ou `partial`. `reasons` contém `{line, itemId, reason}`; `candidate` é reservado ao conjunto parcial, separado do PAD íntegro em `p.imported.pad`. No contrato de entrada, o parser envia `imported.padExtraction`, consumido pela aplicação. Sem metadados legados, `pad:null` significa não carregado e `pad:[]` representa extração vazia aceita pelo contrato anterior; não se inventam contagens históricas.
- Rejeição sem ID verificável marca como parciais todas as propostas do conjunto afetado. `received` conta linhas atribuíveis à proposta; uma rejeição não atribuível pode aumentar `rejected` sem aumentar `received`. IDs verificáveis de propostas fora do programa são ignorados. Propostas não afetadas e campos independentes seguem sendo aplicados na mesma transação; a tela avisa o que ficou antigo. Modo rápido preserva PAD e alerta anteriores. Extração íntegra posterior resolve o alerta com histórico.
- `p.conclusion` inclui `result` (`favoravel`/`desfavoravel`), `actor`, `at`, `reference`, `note`, `evidence:{version:1,fingerprint}` e `operationId`. `confirmConclusion` exige controles pertinentes e evidência atual. Resultado desfavorável exige justificativa, conserva checks negativos e nunca torna a proposta apta. Conclusão legada sem evidência permanece legível, sem aptidão automática.

Dependências existentes: objeto/vigência → mérito objeto (objeto também destinação); caracterização/justificativa → justificativa; público, problema, resultados e relação → seus checks; capacidade → mérito capacidade e celebração 11; PAD/repasse/global → declaração de preços 6; contrapartida/global → declaração 7; Ouvidoria/Fala.BR → respectivos checks. Mudança material de item reabre sua própria avaliação. Somar corretamente não aprova preço ou documento.

Fala.BR: “Já aderiu” → `aderido`/`ok`; “Previsto no Plano de Trabalho” → `previsto`/`obs`; “Sem previsão” → `nao_previsto`/`no`; não informado → `na`. Os três resultados registrados são permitidos e não bloqueantes. A decisão direta inequívoca grava fato e parecer juntos; editar o fato reabre a avaliação. Ouvidoria `ok` → `instituida`, `no` → `pendente`; cláusula é registro expresso separado. Pendente com cláusula continua pendente. Conflito legado conserva ambos os registros e exige decisão humana.

“Revisado” significa decisão humana registrada e atual. Negativa justificada conta trabalho concluído, sem contar aceite. `na`/`reanalise` não contam. Celebração é contada uma vez; diligência não saneada pode ser terminal desfavorável, enquanto aberta/aguardando/em avaliação continua pendente. Aptidão exige conclusão favorável atual, controles de celebração e origem enviada; rejeitada/cancelada/indeferida/desconhecida nunca é apta.

Cache versão 2 usa nome, bytes, geração/data e ETag real de programa, vínculos, propostas e PAD quando solicitado, com ordem determinística e modo rápida/completa. Payload inteiro é preservado no cache quente. Cache legado é recusado. Bytes e ETag/data são confrontados com o download; uma geração divergente não é certificada. Sem tamanho e geração confiáveis, revalidam-se os arquivos nessa execução e não se sela resultado para reutilização presumida. Isso não desativa o cache das fontes com metadados válidos. Textos oficiais continuam pelo fluxo próprio.

### Validação e reprodução

Execute na raiz da aplicação, `Sistema PROFOR 2026/PROFOR_2026/`. Não existe `package.json`; não se usa `npm test`. Playwright e, para XLSX, Python com `openpyxl` precisam estar disponíveis. Os harnesses aceitam `PROFOR_PLAYWRIGHT_PATH` e o teste XLSX aceita `PROFOR_PYTHON`; use os runtimes já instalados, sem adicionar dependência de produção.

```powershell
node --test tests/domain.test.cjs tests/prioridades.test.cjs tests/sync.test.cjs tests/headless-sync.test.cjs tests/workspace-store.test.cjs tests/workspace-api.test.cjs tests/public-snapshot.test.cjs tests/report-topics.test.cjs tests/proposal-sei.test.cjs
node tests/prioridades-ui.cjs
foreach ($teste in @('analise-merito','anexos-requisitos','review-diligence','textos-oficiais','pad-batch','pad-filters','painel-expand','public-pages','sync-changes-uf')) { node "tests/$teste.cjs"; if ($LASTEXITCODE -ne 0) { throw "Falhou: $teste" } }
```

| Estado | Cenários e evidência desta execução | Limite |
|---|---|---|
| PASS | 145 testes Node: domínio, cache quente, ZIP/CSV parcial, headless, store, API real em porta efêmera, snapshot e relatórios HTML/XLSX | Cópias temporárias/fixtures; snapshot real somente lido |
| PASS | Regressões de mérito, anexos, diligências/saneamento, vencimento, textos/no-op/erro/cancelamento, lote PAD, filtros, expansão e sincronização com UF | Requisições interceptadas; zero escrita no banco administrativo |
| PASS | Consulta do snapshot real: abas, notas, documentos, diligências, Lixeira e calendário; vínculos comparados dinamicamente | Consulta estática local, não deploy remoto |
| PASS | 13 grupos na UI nova, cinco decisões de mérito + cinco PAD, foco, erro/conflito, fatos, backup/recuperação e paridade | Fixtures temporárias, capturas e toque simulado; não usuários reais |
| NÃO EXECUTADO | Transferegov ao vivo, SEI autenticado, deploy e sincronização real do OneDrive | Não necessários nem autorizados nesta manutenção |
| NÃO EXECUTADO | Runner antigo `tests/ui-flow.js` | Assume controles removidos no HEAD anterior e contém reset do store; fluxos exigidos cobertos pelos harnesses isolados acima |

Fixtures novas são identificadas como teste: proposta AP 101 com cinco itens PAD e descrição longa; AP 102 com situação/valor diferentes para filtros; RS 990900 com quantidade 2,5 para XLSX. UI cobre clique duplo, revisão/token/bloqueio/evidência supervenientes, falha de gravação, retry recuperável, conclusão desfavorável, fatos institucionais, backup/restauração, cinco decisões de mérito e cinco PAD por teclado, foco e toque simulado. Capturas em `output/playwright/prioridades/` (ignoradas pelo Git) documentam 1366×768, 390×844 e viewport CSS equivalente a 200%. As cinco capturas foram inspecionadas visualmente: texto expandido íntegro, ações desktop sem corte e item/quantidade/valores/ação relacionados em mobile e no viewport equivalente a 200%.

A caracterização inicial encontrou cinco falhas preexistentes em 113 testes selecionados (108 passavam): contagem desatualizada 20/7 contra os 19/6 requisitos já no HEAD, teste de vencimento dependente da data e expectativas antigas de bloqueios. Fixtures foram atualizadas às listas e regras efetivas; nenhum requisito foi criado/apagado para acomodar testes. O harness de textos também procurava botões retirados antes desta tarefa; passou a exercer o botão único. O teste público compara a mesma providência/observação no detalhe compartilhado, em vez de exigir o antigo elemento textarea. A ausência do link SEI no relatório foi corrigida no consumidor afetado.

### Backup, recuperação, alternância e riscos

Nesta execução, foram copiados e conferidos por SHA-256 os 211 arquivos do banco real para um backup fora do Git, junto do JSON aceito pelo mecanismo existente, snapshot anterior e manifesto. O snapshot foi regenerado da revisão 211 (20 propostas, 15 ativas e 5 apagadas); nomes e hashes dos registros foram novamente conferidos e permaneceram idênticos. Nenhuma fixture foi gravada no banco administrativo.

Para a continuidade pelo OneDrive, a cópia completa do backup está também dentro do workspace, em `output/continuidade-prioridades-2026-10-02/backup/` (caminho relativo à raiz Git). Os 215 arquivos dessa cópia foram comparados byte a byte e por SHA-256; a cadeia e o JSON de recuperação foram novamente validados. Roteiro, pedido original e metadados da entrega estão na mesma pasta; evidências em `output/playwright/prioridades/`. Tudo é local e excluído do Git, sem depender do backup externo para a retomada. Na raiz Git, execute `node output/continuidade-prioridades-2026-10-02/verificar-backup.cjs` para conferir o backup recebido. O roteiro distingue dependências instaladas em cada máquina (Node.js; Playwright/Python apenas para repetir os testes) dos arquivos compartilhados. Nenhum runtime ou ambiente virtual foi compartilhado como se fosse portátil.

Para recuperar dados pelo fluxo existente, use **Exportação → Restaurar backup JSON**, valide o arquivo e confirme a substituição. O estado anterior é guardado como recuperação e a cadeia imutável continua preservada; teste isso primeiro em cópia descartável. Para recuperar uma cadeia de arquivos, pare o servidor e preserve a cadeia atual fora do Git antes de substituir por uma cópia completa verificada. Não mescle ramos concorrentes por escolha automática de arquivo mais recente.

A alternância foi testada com duas cópias completas, copiadas sequencialmente. Não prova sincronização real nem atomicidade distribuída do OneDrive. O lock por hostname e a recusa de ramos continuam intactos. Falha antes do rename pode deixar um `.tmp` que não participa da cadeia; o teste confirma revisão/token intactos e nova gravação recuperável, sem publicar registro parcial.

Riscos: avaliações antigas exigem confirmação humana antes de voltar a contar como atuais; impressão de conteúdo não é certificação da fonte; aptidão não substitui revisão jurídica/administrativa. Não se alteraram normas, requisitos, categorias, textos, cálculo de prazo da cláusula ou regras de rede. Nenhuma conferência de bens de capital/metas/etapas/cronogramas foi acrescentada; o requisito existente de ID 9 continua presente.

Rollback de código deve ser feito por reversão do commit desta manutenção mediante autorização, preservando `dados/registros/` e o backup. Reverter código não desfaz decisões humanas posteriores. O snapshot anterior foi preservado separadamente; publicação permanece uma operação autorizada à parte. Planejamento e fontes estão em `../IMPLEMENTACAO.md`; o registro desta execução está em `DIARIO_DE_BORDO.md` na raiz.

### Arquivos desta manutenção

Lista exata de 38 arquivos versionados; o diário e as evidências de execução são locais e ignorados pelo Git.

- `README.md`
- `Sistema PROFOR 2026/PROFOR_2026/PROFOR_2026.html`
- `Sistema PROFOR 2026/PROFOR_2026/README.md`
- `Sistema PROFOR 2026/PROFOR_2026/app.js`
- `Sistema PROFOR 2026/PROFOR_2026/domain.js`
- `Sistema PROFOR 2026/PROFOR_2026/report.js`
- `Sistema PROFOR 2026/PROFOR_2026/storage.js`
- `Sistema PROFOR 2026/PROFOR_2026/styles.css`
- `Sistema PROFOR 2026/PROFOR_2026/sync-apply.js`
- `Sistema PROFOR 2026/PROFOR_2026/tests/analise-merito.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/anexos-requisitos.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/domain.test.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/fixtures/state.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/headless-sync.test.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/pad-batch.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/pad-filters.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/painel-expand.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/prioridades-ui.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/prioridades.test.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/public-pages.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/public-snapshot.test.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/report-topics.test.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/review-diligence.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/sync.test.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/textos-oficiais.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/ui-static.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/tests/workspace-store.test.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/transferegov-sync.cjs`
- `Sistema PROFOR 2026/PROFOR_2026/transferegov.js`
- `docs/app.js`
- `docs/dados_publicos.js`
- `docs/domain.js`
- `docs/index.html`
- `docs/public-storage.js`
- `docs/report.js`
- `docs/styles.css`
- `docs/sync-apply.js`
- `tools/build_public_docs.cjs`
