// Enveloppe facultative : le serveur, ses métriques et ses migrations restent inchangés.
import { context, trace, propagation, SpanKind, SpanStatusCode, isSpanContextValid } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import pg from 'pg';
import { createApp } from '../app/server.mjs';

if (process.env.LAB_MODE !== 'true') throw Error('Cette enveloppe exige LAB_MODE=true.');
const scenario = process.env.OBS_SCENARIO || 'normal';
if (!['normal', 'lent', 'erreur'].includes(scenario)) throw Error('Scénario inconnu.');
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://collector:4318';
const sdk = new NodeSDK({
  resource: resourceFromAttributes({ 'service.name': 'taskboard',
    'service.version': '0.2.0', 'deployment.environment.name': 'laboratoire',
    'taskboard.scenario': scenario }),
  traceExporter: new OTLPTraceExporter({ url: endpoint + '/v1/traces' }),
  logRecordProcessors: [new BatchLogRecordProcessor(
    new OTLPLogExporter({ url: endpoint + '/v1/logs' }), { scheduledDelayMillis: 1000 })],
});
sdk.start();
const tracer = trace.getTracer('taskboard-observabilite', '0.1.0');
const logExporter = logs.getLogger('taskboard-observabilite', '0.1.0');

function logger(line) {
  const entry = JSON.parse(line);
  const spanContext = trace.getSpan(context.active())?.spanContext();
  const correlated = spanContext && isSpanContextValid(spanContext)
    ? { trace_id: spanContext.traceId, span_id: spanContext.spanId } : {};
  const body = JSON.stringify({ ...entry, scenario, ...correlated });
  console.log(body);
  // Les sondes et la collecte de métriques sont exclues des recherches métier.
  if (!spanContext || !isSpanContextValid(spanContext)) return;
  logExporter.emit({ body, context: context.active(),
    severityNumber: entry.status >= 500 || entry.event === 'request_failed'
      ? SeverityNumber.ERROR : SeverityNumber.INFO,
    severityText: entry.status >= 500 || entry.event === 'request_failed' ? 'ERROR' : 'INFO',
    attributes: { scenario, route: entry.route || 'unknown' } });
}
function createPool(options) {
  const pool = new pg.Pool(options);
  const query = pool.query.bind(pool);
  // L'API emploie des requêtes Promise. Aucune valeur SQL ni URL n'est enregistrée.
  pool.query = async (...args) => {
    if (!trace.getSpan(context.active())) return query(...args);
    const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text || '';
    const operation = /^\s*(SELECT|INSERT)\b/i.exec(sql)?.[1].toUpperCase() || 'OTHER';
    return tracer.startActiveSpan(operation + ' tasks', {
      kind: SpanKind.CLIENT,
      attributes: { 'db.system.name': 'postgresql', 'db.namespace': 'taskboard',
        'db.operation.name': operation, 'db.collection.name': 'tasks' },
    }, async span => {
      try { return await query(...args); }
      catch (error) { span.setStatus({ code: SpanStatusCode.ERROR, message: 'Requête PostgreSQL échouée' }); throw error; }
      finally { span.end(); }
    });
  };
  return pool;
}
const { server, stop, version } = await createApp(process.env, logger, { createPool });
const handler = server.listeners('request')[0];
server.removeListener('request', handler);
server.on('request', (req, res) => {
  const path = (req.url || '/').split('?')[0];
  if (['/metrics', '/healthz', '/readyz', '/version'].includes(path)) return handler(req, res);
  const route = path === '/api/tasks' ? path
    : /^\/api\/tasks\/[1-9]\d{0,9}$/.test(path) ? '/api/tasks/:id' : 'unmatched';
  const method = ['GET', 'POST', 'HEAD', 'OPTIONS'].includes(req.method) ? req.method : 'OTHER';
  const parent = propagation.extract(context.active(), req.headers);
  return context.with(parent, () => tracer.startActiveSpan(method + ' ' + route, {
    kind: SpanKind.SERVER, attributes: { 'http.request.method': method, 'http.route': route,
      'server.address': 'taskboard-laboratoire', 'taskboard.scenario': scenario },
  }, span => {
    const active = context.active();
    res.setHeader('X-Trace-ID', span.spanContext().traceId);
    let ended = false;
    const end = aborted => {
      if (ended) return;
      ended = true;
      span.setAttribute('http.response.status_code', res.statusCode);
      if (aborted || res.statusCode >= 500) span.setStatus({
        code: SpanStatusCode.ERROR, message: aborted ? 'Connexion interrompue' : 'Réponse HTTP en erreur' });
      span.end();
    };
    res.once('finish', () => context.with(active, () => end(false)));
    res.once('close', () => context.with(active, () => end(!res.writableFinished)));
    void Promise.resolve(handler(req, res)).catch(() => {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Traitement HTTP interrompu' });
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  }));
});
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0', () => {
  console.log(JSON.stringify({ event: 'listening', scenario, ...version,
    message: 'TaskBoard instrumenté, laboratoire isolé.' }));
});
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000).unref();
  await stop();
  await sdk.shutdown();
  clearTimeout(timeout);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
server.on('error', () => { console.error('Démarrage HTTP impossible.'); process.exitCode = 1; void shutdown(); });
