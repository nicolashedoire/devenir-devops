# 08 — Mesurer, protéger et rétablir TaskBoard

**Résultat visé :** un accès HTTPS explicitement approuvé, un jeton renouvelable, une base à permissions limitées et une alerte reçue puis résolue pendant une panne réelle de dépendance. **Prérequis :** jalons 03–04 terminés, Docker Compose, Node conforme à `.node-version`, OpenSSL, image référencée dans `deploy/image-reference.json`, source `db` disponible et témoin `preuves/tache-temoin.json` exact. Prévoir 45–60 minutes, téléchargements exclus.

L’atelier utilise une **copie distincte** de la base source. Les tâches créées ensuite sur cette copie ne retournent pas vers la source. Les chemins, secrets et ports sont décrits dans [le laboratoire opérations](../../operations/README.md). Ne lancez aucun autre import ou écriture sur la source pendant son snapshot.

## 1. Définir le service utile

Écrivez dans votre carnet : « une lecture éligible est une tentative HTTPS GET `/api/tasks` avec un jeton valide, depuis la sonde locale ; une réussite est une réponse 200 entièrement reçue ». Excluez les métriques et les sondes de santé de ce parcours. Une erreur réseau est un échec, même sans réponse HTTP.

Pour la latence, retenez provisoirement « proportion des lectures réussies entièrement reçues en 300 ms ou moins ». Cette population diffère du taux de réussite. Pour un futur SLO, il faudrait encore une fenêtre, un volume représentatif, un responsable et une politique de décision.

## 2. Initialiser la frontière d’accès

```bash
node --test operations/gateway.test.mjs
node operations/lab.mjs init --witness preuves/tache-temoin.json
```

`init` refuse d’écraser un laboratoire déjà initialisé. Il génère l’autorité TLS et le jeton sans les afficher, prend un snapshot cohérent, compare les lignes et la séquence après restauration, puis vérifie le témoin par HTTPS. L’API source retrouve son état initial démarré ou arrêté. La copie est publiée uniquement par la passerelle `127.0.0.1:3443` ; ni API ni PostgreSQL ne disposent de port hôte.

Le certificat du laboratoire dure sept jours. Les clients des scripts approuvent sa CA explicitement. Aucun magasin de confiance de l’ordinateur n’est modifié et aucune option de contournement de TLS n’est utilisée.

## 3. Lire les preuves de sécurité

```bash
node operations/lab.mjs verify
node operations/lab.mjs rotate
```

Ouvrez le `resultat.json` dont le chemin est affiché. Cherchez les contrôles de refus, pas seulement le succès d’un utilisateur autorisé. La vérification crée une tâche de contrôle uniquement dans la copie et la conserve. L’ancien jeton doit cesser de fonctionner immédiatement après la rotation, sans redémarrer le serveur.

Le rôle SQL de l’API possède lecture et insertion sur `tasks`, ainsi que les droits nécessaires à la séquence. Le test tente `CREATE TABLE` dans une transaction puis annule cette transaction : le code attendu est `42501`, permission insuffisante. La migration possède une identité séparée. Le test ne modifie pas le schéma de la source.

## 4. Mesurer avant d’interrompre

```bash
node operations/lab.mjs probe --count 20
```

Relevez `requetes_eligibles`, `reussites`, `disponibilite` et `sli_latence`. Si 20 lectures réussissent, le résultat vaut 1 sur ces 20 observations. Il ne signifie pas que la production respecte 99,9 % sur trente jours. Comparez les durées et cherchez ce que cette sonde exclut : réseau Internet, navigateur, autres utilisateurs, heures de pointe.

## 5. Déclencher et traiter l’incident

```bash
node operations/lab.mjs incident
```

Pendant cet exercice, le programme arrête seulement `db` du projet `taskboard-operations`. Il garde le volume, génère des lectures, attend une notification `firing`, reprend PostgreSQL et exige une notification `resolved`. Prometheus observe les erreurs métier ; Alertmanager les groupe et les transmet au serveur `receiver`, accessible seulement dans le réseau privé du laboratoire.

La remise en route de PostgreSQL est dans un bloc de récupération. Les signaux d’interruption tentent aussi de reprendre la base. Une coupure brutale de Docker ou de l’ordinateur dépasse cette protection : au retour, utilisez `node operations/lab.mjs up`, puis `verify`. Une commande interrompue ne vaut jamais un exercice réussi.

## 6. Challenge

Produisez un compte rendu d’une page : définition du parcours, preuve d’un accès refusé et d’un accès accepté, effet de la rotation, chronologie réelle de la panne, réception de `firing`, retour des lectures et réception de `resolved`. Calculez le budget pour 100 000 requêtes avec un objectif 99,9 %, puis sa consommation si 70 requêtes échouent. Expliquez pourquoi trois API devant une base arrêtée ne réparent pas ce cas.

Terminez par deux limites précises qui interdisent d’exposer ce laboratoire comme un service public multitenant. Ne copiez jamais les jetons, mots de passe, clés ou titres réels dans le compte rendu. Le [corrigé](corrige.md) indique les critères de réussite.

## 7. Fin de séance

```bash
node operations/lab.mjs down
```

Cette commande conserve les volumes et les preuves. Gardez les fichiers privés de `work/operations` hors Git. Le jalon 09 réutilise cette cible pour une restauration indépendante et une recette complète.
