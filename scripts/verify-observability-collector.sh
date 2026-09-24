#!/usr/bin/env bash
set -euo pipefail
umask 077
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_dir"
DOCKER_BIN="${DOCKER_BIN:-docker}"
NODE_BIN="${NODE_BIN:-node}"
dc() { "$DOCKER_BIN" compose -p taskboard-observabilite -f observabilite/compose.yaml "$@"; }
if [[ ! -f observabilite/imports/tache-temoin.json ]]; then
  echo "Importer le témoin et vérifier d'abord le laboratoire d'observation." >&2
  exit 1
fi
mkdir -p observabilite/preuves
run_dir="$(mktemp -d "$repo_dir/observabilite/preuves/collector-XXXXXX")"
collect() {
  dc ps -a > "$run_dir/services.txt" 2>&1 || true
  dc logs --no-color --tail 100 collector api > "$run_dir/journaux.txt" 2>&1 || true
}
trap collect EXIT
export DOCKER_BIN
"$NODE_BIN" observabilite/verification-collector.mjs "$run_dir"
echo "Panne Collector et reprise complète vérifiées, volumes conservés. Preuves : $run_dir"
