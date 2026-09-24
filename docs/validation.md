# Registre de validation

**Préédition 0.2.0 — 24 septembre 2026.** Ce registre décrit les essais réellement exécutés. Les guides 01–04 sont disponibles ; les jalons 05–10 restent à réaliser. La validation d’une commande ne vaut pas validation pédagogique auprès d’un débutant.

## Résultats locaux

Environnement : macOS arm64, Node.js 24.19.0, Docker 29.3.1 et Compose 5.1.0. L’image PostgreSQL utilisée rapporte la version 17.11. Les images Node et PostgreSQL sont fixées par digest dans les fichiers fournis.

| Vérification exécutée | Résultat | Portée |
| --- | --- | --- |
| Installation des dépendances par `npm ci` | Réussie | Dépendances de package-lock.json |
| Tests automatisés de l’application | 18 tests réussis | HTTP, Unicode, bornes, pannes, migration et smoke |
| Audit npm des dépendances d’exécution | 0 vulnérabilité signalée à cet instant | Ce résultat évolue avec la base de vulnérabilités |
| Construction et démarrage Compose | Réussis | PostgreSQL, migration explicite puis API |
| Remplacement du conteneur API | Tâche conservée à l’identique | Identifiant, titre et date contrôlés |
| Sauvegarde puis restauration séparée | Réussie | Lignes, comptage et séquence PostgreSQL identiques |
| Arrêt de PostgreSQL | Santé 200, disponibilité 503, lecture métier 503 | La panne de dépendance est observable |
| Redémarrage de PostgreSQL | Lecture de la tâche rétablie | Aucune recréation métier nécessaire |
| `docker compose down` puis `up` | Tâche conservée à l’identique | Volume conservé, sans option `-v` |

Les tests unitaires des migrations utilisent également des doubles de test : le passage PostgreSQL réel est établi séparément par Compose. Les mesures locales ont été obtenues pendant la préparation ; GitHub Actions reconstruit et rejoue l’intégration sur le commit publié.

## Validation GitHub Actions

La première exécution est en cours de préparation. Ce paragraphe sera remplacé par les liens et les résultats après le premier envoi du code.

Le workflow `.github/workflows/ci.yml` exige le succès des tests, de la persistance et de la restauration avant la publication manuelle. Il conserve et transfère la même image entre validation et publication. Aucun job de déploiement cloud n’est présent.

## Ce qui reste à valider

- Installation et lecture des quatre guides par un débutant sur une machine propre.
- Parcours Windows/WSL et variantes de distributions Linux.
- Infrastructure cloud, Kubernetes/Helm/GitOps et promotion entre environnements.
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
```

Les services de laboratoire restent démarrés après les scripts afin d’examiner les résultats. `docker compose down` les arrête en conservant les données. Les dossiers `preuves/` et `backups/` restent locaux et sont ignorés par Git. Les artefacts CI constituent des preuves temporaires ; leur durée de conservation figure dans le workflow.
