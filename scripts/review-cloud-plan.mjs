// Lecture locale du JSON d'un plan. Ce filtre n'est pas un moteur IAM ou un audit de sécurité.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const foundationAddresses = [
  'aws_vpc.main', 'aws_internet_gateway.public', 'aws_route_table.public',
  'aws_default_route_table.closed', 'aws_default_security_group.closed',
  'aws_security_group.app', 'aws_security_group.database',
  'aws_vpc_security_group_ingress_rule.database_from_app',
  'aws_vpc_security_group_egress_rule.app_to_database', 'aws_db_subnet_group.private',
  ...['aws_subnet.public', 'aws_subnet.private', 'aws_route_table.private', 'aws_route_table_association.public', 'aws_route_table_association.private']
    .flatMap(address => ['0', '1'].map(index => `${address}["${index}"]`))
];
const bootstrapAddresses = [
  'aws_s3_bucket.state', 'aws_s3_bucket_ownership_controls.state', 'aws_s3_bucket_public_access_block.state',
  'aws_s3_bucket_versioning.state', 'aws_s3_bucket_server_side_encryption_configuration.state', 'aws_s3_bucket_policy.tls'
];

export function parsePlanJson(text) {
  try { return JSON.parse(text); }
  catch { throw new Error('JSON du plan invalide ; son contenu reste confidentiel.'); }
}

export function reviewPlan(plan, module, intent) {
  if (!['foundations', 'bootstrap-state'].includes(module) || !['create', 'reconcile', 'destroy'].includes(intent)) throw new Error('Module ou intention inconnus.');
  if (module === 'bootstrap-state' && intent === 'destroy') throw new Error('Ce parcours ne détruit jamais automatiquement le stockage des états.');
  if (!plan || typeof plan !== 'object' || !/^1\./.test(plan.format_version || '') || typeof plan.terraform_version !== 'string') throw new Error('Format invalide : fournir le JSON produit par tofu show -json sur un plan enregistré.');
  if (plan.errored === true || plan.complete === false) throw new Error('Plan incomplet ou en erreur : ne pas appliquer.');
  const expected = new Set(module === 'foundations' ? foundationAddresses : bootstrapAddresses);
  const seen = new Set();
  const resources = [];
  const counts = { create: 0, update: 0, delete: 0, 'no-op': 0 };
  if (plan.resource_changes !== undefined && !Array.isArray(plan.resource_changes)) throw new Error('La liste des changements est invalide.');
  for (const item of plan.resource_changes || []) {
    if (item.mode === 'data') continue;
    if (item.mode !== 'managed' || !expected.has(item.address) || item.type !== item.address.split('.')[0]) throw new Error('Ressource inattendue dans ce plan : vérifier le répertoire et le périmètre.');
    if (seen.has(item.address)) throw new Error('Adresse de ressource dupliquée dans le plan.');
    seen.add(item.address);
    if (!['registry.opentofu.org/hashicorp/aws', 'registry.terraform.io/hashicorp/aws'].includes(item.provider_name)) throw new Error('Fournisseur inattendu dans le plan.');
    if (item.previous_address || item.change?.importing) throw new Error('Déplacement ou import : revue indépendante nécessaire, hors de cet atelier.');
    const actions = item.change?.actions;
    if (!Array.isArray(actions) || actions.length !== 1 || !Object.hasOwn(counts, actions[0])) throw new Error('Remplacement ou action inconnue : ne pas appliquer dans ce parcours.');
    const action = actions[0];
    if (intent === 'create' && !['create', 'no-op'].includes(action)) throw new Error('Le plan de création modifierait ou supprimerait une ressource existante.');
    if (intent === 'reconcile' && action === 'delete') throw new Error('Suppression refusée pendant une remise en conformité.');
    if (intent === 'destroy' && !['delete', 'no-op'].includes(action)) throw new Error('Le plan de retrait contient une création ou une modification.');
    counts[action]++;
    resources.push({ address: item.address, action });
  }
  if (intent !== 'destroy' && seen.size !== expected.size) throw new Error('Inventaire incomplet : refuser les plans ciblés ou exécutés depuis une autre configuration.');
  // Aucun identifiant réel, attribut avant/après ou valeur de variable n'est exposé.
  return { ok: true, module, intent, resources, counts, limitations: 'Inventaire et actions seulement ; relire le plan texte, l’identité, les valeurs et le backend avant application.' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 5 || args[0] !== '--module' || args[2] !== '--intent') throw new Error('Usage : node scripts/review-cloud-plan.mjs --module foundations|bootstrap-state --intent create|reconcile|destroy chemin/plan.json');
    const report = reviewPlan(parsePlanJson(readFileSync(args[4], 'utf8')), args[1], args[3]);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) { console.error(`Plan refusé : ${error.message}`); process.exitCode = 1; }
}
