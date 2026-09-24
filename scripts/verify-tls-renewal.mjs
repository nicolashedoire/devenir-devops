// Contrôle d'intégration sur runner éphémère : aucune modification de l'application.
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, readdir, stat } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { createHash, X509Certificate } from 'node:crypto';
import assert from 'node:assert/strict';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const work=path.join(repo,'work/operations'), security=path.join(work,'security');
const runtime=path.join(security,'runtime');
const prefix=['compose','--env-file',path.join(work,'lab.env'),'--project-directory',repo,'-f',path.join(repo,'operations/compose.yaml')];
const hash=b=>createHash('sha256').update(b).digest('hex');
const checks=[];
let current='prerequis';
function run(binary,args,input){
 try{return execFileSync(binary,args,{cwd:repo,input,encoding:'utf8',maxBuffer:4*1024*1024,stdio:['pipe','pipe','pipe'],timeout:180000});}
 catch(error){throw Error(current+': commande échouée, code '+(error.status??'indisponible'));}
}
const dc=args=>run('docker',[...prefix,...args]);
const sql=(query,source=false)=>run('docker',source?
 ['compose','--project-directory',repo,'-f','compose.yaml','exec','-T','db','psql','-X','-v','ON_ERROR_STOP=1','-U','taskboard','-d','taskboard','-Atc',query]:
 [...prefix,'exec','-T','db','psql','-X','-v','ON_ERROR_STOP=1','-U','taskboard_admin','-d','taskboard','-Atc',query]).trim();
const note=(name)=>checks.push({controle:name,resultat:'PASS'});
const currentId=name=>dc(['ps','-q',name]).trim();
async function preservedFiles(){
 const r={};for(const f of ['lab.env','source.dump','identity.json','security/ca.key','security/runtime/server.key','security/runtime/token.txt'])
 r[f]=hash(await readFile(path.join(work,f)));
 return r;
}
const rowsQuery=max=>`COPY (SELECT id,title,created_at FROM tasks ${max===undefined?'':`WHERE id<=${max}`} ORDER BY id) TO STDOUT WITH (FORMAT csv)`;
async function observeCertificate() {
 const ca=await readFile(path.join(security,'ca.crt'));
 const token=(await readFile(path.join(runtime,'token.txt'),'utf8')).trim();
 return await new Promise((resolve,reject)=>{
  const req=https.request({hostname:'127.0.0.1',port:3443,path:'/readyz',ca,rejectUnauthorized:true,agent:false,timeout:5000,headers:{authorization:'Bearer '+token}},res=>{
   const fingerprint=res.socket.getPeerCertificate().fingerprint256;
   res.resume();res.on('end',()=>resolve({status:res.statusCode,fingerprint}));
  });
  req.on('error',()=>reject(Error('Connexion TLS de contrôle refusée')));
  req.on('timeout',()=>req.destroy(Error('Délai TLS dépassé')));req.end();
 });
}
const proofFolder=path.join(repo,'preuves','operations-renouvellement-'+Date.now());
await mkdir(proofFolder,{recursive:true,mode:0o700});
try {
 current='empreintes avant maintenance';
 const git=run('git',['rev-parse','HEAD']).trim();
 const before=await preservedFiles();
 const sourceBefore=hash(sql(rowsQuery(),true));
 const sourceSequence=sql('SELECT last_value,is_called FROM tasks_id_seq',true);
 const max=Number(sql('SELECT COALESCE(max(id),0) FROM tasks'));
 assert.ok(Number.isSafeInteger(max)&&max>0);
 const rowsBefore=hash(sql(rowsQuery(max)));
 const dbId=currentId('db'), apiId=currentId('api');
 assert.ok(dbId&&apiId);
 const oldCA=await readFile(path.join(security,'ca.crt'));
 const oldServer=await readFile(path.join(runtime,'server.crt'));
 const observedBefore=await observeCertificate();
 assert.equal(observedBefore.status,200);
 assert.equal(observedBefore.fingerprint,new X509Certificate(oldServer).fingerprint256);
 note('certificat_initial_effectivement_servi');
 const dirsBefore=new Set(await readdir(security));
 current='cinq blocs exacts de l annexe';
 run('bash',['tests/reader/renouvellement-annexe.sh']);
 const stages=(await readdir(security)).filter(n=>n.startsWith('renewal.')&&!dirsBefore.has(n));
 assert.equal(stages.length,1);
 const stage=path.join(security,stages[0]);
 note('cinq_blocs_annexe_executes');
 const newCA=await readFile(path.join(security,'ca.crt'));
 const newServer=await readFile(path.join(runtime,'server.crt'));
 assert.notEqual(hash(newCA),hash(oldCA));assert.notEqual(hash(newServer),hash(oldServer));
 assert.equal(new X509Certificate(oldCA).publicKey.export({type:'spki',format:'pem'}),new X509Certificate(newCA).publicKey.export({type:'spki',format:'pem'}));
 assert.equal(new X509Certificate(oldCA).subject,new X509Certificate(newCA).subject);
 note('certificats_renouveles_meme_autorite_cryptographique');
 assert.deepEqual(await preservedFiles(),before);note('cles_jeton_identite_dump_et_configuration_conserves');
 assert.equal(currentId('db'),dbId);assert.equal(currentId('api'),apiId);
 note('conteneurs_api_et_base_inchanges');
 const observedNew=await observeCertificate();
 assert.equal(observedNew.status,200);assert.equal(observedNew.fingerprint,new X509Certificate(newServer).fingerprint256);
 note('nouveau_certificat_effectivement_servi_apres_reprise_gateway');
 assert.equal((await stat(path.join(runtime,'server.crt'))).mode&0o777,0o644);
 assert.equal((await stat(path.join(security,'ca.crt'))).mode&0o777,0o600);
 note('permissions_certificats_conformes');
 current='retour aux certificats encore valides';
 // Le cinquième bloc a vérifié leur validité ; la fixture vient d'être initialisée.
 dc(['stop','gateway']);
 run('install',['-m','600',path.join(stage,'ca-avant.crt'),path.join(security,'ca.crt')]);
 run('install',['-m','644',path.join(stage,'server-avant.crt'),path.join(runtime,'server.crt')]);
 assert.equal((await stat(path.join(runtime,'server.crt'))).mode&0o777,0o644);
 dc(['up','-d','--no-deps','gateway']);
 run(process.execPath,['operations/lab.mjs','verify']);
 const observedRollback=await observeCertificate();
 assert.equal(observedRollback.status,200);assert.equal(observedRollback.fingerprint,new X509Certificate(oldServer).fingerprint256);
 note('retour_conditionnel_ancienne_chaine_valide_et_acces_verifies');
 current='retour final a la chaine renouvelee';
 dc(['stop','gateway']);
 run('install',['-m','600',path.join(stage,'ca.crt'),path.join(security,'ca.crt')]);
 run('install',['-m','644',path.join(stage,'server.crt'),path.join(runtime,'server.crt')]);
 assert.equal((await stat(path.join(runtime,'server.crt'))).mode&0o777,0o644);
 dc(['up','-d','--no-deps','gateway']);
 run(process.execPath,['operations/lab.mjs','verify']);
 const final=await observeCertificate();
 assert.equal(final.status,200);assert.equal(final.fingerprint,new X509Certificate(newServer).fingerprint256);
 note('etat_final_renouvele_acces_et_temoin_verifies');
 assert.deepEqual(await preservedFiles(),before);
 assert.equal(hash(sql(rowsQuery(max))),rowsBefore);
 assert.equal(hash(sql(rowsQuery(),true)),sourceBefore);
 assert.equal(sql('SELECT last_value,is_called FROM tasks_id_seq',true),sourceSequence);
 note('lignes_preexistantes_operations_et_source_integrale_conservees');
 assert.equal(currentId('db'),dbId);assert.equal(currentId('api'),apiId);note('base_et_api_non_recreees_pendant_retours');
 current='restauration apres maintenance';
 run(process.execPath,['operations/lab.mjs','restore']);note('restauration_snapshot_et_sequence_apres_maintenance');
 const result={verdict:'PASS',date:new Date().toISOString(),commit:git,base_tag:'v1.0.0',cible:'taskboard-operations',checks,
  blocs_annexe_sha256:hash(await readFile(path.join(repo,'tests/reader/renouvellement-annexe.sh'))),
  application_modifiee:false,docker_execute:true,aws_execute:false,public_exposure_authorized:false,
  limite:'Fixture PostgreSQL du runner ; anciens certificats encore valides lors du retour. Expiration simulée séparément par OpenSSL -attime. Aucun volume supprimé. verify ajoute des tâches de contrôle, les lignes préexistantes sont comparées séparément.'};
 await writeFile(path.join(proofFolder,'resultat.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({resultat:'succes',preuve:path.relative(repo,proofFolder),controles:checks.length}));
} catch(error) {
 await writeFile(path.join(proofFolder,'resultat.json'),JSON.stringify({verdict:'FAIL',etape:current,message:error.message,checks},null,2)+'\n',{mode:0o600});
 console.error('Maintenance non validée : '+error.message);process.exitCode=1;
}
