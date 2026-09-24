#!/usr/bin/env node
// Rejoue deux états immuables de Git, puis restaure les branches initiales.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, kube, guard } from './kube-common.mjs';
const witnessPath = process.argv[2];
if (!witnessPath) throw new Error('Fournir le fichier de tâche témoin.');
guard();
const witness = JSON.parse(await readFile(path.resolve(root, witnessPath)));
const original = JSON.parse(await readFile(path.join(root, 'deploy/image-reference.json')));
const candidate = JSON.parse(await readFile(path.join(root, 'deploy/image-candidates/reconstruction.json')));
const revisions = { base: '0e1766c9b704867bf878437b9bdb3b091e30b1c1', candidate: 'c73b1a836c8a305f9d7b4cbe05655a36c16273fa' };
const proof = path.join(root, 'preuves', `promotion-gitops-${Date.now()}`);
await mkdir(proof, { recursive: true });
const results = [], initial = {};
for (const name of ['recette', 'production']) {
  const app = JSON.parse(kube('get', 'application', `taskboard-${name}`, '-n', 'argocd', '-o', 'json'));
  assert.equal(app.spec.source.repoURL, 'https://github.com/nicolashedoire/devenir-devops.git', 'Cette recette de publication utilise les deux commits du dépôt de référence.');
  initial[name] = app.spec.source.targetRevision;
}
function change(name, revision) {
  kube('patch', 'application', `taskboard-${name}`, '-n', 'argocd', '--type=merge', '-p', JSON.stringify({ spec: { source: { targetRevision: revision } } }));
  kube('annotate', 'application', `taskboard-${name}`, '-n', 'argocd', 'argocd.argoproj.io/refresh=hard', '--overwrite');
}
function readAPI(ns, endpoint) {
  return JSON.parse(kube('exec', '-n', ns, 'deployment/taskboard-api', '-c', 'api', '--', 'node', '-e', `fetch('http://127.0.0.1:3000/${endpoint}',{signal:AbortSignal.timeout(5000)}).then(async r=>{if(!r.ok)process.exit(1);console.log(await r.text())}).catch(()=>process.exit(1))`));
}
function verify(name, revision, image, label) {
  change(name, revision);
  for (const [key, value] of [['.status.operationState.syncResult.revision', revision], ['.status.operationState.phase', 'Succeeded'], ['.status.sync.status','Synced'], ['.status.health.status','Healthy']]) {
    kube('wait', '-n', 'argocd', `--for=jsonpath={${key}}=${value}`, `application/taskboard-${name}`, '--timeout=300s');
  }
  const ns = `taskboard-${name}`;
  kube('rollout', 'status', '-n', ns, 'deployment/taskboard-api', '--timeout=180s');
  const deployment = JSON.parse(kube('get', 'deployment', 'taskboard-api', '-n', ns, '-o', 'json'));
  assert.equal(deployment.spec.template.spec.containers[0].image, `${image.repository}@${image.digest}`);
  assert.equal(readAPI(ns, 'version').revision, image.revision);
  assert.deepEqual(readAPI(ns, `api/tasks/${witness.id}`), witness);
  results.push({ etape: label, environnement: name, commit_deploiement: revision, image_digest: image.digest, commit_image: image.revision, temoin_identique: true });
  console.log(`${label} ${name} : image et témoin vérifiés.`);
}
try {
  verify('recette', revisions.candidate, candidate, 'promotion');
  verify('production', revisions.candidate, candidate, 'promotion');
  verify('recette', revisions.base, original, 'retour');
  verify('production', revisions.base, original, 'retour');
  await writeFile(path.join(proof, 'resultat.json'), JSON.stringify({ resultat: 'succes', date: new Date().toISOString(), etapes: results, perimetre: 'Deux commits Git prépubliés ; aucune écriture Git depuis la CI.' }, null, 2)+'\n');
} finally {
  for (const [name, revision] of Object.entries(initial)) change(name, revision);
}
