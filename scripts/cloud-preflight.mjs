// Lecture seule. Ce contrôle ne crée ni compte, ni ressource, ni session SSO.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--json' || key === '--help') { options[key.slice(2)] = true; continue; }
    if (!['--account', '--profile', '--region'].includes(key) || !args[i + 1] || args[i + 1].startsWith('--') || options[key.slice(2)]) throw new Error('Arguments invalides : préciser --account, --profile et --region.');
    options[key.slice(2)] = args[++i];
  }
  if (options.help) return options;
  if (!/^\d{12}$/.test(options.account || '') || /^(\d)\1{11}$/.test(options.account)) throw new Error('Fournir le numéro de compte AWS de laboratoire attendu, composé de 12 chiffres.');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(options.profile || '') || options.profile === 'default') throw new Error('Utiliser un profil de laboratoire explicitement nommé, différent de default.');
  if (!/^[a-z]{2}(-[a-z]+)+-\d$/.test(options.region || '')) throw new Error('Fournir une région AWS explicite, par exemple eu-west-3.');
  return options;
}

export function checkEnvironment(env, options) {
  const conflicting = Object.keys(env).filter(key => env[key] && (
    ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_SECURITY_TOKEN', 'AWS_ROLE_ARN', 'AWS_WEB_IDENTITY_TOKEN_FILE', 'AWS_CONTAINER_CREDENTIALS_FULL_URI', 'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI'].includes(key)
    || (key.startsWith('AWS_') && key.includes('ENDPOINT') && key !== 'AWS_IGNORE_CONFIGURED_ENDPOINT_URLS')
  ));
  if (conflicting.length) throw new Error(`Variables d’authentification ou d’endpoint concurrentes : ${conflicting.join(', ')}. Aucune valeur n’est affichée.`);
  if (env.AWS_IGNORE_CONFIGURED_ENDPOINT_URLS && env.AWS_IGNORE_CONFIGURED_ENDPOINT_URLS !== 'true') throw new Error('AWS_IGNORE_CONFIGURED_ENDPOINT_URLS doit valoir true si cette variable est définie.');
  if (Object.keys(env).some(key => env[key] && (key === 'TF_CLI_ARGS' || key.startsWith('TF_CLI_ARGS_') || ['TF_DATA_DIR', 'TF_CLI_CONFIG_FILE'].includes(key)))) throw new Error('Options ou configuration OpenTofu implicites détectées (TF_CLI_ARGS, TF_DATA_DIR ou TF_CLI_CONFIG_FILE). Utiliser un terminal de laboratoire sans ces surcharges.');
  if (env.AWS_PROFILE && env.AWS_PROFILE !== options.profile) throw new Error('AWS_PROFILE diffère du profil demandé.');
  if (env.AWS_DEFAULT_PROFILE && env.AWS_DEFAULT_PROFILE !== options.profile) throw new Error('AWS_DEFAULT_PROFILE diffère du profil demandé.');
  for (const name of ['AWS_REGION', 'AWS_DEFAULT_REGION']) if (env[name] && env[name] !== options.region) throw new Error(`${name} diffère de la région demandée.`);
  if (env.TF_WORKSPACE && env.TF_WORKSPACE !== 'default') throw new Error('Ce parcours utilise uniquement le workspace default.');
}

export function checkIdentity(identity, expectedAccount) {
  if (identity.Account !== expectedAccount) throw new Error('Compte AWS inattendu : opération refusée. Vérifier le profil et le compte de laboratoire.');
  if (!new RegExp(`^arn:aws:sts::${expectedAccount}:assumed-role/[^/]+/.+$`).test(identity.Arn || '')) throw new Error('Une session de rôle temporaire est attendue ; ne pas utiliser le compte root ou une clé IAM permanente.');
  return { account: identity.Account, temporaryRole: true };
}

export function runCheck(options, env = process.env, command = spawnSync) {
  checkEnvironment(env, options);
  const expectedVersion = readFileSync(new URL('../.tofu-version', import.meta.url), 'utf8').trim();
  const safeEnv = { ...env, AWS_PROFILE: options.profile, AWS_REGION: options.region, AWS_DEFAULT_REGION: options.region, AWS_EC2_METADATA_DISABLED: 'true', AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'true', AWS_PAGER: '', AWS_CLI_AUTO_PROMPT: 'off' };
  const invoke = (bin, args, label) => {
    const result = command(bin, args, { env: safeEnv, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
    if (result.status !== 0) throw new Error(`${label} indisponible ou refusé. Vérifier l’installation et, pour AWS, la connexion SSO au profil de laboratoire.`);
    return result.stdout.trim();
  };
  const decode = text => { try { return JSON.parse(text); } catch { throw new Error('Réponse JSON d’un outil invalide ; son contenu reste confidentiel.'); } };
  const version = decode(invoke('tofu', ['version', '-json'], 'OpenTofu')).terraform_version;
  if (version !== expectedVersion) throw new Error(`OpenTofu ${expectedVersion} requis, version reçue : ${version}.`);
  const awsVersion = invoke('aws', ['--version'], 'AWS CLI');
  if (!awsVersion.startsWith('aws-cli/2.')) throw new Error('AWS CLI version 2 requise pour ce parcours SSO.');
  const identity = decode(invoke('aws', ['sts', 'get-caller-identity', '--profile', options.profile, '--region', options.region, '--output', 'json', '--no-cli-pager'], 'Identité AWS'));
  return { ok: true, mode: 'lecture-seule', ...checkIdentity(identity, options.account), profile: options.profile, region: options.region, opentofu: version, resourceCreated: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) console.log('node scripts/cloud-preflight.mjs --account NUMERO --profile taskboard-lab --region eu-west-3 [--json]\nLecture des versions et de l’identité AWS uniquement.');
    else {
      const report = runCheck(options);
      console.log(options.json ? JSON.stringify(report, null, 2) : `Identité validée : compte ${report.account}, profil ${report.profile}, région ${report.region}, OpenTofu ${report.opentofu}. Aucune ressource créée.`);
    }
  } catch (error) {
    if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: false, error: error.message }));
    else console.error(error.message);
    process.exitCode = 1;
  }
}
