/* Testes do módulo de sincronização. Sem rede: as fixtures ZIP/CSV são geradas
   em memória e o HTTP é substituído por um agente falso injetado. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { Readable } = require('node:stream');

const S = require('../transferegov-sync.cjs');
const T = require('../transferegov.js');
const D = require('../domain.js');

/* ---------- ajuda: CRC32, ZIP e CSV de fixture ---------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* Monta um ZIP válido (método 8 ou 0) com as entradas informadas. */
function buildZip(entries, method = 8) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const raw = Buffer.from(content, 'utf8');
    const payload = method === 8 ? zlib.deflateRawSync(raw) : raw;
    const crc = crc32(raw);
    const nameBuffer = Buffer.from(name, 'utf8');
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(method, 8);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(payload.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(nameBuffer.length, 26);
    local.push(header, nameBuffer, payload);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0, 8);
    directory.writeUInt16LE(method, 10);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(payload.length, 20);
    directory.writeUInt32LE(raw.length, 24);
    directory.writeUInt16LE(nameBuffer.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, nameBuffer);
    offset += 30 + nameBuffer.length + payload.length;
  }
  const localPart = Buffer.concat(local);
  const centralPart = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralPart.length, 12);
  end.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, centralPart, end]);
}

function newTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'profor-sync-teste-'));
}

function writeZip(dir, name, entries, method = 8) {
  const target = path.join(dir, name);
  fs.writeFileSync(target, buildZip(entries, method));
  return target;
}

/* ---------- fixtures textuais ---------- */

const PROGRAM_CSV = '\uFEFFID_PROGRAMA;COD_PROGRAMA;NOME_PROGRAMA\r\n'
  + '1;3000020260022;DADOS FICTÍCIOS — PROFOR\r\n'
  + '2;9999999999999;OUTRO PROGRAMA FICTÍCIO\r\n';

const LINKS_CSV = 'ID_PROGRAMA;ID_PROPOSTA\r\n1;101\r\n1;102\r\n2;999\r\n';

/* Cabeçalho da extração real de propostas (36 colunas no arquivo oficial; aqui
   só as usadas pelo pipeline). A vigência é exigida na leitura e vem DD/MM/AAAA. */
const PROPOSAL_HEADER = 'ID_PROPOSTA;UF_PROPONENTE;NR_PROPOSTA;IDENTIF_PROPONENTE;NM_PROPONENTE;OBJETO_PROPOSTA;SIT_PROPOSTA;DIA_PROPOSTA;DIA_INIC_VIGENCIA_PROPOSTA;DIA_FIM_VIGENCIA_PROPOSTA;VL_REPASSE_PROP;VL_CONTRAPARTIDA_PROP;VL_GLOBAL_PROP';

const PROPOSAL_CSV = PROPOSAL_HEADER + '\r\n'
  + '101;AP;TESTE-101/2026;46634317000180;PROPONENTE "FICTÍCIO" A;Aquisição de equipamentos;EM ANÁLISE;05/06/2009;11/09/2026;11/03/2028;100.000,00;3.000,32;103.000,32\r\n'
  + '102;PE;TESTE-102/2026;;PROPONENTE FICTÍCIO B;Capacitação interna;EM ANÁLISE;31/02/2026;;;1.000,00;100,00;1.100,00\r\n'
  + '999;SP;TESTE-999/2026;;FORA DO PROGRAMA;Não importar;FICTÍCIO;15/09/2026;01/01/2027;31/12/2027;10,00;0,00;10,00\r\n';

const PAD_CSV = 'ID_PROPOSTA;ID_ITEM_PAD;DESCRICAO_ITEM;QTD_ITEM;VALOR_UNITARIO_ITEM;VALOR_TOTAL_ITEM\r\n'
  + '101;11;Item fictício A;1.234,5;1.000,00;1.234.500,00\r\n'
  + '101;12;Item fictício B;2;50,50;101,00\r\n'
  + '999;99;Item de outro programa;1;10,00;10,00\r\n';

const CONTAINER_XML = '<?xml version="1.0" encoding="utf-8"?>\r\n'
  + '<EnumerationResults ServiceEndpoint="https://api-publica.transferegov.gestao.gov.br/downloads/" ContainerName="dadosgov">\r\n'
  + '  <Blobs>\r\n'
  + '    <Blob>\r\n'
  + '      <Name>siconv_programa.zip</Name>\r\n'
  + '      <Properties>\r\n'
  + '        <Last-Modified>Mon, 15 Sep 2026 11:12:28 GMT</Last-Modified>\r\n'
  + '        <Content-Length>11117617</Content-Length>\r\n'
  + '      </Properties>\r\n'
  + '    </Blob>\r\n'
  + '    <Blob>\r\n'
  + '      <Name>siconv_programa_proposta.zip</Name>\r\n'
  + '      <Properties>\r\n'
  + '        <Last-Modified>Mon, 15 Sep 2026 11:12:29 GMT</Last-Modified>\r\n'
  + '        <Content-Length>6494599</Content-Length>\r\n'
  + '      </Properties>\r\n'
  + '    </Blob>\r\n'
  + '    <Blob>\r\n'
  + '      <Name>siconv_proposta.zip</Name>\r\n'
  + '      <Properties>\r\n'
  + '        <Last-Modified>Mon, 15 Sep 2026 11:12:30 GMT</Last-Modified>\r\n'
  + '        <Content-Length>205515057</Content-Length>\r\n'
  + '      </Properties>\r\n'
  + '    </Blob>\r\n'
  + '    <Blob>\r\n'
  + '      <Name>siconv_plano_aplicacao_detalhado.zip</Name>\r\n'
  + '      <Properties>\r\n'
  + '        <Last-Modified>Mon, 15 Sep 2026 11:12:31 GMT</Last-Modified>\r\n'
  + '        <Content-Length>289931798</Content-Length>\r\n'
  + '      </Properties>\r\n'
  + '    </Blob>\r\n'
  + '  </Blobs>\r\n'
  + '</EnumerationResults>\r\n';

/* XML do container com os tamanhos reais dos blobs informados. */
function containerXml(blobs) {
  const rows = Object.entries(S.BLOBS).map(([, name]) => {
    const body = blobs[name];
    const size = body ? body.length : 0;
    return `    <Blob>\r\n      <Name>${name}</Name>\r\n      <Properties>\r\n        <Last-Modified>Mon, 15 Sep 2026 11:12:28 GMT</Last-Modified>\r\n        <Content-Length>${size}</Content-Length>\r\n      </Properties>\r\n    </Blob>`;
  });
  return '<?xml version="1.0" encoding="utf-8"?>\r\n'
    + '<EnumerationResults ServiceEndpoint="https://api-publica.transferegov.gestao.gov.br/downloads/" ContainerName="dadosgov">\r\n'
    + '  <Blobs>\r\n' + rows.join('\r\n') + '\r\n  </Blobs>\r\n</EnumerationResults>\r\n';
}

/* Agente falso: listagem a partir de `xmlBlobs` e respostas a partir de `served`.
   Quando `served` não informa um blob, serve o próprio corpo de `xmlBlobs`. */
function fakeAgent(xmlBlobs, served = xmlBlobs) {
  const xml = containerXml(xmlBlobs);
  return {
    get(url, options, callback) {
      const href = String(url);
      const name = href.split('/').pop().split('?')[0];
      const body = href.includes('comp=list') ? Buffer.from(xml, 'utf8') : served[name];
      const response = Readable.from(body ? [body] : []);
      response.statusCode = body ? 200 : 404;
      response.headers = { 'content-type': 'application/octet-stream' };
      process.nextTick(() => callback(response));
      return { setTimeout() {}, on() {}, destroy() {} };
    }
  };
}

function fixtureWorld() {
  const dir = newTempDir();
  const blobs = {
    'siconv_programa.zip': fs.readFileSync(writeZip(dir, 'siconv_programa.zip', [['siconv_programa.csv', PROGRAM_CSV]])),
    'siconv_programa_proposta.zip': fs.readFileSync(writeZip(dir, 'siconv_programa_proposta.zip', [['siconv_programa_proposta.csv', LINKS_CSV]])),
    'siconv_proposta.zip': fs.readFileSync(writeZip(dir, 'siconv_proposta.zip', [['siconv_proposta.csv', PROPOSAL_CSV]])),
    'siconv_plano_aplicacao_detalhado.zip': fs.readFileSync(writeZip(dir, 'siconv_plano_aplicacao_detalhado.zip', [['siconv_plano_aplicacao_detalhado.csv', PAD_CSV]]))
  };
  return { dir, blobs, agentModule: fakeAgent(blobs) };
}

/* ZIPs do mundo de fixture trocando apenas o CSV de propostas: programa, vínculo
   e PAD continuam os mesmos, para exercitar um caso específico de coluna. O
   vínculo pode ser trocado junto quando o CSV sob medida não traz todas as
   propostas vinculadas ao programa (o pipeline recusa extração inconsistente). */
function proposalBlobs(proposalCsv, linksCsv = LINKS_CSV) {
  return {
    'siconv_programa.zip': buildZip([['siconv_programa.csv', PROGRAM_CSV]]),
    'siconv_programa_proposta.zip': buildZip([['siconv_programa_proposta.csv', linksCsv]]),
    'siconv_proposta.zip': buildZip([['siconv_proposta.csv', proposalCsv]]),
    'siconv_plano_aplicacao_detalhado.zip': buildZip([['siconv_plano_aplicacao_detalhado.csv', PAD_CSV]])
  };
}

/* ---------- parser CSV ---------- */

test('parser CSV aceita aspas, `;` e quebra de linha dentro de aspas, CRLF e BOM', () => {
  const rows = [];
  const parser = S.csvParser(row => rows.push(row));
  for (const character of '\uFEFFA;B\r\n"a;\nb";"c""d"\r\n') parser.feed(character);
  parser.finish();
  assert.deepEqual(rows, [['A', 'B'], ['a;\nb', 'c"d']]);
});

test('parser CSV rejeita aspas não fechadas e aspas no início do campo', () => {
  const truncated = S.csvParser(() => {});
  truncated.feed('"abc');
  assert.throws(() => truncated.finish(), /truncado/i);
  /* Fechamento de aspas seguido de texto continua o valor literalmente
     (dado real: `PROPONENTE "FICTÍCIO" A`). */
  const literal = [];
  const lenient = S.csvParser(row => literal.push(row));
  lenient.feed('ID;NOME\r\n1;PROPONENTE "FICTÍCIO" A\r\n');
  lenient.finish();
  assert.deepEqual(literal[1], ['1', 'PROPONENTE "FICTÍCIO" A']);
  /* Aspas abertas dentro de campo citado consomem até o fechamento. */
  const quoted = [];
  const parser = S.csvParser(row => quoted.push(row));
  parser.feed('ID;NOME\r\n1;"A;B"\r\n');
  parser.finish();
  assert.deepEqual(quoted[1], ['1', 'A;B']);
});

test('parser CSV aceita modo sem aspas para arquivos volumosos', () => {
  const rows = [];
  const parser = S.csvParser(row => rows.push(row), 'none');
  parser.feed('\uFEFFID;VALOR\r\n1;2\r\n3;4\r\n');
  parser.finish();
  assert.deepEqual(rows, [['ID', 'VALOR'], ['1', '2'], ['3', '4']]);
});

/* ---------- varredura em bloco (linha isolada, campos depois) ---------- */

/* Alimenta um parser (por caractere ou em bloco) com o texto em pedaços do
   tamanho indicado e devolve as linhas produzidas. */
function lerLinhas(factory, texto, tamanhoDoPedaco) {
  const rows = [];
  const parser = factory(row => rows.push(row));
  for (let i = 0; i < texto.length; i += tamanhoDoPedaco) parser.feed(texto.slice(i, i + tamanhoDoPedaco));
  parser.finish();
  return rows;
}

/* Fixture no formato real: BOM, CRLF, `;` dentro de aspas, `""` escapado, campo
   vazio, campo citado vazio, aspas no meio de campo não citado, CR dentro de
   aspas e acentuação. Sem quebra de linha dentro de aspas — a varredura em
   bloco recusa esse caso de propósito (ver teste da guarda de aspas). */
const CSV_ASPAS = '\uFEFFID;NOME;OBS;VAZIO;CITADO;VALOR\r\n'
  + '1;PROPONENTE "FICTÍCIO" A;simples;;"";10,00\r\n'
  + '2;"campo;com ponto e vírgula";"aspas ""internas""";;"";20,00\r\n'
  + '3;"com CR\rdentro";SEM PONTO E VÍRGULA;;;30,00\r\n'
  + '4;;vazio à esquerda;;"çãé – acentuação";40,00\r\n';

const CSV_ASPAS_ESPERADO = [
  ['ID', 'NOME', 'OBS', 'VAZIO', 'CITADO', 'VALOR'],
  ['1', 'PROPONENTE "FICTÍCIO" A', 'simples', '', '', '10,00'],
  ['2', 'campo;com ponto e vírgula', 'aspas "internas"', '', '', '20,00'],
  ['3', 'com CR\rdentro', 'SEM PONTO E VÍRGULA', '', '', '30,00'],
  ['4', '', 'vazio à esquerda', '', 'çãé – acentuação', '40,00']
];

test('varredura em bloco produz exatamente as mesmas linhas do parser por caractere', () => {
  for (const tamanho of [1, 2, 3, 5, 17, 64, CSV_ASPAS.length]) {
    const bloco = lerLinhas(cb => S.csvBlockParser(cb, { sourceName: 'fixture.csv' }), CSV_ASPAS, tamanho);
    const caractere = lerLinhas(cb => S.csvParser(cb, 'all'), CSV_ASPAS, tamanho);
    assert.deepEqual(bloco, CSV_ASPAS_ESPERADO, `campos divergentes com pedaços de ${tamanho}`);
    assert.deepEqual(bloco, caractere, `divergência entre os parsers com pedaços de ${tamanho}`);
  }
});

test('equivalência entre os dois parsers se mantém em linhas geradas (fuzz determinístico)', () => {
  let semente = 20260915;
  const rand = () => { semente = (Math.imul(semente, 1664525) + 1013904223) >>> 0; return semente / 4294967296; };
  const escolha = lista => lista[Math.floor(rand() * lista.length)];
  /* Trechos com `;`, aspas em par, aspa literal isolada, CR embutido, acento e
     vazio. Nenhum trecho começa com aspa: quem abre campo citado é a montagem
     do campo, e aspa no meio do valor é literal (regra do parser antigo). */
  const trechos = ['', ' ', 'a', 'b;c', 'x"y"z', '2"3', 'PROPONENTE "FICTÍCIO" A', 'çãé – acento', 'CR\rdentro', '--', '#N/D'];
  const campo = () => {
    const base = escolha(trechos);
    if (rand() < 0.45) return `"${base.replace(/"/g, '""')}"`;
    /* Não citado: aspa no meio do valor continua literal. */
    return base;
  };
  const linhas = [];
  for (let n = 0; n < 200; n++) {
    const colunas = 1 + Math.floor(rand() * 6);
    linhas.push(Array.from({ length: colunas }, campo).join(';'));
    if (rand() < 0.05) linhas.push('');
  }
  const texto = '\uFEFF' + linhas.join('\r\n') + (rand() < 0.5 ? '\r\n' : '');
  /* Mesma sequência de cortes para os dois parsers: corta no meio de `""` e no
     meio de `\r\n` de propósito. */
  const pedacos = [];
  for (let i = 0, t = 1; i < texto.length; i += t) {
    t = 1 + Math.floor(rand() * 23);
    pedacos.push(texto.slice(i, i + t));
  }
  const rodar = factory => {
    const rows = [];
    const parser = factory(row => rows.push(row));
    for (const pedaco of pedacos) parser.feed(pedaco);
    parser.finish();
    return rows;
  };
  const bloco = rodar(cb => S.csvBlockParser(cb, { sourceName: 'fuzz.csv' }));
  const caractere = rodar(cb => S.csvParser(cb, 'all'));
  assert.ok(caractere.length > 100, `fuzz produziu só ${caractere.length} linhas`);
  assert.deepEqual(bloco, caractere);
});

test('varredura em bloco trata BOM, CRLF e última linha sem quebra', () => {
  const texto = '\uFEFFID;VALOR\r\n1;2\r\n3;4';
  const bloco = lerLinhas(cb => S.csvBlockParser(cb, { sourceName: 'semquebra.csv' }), texto, 3);
  assert.deepEqual(bloco, [['ID', 'VALOR'], ['1', '2'], ['3', '4']]);
});

test('linha lógica muito maior que o pedaço (1 MB) continua correta na varredura em bloco', () => {
  const grande = 'x'.repeat(1024 * 1024);
  const texto = `ID;OBS\r\n1;"${grande}"\r\n2;fim`;
  const bloco = lerLinhas(cb => S.csvBlockParser(cb, { sourceName: 'grande.csv' }), texto, 8192);
  assert.equal(bloco.length, 3);
  assert.equal(bloco[1][1].length, grande.length);
  assert.equal(bloco[2][1], 'fim');
  const caractere = lerLinhas(cb => S.csvParser(cb, 'all'), texto, 8192);
  assert.deepEqual(bloco, caractere);
});

test('aspa literal em campo não citado continua literal, sem erro (regressão da guarda)', async () => {
  /* Regressão: a guarda por paridade de aspas abortava a leitura de dado válido
     — o parser por caractere sempre leu `2"3` como literal. */
  assert.deepEqual(
    S.splitCsvLine('1;2"3;4', { sourceName: 'literal.csv', lineNumber: 2 }),
    ['1', '2"3', '4']
  );
  /* Aspas balanceadas no meio do valor continuam literais. */
  assert.deepEqual(
    S.splitCsvLine('1;PROPONENTE "FICTÍCIO" A;4', { sourceName: 'literal.csv', lineNumber: 3 }),
    ['1', 'PROPONENTE "FICTÍCIO" A', '4']
  );
  /* Aspe literal no fim da linha e aspa literal depois de campo citado fechado. */
  assert.deepEqual(S.splitCsvLine('a;b"c', { sourceName: 'literal.csv', lineNumber: 4 }), ['a', 'b"c']);
  assert.deepEqual(S.splitCsvLine('1;"a";b"c', { sourceName: 'literal.csv', lineNumber: 5 }), ['1', 'a', 'b"c']);

  const texto = 'ID;NOME;VALOR\r\n1;2"3;4\r\n2;PROPONENTE "FICTÍCIO" A;5\r\n';
  const bloco = lerLinhas(cb => S.csvBlockParser(cb, { sourceName: 'literal.csv' }), texto, 1);
  const caractere = lerLinhas(cb => S.csvParser(cb, 'all'), texto, 1);
  assert.deepEqual(bloco, [
    ['ID', 'NOME', 'VALOR'],
    ['1', '2"3', '4'],
    ['2', 'PROPONENTE "FICTÍCIO" A', '5']
  ]);
  assert.deepEqual(bloco, caractere);

  /* E no caminho completo do ZIP. */
  const dir = newTempDir();
  const zip = writeZip(dir, 'literal.zip', [['dados.csv', 'ID;NOME;VALOR\r\n1;2"3;4\r\n']]);
  const lidos = [];
  await S.scanZipCsv(zip, ['ID', 'NOME', 'VALOR'], row => lidos.push({ ...row }), { sourceName: 'literal.zip' });
  assert.deepEqual(lidos, [{ ID: '1', NOME: '2"3', VALOR: '4' }]);
});

test('campo citado que termina sem fechar é erro explícito com arquivo e linha', () => {
  assert.throws(
    () => S.splitCsvLine('1;"abc;4', { sourceName: 'siconv_plano_aplicacao_detalhado.csv', lineNumber: 7 }),
    err => err instanceof S.SyncError && err.status === 500
      && /campo citado sem fechamento/i.test(err.message)
      && /siconv_plano_aplicacao_detalhado\.csv/.test(err.message)
      && /linha 7/.test(err.message)
  );
  /* Campo citado fechado na mesma linha continua aceito. */
  assert.deepEqual(S.splitCsvLine('1;"A;B"', { sourceName: 'x.csv', lineNumber: 1 }), ['1', 'A;B']);
  /* Linha ruim no meio do arquivo: erro explícito na linha 2, não linha truncada. */
  const parser = S.csvBlockParser(() => {}, { sourceName: 'fixture.csv' });
  assert.throws(() => parser.feed('ID;VALOR\r\n1;"A;B\r\n'), /fixture\.csv, linha 2/);
  /* Cabeçalho (linha 1) terminando dentro de aspas: arquivo corrompido de verdade. */
  const cabecalho = S.csvBlockParser(() => {}, { sourceName: 'cabecalho.csv' });
  assert.throws(() => cabecalho.feed('"ID;VALOR\r\n'), /cabecalho\.csv, linha 1/);
  /* Última linha sem quebra e com campo citado aberto: mesmo erro, em finish(). */
  const truncado = S.csvBlockParser(() => {}, { sourceName: 'truncado.csv' });
  truncado.feed('ID;VALOR\r\n1;"A;B');
  assert.throws(() => truncado.finish(), /truncado\.csv, linha 2/);
  /* Modo 'none' é isento: lá as aspas são literais. */
  assert.deepEqual(
    S.splitCsvLine('1;2"3;4', { sourceName: 'literal.csv', lineNumber: 2, mode: 'none' }),
    ['1', '2"3', '4']
  );
});

test('scanZipCsv lê `;` dentro de aspas sem quebrar a contagem de colunas', async () => {
  const dir = newTempDir();
  const csv = 'ID;DESCRICAO;VALOR\r\n'
    + '1;"Ponto; e vírgula";"aspas ""internas"";fim"\r\n'
    + '2;simples;3,00\r\n';
  const zip = writeZip(dir, 'aspas.zip', [['dados.csv', csv]]);
  const rows = [];
  const stats = await S.scanZipCsv(zip, ['ID', 'DESCRICAO', 'VALOR'], row => rows.push({ ...row }), { sourceName: 'aspas.zip' });
  assert.equal(stats.rows, 2);
  assert.deepEqual(rows[0], { ID: '1', DESCRICAO: 'Ponto; e vírgula', VALOR: 'aspas "internas";fim' });
  assert.deepEqual(rows[1], { ID: '2', DESCRICAO: 'simples', VALOR: '3,00' });

  /* Método stored (0) com campo citado segue o mesmo caminho. */
  const stored = writeZip(dir, 'aspas-stored.zip', [['dados.csv', 'ID;VALOR\r\n1;"a;b"\r\n']], 0);
  const rowsStored = [];
  await S.scanZipCsv(stored, ['ID', 'VALOR'], row => rowsStored.push(row), { sourceName: 'aspas-stored.zip' });
  assert.equal(rowsStored[0].VALOR, 'a;b');
});

test('scanZipCsv falha explicitamente quando a extração traz quebra dentro de aspas', async () => {
  const dir = newTempDir();
  const csv = 'ID;VALOR\r\n1;"sem fim\r\n2;ok\r\n';
  const zip = writeZip(dir, 'quebrado.zip', [['dados.csv', csv]]);
  await assert.rejects(
    () => S.scanZipCsv(zip, ['ID', 'VALOR'], () => {}, { sourceName: 'quebrado.zip' }),
    err => err instanceof S.SyncError && err.status === 500
      && /campo citado sem fechamento/i.test(err.message)
      && /quebrado\.zip/.test(err.message)
      && /linha 2/.test(err.message)
  );
});

/* ---------- normalizações ---------- */

test('moneyBR converte reais para centavos e preserva vazio como null', () => {
  assert.equal(S.moneyBR('1.234,56'), 123456);
  assert.equal(S.moneyBR('100.000,00'), 10000000);
  assert.equal(S.moneyBR('0'), 0);
  assert.equal(S.moneyBR(''), null);
  assert.equal(S.moneyBR('   '), null);
  assert.equal(S.moneyBR('-'), null);
  assert.equal(S.moneyBR('R$ 12,34'), 1234);
  assert.throws(() => S.moneyBR('abc'));
});

test('quantityBR devolve string decimal com ponto e exige valor positivo', () => {
  assert.equal(S.quantityBR('1.234,5'), '1234.5');
  assert.equal(S.quantityBR('2'), '2');
  assert.equal(S.quantityBR(''), '');
  assert.throws(() => S.quantityBR('0'));
  assert.throws(() => S.quantityBR('abc'));
});

test('dateISO converte DD/MM/AAAA e rejeita data inexistente', () => {
  assert.equal(S.dateISO('05/06/2009'), '2009-06-05');
  assert.equal(S.dateISO(''), '');
  assert.equal(S.dateISO('-'), '');
  assert.throws(() => S.dateISO('31/02/2026'));
  assert.throws(() => S.dateISO('2009-13-01'));
});

/* ---------- ZIP ---------- */

test('leitura de ZIP por seek extrai a entrada CSV correta', async () => {
  const dir = newTempDir();
  const zip = writeZip(dir, 'duas.zip', [
    ['LEIAME.txt', 'texto que não interessa'],
    ['dados.csv', 'ID;VALOR\r\n7;9\r\n']
  ]);
  const rows = [];
  const stats = await S.scanZipCsv(zip, ['ID', 'VALOR'], row => rows.push({ ...row }), { sourceName: 'duas.zip' });
  assert.equal(stats.entry, 'dados.csv');
  assert.equal(stats.rows, 1);
  assert.deepEqual(rows, [{ ID: '7', VALOR: '9' }]);
});

test('ZIP com método stored (0) também é lido', async () => {
  const dir = newTempDir();
  const zip = writeZip(dir, 'stored.zip', [['dados.csv', 'ID;VALOR\r\n1;2\r\n']], 0);
  const rows = [];
  await S.scanZipCsv(zip, ['ID', 'VALOR'], row => rows.push(row), { sourceName: 'stored.zip' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].VALOR, '2');
});

test('ZIP sem entrada CSV e ZIP com CSV ambíguo são recusados', async () => {
  const dir = newTempDir();
  const noCsv = writeZip(dir, 'semcsv.zip', [['LEIAME.txt', 'nada']]);
  await assert.rejects(() => S.scanZipCsv(noCsv, ['ID'], () => {}, { sourceName: 'semcsv.zip' }), /entrada CSV/i);
  const twoCsv = writeZip(dir, 'dois.zip', [['a.csv', 'ID\r\n1\r\n'], ['b.csv', 'ID\r\n2\r\n']]);
  await assert.rejects(() => S.scanZipCsv(twoCsv, ['ID'], () => {}, { sourceName: 'dois.zip' }), /mais de uma entrada CSV/i);
  const named = writeZip(dir, 'siconv_programa.zip', [['x.csv', 'ID\r\n1\r\n'], ['siconv_programa.csv', 'ID\r\n1\r\n']]);
  const entries = S.entriesOf(fs.openSync(named, 'r'), fs.statSync(named).size);
  assert.equal(S.pickCsvEntry(entries, 'siconv_programa.zip').name, 'siconv_programa.csv');
});

/* ---------- listagem do container ---------- */

test('enumerateBlobs lê Name, Last-Modified e Content-Length do XML do Azure', () => {
  const blobs = S.enumerateBlobs(CONTAINER_XML);
  assert.equal(blobs.length, 4);
  assert.deepEqual(blobs[0], { name: 'siconv_programa.zip', bytes: 11117617, lastModified: 'Mon, 15 Sep 2026 11:12:28 GMT' });
  assert.equal(blobs[2].name, 'siconv_proposta.zip');
  assert.equal(blobs[2].bytes, 205515057);
  assert.equal(S.enumerateBlobs('<EnumerationResults><Blobs/></EnumerationResults>').length, 0);
});

/* ---------- allowlist e cache-buster ---------- */

test('allowlist aceita somente o host oficial e o caminho /downloads/', () => {
  assert.equal(S.assertAllowedUrl('https://api-publica.transferegov.gestao.gov.br/downloads/dadosgov/siconv_programa.zip').hostname, S.HOST);
  assert.equal(S.assertAllowedUrl('https://api-publica.transferegov.gestao.gov.br/downloads/dadosgov/siconv_programa.zip?cb=123').pathname, '/downloads/dadosgov/siconv_programa.zip');
  assert.throws(() => S.assertAllowedUrl('https://exemplo.gov.br/downloads/arquivo.zip'), err => err.status === 403);
  assert.throws(() => S.assertAllowedUrl('https://api-publica.transferegov.gestao.gov.br/outro/arquivo.zip'), err => err.status === 403);
  assert.throws(() => S.assertAllowedUrl('http://api-publica.transferegov.gestao.gov.br/downloads/arquivo.zip'), err => err.status === 403);
  assert.throws(() => S.assertAllowedUrl('nao é url'), err => err.status === 403);
});

test('cache-buster é acrescentado preservando a URL original', () => {
  const base = 'https://api-publica.transferegov.gestao.gov.br/downloads/dadosgov/siconv_programa.zip';
  assert.equal(S.withCacheBuster(base, 1234), `${base}?cb=1234`);
  assert.equal(S.withCacheBuster(base, 0), base);
  assert.equal(S.withCacheBuster(S.CONTAINER_URL, 99), `${S.CONTAINER_URL}&cb=99`);
});

test('assertDownloadMatches reprova bytes divergentes e aprova iguais', () => {
  assert.equal(S.assertDownloadMatches({ observedBytes: 11123607, expectedBytes: 11123607, name: 'siconv_programa.zip' }), true);
  assert.equal(S.assertDownloadMatches({ observedBytes: 10, expectedBytes: null }), true);
  const error = (() => { try { S.assertDownloadMatches({ observedBytes: 11117617, expectedBytes: 11123607, name: 'siconv_programa.zip' }); } catch (err) { return err; } })();
  assert.ok(error);
  assert.equal(error.status, 502);
  assert.match(error.message, /versão desatualizada de siconv_programa\.zip/i);
  assert.match(error.message, /11117617/);
});

/* ---------- pipeline offline completo ---------- */

test('pipeline offline produz propostas validadas por domain.validateImported', async () => {
  const world = fixtureWorld();
  const downloads = newTempDir();
  const response = await S.runSync({ agentModule: world.agentModule, dir: downloads, containerUrl: S.CONTAINER_URL, pad: true, force: true, timeoutMs: 5000 });

  assert.equal(response.stats.programIds, 1);
  assert.equal(response.stats.proposalIds, 2);
  assert.equal(response.stats.proposals, 2);
  assert.equal(response.stats.padItems, 2);
  assert.equal(response.source.kind, 'transferegov-downloads');
  assert.equal(response.source.pad, true);
  assert.equal(response.source.files.length, 4);
  assert.equal(response.source.files[0].name, 'siconv_programa.zip');
  assert.equal(response.source.blobs.length, 4);

  const first = response.proposals.find(p => p.id === '101');
  assert.ok(first);
  assert.equal(first.numero, 'TESTE-101/2026');
  assert.equal(first.uf, 'AP');
  assert.equal(first.programa, D.PROGRAM);
  assert.equal(first.cnpj, '46634317000180');
  assert.equal(first.proponente, 'PROPONENTE "FICTÍCIO" A');
  assert.equal(first.orgao, '');
  assert.equal(first.objeto, 'Aquisição de equipamentos');
  assert.equal(first.data, '2009-06-05');
  assert.equal(first.vigenciaInicio, '2026-09-11');
  assert.equal(first.vigenciaFim, '2028-03-11');
  assert.equal(first.repasse, 10000000);
  assert.equal(first.contrapartida, 300032);
  assert.equal(first.global, 10300032);
  assert.equal(first.pad.length, 2);
  assert.deepEqual(first.pad[0], { id: '11', descricao: 'Item fictício A', quantidade: '1234.5', unitario: 100000, total: 123450000 });

  const second = response.proposals.find(p => p.id === '102');
  assert.equal(second.uf, 'PE');
  assert.equal(second.data, '');
  assert.equal(second.vigenciaInicio, '');
  assert.equal(second.vigenciaFim, '');
  assert.ok(response.warnings.some(warning => /data inválida/i.test(warning)));
  assert.ok(response.proposals.every(proposal => D.validateImported(proposal) === proposal));
  assert.ok(!response.proposals.some(proposal => proposal.id === '999'));
  assert.ok(response.proposals.every(proposal => typeof proposal.data === 'string' && typeof proposal.situacao === 'string'));
  assert.ok(response.proposals.every(proposal => typeof proposal.vigenciaInicio === 'string' && typeof proposal.vigenciaFim === 'string'));
});

/* ---------- vigência da proposta (prazo de execução) ---------- */

test('colunas de vigência integram a lista exigida da extração de propostas', () => {
  assert.ok(S.COLUMNS[S.BLOBS.proposal].includes('DIA_INIC_VIGENCIA_PROPOSTA'));
  assert.ok(S.COLUMNS[S.BLOBS.proposal].includes('DIA_FIM_VIGENCIA_PROPOSTA'));
});

/* Vínculo com uma única proposta: os casos sob medida abaixo trazem só a 101. */
const SO_101 = 'ID_PROGRAMA;ID_PROPOSTA\r\n1;101\r\n';

test('extração de propostas sem as colunas de vigência é recusada com o nome do arquivo', async () => {
  const semVigencia = 'ID_PROPOSTA;UF_PROPONENTE;NR_PROPOSTA;IDENTIF_PROPONENTE;NM_PROPONENTE;OBJETO_PROPOSTA;SIT_PROPOSTA;DIA_PROPOSTA;VL_REPASSE_PROP;VL_CONTRAPARTIDA_PROP;VL_GLOBAL_PROP\r\n'
    + '101;AP;TESTE-101/2026;;FICTÍCIO;Objeto;EM ANÁLISE;05/06/2009;1,00;1,00;2,00\r\n';
  await assert.rejects(
    () => S.runSync({ agentModule: fakeAgent(proposalBlobs(semVigencia, SO_101)), dir: newTempDir(), containerUrl: S.CONTAINER_URL, pad: false, force: true, timeoutMs: 5000 }),
    /siconv_proposta\.zip: coluna DIA_INIC_VIGENCIA_PROPOSTA ausente/i
  );
});

test('vigência chega ao payload no formato AAAA-MM-DD', async () => {
  const world = fixtureWorld();
  const response = await S.runSync({ agentModule: world.agentModule, dir: newTempDir(), containerUrl: S.CONTAINER_URL, pad: false, force: true, timeoutMs: 5000 });
  const first = response.proposals.find(p => p.id === '101');
  assert.equal(first.vigenciaInicio, '2026-09-11');
  assert.equal(first.vigenciaFim, '2028-03-11');
  assert.ok(response.proposals.every(proposal => /^$|^\d{4}-\d{2}-\d{2}$/.test(proposal.vigenciaInicio)));
  assert.ok(response.proposals.every(proposal => /^$|^\d{4}-\d{2}-\d{2}$/.test(proposal.vigenciaFim)));
});

test('célula de vigência vazia vira string vazia sem quebrar a sincronização', async () => {
  const csv = PROPOSAL_HEADER + '\r\n'
    + '101;AP;TESTE-101/2026;;FICTÍCIO;Objeto fictício;EM ANÁLISE;05/06/2009;;;1,00;1,00;2,00\r\n';
  const response = await S.runSync({ agentModule: fakeAgent(proposalBlobs(csv, SO_101)), dir: newTempDir(), containerUrl: S.CONTAINER_URL, pad: false, force: true, timeoutMs: 5000 });
  const proposal = response.proposals[0];
  assert.equal(proposal.vigenciaInicio, '');
  assert.equal(proposal.vigenciaFim, '');
  assert.ok(!response.warnings.some(warning => /vigência/i.test(warning)), 'célula vazia não é data inválida');
  D.validateImported(proposal);
});

test('data de vigência inválida não derruba a sincronização e gera aviso', async () => {
  const csv = PROPOSAL_HEADER + '\r\n'
    + '101;AP;TESTE-101/2026;;FICTÍCIO;Objeto fictício;EM ANÁLISE;05/06/2009;31/02/2026;11/13/2028;1,00;1,00;2,00\r\n';
  const response = await S.runSync({ agentModule: fakeAgent(proposalBlobs(csv, SO_101)), dir: newTempDir(), containerUrl: S.CONTAINER_URL, pad: false, force: true, timeoutMs: 5000 });
  const proposal = response.proposals[0];
  assert.equal(proposal.vigenciaInicio, '');
  assert.equal(proposal.vigenciaFim, '');
  assert.ok(response.warnings.some(warning => /Proposta TESTE-101\/2026: vigência inicial: data inválida \(31\/02\/2026\)/i.test(warning)));
  assert.ok(response.warnings.some(warning => /Proposta TESTE-101\/2026: vigência final: data inválida \(11\/13\/2028\)/i.test(warning)));
  D.validateImported(proposal);
});

/* Modo offline (adaptador de arquivos): mesmas colunas, mesmo formato de saída. */
test('adaptador offline mapeia a vigência da proposta e aceita célula vazia', async () => {
  const fixture = name => new File([fs.readFileSync(path.join(__dirname, 'fixtures', name))], name);
  const common = { program: fixture('siconv_programa.csv'), links: fixture('siconv_programa_proposta.csv') };
  const result = await T.importFiles({ ...common, proposal: fixture('siconv_proposta.csv'), pad: fixture('siconv_plano_aplicacao_detalhado.csv') });
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].data, '2026-09-15');
  assert.equal(result.proposals[0].vigenciaInicio, '2026-09-11');
  assert.equal(result.proposals[0].vigenciaFim, '2028-03-11');

  const vazio = PROPOSAL_HEADER + '\r\n'
    + '101;AP;TESTE-101/2026;;FICTÍCIO;Objeto fictício;EM ANÁLISE;15/09/2026;;;100,00;1,00;101,00\r\n';
  const semVigencia = await T.importFiles({ ...common, proposal: new File([vazio], 'siconv_proposta.csv'), pad: null });
  assert.equal(semVigencia.proposals[0].vigenciaInicio, '');
  assert.equal(semVigencia.proposals[0].vigenciaFim, '');
});

test('pad=0 não lê o PAD e devolve pad nulo sem baixar o arquivo de PAD', async () => {
  const world = fixtureWorld();
  const requested = [];
  const agent = {
    get(url, options, callback) {
      requested.push(String(url));
      return world.agentModule.get(url, options, callback);
    }
  };
  const response = await S.runSync({ agentModule: agent, dir: newTempDir(), containerUrl: S.CONTAINER_URL, pad: false, force: true, timeoutMs: 5000 });
  assert.equal(response.source.pad, false);
  assert.equal(response.source.blobs.length, 3);
  assert.ok(response.proposals.every(proposal => proposal.pad === null));
  assert.equal(response.stats.padItems, 0);
  assert.ok(response.warnings.some(warning => /PAD não solicitado/i.test(warning)));
  assert.ok(!requested.some(url => url.includes('plano_aplicacao')));
});

test('UF fora do edital interrompe a sincronização com erro explícito', async () => {
  const dir = newTempDir();
  const proposalCsv = PROPOSAL_HEADER + '\r\n'
    + '101;XX;TESTE-101/2026;;FICTÍCIO;Objeto;EM ANÁLISE;05/06/2009;11/09/2026;11/03/2028;1,00;1,00;2,00\r\n';
  const blobs = proposalBlobs(proposalCsv);
  await assert.rejects(
    () => S.runSync({ agentModule: fakeAgent(blobs), dir, containerUrl: S.CONTAINER_URL, pad: false, force: true, timeoutMs: 5000 }),
    /UF fora do edital/i
  );
});

test('coluna obrigatória ausente é recusada com o nome do arquivo', async () => {
  const dir = newTempDir();
  const blobs = {
    'siconv_programa.zip': buildZip([['siconv_programa.csv', 'ID_PROGRAMA;NOME_PROGRAMA\r\n1;X\r\n']]),
    'siconv_programa_proposta.zip': buildZip([['siconv_programa_proposta.csv', LINKS_CSV]]),
    'siconv_proposta.zip': buildZip([['siconv_proposta.csv', PROPOSAL_CSV]]),
    'siconv_plano_aplicacao_detalhado.zip': buildZip([['siconv_plano_aplicacao_detalhado.csv', PAD_CSV]])
  };
  await assert.rejects(
    () => S.runSync({ agentModule: fakeAgent(blobs), dir, containerUrl: S.CONTAINER_URL, pad: false, force: true, timeoutMs: 5000 }),
    /siconv_programa\.zip: coluna COD_PROGRAMA ausente/i
  );
});

test('resposta truncada é recusada como versão desatualizada', async () => {
  const full = buildZip([['siconv_programa.csv', PROGRAM_CSV]]);
  const blobs = {
    'siconv_programa.zip': full,
    'siconv_programa_proposta.zip': buildZip([['siconv_programa_proposta.csv', LINKS_CSV]]),
    'siconv_proposta.zip': buildZip([['siconv_proposta.csv', PROPOSAL_CSV]])
  };
  /* O XML anuncia o tamanho real; a resposta de siconv_programa.zip entrega 20 bytes. */
  const agent = fakeAgent(blobs, { ...blobs, 'siconv_programa.zip': full.subarray(0, 20) });
  await assert.rejects(
    () => S.runSync({ agentModule: agent, dir: newTempDir(), containerUrl: S.CONTAINER_URL, pad: false, force: true, timeoutMs: 5000 }),
    err => err.status === 502 && /versão desatualizada/i.test(err.message)
  );
});

test('arquivo republicado durante o download é refeito após nova listagem', async () => {
  const oldProgram = buildZip([['siconv_programa.csv', 'ID_PROGRAMA;COD_PROGRAMA\r\n1;9999999999999\r\n']]);
  const newProgram = buildZip([['siconv_programa.csv', PROGRAM_CSV]]);
  const rest = {
    'siconv_programa_proposta.zip': buildZip([['siconv_programa_proposta.csv', LINKS_CSV]]),
    'siconv_proposta.zip': buildZip([['siconv_proposta.csv', PROPOSAL_CSV]])
  };
  /* Primeira listagem: geração antiga. A listagem seguinte (após o cache-buster
     novo) já anuncia a geração nova, que é o corpo efetivamente servido. */
  let listings = 0;
  const agent = {
    get(url, options, callback) {
      const href = String(url);
      const name = href.split('/').pop().split('?')[0];
      let body;
      if (href.includes('comp=list')) {
        listings++;
        body = Buffer.from(containerXml({ ...rest, 'siconv_programa.zip': listings === 1 ? oldProgram : newProgram }), 'utf8');
      } else if (name === 'siconv_programa.zip') {
        body = newProgram;
      } else {
        body = rest[name];
      }
      const response = Readable.from(body ? [body] : []);
      response.statusCode = body ? 200 : 404;
      process.nextTick(() => callback(response));
      return { setTimeout() {}, on() {}, destroy() {} };
    }
  };
  const response = await S.runSync({ agentModule: agent, dir: newTempDir(), containerUrl: S.CONTAINER_URL, pad: false, force: true, timeoutMs: 5000 });
  assert.ok(listings >= 2);
  assert.equal(response.stats.proposals, 2);
  assert.equal(response.source.blobs[0].bytes, newProgram.length);
});

test('três tentativas com geração divergente falham com erro 502 explícito', async () => {
  const listedProgram = buildZip([['siconv_programa.csv', 'ID_PROGRAMA;COD_PROGRAMA\r\n1;9999999999999\r\n']]);
  const servedProgram = buildZip([['siconv_programa.csv', PROGRAM_CSV]]);
  const rest = {
    'siconv_programa_proposta.zip': buildZip([['siconv_programa_proposta.csv', LINKS_CSV]]),
    'siconv_proposta.zip': buildZip([['siconv_proposta.csv', PROPOSAL_CSV]])
  };
  /* A listagem nunca é atualizada: sempre anuncia a geração antiga. */
  let requests = 0;
  const agent = {
    get(url, options, callback) {
      const href = String(url);
      const name = href.split('/').pop().split('?')[0];
      let body;
      if (href.includes('comp=list')) body = Buffer.from(containerXml({ ...rest, 'siconv_programa.zip': listedProgram }), 'utf8');
      else if (name === 'siconv_programa.zip') { requests++; body = servedProgram; }
      else body = rest[name];
      const response = Readable.from(body ? [body] : []);
      response.statusCode = body ? 200 : 404;
      process.nextTick(() => callback(response));
      return { setTimeout() {}, on() {}, destroy() {} };
    }
  };
  await assert.rejects(
    () => S.runSync({ agentModule: agent, dir: newTempDir(), containerUrl: S.CONTAINER_URL, pad: false, force: true, timeoutMs: 5000 }),
    err => err.status === 502 && /3 tentativas/.test(err.message) && /desatualizada/i.test(err.message)
  );
  assert.equal(requests, S.MAX_DOWNLOAD_ATTEMPTS);
});

test('cache por assinatura de blob evita nova execução e ainda entrega o payload', async () => {
  S.resetCache();
  const world = fixtureWorld();
  const common = { agentModule: world.agentModule, containerUrl: S.CONTAINER_URL, cache: true, timeoutMs: 5000 };
  const first = await S.runSync({ ...common, dir: newTempDir(), pad: false, force: true });
  assert.equal(first.unchanged, undefined);
  const cached = S.readCache();
  assert.ok(cached && cached.response.proposals.length === 2);
  assert.equal(cached.pad, false);
  const second = await S.runSync({ ...common, dir: newTempDir(), pad: false });
  assert.equal(second.unchanged, true);
  assert.equal(second.proposals.length, 2);
  S.resetCache();
});

test('regressão: cache quente entrega proposals mesmo para navegador sem dados', async () => {
  /* Defeito original: com o cache do servidor quente, a rota respondia só
     `{unchanged:true}` e um IndexedDB vazio ficava sem nenhuma proposta. */
  S.resetCache();
  const world = fixtureWorld();
  const common = { agentModule: world.agentModule, containerUrl: S.CONTAINER_URL, cache: true, timeoutMs: 5000 };
  const fresh = await S.runSync({ ...common, dir: newTempDir(), pad: false, force: true });
  assert.equal(fresh.proposals.length, 2);

  const warm = await S.runSync({ ...common, dir: newTempDir(), pad: false });
  assert.equal(warm.unchanged, true);
  assert.equal(warm.proposals.length, 2);
  assert.equal(warm.proposals[0].programa, D.PROGRAM);
  assert.equal(warm.stats.proposals, 2);
  assert.ok(Array.isArray(warm.warnings));
  assert.equal(warm.source.kind, 'transferegov-downloads');
  assert.equal(typeof warm.cachedAt, 'string');
  /* O payload do cache tem de ser validável como qualquer outro. */
  for (const proposal of warm.proposals) D.validateImported(proposal);
  S.resetCache();
});

test('cache com PAD não é servido a pedido sem PAD (e vice-versa)', async () => {
  S.resetCache();
  const world = fixtureWorld();
  const common = { agentModule: world.agentModule, containerUrl: S.CONTAINER_URL, cache: true, timeoutMs: 5000 };
  const withPad = await S.runSync({ ...common, dir: newTempDir(), pad: true, force: true });
  assert.equal(withPad.source.pad, true);
  assert.equal(withPad.proposals.find(p => p.id === '101').pad.length, 2);

  /* Mesma geração de blobs, formato diferente: não pode reaproveitar. */
  const withoutPad = await S.runSync({ ...common, dir: newTempDir(), pad: false });
  assert.equal(withoutPad.unchanged, undefined);
  assert.equal(withoutPad.source.pad, false);
  assert.ok(withoutPad.proposals.every(proposal => proposal.pad === null));
  assert.equal(S.readCache().pad, false);

  const reuse = await S.runSync({ ...common, dir: newTempDir(), pad: false });
  assert.equal(reuse.unchanged, true);
  assert.ok(reuse.proposals.every(proposal => proposal.pad === null));
  S.resetCache();
});

test('cachedUsable exige geração, formato e payload', () => {
  const entry = { blobs: 'a:1:x', pad: true, at: '2026-09-15T00:00:00.000Z', response: { proposals: [{ id: '1' }], source: { pad: true } } };
  assert.equal(S.cachedUsable(entry, 'a:1:x', true), true);
  assert.equal(S.cachedUsable(entry, 'a:1:x', false), false, 'formato diferente');
  assert.equal(S.cachedUsable(entry, 'a:2:x', true), false, 'geração diferente');
  assert.equal(S.cachedUsable({ ...entry, response: { proposals: null, source: { pad: true } } }, 'a:1:x', true), false, 'sem payload');
  assert.equal(S.cachedUsable({ blobs: 'a:1:x', pad: true, response: null }, 'a:1:x', true), false, 'sem resposta');
  assert.equal(S.cachedUsable(null, 'a:1:x', true), false, 'cache ausente');
});

test('syncStatus e syncList devolvem os blobs disponíveis sem baixar arquivos', async () => {
  const world = fixtureWorld();
  const status = await S.syncStatus({ agentModule: world.agentModule, containerUrl: S.CONTAINER_URL, timeoutMs: 5000 });
  assert.equal(status.ok, true);
  assert.equal(status.source.url, S.BASE_URL);
  assert.equal(status.source.blobs.length, Object.keys(S.BLOBS).length);
  assert.equal(typeof status.source.listedAt, 'string');
  const list = await S.syncList({ agentModule: world.agentModule, containerUrl: S.CONTAINER_URL, timeoutMs: 5000 });
  assert.deepEqual(list.blobs.map(blob => blob.name), Object.values(S.BLOBS));
});

test('assinatura de blobs muda quando Last-Modified ou bytes mudam', () => {
  const blobs = S.enumerateBlobs(CONTAINER_XML);
  const first = S.signatureOf(blobs, ['siconv_programa.zip', 'siconv_proposta.zip']);
  const copy = blobs.map(blob => ({ ...blob }));
  copy[2].lastModified = 'Tue, 16 Sep 2026 11:12:30 GMT';
  const second = S.signatureOf(copy, ['siconv_programa.zip', 'siconv_proposta.zip']);
  assert.notEqual(first, second);
  assert.equal(S.signatureOf(copy, ['siconv_programa.zip']), 'siconv_programa.zip:11117617:Mon, 15 Sep 2026 11:12:28 GMT');
});

/* ---------- textos da proposta (busca sob demanda) ----------
   O blob siconv_justificativas_proposta NÃO faz parte do pipeline: só é baixado
   quando fetchProposalTexts é chamada com ids específicos. */

const TEXTOS_HEADER = 'ID_PROPOSTA;CARACTERIZACAO_INTERESSES_RECI;PUBLICO_ALVO;PROBLEMA_A_SER_RESOLVIDO;RESULTADOS_ESPERADOS;RELACAO_PROPOSTA_OBJETIVOS_PRO;CAPACIDADE_TECNICA;JUSTIFICATIVA';

/* Fixture fiel ao arquivo oficial: 8 colunas, `;` dentro de aspas, CRLF e
   células vazias (a JUSTIFICATIVA costuma vir vazia). A linha 999 existe no
   arquivo mas nunca é pedida. */
const TEXTOS_CSV = TEXTOS_HEADER + '\r\n'
  + '101;"Caracterização fictícia 101";"Público-alvo fictício 101";"Problema 101";"Resultados 101";"Relação 101";"Capacidade 101";\r\n'
  + '102;;"Público-alvo; com ponto e vírgula";"Problema 102";"Resultados 102";"Relação 102";"Capacidade 102";""\r\n'
  + '999;"Fora do pedido";"Público 999";"Problema 999";"Resultados 999";"Relação 999";"Capacidade 999";"Justificativa 999"\r\n';

/* Mundo de fixture com o blob de textos: os quatro blobs do pipeline mais o ZIP
   de justificativas, com o tamanho real anunciado na listagem. O `dir` de
   download é próprio do teste (o cache de download vive nele). */
function textosWorld(csv = TEXTOS_CSV) {
  const world = fixtureWorld();
  const zip = buildZip([['siconv_justificativas_proposta.csv', csv]]);
  const blobs = { ...world.blobs, [S.BLOBS.textos]: zip };
  return { dir: newTempDir(), blobs, agentModule: fakeAgent(blobs) };
}

test('fetchProposalTexts devolve somente as propostas pedidas', async () => {
  const world = textosWorld();
  const progresso = [];
  const result = await S.fetchProposalTexts(['101'], message => progresso.push(message), {
    agentModule: world.agentModule, containerUrl: S.CONTAINER_URL, dir: world.dir, timeoutMs: 5000
  });

  assert.deepEqual(Object.keys(result.textos), ['101']);
  assert.equal(result.textos['999'], undefined, 'linha não pedida não entra no payload');
  assert.deepEqual(result.textos['101'], {
    caracterizacao: 'Caracterização fictícia 101',
    publicoAlvo: 'Público-alvo fictício 101',
    problema: 'Problema 101',
    resultados: 'Resultados 101',
    relacao: 'Relação 101',
    capacidade: 'Capacidade 101',
    justificativa: ''
  });
  assert.deepEqual(result.faltando, []);
  assert.equal(result.stats.found, 1);
  assert.equal(result.stats.rows, 3, 'rows é o total de linhas de dados do arquivo');
  assert.equal(result.stats.entry, 'siconv_justificativas_proposta.csv');
  assert.equal(typeof result.stats.durationMs, 'number');
  assert.ok(result.stats.durationMs >= 0);
  assert.ok(progresso.some(message => /baixando/i.test(message)), 'progresso avisa do download');
  assert.ok(progresso.some(message => /lendo/i.test(message)), 'progresso avisa da leitura');

  /* `;` dentro de aspas não quebra a coluna. */
  const dois = await S.fetchProposalTexts(['102'], () => {}, {
    agentModule: world.agentModule, containerUrl: S.CONTAINER_URL, dir: world.dir, timeoutMs: 5000
  });
  assert.equal(dois.textos['102'].publicoAlvo, 'Público-alvo; com ponto e vírgula');
});

test('id sem linha no arquivo entra em faltando e a consulta não falha', async () => {
  const world = textosWorld();
  const options = { agentModule: world.agentModule, containerUrl: S.CONTAINER_URL, dir: world.dir, timeoutMs: 5000 };
  const parcial = await S.fetchProposalTexts(['101', '424242'], () => {}, options);
  assert.deepEqual(Object.keys(parcial.textos), ['101']);
  assert.deepEqual(parcial.faltando, ['424242']);
  assert.equal(parcial.stats.found, 1);
  assert.equal(parcial.stats.rows, 3, 'linha ausente não interrompe a leitura do arquivo');

  /* Nenhum id encontrado também não é erro: payload vazio + faltando completo. */
  const nenhum = await S.fetchProposalTexts(['7', '8'], () => {}, options);
  assert.deepEqual(nenhum.textos, {});
  assert.deepEqual(nenhum.faltando, ['7', '8']);
  assert.equal(nenhum.stats.found, 0);
  assert.equal(nenhum.stats.entry, 'siconv_justificativas_proposta.csv');
});

test('célula vazia vira string vazia em todos os campos', async () => {
  const world = textosWorld();
  const result = await S.fetchProposalTexts(['101', '102'], () => {}, {
    agentModule: world.agentModule, containerUrl: S.CONTAINER_URL, dir: world.dir, timeoutMs: 5000
  });
  assert.equal(result.textos['101'].justificativa, '');
  assert.equal(result.textos['102'].caracterizacao, '', 'célula vazia não citada');
  assert.equal(result.textos['102'].justificativa, '', 'célula citada vazia ("")');
  for (const texto of Object.values(result.textos)) {
    assert.deepEqual(Object.keys(texto), ['caracterizacao', 'publicoAlvo', 'problema', 'resultados', 'relacao', 'capacidade', 'justificativa']);
    for (const valor of Object.values(texto)) assert.equal(typeof valor, 'string');
  }
});

test('ids inválidos são recusados antes de qualquer requisição à origem', async () => {
  const requested = [];
  const agent = { get(url) { requested.push(String(url)); return { setTimeout() {}, on() {}, destroy() {} }; } };
  const options = { agentModule: agent, containerUrl: S.CONTAINER_URL, dir: newTempDir(), timeoutMs: 5000 };
  const recusa = async ids => {
    await assert.rejects(
      () => S.fetchProposalTexts(ids, () => {}, options),
      err => err instanceof S.SyncError && err.status === 400 && /proposta/i.test(err.message)
    );
  };
  await recusa(['12a']);
  await recusa(['12 3']);
  await recusa(['']);
  await recusa(['1', '1']);
  await recusa([101]);
  await recusa('101');
  await recusa(null);
  await recusa([]);
  await recusa(Array.from({ length: S.MAX_TEXT_IDS + 1 }, (_, i) => String(i + 1)));
  assert.equal(requested.length, 0, 'nada é requisitado antes de validar os ids');

  /* O teto exato continua aceito. */
  const world = textosWorld();
  const limite = await S.fetchProposalTexts(
    Array.from({ length: S.MAX_TEXT_IDS }, (_, i) => String(i + 1)),
    () => {},
    { agentModule: world.agentModule, containerUrl: S.CONTAINER_URL, dir: world.dir, timeoutMs: 5000 }
  );
  assert.equal(limite.stats.found + limite.faltando.length, S.MAX_TEXT_IDS);
});

test('a leitura reaproveita o cache de download quando o blob não mudou', async () => {
  const world = textosWorld();
  const requested = [];
  const agent = { get(url, options, callback) { requested.push(String(url)); return world.agentModule.get(url, options, callback); } };
  const options = { agentModule: agent, containerUrl: S.CONTAINER_URL, dir: world.dir, timeoutMs: 5000, cacheBuster: 111 };
  const primeira = await S.fetchProposalTexts(['101'], () => {}, options);
  assert.equal(primeira.stats.found, 1);
  const downloads = requested.filter(url => url.includes(S.BLOBS.textos));
  assert.equal(downloads.length, 1, 'a primeira consulta baixa o blob uma vez');
  assert.ok(downloads[0].startsWith(`${S.BASE_URL}/dadosgov/${S.BLOBS.textos}`), 'caminho oficial com /downloads/dadosgov/');

  /* Mesma geração anunciada (bytes + Last-Modified): o carimbo do download vale
     e o ZIP de ~750 MB não é baixado de novo — só a listagem é conferida. */
  requested.length = 0;
  const segunda = await S.fetchProposalTexts(['101', '102'], () => {}, { ...options, cacheBuster: 222 });
  assert.deepEqual(segunda.faltando, []);
  assert.equal(segunda.textos['102'].problema, 'Problema 102');
  assert.equal(requested.filter(url => url.includes(S.BLOBS.textos)).length, 0, 'segunda consulta usa a cópia local');
  assert.ok(requested.some(url => url.includes('comp=list')), 'a listagem é conferida de novo');
  assert.ok(requested.every(url => url.startsWith(`${S.BASE_URL}/dadosgov/`)), 'nenhuma URL fora do prefixo oficial');

  /* Geração nova (bytes diferentes) invalida o carimbo e baixa de novo. */
  const trocado = buildZip([['siconv_justificativas_proposta.csv', TEXTOS_CSV.replace('Problema 101', 'Problema 101 revisado')]]);
  const mundoNovo = { ...world.blobs, [S.BLOBS.textos]: trocado };
  const agenteNovo = { get(url, options2, callback) { requested.push(String(url)); return fakeAgent(mundoNovo).get(url, options2, callback); } };
  requested.length = 0;
  const terceira = await S.fetchProposalTexts(['101'], () => {}, {
    agentModule: agenteNovo, containerUrl: S.CONTAINER_URL, dir: world.dir, timeoutMs: 5000, cacheBuster: 333
  });
  assert.equal(terceira.textos['101'].problema, 'Problema 101 revisado');
  assert.equal(requested.filter(url => url.includes(S.BLOBS.textos)).length, 1, 'blob republicado é baixado de novo');
});

test('o blob de textos fica fora do pipeline das quatro passadas', async () => {
  assert.ok(!S.BLOB_ORDER.includes(S.BLOBS.textos), 'textos não entra em BLOB_ORDER');
  assert.equal(S.BLOBS.textos, 'siconv_justificativas_proposta.zip');
  assert.deepEqual(S.COLUMNS[S.BLOBS.textos], ['ID_PROPOSTA', 'CARACTERIZACAO_INTERESSES_RECI', 'PUBLICO_ALVO', 'PROBLEMA_A_SER_RESOLVIDO', 'RESULTADOS_ESPERADOS', 'RELACAO_PROPOSTA_OBJETIVOS_PRO', 'CAPACIDADE_TECNICA', 'JUSTIFICATIVA']);

  const world = fixtureWorld();
  const requested = [];
  const agent = { get(url, options, callback) { requested.push(String(url)); return world.agentModule.get(url, options, callback); } };
  await S.runSync({ agentModule: agent, dir: newTempDir(), containerUrl: S.CONTAINER_URL, pad: true, force: true, timeoutMs: 5000 });
  assert.ok(!requested.some(url => url.includes('justificativas')), 'a sincronização normal não baixa o blob de textos');
});
