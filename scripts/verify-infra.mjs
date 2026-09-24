// Tests isolés : seuls les providers sont téléchargés ; aucune identité AWS utilisable.
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, cp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { reviewPlan } from './review-cloud-plan.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(AWS_|TF_VAR_|TF_CLI_ARGS|TF_WORKSPACE|TF_DATA_DIR|TF_CLI_CONFIG_FILE|TF_PLUGIN_CACHE_DIR)/.test(key)));
Object.assign(env, { AWS_CONFIG_FILE: '/dev/null', AWS_SHARED_CREDENTIALS_FILE: '/dev/null', AWS_EC2_METADATA_DISABLED: 'true', AWS_REGION: 'eu-west-3', TF_INPUT: '0', TF_IN_AUTOMATION: '1' });
await mkdir(path.join(root, 'work'), { recursive: true });
const workspace = await mkdtemp(path.join(root, 'work', 'verification-infra-'));
const cliConfig = path.join(workspace, 'tofurc');
await writeFile(cliConfig, 'provider_installation { direct {} }\n', { mode: 0o600 });
env.TF_CLI_CONFIG_FILE = cliConfig;
env.TF_PLUGIN_CACHE_DIR = path.join(root, 'work', 'provider-cache');
await mkdir(env.TF_PLUGIN_CACHE_DIR, { recursive: true });
const identifier = path.basename(workspace);
const proofDir = path.join(root, 'preuves', identifier);
await mkdir(proofDir, { recursive: true, mode: 0o700 });
const report = { schema: 1, awsExecuted: false, accountCredentialsDisabled: true, opentofu: null, checks: [], temporaryDirectory: path.relative(root, workspace) };
let log = '';
function run(args, cwd, statuses = [0]) {
  const result = spawnSync('tofu', args, { cwd, env, encoding: 'utf8', timeout: 300000, maxBuffer: 20 * 1024 * 1024 });
  log += `\n> tofu ${args.join(' ')}\n${result.stdout || ''}${result.stderr || ''}`;
  if (!statuses.includes(result.status)) throw new Error(`Échec de tofu ${args[0]} (code ${result.status ?? 'indisponible'}). Consulter ${path.relative(root, proofDir)}/opentofu.log.`);
  return result;
}
function record(name) { report.checks.push({ name, ok: true }); console.log(`[réussi] ${name}`); }
try {
  const expected = (await readFile(path.join(root, '.tofu-version'), 'utf8')).trim();
  report.opentofu = JSON.parse(run(['version', '-json'], root).stdout).terraform_version;
  if (report.opentofu !== expected) throw new Error(`OpenTofu ${expected} requis. Ajouter work/bin à PATH après installation.`);
  run(['fmt', '-check', '-recursive', 'infra'], root);
  record('Formatage de toutes les configurations');
  for (const module of ['repetition', 'bootstrap-state', 'foundations']) {
    const copy = path.join(workspace, module);
    await cp(path.join(root, 'infra', module), copy, {
      recursive: true,
      filter: source => {
        const name = path.basename(source);
        return !['.terraform', 'run', 'backend.hcl', 'terraform.tfvars', 'terraform.tfvars.json'].includes(name)
          && !name.endsWith('.auto.tfvars') && !name.endsWith('.auto.tfvars.json')
          && !name.includes('.tfstate') && !name.endsWith('.tfplan');
      }
    });
    run(['init', '-backend=false', '-input=false', '-lockfile=readonly', '-no-color'], copy);
    run(['validate', '-no-color'], copy);
    if (module === 'repetition') run(['test', '-no-color'], copy);
    else {
      const result = run(['test', '-json', '-verbose'], copy);
      const events = result.stdout.trim().split('\n').map(line => JSON.parse(line));
      const firstPlan = events.find(event => event.type === 'test_plan' && !event.test_plan.errored)?.test_plan;
      if (!firstPlan) throw new Error(`Aucun plan simulé exploitable pour ${module}.`);
      const review = reviewPlan(firstPlan, module, 'create');
      const expectedCount = module === 'bootstrap-state' ? 6 : 20;
      if (review.counts.create !== expectedCount) throw new Error(`Inventaire de création incomplet pour ${module}.`);
      await writeFile(path.join(proofDir, `${module}-inventaire.json`), JSON.stringify(review, null, 2) + '\n', { mode: 0o600 });
      record(`${module} : ${expectedCount} ressources dans le plan simulé contrôlées par le lecteur de plans`);
    }
    record(`${module} : configuration et tests ${module === 'repetition' ? 'du fichier local' : 'avec fournisseur AWS simulé'}`);
  }
  const local = path.join(workspace, 'repetition');
  // Les apply automatiques de ce fichier portent EXCLUSIVEMENT sur local_file.
  run(['plan', '-input=false', '-out=creation.tfplan', '-no-color'], local);
  run(['apply', '-input=false', '-no-color', 'creation.tfplan'], local);
  const artifact = path.join(local, 'run', 'environnement.json');
  const before = await readFile(artifact, 'utf8');
  const original = JSON.parse(before);
  if (original.scope !== 'repetition-locale-sans-aws') throw new Error('Le fichier local n’annonce pas le périmètre prévu.');
  run(['plan', '-detailed-exitcode', '-input=false', '-no-color'], local);
  record('Création locale puis convergence sans changement');
  await writeFile(artifact, JSON.stringify({ ...original, owner: 'modification-hors-code' }) + '\n', { mode: 0o600 });
  run(['plan', '-detailed-exitcode', '-input=false', '-out=derive.tfplan', '-no-color'], local, [2]);
  record('Dérive locale détectée : plan de sortie 2');
  run(['apply', '-input=false', '-no-color', 'derive.tfplan'], local);
  if (await readFile(artifact, 'utf8') !== before) throw new Error('La convergence ne rétablit pas exactement le contenu initial.');
  run(['plan', '-detailed-exitcode', '-input=false', '-no-color'], local);
  record('Contenu rétabli à l’identique et plan sans changement');
  run(['plan', '-destroy', '-input=false', '-out=retrait.tfplan', '-no-color'], local);
  run(['apply', '-input=false', '-no-color', 'retrait.tfplan'], local);
  try { await stat(artifact); throw new Error('Le fichier de répétition existe encore après retrait.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const list = run(['state', 'list'], local).stdout.trim();
  if (list) throw new Error('L’état local contient encore une ressource.');
  record('Retrait du seul fichier de répétition ; état local vide');
  report.ok = true;
  console.log('Aucune ressource AWS créée. Les fichiers et états du lecteur sont restés inchangés.');
} catch (error) {
  report.ok = false;
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (report.ok) { await rm(workspace, { recursive: true, force: true }); report.temporaryDirectoryRemoved = true; }
  await writeFile(path.join(proofDir, 'resultat.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  await writeFile(path.join(proofDir, 'opentofu.log'), log, { mode: 0o600 });
  console.log(`Preuves : ${path.relative(root, proofDir)}/resultat.json`);
}
