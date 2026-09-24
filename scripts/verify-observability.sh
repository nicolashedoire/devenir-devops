#!/usr/bin/env bash
set -euo pipefail
umask 077
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_dir"
DOCKER_BIN="${DOCKER_BIN:-docker}"
NODE_BIN="${NODE_BIN:-node}"
dc() { "$DOCKER_BIN" compose -p taskboard-observabilite -f observabilite/compose.yaml "$@"; }
if [[ ! -f observabilite/imports/tache-temoin.json ]]; then
  echo "Importer et vérifier d'abord le snapshot du parcours avec observabilite/importer-snapshot.sh." >&2
  exit 1
fi
dc config --quiet
dc build api
dc up -d
mkdir -p observabilite/preuves
run_dir="$(mktemp -d "$repo_dir/observabilite/preuves/verification-XXXXXX")"
collect() {
  dc ps -a > "$run_dir/services.txt" 2>&1 || true
  dc logs --no-color --tail 200 > "$run_dir/journaux.txt" 2>&1 || true
}
trap collect EXIT
echo "Vérification des signaux ; le trafic de lecture dure environ 90 secondes."
"$NODE_BIN" observabilite/verifier.mjs "$run_dir"
dc exec -T prometheus promtool check rules /etc/prometheus/alertes.yaml > "$run_dir/regles.txt"
echo "Preuves enregistrées dans $run_dir"
echo "Les services restent disponibles. Arrêt sans effacer les données :"
echo "docker compose -p taskboard-observabilite -f observabilite/compose.yaml down"
