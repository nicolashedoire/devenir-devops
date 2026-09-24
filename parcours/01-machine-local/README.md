# Jalon 01 — Faire fonctionner TaskBoard sur votre machine

**Chapitres 1–2. Guide disponible.** Consultez le [registre des essais](../../docs/validation.md). Les sorties ci-dessous sont attendues ; relevez vos observations séparément.

## Le problème

Avant d’automatiser un service, vous devez savoir le démarrer, lui envoyer une requête et expliquer où vivent ses données. Ici, TaskBoard fonctionne sur votre ordinateur, dans un processus unique, sans base de données.

```text
Navigateur ou curl → 127.0.0.1:3000 → processus TaskBoard → mémoire temporaire
```

## Prérequis et état d’entrée

Suivez [la préparation de la machine](../../docs/demarrer.md). Il faut Node.js 24.19.0, npm, Git, `curl`, deux terminaux et le dépôt cloné. Docker n’est pas nécessaire. Exécutez toutes les commandes depuis la racine du dépôt. Libérez le port 3000 de vos ateliers précédents, sans arrêter un programme inconnu.

## Étape 1 — Examiner avant de démarrer

```sh
pwd
node --version
npm run doctor
npm ci
npm test
```

`pwd` affiche le dossier courant. `npm ci` installe les dépendances selon le fichier de verrouillage (*lockfile*) ; une erreur de réseau à cette étape n’est pas un échec applicatif. `npm test` lance les tests. Lisez la liste et la conclusion : zéro échec est attendu. Le nombre exact de tests peut évoluer avec le projet, il ne faut pas l’inventer dans votre preuve.

## Étape 2 — Démarrer un processus

Dans le premier terminal :

```sh
env -u DATABASE_URL HOST=127.0.0.1 PORT=3000 FAULT_MODE=off npm start
```

`env -u DATABASE_URL` retire cette variable pour cette commande, afin de choisir volontairement le mode mémoire. Le serveur conserve le terminal occupé. Un événement de démarrage doit indiquer le port et le stockage. Ouvrez <http://127.0.0.1:3000> dans le navigateur.

Dans le second terminal :

```sh
curl -i http://127.0.0.1:3000/healthz
curl -i http://127.0.0.1:3000/readyz
curl -i http://127.0.0.1:3000/version
```

`-i` affiche aussi les en-têtes. La réponse commence par un statut HTTP 200 ; `/readyz` doit indiquer `storage: memory`. Le nom du champ JSON reste en anglais, mais sa signification est simplement « stockage en mémoire ». `/version` décrit la version déclarée ; une révision `local` ne prouve pas un lien avec un commit.

## Étape 3 — Faire un aller-retour métier

```sh
curl -i -X POST http://127.0.0.1:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"premier-essai-local"}'
curl -i http://127.0.0.1:3000/api/tasks
npm run smoke -- http://127.0.0.1:3000
```

La création répond 201 ; la lecture répond 200 et contient votre tâche. La vérification minimale (*smoke test*) crée aussi un titre unique, le relit par son identifiant et produit un relevé `smoke_passed` en cas de réussite. Elle ne supprime pas cette tâche. Observez dans le premier terminal les journaux de requêtes : une action dans le navigateur ou avec `curl` a produit du travail dans le processus.

## Incident contrôlé — Le service est vivant, mais la création échoue

Envoyez une entrée invalide :

```sh
curl -i -X POST http://127.0.0.1:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"   "}'
curl -i http://127.0.0.1:3000/healthz
```

La première réponse attendue est 400, la seconde 200. Aucun conteneur ni service extérieur n’est touché. Le refus est une validation de la demande ; il ne faut pas redémarrer le serveur pour « réparer » ce comportement.

## Diagnostic

Comparez la requête qui réussit et celle qui échoue : même adresse, même méthode, même type de contenu, titre différent. Une réponse HTTP signifie que le serveur a été joint. `400` décrit ici un problème de données d’entrée ; une erreur de connexion aurait demandé d’examiner adresse, port et processus.

Renvoyez un titre non vide pour vérifier le retour à une opération valide. Votre fiche doit distinguer le résultat de l’action métier de la santé générale du processus.

## Nettoyage et limite de stockage

Arrêtez le premier terminal avec `Ctrl+C`, puis relancez exactement la commande de démarrage. Relisez `/api/tasks` **avant** de relancer le test minimal. La liste attendue est vide : la mémoire appartenait à l’ancien processus. Arrêtez à nouveau avec `Ctrl+C`. Les tâches de ce jalon sont jetables ; la tâche à conserver naîtra au jalon 03.

## Preuve de sortie

Conservez version de Node, résultat des tests, réponses 201/200 puis 400/200, et observation de la liste vide après redémarrage. Expliquez pourquoi le test de santé ne garantit ni une création valide ni la conservation des données. Utilisez le [modèle de preuve](../../docs/preuves.md).

## Challenge

Démarrez une instance sur le port 3100, créez une tâche dont le titre contient un accent, puis tentez une lecture sur 3000. Identifiez les deux résultats sans modifier le code. Arrêtez l’instance et expliquez ce qu’il advient de la tâche.

[Ouvrir le corrigé après l’essai](corrige.md) · [Jalon suivant](../02-linux-reseau-git/README.md)
