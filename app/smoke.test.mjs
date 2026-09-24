import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.mjs';
import { runSmoke } from '../scripts/smoke.mjs';

test('le contrôle HTTP conserve les données et crée des témoins distincts relus par identifiant', async t=>{
  const app=await createApp({},()=>{});t.after(app.stop);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${app.server.address().port}`;
  const existing=await (await fetch(url+'/api/tasks',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Ne pas supprimer'})})).json();
  const first=await runSmoke(url);const second=await runSmoke(url);
  assert.equal(first.event,'smoke_passed');assert.equal(first.storage,'memory');
  assert.equal(first.version,'0.2.0');assert.equal(first.revision,'local');
  assert.notEqual(first.task.title,second.task.title);
  assert.match(first.task.title,/^preuve-parcours-devops-/);
  const tasks=await (await fetch(url+'/api/tasks')).json();
  assert.equal(tasks.length,3);
  assert.deepEqual(tasks[0],existing);
  assert.deepEqual(tasks[1],first.task);
});

test('le contrôle refuse les URL avec identifiants ou paramètres avant toute écriture', async()=>{
  for (const url of ['http://user:password@localhost:3000','file:///tmp/taskboard',
    'http://localhost:3000/?secret=123','http://localhost:3000/api']) {
    await assert.rejects(runSmoke(url),/URL HTTP/);
  }
});

test('une API en panne fait échouer le contrôle et ne produit aucune tâche témoin', async t=>{
  const app=await createApp({LAB_MODE:'true',FAULT_MODE:'error'},()=>{});t.after(app.stop);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  await assert.rejects(runSmoke(`http://127.0.0.1:${app.server.address().port}`),/statut 503/);
});
