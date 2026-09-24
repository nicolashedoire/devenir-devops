#!/usr/bin/env bash
# Sauvegarde puis restauration dans une NOUVELLE base de laboratoire.
# Ne supprime ni base, ni volume. L'API est brièvement arrêtée pour figer les tâches.
set -euo pipefail
umask 077

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
docker_bin=${DOCKER_BIN:-docker}
command -v "$docker_bin" >/dev/null || { echo 'Docker est introuvable ; définir DOCKER_BIN si nécessaire.' >&2; exit 1; }
dc() { "$docker_bin" compose --project-directory "$repo_dir" -f "$repo_dir/compose.yaml" "$@"; }
run_id="$(date -u +%Y%m%d_%H%M%S)_$$_${RANDOM}"
proof_dir="$repo_dir/backups/$run_id"
restore_db="taskboard_restore_$run_id"
mkdir -p "$proof_dir"
resume_api=0

on_exit() {
  local status=$?
  if [ "$resume_api" -eq 1 ]; then
    echo 'Reprise de l’API précédemment active.'
    if ! dc start api; then
      echo 'La reprise a échoué. Relancer manuellement : docker compose start api' >&2
      status=1
    fi
  fi
  if [ "$status" -ne 0 ]; then
    echo "Échec : les données, la sauvegarde éventuelle et la base de restauration sont conservées. Dossier : $proof_dir" >&2
  fi
  exit "$status"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

"$docker_bin" info >/dev/null
dc config --quiet
dc exec -T db pg_isready -U taskboard -d taskboard >/dev/null
echo 'Ne pas écrire directement dans PostgreSQL pendant cette vérification.'
if [ -n "$(dc ps --status running -q api)" ]; then
  resume_api=1
  echo 'Pause de l’API : aucune tâche ne doit changer pendant la sauvegarde.'
  dc stop -t 15 api
fi

source_count=$(dc exec -T db psql -X -v ON_ERROR_STOP=1 -U taskboard -d taskboard -Atc 'SELECT count(*) FROM tasks')
case "$source_count" in ''|*[!0-9]*) echo 'Comptage source invalide.' >&2; exit 1;; esac
if [ "$source_count" -eq 0 ]; then
  echo 'Créer au moins une tâche témoin avant de vérifier la restauration.' >&2; exit 1
fi
printf '%s\n' "$source_count" >"$proof_dir/nombre-source.txt"
dc exec -T -e 'PGOPTIONS=-c timezone=UTC' db psql -X -v ON_ERROR_STOP=1 -U taskboard -d taskboard \
  -c 'COPY (SELECT id, title, created_at FROM tasks ORDER BY id) TO STDOUT WITH (FORMAT csv, HEADER true)' \
  >"$proof_dir/taches-source.csv"
dc exec -T db psql -X -v ON_ERROR_STOP=1 -U taskboard -d taskboard -Atc \
  'SELECT last_value, is_called FROM tasks_id_seq' >"$proof_dir/sequence-source.txt"
echo 'Création de la sauvegarde complète au format PostgreSQL personnalisé.'
dc exec -T db pg_dump -U taskboard -d taskboard --format=custom --no-owner --no-privileges \
  >"$proof_dir/taskboard.dump"
test -s "$proof_dir/taskboard.dump"
if [ "$resume_api" -eq 1 ]; then
  dc start api
  resume_api=0
  api_ready=0
  for ((attempt=1; attempt<=60; attempt++)); do
    if dc exec -T api node -e 'fetch("http://127.0.0.1:3000/readyz").then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))' >/dev/null 2>&1; then
      api_ready=1
      break
    fi
    sleep 1
  done
  if [ "$api_ready" -ne 1 ]; then
    echo 'L’API a redémarré mais sa disponibilité n’est pas rétablie.' >&2; exit 1
  fi
fi

echo "Création d’une base distincte : $restore_db"
dc exec -T db createdb -U taskboard --maintenance-db=postgres --template=template0 "$restore_db"
printf '%s\n' "$restore_db" >"$proof_dir/base-restauree.txt"
dc exec -T db pg_restore -U taskboard --dbname="$restore_db" --exit-on-error \
  --single-transaction --no-owner --no-privileges <"$proof_dir/taskboard.dump"
restored_count=$(dc exec -T db psql -X -v ON_ERROR_STOP=1 -U taskboard -d "$restore_db" -Atc 'SELECT count(*) FROM tasks')
printf '%s\n' "$restored_count" >"$proof_dir/nombre-restaure.txt"
dc exec -T -e 'PGOPTIONS=-c timezone=UTC' db psql -X -v ON_ERROR_STOP=1 -U taskboard -d "$restore_db" \
  -c 'COPY (SELECT id, title, created_at FROM tasks ORDER BY id) TO STDOUT WITH (FORMAT csv, HEADER true)' \
  >"$proof_dir/taches-restaurees.csv"
dc exec -T db psql -X -v ON_ERROR_STOP=1 -U taskboard -d "$restore_db" -Atc \
  'SELECT last_value, is_called FROM tasks_id_seq' >"$proof_dir/sequence-restauree.txt"
if ! cmp -s "$proof_dir/taches-source.csv" "$proof_dir/taches-restaurees.csv" || \
   ! cmp -s "$proof_dir/nombre-source.txt" "$proof_dir/nombre-restaure.txt" || \
   ! cmp -s "$proof_dir/sequence-source.txt" "$proof_dir/sequence-restauree.txt"; then
  echo 'La restauration diffère de la source : examiner les CSV, comptages et séquences.' >&2
  exit 1
fi
printf '{"resultat":"succes","base_source":"taskboard","base_restauree":"%s","taches":%s,"lignes_identiques":true,"sequence_identique":true}\n' \
  "$restore_db" "$source_count" >"$proof_dir/resultat.json"
echo "Restauration vérifiée : $source_count tâche(s), contenu exact et séquence identiques."
echo "Sauvegarde et preuves : $proof_dir"
echo "La base source, la base $restore_db et le volume sont conservés."
