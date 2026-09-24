#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { ROOT, generate } from './platform/lib.mjs';
import path from 'node:path';
const original = JSON.parse(await readFile(path.join(ROOT, 'work/platform/equipe-demo/contrat.json')));
const witness = JSON.parse(await readFile(path.join(ROOT, 'preuves/tache-temoin.json')));
assert.equal(original.port, 3400, 'La première offre doit utiliser le port 3400.');
const request = await generate({name:'equipe-test', owner:'apprenant', port:3401});
assert.equal(request.contract.image, original.image);
assert.deepEqual(request.contract.witness, original.witness);
const results = [];
function dc(name, port, args) {
  const r = spawnSync('docker', ['compose', '-f', 'compose.yaml', '-f',
    `work/platform/${name}/compose.yaml`, ...args], {
    cwd:ROOT, env:{...process.env,TASKBOARD_PORT:String(port)},
    encoding:'utf8', timeout:180000, maxBuffer:1024*1024,
  });
  if (r.error || r.status !== 0) throw Error(r.error?.message || r.stderr || 'Commande Compose échouée.');
  return r.stdout;
}
async function check(name, port) {
  dc(name, port, ['up', '-d', '--no-build']);
  let ready = false;
  for (let n=0; n<60; n++) {
    try { ready = (await fetch(`http://127.0.0.1:${port}/readyz`, {signal:AbortSignal.timeout(2000)})).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, 'L’offre doit redevenir prête.');
  const response = await fetch(`http://127.0.0.1:${port}/api/tasks/${witness.id}`, {signal:AbortSignal.timeout(5000)});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), witness);
  const version = await (await fetch(`http://127.0.0.1:${port}/version`, {signal:AbortSignal.timeout(5000)})).json();
  results.push({offre:name, port, temoin_identique:true, revision:version.revision});
}
let attempted = false;
try {
  attempted = true;
  await check('equipe-test', 3401);
  await check('equipe-demo', 3400);
  assert.equal(results[0].revision, results[1].revision, 'Même version avant et après retour.');
  const proof = path.join(ROOT, 'preuves', `plateforme-changement-port-${Date.now()}`);
  await mkdir(proof, {recursive:true});
  await writeFile(path.join(proof, 'resultat.json'), JSON.stringify({
    resultat:'succes', etapes:results, image:original.image,
    temoin_sha256:createHash('sha256').update(JSON.stringify(witness)).digest('hex'),
    meme_projet_et_volume:true, reconstruction:false,
    limite:'Deux entrées successives vers le même laboratoire, aucun isolement multiéquipes.',
  }, null, 2)+'\n');
  console.log('Validé : offre sur 3401 puis retour sur 3400, même tâche et même version.');
} finally {
  // Le premier test CI laisse l’API arrêtée : conserver cette convention en sortie.
  if (attempted) dc('equipe-demo', 3400, ['stop', 'api']);
}
