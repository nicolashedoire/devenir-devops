import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Branche de vérification du lecteur : maintenance TLS après l'initialisation.
await exec(process.execPath, ['scripts/verify-tls-renewal.mjs'], {
  cwd: repo, timeout: 600000, maxBuffer: 2 * 1024 * 1024
});
const results = [];
const started = new Date().toISOString();
let status = 'succes';
for (const step of ['verify', 'rotate', 'probe', 'restore', 'incident']) {
  console.log(`Recette locale : ${step}.`);
  const before = new Set(await readdir(path.join(repo, 'preuves')));
  try {
    await exec(process.execPath, ['operations/lab.mjs', step], { cwd: repo,
      timeout: 600000, maxBuffer: 1024 * 1024 });
    const proofs = (await readdir(path.join(repo, 'preuves')))
      .filter(name => !before.has(name) && name.startsWith('operations-'));
    if (proofs.length !== 1) throw Error('Preuve absente ou ambiguë.');
    results.push({ step, result: 'succes', preuve: `preuves/${proofs[0]}/resultat.json` });
  } catch {
    results.push({ step, result: 'echec', diagnostic: `Rejouer node operations/lab.mjs ${step} ; données conservées.` });
    status = 'echec'; break;
  }
}
const dir = path.join(repo, 'preuves', `recette-locale-${Date.now()}`);
await mkdir(dir, { recursive: true, mode: 0o700 });
const report = { started, ended: new Date().toISOString(), result: status, cible: 'taskboard-operations',
  public_exposure_authorized: false, scope: 'Recette HTTPS locale, jeton de groupe, PostgreSQL mono-instance ; aucune validation AWS ou haute disponibilité.', results };
await writeFile(path.join(dir, 'resultat.json'), JSON.stringify(report, null, 2)+'\n', { mode: 0o600 });
console.log(JSON.stringify({ resultat: status, preuve: path.relative(repo, dir), ...report }, null, 2));
if (status !== 'succes') process.exitCode = 1;
