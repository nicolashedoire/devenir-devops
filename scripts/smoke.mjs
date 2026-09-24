import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export async function runSmoke(baseUrl = 'http://127.0.0.1:3000') {
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw Error('Utiliser une URL HTTP(S) de base, sans identifiants, chemin ni paramètres.');
  }
  const request = async (path, expectedStatus = 200, options = {}) => {
    const response = await fetch(new URL(path, url), { ...options, redirect: 'error',
      signal: AbortSignal.timeout(5000) });
    if (response.status !== expectedStatus) {
      throw Error(`Contrôle ${path} : statut ${response.status}, attendu ${expectedStatus}.`);
    }
    return response.json();
  };
  const health = await request('/healthz');
  if (health.status !== 'alive') throw Error('Réponse de vitalité inattendue.');
  const ready = await request('/readyz');
  if (ready.status !== 'ready' || !['memory', 'postgres'].includes(ready.storage)) {
    throw Error('Réponse de disponibilité inattendue.');
  }
  const version = await request('/version');
  if (typeof version.version !== 'string' || typeof version.revision !== 'string') {
    throw Error('Version applicative absente.');
  }
  const title = `preuve-parcours-devops-${randomUUID()}`;
  const task = await request('/api/tasks', 201, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
  if (!Number.isSafeInteger(task.id) || task.id <= 0 || task.title !== title ||
      typeof task.created_at !== 'string' || Number.isNaN(Date.parse(task.created_at))) {
    throw Error('La tâche créée ne respecte pas le contrat attendu.');
  }
  const reread = await request(`/api/tasks/${task.id}`);
  if (reread.id !== task.id || reread.title !== title || reread.created_at !== task.created_at) {
    throw Error('La tâche relue diffère de la tâche créée.');
  }
  return { event: 'smoke_passed', base_url: url.origin, version: version.version,
    revision: version.revision, storage: ready.storage,
    task: { id: task.id, title: task.title, created_at: task.created_at },
    message: 'Contrôle réussi. La tâche témoin est conservée ; aucune donnée existante n’a été supprimée.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await runSmoke(process.argv[2] || process.env.TASKBOARD_URL || undefined)));
  } catch {
    console.error(JSON.stringify({ event: 'smoke_failed',
      message: 'Contrôle échoué : vérifier l’URL, la disponibilité et les journaux de TaskBoard. Une tâche témoin peut avoir été conservée.' }));
    process.exitCode = 1;
  }
}
