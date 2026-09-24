import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const directory = new URL('../db/migrations/', import.meta.url);

export async function runMigrations(pool) {
  const names = (await readdir(directory)).filter(name => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
  const client = await pool.connect();
  const applied = [];
  try {
    await client.query('BEGIN');
    // Deux processus de migration ne peuvent pas modifier le schéma en parallèle.
    await client.query('SELECT pg_advisory_xact_lock($1)', [74190327]);
    await client.query(`CREATE TABLE IF NOT EXISTS taskboard_schema_migrations (
      version TEXT PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    for (const name of names) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const version = name.slice(0, -4);
      const existing = await client.query(
        'SELECT checksum FROM taskboard_schema_migrations WHERE version = $1', [version]);
      if (existing.rows.length) {
        if (existing.rows[0].checksum !== checksum) {
          throw Error('Une migration déjà appliquée a été modifiée. Créer une nouvelle migration.');
        }
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO taskboard_schema_migrations(version, checksum) VALUES ($1, $2)',
        [version, checksum]);
      applied.push(version);
    }
    await client.query('COMMIT');
    return applied;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let pool;
  try {
    if (!process.env.DATABASE_URL) {
      throw Error('DATABASE_URL est nécessaire pour appliquer les migrations.');
    }
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1,
      connectionTimeoutMillis: 3000, query_timeout: 15000, statement_timeout: 10000 });
    pool.on('error', () => {});
    const applied = await runMigrations(pool);
    console.log(JSON.stringify({ event: applied.length ? 'migration_applied' : 'migration_up_to_date',
      migrations: applied, message: applied.length ? 'Migration appliquée.' : 'Schéma déjà à jour.' }));
  } catch {
    // Ni l'URL de connexion ni le message PostgreSQL ne doivent révéler un secret.
    console.error(JSON.stringify({ event: 'migration_failed',
      message: process.env.DATABASE_URL
        ? 'Migration impossible : vérifier la connexion, les droits et les fichiers de migration.'
        : 'DATABASE_URL est nécessaire pour appliquer les migrations.' }));
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}
