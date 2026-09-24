import { readFile, mkdir, writeFile, realpath, stat, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export async function boundedJSON(root, relative, limit = 16384) {
  const expected = resolve(root, relative);
  const canonicalRoot = await realpath(root);
  const canonical = await realpath(expected);
  if (canonical !== expected || !canonical.startsWith(canonicalRoot + '/')) throw new Error('Chemin de preuve refusé.');
  const handle = await open(canonical, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size > limit) throw new Error('Preuve trop volumineuse ou non régulière.');
    const buffer = Buffer.alloc(limit + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > limit) throw new Error('Preuve trop volumineuse.');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytesRead)));
  } finally { await handle.close(); }
}
export async function catalogue(root = ROOT) {
  const raw = await boundedJSON(root, 'platform/catalogue.json');
  if (raw.offer_id !== 'taskboard-local' || !/^ghcr\.io\/nicolashedoire\/devenir-devops@sha256:[a-f0-9]{64}$/.test(raw.allowed_image)) throw new Error('Catalogue incompatible.');
  return Object.fromEntries(['schema_version', 'template_version', 'offer_id', 'description', 'scope', 'allowed_image', 'allowed_port_min', 'allowed_port_max', 'cpu_limit', 'memory_limit', 'requires_existing_witness', 'starts_services'].map(k => [k, raw[k]]));
}
export async function witness(root = ROOT) {
  const raw = await boundedJSON(root, 'preuves/tache-temoin.json');
  if (!Number.isSafeInteger(raw.id) || raw.id < 1 || typeof raw.title !== 'string' || [...raw.title].length > 200 || !raw.title.trim() || typeof raw.created_at !== 'string' || !Number.isFinite(Date.parse(raw.created_at))) throw new Error('Témoin absent ou invalide.');
  return { task_id: raw.id, created_at: raw.created_at, title_sha256: createHash('sha256').update(raw.title).digest('hex') };
}
export async function generate(options, root = ROOT) {
  const offer = await catalogue(root);
  if (!options || Object.keys(options).some(k => !['name', 'owner', 'port', 'image'].includes(k))) throw new Error('Paramètre hors contrat.');
  for (const key of ['name', 'owner']) if (typeof options[key] !== 'string' || !/^[a-z][a-z0-9-]{2,31}$/.test(options[key])) throw new Error(`${key} : alias de 3 à 32 caractères minuscules, chiffres ou tirets requis.`);
  const port = Number(options.port);
  if (!Number.isInteger(port) || port < 3400 || port > 3499) throw new Error('Port de laboratoire attendu entre 3400 et 3499.');
  const image = options.image ?? offer.allowed_image;
  if (image !== offer.allowed_image) throw new Error('Image hors du catalogue autorisé.');
  const before = await witness(root);
  const parent = join(root, 'work/platform');
  await mkdir(parent, { recursive: true, mode: 0o700 });
  if (await realpath(parent) !== parent) throw new Error('Répertoire de sortie symbolique refusé.');
  const dir = join(parent, options.name);
  // mkdir sans recursive refuse une demande existante : aucun écrasement.
  await mkdir(dir, { mode: 0o700 });
  const contract = { schema_version: 1, template_version: offer.template_version, offer_id: offer.offer_id, name: options.name, owner: options.owner, scope: 'laboratoire-local', image, port, witness: before, generated_at: new Date().toISOString(), starts_services: false };
  const compose = `# Modèle local : à combiner avec compose.yaml à la racine.\nservices:\n  migrate:\n    image: ${image}\n  api:\n    image: ${image}\n    cpus: 1\n    mem_limit: 256m\n`;
  await writeFile(join(dir, 'contrat.json'), JSON.stringify(contract, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await writeFile(join(dir, 'compose.yaml'), compose, { mode: 0o600, flag: 'wx' });
  return { event: 'platform_generated', directory: `work/platform/${options.name}`, contract, command: `TASKBOARD_PORT=${port} docker compose -f compose.yaml -f work/platform/${options.name}/compose.yaml up -d --no-build`, message: 'Offre générée. Aucun service démarré ; relisez le contrat et la configuration avant livraison.' };
}
