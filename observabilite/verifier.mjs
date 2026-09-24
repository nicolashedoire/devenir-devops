import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';
const directory = process.argv[2];
if (!directory) throw Error('Répertoire de preuve requis.');
const expected = JSON.parse(await readFile('observabilite/imports/tache-temoin.json', 'utf8'));
const record = { date: new Date().toISOString(), projet: 'taskboard-observabilite',
  temoin_id: expected.id, scenarios: {}, controles: {} };
const save = (name, value) => writeFile(join(directory, name), JSON.stringify(value, null, 2) + '\n', {mode:0o600});
async function get(url, options = {}) {
  const response = await fetch(url, {signal:AbortSignal.timeout(5000), ...options});
  if (!response.ok) throw Error('Réponse inattendue ' + response.status + ' pour ' + new URL(url).pathname);
  return response;
}
async function waitFor(label, test, timeout = 120000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try { const result = await test(); if (result) return result; }
    catch (error) { lastError = error; }
    await delay(1500);
  }
  throw Error(label + ' : délai dépassé' + (lastError ? ' (' + lastError.message + ')' : ''));
}
const endpoints = [
  ['API normale', 'http://127.0.0.1:3010/readyz'],
  ['API lente', 'http://127.0.0.1:3011/readyz'],
  ['API en erreur', 'http://127.0.0.1:3012/readyz'],
  ['Collector', 'http://127.0.0.1:13133/'],
  ['Prometheus', 'http://127.0.0.1:9090/-/ready'],
  ['Loki', 'http://127.0.0.1:3100/ready'],
  ['Tempo', 'http://127.0.0.1:3200/ready'],
  ['Grafana', 'http://127.0.0.1:3300/api/health'],
];
try {
  await Promise.all(endpoints.map(([label, url]) => waitFor(label, () => get(url))));
  const dashboard = await (await get('http://127.0.0.1:3300/api/dashboards/uid/taskboard-observabilite')).json();
  assert.equal(dashboard.dashboard.uid, 'taskboard-observabilite');
  await save('tableau-de-bord.json', {uid:dashboard.dashboard.uid,title:dashboard.dashboard.title,
    nombre_panneaux:dashboard.dashboard.panels.length});
  const sources = await (await get('http://127.0.0.1:3300/api/datasources')).json();
  assert.deepEqual(sources.map(s=>s.uid).sort(), ['loki','prometheus','tempo']);
  const derived = sources.find(s=>s.uid==='loki').jsonData.derivedFields[0];
  assert.equal(derived.datasourceUid, 'tempo');
  assert.equal(derived.url, '$' + '{__value.raw}');
  record.controles.grafana_provisionne = true;
  const start = Date.now();
  async function request(scenario, port, status) {
    const begin = performance.now();
    const response = await fetch('http://127.0.0.1:' + port + '/api/tasks/' + expected.id,
      {signal:AbortSignal.timeout(6000)});
    const elapsed = performance.now() - begin;
    assert.equal(response.status, status, 'Statut du scénario ' + scenario);
    const traceId = response.headers.get('x-trace-id');
    assert.match(traceId, /^[a-f0-9]{32}$/);
    const requestId = response.headers.get('x-request-id');
    assert.ok(requestId);
    const body = await response.json();
    if (status === 200) assert.deepEqual(body, expected, 'Témoin exact du scénario ' + scenario);
    if (scenario === 'lent') assert.ok(elapsed >= 1400, 'La panne lente doit être mesurée.');
    if (!record.scenarios[scenario]) record.scenarios[scenario] = {
      status, duration_ms: Math.round(elapsed), trace_id:traceId, request_id:requestId,
      ...(status === 200 ? {temoin_identique:true} : {}) };
  }
  while (Date.now() - start < 80000) {
    await Promise.all([request('normal',3010,200),request('lent',3011,200),request('erreur',3012,503)]);
    await delay(400);
  }
  async function prom(query) {
    const result = await (await get('http://127.0.0.1:9090/api/v1/query?query=' + encodeURIComponent(query))).json();
    assert.equal(result.status, 'success');
    return result.data.result;
  }
  const targets = await prom('up{job="taskboard"}');
  assert.equal(targets.length, 3);
  assert.ok(targets.every(item => item.value[1] === '1'));
  const p95 = await prom('histogram_quantile(0.95, sum by (scenario, le) (rate(taskboard_http_request_duration_seconds_bucket{route=~"/api/tasks.*"}[1m])))');
  assert.ok(Number(p95.find(item=>item.metric.scenario==='lent')?.value[1]) > 1);
  const errors = await prom('sum by (scenario) (rate(taskboard_http_requests_total{route=~"/api/tasks.*",status=~"5.."}[1m])) / clamp_min(sum by (scenario) (rate(taskboard_http_requests_total{route=~"/api/tasks.*"}[1m])), 0.001)');
  assert.ok(Number(errors.find(item=>item.metric.scenario==='erreur')?.value[1]) > 0.95);
  await save('metriques.json', {targets,p95,errors});
  const alerts = await waitFor('Alertes pédagogiques', async () => {
    const result = await (await get('http://127.0.0.1:9090/api/v1/alerts')).json();
    const active = result.data.alerts.filter(a=>a.state==='firing');
    return active.some(a=>a.labels.alertname==='TaskboardErreursHTTP' && a.labels.scenario==='erreur')
      && active.some(a=>a.labels.alertname==='TaskboardLatenceHTTP' && a.labels.scenario==='lent')
      ? result : null;
  }, 30000);
  await save('alertes.json', alerts);
  record.controles.metriques_et_alertes = true;
  function spans(value) {
    if (!value || typeof value !== 'object') return [];
    if (Array.isArray(value)) return value.flatMap(spans);
    return Object.entries(value).flatMap(([key,item])=> key==='spans' && Array.isArray(item) ? item : spans(item));
  }
  const asHex = value => /^[a-f0-9]+$/i.test(value || '') ? value.toLowerCase()
    : Buffer.from(value || '', 'base64').toString('hex');
  for (const [scenario, evidence] of Object.entries(record.scenarios)) {
    const traceData = await waitFor('Trace ' + scenario, async () => {
      const response = await fetch('http://127.0.0.1:3200/api/traces/' + evidence.trace_id,
        {headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000)});
      if (response.status===404) return null;
      assert.equal(response.status,200);
      return response.json();
    });
    const allSpans = spans(traceData);
    const httpSpan = allSpans.find(span=>span.name==='GET /api/tasks/:id');
    assert.ok(httpSpan, 'Span HTTP manquant pour ' + scenario);
    const sqlSpan = allSpans.find(span=>span.name==='SELECT tasks');
    if (scenario !== 'erreur') {
      assert.ok(sqlSpan, 'Span SQL manquant pour ' + scenario);
      assert.equal(asHex(sqlSpan.parentSpanId), asHex(httpSpan.spanId), 'Parentage HTTP → SQL');
    } else assert.equal(sqlSpan, undefined, 'La panne 503 est provoquée avant PostgreSQL.');
    const traceText = JSON.stringify(traceData);
    assert.ok(!traceText.includes('lab-observation-public') && !traceText.includes(expected.title),
      'Une trace ne doit contenir ni mot de passe ni titre de tâche.');
    await save('trace-' + scenario + '.json', traceData);
    const query = '{service_name="taskboard"} |= "' + evidence.trace_id + '"';
    const found = await waitFor('Journal corrélé ' + scenario, async () => {
      const url = new URL('http://127.0.0.1:3100/loki/api/v1/query_range');
      url.searchParams.set('query',query);
      url.searchParams.set('start', String(BigInt(start-60000)*1000000n));
      url.searchParams.set('end',String(BigInt(Date.now())*1000000n));
      url.searchParams.set('limit','100');
      const result = await (await get(url)).json();
      const rows = result.data.result.flatMap(stream=>stream.values.map(value=>JSON.parse(value[1])));
      return rows.find(row=>row.trace_id===evidence.trace_id && row.request_id===evidence.request_id) || null;
    });
    assert.equal(found.status, evidence.status);
    assert.equal(asHex(httpSpan.spanId), found.span_id);
    await save('journal-' + scenario + '.json', found);
    evidence.correlation_verifiee = true;
    evidence.span_sql = Boolean(sqlSpan);
  }
  record.controles.traces_logs_parentage = true;
  record.statut = 'valide';
  await save('resultat.json',record);
  console.log('Validé : témoin conservé, trois scénarios, histogrammes, deux alertes firing, logs et traces corrélés, parentage HTTP → SQL.');
} catch(error) {
  record.statut='echec';
  record.erreur=error.message;
  await save('resultat.json',record);
  throw error;
}
