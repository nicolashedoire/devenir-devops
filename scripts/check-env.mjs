// Contrôle en lecture seule : aucun outil installé, service lancé ou port réservé.
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import os from 'node:os';

const flags = new Set(process.argv.slice(2));
if ([...flags].some(flag => !['--docker', '--json', '--help'].includes(flag))) {
  console.error('Option inconnue. Utiliser --docker, --json ou --help.');
  process.exit(2);
}
if (flags.has('--help')) {
  console.log('npm run doctor [-- --docker] [-- --json]\nLecture des versions uniquement. --docker exige un moteur disponible.');
  process.exit(0);
}
const expected = (await readFile(new URL('../.node-version', import.meta.url), 'utf8')).trim();
const checks = [];
function add(name, status, detail) { checks.push({ name, status, detail }); }
function command(bin, args) {
  const run = spawnSync(bin, args, { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
  return run.status === 0 ? run.stdout.trim() : null;
}
const current = process.versions.node;
add('Node.js', current === expected ? 'ok' : current.split('.')[0] === expected.split('.')[0] ? 'avertissement' : 'echec',
  `Version actuelle ${current} ; version de référence ${expected}.`);
const git = command('git', ['--version']);
add('Git', git ? 'ok' : 'echec', git || 'Git absent ou inaccessible.');
const npm = command('npm', ['--version']);
add('npm', npm ? 'ok' : 'echec', npm ? `Version ${npm}.` : 'npm absent ou inaccessible.');
const docker = command('docker', ['--version']);
const compose = docker && command('docker', ['compose', 'version', '--short']);
add('Docker CLI et Compose', compose ? 'ok' : flags.has('--docker') ? 'echec' : 'information',
  compose ? `${docker} ; Compose ${compose}.` : 'Nécessaires à partir du jalon 03.');
if (flags.has('--docker')) {
  const engine = docker && command('docker', ['info', '--format', '{{.ServerVersion}}']);
  add('Moteur Docker', engine ? 'ok' : 'echec', engine ? `Version ${engine}.` : 'Moteur arrêté ou accès au socket indisponible.');
}
add('Machine', 'information', `${os.platform()} ${os.arch()} ; ${(os.totalmem()/1024**3).toFixed(1)} Gio de mémoire physique.`);
const report = { schema: 1, referenceNode: expected, ok: !checks.some(c => c.status === 'echec'), checks };
if (flags.has('--json')) console.log(JSON.stringify(report, null, 2));
else {
  for (const c of checks) console.log(`[${c.status}] ${c.name} : ${c.detail}`);
  console.log('Ce contrôle ne valide ni une installation Docker complète, ni un déploiement cloud.');
}
process.exitCode = report.ok ? 0 : 1;
