import https from 'node:https';
import { readFile } from 'node:fs/promises';
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Passerelle de laboratoire : tout chemin nécessite le même droit de lecture/écriture.
// Ce jeton représente un groupe de confiance, pas des comptes individuels ni OIDC.
export function authorized(received, expected) {
  if (typeof received !== 'string' || !/^Bearer [a-f0-9]{64}$/.test(received)) return false;
  return timingSafeEqual(createHash('sha256').update(received.slice(7)).digest(),
    createHash('sha256').update(expected).digest());
}

export function createGateway({ key, cert, readToken, upstream, logger = console.log, fetcher = fetch }) {
  const base = new URL(upstream);
  if (base.protocol !== 'http:' || base.hostname !== 'api' || base.port !== '3000') {
    throw Error('La cible interne doit être http://api:3000.');
  }
  const server = https.createServer({ key, cert, minVersion: 'TLSv1.2' }, async (req, res) => {
    const finish = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(body));
    };
    const path = req.url || '/';
    const allowed = /^\/(?:api\/tasks(?:\/[1-9]\d{0,9})?|healthz|readyz|version|metrics)?$/.test(path);
    res.on('finish', () => logger(JSON.stringify({ time: new Date().toISOString(),
      event: 'gateway_request', method: ['GET', 'POST'].includes(req.method) ? req.method : 'OTHER',
      route: allowed ? path.replace(/\/\d+$/, '/:id') : 'unmatched', status: res.statusCode })));
    try {
      const token = (await readToken()).trim();
      if (!/^[a-f0-9]{64}$/.test(token)) return finish(503, { error: 'access_configuration_unavailable' });
      if (!authorized(req.headers.authorization, token)) {
        res.setHeader('WWW-Authenticate', 'Bearer realm="taskboard-lab"');
        return finish(401, { error: 'authentication_required' });
      }
      if (!allowed) return finish(404, { error: 'not_found' });
      if (!['GET', 'POST'].includes(req.method)) return finish(405, { error: 'method_not_allowed' });
      if (req.method === 'POST' && path !== '/api/tasks') return finish(405, { error: 'method_not_allowed' });
      const chunks = []; let bytes = 0;
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        bytes += chunk.length;
        if (bytes > 8192) {
          res.setHeader('Connection', 'close'); req.resume();
          return finish(413, { error: 'body_too_large' });
        }
        chunks.push(chunk);
      }
      const response = await fetcher(new URL(path, base), {
        method: req.method, redirect: 'error', signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': req.headers['content-type'] || 'application/json' },
        ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {})
      });
      const payload = Buffer.from(await response.arrayBuffer());
      if (payload.length > 1048576) throw Error('Réponse interne trop grande.');
      res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(payload);
    } catch {
      if (!res.headersSent) finish(502, { error: 'upstream_unavailable' });
      else res.destroy();
    }
  });
  server.headersTimeout = 5000;
  server.requestTimeout = 10000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const key = await readFile('/run/taskboard/server.key');
  const cert = await readFile('/run/taskboard/server.crt');
  const server = createGateway({ key, cert,
    readToken: () => readFile('/run/taskboard/token.txt', 'utf8'),
    upstream: 'http://api:3000' });
  server.listen(3443, '0.0.0.0', () => console.log('Passerelle HTTPS locale prête sur 3443.'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
