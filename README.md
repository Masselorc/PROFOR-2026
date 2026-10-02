# PROFOR/ONASP 2026

Aplicação local de acompanhamento das propostas do PROFOR/ONASP 2026 e consulta pública aos mesmos dados de negócio registrados.

## Consulta pública

[Consultar o PROFOR/ONASP 2026](https://masselorc.github.io/PROFOR-2026/).

A pasta `docs/` contém um snapshot estático em modo de leitura. A projeção preserva propostas ativas e apagadas, avaliações, notas, documentos/anexos, diligências, textos oficiais, histórico manual e registros de atualização disponíveis no banco local. Não há whitelist de campos oficiais. Credenciais e segredos operacionais não são dados de negócio; o token da cadeia fica fora do estado projetado.

O público pode navegar, filtrar, expandir textos, consultar detalhes e exportar CSV. Os handlers de alteração e o adaptador público rejeitam gravação: não permitem edição, conclusão, importação, sincronização, exclusão ou restauração. A tela distingue a data de geração do snapshot da última sincronização da origem, em Brasília. O snapshot não consulta automaticamente o Transferegov.

## Aplicação local

Abra `Sistema PROFOR 2026/PROFOR_2026/INICIAR SISTEMA.cmd` com Node.js disponível. A aplicação atende em `http://127.0.0.1:8766/PROFOR_2026.html` e mantém o banco canônico em `dados/registros/`, excluído do Git. O navegador usa a API local; o IndexedDB antigo serve somente à migração já existente.

O uso em duas máquinas é alternado. Feche o sistema e confirme que o OneDrive terminou nas duas máquinas antes de continuar. “Salvo localmente” comprova a revisão gravada, não o envio pelo OneDrive. Revisões/token, detecção de ramos concorrentes e lock headless foram preservados.

## Gerar o snapshot local

Antes de gerar, exporte um backup JSON pelo painel **Exportação** e preserve uma cópia íntegra de `dados/registros/` fora do Git. Com o banco real disponível, execute na raiz Git:

```powershell
node tools/build_public_docs.cjs
node --test "Sistema PROFOR 2026/PROFOR_2026/tests/public-snapshot.test.cjs"
node "Sistema PROFOR 2026/PROFOR_2026/tests/public-pages.cjs"
```

O gerador valida a base, espelha os módulos canônicos e escreve `docs/dados_publicos.js` por arquivo temporário. Sem banco acessível ele falha preservando o snapshot anterior; para atualizar apenas código, use `node tools/build_public_docs.cjs --mirror-only`. `docs/index.html` e `docs/public-storage.js` são complementos próprios. Fixtures sintéticas devem usar `build({state, history, outputDir})` em diretório temporário.

Gerar não publica. Commit, push, deploy e merge são operações separadas, conforme autorização da execução. O site publicado só muda depois de uma publicação autorizada.

## Manutenção de 02/10/2026

Foram tratadas exclusivamente as prioridades **1, 2, 3, 4, 5, 6, 7, 8 e 10**. A prioridade 9 foi excluída; o requisito existente de ID 9, os demais requisitos, categorias e textos foram preservados.

Regras, formato dos metadados, compatibilidade, comandos, validações e recuperação estão em [README da aplicação](Sistema%20PROFOR%202026/PROFOR_2026/README.md#manutenção-02102026--prioridades-selecionadas). O diário da raiz permanece local conforme a regra de exclusão do Git existente.

Para retomar esta entrega em outro computador, o roteiro, pedido original, metadados da entrega e backup verificado estão em `output/continuidade-prioridades-2026-10-02/`; logs e capturas estão em `output/playwright/prioridades/`. Essas pastas pertencem a este workspace e são excluídas do Git, mas devem acompanhar a sincronização do OneDrive. Confira o término do envio/download antes de trocar de máquina. Na raiz, `node output/continuidade-prioridades-2026-10-02/verificar-backup.cjs` confere os hashes e lê a cadeia de backup sem restaurar dados. A aplicação precisa do Node.js local; os testes de UI/XLSX usam runtimes locais indicados no README da aplicação, sem caminhos específicos desta máquina no código novo.
