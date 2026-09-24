# Registre de validation

**Préédition du parcours 0.3.0 — 24 septembre 2026.** Ce registre décrit les essais réellement exécutés. Les guides 01–05 sont disponibles ; les jalons 06–10 restent à réaliser. Le jalon 05 attend encore son essai AWS réel. La validation d’une commande ne vaut pas validation pédagogique auprès d’un débutant.

## Résultats locaux

Environnement : macOS arm64, Node.js 24.19.0, Docker 29.3.1 et Compose 5.1.0. L’image PostgreSQL utilisée rapporte la version 17.11. Les images Node et PostgreSQL sont fixées par digest dans les fichiers fournis.

| Vérification exécutée | Résultat | Portée |
| --- | --- | --- |
| Installation des dépendances par `npm ci` | Réussie | Dépendances de package-lock.json |
| Tests automatisés de l’application | 18 tests réussis | HTTP, Unicode, bornes, pannes, migration et smoke |
| Audit npm des dépendances d’exécution | 0 vulnérabilité signalée à cet instant | Ce résultat évolue avec la base de vulnérabilités |
| Parcours HTTP des guides 01–02 | Réussi | Démarrage mémoire, port, réponses, smoke et disparition au redémarrage |
| Exercice Git et challenge du jalon 02 | Réussis dans une copie indépendante | Branche, deux commits, annulation du seul second et état final propre |
| Construction et démarrage Compose | Réussis | PostgreSQL, migration explicite puis API |
| Remplacement du conteneur API | Tâche conservée à l’identique | Identifiant, titre et date contrôlés |
| Sauvegarde puis restauration séparée | Réussie | Lignes, comptage et séquence PostgreSQL identiques |
| Arrêt de PostgreSQL | Santé 200, disponibilité 503, lecture métier 503 | La panne de dépendance est observable |
| Redémarrage de PostgreSQL | Lecture de la tâche rétablie | Aucune recréation métier nécessaire |
| `docker compose down` puis `up` | Tâche conservée à l’identique | Volume conservé, sans option `-v` |

Les tests unitaires des migrations utilisent également des doubles de test : le passage PostgreSQL réel est établi séparément par Compose. Les mesures locales ont été obtenues pendant la préparation ; GitHub Actions reconstruit et rejoue l’intégration sur le commit publié.

## Validation GitHub Actions

La [première validation complète sur GitHub](https://github.com/nicolashedoire/devenir-devops/actions/runs/35986045983) a réussi sur le commit `e9d1ef31da0bbe44bf8a05ca4b5af4eb1cfe5ae7`, dans un environnement Ubuntu 24.04 / Linux AMD64. Les étapes application, documentation, dépendances, PostgreSQL, persistance et restauration ont toutes réussi. Les preuves sont jointes à cette exécution dans `validation-<SHA>`.

Les exécutions suivantes sont consultables dans [GitHub Actions](https://github.com/nicolashedoire/devenir-devops/actions/workflows/ci.yml). La référence précise d’une image publiée, son commit et le résultat de publication figurent dans les notes de [version](https://github.com/nicolashedoire/devenir-devops/releases) et dans l’artefact `publication-<SHA>`. Une exécution verte sans option de publication ne crée pas d’image dans le registre.

Le workflow `.github/workflows/ci.yml` exige le succès des tests, de la persistance et de la restauration avant la publication manuelle. Il conserve et transfère la même image entre validation et publication. Aucun job de déploiement cloud n’est présent.

## Jalon 05 : vérification locale et simulation AWS

Exécuté sur macOS ARM64 avec OpenTofu **1.12.6**, fournisseur `hashicorp/aws` **6.66.0** et fournisseur `hashicorp/local` **2.9.1**. Les verrous contiennent les empreintes officielles vérifiées pour macOS ARM64 et Linux AMD64. L’installateur OpenTofu vérifie une empreinte SHA-256 épinglée avant installation dans `work/bin/`.

| Contrôle réellement exécuté | Résultat | Limite |
| --- | --- | --- |
| Formatage et validation des trois racines | Réussis | Cohérence de configuration, pas autorisation AWS |
| Suites OpenTofu | 13 cas réussis : 2 locaux et 11 avec fournisseur AWS simulé | Aucun appel de création AWS |
| Lecture des plans simulés réellement produits par OpenTofu | Inventaires de 6 et 20 ressources acceptés | N’atteste pas la création des ressources |
| Cycle local complet | Création, dérive détectée avec code 2, rétablissement exact, plan sans changement, retrait et état vide | Un fichier local, pas une émulation cloud |
| Tests des contrôles d’identité et des plans | 8 tests Node réussis | Versions et STS simulés dans ces tests ; aucune session AWS réelle |
| Refus exercés | Compte inattendu, credentials concurrents, endpoints détournés, remplacement, plan partiel, ressource inattendue et retrait du backend | Complète la revue humaine, sans remplacer IAM |
| Confidentialité des résumés | Attributs privés et JSON mal formé non reproduits dans les résumés | Les plans et journaux complets restent hors Git |

`scripts/verify-infra.mjs` teste dans une copie temporaire, sans profils ni credentials AWS utilisables et avec l’accès aux métadonnées EC2 désactivé. Les fichiers du lecteur ne sont pas utilisés comme état de test. Les preuves sont dans `preuves/verification-infra-*/resultat.json`, avec les inventaires expurgés ; une copie de travail en échec reste disponible pour diagnostic. Le téléchargement des outils et fournisseurs nécessite Internet.

Le workflow `infra.yml` rejoue ces contrôles sans compte AWS. Les résultats de la version publiée sont accessibles dans [les exécutions du jalon cloud](https://github.com/nicolashedoire/devenir-devops/actions/workflows/infra.yml) et les [notes de version](https://github.com/nicolashedoire/devenir-devops/releases). Les artefacts sont nommés `infrastructure-simulee-<SHA>` et conservés 14 jours.

**Aucun réseau, bucket, rôle ou service AWS n’a été créé pour cette validation.** STS, permissions IAM, disponibilité des zones, concurrence du verrou S3, dérive réelle et inventaire après retrait restent à vérifier dans un compte de laboratoire autorisé. Aucun montant de facture AWS n’a donc été observé. Le guide distingue explicitement les commandes testées localement des résultats attendus sur AWS.

## Ce qui reste à valider

- Installation et lecture des quatre guides par un débutant sur une machine propre.
- Parcours Windows/WSL et variantes de distributions Linux.
- Exécution AWS réelle du jalon 05, puis Kubernetes/Helm/GitOps et promotion entre environnements.
- Collecte complète des métriques, logs et traces, alertes et essais de charge.
- Authentification utilisateur, contrôle des accès et reprise sur une cible de production.
- Plateforme en libre-service et client/serveur MCP.

L’ancienne extension OpenTelemetry du livre possède des essais séparés ; elle n’est pas intégrée à cette version du parcours. Les fichiers de `archive/legacy/` ne sont pas validés par le workflow actif.

## Rejouer les contrôles

```sh
npm ci
npm test
npm run doctor -- --docker
npm run check:docs
bash scripts/verify-compose.sh
bash scripts/backup-restore.sh
node scripts/install-tofu.mjs
export PATH="$PWD/work/bin:$PATH"
npm run test:cloud-guards
bash scripts/verify-infra.sh
```

Les services de laboratoire restent démarrés après les scripts afin d’examiner les résultats. `docker compose down` les arrête en conservant les données. Les dossiers `preuves/` et `backups/` restent locaux et sont ignorés par Git. Les artefacts CI constituent des preuves temporaires ; leur durée de conservation figure dans le workflow.
