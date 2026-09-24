import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOptions, checkEnvironment, checkIdentity, runCheck } from './cloud-preflight.mjs';
import { reviewPlan, parsePlanJson } from './review-cloud-plan.mjs';

const options = { account: '123456789012', profile: 'taskboard-lab', region: 'eu-west-3' };
const session = { Account: options.account, Arn: 'arn:aws:sts::123456789012:assumed-role/Laboratoire/Session' };
test('identité explicite obligatoire ; compte courant jamais adopté comme valeur attendue', () => {
  assert.throws(() => parseOptions(['--profile', 'taskboard-lab', '--region', 'eu-west-3']), /compte AWS/);
  assert.throws(() => parseOptions(['--account', options.account, '--profile', 'default', '--region', options.region]), /profil/);
  assert.throws(() => checkIdentity({ ...session, Account: '210987654321' }, options.account), /inattendu/);
  assert.throws(() => checkIdentity({ ...session, Arn: 'arn:aws:iam::123456789012:root' }, options.account), /temporaire/);
  assert.deepEqual(checkIdentity(session, options.account), { account: options.account, temporaryRole: true });
});
test('les credentials, endpoints et options implicites sont refusés sans fuite de leur valeur', () => {
  for (const name of ['AWS_ACCESS_KEY_ID', 'AWS_ENDPOINT_URL_STS', 'AWS_STS_ENDPOINT', 'AWS_S3_ENDPOINT', 'TF_CLI_ARGS_plan', 'TF_DATA_DIR']) {
    assert.throws(() => checkEnvironment({ [name]: 'VALEUR_NE_PAS_AFFICHER' }, options), error => !error.message.includes('VALEUR_NE_PAS_AFFICHER'));
  }
  assert.throws(() => checkEnvironment({ AWS_PROFILE: 'production' }, options), /diffère/);
  assert.throws(() => checkEnvironment({ TF_WORKSPACE: 'production' }, options), /workspace/);
  checkEnvironment({ AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'true' }, options);
  assert.throws(() => checkEnvironment({ AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'false' }, options), /true/);
});
test('preflight ne lance que les versions et STS, avec profil et région explicitement transmis', () => {
  const calls = [];
  const command = (binary, args, config) => {
    calls.push({ binary, args, env: config.env });
    if (binary === 'tofu') return { status: 0, stdout: '{"terraform_version":"1.12.6"}' };
    if (args[0] === '--version') return { status: 0, stdout: 'aws-cli/2.99.0 fixture-test' };
    assert.deepEqual(args.slice(0, 2), ['sts', 'get-caller-identity']);
    assert.equal(config.env.AWS_PROFILE, 'taskboard-lab');
    assert.equal(config.env.AWS_EC2_METADATA_DISABLED, 'true');
    return { status: 0, stdout: JSON.stringify(session) };
  };
  const result = runCheck(options, {}, command);
  assert.equal(result.resourceCreated, false);
  assert.equal(calls.length, 3);
  assert.throws(() => runCheck(options, { AWS_SECRET_ACCESS_KEY: 'secret-test' }, command));
  assert.equal(calls.length, 3, 'Aucun programme externe lancé si environnement ambigu');
});
test('preflight échoue si STS indisponible ou répond pour un autre compte', () => {
  for (const value of [{ status: 1, stderr: 'secret-test' }, { status: 0, stdout: JSON.stringify({ ...session, Account: '210987654321' }) }]) {
    const command = (binary, args) => binary === 'tofu' ? { status: 0, stdout: '{"terraform_version":"1.12.6"}' } : args[0] === '--version' ? { status: 0, stdout: 'aws-cli/2.1.0' } : value;
    assert.throws(() => runCheck(options, {}, command), error => !error.message.includes('secret-test'));
  }
});

const bootstrapTypes = ['aws_s3_bucket', 'aws_s3_bucket_ownership_controls', 'aws_s3_bucket_public_access_block', 'aws_s3_bucket_versioning', 'aws_s3_bucket_server_side_encryption_configuration', 'aws_s3_bucket_policy'];
function plan(actions = ['create']) {
  return { format_version: '1.2', terraform_version: '1.12.6', resource_changes: bootstrapTypes.map(type => ({
    mode: 'managed', address: `${type}.${type === 'aws_s3_bucket_policy' ? 'tls' : 'state'}`, type,
    provider_name: 'registry.opentofu.org/hashicorp/aws',
    change: { actions, after: { secret: 'NE_PAS_PUBLIER', arn: 'IDENTIFIANT_PRIVE' } }
  })) };
}
test('résumé du plan ne publie ni valeurs, ni identifiants, ni variables', () => {
  assert.throws(() => parsePlanJson('{"password":NE_PAS_PUBLIER}'), error => !error.message.includes('NE_PAS_PUBLIER') && /invalide/.test(error.message));
  const result = reviewPlan(plan(), 'bootstrap-state', 'create');
  assert.equal(result.counts.create, 6);
  assert.ok(!JSON.stringify(result).includes('NE_PAS_PUBLIER'));
  assert.ok(!JSON.stringify(result).includes('IDENTIFIANT_PRIVE'));
});
test('refus d’un calcul payant ajouté, d’un remplacement et d’un plan partiel', () => {
  const extra = plan();
  extra.resource_changes.push({ mode: 'managed', address: 'aws_instance.surprise', type: 'aws_instance', change: { actions: ['create'] } });
  assert.throws(() => reviewPlan(extra, 'bootstrap-state', 'create'), /inattendue/);
  assert.throws(() => reviewPlan(plan(['delete', 'create']), 'bootstrap-state', 'reconcile'), /Remplacement/);
  const partial = plan(); partial.resource_changes.pop();
  assert.throws(() => reviewPlan(partial, 'bootstrap-state', 'create'), /incomplet/);
  assert.throws(() => reviewPlan({ ...plan(), complete: false }, 'bootstrap-state', 'create'), /incomplet/);
});
test('le retrait reste borné aux fondations et accepte la reprise d’une création incomplète', () => {
  assert.throws(() => reviewPlan(plan(['delete']), 'bootstrap-state', 'destroy'), /jamais/);
  const removal = { format_version: '1.2', terraform_version: '1.12.6', resource_changes: [{ mode: 'managed', address: 'aws_vpc.main', type: 'aws_vpc', provider_name: 'registry.opentofu.org/hashicorp/aws', change: { actions: ['delete'] } }] };
  assert.equal(reviewPlan(removal, 'foundations', 'destroy').counts.delete, 1);
  removal.resource_changes[0].change.actions = ['update'];
  assert.throws(() => reviewPlan(removal, 'foundations', 'destroy'), /modification/);
});
test('les imports et déplacements nécessitent une revue hors atelier', () => {
  const imported = plan(); imported.resource_changes[0].change.importing = { id: 'existant' };
  assert.throws(() => reviewPlan(imported, 'bootstrap-state', 'create'), /import/);
  const moved = plan(); moved.resource_changes[0].previous_address = 'aws_s3_bucket.autre';
  assert.throws(() => reviewPlan(moved, 'bootstrap-state', 'create'), /import/);
});
