# PROFOR/ONASP 2026

Aplicação local de acompanhamento das propostas do PROFOR/ONASP 2026 e página pública de consulta aos dados registrados.

## Consulta pública

**https://masselorc.github.io/PROFOR-2026/**

A página em `docs/` é estática e somente para consulta. Ela exibe as propostas ativas do snapshot publicado, com filtros, detalhes e exportações de leitura. Não permite editar, enviar ou excluir dados. A data de atualização aparece na interface. Os dados publicados são uma fotografia da base local, sem sincronização automática com o Transferegov.

## Aplicação local

Abra `Sistema PROFOR 2026/PROFOR_2026/INICIAR SISTEMA.cmd` em um computador com Node.js. O servidor atende em `http://127.0.0.1:8766/PROFOR_2026.html`. A versão local contém os controles de edição e mantém o banco em `dados/registros/` no workspace sincronizado pelo OneDrive.

O banco operacional, inclusive revisões antigas e propostas retiradas do painel, permanece no workspace local e está excluído do Git. O repositório contém o código da aplicação, os testes, os recursos da interface e o snapshot público gerado em `docs/dados_publicos.js`.

## Atualizar a publicação

1. Execute `ATUALIZAR_GITHUB_PAGES.cmd` ou `node tools/build_public_docs.cjs` na raiz do projeto. O gerador lê a versão mais recente do banco local, valida o estado e copia para `docs/` apenas as propostas ativas.
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
