import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const work = path.join(root, 'work/kubernetes');
export const env = { ...process.env, KUBECONFIG: path.join(root, 'work/kubeconfig-taskboard-lab'), PATH: `${path.join(root, 'work/bin')}:${process.env.PATH}` };
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, timeout: 900_000, ...options });
  if (result.error || result.status !== 0) {
    // Les données d'entrée et les secrets ne figurent jamais dans l'erreur.
    throw new Error(`${command} ${args.slice(0, 2).join(' ')} a échoué : ${result.error?.message || result.stderr || result.stdout}`);
  }
  return result.stdout;
}
export const kube = (...args) => run('kubectl', args);
export function guard() {
  if (kube('config', 'current-context').trim() !== 'kind-taskboard-lab') throw new Error('Ce programme accepte uniquement le contexte kind-taskboard-lab.');
  const config = JSON.parse(kube('config', 'view', '--minify', '-o', 'json'));
  const server = new URL(config.clusters[0].cluster.server);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(server.hostname)) throw new Error('Le serveur Kubernetes doit être local.');
}
export function namespace(value) {
  if (!['taskboard-lab', 'taskboard-recette', 'taskboard-production'].includes(value)) throw new Error('Namespace de laboratoire refusé.');
  return value;
}
