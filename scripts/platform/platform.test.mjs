import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, generate } from './lib.mjs';
async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'taskboard-platform-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'platform')); await cp(join(ROOT, 'platform/catalogue.json'), join(root, 'platform/catalogue.json'));
  await mkdir(join(root, 'preuves'));
  await writeFile(join(root, 'preuves/tache-temoin.json'), JSON.stringify({ id: 42, title: 'preuve-parcours-devops', created_at: '2026-09-24T10:00:00.000Z' }));
  return root;
}
test('Offre générée : même image pour API/migration, témoin préservé, pas de démarrage', async t => {
  const root = await fixture(t), before = await readFile(join(root, 'preuves/tache-temoin.json'), 'utf8');
  const result = await generate({ name: 'equipe-demo', owner: 'apprenant', port: '3400' }, root);
  assert.equal(result.contract.witness.task_id, 42); assert.equal(result.contract.starts_services, false);
  assert.match(result.command, /^TASKBOARD_PORT=3400 docker compose -f compose.yaml -f work\/platform\/equipe-demo\/compose.yaml up -d --no-build$/);
  const yaml = await readFile(join(root, result.directory, 'compose.yaml'), 'utf8');
  assert.equal(yaml.match(/@sha256:/g).length, 2); assert.doesNotMatch(yaml, /ports:|volumes:|db:|privileged:/);
  assert.equal(await readFile(join(root, 'preuves/tache-temoin.json'), 'utf8'), before);
});
test('Refuser propriétaire absent, port interdit, traversée, image hors catalogue et paramètre inconnu', async t => {
  const root = await fixture(t), base = { name: 'equipe-demo', owner: 'apprenant', port: 3400 };
  for (const options of [{ ...base, owner: undefined }, { ...base, port: 80 }, { ...base, name: '../../sortie' }, { ...base, image: 'nginx:latest' }, { ...base, shell: 'echo secret' }]) await assert.rejects(generate(options, root));
});
test('Refuser écrasement du service et témoin manquant', async t => {
  const root = await fixture(t), options = { name: 'equipe-demo', owner: 'apprenant', port: 3400 };
  await generate(options, root); await assert.rejects(generate(options, root), /EEXIST/);
  await rm(join(root, 'preuves/tache-temoin.json'));
  await assert.rejects(generate({ ...options, name: 'autre-equipe' }, root));
});
