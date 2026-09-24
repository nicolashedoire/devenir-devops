#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {ROOT,generate} from './platform/lib.mjs';
import path from 'node:path';
const witness=JSON.parse(await readFile(path.join(ROOT,'preuves/tache-temoin.json')));
const name='equipe-demo',port=3400;
const request=await generate({name,owner:'apprenant',port});
const env={...process.env,TASKBOARD_PORT:String(port)};
const files=['-f','compose.yaml','-f',`${request.directory}/compose.yaml`];
function command(bin,args){const p=spawnSync(bin,args,{cwd:ROOT,env,encoding:'utf8',timeout:180000,maxBuffer:2*1024*1024});if(p.error||p.status!==0)throw new Error(p.error?.message||p.stderr||'Commande échouée.');return p.stdout;}
command('docker',['compose',...files,'config','--quiet']);
command('docker',['pull',request.contract.image]);
let deployed=false;
try{
 command('docker',['compose',...files,'up','-d','--no-build']);deployed=true;
 let ready=false;
 for(let n=0;n<60;n++){
  try{ready=(await fetch(`http://127.0.0.1:${port}/readyz`,{signal:AbortSignal.timeout(2000)})).ok;}catch{}
  if(ready)break;await new Promise(r=>setTimeout(r,1000));
 }
 assert(ready,'Disponibilité attendue sur le port de l’offre.');
 const actual=await(await fetch(`http://127.0.0.1:${port}/api/tasks/${witness.id}`)).json();assert.deepEqual(actual,witness);
 const apiId=command('docker',['compose',...files,'ps','-q','api']).trim();
 const actualContainer=JSON.parse(command('docker',['inspect',apiId]))[0];
 assert.equal(actualContainer.Config.Image,request.contract.image);
 assert.equal(actualContainer.Config.User,'node');
 assert.equal(actualContainer.HostConfig.ReadonlyRootfs,true);
 assert.equal(actualContainer.HostConfig.Memory,256*1024*1024);
 assert.equal(actualContainer.HostConfig.NanoCpus,1e9);
 assert.deepEqual(actualContainer.HostConfig.PortBindings['3000/tcp'],[{HostIp:'127.0.0.1',HostPort:String(port)}]);
 const version=await(await fetch(`http://127.0.0.1:${port}/version`)).json();
 const reference=JSON.parse(await readFile(path.join(ROOT,'deploy/image-reference.json')));assert.equal(version.revision,reference.revision);
 command(process.execPath,['scripts/mcp/demo.mjs','temoin']);command(process.execPath,['scripts/mcp/demo.mjs','plateforme']);
 const proof=path.join(ROOT,'preuves',`plateforme-livraison-${Date.now()}`);await mkdir(proof,{recursive:true});
 await writeFile(path.join(proof,'resultat.json'),JSON.stringify({resultat:'succes',image:request.contract.image,revision:version.revision,port,temoin_identique:true,limite_cpu:1,limite_memoire_mio:256,lecture_seule:true,mcp_stdio:'catalogue_et_preuves_lus',modele_ia_appele:false},null,2)+'\n');
 console.log('Offre livrée : même image, même témoin, limites et lectures MCP vérifiés.');
}finally{
 if(deployed)command('docker',['compose',...files,'stop','api']);
 // Le volume est conservé. Le lecteur choisit quand reprendre son laboratoire.
}
