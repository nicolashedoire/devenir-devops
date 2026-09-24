#!/usr/bin/env bash
# Vérifie une création HTTP puis sa persistance après remplacement de l'API.
# Le projet et ses volumes sont conservés, y compris en cas d'échec.
set -euo pipefail
umask 077

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
docker_bin=${DOCKER_BIN:-docker}
port=${TASKBOARD_PORT:-3000}
case "$port" in ''|*[!0-9]*) echo 'TASKBOARD_PORT doit être un numéro de port.' >&2; exit 1;; esac
if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
  echo 'TASKBOARD_PORT doit être compris entre 1 et 65535.' >&2; exit 1
fi
command -v "$docker_bin" >/dev/null || { echo 'Docker est introuvable ; définir DOCKER_BIN si nécessaire.' >&2; exit 1; }
command -v curl >/dev/null || { echo 'curl est nécessaire.' >&2; exit 1; }
dc() { "$docker_bin" compose --project-directory "$repo_dir" -f "$repo_dir/compose.yaml" "$@"; }
base_url="http://127.0.0.1:$port"
run_id="$(date -u +%Y%m%d_%H%M%S)_$$_${RANDOM}"
proof_dir="$repo_dir/preuves/verify-compose-$run_id"
mkdir -p "$proof_dir"

on_exit() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    dc logs --no-color --tail=100 >"$proof_dir/erreur-services.log" 2>&1 || true
    echo "Échec de la vérification. Données conservées ; diagnostic : $proof_dir" >&2
  fi
}
trap on_exit EXIT

wait_ready() {
  local attempt
  for ((attempt=1; attempt<=60; attempt++)); do
    if curl --silent --show-error --fail --connect-timeout 2 --max-time 3 \
      "$base_url/readyz" >"$proof_dir/readyz.json" 2>/dev/null; then
      dc exec -T api node -e '
        const assert = require("node:assert/strict");
        const value = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
        assert.equal(value.status, "ready"); assert.equal(value.storage, "postgres");
      ' <"$proof_dir/readyz.json"
      return 0
    fi
    sleep 1
  done
  echo 'L’API PostgreSQL n’est pas devenue prête dans le délai prévu.' >&2
  return 1
}

"$docker_bin" info >/dev/null
dc config --quiet
echo 'Construction et démarrage : PostgreSQL, migration explicite, puis API.'
dc up -d --build api
wait_ready
dc logs --no-color migrate >"$proof_dir/migration.log"
dc exec -T api node --version >"$proof_dir/node-version.txt"
dc exec -T db psql -X -U taskboard -d taskboard -Atc 'SHOW server_version' >"$proof_dir/postgresql-version.txt"
"$docker_bin" version >"$proof_dir/docker-version.txt"
dc version >"$proof_dir/compose-version.txt"

witness_title="temoin-persistance-$run_id"
http_status=$(curl --silent --show-error --fail --connect-timeout 2 --max-time 10 \
  -H 'Content-Type: application/json' --data "{\"title\":\"$witness_title\"}" \
  -o "$proof_dir/tache-temoin.json" -w '%{http_code}' "$base_url/api/tasks")
if [ "$http_status" != 201 ]; then
  echo "La création doit retourner HTTP 201 ; statut obtenu : $http_status" >&2; exit 1
fi
dc exec -T api node -e '
  const assert = require("node:assert/strict");
  const task = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
  assert.equal(task.title, process.argv[1]);
  assert.ok(Number.isInteger(task.id) && task.id > 0);
  assert.ok(Number.isFinite(Date.parse(task.created_at)));
  console.log(task.id);
' "$witness_title" <"$proof_dir/tache-temoin.json" >"$proof_dir/identifiant-temoin.txt"
witness_id=$(cat "$proof_dir/identifiant-temoin.txt")
old_container=$(dc ps -q api)
printf '%s\n' "$old_container" >"$proof_dir/conteneur-avant.txt"

echo 'Remplacement du conteneur API ; la base et son volume restent en place.'
dc up -d --no-deps --force-recreate api
wait_ready
new_container=$(dc ps -q api)
printf '%s\n' "$new_container" >"$proof_dir/conteneur-apres.txt"
if [ -z "$new_container" ] || [ "$old_container" = "$new_container" ]; then
  echo 'Le conteneur API n’a pas été remplacé.' >&2; exit 1
fi
curl --silent --show-error --fail --connect-timeout 2 --max-time 10 \
  "$base_url/api/tasks/$witness_id" >"$proof_dir/tache-apres.json"
expected=$(cat "$proof_dir/tache-temoin.json")
dc exec -T api node -e '
  const assert = require("node:assert/strict");
  const expected = JSON.parse(process.argv[1]);
  const task = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
  assert.deepEqual(task, expected,
    "La tâche témoin doit conserver exactement son id, son titre et sa date.");
' "$expected" <"$proof_dir/tache-apres.json"
printf '{"resultat":"succes","stockage":"postgres","conteneur_remplace":true,"tache_identique":true}\n' >"$proof_dir/resultat.json"
dc ps -a >"$proof_dir/services.txt"
echo "Persistance vérifiée. Preuves : $proof_dir"
echo 'Les services restent disponibles. docker compose down les arrête sans supprimer le volume.'
