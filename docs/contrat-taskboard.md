# Contrat de TaskBoard

TaskBoard est une application pédagogique de création et lecture de tâches. Le parcours fait évoluer son exécution ; il ne change pas de projet entre les technologies.

## Interface HTTP

| Requête | Résultat attendu |
| --- | --- |
| `GET /` | Interface HTML |
| `POST /api/tasks` | Création d’une tâche, réponse 201 avec `id`, `title`, `created_at` |
| `GET /api/tasks` | Lecture des tâches, réponse 200 |
| `GET /api/tasks/<id>` | Lecture d’une tâche identifiée ; 404 si absente |
| `GET /healthz` | Santé du processus, réponse 200 s’il répond |
| `GET /readyz` | Disponibilité de la dépendance ; indique `storage` |
| `GET /version` | Version et révision publiques de l’application |
| `GET /metrics` | Mesures HTTP au format d’exposition Prometheus |

La création attend `Content-Type: application/json` et un objet tel que `{"title":"premiere-tache"}`. Le titre doit compter de 1 à 200 points de code Unicode après retrait des espaces de bord, sans caractère NUL ni séquence Unicode mal formée. Une entrée invalide est refusée, sans créer de tâche. Le corps de requête est limité à 8 192 octets : un dépassement produit 413. En mémoire, la création au-delà de 1 000 tâches est refusée avec 409. La lecture globale retourne au maximum 1 000 tâches ; la lecture par identifiant permet de contrôler un témoin précis. Le projet ne propose pas encore de modification ou suppression métier, de comptes utilisateurs, ni de pagination complète.

## Stockage et migration

Sans `DATABASE_URL`, les données vivent dans la mémoire du processus. Avec cette variable, l’API utilise PostgreSQL. Les deux modes sont explicitement distingués dans les preuves. À partir du jalon 03, seule une preuve en mode PostgreSQL permet de déclarer la persistance acquise.

`npm run migrate` exige une `DATABASE_URL` et applique les migrations de `db/migrations/`. Le service Compose `migrate` effectue cette opération avant le démarrage de l’API. L’API ne crée plus implicitement la table à son démarrage. Relancer une migration déjà appliquée ne doit ni dupliquer ni effacer les données.

## Identité de la tâche témoin

Le jalon 03 crée une tâche dont le titre est `preuve-parcours-devops`. Sa réponse de création est conservée dans `preuves/tache-temoin.json`. Les trois champs `id`, `title` et `created_at` constituent la référence : ils doivent rester identiques après remplacement d’un conteneur, migration vers une cible ou restauration.

Ne supposez pas que l’identifiant vaut 1 : d’autres essais ont pu créer des tâches. Les scripts de vérification minimale (*smoke tests*) créent leurs propres titres uniques et les conservent. Ils ne remplacent pas la tâche canonique du lecteur.

## Paramètres de laboratoire

| Paramètre | Usage |
| --- | --- |
| `HOST`, `PORT` | Adresse et port d’écoute du serveur |
| `DATABASE_URL` | Connexion PostgreSQL ; aucune valeur réelle à publier |
| `FAULT_MODE` | `off`, `error` ou `slow` |
| `LAB_MODE=true` | Autorisation explicite d’une injection de panne |
| `APP_VERSION`, `APP_REVISION` | Métadonnées publiques exposées par `/version` |
| `TASKBOARD_URL` | Adresse cible de `npm run smoke` |
| `TASKBOARD_PORT` | Port local choisi pour Compose, 3000 par défaut |

`FAULT_MODE=error` produit une erreur 503 sur le parcours des tâches ; `slow` introduit un délai pédagogique. Sans `LAB_MODE=true`, une panne active doit empêcher le démarrage. La santé du processus peut rester verte malgré une panne métier. Le contrôle `/readyz` vérifie la connexion et le schéma attendu dans la base, pas toute l’expérience utilisateur.

## Limites de publication

Les identifiants Compose sont publics et réservés au laboratoire local. L’application ne réalise pas encore d’authentification utilisateur. Le contrat du jalon 08 exige un véritable contrôle d’accès avant la recette publique. Les anciens manifests de `archive/legacy/` restent hors parcours actif.
