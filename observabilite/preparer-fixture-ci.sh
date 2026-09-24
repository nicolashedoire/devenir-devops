#!/usr/bin/env bash
set -euo pipefail
umask 077
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_dir"
if [[ "${CI:-}" != "true" ]]; then
  echo "Cette fixture synthétique est réservée à une exécution CI isolée." >&2
  exit 1
fi
DOCKER_BIN="${DOCKER_BIN:-docker}"
dc() { "$DOCKER_BIN" compose -p taskboard-observabilite-fixture -f observabilite/fixture.compose.yaml "$@"; }
mkdir -p observabilite/imports-ci
trap 'dc down' EXIT
"$DOCKER_BIN" compose -p taskboard-observabilite -f observabilite/compose.yaml build api
dc up -d --wait db
dc run --rm migrate
dc exec -T db psql -U taskboard -d taskboard -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
INSERT INTO tasks(title,created_at)
VALUES ('preuve-observabilite-ci','2026-01-01T00:00:00.000Z');
SQL
dc exec -T db pg_dump -U taskboard -d taskboard -Fc --no-owner --no-acl \
  > observabilite/imports-ci/taskboard.dump
dc exec -T db psql -U taskboard -d taskboard -Atqc \
  "SELECT json_build_object('id',id,'title',title,'created_at',to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) FROM tasks WHERE title='preuve-observabilite-ci'" \
  > observabilite/imports-ci/tache-temoin.json
echo "Fixture CI créée ; elle ne prouve pas la continuité des données d'un lecteur."
