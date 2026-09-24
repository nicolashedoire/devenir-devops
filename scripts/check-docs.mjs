// Vérifie les liens vers les fichiers locaux ; aucun appel réseau.
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set(['.git', '.terraform', 'node_modules', 'preuves', 'backups', 'archive', 'work']);
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(full));
    else if (entry.name.endsWith('.md')) result.push(full);
  }
  return result;
}
const errors = [];
let checked = 0;
for (const file of await files(root)) {
  const content = (await readFile(file, 'utf8')).replace(/```[\s\S]*?```/g, '');
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split(' ')[0].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    checked++;
    try { await stat(path.resolve(path.dirname(file), decodeURIComponent(target))); }
    catch { errors.push(`${path.relative(root, file)} : ${target}`); }
  }
}
if (errors.length) {
  console.error('Liens locaux à corriger :\n'+errors.join('\n'));
  process.exitCode = 1;
} else console.log(`${checked} liens locaux vérifiés. Les ancres et les liens externes ne sont pas contrôlés.`);
