import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from './server.mjs';

async function start(env={}, logger=()=>{}, dependencies={}) {
  const app = await createApp(env, logger, dependencies);
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  return { ...app, url: `http://127.0.0.1:${app.server.address().port}` };
}
test('créer et relire une tâche, valider et mesurer les réponses HTTP', async t => {
  const a = await start(); t.after(a.stop);
  assert.equal((await fetch(a.url+'/healthz')).status, 200);
  assert.equal((await fetch(a.url+'/readyz')).status, 200);
  const post = body => fetch(a.url+'/api/tasks', {method:'POST',
    headers:{'Content-Type':'application/json'}, body});
  const created = await post(JSON.stringify({title:'Première tâche'}));
  assert.equal(created.status,201);
  assert.equal((await created.json()).id,1);
  const rows=await (await fetch(a.url+'/api/tasks')).json();
  assert.equal(rows[0].title,'Première tâche');
  assert.equal((await post('{')).status,400);
  assert.equal((await post('null')).status,400);
  assert.equal((await post('{"title":"  "}')).status,400);
  assert.equal((await post(JSON.stringify({title:'a'.repeat(201)}))).status,400);
  assert.equal((await fetch(a.url+'/missing')).status,404);
  const metrics=await (await fetch(a.url+'/metrics')).text();
  assert.match(metrics,/taskboard_http_requests_total\{method="POST",route="\/api\/tasks",status="201"\} 1/);
  assert.match(metrics,/le="\+Inf"/);
});
test('la panne exige le mode laboratoire et préserve la vitalité', async t => {
  await assert.rejects(createApp({FAULT_MODE:'error'}), /LAB_MODE/);
  const a = await start({LAB_MODE:'true',FAULT_MODE:'error'}); t.after(a.stop);
  assert.equal((await fetch(a.url+'/healthz')).status,200);
  assert.equal((await fetch(a.url+'/api/tasks')).status,503);
});
test('la latence simulée ralentit une requête fonctionnelle', async t => {
  const a = await start({LAB_MODE:'true',FAULT_MODE:'slow'}); t.after(a.stop);
  const begin=performance.now();
  assert.equal((await fetch(a.url+'/api/tasks')).status,200);
  assert.ok(performance.now()-begin >= 1400);
});

test('un titre Unicode survit à la séparation entre deux paquets réseau', async t => {
  const a = await start(); t.after(a.stop);
  const body = Buffer.from(JSON.stringify({title:'Été'}));
  const split = body.indexOf(Buffer.from('É')) + 1;
  const result = await new Promise((resolve, reject) => {
    const req = http.request(a.url+'/api/tasks', {method:'POST',
      headers:{'Content-Type':'application/json'}}, res => {
      let text=''; res.on('data', chunk => text+=chunk);
      res.on('end', () => resolve({status:res.statusCode, value:JSON.parse(text)}));
    });
    req.on('error', reject); req.write(body.subarray(0,split));
    setTimeout(() => req.end(body.subarray(split)), 20);
  });
  assert.equal(result.status,201);
  assert.equal(result.value.title,'Été');
});

const postTask = (url, title, headers = {}) => fetch(url+'/api/tasks', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify({ title }) });

test('la version publique et les journaux identifient la révision sans exposer l’environnement', async t => {
  const logs=[];
  const a = await start({ APP_VERSION:'0.2.0-pre.1', APP_REVISION:'abc1234',
    PRIVATE_TOKEN:'ne-jamais-publier-ceci' }, line => logs.push(line));
  t.after(a.stop);
  const response=await fetch(a.url+'/version');
  assert.deepEqual(await response.json(), {version:'0.2.0-pre.1',revision:'abc1234'});
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const entry=JSON.parse(logs.find(line => line.includes('request_id')));
  assert.equal(entry.app_revision,'abc1234');
  assert.equal(entry.app_version,'0.2.0-pre.1');
  assert.ok(!logs.join('').includes('ne-jamais-publier-ceci'));
  await assert.rejects(createApp({APP_REVISION:'a\nsecret'}), /APP_REVISION/);
  await assert.rejects(createApp({FAULT_MODE:'surprise'}), /FAULT_MODE/);
});

test('les titres sont bornés à 200 points de code et les mauvais types sont rejetés', async t => {
  const a=await start();t.after(a.stop);
  const valid=await postTask(a.url,'  '+ '🚀'.repeat(200) +'  ');
  assert.equal(valid.status,201);
  assert.equal((await valid.json()).title, '🚀'.repeat(200));
  for (const value of ['🚀'.repeat(201), '', '\t\n', 'nul\0interdit', '\ud800', 42, null, [], {}]) {
    assert.equal((await postTask(a.url,value)).status,400);
  }
  assert.equal((await (await fetch(a.url+'/api/tasks')).json()).length,1);
});

test('le serveur refuse les corps trop grands et les types de contenu ambigus', async t => {
  const a=await start();t.after(a.stop);
  for (const media of ['text/plain','application/json-extra','application/jsonp']) {
    assert.equal((await postTask(a.url,'test', {'Content-Type':media})).status,415);
  }
  assert.equal((await postTask(a.url,'test', {'Content-Type':'application/json; charset=utf-8'})).status,201);
  const oversized=await postTask(a.url,'x'.repeat(9000));
  assert.equal(oversized.status,413);
  assert.equal((await oversized.json()).error,'body too large');
  assert.equal((await fetch(a.url+'/healthz')).status,200);
  assert.equal((await (await fetch(a.url+'/api/tasks')).json()).length,1);
});

test('lecture ciblée, méthodes interdites et identifiants invalides restent déterministes', async t => {
  const a=await start();t.after(a.stop);
  const title='<script>alert("texte conservé")</script>';
  const created=await (await postTask(a.url,title)).json();
  const reread=await fetch(a.url+'/api/tasks/'+created.id);
  assert.deepEqual(await reread.json(),created);
  assert.equal(reread.headers.get('x-content-type-options'),'nosniff');
  assert.match(reread.headers.get('content-type'),/^application\/json/);
  for (const path of ['/api/tasks/0','/api/tasks/-1','/api/tasks/2147483648','/api/tasks/123abc','/api/tasks/999']) {
    assert.equal((await fetch(a.url+path)).status,404);
  }
  const refused=await fetch(a.url+'/api/tasks/1',{method:'DELETE'});
  assert.equal(refused.status,405);assert.equal(refused.headers.get('allow'),'GET');
  const collection=await fetch(a.url+'/api/tasks',{method:'PATCH'});
  assert.equal(collection.status,405);assert.equal(collection.headers.get('allow'),'GET, POST');
  assert.equal((await (await fetch(a.url+'/api/tasks/1')).json()).title,title);
});

test('les chemins, identifiants et paramètres arbitraires ne créent pas de labels métriques', async t => {
  const a=await start();t.after(a.stop);
  for (const path of ['/absent-secret-a','/absent-secret-b','/api/tasks/37','/api/tasks/38']) {
    await fetch(a.url+path+'?token=secret-parametre');
  }
  const metrics=await (await fetch(a.url+'/metrics')).text();
  assert.ok(!metrics.includes('secret'));
  assert.ok(!metrics.includes('/api/tasks/37'));
  assert.match(metrics,/route="unmatched",status="404"\} 2/);
  assert.match(metrics,/route="\/api\/tasks\/:id",status="404"\} 2/);
});

test('une dépendance défaillante ne fuit pas ses détails et ne déclenche aucune migration', async t => {
  const logs=[];const queries=[];let ended=false;
  const credential='postgres://taskboard:mot-de-passe-secret@db/taskboard';
  const pool={on(){},async query(sql){queries.push(sql);throw Error(credential+' : panne interne');},
    async end(){ended=true;}};
  const a=await start({DATABASE_URL:credential}, line=>logs.push(line), {createPool:()=>pool});
  t.after(a.stop);
  assert.equal(queries.length,0);
  assert.equal((await fetch(a.url+'/healthz')).status,200);
  assert.equal((await fetch(a.url+'/version')).status,200);
  for (const path of ['/readyz','/api/tasks','/api/tasks/1']) {
    const response=await fetch(a.url+path);
    assert.equal(response.status,503);
    assert.deepEqual(await response.json(),{error:'dependency unavailable'});
  }
  const response=await postTask(a.url,'témoin');
  assert.equal(response.status,503);
  assert.ok(queries.some(sql=>/FROM tasks LIMIT 0/.test(sql)));
  assert.ok(queries.every(sql=>!/(CREATE|ALTER|DROP)/.test(sql)));
  assert.ok(!logs.join('').includes('mot-de-passe-secret'));
  assert.ok(logs.some(line=>JSON.parse(line).event==='request_failed'));
  await a.stop();assert.equal(ended,true);
});

test('les valeurs utilisateur sont transmises à PostgreSQL par paramètres', async t => {
  const queries=[];
  const title="'); DROP TABLE tasks; --";
  const task={id:7,title,created_at:'2026-09-24T12:00:00.000Z'};
  const pool={on(){},async end(){},async query(sql,params){
    queries.push({sql,params});return {rows:[task]};}};
  const a=await start({DATABASE_URL:'postgres://example'}, ()=>{}, {createPool:()=>pool});
  t.after(a.stop);
  assert.equal((await postTask(a.url,title)).status,201);
  assert.deepEqual(await (await fetch(a.url+'/api/tasks/7')).json(),task);
  assert.deepEqual(queries[0].params,[title]);
  assert.ok(!queries[0].sql.includes(title));
  assert.deepEqual(queries[1].params,[7]);
});

test('la limite mémoire refuse une création supplémentaire sans effacer les 1 000 tâches', async t => {
  const a=await start();t.after(a.stop);
  for (let index=0;index<1000;index++) {
    const response=await postTask(a.url,'tâche '+index);
    assert.equal(response.status,201);await response.json();
  }
  assert.equal((await postTask(a.url,'une de trop')).status,409);
  const tasks=await (await fetch(a.url+'/api/tasks')).json();
  assert.equal(tasks.length,1000);assert.equal(tasks[0].title,'tâche 0');
  assert.equal(tasks.at(-1).title,'tâche 999');
});
