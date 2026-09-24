import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, chmod, stat, rename } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = path.join(repo, 'work/operations');
const security = path.join(work, 'security');
const runtime = path.join(security, 'runtime');
const envFile = path.join(work, 'lab.env');
const docker = process.env.DOCKER_BIN || 'docker';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const args = process.argv.slice(2);
const command = args.shift();
const options = {};
let sourceNeedsResume = false;
let operationsDbStopped = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  try { if (operationsDbStopped) dc(['start', 'db']); } catch {}
  try { if (sourceNeedsResume) source(['start', 'api']); } catch {}
  console.error('Exercice interrompu ; données conservées. Vérifier la reprise des services.');
  process.exit(signal === 'SIGINT' ? 130 : 143);
});
while (args.length) {
  const key = args.shift();
  if (!['--witness', '--count'].includes(key) || !args.length || args[0].startsWith('--')) {
    throw Error('Option inconnue ou valeur absente.');
  }
  options[key.slice(2)] = args.shift();
}
function run(binary, params, input) {
  try { return execFileSync(binary, params, { cwd: repo, input, maxBuffer: 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch (error) {
    // Les commandes SQL et les diagnostics Docker peuvent contenir des secrets.
    const failure = Error(`Échec de ${path.basename(binary)} (code ${error.status ?? 'indisponible'}). Les données sont conservées.`);
    failure.exit = error.status; throw failure;
  }
}
function dc(params, input) {
  return run(docker, ['compose', '--env-file', envFile, '--project-directory', repo,
    '-f', path.join(repo, 'operations/compose.yaml'), ...params], input);
}
function source(params, input) {
  return run(docker, ['compose', '--project-directory', repo, '-f', path.join(repo, 'compose.yaml'), ...params], input);
}
function sql(query, database = 'taskboard') {
  return dc(['exec', '-T', 'db', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'taskboard_admin',
    '-d', database, '-At'], query).toString().trim();
}
async function exists(file) { try { await stat(file); return true; } catch { return false; } }
async function put(file, value, mode = 0o600) { await writeFile(file, value, { mode }); await chmod(file, mode); }
async function identity() { return JSON.parse(await readFile(path.join(work, 'identity.json'), 'utf8')); }
async function request(route = '/api/tasks', { token, trusted = true, method = 'GET', body } = {}) {
  if (token === undefined) token = (await readFile(path.join(runtime, 'token.txt'), 'utf8')).trim();
  const ca = trusted ? await readFile(path.join(security, 'ca.crt')) : undefined;
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: '127.0.0.1', port: 3443, path: route, method,
      ca, rejectUnauthorized: true, timeout: 6000,
      headers: { ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
        ...(body ? { 'Content-Type': 'application/json' } : {}) } }, res => {
      const chunks = []; let bytes = 0;
      res.on('data', chunk => { bytes += chunk.length; if (bytes > 1048576) req.destroy(Error('Réponse trop grande')); else chunks.push(chunk); });
      res.on('end', () => resolve({ status: res.statusCode, durationMs: performance.now() - start,
        text: Buffer.concat(chunks).toString() }));
    });
    req.on('timeout', () => req.destroy(Error('Délai dépassé')));
    req.on('error', reject); req.end(body);
  });
}
async function ready(timeout = 90000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if ((await request('/readyz')).status === 200) return; } catch {}
    await sleep(1000);
  }
  throw Error('La passerelle ou la base ne devient pas prête dans le délai.');
}
function need(condition, message) { if (!condition) throw Error(message); }
const rowsQuery = "COPY (SELECT id,title,created_at AT TIME ZONE 'UTC' AS created_at FROM tasks ORDER BY id) TO STDOUT WITH (FORMAT csv, HEADER true)";
function fingerprint(database = 'taskboard') {
  const rows = dc(['exec', '-T', 'db', 'psql', '-X', '-U', 'taskboard_admin', '-d', database, '-c', rowsQuery]);
  return { sha256: createHash('sha256').update(rows).digest('hex'),
    sequence: sql('SELECT last_value,is_called FROM tasks_id_seq', database),
    count: Number(sql('SELECT count(*) FROM tasks', database)) };
}
function events() {
  return JSON.parse(dc(['exec', '-T', 'gateway', 'node', '--input-type=module', '-e',
    'const r=await fetch("http://receiver:8090/events",{signal:AbortSignal.timeout(3000)});if(!r.ok)process.exit(1);console.log(await r.text())']).toString());
}
async function saveProof(kind, data) {
  const folder = path.join(repo, 'preuves', `operations-${kind}-${Date.now()}`);
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const proof = { checkedAt: new Date().toISOString(), kind, ...data };
  await put(path.join(folder, 'resultat.json'), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify({ resultat: 'succes', preuve: path.relative(repo, folder), ...data }, null, 2));
  return proof;
}
async function verify() {
  await ready();
  const id = await identity();
  let noTrust = false;
  try { await request('/healthz', { trusted: false }); } catch (error) {
    noTrust = ['SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(error.code);
  }
  need(noTrust, 'Le client sans autorité locale doit refuser TLS.');
  for (const route of ['/', '/healthz', '/readyz', '/version', '/metrics', '/api/tasks', `/api/tasks/${id.witness.id}`]) {
    need((await request(route, { token: null })).status === 401, `Le chemin ${route} doit refuser une requête sans jeton.`);
    need((await request(route, { token: '0'.repeat(64) })).status === 401, `Le chemin ${route} doit refuser un faux jeton.`);
  }
  const result = await request(`/api/tasks/${id.witness.id}`);
  const task = JSON.parse(result.text);
  need(result.status === 200 && ['id', 'title', 'created_at'].every(key => task[key] === id.witness[key]), 'Le témoin doit être conservé à l’identique.');
  need((await request('/api/tasks', { token: null, method: 'POST', body: '{"title":"refus"}' })).status === 401, 'Une écriture sans jeton doit être refusée.');
  need((await request('/hors-perimetre')).status === 404, 'Une route inconnue doit être refusée.');
  need((await request('/api/tasks', { method: 'DELETE' })).status === 405, 'Une méthode destructive doit être refusée.');
  need((await request('/api/tasks', { method: 'POST', body: 'x'.repeat(9000) })).status === 413, 'Un corps dépassant 8192 octets doit être refusé.');
  const creation = await request('/api/tasks', { method: 'POST', body: JSON.stringify({ title: `controle-acces-${randomBytes(6).toString('hex')}` }) });
  need(creation.status === 201, 'Le rôle applicatif doit permettre la création d’une tâche.');
  const created = JSON.parse(creation.text);
  need((await request(`/api/tasks/${created.id}`)).status === 200, 'La tâche créée doit être lisible.');
  const version = JSON.parse((await request('/version')).text);
  need(version.revision === id.image.revision, 'La révision servie doit correspondre à l’image sélectionnée.');
  const config = JSON.parse(dc(['config', '--format', 'json']).toString());
  need(!config.services.api.ports?.length && !config.services.db.ports?.length, 'API et base ne doivent publier aucun port hôte.');
  const privilege = JSON.parse(dc(['exec', '-T', 'api', 'node', '--input-type=module', '-e', `
    import pg from 'pg';
    const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
    const read=await c.query('SELECT count(*) FROM tasks');
    let denied=false;await c.query('BEGIN');
    try{await c.query('CREATE TABLE operation_interdite (id int)');}catch(e){denied=e.code==='42501';}
    await c.query('ROLLBACK');await c.end();
    console.log(JSON.stringify({lecture:read.rowCount===1,ddl_refuse:denied}));
  `]).toString());
  need(privilege.lecture && privilege.ddl_refuse, 'Le rôle applicatif doit lire les tâches et refuser CREATE TABLE.');
  return { tls_non_confiant_refuse: true, acces_non_autorises_refuses: true,
    api_et_base_non_publiees: true, temoin_identique: true, version,
    role_applicatif_ddl_refuse: true, ecriture_autorisee_verifiee: true, routes_methodes_et_corps_bornes: true };
}
async function main() {
  if (command === 'init') {
    need(options.witness, 'Fournir --witness preuves/tache-temoin.json.');
    need(!(await exists(envFile)), 'Ce laboratoire existe déjà : utiliser verify ou reprendre le diagnostic, sans écraser ses données.');
    const witness = JSON.parse(await readFile(path.resolve(repo, options.witness), 'utf8'));
    need(Number.isSafeInteger(witness.id) && witness.id > 0 && typeof witness.title === 'string' && typeof witness.created_at === 'string', 'Témoin invalide.');
    const image = JSON.parse(await readFile(path.join(repo, 'deploy/image-reference.json'), 'utf8'));
    need(/^sha256:[a-f0-9]{64}$/.test(image.digest), 'Digest d’image invalide.');
    need(/^ghcr\.io\/[a-z0-9._/-]+$/.test(image.repository), 'Dépôt d’image invalide.');
    run(docker, ['info']); run('openssl', ['version']);
    await mkdir(work, { recursive: true, mode: 0o700 }); await chmod(work, 0o700);
    await mkdir(runtime, { recursive: true, mode: 0o755 }); await chmod(security, 0o700); await chmod(runtime, 0o755);
    const passwords = { admin: randomBytes(24).toString('hex'), migration: randomBytes(24).toString('hex'), runtime: randomBytes(24).toString('hex') };
    await put(envFile, `TASKBOARD_IMAGE=${image.repository}@${image.digest}\nDB_ADMIN_PASSWORD=${passwords.admin}\nMIGRATION_DATABASE_URL=postgres://taskboard_migration:${passwords.migration}@db:5432/taskboard\nRUNTIME_DATABASE_URL=postgres://taskboard_runtime:${passwords.runtime}@db:5432/taskboard\n`);
    await put(path.join(work, 'identity.json'), JSON.stringify({ witness, image }, null, 2));
    await put(path.join(runtime, 'token.txt'), randomBytes(32).toString('hex') + '\n', 0o644);
    run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '7', '-subj', '/CN=TaskBoard-Laboratoire-CA', '-keyout', path.join(security, 'ca.key'), '-out', path.join(security, 'ca.crt')]);
    run('openssl', ['req', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=localhost', '-keyout', path.join(runtime, 'server.key'), '-out', path.join(security, 'server.csr')]);
    await put(path.join(security, 'extensions.cnf'), 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n');
    run('openssl', ['x509', '-req', '-days', '7', '-in', path.join(security, 'server.csr'), '-CA', path.join(security, 'ca.crt'), '-CAkey', path.join(security, 'ca.key'), '-CAcreateserial', '-out', path.join(runtime, 'server.crt'), '-extfile', path.join(security, 'extensions.cnf')]);
    await chmod(path.join(security, 'ca.key'), 0o600); await chmod(path.join(runtime, 'server.key'), 0o644); await chmod(path.join(runtime, 'server.crt'), 0o644);
    console.log('Initialisation de la cible indépendante ; aucun port API ou PostgreSQL ne sera publié.');
    dc(['up', '-d', 'db']);
    let dbReady = false;
    for (let i=0;i<60;i++) { try { sql('SELECT 1'); dbReady=true; break; } catch { await sleep(1000); } }
    need(dbReady, 'PostgreSQL cible indisponible.');
    sql(`CREATE ROLE taskboard_migration LOGIN PASSWORD '${passwords.migration}';\nCREATE ROLE taskboard_runtime LOGIN PASSWORD '${passwords.runtime}';\nALTER DATABASE taskboard OWNER TO taskboard_migration;\nREVOKE CREATE ON SCHEMA public FROM PUBLIC;\nGRANT ALL ON SCHEMA public TO taskboard_migration;`);
    const wasRunning = source(['ps', '--status', 'running', '-q', 'api']).toString().trim() !== '';
    let dump; let snapshot;
    try {
      if (wasRunning) { console.log('Courte suspension des écritures sur la source pendant sa sauvegarde.'); sourceNeedsResume = true; source(['stop', '-t', '15', 'api']); }
      const sourceWitness = JSON.parse(source(['exec', '-T', 'db', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'taskboard', '-d', 'taskboard', '-Atc', `SELECT row_to_json(t) FROM (SELECT id,title,created_at FROM tasks WHERE id=${witness.id}) t`]).toString());
      need(sourceWitness.id===witness.id && sourceWitness.title===witness.title && Date.parse(sourceWitness.created_at)===Date.parse(witness.created_at), 'Le témoin source ne correspond pas au fichier.');
      const rows = source(['exec', '-T', 'db', 'psql', '-X', '-U', 'taskboard', '-d', 'taskboard', '-c', rowsQuery]);
      snapshot = { sha256: createHash('sha256').update(rows).digest('hex'),
        sequence: source(['exec', '-T', 'db', 'psql', '-X', '-U', 'taskboard', '-d', 'taskboard', '-Atc', 'SELECT last_value,is_called FROM tasks_id_seq']).toString().trim(),
        count: Number(source(['exec', '-T', 'db', 'psql', '-X', '-U', 'taskboard', '-d', 'taskboard', '-Atc', 'SELECT count(*) FROM tasks']).toString()) };
      dump = source(['exec', '-T', 'db', 'pg_dump', '-U', 'taskboard', '-d', 'taskboard', '-Fc', '--no-owner', '--no-privileges']);
      await put(path.join(work, 'source.dump'), dump);
      await put(path.join(work, 'identity.json'), JSON.stringify({ witness, image, snapshot }, null, 2));
    } finally { if (wasRunning) { source(['start', 'api']); sourceNeedsResume = false; } }
    const start = performance.now();
    dc(['exec', '-T', 'db', 'pg_restore', '-U', 'taskboard_admin', '-d', 'taskboard', '--role=taskboard_migration', '--no-owner', '--no-privileges', '--single-transaction', '--exit-on-error'], dump);
    const restorationMs = performance.now()-start;
    need(JSON.stringify(fingerprint()) === JSON.stringify(snapshot), 'La restauration doit conserver toutes les lignes et la séquence du snapshot.');
    sql('GRANT CONNECT ON DATABASE taskboard TO taskboard_runtime; GRANT USAGE ON SCHEMA public TO taskboard_runtime; GRANT SELECT,INSERT ON TABLE tasks TO taskboard_runtime; GRANT USAGE,SELECT ON SEQUENCE tasks_id_seq TO taskboard_runtime;');
    dc(['--profile', 'maintenance', 'run', '--rm', 'migrate']);
    dc(['up', '-d', 'api', 'gateway', 'prometheus', 'alertmanager', 'receiver']);
    const result = await verify();
    await saveProof('initialisation', { ...result, restauration_snapshot_ms: Math.round(restorationMs),
      source_conservee: true, cible: 'taskboard-operations', rpo_snapshot: 'Témoin exact du snapshot ; aucune affirmation sur les écritures postérieures.' });
  } else {
    need(await exists(envFile), 'Initialiser le laboratoire avant cette commande.');
    if (command === 'verify') await saveProof('acces', await verify());
    else if (command === 'rotate') {
      await ready();
      const old = (await readFile(path.join(runtime, 'token.txt'), 'utf8')).trim();
      await put(path.join(runtime, 'token.next'), randomBytes(32).toString('hex')+'\n', 0o644);
      await rename(path.join(runtime, 'token.next'), path.join(runtime, 'token.txt'));
      need((await request('/api/tasks', {token:old})).status===401, 'L’ancien jeton doit être refusé.');
      need((await request('/api/tasks')).status===200, 'Le nouveau jeton doit fonctionner.');
      await saveProof('rotation', { ancien_jeton_refuse: true, nouveau_jeton_accepte: true, jetons_conserves_dans_preuve: false });
    } else if (command === 'probe') {
      const count = Number(options.count || 20);
      need(Number.isInteger(count) && count>=5 && count<=200, '--count doit être compris entre 5 et 200.');
      let successful=0, fast=0; const durations=[];
      for(let i=0;i<count;i++) { try { const r=await request(); if(r.status===200) { successful++; if(r.durationMs<=300)fast++; } durations.push(Math.round(r.durationMs)); } catch {} await sleep(250); }
      await saveProof('sli', { requetes_eligibles:count, reussites:successful, disponibilite:successful/count,
        lectures_reussies_sous_300ms:fast, sli_latence:successful ? fast/successful : null,
        durees_ms:durations, limite:'Observation ponctuelle locale ; ne prouve pas un SLO de 30 jours.' });
    } else if (command === 'incident') {
      await ready(); const startedAt=new Date().toISOString();
      console.log('Échauffement des mesures locales (20 secondes).');
      for(let i=0;i<20;i++){await request();await sleep(1000);}
      const before = events().length;
      console.log('Arrêt de la seule base du projet taskboard-operations.');
      const failureStart=Date.now(); let firing; let recoveryStart; let resolved;
      try {
        operationsDbStopped = true; dc(['stop', '-t', '5', 'db']);
        const deadline=Date.now()+120000;
        while(Date.now()<deadline){try{await request();}catch{} firing=events().slice(before).find(e=>e.status==='firing');if(firing)break;await sleep(1000);}
        need(firing, 'Aucune notification firing reçue dans les 120 secondes.');
        console.log('Notification firing reçue par le destinataire local ; reprise de la base.');
      } finally { recoveryStart=Date.now(); dc(['start','db']); operationsDbStopped = false; }
      await ready();
      need((await request('/api/tasks')).status === 200, 'La reprise exige une lecture métier réussie après la disponibilité.');
      const serviceRestored=Date.now();
      const deadline=Date.now()+120000;
      while(Date.now()<deadline){await request();resolved=events().slice(before).find(e=>e.status==='resolved');if(resolved)break;await sleep(1000);}
      need(resolved, 'Aucune notification resolved reçue dans les 120 secondes après reprise.');
      const result=await verify();
      await saveProof('incident', { startedAt,
        panne_declenchee_a: new Date(failureStart).toISOString(),
        reprise_demandee_a: new Date(recoveryStart).toISOString(),
        premiere_lecture_reussie_observee_a: new Date(serviceRestored).toISOString(),
        mesure_impact: 'Début de la demande d’arrêt jusqu’à la première lecture métier 200 observée après reprise ; résolution temporelle limitée par la sonde.',
        firing, resolved, impact_observe_ms:serviceRestored-failureStart,
        reprise_apres_action_ms:serviceRestored-recoveryStart, ...result,
        limite:'Indisponibilité de dépendance locale ; aucune perte de disque ou de zone cloud.' });
    } else if (command === 'restore') {
      const id = await identity();
      need(id.snapshot, 'L’empreinte du snapshot initial manque : conserver le diagnostic et reprendre une initialisation vérifiée.');
      const target = `taskboard_restore_ops_${Date.now()}`;
      const started = performance.now();
      dc(['exec','-T','db','createdb','-U','taskboard_admin','--template=template0','--owner=taskboard_migration',target]);
      dc(['exec','-T','db','pg_restore','-U','taskboard_admin','-d',target,'--role=taskboard_migration','--no-owner','--no-privileges','--single-transaction','--exit-on-error'], await readFile(path.join(work,'source.dump')));
      const restored = fingerprint(target);
      need(JSON.stringify(restored) === JSON.stringify(id.snapshot), 'La cible restaurée diffère du snapshot.');
      await saveProof('restauration', { base_distincte:target, lignes_identiques:true, sequence_identique:true,
        taches:restored.count, restauration_et_controle_ms:Math.round(performance.now()-started),
        rpo:'Aucune ligne perdue par rapport au snapshot ; les écritures postérieures ne sont pas incluses.',
        source_et_base_active_conservees:true });
    } else if(command === 'down') {
      dc(['down']); console.log('Services arrêtés. Volume, secrets locaux et sauvegarde conservés ; aucun -v.');
    } else if(command === 'up') {dc(['up','-d']); await ready(); console.log('Laboratoire repris.');}
    else throw Error('Commandes : init --witness FICHIER, verify, rotate, probe --count N, incident, restore, down, up.');
  }
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
