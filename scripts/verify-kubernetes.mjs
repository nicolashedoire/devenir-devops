#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, kube, guard } from './kube-common.mjs';
const witnessPath = process.argv[2];
if (!witnessPath) throw new Error('Usage : node scripts/verify-kubernetes.mjs preuves/tache-temoin.json');
const witness = JSON.parse(await readFile(path.resolve(root, witnessPath)));
const image = JSON.parse(await readFile(path.join(root, 'deploy/image-reference.json')));
guard();
const proof = path.join(root, 'preuves', `kubernetes-recette-${Date.now()}`);
await mkdir(proof, { recursive: true });
const cases = [];
function api(ns, suffix) {
  return JSON.parse(kube('exec', '-n', ns, 'deployment/taskboard-api', '-c', 'api', '--', 'node', '-e', `fetch('http://127.0.0.1:3000/${suffix}',{signal:AbortSignal.timeout(5000)}).then(async r=>{if(!r.ok)process.exit(1);console.log(await r.text())}).catch(()=>process.exit(1))`));
}
function check(ns, label) {
  assert.deepEqual(api(ns, `api/tasks/${witness.id}`), witness);
  const ready = api(ns, 'readyz'); assert.equal(ready.storage, 'postgres');
  const version = api(ns, 'version'); assert.equal(version.revision, image.revision);
  const deploy = JSON.parse(kube('get', 'deployment', 'taskboard-api', '-n', ns, '-o', 'json'));
  assert.equal(deploy.spec.template.spec.containers[0].image, `${image.repository}@${image.digest}`);
  assert.equal(deploy.spec.template.spec.automountServiceAccountToken, false);
  cases.push({ namespace: ns, controle: label, resultat: 'succes', image_digest: image.digest });
}
for (const ns of ['taskboard-lab', 'taskboard-recette', 'taskboard-production']) check(ns, 'témoin importé et image attendue');
// Dans le seul namespace Helm, remplacer vraiment un Pod API puis PostgreSQL.
const ns = 'taskboard-lab';
const pods = JSON.parse(kube('get', 'pods', '-n', ns, '-l', 'app.kubernetes.io/component=api', '-o', 'json'));
const oldUID = pods.items[0].metadata.uid;
kube('delete', 'pod', pods.items[0].metadata.name, '-n', ns, '--wait=true', '--timeout=90s');
kube('rollout', 'status', 'deployment/taskboard-api', '-n', ns, '--timeout=180s');
const replaced = JSON.parse(kube('get', 'pods', '-n', ns, '-l', 'app.kubernetes.io/component=api', '-o', 'json'));
assert.ok(!replaced.items.some(p => p.metadata.uid === oldUID));
check(ns, 'Pod API remplacé');
const pvcBefore = JSON.parse(kube('get', 'pvc', 'data-taskboard-postgres-0', '-n', ns, '-o', 'json')).metadata.uid;
kube('delete', 'pod', 'taskboard-postgres-0', '-n', ns, '--wait=true', '--timeout=90s');
kube('rollout', 'status', 'statefulset/taskboard-postgres', '-n', ns, '--timeout=180s');
kube('wait', '-n', ns, '--for=condition=Ready', 'pod/taskboard-postgres-0', '--timeout=180s');
assert.equal(JSON.parse(kube('get', 'pvc', 'data-taskboard-postgres-0', '-n', ns, '-o', 'json')).metadata.uid, pvcBefore);
check(ns, 'Pod PostgreSQL remplacé, même PVC et mêmes données');
// Modifier uniquement le laboratoire recette géré par GitOps ; constater sa correction.
kube('scale', 'deployment/taskboard-api', '-n', 'taskboard-recette', '--replicas=1');
await writeFile(path.join(proof, 'derive-deployment.json'), kube('get', 'deployment', 'taskboard-api', '-n', 'taskboard-recette', '-o', 'json'));
kube('annotate', 'application', 'taskboard-recette', '-n', 'argocd', 'argocd.argoproj.io/refresh=hard', '--overwrite');
kube('wait', '-n', 'taskboard-recette', '--for=jsonpath={.spec.replicas}=2', 'deployment/taskboard-api', '--timeout=180s');
kube('rollout', 'status', 'deployment/taskboard-api', '-n', 'taskboard-recette', '--timeout=180s');
check('taskboard-recette', 'dérive de capacité corrigée par Argo CD');
for (const name of ['recette', 'production']) {
  const app = JSON.parse(kube('get', 'application', `taskboard-${name}`, '-n', 'argocd', '-o', 'json'));
  assert.equal(app.status.operationState.phase, 'Succeeded');
  assert.equal(app.status.sync.status, 'Synced');
  await writeFile(path.join(proof, `argocd-${name}.json`), JSON.stringify(app, null, 2));
}
await writeFile(path.join(proof, 'resultat.json'), JSON.stringify({ resultat: 'succes', date: new Date().toISOString(), cas: cases }, null, 2) + '\n');
console.log(`Six contrôles métier réussis ; preuve : ${path.relative(root, proof)}/resultat.json`);
