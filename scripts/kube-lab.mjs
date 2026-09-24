#!/usr/bin/env node
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { root, work, run, kube, guard, namespace } from './kube-common.mjs';
const args = process.argv.slice(2);
const action = args.shift();
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const ns = namespace(option('--namespace', 'taskboard-lab'));
await mkdir(work, { recursive: true, mode: 0o700 });
const image = JSON.parse(await readFile(path.join(root, 'deploy/image-reference.json')));
const lock = JSON.parse(await readFile(path.join(root, 'deploy/tools-lock.json')));
const dc = (...a) => run('docker', ['compose', '-f', 'compose.yaml', ...a]);
const sql = (query) => kube('exec', '-n', ns, 'taskboard-postgres-0', '--', 'psql', '-X', '-U', 'taskboard', '-d', 'taskboard', '-v', 'ON_ERROR_STOP=1', '-Atc', query).trim();
if (action === 'init') {
  const names = run('kind', ['get', 'clusters']).trim().split('\n');
  if (!names.includes('taskboard-lab')) {
    const config = path.join(work, 'kind.json');
    await writeFile(config, JSON.stringify({ kind: 'Cluster', apiVersion: 'kind.x-k8s.io/v1alpha4', networking: { apiServerAddress: '127.0.0.1' }, nodes: [{ role: 'control-plane' }] }, null, 2));
    run('kind', ['create', 'cluster', '--name', 'taskboard-lab', '--config', config, '--image', lock.nodeImage, '--kubeconfig', path.join(root, 'work/kubeconfig-taskboard-lab'), '--wait', '180s'], { stdio: 'inherit' });
  }
  guard();
  console.log(kube('get', 'nodes', '-o', 'wide'));
} else if (action === 'import') {
  guard();
  const witnessPath = option('--witness');
  if (!witnessPath) throw new Error('Fournir --witness preuves/tache-temoin.json, créé au jalon 03.');
  const witness = JSON.parse(await readFile(path.resolve(root, witnessPath)));
  assert.ok(Number.isInteger(witness.id) && witness.id > 0 && typeof witness.title === 'string');
  const proof = path.join(root, 'preuves', `kubernetes-import-${ns}-${Date.now()}`);
  await mkdir(proof, { recursive: true, mode: 0o700 });
  // Refus de toute réimportation destructive, y compris sur un PVC orphelin.
  const pvcs = JSON.parse(kube('get', 'pvc', '-A', '-o', 'json'));
  if (pvcs.items.some(p => p.metadata.namespace === ns)) throw new Error('Ce namespace contient déjà un volume : import refusé. Conserver les données et diagnostiquer.');
  run('kubectl', ['apply', '-f', '-'], { input: JSON.stringify({ apiVersion: 'v1', kind: 'Namespace', metadata: { name: ns, labels: { 'taskboard.dev/laboratoire': 'true' } } }) });
  const password = randomBytes(24).toString('hex');
  run('kubectl', ['apply', '-f', '-'], { input: JSON.stringify({ apiVersion: 'v1', kind: 'Secret', metadata: { name: 'taskboard-db', namespace: ns }, type: 'Opaque', stringData: { POSTGRES_USER: 'taskboard', POSTGRES_PASSWORD: password, POSTGRES_DB: 'taskboard', DATABASE_URL: `postgresql://taskboard:${password}@taskboard-postgres:5432/taskboard` } }) });
  const values = { image: { repository: image.repository, digest: image.digest }, database: { existingSecret: 'taskboard-db' }, replicaCount: 0, migration: { enabled: false, mode: 'helm' } };
  const valuePath = path.join(work, `values-${ns}.json`);
  await writeFile(valuePath, JSON.stringify(values, null, 2) + '\n');
  run('helm', ['upgrade', '--install', 'taskboard', 'deploy/helm/taskboard', '-n', ns, '-f', valuePath, '--wait', '--wait-for-jobs', '--timeout', '300s'], { stdio: 'inherit' });
  kube('rollout', 'status', '-n', ns, 'statefulset/taskboard-postgres', '--timeout=180s');
  assert.equal(sql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"), '0', 'La destination doit être vide.');
  dc('up', '-d', 'db');
  const apiWasRunning = dc('ps', '--status', 'running', '-q', 'api').trim().length > 0;
  let dump, sourceRows, sequence;
  try {
    if (apiWasRunning) dc('stop', 'api');
    sourceRows = dc('exec', '-T', 'db', 'psql', '-X', '-U', 'taskboard', '-d', 'taskboard', '-Atc', 'SELECT coalesce(json_agg(t ORDER BY id),\'[]\') FROM tasks t').trim();
    const original = JSON.parse(sourceRows).find(t => t.id === witness.id);
    if (original) original.created_at = new Date(original.created_at).toISOString();
    assert.deepEqual(original, witness, 'La tâche témoin doit encore exister dans la source.');
    sequence = dc('exec', '-T', 'db', 'psql', '-X', '-U', 'taskboard', '-d', 'taskboard', '-Atc', 'SELECT last_value,is_called FROM tasks_id_seq').trim();
    dump = dc('exec', '-T', 'db', 'pg_dump', '-U', 'taskboard', '-d', 'taskboard', '--no-owner', '--no-acl');
    await writeFile(path.join(proof, 'sauvegarde.sql'), dump, { mode: 0o600 });
    run('kubectl', ['exec', '-i', '-n', ns, 'taskboard-postgres-0', '--', 'psql', '-X', '-U', 'taskboard', '-d', 'taskboard', '-v', 'ON_ERROR_STOP=1'], { input: dump });
    assert.deepEqual(JSON.parse(sql("SELECT coalesce(json_agg(t ORDER BY id),'[]') FROM tasks t")), JSON.parse(sourceRows));
    assert.equal(sql('SELECT last_value,is_called FROM tasks_id_seq'), sequence);
  } finally { if (apiWasRunning) dc('start', 'api'); }
  values.replicaCount = 2; values.migration.enabled = true;
  await writeFile(valuePath, JSON.stringify(values, null, 2) + '\n');
  run('helm', ['upgrade', 'taskboard', 'deploy/helm/taskboard', '-n', ns, '-f', valuePath, '--wait', '--wait-for-jobs', '--timeout', '300s'], { stdio: 'inherit' });
  kube('rollout', 'status', '-n', ns, 'deployment/taskboard-api', '--timeout=180s');
  const got = JSON.parse(kube('exec', '-n', ns, 'deployment/taskboard-api', '-c', 'api', '--', 'node', '-e', `fetch('http://127.0.0.1:3000/api/tasks/${witness.id}',{signal:AbortSignal.timeout(5000)}).then(async r=>{if(!r.ok)process.exit(1);console.log(await r.text())}).catch(()=>process.exit(1))`));
  assert.deepEqual(got, witness);
  await writeFile(path.join(proof, 'tache-temoin.json'), JSON.stringify(got, null, 2) + '\n');
  await writeFile(path.join(proof, 'resultat.json'), JSON.stringify({ resultat: 'succes', namespace: ns, image, tache_identique: true, toutes_lignes_identiques: true, sequence_identique: true, date: new Date().toISOString() }, null, 2) + '\n');
  console.log(`Import vérifié sans suppression de la source. Preuves : ${path.relative(root, proof)}`);
} else {
  throw new Error('Usage : node scripts/kube-lab.mjs init | import --witness <fichier> [--namespace taskboard-lab|taskboard-recette|taskboard-production]');
}
