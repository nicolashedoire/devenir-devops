import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const exec = promisify(execFile);
const directory = process.argv[2];
if (!directory) throw Error('Répertoire de preuve requis.');
const expected = JSON.parse(await readFile('observabilite/imports/tache-temoin.json', 'utf8'));
const docker = process.env.DOCKER_BIN || 'docker';
const record = { date: new Date().toISOString(), projet: 'taskboard-observabilite',
  statut: 'en_cours', controles: {},
  limite: 'Panne courte du Collector local ; aucune garantie de conservation de toute la télémétrie.' };
let resumeNeeded = false;
let interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { interrupted = true; });
const save = () => writeFile(join(directory, 'resultat.json'), JSON.stringify(record, null, 2) + '\n', {mode:0o600});
async function dc(...args) {
  return (await exec(docker, ['compose', '-p', 'taskboard-observabilite', '-f',
    'observabilite/compose.yaml', ...args], {timeout:45000, maxBuffer:1024*1024})).stdout;
}
async function get(url) {
  const response = await fetch(url, {signal:AbortSignal.timeout(5000), headers:{Accept:'application/json'}});
  assert.ok(response.ok, 'Réponse inattendue : ' + new URL(url).pathname + ' (' + response.status + ')');
  return response;
}
async function waitFor(label, test, timeout = 60000, allowInterrupted = false) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    if (!allowInterrupted && interrupted) throw Error('Exercice interrompu ; reprise du Collector demandée.');
    try { const value = await test(); if (value) return value; } catch (error) { last = error; }
    await delay(1000);
  }
  throw Error(label + ' : délai dépassé' + (last ? ' (' + last.message + ')' : ''));
}
async function collector() {
  const id = (await dc('ps', '-a', '-q', 'collector')).trim();
  assert.ok(id && !id.includes('\n'), 'Un seul Collector du projet doit exister.');
  const data = JSON.parse((await exec(docker, ['inspect', id], {timeout:15000, maxBuffer:1024*1024})).stdout)[0];
  assert.equal(data.Config.Labels['com.docker.compose.project'], 'taskboard-observabilite');
  assert.equal(data.Config.Labels['com.docker.compose.service'], 'collector');
  return {id, running:data.State.Running};
}
async function request() {
  const response = await get('http://127.0.0.1:3010/api/tasks/' + expected.id);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected, 'Le témoin doit rester identique.');
  const traceId = response.headers.get('x-trace-id');
  assert.match(traceId, /^[a-f0-9]{32}$/);
  const requestId = response.headers.get('x-request-id');
  assert.ok(requestId);
  return {status:200, temoin_identique:true, trace_id:traceId, request_id:requestId};
}
async function prom(query) {
  const json = await (await get('http://127.0.0.1:9090/api/v1/query?query=' + encodeURIComponent(query))).json();
  assert.equal(json.status, 'success');
  return json.data.result;
}
const countQuery = 'sum(taskboard_http_requests_total{scenario="normal",route="/api/tasks/:id",status="200"})';
async function count() {
  const rows = await prom(countQuery);
  const value = Number(rows[0]?.value?.[1]);
  assert.ok(Number.isFinite(value), 'Compteur de lectures métier absent.');
  return value;
}
async function traceData(id) {
  const response = await fetch('http://127.0.0.1:3200/api/traces/' + id,
    {headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000)});
  if (response.status === 404) return null;
  assert.equal(response.status, 200, 'Tempo doit répondre 200 ou 404.');
  return response.json();
}
async function logData(evidence) {
  const url = new URL('http://127.0.0.1:3100/loki/api/v1/query_range');
  url.searchParams.set('query', '{service_name="taskboard"} |= "' + evidence.trace_id + '"');
  url.searchParams.set('start', String(BigInt(Date.parse(record.date) - 60000) * 1000000n));
  url.searchParams.set('end', String(BigInt(Date.now()) * 1000000n));
  url.searchParams.set('limit', '100');
  const result = await (await get(url)).json();
  const rows = result.data.result.flatMap(stream => stream.values.map(value => JSON.parse(value[1])));
  return rows.find(row => row.trace_id === evidence.trace_id && row.request_id === evidence.request_id) || null;
}
function spans(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(spans);
  return Object.entries(value).flatMap(([key,item]) => key === 'spans' && Array.isArray(item) ? item : spans(item));
}
const hex = value => /^[a-f0-9]+$/i.test(value || '') ? value.toLowerCase() : Buffer.from(value || '', 'base64').toString('hex');
async function correlated(evidence) {
  const trace = await waitFor('Trace exportée', () => traceData(evidence.trace_id));
  const all = spans(trace);
  const http = all.find(span => span.name === 'GET /api/tasks/:id');
  const sql = all.find(span => span.name === 'SELECT tasks');
  assert.ok(http && sql, 'Spans HTTP et SQL requis.');
  assert.equal(hex(sql.parentSpanId), hex(http.spanId), 'Parentage HTTP vers SQL requis.');
  const log = await waitFor('Journal exporté', () => logData(evidence));
  assert.equal(log.status, 200);
  assert.equal(log.span_id, hex(http.spanId));
  return {trace_recue:true, journal_recu:true, parentage_http_sql:true};
}
try {
  assert.equal((await collector()).running, true, 'Démarrer et valider la stack avant cette panne.');
  await get('http://127.0.0.1:13133/');
  record.avant = await request();
  Object.assign(record.avant, await correlated(record.avant));
  const initial = await waitFor('Compteur initial', async () => { const value = await count(); return value > 0 ? value : null; });
  resumeNeeded = true;
  await dc('stop', '-t', '5', 'collector');
  assert.equal((await collector()).running, false, 'Le Collector ciblé doit être arrêté.');
  let healthUnavailable = false;
  try { await get('http://127.0.0.1:13133/'); } catch { healthUnavailable = true; }
  assert.ok(healthUnavailable, 'La santé du Collector arrêté doit être indisponible.');
  record.pendant = await request();
  for (let i=0; i<4; i++) { await request(); await delay(500); }
  const increased = await waitFor('Scrape métier pendant la panne', async () => {
    const value = await count(); return value >= initial + 5 ? value : null;
  }, 30000);
  const targets = await prom('up{job="taskboard",scenario="normal"}');
  assert.equal(targets.length, 1); assert.equal(targets[0].value[1], '1');
  await delay(8000);
  assert.equal(await traceData(record.pendant.trace_id), null, 'Une nouvelle trace ne doit pas passer par le Collector arrêté.');
  assert.equal(await logData(record.pendant), null, 'Le journal OTLP neuf ne doit pas passer par le Collector arrêté.');
  record.controles = {collector_arrete_confirme:true, sante_collector_indisponible:true,
    temoin_200_pendant_panne:true, metriques_continuent:true, compteur_avant:initial,
    compteur_pendant:increased, cible_prometheus_up:true,
    trace_absente_pendant_panne:true, journal_absent_pendant_panne:true};
} catch (error) {
  record.statut = 'echec'; record.erreur = error.message;
} finally {
  if (resumeNeeded) {
    try {
      await dc('start', 'collector');
      await waitFor('Reprise Collector', () => get('http://127.0.0.1:13133/'), 60000, true);
      assert.equal((await collector()).running, true);
      record.collector_repris = true;
    } catch (error) { record.statut = 'echec'; record.erreur_reprise = error.message; }
  }
}
try {
  if (record.statut !== 'echec') {
    if (interrupted) throw Error('Exercice interrompu après reprise.');
    record.apres = await request();
    Object.assign(record.apres, await correlated(record.apres));
    record.statut = 'valide';
    console.log('Validé : lecture et métriques pendant l’arrêt, exports repris après redémarrage.');
  }
} catch (error) { record.statut = 'echec'; record.erreur = error.message; }
await save();
if (record.statut !== 'valide') {
  console.error(record.erreur || record.erreur_reprise || 'Vérification Collector échouée.');
  process.exitCode = 1;
}
