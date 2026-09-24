#!/usr/bin/env bash
# Recette de lecture Ubuntu 24.04 : exécuter UNIQUEMENT sur un runner GitHub jetable.
# Prérequis : Node24.19.0, Git, curl, jq, Docker/Compose, nginx, systemd utilisateur actif,
# unzip et réseau public pour dépendances. Aucune identité AWS ; aucun appel AWS réel.
# Usage : bash recette-lecteur-01-10.sh CHEMIN_DU_CHECKOUT [linux|docker|infra|all]
# Le dossier source est seulement lu. Chaque exécution clone dans RUNNER_TEMP.
set -euo pipefail
[[ ${GITHUB_ACTIONS:-} == true && ${RUNNER_OS:-} == Linux ]] || { echo 'Refus : recette réservée à un runner GitHub Linux jetable.' >&2; exit 64; }
[[ $(id -u) != 0 ]] || { echo 'Le test des permissions exige un utilisateur ordinaire.' >&2; exit 64; }
source_repo=$(cd "${1:?Chemin du dépôt requis}" && pwd)
mode=${2:-all}
[[ $mode == linux || $mode == docker || $mode == infra || $mode == all ]] || exit 64
base=$(mktemp -d "${RUNNER_TEMP:?}/lecture-01-10.XXXXXX")
output=${RECETTE_OUTPUT:-"$GITHUB_WORKSPACE/recette-lecteur-preuves"}
mkdir -p "$output"
exec > >(tee "$output/$mode.log") 2>&1
printf 'Chapitre\tContrôle\tRésultat\n' > "$output/$mode.tsv"
mark() { printf '%s\t%s\tPASS\n' "$1" "$2" | tee -a "$output/$mode.tsv"; }
git clone --no-hardlinks "$source_repo" "$base/companion"
cd "$base/companion"
git rev-parse HEAD > "$output/$mode-revision.txt"
[[ $(node --version) == v24.19.0 ]]
npm ci
unset DATABASE_URL FAULT_MODE LAB_MODE APP_VERSION APP_REVISION
export AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null AWS_EC2_METADATA_DISABLED=true
# Seuls les identifiants factices du laboratoire Compose sont employés.
export COMPOSE_PROJECT_NAME="recette-lecteur-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT:-1}"
unit="taskboard-lecteur-${GITHUB_RUN_ID}.service"
unit_path="$HOME/.config/systemd/user/$unit"
node_pid='' nginx_started=0 compose_started=0
created=()
cleanup() {
  set +e
  [[ -n $node_pid ]] && kill "$node_pid" 2>/dev/null
  [[ $nginx_started == 1 ]] && nginx -p "$base/nginx/" -c nginx.conf -s quit
  if [[ -f $unit_path ]]; then systemctl --user stop "$unit"; rm -f "$unit_path"; systemctl --user daemon-reload; fi
  for cid in "${created[@]}"; do docker rm -f "$cid" >/dev/null 2>&1; done
  if [[ $compose_started == 1 ]]; then docker compose down --remove-orphans; fi
  # Aucun volume n’est supprimé ; le runner jetable libère ses propres disques à sa fin.
}
trap cleanup EXIT
health() { curl --fail --retry 30 --retry-all-errors --retry-delay 1 --max-time 3 "http://127.0.0.1:$1/${2:-healthz}"; }
post() { curl -fsS -H 'Content-Type: application/json' -d '{"title":"preuve-parcours-devops"}' "http://127.0.0.1:$1/api/tasks"; }
free_ports() { node --input-type=module - "$@" <<'JS'
import net from 'node:net';for(const port of process.argv.slice(2)){await new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(+port,'127.0.0.1',()=>s.close(res));});}
JS
}
new_container() { local cid; cid=$(docker run "$@"); created+=("$cid"); }
compare_witness() { node --input-type=module <<'JS'
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';const before=JSON.parse(await readFile('preuves/tache-temoin.json','utf8'));const r=await fetch(`http://127.0.0.1:3000/api/tasks/${before.id}`);assert.equal(r.status,200);assert.deepEqual(await r.json(),before);console.log('Témoin id/title/created_at strictement conservé.');
JS
}
if [[ $mode == linux || $mode == all ]]; then
  command -v nginx
  systemctl --user show-environment >/dev/null || { echo 'Prérequis manquant : session systemd utilisateur. Aucun résultat systemd ne sera annoncé.'; exit 65; }
  free_ports 3000 3100 8080
  ps -eo pid,ppid,user,stat,etime,args | head -20 || true
  free -h; df -h .; df -i .
  mkdir -p work/linux-lab
  printf 'PORT=3000\n' > work/linux-lab/app.env
  chmod 600 work/linux-lab/app.env; cat work/linux-lab/app.env
  chmod 000 work/linux-lab/app.env
  if cat work/linux-lab/app.env; then echo 'chmod000 aurait dû refuser la lecture'; exit 1; fi
  ls -l work/linux-lab/app.env; id; chmod 600 work/linux-lab/app.env; cat work/linux-lab/app.env
  mark 03 'chmod000 refus puis correction600 sous utilisateur ordinaire'
  mkdir -p "$HOME/.config/systemd/user"
  [[ ! -e $unit_path ]]
  cat > "$unit_path" <<UNIT
[Unit]
Description=TaskBoard recette lecteur isolée
[Service]
Type=simple
WorkingDirectory=$PWD
ExecStart=$(command -v node) app/server.mjs
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=FAULT_MODE=off
UnsetEnvironment=DATABASE_URL
Restart=on-failure
RestartSec=3
TimeoutStopSec=15
[Install]
WantedBy=default.target
UNIT
  systemctl --user daemon-reload
  systemctl --user start "$unit"
  health 3000
  systemctl --user status "$unit" --no-pager
  journalctl --user -u "$unit" -n 30 --no-pager
  ss -ltnp | grep ':3000'
  post 3000 > "$output/linux-tache-memoire.json"
  sed -i 's/PORT=3000/PORT=3100/' "$unit_path"
  systemctl --user daemon-reload
  health 3000
  if curl -fsS --max-time 2 http://127.0.0.1:3100/healthz; then exit 1; fi
  systemctl --user restart "$unit"; health 3100
  [[ $(curl -fsS http://127.0.0.1:3100/api/tasks) == '[]' ]]
  ss -ltnp | grep ':3100'
  systemctl --user stop "$unit"
  if curl -fsS --max-time 2 http://127.0.0.1:3100/healthz; then exit 1; fi
  sed -i 's/PORT=3100/PORT=3000/' "$unit_path"
  systemctl --user daemon-reload; systemctl --user start "$unit"; health 3000
  mark 03 'systemd start/journal/daemon-reload sans restart/changement3100/stop/retour3000'
  mkdir -p "$base/nginx"
  cat > "$base/nginx/nginx.conf" <<NGINX
pid $base/nginx/nginx.pid;
error_log $base/nginx/error.log;
events {}
http {
 access_log $base/nginx/access.log;
 client_body_temp_path $base/nginx/client_temp;
 proxy_temp_path $base/nginx/proxy_temp;
 fastcgi_temp_path $base/nginx/fastcgi_temp;
 uwsgi_temp_path $base/nginx/uwsgi_temp;
 scgi_temp_path $base/nginx/scgi_temp;
 server {
  listen 127.0.0.1:8080;
  server_name localhost;
  location / {
   proxy_pass http://127.0.0.1:3000;
   proxy_set_header Host \$host;
   proxy_set_header X-Forwarded-For \$remote_addr;
   proxy_set_header X-Forwarded-Proto \$scheme;
   proxy_connect_timeout 2s;
   proxy_read_timeout 5s;
  }
 }
}
NGINX
  nginx -V
  nginx -p "$base/nginx/" -c nginx.conf -t
  nginx -p "$base/nginx/" -c nginx.conf
  nginx_started=1
  health 8080
  nginx -p "$base/nginx/" -c nginx.conf -s reload
  [[ $(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/inconnue) == 404 ]]
  if curl -fk --max-time 3 https://127.0.0.1:3000/healthz; then exit 1; fi
  systemctl --user stop "$unit"
  [[ $(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/healthz) == 502 ]]
  cat "$base/nginx/error.log"
  systemctl --user start "$unit"; health 8080
  mark 04 'NGINX isolé200/404/TLSsurHTTPrefus/502puisrétablissement'
  systemctl --user stop "$unit"
fi
if [[ $mode == docker || $mode == all ]]; then
  npm run doctor -- --docker
  free_ports 3000 3001 3002 3003 3999
  for name in taskboard-api taskboard-bind-lab taskboard-limites taskboard-ci; do
    if docker inspect "$name" >/dev/null 2>&1; then echo "Nom déjà occupé : $name"; exit 65; fi
  done
  docker build -t taskboard:lab .
  docker image inspect taskboard:lab --format '{{.Id}}'
  new_container -d --name taskboard-api -p 127.0.0.1:3000:3000 taskboard:lab
  health 3000; docker logs taskboard-api; docker ps
  post 3000 > "$output/docker-tache-memoire.json"
  docker restart taskboard-api; health 3000
  [[ $(curl -fsS http://127.0.0.1:3000/api/tasks) == '[]' ]]
  # Nouvelle image, ancien conteneur : l'ancien garde son HTML.
  cp app/index.html "$base/index-original.html"
  printf '\n<!-- RECETTE_IMAGE_MODIFIEE -->\n' >> app/index.html
  docker build -t taskboard:recette-modifiee .
  if curl -fsS http://127.0.0.1:3000/ | grep -q RECETTE_IMAGE_MODIFIEE; then exit 1; fi
  cp "$base/index-original.html" app/index.html
  docker stop taskboard-api
  if docker run --name taskboard-api taskboard:lab; then exit 1; fi
  docker ps -a --filter name=taskboard-api; docker logs taskboard-api; docker rm taskboard-api
  new_container -d --name taskboard-api -p 127.0.0.1:3000:3000 taskboard:recette-modifiee
  health 3000; curl -fsS http://127.0.0.1:3000/ | grep RECETTE_IMAGE_MODIFIEE
  docker rm -f taskboard-api
  mark 06 'mémoireperdue/rebuildsansremplacement/nouveaurendu/nomconservéàarrêt'
  new_container -d --name taskboard-bind-lab -e HOST=127.0.0.1 -p 127.0.0.1:3001:3000 taskboard:lab
  sleep 2
  if curl -fsS --max-time 3 http://127.0.0.1:3001/healthz; then exit 1; fi
  docker exec taskboard-bind-lab node -e 'fetch("http://127.0.0.1:3000/healthz").then(r=>{console.log(r.status);if(r.status!==200)process.exit(1)})'
  docker port taskboard-bind-lab
  docker rm -f taskboard-bind-lab
  new_container -d --name taskboard-bind-lab -e HOST=0.0.0.0 -p 127.0.0.1:3001:3000 taskboard:lab
  health 3001; docker rm -f taskboard-bind-lab
  new_container -d --name taskboard-limites --memory 256m --cpus 1 --read-only -p 127.0.0.1:3002:3000 taskboard:lab
  health 3002; post 3002 > "$output/docker-limites-tache.json"
  docker inspect taskboard-limites --format '{{json .HostConfig}}' > "$output/docker-limites.json"
  node --input-type=module - "$output/docker-limites.json" <<'JS'
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';const c=JSON.parse(await readFile(process.argv[2]));assert.equal(c.Memory,268435456);assert.equal(c.NanoCpus,1000000000);assert.equal(c.ReadonlyRootfs,true);
JS
  docker rm -f taskboard-limites
  mark 06 'écoute127internepuis0.0.0.0/limites256MiB1CPU/écrituremémoireavecdisquelectureseule'
  docker compose config --quiet; compose_started=1
  docker compose up -d --build
  docker compose ps -a; docker compose logs migrate api; health 3000 readyz
  mkdir -p preuves; test ! -e preuves/tache-temoin.json; post 3000 > preuves/tache-temoin.json
  docker compose up -d --no-deps --force-recreate api; health 3000 readyz; compare_witness
  bash scripts/verify-compose.sh; compare_witness
  docker compose stop db
  [[ $(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/healthz) == 200 ]]
  [[ $(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/readyz) == 503 ]]
  [[ $(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/tasks) == 503 ]]
  docker compose start db; health 3000 readyz; compare_witness
  bash scripts/backup-restore.sh
  docker compose run --rm migrate | tee "$output/migration-rejouee.log"
  grep migration_up_to_date "$output/migration-rejouee.log"
  compare_witness
  cp preuves/tache-temoin.json "$output/tache-temoin.json"
  mkdir -p "$output/restauration"
  cp backups/*/resultat.json "$output/restauration/resultat.json"
  cp backups/*/taches-source.csv "$output/restauration/source.csv"
  cp backups/*/taches-restaurees.csv "$output/restauration/restauree.csv"
  mark 07 'Compose/postgres/témoincanonique/recréationAPI/DBarrêtée200503503/restauration/migrationidempotente'
  docker compose down; compose_started=0
  docker build -t taskboard:ci .
  # Chaque sous-shell nettoie le conteneur même lorsque le contrôle échoue.
  for port in 3999 3003; do
    if (
      set -euo pipefail
      trap 'docker rm -f taskboard-ci >/dev/null 2>&1 || true' EXIT
      docker run -d --name taskboard-ci -p 127.0.0.1:3003:3000 taskboard:ci
      curl --fail --retry 3 --retry-all-errors --retry-delay 1 --max-time 2 "http://127.0.0.1:$port/healthz"
    ); then result=0; else result=$?; fi
    if [[ $port == 3999 ]]; then [[ $result != 0 ]]; else [[ $result == 0 ]]; fi
    if docker inspect taskboard-ci >/dev/null 2>&1; then echo 'Nettoyage incomplet'; exit 1; fi
  done
  mark 08 'constructionCI/contrôleportfauxrouge/portcorrectvert/nettoyage2cas'
fi
if [[ $mode == infra || $mode == all ]]; then
  node scripts/install-tofu.mjs
  export PATH="$PWD/work/bin:$PATH"
  tofu version
  bash scripts/verify-infra.sh
  npm run test:cloud-guards
  cp preuves/verification-infra-*/resultat.json "$output/infra-resultat.json"
  mark 10 'fmtvalidate/mockAWS/cyclefichierlocal/guardsaucunecréationAWS'
fi
printf '\nRecette %s terminée. Preuves : %s\n' "$mode" "$output"
