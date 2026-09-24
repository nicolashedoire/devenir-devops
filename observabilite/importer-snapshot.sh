#!/usr/bin/env bash
set -euo pipefail
umask 077
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_dir"
DOCKER_BIN="${DOCKER_BIN:-docker}"
NODE_BIN="${NODE_BIN:-node}"
dc() { "$DOCKER_BIN" compose -p taskboard-observabilite -f observabilite/compose.yaml "$@"; }
if [[ $# -ne 2 || ! -r "$1" || ! -r "$2" ]]; then
  echo "Usage : bash observabilite/importer-snapshot.sh sauvegarde.dump tache-temoin.json" >&2
  exit 1
fi
dump_file="$1"
witness_file="$2"
witness_id="$("$NODE_BIN" --input-type=module - "$witness_file" <<'NODE'
import { readFile } from 'node:fs/promises';
const task = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (!Number.isSafeInteger(task.id) || task.id < 1 || task.id > 2147483647
    || typeof task.title !== 'string' || typeof task.created_at !== 'string'
    || !Number.isFinite(Date.parse(task.created_at))) throw Error('Témoin invalide.');
console.log(task.id);
NODE
)"
echo "Démarrage de la seule base du laboratoire d'observabilité."
dc up -d --wait db
present="$(dc exec -T db psql -U taskboard -d taskboard -Atqc "SELECT to_regclass('public.tasks') IS NOT NULL")"
if [[ "$present" != "f" ]]; then
  echo "Import refusé : cette copie contient déjà des données. Elles sont conservées." >&2
  echo "Utiliser la vérification du laboratoire existant ; aucun volume n'est supprimé." >&2
  exit 1
fi
dc exec -T db pg_restore --list < "$dump_file" >/dev/null
echo "Restauration transactionnelle dans la copie isolée ; la source reste inchangée."
dc exec -T db pg_restore -U taskboard -d taskboard \
  --no-owner --no-acl --exit-on-error --single-transaction < "$dump_file"
dc exec -T db psql -U taskboard -d taskboard -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lab_reader') THEN
    CREATE ROLE lab_reader LOGIN PASSWORD 'lab-observation-public';
  END IF;
END $$;
GRANT CONNECT ON DATABASE taskboard TO lab_reader;
GRANT USAGE ON SCHEMA public TO lab_reader;
GRANT SELECT ON public.tasks, public.taskboard_schema_migrations TO lab_reader;
ALTER ROLE lab_reader SET default_transaction_read_only = on;
SQL
mkdir -p observabilite/imports
dc exec -T db psql -U taskboard -d taskboard -Atqc \
  "SELECT json_build_object('id',id,'title',title,'created_at',to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) FROM tasks WHERE id=$witness_id" \
  > observabilite/imports/tache-restauree.json
dc exec -T db psql -U taskboard -d taskboard -Atqc \
  "SELECT json_build_object('version',current_setting('server_version_num'),'checksum',(SELECT checksum FROM taskboard_schema_migrations WHERE version='001_init'),'nombre_taches',(SELECT count(*) FROM tasks),'ecriture_autorisee',has_table_privilege('lab_reader','tasks','INSERT'))" \
  > observabilite/imports/base.json
"$NODE_BIN" --input-type=module - "$witness_file" "$dump_file" <<'NODE'
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const expected = JSON.parse(await readFile(process.argv[2], 'utf8'));
const actual = JSON.parse(await readFile('observabilite/imports/tache-restauree.json', 'utf8'));
assert.deepEqual(actual, expected, 'Le témoin restauré doit être identique à celui du parcours.');
const base = JSON.parse(await readFile('observabilite/imports/base.json', 'utf8'));
assert.ok(Number(base.version) >= 170000 && Number(base.version) < 180000, 'PostgreSQL 17 requis.');
const sqlHash = createHash('sha256').update(await readFile('db/migrations/001_init.sql')).digest('hex');
assert.equal(base.checksum, sqlHash, 'Le schéma restauré doit correspondre à la migration du dépôt.');
assert.equal(base.ecriture_autorisee, false, 'Le lecteur du laboratoire ne doit pas pouvoir insérer.');
await writeFile('observabilite/imports/tache-temoin.json', JSON.stringify(expected, null, 2) + '\n', {mode:0o600});
const dumpHash = createHash('sha256').update(await readFile(process.argv[3])).digest('hex');
await writeFile('observabilite/imports/resultat.json', JSON.stringify({
  date:new Date().toISOString(), statut:'valide', projet:'taskboard-observabilite',
  import:'copie pédagogique, source conservée et autoritative', dump_sha256:dumpHash,
  temoin_identique:true, temoin_id:actual.id, ...base
}, null, 2) + '\n', {mode:0o600});
console.log('Copie vérifiée : témoin identique, migration identique, PostgreSQL 17, rôle en lecture seule.');
NODE
echo "Preuve locale : observabilite/imports/resultat.json"
echo "Aucune bascule : la source du parcours reste autoritative."
