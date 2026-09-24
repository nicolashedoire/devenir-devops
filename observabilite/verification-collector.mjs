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
    'observabilite/compose.yaml', ...args], {timeout:180000, maxBuffer:1024*1024})).stdout;
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
async function prom(query, time) {
  const url = new URL('http://127.0.0.1:9090/api/v1/query');
  url.searchParams.set('query', query);
  if (time !== undefined) url.searchParams.set('time', String(time));
  const json = await (await get(url)).json();
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
async function volumeIdentities() {
  const config = JSON.parse(await dc('config', '--format', 'json'));
  const names = Object.values(config.volumes).map(item => item.name).sort();
  assert.equal(names.length, 5, 'Les cinq volumes du laboratoire sont attendus.');
  const values = JSON.parse((await exec(docker, ['volume', 'inspect', ...names],
    {timeout:15000, maxBuffer:1024*1024})).stdout);
  for (const value of values) {
    assert.equal(value.Labels['com.docker.compose.project'], 'taskboard-observabilite');
  }
  return values.map(value => ({nom:value.Name, cree_a:value.CreatedAt, pilote:value.Driver}))
    .sort((a,b) => a.nom.localeCompare(b.nom));
}
async function wholeStackRestart() {
  // Une requête datée avant le retrait doit rester consultable après recréation.
  const historicalTime = Date.now() / 1000;
  const historical = await prom(countQuery, historicalTime);
  assert.equal(historical.length, 1);
  assert.ok(Number.isFinite(Number(historical[0].value[1])));
  const beforeVolumes = await volumeIdentities();
  const oldEvidence = record.apres;
  record.reprise_pile = {statut:'en_cours', mesure_a:historicalTime,
    metrique_avant:historical[0].value, volumes_avant:beforeVolumes};
  let downError;
  try {
    console.log('Pause du seul projet d’observation, sans supprimer ses volumes.');
    await dc('down');
    assert.equal((await dc('ps', '-a', '-q')).trim(), '', 'Tous les conteneurs du projet doivent être retirés.');
    assert.deepEqual(await volumeIdentities(), beforeVolumes, 'Les volumes doivent subsister après down.');
    record.reprise_pile.conteneurs_retires = true;
  } catch (error) { downError = error; }
  finally {
    // Même si un contrôle échoue, tenter de reprendre ce seul laboratoire.
    await dc('up', '-d', '--no-build');
    const endpoints = [
      'http://127.0.0.1:3010/readyz', 'http://127.0.0.1:3011/readyz',
      'http://127.0.0.1:3012/readyz', 'http://127.0.0.1:13133/',
      'http://127.0.0.1:9090/-/ready', 'http://127.0.0.1:3100/ready',
      'http://127.0.0.1:3200/ready', 'http://127.0.0.1:3300/api/health',
    ];
    await Promise.all(endpoints.map(url => waitFor('Reprise de la pile',
      () => get(url), 120000, true)));
    record.reprise_pile.services_repris = true;
  }
  if (downError) throw downError;
  assert.deepEqual(await volumeIdentities(), beforeVolumes, 'Les mêmes volumes doivent être réutilisés.');
  const after = await prom(countQuery, historicalTime);
  assert.deepEqual(after, historical, 'La mesure historique doit subsister après reprise.');
  const persisted = await correlated(oldEvidence);
  const current = await request();
  Object.assign(current, await correlated(current));
  Object.assign(record.reprise_pile, {statut:'valide', volumes_identiques:true,
    metrique_historique_identique:true, metrique_apres:after[0].value,
    trace_et_journal_anterieurs_conserves:persisted.trace_recue && persisted.journal_recu,
    temoin_identique:true, nouvelle_requete:current,
    limite:'Arrêt ordinaire et reprise sur le même hôte ; ne prouve pas une reprise après perte de disque.'});
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
    await wholeStackRestart();
    record.statut = 'valide';
    console.log('Validé : panne Collector, reprise complète, témoin et signaux antérieurs conservés.');
  }
} catch (error) { record.statut = 'echec'; record.erreur = error.message; }
await save();
if (record.statut !== 'valide') {
  console.error(record.erreur || record.erreur_reprise || 'Vérification Collector échouée.');
  process.exitCode = 1;
}
