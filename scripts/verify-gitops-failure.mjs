#!/usr/bin/env node
// Recette bornée : deux commits publics préparés, une seule Application modifiée.
// Aucun push Git, aucun changement de Secret ou de PVC, aucun accès cloud.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, kube, guard } from './kube-common.mjs';

guard();
const witness = JSON.parse(await readFile(path.resolve(root, process.argv[2] || 'preuves/tache-temoin.json')));
const image = JSON.parse(await readFile(path.join(root, 'deploy/image-reference.json')));
const revisions = {
  panne: '3e727aa22eebd1598be210028187430a5779fe77',
  retour: '3aa398311028c942dc836b722bf84bd865cb738c',
};
const appName = 'taskboard-recette';
const namespace = 'taskboard-recette';
const absent = 'sha256:' + '0'.repeat(64);
const proofDir = path.join(root, 'preuves', `panne-gitops-${Date.now()}`);
await mkdir(proofDir, { recursive: true });
const json = (...args) => JSON.parse(kube(...args));
const app = () => json('get', 'application', appName, '-n', 'argocd', '-o', 'json');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const active = a => !!a.operation || ['Running', 'Terminating'].includes(a.status?.operationState?.phase);
async function until(label, predicate, timeout = 300000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await sleep(1500);
  }
  throw new Error(`Délai dépassé : ${label}.`);
}
function patch(document) {
  kube('patch', 'application', appName, '-n', 'argocd', '--type=merge', '-p', JSON.stringify(document));
}
function change(revision) {
  patch({ spec: { source: { targetRevision: revision } } });
  kube('annotate', 'application', appName, '-n', 'argocd', 'argocd.argoproj.io/refresh=hard', '--overwrite');
}
function readAPI(ns, endpoint) {
  return json('exec', '-n', ns, 'deployment/taskboard-api', '-c', 'api', '--', 'node', '--input-type=module', '-e',
    `const r=await fetch(${JSON.stringify(`http://127.0.0.1:3000/${endpoint}`)},{signal:AbortSignal.timeout(5000)}); if(!r.ok)process.exit(1); console.log(await r.text());`);
}
function checkData(ns) {
  assert.deepEqual(readAPI(ns, `api/tasks/${witness.id}`), witness);
  assert.equal(readAPI(ns, 'version').revision, image.revision);
  const deployment = json('get', 'deployment', 'taskboard-api', '-n', ns, '-o', 'json');
  assert.equal(deployment.spec.template.spec.containers[0].image, `${image.repository}@${image.digest}`);
}
function pvc(ns) { return json('get', 'pvc', 'data-taskboard-postgres-0', '-n', ns, '-o', 'json').metadata.uid; }
// Le serveur Argo CD 3.5.3 termine lui-même une opération en plaçant cette phase.
// La précondition resourceVersion empêche d'altérer une nouvelle opération concurrente.
function terminateBadOperation() {
  const current = app();
  const state = current.status?.operationState;
  if (!active(current) || state?.syncResult?.revision !== revisions.panne) return false;
  kube('patch', 'application', appName, '-n', 'argocd', '--type=json', '-p', JSON.stringify([
    { op: 'test', path: '/metadata/resourceVersion', value: current.metadata.resourceVersion },
    { op: 'test', path: '/status/operationState/syncResult/revision', value: revisions.panne },
    { op: 'replace', path: '/status/operationState/phase', value: 'Terminating' },
  ]));
  return true;
}
async function reconcile(revision) {
  change(revision);
  // Changer Git ne remplace pas une opération déjà en cours sur l'ancien commit.
  const terminated = terminateBadOperation();
  await until('fin de l’opération sur le mauvais commit', () => {
    const current = app();
    return !active(current) || current.status?.operationState?.syncResult?.revision !== revisions.panne;
  }, 120000);
  const current = app();
  if (!active(current)) {
    // Le rendu revenu peut être déjà identique aux objets conservés. Demander une
    // opération réelle vérifie le hook et évite de valider une comparaison seule.
    patch({ operation: { initiatedBy: { username: 'recette-lecteur' }, sync: { revision, prune: true } } });
  }
  await until('opération de retour réussie et état sain', () => {
    const a = app(), state = a.status?.operationState;
    const revisionMatches = revision === revisions.retour ? state?.syncResult?.revision === revision : a.spec.source.targetRevision === revision;
    return revisionMatches && !active(a) && state?.phase === 'Succeeded' && a.status?.sync?.status === 'Synced' && a.status?.health?.status === 'Healthy';
  }, 300000);
  checkData(namespace);
  return terminated;
}

let initialRevision;
const evidence = { debut: new Date().toISOString(), cible: namespace, commits: revisions, cas: [] };
let failure;
try {
  const initial = app();
  assert.equal(initial.spec.source.repoURL, 'https://github.com/nicolashedoire/devenir-devops.git');
  initialRevision = initial.spec.source.targetRevision;
  await until('état initial sain', () => {
    const a = app();
    return !active(a) && a.status?.sync?.status === 'Synced' && a.status?.health?.status === 'Healthy';
  });
  checkData(namespace); checkData('taskboard-production');
  const pvcBefore = { recette: pvc(namespace), production: pvc('taskboard-production') };
  const productionRevision = json('get', 'application', 'taskboard-production', '-n', 'argocd', '-o', 'json').spec.source.targetRevision;
  change(revisions.panne);
  const blocked = await until('hook de migration bloqué sur le digest inexistant', () => {
    const a = app();
    if (a.status?.operationState?.syncResult?.revision !== revisions.panne) return false;
    const pods = json('get', 'pods', '-n', namespace, '-l', 'app.kubernetes.io/component=migration', '-o', 'json').items;
    for (const p of pods) {
      if (!p.spec.initContainers?.some(c => c.image.endsWith('@' + absent))) continue;
      const states = [...(p.status.initContainerStatuses || []), ...(p.status.containerStatuses || [])];
      const waiting = states.find(c => ['ErrImagePull', 'ImagePullBackOff'].includes(c.state?.waiting?.reason));
      if (waiting) return { pod: p.metadata.name, conteneur: waiting.name, raison: waiting.state.waiting.reason, phase_operation: a.status.operationState.phase };
    }
    return false;
  });
  assert.notEqual(app().status?.operationState?.phase, 'Succeeded');
  checkData(namespace); checkData('taskboard-production');
  evidence.cas.push({ controle: 'digest inexistant dans le hook GitOps, ancienne API encore disponible', resultat: 'succes', ...blocked, temoin_identique: true });
  console.log('Panne GitOps observée : hook bloqué, ancienne image et témoin encore servis.');
  const terminated = await reconcile(revisions.retour);
  evidence.cas.push({ controle: 'commit de retour réconcilié', resultat: 'succes', operation_bloquee_terminee: terminated, commit: revisions.retour, temoin_identique: true, image_digest: image.digest });
  assert.equal(pvc(namespace), pvcBefore.recette);
  assert.equal(pvc('taskboard-production'), pvcBefore.production);
  assert.equal(json('get', 'application', 'taskboard-production', '-n', 'argocd', '-o', 'json').spec.source.targetRevision, productionRevision);
  checkData('taskboard-production');
  evidence.cas.push({ controle: 'production inchangée et PVC conservés', resultat: 'succes' });
} catch (error) {
  failure = error.message;
} finally {
  if (initialRevision !== undefined) {
    try {
      await reconcile(initialRevision);
      evidence.retour_branche_initiale = 'succes';
    } catch (error) {
      evidence.retour_branche_initiale = 'echec';
      failure ||= error.message;
    }
  }
  evidence.fin = new Date().toISOString();
  evidence.resultat = failure ? 'echec' : 'succes';
  if (failure) evidence.erreur = failure;
  evidence.limite = 'Deux commits publics préparés ; seul taskboard-recette est modifié. Aucun push depuis la CI, aucune certification cloud.';
  await writeFile(path.join(proofDir, 'resultat.json'), JSON.stringify(evidence, null, 2) + '\n');
}
console.log(`Preuve : ${path.relative(root, proofDir)}/resultat.json`);
if (failure) process.exitCode = 1;
