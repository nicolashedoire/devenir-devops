#!/usr/bin/env node
// Installe seulement dans work/bin ; aucun téléchargement n'est exécuté avant vérification.
import { readFile, writeFile, mkdir, chmod, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(await readFile(path.join(root, 'deploy/tools-lock.json')));
const arch = { x64: 'amd64', arm64: 'arm64' }[process.arch];
const platform = `${process.platform}-${arch}`;
if (!lock.platforms[platform]) throw new Error('Plateforme non prise en charge : Linux/macOS amd64/arm64 ; Windows via WSL2.');
const bin = path.join(root, 'work/bin');
await mkdir(bin, { recursive: true });
const tmp = await mkdtemp(path.join(root, 'work/outils-'));
try {
  for (const [name, entry] of Object.entries(lock.platforms[platform])) {
    const response = await fetch(entry.url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Téléchargement ${name} : HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(data).digest('hex') !== entry.sha256) throw new Error(`Empreinte incorrecte pour ${name}.`);
    let executable = data;
    if (name === 'helm') {
      const archive = path.join(tmp, 'helm.tar.gz');
      await writeFile(archive, data, { mode: 0o600 });
      const unpack = spawnSync('tar', ['-xOzf', archive, `${platform}/helm`], { maxBuffer: 150 * 1024 * 1024 });
      if (unpack.status !== 0) throw new Error('Extraction de Helm impossible.');
      executable = unpack.stdout;
    }
    await writeFile(path.join(bin, name), executable, { mode: 0o755 });
    await chmod(path.join(bin, name), 0o755);
    console.log(`${name} ${lock.versions[name]} vérifié et installé dans work/bin.`);
  }
} finally { await rm(tmp, { recursive: true, force: true }); }
