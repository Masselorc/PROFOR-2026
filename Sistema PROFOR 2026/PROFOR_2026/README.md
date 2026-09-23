# PROFOR/ONASP 2026 — versão local

## Abrir

**Uso normal, um duplo clique: `INICIAR SISTEMA.cmd`** (nesta pasta), ou o **atalho `PROFOR 2026` da Área de Trabalho**, que aponta para ele. O arquivo liga o servidor local **sem janela nenhuma aparecer** e abre o navegador já no sistema, com os dados carregados. Se o servidor já estiver no ar, ele apenas abre a página — nunca cria uma segunda instância. A partir daí, o trabalho é no painel: **Sincronizar com o Transferegov** atualiza os dados.

Como instalar o atalho da Área de Trabalho (uma única vez): duplo clique em **`INSTALAR ATALHO.cmd`**. Ele cria o atalho `PROFOR 2026` com o ícone do sistema (`assets\profor.ico`), sem exigir administrador. Para remover, apague o atalho da Área de Trabalho — nada mais é alterado.

Caminho manual equivalente, se algum dia for preciso: `node server.cjs` e abra **http://127.0.0.1:8766/PROFOR_2026.html**. Ctrl+C encerra o servidor. O servidor escuta somente em `127.0.0.1`, recusa `Host` desconhecido, recebe o estado do aplicativo em JSON e não acessa credenciais.

**Se a tela aparecer com aparência antiga** (colunas desalinhadas, texto estranho no lugar de um dado), recarregue a página com **Ctrl+F5** uma vez. O HTML carrega os scripts com assinatura de versão (`?v=…`), gerada a cada alteração, justamente para impedir que o navegador use arquivo antigo; o Ctrl+F5 cobre o caso da página que já estava aberta antes da atualização.

### Abrir o arquivo HTML direto (não recomendado)

Abrir o HTML diretamente mostra a orientação para usar `INICIAR SISTEMA.cmd`. O servidor local é necessário para ler e gravar o banco no workspace.

### Onde ficam os seus dados (importante)

Desde 16/09/2026, o banco fica em **`dados/registros/`**, nesta pasta do sistema. O servidor grava versões JSON imutáveis contendo propostas, análises, diligências e histórico. O navegador acessa esse banco pela API local; limpar seus dados não apaga os arquivos do workspace.

No primeiro acesso, se a pasta ainda não tiver banco, o sistema copia automaticamente o IndexedDB antigo do navegador/endereço atual, preservando o original. Se o banco da pasta já existir, ele prevalece. A opção **Resgatar banco antigo deste navegador**, em Backup e exportação, permite exportar dados legados para conferir e restaurar explicitamente. Dados de outro perfil, máquina ou origem exigem exportação naquele ambiente.

O OneDrive sincroniza a pasta completa. Marque-a como **Sempre manter neste dispositivo**. Feche o sistema, aguarde o envio terminar na máquina de origem e o download terminar na máquina de destino antes de abrir. Não use as duas máquinas simultaneamente: alterações concorrentes são preservadas e bloqueiam novas gravações até reconciliação. A confirmação de salvamento indica gravação local, não envio concluído pelo OneDrive. Consulte `dados/LEIA-ME.md`.

## Primeiro uso

1. Abra `INICIAR SISTEMA.cmd` ou instale o atalho por `INSTALAR ATALHO.cmd`.
2. Preencha seu nome no menu lateral, para identificar os registros manuais.
3. Clique em **Sincronizar com o Transferegov**. Não há nada para anexar nem arquivo para escolher: o servidor local baixa, descompacta e cruza as quatro extrações oficiais e devolve as propostas do programa 3000020260022.
4. Acompanhe a etapa corrente e o cronômetro. A operação pode ser cancelada; nada é gravado no banco antes do fim.
5. Ao concluir, confira o resumo (propostas, alterações, UFs cobertas, itens de PAD e hora) e a tabela de alterações. Se a origem não tiver mudado, o sistema informa “Nenhuma alteração desde a última sincronização”.
6. Abra uma proposta e analise cada aba. Use **Analisar**, preencha o resultado e salve. Observações são obrigatórias em estados críticos.
7. Cadastre diligências a partir dos requisitos. Após saneamento, escolha se quer atualizar o requisito. Informe ciência e confira expediente para confirmar vencimento.
8. Conclua a análise técnica quando os controles permitirem. Continue acompanhando o checklist de celebração.
9. Exporte backup JSON ao fim do trabalho. Verifique o download no computador.

### Origem `file://`

Abrir o HTML por `file://` continua servindo para consultar. Nessa origem a página **não consegue nem consultar o servidor local**: medido em 15/09/2026, `fetch` para `http://127.0.0.1:8766` falha e até uma simples imagem é bloqueada. O menu lateral mostra, só nessa origem, o item **“Ligar servidor”**, que explica como abrir pelo atalho. A razão de fundo é a mesma: a API pública não envia cabeçalhos CORS (verificado em 15/09/2026 11:44Z: `OPTIONS` responde **405** e o `GET` não traz `Access-Control-Allow-Origin`), então o navegador nunca consegue baixar os ZIPs direto — o download tem de ser feito pelo processo Node.

### Arquivos que sobraram do caminho antigo

O sistema já teve um protocolo `profor://` para ligar o servidor por um clique dentro do HTML. O atalho da Área de Trabalho tornou-o desnecessário e ele foi retirado da interface. Os dois arquivos que restam são inofensivos e podem ser ignorados: `Configurar atalho de sincronizacao.cmd` (registra a chave `HKCU\Software\Classes\profor`) e `Remove-protocolo.cmd` (remove essa chave). Nenhum deles é necessário para usar o sistema.

### Modo offline (contingência)

O caminho antigo de anexar CSVs continua existindo como **contingência**, dentro do diálogo de sincronização, no botão “Modo offline: anexar arquivos CSV”. Ele é útil quando não há como executar o servidor local. Não é mais o caminho principal e nenhum fluxo obriga a anexar arquivo.

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

A tabela principal de acompanhamento foi simplificada para **8 colunas**, todas **centralizadas**:

1. **Unidade Federativa** — centralizada na célula (bandeira oficial, sigla e nome).
2. **Proposta** — número da proposta de referência da UF com link.
3. **Valor global** — valor global da proposta.
4. **Habilitação** — progresso das checagens de habilitação.
5. **Mérito** — progresso dos itens de mérito.
6. **Diligências** — contagem de diligências abertas e pendências sem registro.
7. **Celebração** — progresso dos **20 requisitos** da Lista de Conferência (a soma das abas "Requisitos da Proposta" e "Requisitos para Formalização").
8. **Status** — andamento do trabalho de análise técnica (análise ONASP).

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

O PAD é opcional: `?pad=1` (padrão) lê o arquivo de 290 MB; `?pad=0` — a opção “Sincronização rápida (sem PAD)” — não baixa esse arquivo e devolve `pad` nulo, preservando no banco o plano de aplicação já registrado.

### Por que a aba "Plano de aplicação" pode aparecer vazia

São **duas causas diferentes**, e a tela agora diz qual é qual (antes as duas mostravam o mesmo aviso):

1. **"Sem itens publicados na origem"** — o arquivo oficial do PAD foi baixado e lido, e a proposta **realmente não tem nenhum item** nos dados abertos do Transferegov. Não há nada a corrigir no sistema; a conferência fica pendente na origem. A aba mostra a origem e a data da última sincronização.
2. **"PAD não carregado"** — a última sincronização foi a **rápida (sem PAD)**, que não baixa esse arquivo. Basta sincronizar de novo pela modalidade completa.

O cartão do resumo expandido também distingue os dois casos ("nenhum item publicado na extração oficial" × "PAD não carregado — sincronize sem a opção rápida").

**Caso medido em 15/09/2026 nos dados oficiais:** das **12 propostas** do programa, **apenas a RS 35250/2026 tem itens publicados (14)**. **Nenhuma das 6 de Pernambuco** tem — nem a **35405/2026**, a única de PE já **enviada para análise** — e as outras cinco ainda estão "Cadastrados". Ou seja: o PAD não depende do envio da proposta; ele depende de o proponente ter preenchido o plano de aplicação detalhado na plataforma. O arquivo do PAD tem 4.886.962 linhas, e o cruzamento por `ID_PROPOSTA` foi conferido linha a linha (ver `../../tmp/requisitos/`).

**Quanto tempo leva:** com os ZIPs já em cache local, **~26 s** para a sincronização completa (com PAD) e **~16 s** sem PAD; baixando de novo os 512 MB, **~45 s**. Se nada mudou na origem, a resposta é **imediata** (reaproveita a extração anterior). A variação vem da carga da máquina e da rede. A interface mostra o cronômetro e permite cancelar a qualquer momento; o limite de tempo do servidor é de 10 minutos.

### Apagar uma proposta

No resumo expandido de cada UF, cada proposta tem o botão **🗑 Apagar proposta**. Apagar **não exclui**: a proposta sai do painel e de todas as telas de gestão e acompanhamento, deixa de ser sincronizada e sai da exportação CSV, mas continua guardada no banco com o histórico e as análises. Em troca, ela passa a aparecer na tela **🗑 Propostas apagadas** (menu lateral, com contador), onde o botão é **↺ Restaurar proposta** — e então ela volta ao painel e à sincronização.

### Ordem das propostas e o Status Proposta da UF

Quando a UF tem mais de uma proposta, o resumo mostra **primeiro as enviadas para análise, da mais antiga para a mais recente**, depois as em elaboração. E a situação exibida na linha é **da UF**: havendo **ao menos uma proposta enviada**, o selo de origem da UF é **"Enviada para análise"** (o Status, em paralelo, mostra "Em análise"), mesmo que outras ainda estejam em elaboração — porque cadastro não é envio.

## O que está implementado

- Sincronização automática pelo servidor local, com cache por assinatura de blob e validação de bytes/ETag contra a listagem da origem.
- Painel das 14 UFs, propostas múltiplas, pesquisa e filtros. O cabeçalho da tela principal conta com os botões **“⇩ Exportação”** e **“↻ Sincronizar com o Transferegov”**. Cada linha traz a **bandeira oficial da UF** (Wikimedia Commons, arquivada em `assets/bandeiras/`), tem **bandeira/sigla/nome clicáveis** para abrir a proposta e **expande um resumo** da proposta ao clique ou por Enter/Espaço. As propostas da UF aparecem **por envio** (enviadas primeiro, da mais antiga para a mais nova). **Todas as colunas da tabela estão centralizadas** (inclusive Unidade Federativa, proposta, valores, controles e status). O menu lateral tem **“▤ Propostas”**, que lista as propostas no padrão `UF - NNNNN/AAAA` em ordem alfabética.
- **Apagar e restaurar propostas:** apagar retira a proposta do painel, das telas de gestão e das sincronizações sem excluí-la do banco; a tela **🗑 Propostas apagadas** lista por UF, com expansão e restauração.
- Importação CSV em blocos com validação e confirmação (modo offline de contingência), origem e comparação de alterações.
- Habilitação, mérito, **20 requisitos de celebração em duas abas** (ver abaixo) e links de documentos.
- PAD com avaliação manual, três controles financeiros, valores em centavos.
- Diligências vinculadas, pendências sem cadastro, prazos e saneamento confirmado.
- Instituição da Ouvidoria, prazo de referência de nove meses e Fala.BR informativo.
- Histórico, conclusão técnica com bloqueios, relatório HTML/texto e impressão/PDF.
- Banco no workspace com versões imutáveis, migração do IndexedDB antigo, backup/restauração, recuperação e CSV.

### Requisitos da Proposta e Requisitos para Formalização

Dentro de uma proposta, os requisitos da **Lista de Conferência dos autos** (SEI nº 36183977) são conferidos em **duas abas**, colocadas **antes de "Diligências"**:

- **Requisitos da Proposta** — os **7 itens** analisados na **Nota Técnica 231 (SEI 33381502)** e no **Parecer 15 (SEI 33369201)**: 2 Proposta de trabalho, 3 Plano de trabalho, 4 Termo de Referência, 5 Plano de Sustentabilidade, 6 Declaração de Compatibilidade de Preços e propostas orçamentárias, 7 Declaração de Contrapartida detalhada e QDD e 11 Declaração de Capacidade Técnica e Gerencial.
- **Requisitos para Formalização** — os **13 itens** conferidos no ato da celebração, na aba "Requisitos para celebração" do Transferegov.br: 1 Cadastro atualizado, 1.1 Delegação de competência, 8 Resolução CNPCP nº 1/2008, 9 PNAMPE, 10 Não duplicidade do objeto, 12 Taxa de administração, 13 Empresas públicas e sociedades de economia mista, 14 Operação de crédito, 15 Dívidas consolidada e mobiliária, 16 Restos a pagar, 17 Despesa total com pessoal, 18 Precatórios da educação básica e 19 CAUC.

**Em cada linha das duas abas:** o **item**, o **requisito com o subtexto da Lista de Conferência** (por exemplo, o item 1.1: "quando houver, assinado pelo(a) Governador(a); caso não haja Delegação de Competência, o(a) Governador(a) assinará o Termo de Convênio como INTERVENIENTE… Normativo delegando ou Declaração de Delegação de Competência — modelo anexo 1 (p. 6)"), e as colunas **Fundamentação** e **Comprovação** transcritas da mesma lista, além de Resultado, Documento e Ação.

Os **20 itens continuam sendo os mesmos** e ficam gravados em **uma única coleção** (`reviews.celebracao`): a divisão é só de tela. Por isso nada se perde, os vínculos de diligência seguem válidos (`celebracao:<item>`) e **os backups feitos antes da mudança continuam aceitos**. A divisão foi confirmada pelo usuário em 15/09/2026.

No painel, a coluna **Celebração** mostra o progresso dos 20 itens juntos; o filtro **Controle** passou a ter duas opções separadas — "Requisitos da Proposta pendentes" e "Requisitos para Formalização pendentes". No relatório do SEI, as seções **10. Requisitos da Proposta** e **11. Requisitos para Formalização** trazem as colunas da lista.

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
- Backups até 50 MB. Armazenamento local sujeito às configurações e limites do navegador. Falha de persistência é exibida; não há fallback silencioso.
- Não há anexação binária, extensão de prazo formal nem importação de cronogramas nesta etapa; documentos são referenciados por nome/link.
- Alvos iniciais: Chrome e Edge. O banco é compartilhado pelos navegadores que acessam o mesmo servidor/workspace.

## Testar

```
node --test tests/domain.test.cjs
node --test tests/sync.test.cjs
```

Fluxo completo na interface (offline, com banco e perfil próprios; precisa de `PROFOR_UI_PROFILE` apontando para uma pasta nova):

```
$env:PROFOR_UI_PROFILE = Join-Path $env:TEMP ('profor-ui-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
node tmp/playwright/run-ui-flow.cjs
```

O fluxo percorre as duas abas de celebração (7 + 13 itens), confere que a divisão não criou coleção de estado própria, abre o relatório (seções 10, 11 e 13) e exercita backup, restauração e contingência offline.

Os testes de sincronização não usam rede: montam ZIPs de fixture em memória e exercitam parser CSV, leitura de ZIP por seek, allowlist, cache e o pipeline completo com `domain.validateImported`. Os CSVs em `tests/fixtures/` são fictícios, rotulados como teste, e usados apenas em perfil de navegador isolado. Não os utilize para iniciar a base administrativa.

Planejamento técnico, fontes e decisões estão em `../IMPLEMENTACAO.md`. Atividades estão no `DIARIO_DE_BORDO.md` da raiz do workspace.
