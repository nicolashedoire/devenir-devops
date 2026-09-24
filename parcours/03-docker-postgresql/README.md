# Jalon 03 — Conserver une tâche et savoir la restaurer

**Chapitres 6–7. Guide disponible.** La [validation](../../docs/validation.md) précise les environnements essayés.

## Le problème

Une application redémarre et perd ses tâches : son processus détenait les données. Vous allez séparer application, schéma et stockage, puis prouver qu’une sauvegarde se restaure. À partir de ce jalon, une même tâche témoin doit traverser la suite du parcours.

```text
Navigateur → API remplaçable → PostgreSQL → volume conservé
                              ↑
                     migration séparée

PostgreSQL → sauvegarde → nouvelle base → comparaison du contenu
```

## Prérequis et état d’entrée

Terminez les jalons 01–02 et arrêtez leurs serveurs. Il faut Docker avec son moteur actif, Docker Compose, Bash et `curl` ; Node.js 24.19.0 sert aux vérifications du lecteur. Le port 3000 doit être libre. Restez dans la racine du dépôt. Les identifiants Compose sont publics et limités à ce laboratoire non exposé.

```sh
npm run doctor -- --docker
docker compose config --quiet
```

La seconde commande vérifie la configuration, sans démarrer les services. Si 3000 est occupé par une autre application, vous pouvez choisir `export TASKBOARD_PORT=3100` dans les terminaux utilisés et adapter les URL. La suite présente le cas par défaut sur 3000.

## Étape 1 — Construire et démarrer

```sh
docker compose up -d --build
docker compose ps -a
docker compose logs --tail=40 migrate api
curl -i http://127.0.0.1:3000/readyz
```

Une image (*image*) est construite à partir du Dockerfile ; les conteneurs sont ses exécutions. `db` héberge PostgreSQL. `migrate` applique le schéma puis se termine avec un code zéro : cet arrêt est attendu pour un traitement ponctuel. `api` démarre après sa réussite. `/readyz` doit répondre 200 et indiquer `storage: postgres`. Attendez le démarrage et réessayez la lecture si nécessaire ; un état « démarré » n’est pas à lui seul une preuve de disponibilité.

La migration peut aussi être relancée explicitement :

```sh
docker compose run --rm migrate
```

Le résultat attendu est un schéma déjà à jour, sans destruction des données. En dehors de Compose, la commande correspondante est `npm run migrate`, avec une `DATABASE_URL` appropriée. Ne l’exécutez pas sans cible identifiée : le laboratoire ne publie pas le port PostgreSQL vers la machine hôte.

## Étape 2 — Créer la tâche canonique une seule fois

```sh
mkdir -p preuves
if [ -e preuves/tache-temoin.json ]; then
  printf '%s\n' 'Un témoin est déjà enregistré : conservez-le.'
else
  curl -fsS -X POST http://127.0.0.1:3000/api/tasks \
    -H 'Content-Type: application/json' \
    -d '{"title":"preuve-parcours-devops"}' \
    -o preuves/tache-temoin.json
fi
cat preuves/tache-temoin.json
```

Le fichier doit contenir l’objet créé, avec `id`, `title` et `created_at`. Si la création échoue, examinez son message et le fichier avant de continuer : un fichier vide n’est pas un témoin. Ne remplacez pas un témoin valide à chaque reprise de l’exercice.

Lisez l’identifiant enregistré puis demandez cette tâche précise :

```sh
TASKBOARD_ID=$(node -p "JSON.parse(require('node:fs').readFileSync('preuves/tache-temoin.json','utf8')).id")
curl -fsS "http://127.0.0.1:3000/api/tasks/$TASKBOARD_ID"
```

Le petit extrait Node lit le champ `id` du JSON, sans supposer qu’il vaut 1. Ne comparez pas uniquement le titre : une tâche recréée pourrait avoir le même texte et une autre identité.

## Étape 3 — Remplacer l’API, conserver les données

```sh
docker compose up -d --no-deps --force-recreate api
curl -i http://127.0.0.1:3000/readyz
```

Attendez HTTP 200, puis relisez l’adresse `/api/tasks/$TASKBOARD_ID`. Les trois champs doivent rester identiques. Automatisez ensuite la même propriété :

```sh
bash scripts/verify-compose.sh
```

Ce script crée son propre témoin unique, remplace le conteneur API et compare les données. Il conserve les services et les tâches. Il écrit sous `preuves/verify-compose-<identifiant>/` les fichiers `tache-temoin.json`, `tache-apres.json` et `resultat.json`. Son témoin de test s’ajoute au vôtre ; il ne remplace pas `preuves/tache-temoin.json`.

## Incident contrôlé — PostgreSQL s’arrête

```sh
docker compose stop db
curl --max-time 5 -i http://127.0.0.1:3000/healthz
curl --max-time 5 -i http://127.0.0.1:3000/readyz
curl --max-time 5 -i "http://127.0.0.1:3000/api/tasks/$TASKBOARD_ID"
```

La santé du processus doit rester à 200 ; la disponibilité et le parcours dépendant de la base doivent échouer, typiquement en 503. L’arrêt ne supprime pas le volume. Limitez l’observation à quelques minutes.

## Diagnostic et rétablissement

```sh
docker compose ps -a
docker compose logs --tail=30 api db
docker compose start db
curl -i http://127.0.0.1:3000/readyz
```

Le changement connu porte sur la dépendance. Réinstaller npm ou reconstruire l’image ne redémarrerait pas cette base. Attendez son retour, relisez la tâche par son identifiant et vérifiez les trois champs. L’incident est clos après cette preuve métier, pas après la seule commande `start`.

## Étape 4 — Restaurer ailleurs

```sh
bash scripts/backup-restore.sh
```

Le script suspend brièvement l’API pour figer les données à sauvegarder, puis la reprend. N’effectuez pas d’écriture SQL directe pendant l’essai. Il restaure dans une **nouvelle base** `taskboard_restore_...` et compare lignes ordonnées, comptage et séquence des identifiants.

Le dossier affiché `backups/<identifiant>/` conserve `taskboard.dump`, les CSV source/restauré, les comptages, les séquences, `base-restauree.txt` et `resultat.json`. Vérifiez que votre tâche canonique figure dans les deux CSV. Un fichier de sauvegarde non vide sans restauration ne suffirait pas à démontrer la reprise.

## Nettoyage et preuve de sortie

```sh
docker compose down
```

Cette commande conserve le volume et les bases. **N’ajoutez pas `-v`.** Gardez le témoin et les preuves pour le jalon suivant. La base de restauration est aussi conservée ; son retrait éventuel doit viser uniquement le nom exact inscrit dans `base-restauree.txt`, jamais `taskboard`.

Votre preuve comprend le stockage PostgreSQL, le même témoin avant/après remplacement et incident, puis une comparaison de restauration réussie. Un volume local unique ne démontre ni haute disponibilité ni reprise après perte de la machine.

## Challenge

Expliquez pourquoi `docker compose down` puis `up -d` doit conserver la tâche. Définissez une preuve permettant de distinguer conservation et recréation du même titre. Relancez la migration sur la base existante et vérifiez que votre témoin n’a pas changé.

[Corrigé séparé](corrige.md) · [Jalon suivant](../04-ci-image/README.md)
