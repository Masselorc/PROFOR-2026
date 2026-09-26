/**
 * Script de build para geração e atualização da página estática do GitHub Pages (docs/).
 * 
 * Lê o banco de dados canônico em Sistema PROFOR 2026/PROFOR_2026/dados/registros,
 * valida as regras de negócio com domain.js, gera docs/dados_publicos.js e
 * sincroniza os arquivos de interface e assets essenciais.
 * 
 * Uso: node tools/build_public_docs.cjs
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SYSTEM_DIR = path.join(ROOT_DIR, 'Sistema PROFOR 2026', 'PROFOR_2026');
const REGISTROS_DIR = path.join(SYSTEM_DIR, 'dados', 'registros');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');

const D = require(path.join(SYSTEM_DIR, 'domain.js'));
const { createStore } = require(path.join(SYSTEM_DIR, 'workspace-store.cjs'));

function publicHistory(entries) {
  const publicValue = (field, value) => {
    if (field === 'pad' && Array.isArray(value)) {
      return value.map(item => ({
        descricao: item.descricao,
        quantidade: item.quantidade,
        unitario: item.unitario,
        total: item.total
      }));
    }
    // A interface pública só apresenta um aviso genérico para objetos; não
    // precisa copiar IDs nem estruturas internas para o snapshot.
    return value && typeof value === 'object' ? { updated: true } : value;
  };
  return entries.map(entry => ({
    at: entry.at,
    date: entry.date,
    source: entry.source,
    reconstructed: entry.reconstructed,
    activity: entry.activity.map(line => ({ at: line.at, message: line.message })),
    changes: entry.changes.map(change => ({
      numero: change.numero,
      uf: change.uf,
      field: change.field,
      before: publicValue(change.field, change.before),
      after: publicValue(change.field, change.after)
    }))
  }));
}

function build() {
  console.log('==> [1/3] Carregando banco do workspace...');
  const store = createStore(REGISTROS_DIR);
  const loaded = store.load();
  const state = loaded.state;

  D.validateState(state);
  console.log(`    Revisão atual: ${state.revision} | Total de propostas: ${state.proposals.length}`);

  const active = D.activeProposals(state);
  console.log(`    Propostas ativas: ${active.length} (${active.map(p => p.imported.uf).join(', ')})`);

  // Garante que o diretório docs/ existe
  fs.mkdirSync(DOCS_DIR, { recursive: true });

  console.log('==> [2/3] Gerando docs/dados_publicos.js...');
  const updatedAt = new Date().toISOString();
  // A consulta pública recebe propostas ativas e um extrato do histórico de
  // sincronizações. O extrato inclui propostas retiradas do painel, mas não
  // inclui histórico de análise manual, IDs técnicos ou o banco operacional.
  const publicState = {
    schemaVersion: state.schemaVersion,
    revision: state.revision,
    proposals: active,
    sync: state.sync,
    syncHistory: publicHistory(store.history())
  };
  D.validateState(publicState);
  const publicDataJs = `/**
 * Snapshot dos dados públicos do PROFOR/ONASP 2026 (Processo SEI 08016.010062/2026-18)
 * Gerado automaticamente em ${updatedAt}.
 * Não editar manualmente. Use tools/build_public_docs.cjs para atualizar.
 */
window.PROFOR_PUBLIC_UPDATED_AT = ${JSON.stringify(updatedAt)};
window.PROFOR_PUBLIC_DATA = ${JSON.stringify(publicState, null, 2)};
`;
  fs.writeFileSync(path.join(DOCS_DIR, 'dados_publicos.js'), publicDataJs, 'utf8');

  console.log('==> [3/3] Copiando arquivos essenciais para docs/...');
  const filesToCopy = ['domain.js', 'bandeiras-uf.js', 'styles.css', 'report.js', 'app.js'];
  for (const file of filesToCopy) {
    const src = path.join(SYSTEM_DIR, file);
    const dst = path.join(DOCS_DIR, file);
    fs.copyFileSync(src, dst);
    console.log(`    Copiado: ${file} (${fs.statSync(dst).size} bytes)`);
  }

  // Verifica arquivos complementares
  const required = ['index.html', 'public-storage.js', '.nojekyll'];
  for (const r of required) {
    const p = path.join(DOCS_DIR, r);
    if (!fs.existsSync(p)) {
      throw new Error(`Arquivo obrigatório ausente em docs/: ${r}`);
    }
  }

  console.log('==> Publicação estática gerada com sucesso em docs/!');
  console.log(`    Pronta para publicação no GitHub Pages (branch main, pasta /docs).`);
}

build();
