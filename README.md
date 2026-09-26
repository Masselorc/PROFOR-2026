# PROFOR/ONASP 2026

Aplicação local de acompanhamento das propostas do PROFOR/ONASP 2026 e página pública de consulta aos dados registrados.

## Consulta pública

**https://masselorc.github.io/PROFOR-2026/**

A página em `docs/` é estática e somente para consulta. Ela exibe as propostas ativas do snapshot publicado, com filtros, detalhes e exportações de leitura. O menu **Registros de atualização** apresenta o calendário, os campos alterados com Antes/Depois e as linhas de atividade das sincronizações concluídas. O histórico também inclui mudanças de propostas que foram retiradas do painel. A consulta pública não permite editar, sincronizar ou excluir dados; o snapshot não se atualiza automaticamente a partir do Transferegov.

## Aplicação local

Abra `Sistema PROFOR 2026/PROFOR_2026/INICIAR SISTEMA.cmd` em um computador com Node.js. O servidor atende em `http://127.0.0.1:8766/PROFOR_2026.html`. A versão local contém os controles de edição e mantém o banco em `dados/registros/` no workspace sincronizado pelo OneDrive.

O banco operacional completo e suas revisões permanecem no workspace local e estão excluídos do Git. O snapshot público contém as propostas ativas e um extrato dos registros de sincronização — inclusive mudanças históricas de propostas retiradas do painel. No extrato não são copiados o histórico de análise manual, IDs de revisão ou IDs internos dos itens do PAD; o banco completo e a lixeira como lista navegável continuam locais.

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
