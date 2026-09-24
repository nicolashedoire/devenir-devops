// Installation locale uniquement : aucun changement du PATH ou des outils système.
import { readFile, mkdir, mkdtemp, writeFile, chmod, rename, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const version = (await readFile(path.join(root, '.tofu-version'), 'utf8')).trim();
// Source : manifeste SHA256SUMS officiel de la release v1.12.6, vérifié le 24/09/2026.
const hashes = {
  darwin_amd64: '166388e5feed47e107e11721b6366bf91d21e47eccbced75f3cbe0c7184ffd9b',
  darwin_arm64: 'e083ee43790ab9e19ad66d9933e24a7244a1412e1d5728f37999ae2163fdac95',
  linux_amd64: '5dc43da4f750f33873dc25e94587128709e819e544b7be9016b255316153c3a8',
  linux_arm64: 'e573979ba68a17fe7b881752051a694a7efcd970e39521f6a25775197861ed4d'
};
if (process.argv.length !== 2 || version !== '1.12.6') throw new Error('Usage : node scripts/install-tofu.mjs ; version et empreintes doivent être mises à jour ensemble.');
const target = `${process.platform}_${process.arch === 'x64' ? 'amd64' : process.arch}`;
if (!hashes[target]) throw new Error('Plateforme non prise en charge : utiliser Linux/WSL ou macOS AMD64/ARM64.');
const available = spawnSync('unzip', ['-v'], { stdio: 'ignore' });
if (available.status !== 0) throw new Error('Le programme unzip doit être installé avant cet atelier.');
const work = path.join(root, 'work');
await mkdir(work, { recursive: true });
const temporary = await mkdtemp(path.join(work, 'tofu-install-'));
try {
  const asset = `tofu_${version}_${target}.zip`;
  const response = await fetch(`https://github.com/opentofu/opentofu/releases/download/v${version}/${asset}`, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`Téléchargement impossible (HTTP ${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(buffer).digest('hex') !== hashes[target]) throw new Error('Empreinte incorrecte : aucun binaire installé.');
  const archive = path.join(temporary, asset);
  await writeFile(archive, buffer, { mode: 0o600 });
  const extract = spawnSync('unzip', ['-q', archive, 'tofu', '-d', temporary], { encoding: 'utf8' });
  if (extract.status !== 0) throw new Error('Extraction impossible.');
  const binary = path.join(temporary, 'tofu');
  await chmod(binary, 0o755);
  const check = spawnSync(binary, ['version', '-json'], { encoding: 'utf8', timeout: 15000 });
  if (check.status !== 0 || JSON.parse(check.stdout).terraform_version !== version) throw new Error('Le binaire ne rapporte pas la version attendue.');
  await mkdir(path.join(work, 'bin'), { recursive: true });
  await rename(binary, path.join(work, 'bin', 'tofu'));
  console.log(`OpenTofu ${version} installé dans work/bin/tofu ; archive vérifiée par SHA-256.`);
  console.log('Pour ce terminal : export PATH="$PWD/work/bin:$PATH"');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
