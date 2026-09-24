import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import https from 'node:https';
import { once } from 'node:events';
import { authorized, createGateway } from './gateway.mjs';
let dir, key, cert;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'taskboard-tls-'));
  execFileSync('openssl', ['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1','-keyout',path.join(dir,'key.pem'),'-out',path.join(dir,'cert.pem')], {stdio:'ignore'});
  key=await readFile(path.join(dir,'key.pem')); cert=await readFile(path.join(dir,'cert.pem'));
});
after(async () => { if(dir) await rm(dir,{recursive:true,force:true}); });
const token='a'.repeat(64);
async function fixture(t, overrides={}) {
  const logs=[]; const calls=[];
  const server=createGateway({key,cert,readToken:async()=>token,upstream:'http://api:3000',logger:s=>logs.push(s),fetcher:async(url,options)=>{calls.push({url:String(url),options});return new Response('{"ok":true}',{status:200,headers:{'Content-Type':'application/json'}});},...overrides});
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const request=(url='/',{auth=`Bearer ${token}`,method='GET',body,trust=true}={})=>new Promise((resolve,reject)=>{
    const req=https.request({hostname:'127.0.0.1',port:server.address().port,path:url,method,ca:trust?cert:undefined,rejectUnauthorized:true,headers:auth?{authorization:auth}:{},timeout:3000},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,body:data}));});
    req.on('error',reject);req.on('timeout',()=>req.destroy(Error('timeout')));req.end(body);
  });
  return {request,calls,logs};
}
test('le jeton doit être un Bearer exact et ne correspondre qu’au secret attendu',()=>{
  assert.equal(authorized(`Bearer ${token}`,token),true);
  for(const value of [undefined,'',token,`Bearer ${'b'.repeat(64)}`,`Bearer ${token}x`])assert.equal(authorized(value,token),false);
});
test('une cible arbitraire est interdite',()=>assert.throws(()=>createGateway({key,cert,upstream:'http://example.com:3000'}),/cible interne/));
test('le client doit faire confiance explicitement au certificat',async t=>{
  const {request}=await fixture(t);await assert.rejects(request('/',{trust:false}));assert.equal((await request()).status,200);
});
test('absence et erreur de jeton bloquent même santé et métriques',async t=>{
  const {request,calls}=await fixture(t);
  for(const url of ['/healthz','/metrics','/api/tasks'])for(const auth of [null,`Bearer ${'b'.repeat(64)}`])assert.equal((await request(url,{auth})).status,401);
  assert.equal(calls.length,0);
});
test('routes, méthodes et taille sont limitées avant appel interne',async t=>{
  const {request,calls}=await fixture(t);
  assert.equal((await request('/api/tasks?target=secret')).status,404);
  assert.equal((await request('/api/tasks',{method:'DELETE'})).status,405);
  assert.equal((await request('/api/tasks',{method:'POST',body:'x'.repeat(9000)})).status,413);
  assert.equal(calls.length,0);
});
test('le jeton se renouvelle sans redémarrer la passerelle',async t=>{
  let current=token;const {request}=await fixture(t,{readToken:async()=>current});
  assert.equal((await request()).status,200);current='b'.repeat(64);
  assert.equal((await request()).status,401);assert.equal((await request('/',{auth:`Bearer ${current}`})).status,200);
});
test('une erreur de dépendance ne divulgue ni secret ni détails internes',async t=>{
  const {request,logs}=await fixture(t,{fetcher:async()=>{throw Error('postgres://secret:motdepasse@db');}});
  const result=await request('/api/tasks');assert.equal(result.status,502);assert.deepEqual(JSON.parse(result.body),{error:'upstream_unavailable'});
  assert.equal(logs.join('\n').includes('motdepasse'),false);assert.equal(logs.join('\n').includes(token),false);
});
test('un corps de réponse interrompu reste une erreur HTTP propre',async t=>{
  const {request}=await fixture(t,{fetcher:async()=>({status:200,headers:new Headers(),arrayBuffer:async()=>{throw Error('flux interrompu');}})});
  assert.equal((await request('/api/tasks')).status,502);
});
