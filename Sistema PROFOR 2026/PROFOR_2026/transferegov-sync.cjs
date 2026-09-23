/* Sincronização server-side das extrações oficiais do Transferegov.
   Motivo: https://api-publica.transferegov.gestao.gov.br/downloads não envia
   cabeçalhos CORS (preflight OPTIONS = 403 e GET sem Access-Control-Allow-Origin),
   portanto o navegador nunca consegue baixar os ZIPs. O download é feito aqui,
   em streaming, sem materializar os arquivos em memória.

   CACHE-BUSTER — NÃO REMOVER: o CDN (Cloudflare) na frente da API mantém DUAS
   gerações do mesmo blob e escolhe pela URL. Sem query string, o GET de
   /downloads/dadosgov/<blob>.zip serve o snapshot antigo (medido em 15/09/2026:
   siconv_programa.zip 11.117.617 bytes, geração de 14/09) enquanto a listagem
   anuncia 11.123.607 bytes (geração de 15/09). A geração antiga de
   siconv_programa_proposta traz 4 propostas do programa; a nova traz 12.
   Por isso toda requisição leva `?cb=<timestamp>` e cada download é conferido
   contra o Content-Length da listagem (ver assertDownloadMatches). Parece
   ruído, mas sem ele a sincronização ingere dados velhos em silêncio.

   CACHE — NUNCA devolver só `{unchanged:true}`: o cache é do servidor e não
   conhece o estado do navegador. Um cliente novo, com IndexedDB vazio, ou vindo
   de outra origem (file:// x http://127.0.0.1:8766 têm bancos separados) precisa
   receber as propostas mesmo quando a origem não mudou. A resposta em cache é
   sempre o payload COMPLETO (proposals, warnings, source, stats) com
   `unchanged:true` e `cachedAt` apenas como metadados. O cache só é
   reaproveitado quando a geração dos blobs E o formato (`pad`) conferem
   (ver cachedUsable).

   Somente módulos nativos do Node. Nenhuma dependência externa.
   Cache de dados: apenas .cache/ ao lado deste arquivo.
   Cache temporário de download: pasta temporária do sistema. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const { Readable } = require('node:stream');
const { TextDecoder } = require('node:util');

const D = require('./domain.js');

const HOST = 'api-publica.transferegov.gestao.gov.br';
const PATH_PREFIX = '/downloads/';
const BASE_URL = `https://${HOST}/downloads`;
const CONTAINER_URL = `${BASE_URL}/dadosgov/?restype=container&comp=list`;
const CACHE_DIR = path.join(__dirname, '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'sync-result.json');
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_REDIRECTS = 5;
const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const ZIP64_EXTRA_ID = 0x0001;
const MAX_EOCD_SEARCH = 0xffff + 22;

/* Blobs oficiais usados pelo pipeline, na ordem das quatro passadas.
   `textos` fica FORA de BLOB_ORDER de propósito: os textos da proposta
   (caracterização, público-alvo, problema, resultados, relação com objetivos e
   capacidade técnica) só são buscados SOB DEMANDA, por proposta pedida — ver
   fetchProposalTexts. Incluí-lo no pipeline faria toda sincronização baixar e
   varrer mais ~750 MB sem que o payload de propostas use esses campos. */
const BLOBS = {
  program: 'siconv_programa.zip',
  links: 'siconv_programa_proposta.zip',
  proposal: 'siconv_proposta.zip',
  pad: 'siconv_plano_aplicacao_detalhado.zip',
  textos: 'siconv_justificativas_proposta.zip'
};
const BLOB_ORDER = [BLOBS.program, BLOBS.links, BLOBS.proposal, BLOBS.pad];

/* Colunas exigidas por arquivo, conferidas contra os cabeçalhos reais. */
const COLUMNS = {
  [BLOBS.program]: ['ID_PROGRAMA', 'COD_PROGRAMA'],
  [BLOBS.links]: ['ID_PROGRAMA', 'ID_PROPOSTA'],
  [BLOBS.proposal]: ['ID_PROPOSTA', 'UF_PROPONENTE', 'NR_PROPOSTA', 'IDENTIF_PROPONENTE', 'NM_PROPONENTE', 'OBJETO_PROPOSTA', 'SIT_PROPOSTA', 'DIA_PROPOSTA', 'DIA_INIC_VIGENCIA_PROPOSTA', 'DIA_FIM_VIGENCIA_PROPOSTA', 'VL_REPASSE_PROP', 'VL_CONTRAPARTIDA_PROP', 'VL_GLOBAL_PROP'],
  [BLOBS.pad]: ['ID_PROPOSTA', 'ID_ITEM_PAD', 'DESCRICAO_ITEM', 'QTD_ITEM', 'VALOR_UNITARIO_ITEM', 'VALOR_TOTAL_ITEM'],
  /* Ordem real do arquivo oficial (a última coluna costuma vir vazia). */
  [BLOBS.textos]: ['ID_PROPOSTA', 'CARACTERIZACAO_INTERESSES_RECI', 'PUBLICO_ALVO', 'PROBLEMA_A_SER_RESOLVIDO', 'RESULTADOS_ESPERADOS', 'RELACAO_PROPOSTA_OBJETIVOS_PRO', 'CAPACIDADE_TECNICA', 'JUSTIFICATIVA']
};

/* Campos de texto expostos por fetchProposalTexts: chave do payload -> coluna. */
const TEXT_FIELDS = {
  caracterizacao: 'CARACTERIZACAO_INTERESSES_RECI',
  publicoAlvo: 'PUBLICO_ALVO',
  problema: 'PROBLEMA_A_SER_RESOLVIDO',
  resultados: 'RESULTADOS_ESPERADOS',
  relacao: 'RELACAO_PROPOSTA_OBJETIVOS_PRO',
  capacidade: 'CAPACIDADE_TECNICA',
  justificativa: 'JUSTIFICATIVA'
};

/* Teto de propostas por consulta sob demanda. */
const MAX_TEXT_IDS = 200;

/* Erro com código HTTP associado, sempre sem stack na resposta ao cliente. */
class SyncError extends Error {
  constructor(message, status = 502, code = 'origin') {
    super(message);
    this.name = 'SyncError';
    this.status = status;
    this.code = code;
  }
}

/* ---------- allowlist ---------- */

/* Aceita somente o host oficial e o prefixo /downloads/ (query é ignorada,
   mas o path é validado sem ela). */
function assertAllowedUrl(value) {
  let url;
  try { url = new URL(String(value)); }
  catch { throw new SyncError('URL de origem inválida.', 403, 'allowlist'); }
  if (url.protocol !== 'https:' || url.hostname !== HOST || !url.pathname.startsWith(PATH_PREFIX)) {
    throw new SyncError(`Origem não autorizada: ${url.origin}${url.pathname}. Somente ${HOST}${PATH_PREFIX} é permitido.`, 403, 'allowlist');
  }
  return url;
}

/* Cache-buster: o CDN da origem guarda DUAS gerações do mesmo blob, chaveadas
   pela URL. Sem query, /downloads/dadosgov/<blob>.zip serve o snapshot antigo
   (medido em 15/09/2026: siconv_programa.zip 11.117.617 bytes, 14/09) em vez do
   anunciado na listagem (11.123.607 bytes, 15/09), perdendo propostas em
   silêncio. Todo GET leva um parâmetro próprio para forçar a geração corrente. */
function withCacheBuster(url, cacheBuster) {
  if (!cacheBuster) return String(url);
  const parsed = new URL(String(url));
  parsed.searchParams.set('cb', String(cacheBuster));
  return parsed.href;
}

/* ---------- HTTP ---------- */

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/* GET em streaming. Retorna {status, headers, stream}. O chamador consome e destrói. */
function openStream(url, options = {}) {
  assertAllowedUrl(url);
  const http = require('node:https');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const redirects = options.redirects ?? MAX_REDIRECTS;
  const agentModule = options.agentModule || http;
  return new Promise((resolve, reject) => {
    const req = agentModule.get(url, { headers: options.headers || {} }, res => {
      const status = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.resume();
        if (redirects <= 0) { reject(new SyncError('Excesso de redirecionamentos na origem.', 502)); return; }
        const next = new URL(res.headers.location, url).href;
        try { assertAllowedUrl(next); } catch (err) { reject(err); return; }
        resolve(openStream(next, { ...options, redirects: redirects - 1 }));
        return;
      }
      if (status !== 200) {
        res.resume();
        reject(new SyncError(`A origem respondeu HTTP ${status}.`, status === 404 ? 502 : 502));
        return;
      }
      resolve({ status, headers: res.headers, stream: res });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new SyncError(`Tempo limite de ${Math.round(timeoutMs / 1000)}s excedido ao consultar a origem.`, 504, 'timeout'));
    });
    req.on('error', err => {
      if (err instanceof SyncError) { reject(err); return; }
      reject(new SyncError(`Falha de rede ao consultar a origem: ${err.message}.`, err.code === 'ETIMEDOUT' ? 504 : 502));
    });
  });
}

/* Coleta o corpo inteiro como texto, com limite defensivo. */
async function readText(url, options = {}) {
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
  const { stream, headers } = await openStream(url, options);
  const chunks = [];
  let total = 0;
  try {
    for await (const chunk of stream) {
      total += chunk.length;
      if (total > maxBytes) throw new SyncError('Resposta da origem maior que o limite esperado para textos.', 502);
      chunks.push(chunk);
    }
  } catch (err) {
    if (err instanceof SyncError) throw err;
    throw new SyncError(`Falha ao ler a resposta da origem: ${err.message}.`, 502);
  }
  return { text: Buffer.concat(chunks).toString('utf8'), headers };
}

/* ---------- listagem do container Azure ---------- */

/* XML -> [{name, bytes, lastModified}]. Sem dependência de parser XML. */
function enumerateBlobs(xml) {
  const text = String(xml ?? '');
  const blobs = [];
  const names = [...text.matchAll(/<Name>([\s\S]*?)<\/Name>/g)];
  for (let i = 0; i < names.length; i++) {
    const start = names[i].index;
    const end = i + 1 < names.length ? names[i + 1].index : text.length;
    const block = text.slice(start, end);
    const lastModified = /<Last-Modified>([\s\S]*?)<\/Last-Modified>/.exec(block);
    const contentLength = /<Content-Length>([\s\S]*?)<\/Content-Length>/.exec(block);
    const bytes = Number(contentLength ? contentLength[1] : NaN);
    blobs.push({
      name: decodeXml(names[i][1]),
      bytes: Number.isFinite(bytes) ? bytes : null,
      lastModified: lastModified ? lastModified[1].trim() : null
    });
  }
  return blobs;
}

function decodeXml(value) {
  return String(value)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

async function listBlobs(options = {}) {
  const url = withCacheBuster(options.containerUrl || CONTAINER_URL, options.cacheBuster);
  const { text } = await readText(url, options);
  const blobs = enumerateBlobs(text);
  if (!blobs.length) throw new SyncError('A listagem da origem não retornou arquivos.', 502);
  return blobs;
}

/* ---------- ZIP: EOCD, diretório central e entrada CSV ---------- */

function readAt(fd, length, position) {
  const buffer = Buffer.alloc(length);
  let done = 0;
  while (done < length) {
    const got = fs.readSync(fd, buffer, done, length - done, position + done);
    if (got <= 0) break;
    done += got;
  }
  return done === length ? buffer : buffer.subarray(0, done);
}

function parseZip64Extra(extra, entry) {
  let p = 0;
  while (p + 4 <= extra.length) {
    const id = extra.readUInt16LE(p);
    const size = extra.readUInt16LE(p + 2);
    const body = extra.subarray(p + 4, p + 4 + size);
    if (id === ZIP64_EXTRA_ID) {
      let q = 0;
      if (entry.uncompSize === 0xffffffff && q + 8 <= body.length) { entry.uncompSize = Number(body.readBigUInt64LE(q)); q += 8; }
      if (entry.compSize === 0xffffffff && q + 8 <= body.length) { entry.compSize = Number(body.readBigUInt64LE(q)); q += 8; }
      if (entry.localOffset === 0xffffffff && q + 8 <= body.length) { entry.localOffset = Number(body.readBigUInt64LE(q)); q += 8; }
      return;
    }
    p += 4 + size;
  }
}

/* Lê o diretório central por seek. Retorna as entradas com nome, método, tamanhos e offset. */
function entriesOf(fd, size) {
  const tailLength = Math.min(size, MAX_EOCD_SEARCH);
  const tail = readAt(fd, tailLength, size - tailLength);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (tail.readUInt32LE(i) === EOCD_SIGNATURE) { eocd = i; break; }
  if (eocd < 0) throw new SyncError('ZIP inválido: registro EOCD não encontrado.', 502);
  let count = tail.readUInt16LE(eocd + 10);
  let cdOffset = tail.readUInt32LE(eocd + 16);
  let cdSize = tail.readUInt32LE(eocd + 12);
  /* Zip64: localizador imediatamente antes do EOCD clássico. */
  if (eocd >= 20 && tail.readUInt32LE(eocd - 20) === ZIP64_LOCATOR_SIGNATURE) {
    const z64Offset = Number(tail.readBigUInt64LE(eocd - 20 + 8));
    const z64 = readAt(fd, 56, z64Offset);
    if (z64.length < 56 || z64.readUInt32LE(0) !== ZIP64_EOCD_SIGNATURE) throw new SyncError('ZIP64 inválido: registro final não encontrado.', 502);
    count = Number(z64.readBigUInt64LE(32));
    cdSize = Number(z64.readBigUInt64LE(40));
    cdOffset = Number(z64.readBigUInt64LE(48));
  }
  if (!Number.isFinite(cdOffset) || cdOffset < 0 || cdOffset >= size) throw new SyncError('ZIP inválido: diretório central fora do arquivo.', 502);
  const available = Math.min(cdSize > 0 ? cdSize : size - cdOffset, size - cdOffset);
  const cd = readAt(fd, available, cdOffset);
  const entries = [];
  let p = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > cd.length) throw new SyncError('ZIP inválido: entrada truncada no diretório central.', 502);
    if (cd.readUInt32LE(p) !== CENTRAL_SIGNATURE) throw new SyncError('ZIP inválido: assinatura de entrada inválida.', 502);
    const entry = {
      name: '',
      method: cd.readUInt16LE(p + 10),
      compSize: cd.readUInt32LE(p + 20),
      uncompSize: cd.readUInt32LE(p + 24),
      localOffset: cd.readUInt32LE(p + 42)
    };
    const nameLength = cd.readUInt16LE(p + 28);
    const extraLength = cd.readUInt16LE(p + 30);
    const commentLength = cd.readUInt16LE(p + 32);
    entry.name = cd.subarray(p + 46, p + 46 + nameLength).toString('utf8');
    parseZip64Extra(cd.subarray(p + 46 + nameLength, p + 46 + nameLength + extraLength), entry);
    entries.push(entry);
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/* Escolhe explicitamente a entrada .csv (nunca assume Entries[0]). */
function pickCsvEntry(entries, sourceName = '') {
  const csv = entries.filter(entry => /\.csv$/i.test(path.basename(entry.name)));
  if (!csv.length) throw new SyncError(`ZIP sem entrada CSV${sourceName ? `: ${sourceName}` : ''}.`, 502);
  if (csv.length > 1) {
    const exact = csv.find(entry => path.basename(entry.name).toLowerCase() === path.basename(sourceName, '.zip').toLowerCase() + '.csv');
    if (exact) return exact;
    throw new SyncError(`ZIP com mais de uma entrada CSV${sourceName ? `: ${sourceName}` : ''}.`, 502);
  }
  return csv[0];
}

function localDataOffset(fd, entry) {
  const header = readAt(fd, 30, entry.localOffset);
  if (header.length < 30 || header.readUInt32LE(0) !== LOCAL_SIGNATURE) throw new SyncError('ZIP inválido: cabeçalho local ausente.', 502);
  return entry.localOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
}

/* ---------- CSV por streaming ---------- */

/* Parser incremental: aspas, `;` dentro de aspas, quebra de linha dentro de
   aspas, CRLF, BOM e `""` escapado. Compatível com transferência: feed(texto).
   Máquina de estados por caractere, simples e coberta pelos testes; segue sendo
   a REFERÊNCIA de equivalência da varredura em bloco (csvBlockParser), que é o
   caminho usado nos arquivos reais.
   Histórico: uma varredura guiada por indexOf direto sobre o fluxo de
   caracteres foi tentada para acelerar os 2,4 GB e descartada por introduzir
   divergência de estado. O caminho atual isola primeiro a LINHA inteira (por
   indexOf('\n') sobre o buffer acumulado) e só então separa os campos, sem
   nenhum estado atravessando pedaços.
   `mode` aceita 'all' (padrão) ou 'none' (sem aspas, mais rápido). */
function csvParser(onRow, mode = 'all') {
  let row = [], field = '', quoted = false, afterQuote = false, bom = true;
  /* Aspas no fim de um chunk: o par `""` pode estar partido entre dois pedaços. */
  let pendingQuote = false;
  const assert = (test, message) => { if (!test) throw new SyncError(message, 500, 'csv'); };
  function endField() { row.push(field); field = ''; }
  function endRow() {
    endField();
    const cells = row;
    row = [];
    if (cells.some(x => x !== '')) onRow(cells);
  }
  return {
    feed(chunk) {
      const value = String(chunk);
      const length = value.length;
      let i = 0;
      if (bom) {
        bom = false;
        if (value.charCodeAt(0) === 0xfeff) i = 1;
      }
      if (pendingQuote) {
        pendingQuote = false;
        if (value.charCodeAt(i) === 0x22) { field += '"'; i++; }
        else { quoted = false; afterQuote = true; }
      }
      while (i < length) {
        const code = value.charCodeAt(i);
        if (quoted) {
          if (code === 0x22) {
            if (i + 1 >= length) { pendingQuote = true; i++; continue; }
            if (value.charCodeAt(i + 1) === 0x22) { field += '"'; i += 2; continue; }
            quoted = false; afterQuote = true; i++;
            continue;
          }
          field += value[i];
          i++;
          continue;
        }
        if (code === 0x3b) { endField(); afterQuote = false; i++; continue; }
        if (code === 0x0a) { endRow(); afterQuote = false; i++; continue; }
        /* `\r` fora de aspas é descartado (CRLF). */
        if (code === 0x0d) { i++; continue; }
        if (code === 0x22 && mode === 'all') {
          /* Aspas abrem campo citado apenas no início limpo do campo; no meio
             continuam literais (dado real: `PROPONENTE "FICTÍCIO" A`). */
          if (!field) { quoted = true; afterQuote = false; i++; continue; }
          field += '"'; afterQuote = false; i++;
          continue;
        }
        afterQuote = false;
        field += value[i];
        i++;
      }
    },
    finish() {
      if (pendingQuote) { pendingQuote = false; field += '"'; quoted = false; }
      assert(!quoted, 'CSV truncado: aspas não fechadas.');
      if (field || row.length) endRow();
    }
  };
}

/* Separa os campos de UMA linha já isolada, respeitando aspas: `;` dentro de
   aspas não separa, `""` é aspa literal, `\r` fora de aspas é descartado (CRLF)
   e aspa no MEIO de campo não citado continua literal (dado real:
   `PROPONENTE "FICTÍCIO" A`). As regras são as mesmas do parser por caractere,
   aplicadas a uma linha completa — nenhum estado atravessa pedaços.
   `state.quoted` devolve se a linha TERMINOU dentro de um campo citado: esse é
   o único sinal de quebra de linha dentro de aspas. */
function splitCsvFields(line, state = null, mode = 'all') {
  const cells = [];
  const length = line.length;
  let field = '';
  let quoted = false;
  let i = 0;
  while (i < length) {
    const code = line.charCodeAt(i);
    if (quoted) {
      if (code === 0x22) {
        if (i + 1 < length && line.charCodeAt(i + 1) === 0x22) { field += '"'; i += 2; continue; }
        quoted = false; i++;
        continue;
      }
      field += line[i];
      i++;
      continue;
    }
    if (code === 0x3b) { cells.push(field); field = ''; i++; continue; }
    if (code === 0x0d) { i++; continue; }
    if (code === 0x22 && mode === 'all') {
      /* Aspas abrem campo citado apenas no início limpo do campo; no meio
         continuam literais (dado real: `PROPONENTE "FICTÍCIO" A`). */
      if (!field) { quoted = true; i++; continue; }
      field += '"';
      i++;
      continue;
    }
    field += line[i];
    i++;
  }
  cells.push(field);
  if (state) state.quoted = quoted;
  return cells;
}

/* Separa uma linha isolada em campos com a mesma semântica do parser por
   caractere — inclusive aspa literal no meio de campo não citado, que é dado
   válido (`1;2"3;4` → `['1', '2"3', '4']`).
   A varredura em bloco só é inválida quando a linha TERMINA DENTRO de um campo
   citado: o campo começou com aspas em início limpo e a aspa de fechamento não
   veio, o que indica quebra de linha dentro de aspas. Aí a resposta é FALHA
   EXPLÍCITA (com arquivo e linha) em vez de dado silenciosamente errado.
   Contar aspas da linha seria grosseiro: paridade ímpar não distingue aspa
   literal de campo citado sem fechamento, e abortaria dado válido.
   Cabeçalho é a linha 1 e passa pela mesma conferência: se ele termina dentro
   de aspas, o arquivo está corrompido de verdade.
   No modo 'none' as aspas são literais e não há estado de campo citado. */
function splitCsvLine(line, context = {}) {
  const sourceName = context.sourceName || 'CSV';
  const lineNumber = Number.isInteger(context.lineNumber) && context.lineNumber > 0 ? context.lineNumber : 0;
  const mode = context.mode === 'none' ? 'none' : 'all';
  const value = line === null || line === undefined ? '' : String(line);
  /* Caminho rápido: sem aspas e sem CR embutido, o split nativo do V8 devolve
     exatamente os mesmos campos — é o caso da quase totalidade das linhas. */
  if (mode === 'none' || value.indexOf('"') < 0) {
    return value.indexOf('\r') < 0 ? value.split(';') : splitCsvFields(value, null, mode);
  }
  const state = { quoted: false };
  const cells = splitCsvFields(value, state, mode);
  if (state.quoted) {
    const onde = lineNumber ? `linha ${lineNumber}` : 'linha sem número conhecido';
    throw new SyncError(`Campo citado sem fechamento em ${sourceName}, ${onde}: a linha termina dentro de aspas, indício de quebra de linha dentro de campo citado. A varredura em bloco não pode ser usada neste arquivo sem gerar dados errados. Confira a extração.`, 500, 'csv');
  }
  return cells;
}

/* Verdadeiro se alguma célula tem conteúdo (linha em branco é ignorada, como no
   parser por caractere). Laço explícito: `Array.prototype.some` com closure
   custa caro em 4,8 milhões de linhas. */
function anyCellFilled(cells) {
  for (let i = 0; i < cells.length; i++) if (cells[i] !== '') return true;
  return false;
}

/* Varredura em bloco: acumula o texto já decodificado, isola cada linha com
   indexOf('\n') e só então separa os campos. Interface igual à do csvParser
   (feed/finish), para o teste de equivalência rodar os dois lado a lado.
   Só a última linha parcial fica retida entre pedaços — a memória não cresce
   com o tamanho do arquivo, e uma linha muito maior que o pedaço continua
   correta porque nada é truncado.
   Segurança: toda linha passa por splitCsvLine, que recusa (erro explícito,
   com arquivo e linha) a linha que TERMINA dentro de um campo citado — sinal de
   quebra de linha dentro de aspas. Assim uma extração futura com esse defeito
   nunca produz resultado errado em silêncio, e aspa literal em campo não citado
   continua sendo dado válido. O cabeçalho é a linha 1 e passa pela mesma
   conferência. */
function csvBlockParser(onRow, options = {}) {
  const sourceName = options.sourceName || 'CSV';
  const mode = options.mode === 'none' ? 'none' : 'all';
  let buffer = '', start = 0, bom = true, lineNumber = 0;
  function emit(raw) {
    lineNumber++;
    if (!raw) return;
    const cells = splitCsvLine(raw, { sourceName, lineNumber, mode });
    if (anyCellFilled(cells)) onRow(cells);
  }
  return {
    feed(chunk) {
      let value = chunk === null || chunk === undefined ? '' : String(chunk);
      if (bom) {
        bom = false;
        if (value.charCodeAt(0) === 0xfeff) value = value.slice(1);
      }
      if (!value) return;
      /* Sem sobra anterior o pedaço vira o buffer sem copiar prefixo nenhum. */
      if (start >= buffer.length) { buffer = value; start = 0; }
      else buffer += value;
      let index = buffer.indexOf('\n', start);
      while (index !== -1) {
        let end = index;
        /* CRLF: o `\r` final é descartado, sempre fora de aspas. */
        if (end > start && buffer.charCodeAt(end - 1) === 0x0d) end--;
        emit(buffer.slice(start, end));
        start = index + 1;
        index = buffer.indexOf('\n', start);
      }
      /* Recorta o prefixo já consumido: a sobra retida é apenas a última linha
         parcial, e o buffer não cresce indefinidamente. */
      if (start > 0) { buffer = buffer.slice(start); start = 0; }
    },
    finish() {
      if (start < buffer.length) {
        let rest = buffer.slice(start);
        if (rest.charCodeAt(rest.length - 1) === 0x0d) rest = rest.slice(0, -1);
        emit(rest);
      }
      buffer = '';
      start = 0;
      return lineNumber;
    }
  };
}

/* Cria o mapeador cabeçalho -> célula, validando colunas exigidas. */
function headerMapper(headers, required, sourceName) {
  const clean = headers.map(h => String(h).trim());
  if (new Set(clean).size !== clean.length) throw new SyncError(`${sourceName}: cabeçalho duplicado.`, 502);
  for (const column of required) if (!clean.includes(column)) throw new SyncError(`${sourceName}: coluna ${column} ausente.`, 502);
  const index = new Map(clean.map((name, i) => [name, i]));
  return cells => {
    if (cells.length !== clean.length) throw new SyncError(`${sourceName}: linha com ${cells.length} colunas; esperado ${clean.length}.`, 502);
    const row = Object.create(null);
    for (const [name, i] of index) row[name] = cells[i];
    return row;
  };
}

/* Buffer de leitura: serve blocos grandes ao leitor. Sem isto, o inflate pede
   ~16 KB por vez e cada pedido vira uma chamada de fs.readSync — a passada de
   1,2 GB ficava dominada por I/O de blocos pequenos. */
const READ_BLOCK = 512 * 1024;

/* Lê a entrada CSV de um ZIP por streaming e chama onRow(row) linha a linha. */
async function scanZipCsv(zipPath, required, onRow, options = {}) {
  const sourceName = options.sourceName || path.basename(zipPath);
  const fd = fs.openSync(zipPath, 'r');
  let stream;
  try {
    const size = fs.statSync(zipPath).size;
    const entry = pickCsvEntry(entriesOf(fd, size), sourceName);
    if (![0, 8].includes(entry.method)) throw new SyncError(`${sourceName}: método de compressão ZIP não suportado (${entry.method}).`, 502);
    const start = localDataOffset(fd, entry);
    const end = entry.compSize > 0 ? start + entry.compSize : size;
    let position = start;
    const raw = new Readable({
      read() {
        if (position >= end) { this.push(null); return; }
        const length = Math.min(READ_BLOCK, end - position);
        const buffer = Buffer.allocUnsafe(length);
        let got = 0;
        while (got < length) {
          const read = fs.readSync(fd, buffer, got, length - got, position + got);
          if (read <= 0) break;
          got += read;
        }
        if (got <= 0) { this.push(null); return; }
        position += got;
        this.push(got === length ? buffer : buffer.subarray(0, got));
      }
    });
    raw.on('close', () => { try { fs.closeSync(fd); } catch { /* já fechado */ } });
    stream = entry.method === 8 ? raw.pipe(zlib.createInflateRaw()) : raw;

    const decoder = new TextDecoder('utf-8');
    let map = null, headers = null, rows = 0, bytes = 0;
    /* Varredura em bloco: isola a linha e só então separa os campos. É o
       caminho medido para os arquivos reais (PAD de 1,2 GB) e foi conferido
       também no arquivo de textos (1.157.816 linhas, todas com 8 colunas,
       nenhuma linha terminando dentro de aspas). O parser por caractere
       continua no módulo como referência de equivalência dos testes. */
    const parser = csvBlockParser(cells => {
      if (!map) { map = headerMapper(cells, required, sourceName); headers = cells.map(h => String(h).trim()); return; }
      const row = map(cells);
      rows++;
      onRow(row);
    }, { sourceName, mode: options.csvMode || 'all' });
    try {
      for await (const chunk of stream) {
        bytes += chunk.length;
        parser.feed(decoder.decode(chunk, { stream: true }));
      }
      parser.feed(decoder.decode());
      parser.finish();
    } catch (err) {
      if (err instanceof SyncError) throw err;
      throw new SyncError(`Falha ao descompactar ${sourceName}: ${err.message}.`, 502);
    }
    if (!headers) throw new SyncError(`${sourceName}: arquivo vazio ou sem cabeçalho.`, 502);
    return { rows, bytes, uncompSize: entry.uncompSize, entry: entry.name, headers, sourceName };
  } finally {
    if (stream && typeof stream.destroy === 'function') stream.destroy();
    if (!stream) { try { fs.closeSync(fd); } catch { /* já fechado */ } }
  }
}

/* ---------- normalizações ---------- */

function text(value) {
  return value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim();
}

/* Remove BOM e espaços; converte marcadores usuais de vazio em string vazia. */
function raw(value) {
  let s = value === null || value === undefined ? '' : String(value);
  s = s.replace(/^\uFEFF/, '').replace(/\s+/g, ' ').trim();
  if (['-', '--', 'NULL', 'null', 'N/A', 'NA', '#N/D'].includes(s)) return '';
  return s;
}

/* `1.234,56` -> 123456 centavos. Vazio/ausente -> null (nunca 0 silencioso). */
function moneyBR(value) {
  const s = raw(value);
  if (!s) return null;
  return D.moneyBR(s);
}

/* `1.234,5` -> "1234.5". Vazio/ausente -> ''. */
function quantityBR(value) {
  const s = raw(value);
  if (!s) return '';
  return D.quantityBR(s);
}

/* `05/06/2009` -> `2009-06-05`; vazio -> ''. */
function dateISO(value) {
  const s = raw(value);
  if (!s) return '';
  return D.dateISO(s);
}

/* Repassa a data inválida como aviso em vez de abortar a sincronização toda. */
function dateSafe(value, label) {
  try { return { value: dateISO(value), warning: null }; }
  catch (err) { return { value: '', warning: `${label}: data inválida (${raw(value)}). Campo deixado em branco.` }; }
}

/* ---------- cache ---------- */

function ensureCacheDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  return CACHE_DIR;
}

function readCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); }
  catch { return null; }
}

function writeCache(entry) {
  try {
    ensureCacheDir();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(entry));
  } catch (err) {
    return `Não foi possível gravar o cache em .cache/: ${err.message}.`;
  }
  return null;
}

/* Assinatura de estado dos blobs relevantes: nome, bytes e lastModified. */
function signatureOf(blobs, names) {
  return names
    .map(name => {
      const blob = blobs.find(b => b.name === name);
      return blob ? `${blob.name}:${blob.bytes}:${blob.lastModified}` : `${name}:ausente`;
    })
    .join('|');
}

/* Cache só é reaproveitável se a geração dos blobs bate E o formato é o mesmo.
   Resposta com PAD não pode servir pedido `pad=0` (nem o inverso): o payload
   difere em `source.pad` e no `pad` de cada proposta. */
function cachedUsable(cached, signature, pad) {
  if (!cached || !cached.response || !Array.isArray(cached.response.proposals)) return false;
  if (cached.blobs !== signature) return false;
  if (cached.pad !== pad) return false;
  return cached.response.source?.pad === pad;
}

/* ---------- download ---------- */

function defaultDownloadDir() {
  return path.join(os.tmpdir(), 'profor-transferegov');
}

/* Comparação pura entre o que foi lido e o que a listagem anunciou.
   Bytes lidos menores que o anunciado significam snapshot antigo do CDN. */
function assertDownloadMatches({ observedBytes, expectedBytes, name = 'arquivo' } = {}) {
  if (expectedBytes === null || expectedBytes === undefined) return true;
  if (observedBytes === expectedBytes) return true;
  throw new SyncError(`A origem serviu uma versão desatualizada de ${name}: ${observedBytes} bytes lidos contra ${expectedBytes} anunciados na listagem. Repita a sincronização mais tarde.`, 502, 'stale');
}

const MAX_DOWNLOAD_ATTEMPTS = 3;

/* Baixa um blob para disco em streaming preservando cache local por lastModified.
   A URL leva cache-buster (ver withCacheBuster) e o total lido é conferido contra
   o Content-Length da listagem; divergência refaz a requisição até 3 tentativas. */
async function downloadBlob(blob, options = {}) {
  const dir = options.dir || defaultDownloadDir();
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, blob.name);
  const stampFile = `${target}.stamp`;
  let current = blob;
  for (let attempt = 1; ; attempt++) {
    const stamp = `${current.bytes}:${current.lastModified}`;
    if (!options.force && fs.existsSync(target)) {
      try {
        if (fs.readFileSync(stampFile, 'utf8') === stamp) {
          return { path: target, bytes: fs.statSync(target).size, cached: true, lastModified: current.lastModified, etag: null, effectiveLastModified: null, expectedBytes: current.bytes };
        }
      } catch { /* sem carimbo: baixa novamente */ }
    }
    const url = withCacheBuster(`${BASE_URL}/dadosgov/${current.name}`, options.cacheBuster);
    const { stream, headers } = await openStream(url, options);
    const partial = `${target}.parcial`;
    let written = 0;
    let progressAt = 0;
    const fd = fs.openSync(partial, 'w');
    try {
      for await (const chunk of stream) {
        fs.writeSync(fd, chunk);
        written += chunk.length;
        /* Avisa no máximo a cada 5% para não inundar o log em 200 MB. */
        if (typeof options.onProgress === 'function' && current.bytes) {
          if (written - progressAt >= current.bytes / 20) {
            progressAt = written;
            options.onProgress(`  ${current.name}: ${Math.round((written / current.bytes) * 100)}%`);
          }
        }
      }
    } catch (err) {
      try { fs.closeSync(fd); } catch { /* já fechado */ }
      try { fs.unlinkSync(partial); } catch { /* já removido */ }
      if (err instanceof SyncError) throw err;
      throw new SyncError(`Falha ao baixar ${current.name}: ${err.message}.`, 502);
    }
    fs.closeSync(fd);
    let stale = null;
    try { assertDownloadMatches({ observedBytes: written, expectedBytes: current.bytes, name: current.name }); }
    catch (err) { stale = err; }
    if (stale) {
      try { fs.unlinkSync(partial); } catch { /* já removido */ }
      if (attempt >= MAX_DOWNLOAD_ATTEMPTS) {
        throw new SyncError(`A origem serviu uma versão desatualizada de ${current.name} em ${attempt} tentativas (${written} bytes lidos; listagem anuncia ${current.bytes}). Repita a sincronização mais tarde.`, 502, 'stale');
      }
      /* Nova listagem e novo cache-buster: a geração publicada pode ter mudado. */
      options.cacheBuster = Date.now();
      const fresh = (await listBlobs(options)).find(item => item.name === current.name);
      if (fresh) current = fresh;
      if (typeof options.onRetry === 'function') options.onRetry({ name: current.name, attempt, written, expected: current.bytes });
      continue;
    }
    fs.renameSync(partial, target);
    /* Carimbo guarda a identidade usada na comparação com a listagem seguinte. */
    try { fs.writeFileSync(stampFile, `${current.bytes}:${current.lastModified}`); } catch { /* carimbo é opcional */ }
    return {
      path: target,
      bytes: written,
      cached: false,
      lastModified: current.lastModified,
      etag: headers && (headers.etag || headers.ETag) || null,
      effectiveLastModified: headers && (headers['last-modified'] || headers['Last-Modified']) || null,
      expectedBytes: current.bytes
    };
  }
}

/* ---------- pipeline de sincronização ---------- */

const inFlight = new Map();

/* Pipeline completo: lista -> baixa -> quatro passadas -> normaliza -> valida. */
async function runSync(options = {}) {
  const started = Date.now();
  const warnings = [];
  const pad = options.pad !== false;
  const force = options.force === true;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const dir = options.dir || defaultDownloadDir();
  const progress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  /* Origem injetada (testes/diagnóstico) não usa o cache por padrão; `cache:true`
     permite exercitar o caminho de cache sem rede. */
  const isolated = !!(options.containerUrl || options.files) && options.cache !== true;
  /* Cache-buster único por execução: neutraliza o snapshot antigo do CDN. */
  const cacheBuster = options.cacheBuster ?? Date.now();
  const runOptions = { ...options, cacheBuster };
  const listed = await listBlobs(runOptions);
  const listedAt = new Date().toISOString();
  const byName = new Map(listed.map(blob => [blob.name, blob]));
  const wanted = pad ? BLOB_ORDER : BLOB_ORDER.filter(name => name !== BLOBS.pad);
  const available = wanted.map(name => byName.get(name) || { name, bytes: null, lastModified: null });

  /* Só usa o cache na operação normal do servidor. Execuções com origem
     injetada (testes e diagnóstico offline) sempre recalculam. */
  if (!force && !isolated) {
    const cached = readCache();
    if (cachedUsable(cached, signatureOf(listed, [BLOBS.program, BLOBS.proposal]), pad)) {
      /* Devolve o payload COMPLETO com `unchanged` apenas como metadado: o cache
         é do servidor e não conhece o estado do navegador. Um cliente novo (ou
         IndexedDB limpo, ou outra origem) precisa receber as propostas mesmo
         quando a origem não mudou. */
      return { ...cached.response, unchanged: true, cachedAt: cached.at || null };
    }
  }

  progress('Baixando extrações oficiais…');
  const files = {};
  for (const blob of available) {
    progress(`Baixando ${blob.name}…`);
    const result = await downloadBlob(blob, { ...runOptions, dir, timeoutMs, force });
    files[blob.name] = {
      path: result.path,
      bytes: result.bytes,
      expectedBytes: result.expectedBytes ?? blob.bytes,
      lastModified: result.lastModified ?? blob.lastModified,
      effectiveLastModified: result.effectiveLastModified ?? result.lastModified ?? blob.lastModified,
      etag: result.etag ?? null
    };
    if (blob.bytes !== null && result.bytes !== blob.bytes) {
      warnings.push(`${blob.name}: a origem publicou um arquivo novo durante a sincronização (${blob.bytes} → ${result.bytes} bytes).`);
    }
  }

  /* O tamanho registrado é o realmente baixado; a listagem da origem é viva. */
  const selected = name => ({
    name,
    bytes: files[name]?.bytes ?? null,
    expectedBytes: files[name]?.expectedBytes ?? null,
    lastModified: files[name]?.lastModified ?? null,
    etag: files[name]?.etag ?? null
  });
  const signature = [BLOBS.program, BLOBS.proposal]
    .map(name => `${name}:${files[name].bytes}:${files[name].lastModified}`)
    .join('|');

  /* Passada 1: ID_PROGRAMA de COD_PROGRAMA = 3000020260022. */
  progress('Lendo programas…');
  const programIds = new Set();
  const programStats = await scanZipCsv(files[BLOBS.program].path, COLUMNS[BLOBS.program], row => {
    if (text(row.COD_PROGRAMA) === D.PROGRAM) programIds.add(text(row.ID_PROGRAMA));
  }, { sourceName: BLOBS.program });
  if (!programIds.size) throw new SyncError(`Programa ${D.PROGRAM} não localizado no arquivo de programas.`, 502);

  /* Passada 2: ID_PROPOSTA vinculados aos programas encontrados. */
  progress('Cruzando programas e propostas…');
  const proposalIds = new Set();
  const linksStats = await scanZipCsv(files[BLOBS.links].path, COLUMNS[BLOBS.links], row => {
    if (programIds.has(text(row.ID_PROGRAMA))) {
      const id = text(row.ID_PROPOSTA);
      if (id) proposalIds.add(id);
    }
  }, { sourceName: BLOBS.links });

  /* Passada 3: propostas do programa. */
  progress('Lendo propostas do programa…');
  const proposals = new Map();
  const proposalStats = await scanZipCsv(files[BLOBS.proposal].path, COLUMNS[BLOBS.proposal], row => {
    const id = text(row.ID_PROPOSTA);
    if (!proposalIds.has(id)) return;
    if (proposals.has(id)) throw new SyncError(`Proposta duplicada no arquivo de propostas: ${id}.`, 502);
    const uf = text(row.UF_PROPONENTE);
    if (!Object.hasOwn(D.UFS, uf)) throw new SyncError(`UF fora do edital na proposta ${text(row.NR_PROPOSTA)}: ${uf || '(vazia)'}. Confira a extração.`, 502);
    const numero = text(row.NR_PROPOSTA);
    const when = dateSafe(row.DIA_PROPOSTA, `Proposta ${numero}`);
    if (when.warning) warnings.push(when.warning);
    /* Vigência da proposta: célula vazia ou inválida vira '' com aviso, nunca
       aborta a sincronização — o prazo de execução é dado de análise, não
       requisito de importação. */
    const start = dateSafe(row.DIA_INIC_VIGENCIA_PROPOSTA, `Proposta ${numero}: vigência inicial`);
    const end = dateSafe(row.DIA_FIM_VIGENCIA_PROPOSTA, `Proposta ${numero}: vigência final`);
    if (start.warning) warnings.push(start.warning);
    if (end.warning) warnings.push(end.warning);
    proposals.set(id, {
      id,
      numero,
      uf,
      programa: D.PROGRAM,
      cnpj: text(row.IDENTIF_PROPONENTE),
      proponente: text(row.NM_PROPONENTE),
      orgao: '',
      objeto: text(row.OBJETO_PROPOSTA),
      situacao: text(row.SIT_PROPOSTA),
      data: when.value,
      vigenciaInicio: start.value,
      vigenciaFim: end.value,
      repasse: moneyBR(row.VL_REPASSE_PROP),
      contrapartida: moneyBR(row.VL_CONTRAPARTIDA_PROP),
      global: moneyBR(row.VL_GLOBAL_PROP),
      pad: pad ? [] : null
    });
  }, { sourceName: BLOBS.proposal });

  const missing = [...proposalIds].filter(id => !proposals.has(id));
  if (missing.length) {
    throw new SyncError(`Extrações inconsistentes: ${missing.length} proposta(s) vinculada(s) ao programa ausente(s) do arquivo de propostas (ex.: ${missing.slice(0, 3).join(', ')}).`, 502);
  }

  /* Passada 4 (opcional): itens do plano de aplicação detalhado. */
  let padStats = null;
  if (pad) {
    progress('Lendo itens do plano de aplicação…');
    let padItems = 0;
    padStats = await scanZipCsv(files[BLOBS.pad].path, COLUMNS[BLOBS.pad], row => {
      const proposal = proposals.get(text(row.ID_PROPOSTA));
      if (!proposal) return;
      const id = text(row.ID_ITEM_PAD);
      if (!id || proposal.pad.some(item => item.id === id)) { warnings.push(`Item do PAD ignorado (ID ausente ou duplicado) na proposta ${proposal.numero}.`); return; }
      let quantidade;
      try { quantidade = quantityBR(row.QTD_ITEM); }
      catch { warnings.push(`Item ${id} da proposta ${proposal.numero} ignorado: quantidade inválida.`); return; }
      if (!quantidade) { warnings.push(`Item ${id} da proposta ${proposal.numero} ignorado: quantidade ausente.`); return; }
      let unitario, total;
      try { unitario = moneyBR(row.VALOR_UNITARIO_ITEM); total = moneyBR(row.VALOR_TOTAL_ITEM); }
      catch { warnings.push(`Item ${id} da proposta ${proposal.numero} ignorado: valor monetário inválido.`); return; }
      if (unitario === null || total === null) { warnings.push(`Item ${id} da proposta ${proposal.numero} ignorado: valor unitário ou total ausente.`); return; }
      proposal.pad.push({ id, descricao: text(row.DESCRICAO_ITEM), quantidade, unitario, total });
      padItems++;
    }, { sourceName: BLOBS.pad });
  } else {
    warnings.push('PAD não solicitado (pad=0): o PAD anterior de cada proposta existente será preservado.');
  }

  const result = [...proposals.values()];
  if (!result.length) throw new SyncError('Nenhuma proposta do programa foi localizada nas extrações.', 502);
  for (const proposal of result) D.validateImported(proposal);
  for (const uf of Object.keys(D.UFS)) {
    const count = result.filter(proposal => proposal.uf === uf).length;
    if (count > 1) warnings.push(`${uf}: ${count} propostas no programa. Conferência manual necessária.`);
  }

  const missingFields = result.filter(proposal => ['repasse', 'contrapartida', 'global'].some(key => proposal[key] === null));
  for (const proposal of missingFields) warnings.push(`Proposta ${proposal.numero}: valor de repasse, contrapartida ou global ausente na extração.`);

  const response = {
    proposals: result,
    warnings,
    source: {
      kind: 'transferegov-downloads',
      url: BASE_URL,
      blobs: wanted.map(selected),
      files: [programStats, linksStats, proposalStats, padStats]
        .filter(Boolean)
        .map(stats => ({ name: stats.sourceName, bytes: stats.bytes, rows: stats.rows })),
      pad,
      listedAt
    },
    stats: {
      programIds: programIds.size,
      proposalIds: proposalIds.size,
      proposals: result.length,
      padItems: result.reduce((sum, proposal) => sum + (proposal.pad ? proposal.pad.length : 0), 0),
      durationMs: Date.now() - started
    }
  };

  if (!isolated) {
    const warning = writeCache({ blobs: signature, pad, at: listedAt, response });
    if (warning) response.warnings.push(warning);
  }
  return response;
}

/* Sincronização com deduplicação de chamadas simultâneas. */
function sync(options = {}) {
  const key = `sync:${options.pad === false ? 0 : 1}:${options.force === true ? 1 : 0}:${options.dir || ''}`;
  const running = inFlight.get(key);
  if (running) return running;
  const promise = runSync(options).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

/* Estado da origem: lista os blobs disponíveis sem baixar arquivos grandes. */
async function syncStatus(options = {}) {
  const blobs = await listBlobs(options);
  return {
    ok: true,
    source: {
      url: BASE_URL,
      listedAt: new Date().toISOString(),
      blobs: blobs.map(blob => ({ name: blob.name, bytes: blob.bytes, lastModified: blob.lastModified }))
    }
  };
}

/* Lista simples para diagnóstico. */
async function syncList(options = {}) {
  const blobs = await listBlobs(options);
  return { ok: true, blobs: blobs.map(blob => ({ name: blob.name, bytes: blob.bytes, lastModified: blob.lastModified })) };
}

/* ---------- textos da proposta (busca sob demanda) ---------- */

/* Valida a lista pedida: strings de dígitos, de 1 a MAX_TEXT_IDS, sem
   repetição. Erro de entrada do cliente, por isso status 400. */
function assertProposalIds(ids) {
  if (!Array.isArray(ids)) throw new SyncError('Informe a lista de propostas (ids) a consultar.', 400, 'ids');
  if (!ids.length) throw new SyncError('Informe ao menos uma proposta para buscar os textos.', 400, 'ids');
  if (ids.length > MAX_TEXT_IDS) throw new SyncError(`Máximo de ${MAX_TEXT_IDS} propostas por consulta; foram pedidas ${ids.length}.`, 400, 'ids');
  const seen = new Set();
  for (const value of ids) {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
      throw new SyncError(`Identificador de proposta inválido: ${JSON.stringify(value)}. Use somente dígitos (ex.: 123456).`, 400, 'ids');
    }
    if (seen.has(value)) throw new SyncError(`Identificador de proposta repetido: ${value}.`, 400, 'ids');
    seen.add(value);
  }
  return [...ids];
}

/* Busca SOB DEMANDA os textos da proposta no blob siconv_justificativas_proposta.
   Fora do pipeline: só é chamada quando o cliente pede ids específicos.
   Reaproveita a máquina já existente — listagem, cache-buster e o cache de
   download por geração do blob (nome:bytes:lastModified em `.stamp`), de modo
   que uma segunda consulta com o blob inalterado não baixa os ~750 MB de novo.
   Lê o CSV com scanZipCsv (varredura em bloco) e devolve só as propostas pedidas:
     { textos: { '<id>': { caracterizacao, publicoAlvo, problema, resultados,
                           relacao, capacidade, justificativa } },
       faltando: ['<id>', ...], stats: { durationMs, rows, found, entry } }
   `faltando` são os ids sem linha no arquivo (não é erro); campo vazio vira ''.
   `onProgress(mensagem)` é chamado nas etapas (listagem, download, leitura).
   `options` existe para injeção em teste/diagnóstico (agentModule, dir,
   containerUrl, cacheBuster, timeoutMs) — a interface pública é (ids, onProgress). */
async function fetchProposalTexts(ids, onProgress = () => {}, options = {}) {
  const started = Date.now();
  const wanted = assertProposalIds(ids);
  const progress = typeof onProgress === 'function' ? onProgress : () => {};
  const dir = options.dir || defaultDownloadDir();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cacheBuster = options.cacheBuster ?? Date.now();
  const runOptions = { ...options, cacheBuster };

  progress('Consultando a lista de arquivos da origem…');
  const listed = await listBlobs(runOptions);
  const blob = listed.find(item => item.name === BLOBS.textos);
  if (!blob) throw new SyncError(`A origem não anuncia ${BLOBS.textos} na listagem. Textos indisponíveis no momento.`, 502, 'missing');

  progress(`Baixando ${BLOBS.textos}…`);
  const file = await downloadBlob(blob, {
    ...runOptions,
    dir,
    timeoutMs,
    onProgress: message => progress(String(message).trim())
  });
  if (file.cached) progress(`Usando a cópia já baixada de ${BLOBS.textos} (mesma geração).`);

  progress('Lendo os textos das propostas…');
  const wantedSet = new Set(wanted);
  const textos = {};
  const collect = row => {
    const id = text(row.ID_PROPOSTA);
    if (!wantedSet.has(id)) return;
    const value = {};
    for (const [key, column] of Object.entries(TEXT_FIELDS)) value[key] = text(row[column]);
    textos[id] = value;
  };
  const stats = await scanZipCsv(file.path, COLUMNS[BLOBS.textos], collect, { sourceName: BLOBS.textos });

  const faltando = wanted.filter(id => !Object.hasOwn(textos, id));
  return {
    textos,
    faltando,
    stats: {
      durationMs: Date.now() - started,
      rows: stats.rows,
      found: Object.keys(textos).length,
      entry: stats.entry
    }
  };
}

function resetCache() {
  inFlight.clear();
  try { fs.unlinkSync(CACHE_FILE); } catch { /* já ausente */ }
}

module.exports = {
  SyncError,
  HOST,
  BASE_URL,
  CONTAINER_URL,
  CACHE_DIR,
  BLOBS,
  BLOB_ORDER,
  COLUMNS,
  TEXT_FIELDS,
  MAX_TEXT_IDS,
  DEFAULT_TIMEOUT_MS,
  assertAllowedUrl,
  withCacheBuster,
  assertDownloadMatches,
  MAX_DOWNLOAD_ATTEMPTS,
  enumerateBlobs,
  listBlobs,
  csvParser,
  csvBlockParser,
  splitCsvLine,
  headerMapper,
  entriesOf,
  pickCsvEntry,
  scanZipCsv,
  moneyBR,
  quantityBR,
  dateISO,
  text,
  raw,
  signatureOf,
  cachedUsable,
  readCache,
  writeCache,
  ensureCacheDir,
  resetCache,
  downloadBlob,
  runSync,
  sync,
  syncStatus,
  syncList,
  assertProposalIds,
  fetchProposalTexts,
  readText,
  openStream
};
