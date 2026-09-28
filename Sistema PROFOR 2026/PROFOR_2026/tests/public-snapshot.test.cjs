'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const D = require('../domain.js');
const { projectPublicState } = require('../../../tools/build_public_docs.cjs');
const { createStore } = require('../workspace-store.cjs');
const docsFile = path.resolve(__dirname, '../../../docs/dados_publicos.js');

test('projeção pública reflete com exatidão o estado canônico do sistema local', () => {
  const store = createStore(path.resolve(__dirname, '../dados/registros'));
  const loaded = store.load();
  const state = loaded.state;
  const history = store.history();

  const result = projectPublicState(state, history);
  D.validateState(result);
  assert.equal(result.revision, state.revision);
  assert.equal(result.proposals.length, state.proposals.length);
  assert.equal(D.activeProposals(result).length, D.activeProposals(state).length);
  assert.equal(D.deletedProposals(result).length, D.deletedProposals(state).length);
  assert.deepEqual(result.sync, state.sync);
  assert.equal(result.syncHistory.length, history.length);
});

test('docs/dados_publicos.js reproduz o banco do sistema e valida regras de domínio', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(docsFile, 'utf8'), context);
  const result = context.window.PROFOR_PUBLIC_DATA;
  D.validateState(result);
  assert.equal(result.proposals.length, 14);
  assert.equal(D.activeProposals(result).length, 9);
  assert.equal(D.deletedProposals(result).length, 5);
  assert.ok(Array.isArray(result.syncHistory));
  assert.ok(result.syncHistory.length > 0);
});
