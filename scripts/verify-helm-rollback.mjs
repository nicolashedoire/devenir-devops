#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {root,kube,guard} from './kube-common.mjs';
const witnessPath=process.argv[2];
if(!witnessPath)throw new Error('Fournir la tâche témoin.');
guard();
const ns='taskboard-lab', chart=path.join(root,'deploy/helm/taskboard');
const env={...process.env,KUBECONFIG:path.join(root,'work/kubeconfig-taskboard-lab')};
function helm(args,allowedFailure=false){
 const p=spawnSync(path.join(root,'work/bin/helm'),args,{cwd:root,env,encoding:'utf8',timeout:240000,maxBuffer:2*1024*1024});
 if(p.error)throw p.error;
 if(p.status!==0&&!allowedFailure)throw new Error(p.stderr||'Échec Helm.');
 return p;
}
const witness=JSON.parse(await readFile(path.resolve(root,witnessPath)));
const image=JSON.parse(await readFile(path.join(root,'deploy/image-reference.json')));
const before=JSON.parse(helm(['status','taskboard','-n',ns,'-o','json']).stdout);
assert.equal(before.info.status,'deployed');
const revision=before.version;
const expected=`${image.repository}@${image.digest}`;
const initial=JSON.parse(kube('get','deployment','taskboard-api','-n',ns,'-o','json'));
assert.equal(initial.spec.template.spec.containers[0].image,expected);
const broken=`${image.repository}@sha256:${'0'.repeat(64)}`;
const proof=path.join(root,'preuves',`helm-rollback-${Date.now()}`);await mkdir(proof,{recursive:true});
let failure,pullStates;
try{
 failure=helm(['upgrade','taskboard',chart,'-n',ns,'--reuse-values','--set',`image.digest=sha256:${'0'.repeat(64)}`,'--wait','--timeout','45s'],true);
 assert.notEqual(failure.status,0,'Le déploiement de l’image absente doit échouer.');
 const failed=JSON.parse(helm(['status','taskboard','-n',ns,'-o','json']).stdout);
 assert.equal(failed.info.status,'failed');
 const pods=JSON.parse(kube('get','pods','-n',ns,'-o','json'));
 pullStates=pods.items.filter(p=>p.spec.containers.some(c=>c.image===broken)).flatMap(p=>(p.status.containerStatuses||[]).map(s=>s.state?.waiting?.reason).filter(Boolean));
 assert(pullStates.some(s=>['ErrImagePull','ImagePullBackOff'].includes(s)),`Un Pod doit montrer l’échec de téléchargement : ${pullStates}`);
 console.log('Image inexistante : échec attendu, diagnostic de téléchargement constaté.');
}finally{
 helm(['rollback','taskboard',String(revision),'-n',ns,'--wait','--timeout','180s']);
 kube('rollout','status','deployment/taskboard-api','-n',ns,'--timeout=180s');
}
const restored=JSON.parse(kube('get','deployment','taskboard-api','-n',ns,'-o','json'));
assert.equal(restored.spec.template.spec.containers[0].image,expected);
const actual=JSON.parse(kube('exec','-n',ns,'deployment/taskboard-api','-c','api','--','node','-e',`fetch('http://127.0.0.1:3000/api/tasks/${witness.id}').then(async r=>{if(!r.ok)process.exit(1);console.log(await r.text())}).catch(()=>process.exit(1))`));
assert.deepEqual(actual,witness);
await writeFile(path.join(proof,'resultat.json'),JSON.stringify({resultat:'succes',revision_initiale:revision,image_retablie:expected,panne_image_absente:pullStates,temoin_identique:true,portee:'Retour de configuration Helm ; aucun retour arrière du schéma SQL.'},null,2)+'\n');
console.log('Rollback Helm : image précédente et tâche témoin identique vérifiées.');
