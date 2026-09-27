# PROFOR/ONASP 2026

Aplicação local de acompanhamento das propostas do PROFOR/ONASP 2026 e página pública de consulta aos dados registrados.

## Consulta pública

**https://masselorc.github.io/PROFOR-2026/**

A página em `docs/` é estática e somente para consulta. Ela exibe as propostas ativas do snapshot publicado, com filtros, dados oficiais, PAD e textos oficiais. O menu **Registros de atualização** apresenta somente mudanças de campos oficiais. A consulta pública não permite editar, sincronizar ou excluir dados; o snapshot não se atualiza automaticamente a partir do Transferegov.

## Aplicação local

Abra `Sistema PROFOR 2026/PROFOR_2026/INICIAR SISTEMA.cmd` em um computador com Node.js. O servidor atende em `http://127.0.0.1:8766/PROFOR_2026.html`. A versão local contém os controles de edição e mantém o banco em `dados/registros/` no workspace sincronizado pelo OneDrive.

O banco operacional completo e suas revisões permanecem no workspace local e estão excluídos do Git. O snapshot público contém apenas campos oficiais das propostas ativas e um extrato restrito das mudanças oficiais. Análises, diligências, observações internas, anexos, histórico manual, atividade operacional e IDs dos itens do PAD permanecem locais. Snapshots publicados anteriormente continuam no histórico do Git; eventual remoção histórica exige decisão separada.

## Atualizar a publicação

1. Execute `ATUALIZAR_GITHUB_PAGES.cmd` ou `node tools/build_public_docs.cjs` na raiz do projeto. O gerador lê a versão mais recente do banco local, valida o estado e atualiza `docs/` com propostas ativas e o extrato público do histórico de sincronizações.
2. Confira o resultado local com `node "Sistema PROFOR 2026/PROFOR_2026/tests/public-pages.cjs"`.
3. Publique o snapshot:

   ```bash
   git add docs/
   git commit -m "Atualiza consulta pública"
   git push origin main
   ```

Para publicar alterações no código da aplicação local, inclua também os arquivos modificados de `Sistema PROFOR 2026/PROFOR_2026/`, `tools/` ou do próprio README no commit. O GitHub Pages serve a pasta `/docs` da branch `main`.

## Testes

```bash
node --test "Sistema PROFOR 2026/PROFOR_2026/tests/domain.test.cjs"
node "Sistema PROFOR 2026/PROFOR_2026/tests/public-pages.cjs"
```
