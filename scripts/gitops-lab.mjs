#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root, work, run, kube, guard } from './kube-common.mjs';
const action = process.argv[2];
const args = process.argv.slice(3);
const index = args.indexOf('--repo');
const repository = index < 0 ? 'https://github.com/nicolashedoire/devenir-devops.git' : args[index + 1];
const revisionIndex = args.indexOf('--revision');
const revision = revisionIndex < 0 ? 'main' : args[revisionIndex + 1];
if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,150}$/.test(revision)) throw new Error('Révision Git invalide.');
if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/devenir-devops(?:\.git)?$/.test(repository)) throw new Error('Fournir l’URL HTTPS GitHub de votre fork devenir-devops, sans identifiant ni jeton.');
guard();
await mkdir(work, { recursive: true });
if (action === 'install') {
  for (const name of ['taskboard-recette', 'taskboard-production']) {
    const secret = kube('get', 'secret', 'taskboard-db', '-n', name, '-o', 'name');
    if (!secret.trim()) throw new Error(`Importer les données et préparer le Secret dans ${name} avant Argo CD.`);
    kube('rollout', 'status', '-n', name, 'statefulset/taskboard-postgres', '--timeout=60s');
  }
  const url = 'https://raw.githubusercontent.com/argoproj/argo-cd/v3.5.3/manifests/install.yaml';
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Argo CD : HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(data).digest('hex') !== '7efe2d6bbc03f63623640f1e4198f16c84009d510fb810ef71e56df1b7614ba9') throw new Error('Empreinte du manifeste Argo CD incorrecte.');
  const file = path.join(work, 'argocd-v3.5.3.yaml');
  await writeFile(file, data);
  run('kubectl', ['apply', '-f', '-'], { input: JSON.stringify({ apiVersion: 'v1', kind: 'Namespace', metadata: { name: 'argocd' } }) });
  run('kubectl', ['apply', '--server-side', '-n', 'argocd', '-f', file], { stdio: 'inherit' });
  kube('rollout', 'status', '-n', 'argocd', 'deployment/argocd-repo-server', '--timeout=300s');
  kube('rollout', 'status', '-n', 'argocd', 'statefulset/argocd-application-controller', '--timeout=300s');
  const project = JSON.parse(await readFile(path.join(root, 'deploy/gitops/project.json')));
  project.spec.sourceRepos = [repository];
  run('kubectl', ['apply', '-f', '-'], { input: JSON.stringify(project) });
  for (const name of ['recette', 'production']) {
    const app = JSON.parse(await readFile(path.join(root, `deploy/gitops/apps/${name}.json`)));
    app.spec.source.repoURL = repository;
    app.spec.source.targetRevision = revision;
    run('kubectl', ['apply', '-f', '-'], { input: JSON.stringify(app) });
    // Après un import Helm, les ressources peuvent déjà être identiques :
    // Synced seul ne prouve ni l'adoption ni l'exécution du hook de migration.
    kube('patch', 'application', `taskboard-${name}`, '-n', 'argocd', '--type=merge', '-p', JSON.stringify({ operation: { initiatedBy: { username: 'atelier-local' }, sync: { prune: true } } }));
  }
  console.log('Argo CD installé. Les namespaces recette et production restent des laboratoires locaux.');
  console.log('Attendre leur réconciliation : node scripts/gitops-lab.mjs verify');
} else if (action === 'verify') {
  for (const name of ['recette', 'production']) {
    kube('wait', '-n', 'argocd', '--for=jsonpath={.status.operationState.phase}=Succeeded', `application/taskboard-${name}`, '--timeout=300s');
    kube('wait', '-n', 'argocd', '--for=jsonpath={.status.sync.status}=Synced', `application/taskboard-${name}`, '--timeout=300s');
    kube('wait', '-n', 'argocd', '--for=jsonpath={.status.health.status}=Healthy', `application/taskboard-${name}`, '--timeout=300s');
    const app = JSON.parse(kube('get', 'application', '-n', 'argocd', `taskboard-${name}`, '-o', 'json'));
    console.log(`${name} : ${app.status.sync.status}, ${app.status.health.status}, commit ${app.status.sync.revision}`);
  }
} else throw new Error('Usage : node scripts/gitops-lab.mjs install [--repo URL_DU_FORK] [--revision BRANCHE] | verify');
