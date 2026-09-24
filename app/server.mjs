import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const packageInfo = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const BODY_LIMIT = 8192;
const MEMORY_LIMIT = 1000;

export async function createApp(env = process.env, logger = console.log, dependencies = {}) {
  const fault = env.FAULT_MODE || 'off';
  if (!['off', 'error', 'slow'].includes(fault)) throw Error('FAULT_MODE invalide');
  if (fault !== 'off' && env.LAB_MODE !== 'true') {
    throw Error('La simulation de panne exige LAB_MODE=true');
  }
  const version = Object.freeze({ version: env.APP_VERSION || packageInfo.version,
    revision: env.APP_REVISION || 'local' });
  // Ces deux champs sont publics : ne jamais y placer de secret.
  for (const value of Object.values(version)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(value)) {
      throw Error('APP_VERSION ou APP_REVISION invalide : 1 à 64 caractères alphanumériques, . _ + -');
    }
  }
  const log = entry => logger(JSON.stringify({ ...entry,
    app_version: version.version, app_revision: version.revision }));
  const page = await readFile(new URL('./index.html', import.meta.url));
  let pool;
  if (env.DATABASE_URL) {
    const { default: pg } = await import('pg');
    const options = { connectionString: env.DATABASE_URL, max: 5,
      connectionTimeoutMillis: 2000, query_timeout: 2500,
      statement_timeout: 2000 };
    pool = dependencies.createPool ? dependencies.createPool(options) : new pg.Pool(options);
    pool.on('error', () => log({ event: 'db_pool_error' }));
    // Le schéma est créé exclusivement par npm run migrate.
  }
  const tasks = [];
  const metrics = new Map();
  const bounds = [0.01, 0.05, 0.1, 0.3, 1, 2.5, 5];
  function observe(method, route, status, elapsed) {
    const key = `method="${method}",route="${route}",status="${status}"`;
    const entry = metrics.get(key) || { count: 0, sum: 0, buckets: bounds.map(() => 0) };
    entry.count++; entry.sum += elapsed;
    bounds.forEach((v, i) => { if (elapsed <= v) entry.buckets[i]++; });
    metrics.set(key, entry);
  }
  function exposition() {
    let data = '# HELP taskboard_http_requests_total Completed HTTP requests\n';
    data += '# TYPE taskboard_http_requests_total counter\n';
    data += '# HELP taskboard_http_request_duration_seconds HTTP duration\n';
    data += '# TYPE taskboard_http_request_duration_seconds histogram\n';
    for (const [key, item] of metrics) {
      data += `taskboard_http_requests_total{${key}} ${item.count}\n`;
      bounds.forEach((b, i) => {
        data += `taskboard_http_request_duration_seconds_bucket{${key},le="${b}"} ${item.buckets[i]}\n`;
      });
      data += `taskboard_http_request_duration_seconds_bucket{${key},le="+Inf"} ${item.count}\n`;
      data += `taskboard_http_request_duration_seconds_sum{${key}} ${item.sum}\n`;
      data += `taskboard_http_request_duration_seconds_count{${key}} ${item.count}\n`;
    }
    return data;
  }
  const server = http.createServer(async (req, res) => {
    const begin = performance.now();
    const path = (req.url || '/').split('?')[0];
    const taskMatch = /^\/api\/tasks\/([1-9]\d{0,9})$/.exec(path);
    const taskId = taskMatch && Number(taskMatch[1]) <= 2147483647 ? Number(taskMatch[1]) : null;
    const route = ['/', '/healthz', '/readyz', '/version', '/metrics', '/api/tasks'].includes(path)
      ? path : taskId ? '/api/tasks/:id' : 'unmatched';
    const method = ['GET', 'POST', 'HEAD', 'OPTIONS'].includes(req.method)
      ? req.method : 'OTHER';
    const requestId = randomUUID();
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () => {
      const seconds = (performance.now() - begin) / 1000;
      observe(method, route, res.statusCode, seconds);
      log({ time: new Date().toISOString(), request_id: requestId,
        method, route, status: res.statusCode, duration_ms: Math.round(seconds * 1000) });
    });
    const json = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(value));
    };
    try {
      if (req.method === 'GET' && route === '/healthz') return json(200, { status: 'alive' });
      if (req.method === 'GET' && route === '/version') return json(200, version);
      if (req.method === 'GET' && route === '/readyz') {
        // Vérifier aussi le schéma : une base joignable mais non migrée n'est pas prête.
        if (pool) await pool.query('SELECT id, title, created_at FROM tasks LIMIT 0');
        return json(200, { status: 'ready', storage: pool ? 'postgres' : 'memory' });
      }
      if (req.method === 'GET' && route === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(page);
      }
      if (req.method === 'GET' && route === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
        return res.end(exposition());
      }
      if (route === '/api/tasks' || route === '/api/tasks/:id') {
        const allowed = route === '/api/tasks' ? ['GET', 'POST'] : ['GET'];
        if (!allowed.includes(req.method)) {
          res.setHeader('Allow', allowed.join(', '));
          return json(405, { error: 'method not allowed' });
        }
        if (fault === 'error') return json(503, { error: 'lab_fault' });
        if (fault === 'slow') await new Promise(resolve => setTimeout(resolve, 1500));
        if (route === '/api/tasks/:id') {
          const task = pool ? (await pool.query(
            'SELECT id, title, created_at FROM tasks WHERE id = $1', [taskId])).rows[0]
            : tasks.find(item => item.id === taskId);
          return task ? json(200, task) : json(404, { error: 'not found' });
        }
        if (req.method === 'GET') {
          const rows = pool ? (await pool.query(
            'SELECT id, title, created_at FROM tasks ORDER BY id LIMIT 1000')).rows : tasks;
          return json(200, rows);
        }
        if (req.method === 'POST') {
          if ((req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
            return json(415, { error: 'application/json required' });
          }
          const chunks = []; let bytes = 0;
          // Conserver la socket assez longtemps pour envoyer le statut 413.
          for await (const chunk of req.iterator({ destroyOnReturn: false })) {
            bytes += chunk.length;
            if (bytes > BODY_LIMIT) {
              res.setHeader('Connection', 'close');
              req.resume();
              return json(413, { error: 'body too large' });
            }
            chunks.push(chunk);
          }
          let data;
          try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
          catch { return json(400, { error: 'invalid JSON' }); }
          const title = typeof data?.title === 'string' ? data.title.trim() : '';
          // PostgreSQL refuse NUL ; les deux modes acceptent le même texte Unicode.
          if (!title || !title.isWellFormed() || title.includes('\0') || [...title].length > 200) {
            return json(400, { error: 'invalid title' });
          }
          if (!pool && tasks.length >= MEMORY_LIMIT) return json(409, { error: 'lab memory limit' });
          const task = pool ? (await pool.query(
            'INSERT INTO tasks(title) VALUES($1) RETURNING id, title, created_at', [title])).rows[0]
            : { id: tasks.length + 1, title, created_at: new Date().toISOString() };
          if (!pool) tasks.push(task);
          return json(201, task);
        }
      }
      return json(404, { error: 'not found' });
    } catch {
      log({ event: 'request_failed', request_id: requestId, route });
      if (!res.headersSent) json(503, { error: 'dependency unavailable' });
      else res.end();
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 5000;
  const stop = async () => {
    await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
  };
  return { server, stop, version };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
  const { server, stop, version } = await createApp();
  server.on('error', () => {
    console.error(JSON.stringify({ event: 'startup_failed', message: 'Démarrage HTTP impossible.' }));
    process.exitCode = 1;
    void stop();
  });
  server.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0', () => {
    console.log(JSON.stringify({ event: 'listening', port: server.address().port,
      storage: process.env.DATABASE_URL ? 'postgres' : 'memory',
      app_version: version.version, app_revision: version.revision }));
  });
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    const timer = setTimeout(() => process.exit(1), 10000).unref();
    await stop(); clearTimeout(timer);
  };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
  } catch {
    console.error(JSON.stringify({ event: 'startup_failed', message: 'Configuration ou démarrage impossible.' }));
    process.exitCode = 1;
  }
}
