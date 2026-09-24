#!/usr/bin/env node
// Exécuter depuis la racine du compagnon après l'import taskboard-lab.
// Ne crée aucun cluster, n'utilise que kind-taskboard-lab, ne supprime aucun PVC.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync, spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const repo = process.cwd();
const { kube, run, guard, env } = await import(pathToFileURL(path.join(repo, 'scripts/kube-common.mjs')));
guard();
const ns = 'taskboard-lab';
const values = 'work/kubernetes/values-taskboard-lab.json';
const chart = 'deploy/helm/taskboard';
const witness = JSON.parse(await readFile(path.join(repo, process.argv[2] || 'preuves/tache-temoin.json')));
const expectedImage = JSON.parse(await readFile(path.join(repo, 'deploy/image-reference.json')));
const proofDir = path.join(repo, 'preuves', `lecteur-kubernetes-${Date.now()}`);
await mkdir(proofDir, { recursive: true });
const cases = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const json = (...args) => JSON.parse(kube(...args));
const pods = () => json('get', 'pods', '-n', ns, '-l', 'app.kubernetes.io/component=api', '-o', 'json').items.filter(p => !p.metadata.deletionTimestamp);
const podReady = p => p.status.conditions?.some(c => c.type === 'Ready' && c.status === 'True');
async function awaitPods(count) {
  const deadline=Date.now()+180000;
  while(Date.now()<deadline){const current=pods();if(current.length===count && current.every(podReady))return current;await sleep(1000);}
  throw Error(`Nombre de Pods prêts différent de ${count}.`);
}
const endpoints = () => json('get','endpointslices','-n',ns,'-l','kubernetes.io/service-name=taskboard-api','-o','json').items.flatMap(s=>s.endpoints||[]).filter(e=>e.conditions?.ready!==false);
async function awaitEndpoints(count) {
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){if(endpoints().length===count)return;await sleep(500);}
  throw Error(`Nombre de destinations différent de ${count}.`);
}
function readFromPod(name, target) {
  return json('exec','-n',ns,name,'-c','api','--','node','--input-type=module','-e',
    `try {const r=await fetch(${JSON.stringify(target)},{signal:AbortSignal.timeout(3000)});console.log(JSON.stringify({status:r.status,body:await r.json()}));}catch(e){console.log(JSON.stringify({status:null,error_type:e.name}));}`);
}
function checkWitness(name) {
  const response=readFromPod(name,`http://127.0.0.1:3000/api/tasks/${witness.id}`);
  assert.equal(response.status,200);assert.deepEqual(response.body,witness);
}
function checkAll(current) { for(const p of current)checkWitness(p.metadata.name); }
async function checkTunnel() {
  const tunnel=spawn('kubectl',['port-forward','--address','127.0.0.1','-n',ns,'svc/taskboard-api','3006:3000'],{cwd:repo,env,stdio:['ignore','ignore','pipe']});
  let processError;tunnel.on('error',error=>{processError=error;});
  tunnel.stderr.on('data',()=>{});
  try {
    let reachable=false;
    for(let i=0;i<30;i++){
      if(processError)throw processError;
      try {const r=await fetch('http://127.0.0.1:3006/readyz',{signal:AbortSignal.timeout(1000)});if(r.ok){assert.equal((await r.json()).storage,'postgres');reachable=true;break;}}catch{}
      await sleep(1000);
    }
    assert.ok(reachable,'Le tunnel 3006 doit joindre PostgreSQL par la sonde.');
    const version=await fetch('http://127.0.0.1:3006/version',{signal:AbortSignal.timeout(3000)});
    assert.equal(version.status,200);assert.equal((await version.json()).revision,expectedImage.revision);
    const task=await fetch(`http://127.0.0.1:3006/api/tasks/${witness.id}`,{signal:AbortSignal.timeout(3000)});
    assert.equal(task.status,200);assert.deepEqual(await task.json(),witness);
  } finally {
    tunnel.kill('SIGTERM');
    if(tunnel.exitCode===null)await Promise.race([new Promise(resolve=>tunnel.once('close',resolve)),sleep(2000)]);
    if(tunnel.exitCode===null)tunnel.kill('SIGKILL');
  }
}
function restoreHelm() {
  run('helm',['upgrade','taskboard',chart,'-n',ns,'-f',values,'--force-conflicts','--wait','--wait-for-jobs','--timeout=180s']);
}
function record(chapter, test, data={}) {
  cases.push({ chapitre:chapter, controle:test, resultat:'succes', ...data });
  console.log(`Chapitre ${chapter} : ${test} — réussi.`);
}
let result='succes';let failure;let cleanupNeeded=false;
const start=new Date().toISOString();
try {
  const deployment=json('get','deployment','taskboard-api','-n',ns,'-o','json');
  assert.equal(deployment.spec.template.spec.containers[0].image,`${expectedImage.repository}@${expectedImage.digest}`);
  const pvcBefore=json('get','pvc','data-taskboard-postgres-0','-n',ns,'-o','json').metadata.uid;
  const before=await awaitPods(2);checkAll(before);
  const oldUIDs=new Set(before.map(p=>p.metadata.uid));
  await checkTunnel();record(11,'port-forward 3006 : readyz PostgreSQL, version et témoin exact');
  cleanupNeeded=true;
  kube('delete','pod','-n',ns,'-l','app.kubernetes.io/component=api','--wait=true','--timeout=90s');
  kube('rollout','status','deployment/taskboard-api','-n',ns,'--timeout=180s');
  const after=await awaitPods(2);
  assert.ok(after.every(p=>!oldUIDs.has(p.metadata.uid)));checkAll(after);
  record(11,'suppression de tous les Pods API, nouvelles identités et témoin exact',{anciens_uids:[...oldUIDs],nouveaux_uids:after.map(p=>p.metadata.uid)});

  kube('scale','deployment/taskboard-api','-n',ns,'--replicas=3');
  kube('rollout','status','deployment/taskboard-api','-n',ns,'--timeout=180s');
  const three=await awaitPods(3);checkAll(three);
  record(11,'trois API interrogées directement, même témoin',{pods:three.map(p=>p.metadata.name)});
  const removed=three[0];
  kube('delete','pod',removed.metadata.name,'-n',ns,'--wait=true','--timeout=90s');
  const replacement=await awaitPods(3);assert.ok(replacement.every(p=>p.metadata.uid!==removed.metadata.uid));checkAll(replacement);
  record(11,'un Pod remplacé parmi trois sans changement de données');
  restoreHelm();await awaitPods(2);

  kube('set','resources','deployment/taskboard-api','-n',ns,'--requests=cpu=100m,memory=128Mi','--limits=cpu=500m,memory=256Mi');
  kube('rollout','status','deployment/taskboard-api','-n',ns,'--timeout=180s');
  const resources=json('get','deployment','taskboard-api','-n',ns,'-o','json').spec.template.spec.containers[0].resources;
  assert.deepEqual(resources,{limits:{cpu:'500m',memory:'256Mi'},requests:{cpu:'100m',memory:'128Mi'}});
  const resourcePods=await awaitPods(2);checkAll(resourcePods);
  record(12,'requests/limits appliquées et données intactes',{resources});

  const name=resourcePods[0].metadata.name;
  assert.equal(readFromPod(name,'http://taskboard-api:3000/api/tasks').status,200);
  await awaitEndpoints(2);
  kube('patch','service','taskboard-api','-n',ns,'--type=merge','-p',JSON.stringify({spec:{selector:{'app.kubernetes.io/instance':'taskboard-absent'}}}));
  await awaitEndpoints(0);
  const broken=readFromPod(name,'http://taskboard-api:3000/api/tasks');
  assert.equal(broken.status,null);checkWitness(name);
  record(12,'sélecteur faux : zéro destination et échec du Service, Pod direct encore correct',{erreur_reseau:broken.error_type});
  kube('patch','service','taskboard-api','-n',ns,'--type=merge','-p',JSON.stringify({spec:{selector:{'app.kubernetes.io/instance':'taskboard'}}}));
  await awaitEndpoints(2);
  assert.equal(readFromPod(name,'http://taskboard-api:3000/api/tasks').status,200);checkWitness(name);
  record(12,'sélecteur restauré : destinations et lecture revenues');

  // Fin du chapitre 12 : Helm reprend les champs modifiés volontairement avec kubectl.
  restoreHelm();checkAll(await awaitPods(2));
  run('helm',['lint',chart,'-f',values]);
  const rendered=run('helm',['template','taskboard',chart,'-n',ns,'-f',values,'--set','replicaCount=3']);
  assert.match(rendered,/^  replicas: 3$/m);
  const negative=spawnSync('helm',['template','taskboard',chart,'-n',ns,'-f',values,'--set','replicaCount=5'],{cwd:repo,env,encoding:'utf8',timeout:30000});
  assert.notEqual(negative.status,0);assert.match(`${negative.stdout}\n${negative.stderr}`,/replicaCount/);
  record(13,'helm lint et rendu à trois ; cinq refusé par le schéma');
  const revision=JSON.parse(run('helm',['status','taskboard','-n',ns,'-o','json'])).version;
  const absent='sha256:'+'0'.repeat(64);
  const failedUpgrade=spawnSync('helm',['upgrade','taskboard',chart,'-n',ns,'-f',values,'--set-string',`image.digest=${absent}`,'--wait','--wait-for-jobs','--timeout=90s'],{cwd:repo,env,encoding:'utf8',timeout:150000});
  assert.notEqual(failedUpgrade.status,0);
  const states=pods().flatMap(p=>[...(p.status.initContainerStatuses||[]),...(p.status.containerStatuses||[])].map(c=>c.state?.waiting?.reason).filter(Boolean));
  assert.ok(states.some(x=>['ErrImagePull','ImagePullBackOff'].includes(x)));
  assert.equal(JSON.parse(run('helm',['status','taskboard','-n',ns,'-o','json'])).info.status,'failed');
  record(13,'commande exacte du livre : digest absent, wait-for-jobs, échec après attente bornée',{etats:states});
  run('helm',['rollback','taskboard',String(revision),'-n',ns,'--wait','--wait-for-jobs','--timeout=180s']);
  checkAll(await awaitPods(2));await checkTunnel();
  record(13,'rollback exact avec wait-for-jobs : image et témoin vérifiés par tunnel');
  restoreHelm();const finalPods=await awaitPods(2);checkAll(finalPods);
  const healthy=json('get','deployment','taskboard-api','-n',ns,'-o','json');
  assert.equal(healthy.spec.template.spec.containers[0].resources.requests.memory,'64Mi');
  assert.equal(json('get','pvc','data-taskboard-postgres-0','-n',ns,'-o','json').metadata.uid,pvcBefore);
  record(11,'retour final aux valeurs Helm normales, même PVC, même témoin');
  cleanupNeeded=false;
} catch(error) {
  result='echec';failure=error.message;
} finally {
  if(cleanupNeeded){
    try {
      kube('patch','service','taskboard-api','-n',ns,'--type=merge','-p',JSON.stringify({spec:{selector:{'app.kubernetes.io/instance':'taskboard'}}}));
      restoreHelm();await awaitPods(2);
      cases.push({controle:'récupération après échec',resultat:'succes'});
    }catch {cases.push({controle:'récupération après échec',resultat:'a_diagnostiquer'});}
  }
  await writeFile(path.join(proofDir,'resultat.json'),JSON.stringify({resultat:result,debut:start,fin:new Date().toISOString(),cible:ns,temoin_sha256:createHash('sha256').update(JSON.stringify(witness)).digest('hex'),cas:cases,...(failure?{erreur:failure}:{})},null,2)+'\n');
}
console.log(`Preuve : ${path.relative(repo,proofDir)}/resultat.json`);
if(result!=='succes')process.exitCode=1;
