import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMigrations } from '../scripts/migrate.mjs';

// Double du client SQL : les essais Compose vérifient séparément le vrai PostgreSQL.
function database({ failSchema=false, corruptChecksum=false }={}) {
  const registry=new Map();const calls=[];let releases=0;
  return {registry,calls,get releases(){return releases;},async connect(){return {
    release(){releases++;},async query(sql,params){
      calls.push({sql,params});
      if (sql.startsWith('SELECT checksum')) {
        const value=registry.get(params[0]);
        return {rows:value ? [{checksum:corruptChecksum ? '0'.repeat(64) : value}] : []};
      }
      if (sql.startsWith('INSERT INTO taskboard_schema_migrations')) registry.set(params[0],params[1]);
      if (failSchema && sql.includes('CREATE TABLE IF NOT EXISTS tasks (')) throw Error('panne SQL simulée');
      return {rows:[]};
    }
  };}};
}

test('une migration est transactionnelle, verrouillée et idempotente', async()=>{
  const db=database();
  assert.deepEqual(await runMigrations(db),['001_init']);
  assert.deepEqual(await runMigrations(db),[]);
  assert.equal(db.calls.filter(call=>call.sql.includes('CREATE TABLE IF NOT EXISTS tasks (')).length,1);
  assert.equal(db.calls[0].sql,'BEGIN');
  assert.match(db.calls[1].sql,/pg_advisory_xact_lock/);
  assert.equal(db.calls.at(-1).sql,'COMMIT');
  assert.equal(db.releases,2);
});

test('un échec SQL déclenche le rollback et libère le client', async()=>{
  const db=database({failSchema:true});
  await assert.rejects(runMigrations(db),/panne SQL simulée/);
  assert.equal(db.calls.at(-1).sql,'ROLLBACK');
  assert.equal(db.registry.size,0);
  assert.equal(db.releases,1);
});

test('une migration appliquée dont le contenu diffère ne peut pas être réécrite', async()=>{
  const db=database({corruptChecksum:true});
  await runMigrations(db);
  await assert.rejects(runMigrations(db),/déjà appliquée/);
  assert.equal(db.calls.at(-1).sql,'ROLLBACK');
  assert.equal(db.releases,2);
});
