// Lecture seule : attendre PostgreSQL ou le schéma 0.2.0, sans appliquer de DDL.
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

async function main() {
  const mode = process.argv[2];
  if (!['database', 'schema'].includes(mode) || !process.env.DATABASE_URL) {
    throw new Error('Configuration du contrôle initial absente.');
  }
  // Le SQL est lu dans l'image applicative ; aucun checksum n'est recopié dans le chart.
  const expected = mode === 'schema'
    ? createHash('sha256').update(await readFile('/app/db/migrations/001_init.sql')).digest('hex')
    : null;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 2000, query_timeout: 2000, statement_timeout: 2000 });
    client.on('error', () => {});
    try {
      await client.connect();
      if (mode === 'schema') {
        const result = await client.query(
          'SELECT checksum FROM taskboard_schema_migrations WHERE version = $1', ['001_init']);
        if (result.rows.length !== 1 || result.rows[0].checksum !== expected) {
          throw new Error('Schéma attendu non disponible.');
        }
        await client.query('SELECT id, title, created_at FROM tasks LIMIT 0');
      } else {
        await client.query('SELECT 1');
      }
      console.log(JSON.stringify({ event: 'startup_ready', mode,
        message: mode === 'schema' ? 'Schéma attendu disponible.' : 'Connexion PostgreSQL disponible.' }));
      return;
    } catch {
      // Une erreur du client peut contenir l'URL : ne pas la journaliser.
    } finally {
      await client.end().catch(() => {});
    }
    await delay(1000);
  }
  throw new Error('Délai de préparation dépassé ; contrôler la base, le Secret et la migration.');
}

main().catch(() => {
  console.error(JSON.stringify({ event: 'startup_failed',
    message: 'Préparation impossible : vérifier PostgreSQL, le Secret et le Job de migration.' }));
  process.exitCode = 1;
});
