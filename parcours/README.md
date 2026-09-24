# Mode d’emploi des dix jalons

Vous faites évoluer TaskBoard et votre manière de le vérifier. Les deux premiers jalons utilisent des données temporaires. Le troisième introduit PostgreSQL et la tâche témoin dont vous conserverez `id`, `title` et `created_at` jusqu’à la recette.

**Référence du parcours : v1.0.0. Les dix guides et leurs corrigés sont livrés.** L’application conserve son numéro 0.2.0 ; le parcours possède sa propre version. La [préparation](../docs/demarrer.md) explique comment cloner cette référence et contrôler votre environnement. Le [registre](../docs/validation.md) décrit les essais réellement exécutés, sans confondre code rédigé, tests simulés et intégration réelle.

## Du livre à la preuve

| Jalon | Chapitres du livre | Preuve de passage |
| --- | --- | --- |
| [01 — Machine et local](01-machine-local/README.md) | 1–2 | Réponse HTTP, création/lecture, perte en mémoire expliquée |
| [02 — Linux, réseau, Git](02-linux-reseau-git/README.md) | 3–5 | Processus et port identifiés ; changement relu puis annulé par Git |
| [03 — Docker et PostgreSQL](03-docker-postgresql/README.md) | 6–7 | Même tâche après remplacement de l’API ; lignes et séquence restaurées |
| [04 — CI et image traçable](04-ci-image/README.md) | 8 | Commit, contrôles, digest et `/version` reliés |
| [05 — Cloud et OpenTofu](05-cloud-opentofu/README.md) | 9–10 | Fichier local créé, dérive corrigée, retrait vérifié ; extension AWS séparée |
| [06 — Kubernetes, Helm, GitOps](06-kubernetes-helm-gitops/README.md) | 11–14 | Snapshot comparé, PVC conservé, image identifiée et état réconcilié |
| [07 — Observabilité](07-observabilite/README.md) | 15 | Requête reliée à ses métriques, son journal et ses spans HTTP → SQL |
| [08 — Sécurité, SRE, reprise](08-securite-sre-reprise/README.md) | 16–18 | Accès refusé/accepté, jeton renouvelé, alerte reçue puis résolue |
| [09 — Recette locale](09-recette-production/README.md) | 21 | Restauration distincte et matrice d’acceptation appuyée sur des preuves |
| [10 — Plateforme, MCP, portfolio](10-plateforme-mcp-portfolio/README.md) | 19–20, 22 | Offre validée, refus MCP observés et démonstration explicable |

Lisez d’abord l’état d’entrée. Écrivez le résultat que vous attendez, exécutez une étape, puis comparez l’observation. Arrêtez la séquence si une précondition échoue. Provoquez la panne seulement dans le laboratoire indiqué et prouvez le rétablissement. Essayez le challenge avant le corrigé ; conservez une [fiche de preuve](../docs/preuves.md).

## Un parcours principal local, une extension AWS

Les dix jalons peuvent être travaillés sans créer de ressource AWS. Le jalon 05 commence par une véritable ressource locale gérée par OpenTofu. Son prolongement décrit un compartiment d’état et un réseau AWS sur deux zones, avec contrôle de compte, estimation et retrait. **Cette extension n’a pas été exécutée dans un compte AWS pour la validation du compagnon.** Ses tests avec fournisseur simulé ne remplacent pas cette expérience.

Le jalon 06 utilise kind sur votre ordinateur et Argo CD avec une lecture de votre dépôt. GitHub et le registre d’images nécessitent Internet ; une copie personnelle du dépôt et les droits adaptés sont nécessaires pour publier vos changements. Les jalons 07–09 emploient d’autres projets Compose locaux. Vous pouvez arrêter un atelier lourd avant d’en démarrer un autre, en conservant ses volumes et ses preuves.

La sécurité accompagne toutes les étapes. Le jalon 08 lui donne un laboratoire explicite : passerelle HTTPS, contrôle par jeton, droits SQL et notification d’incident. Cette cible reste locale ; la recette du jalon 09 ne certifie ni une disponibilité multizone ni un service ouvert à des utilisateurs externes.

## Garder les données et désigner leur source

`preuves/tache-temoin.json` représente une tâche réellement créée dans la base source. Ne l’écrasez pas pour faire réussir un contrôle. Une donnée avec le même titre mais un autre identifiant ou une autre date est une recréation.

Kubernetes, observabilité et opérations reçoivent des copies à un instant donné. Chaque import vérifie leur contenu et leur témoin ; aucune réplication continue n’est implicite. Les nouvelles écritures d’une copie ne sont pas présentes ailleurs. Le laboratoire d’observation impose même un rôle sans écriture à ses API. La source et les copies doivent donc être nommées dans votre dossier de preuve.

Une vraie bascule demanderait de maîtriser les écritures, effectuer le transfert final, comparer les données et désigner la nouvelle source d’autorité. Ce travail ne se déduit pas du nom d’un namespace ou d’une synchronisation verte.

## Lire les résultats acquis sans les généraliser

Une exécution CI identifie un commit, un environnement et des données synthétiques. Elle fournit une preuve reproductible pour ce périmètre, mais ne démontre pas votre import personnel. Les registres [général](../docs/validation.md), [observabilité](../observabilite/validation.md) et [opérations](../operations/validation.md) indiquent les résultats et limites.

Les anciens fichiers de `archive/legacy/` ne remplacent aucun guide actuel : leur chart en mémoire ne respecte pas la continuité du parcours. Gardez les versions du code, les empreintes d’images et les configurations ensemble. La réussite attendue est de pouvoir expliquer les observations et leurs limites à une autre personne.
