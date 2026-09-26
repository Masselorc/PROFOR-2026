// Servidor local: arquivos da aplicação e rotas de sincronização do Transferegov.
// Somente loopback. A sincronização roda no servidor porque o endpoint público
// https://api-publica.transferegov.gestao.gov.br/downloads não envia CORS.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const sync = require('./transferegov-sync.cjs');
const store = require('./workspace-store.cjs').createStore(path.join(__dirname,'dados','registros'));

const PORT = 8766;
const HOSTS = new Set(['127.0.0.1:8766', 'localhost:8766', '[::1]:8766']);
const allowed = new Set(['PROFOR_2026.html', 'styles.css', 'domain.js', 'bandeiras-uf.js', 'storage.js', 'transferegov.js', 'report.js', 'app.js']);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const progressRuns = new Map();
function clearOldProgress() {
  const now = Date.now();
  for (const [id, run] of progressRuns) if (now - run.updated > 20 * 60 * 1000) progressRuns.delete(id);
}
function progressEvent(run, event) {
  run.updated = Date.now();
  if (event.kind === 'stage') {
    run.message = event.message;
    run.step = event.step;
    run.steps = event.steps;
    run.loaded = event.loaded;
    run.total = event.total;
  } else if (event.kind === 'progress') {
    run.loaded = event.loaded;
    run.total = event.total;
  }
  if (run.step > 0 && run.steps > 0) {
    const fraction = Number.isFinite(run.loaded) && Number.isFinite(run.total) && run.total > 0
      ? Math.min(1, Math.max(0, run.loaded / run.total)) : 0;
    run.percent = Math.min(99, Math.floor(100 * ((run.step - 1) + fraction) / run.steps));
  }
  if (event.kind === 'stage' || event.kind === 'action') {
    run.actions.push({ seq: ++run.sequence, at: new Date().toISOString(), message: event.message });
  }
}

/* Sem cabeçalho CORS: a aplicação é same-origin. Com ACAO `*`, qualquer aba
   aberta pelo usuário poderia ler /api/sync/status e disparar /api/sync (que
   baixa ~500 MB e descompacta ~2,4 GB). O Host do alvo não protege esse vetor. */
function sendJSON(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(payload);
}

/* Defesa em profundidade contra disparo de /api/sync a partir de outra aba:
   requisição de navegador traz Origin; exigimos que seja a própria aplicação.
   Clientes locais sem Origin (curl, testes) continuam atendidos. */
function originAllowed(req) {
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  return ['http://127.0.0.1:8766', 'http://localhost:8766', 'http://[::1]:8766', 'null'].includes(origin);
}

/* Falha sempre como {error} em português, sem stack. */
function sendError(res, err) {
  const status = err && Number.isInteger(err.status) ? err.status : 500;
  if (status >= 500) console.error('Sincronização: falha —', err && err.message);
  sendJSON(res, status, { error: err && err.message ? err.message : 'Falha inesperada na sincronização.' });
}

async function handleApi(req, res, url) {
  const route = url.pathname;
  if(route==='/api/state') {
    if(req.method==='GET'){sendJSON(res,200,store.load());return true;}
    if(req.method!=='POST'){sendJSON(res,405,{error:'Método não permitido.'});return true;}
    if(req.headers['content-type']!=='application/json' || req.headers.origin==='null'){
      sendJSON(res,403,{error:'Gravação permitida somente pelo sistema local.'});return true;
    }
    let size=0;const chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>50*1024*1024)throw Object.assign(new Error('Banco acima do limite de 50 MB.'),{status:413});chunks.push(chunk);}
    let body;
    try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('JSON inválido.'),{status:400});}
    sendJSON(res,200,store.save(body));return true;
  }
  if(route==='/api/sync/history') {
    if(req.method!=='GET'){sendJSON(res,405,{error:'Método não permitido.'});return true;}
    sendJSON(res,200,{entries:store.history()});return true;
  }
  if (route === '/api/sync/list') {
    sendJSON(res, 200, await sync.syncList());
    return true;
  }
  if (route === '/api/sync/status') {
    sendJSON(res, 200, await sync.syncStatus());
    return true;
  }
  if (route === '/api/sync/progress') {
    const id = url.searchParams.get('run') || '';
    const run = progressRuns.get(id);
    if (!run) { sendJSON(res, 404, { error: 'Execução de sincronização não encontrada.' }); return true; }
    sendJSON(res, 200, run);
    return true;
  }
  if (route === '/api/sync/textos') {
    /* Busca SOB DEMANDA dos textos da proposta (caracterização, público-alvo,
       problema, resultados, relação com objetivos, capacidade técnica e
       justificativa). Fora do pipeline: o blob de ~750 MB só é baixado quando
       esta rota é chamada, e o cache por geração do blob evita baixá-lo de novo
       enquanto a origem não publicar arquivo novo. */
    const raw = url.searchParams.get('ids');
    /* Item vazio NÃO é descartado em silêncio: `ids=1,,2` é lista malformada e
       tem de virar 400, não uma consulta com menos propostas que o pedido. */
    const ids = (raw === null ? '' : raw).split(',').map(item => item.trim());
    if (!ids.length || ids.length > sync.MAX_TEXT_IDS || ids.some(id => !/^\d+$/.test(id)) || new Set(ids).size !== ids.length) {
      sendJSON(res, 400, { error: `Parâmetro ids inválido. Informe de 1 a ${sync.MAX_TEXT_IDS} identificadores de proposta (somente dígitos), separados por vírgula e sem repetição.` });
      return true;
    }
    const result = await sync.fetchProposalTexts(ids, message => console.log(`Textos: ${message}`));
    console.log(`Textos de proposta: ${result.stats.found} de ${ids.length} proposta(s) localizada(s), ${(result.stats.durationMs / 1000).toFixed(1)}s.`);
    sendJSON(res, 200, result);
    return true;
  }
  if (route === '/api/sync') {
    const pad = url.searchParams.get('pad') !== '0';
    const force = url.searchParams.get('force') === '1';
    const dataSteps = pad ? 10 : 8;
    const totalSteps = dataSteps + 4; // lista de textos, download, leitura e gravação local
    const id = url.searchParams.get('run');
    let run = null;
    if (id !== null) {
      if (!/^[a-zA-Z0-9-]{16,64}$/.test(id)) { sendJSON(res, 400, { error: 'Identificador da execução inválido.' }); return true; }
      clearOldProgress();
      if (progressRuns.has(id)) { sendJSON(res, 409, { error: 'Identificador da execução já utilizado.' }); return true; }
      run = { status: 'running', message: 'Iniciando sincronização…', step: 0, steps: totalSteps, percent: 0, loaded: null, total: null, actions: [], sequence: 0, updated: Date.now() };
      progressRuns.set(id, run);
    }
    let response;
    try {
      const onEvent = run ? event => progressEvent(run, event) : undefined;
      response = await sync.sync({ pad, force, totalSteps, onEvent });
      const ids = response.proposals.map(proposal => proposal.id);
      const texts = await sync.fetchProposalTexts(ids, () => {}, {
        maxIds: ids.length, progressBase: dataSteps, totalSteps, onEvent
      });
      response = { ...response, textos: texts.textos, textosFaltando: texts.faltando, textosStats: texts.stats };
      if (run) {
        progressEvent(run, { kind: 'stage', message: 'Dados e textos recebidos. Aguardando gravação no banco local…', step: totalSteps, steps: totalSteps, loaded: null, total: null });
        run.status = 'ready';
      }
    } catch (err) {
      if (run) { run.status = 'error'; run.message = err.message; run.updated = Date.now(); }
      throw err;
    }
    /* A resposta em cache também carrega o payload; `unchanged` é só metadado. */
    const prefix = response.unchanged ? 'Sincronização (cache): origem sem alteração' : 'Sincronização:';
    console.log(`${prefix} — ${response.stats.proposals} proposta(s) entregues, ${response.stats.padItems} item(ns) de PAD, ${response.textosStats.found} com textos oficiais; propostas: ${(response.stats.durationMs / 1000).toFixed(1)}s, textos: ${(response.textosStats.durationMs / 1000).toFixed(1)}s.`);
    sendJSON(res, 200, response);
    return true;
  }
  if (route.startsWith('/api/')) {
    sendJSON(res, 404, { error: 'Rota de API desconhecida.' });
    return true;
  }
  return false;
}

const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD', 'POST'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  if (!HOSTS.has(req.headers.host)) { res.writeHead(403); res.end(); return; }
  let url;
  try { url = new URL(req.url, 'http://127.0.0.1:8766'); } catch { res.writeHead(400); res.end(); return; }
  if(req.method==='POST' && url.pathname!=='/api/state'){res.writeHead(405);res.end();return;}
  if (url.pathname === '/api') { sendJSON(res, 404, { error: 'Rota de API desconhecida.' }); return; }

  if (url.pathname.startsWith('/api/')) {
    if (!originAllowed(req)) { sendJSON(res, 403, { error: 'Origem não autorizada para as rotas de API.' }); return; }
    handleApi(req, res, url).catch(err => {
      if (res.headersSent) { res.end(); return; }
      sendError(res, err);
    });
    return;
  }

  let name;
  try { name = decodeURIComponent(url.pathname).slice(1) || 'PROFOR_2026.html'; } catch { res.writeHead(400); res.end(); return; }
  if (!allowed.has(name)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {
    'Content-Type': mime[path.extname(name)],
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': CSP
  });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(path.join(__dirname, name)).pipe(res);
});

server.on('error', err => { console.error('Não foi possível iniciar o servidor:', err.message); process.exitCode = 1; });
server.listen(PORT, '127.0.0.1', () => console.log('PROFOR: http://127.0.0.1:8766/PROFOR_2026.html — Ctrl+C para encerrar.'));
