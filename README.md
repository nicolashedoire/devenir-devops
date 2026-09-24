# Devenir DevOps — le parcours TaskBoard

Apprendre à faire évoluer **la même application**, depuis votre ordinateur jusqu’à une livraison exploitable, en gardant des preuves à chaque étape.

Ce dépôt public accompagne **Devenir DevOps — De zéro à la production**. Il contient le projet pédagogique, les exercices et leurs corrigés. Le manuscrit du livre reste séparé.

**Préédition 0.2.0 :** les guides des jalons 01–04 sont disponibles ; les jalons 05–10 sont des contrats de réalisation. L’état réel des essais est tenu dans le [registre de validation](docs/validation.md). La présence d’un guide ne signifie pas qu’il a été exécuté sur toutes les machines.

## Commencer

La version de référence est **Node.js 24.19.0**. Aucun niveau d’anglais préalable n’est demandé : les explications sont en français, les commandes et messages réels sont conservés et expliqués. Lisez la [préparation de la machine](docs/demarrer.md) si Node, Git ou le terminal sont nouveaux pour vous.

```sh
git clone https://github.com/nicolashedoire/devenir-devops.git
cd devenir-devops
git switch --detach v0.2.0
npm run doctor
npm ci
npm test
env -u DATABASE_URL HOST=127.0.0.1 PORT=3000 FAULT_MODE=off npm start
```

La référence `v0.2.0` fige cette préédition ; `main` continuera d’évoluer. Le mode détaché permet de lire et exécuter cette version précise ; le jalon 02 créera votre branche de travail. Conservez un clone complet pour les exercices Git.

Ouvrez <http://127.0.0.1:3000>. Le serveur reste au premier plan ; `Ctrl+C` l’arrête. Sans base de données, les tâches disparaissent à l’arrêt : c’est l’expérience du [jalon 01](parcours/01-machine-local/README.md). La conservation commence au jalon 03 et devient ensuite une exigence permanente.

## Les dix jalons

| Jalon | Résultat visé | État éditorial |
| --- | --- | --- |
| [01 — Machine et application locale](parcours/01-machine-local/README.md) | Démarrer, lire HTTP et reconnaître le mode mémoire | Guide disponible |
| [02 — Linux, réseau et Git](parcours/02-linux-reseau-git/README.md) | Comprendre le processus, le port et un changement versionné | Guide disponible |
| [03 — Docker et PostgreSQL](parcours/03-docker-postgresql/README.md) | Conserver puis restaurer la tâche témoin | Guide disponible |
| [04 — CI et image traçable](parcours/04-ci-image/README.md) | Relier un commit, des essais et une image identifiée | Guide disponible |
| [05 — Cloud et OpenTofu](parcours/05-cloud-opentofu/README.md) | Provisionner et retirer une infrastructure bornée | À réaliser |
| [06 — Kubernetes, Helm et GitOps](parcours/06-kubernetes-helm-gitops/README.md) | Livrer sans perdre les données ni changer l’artefact | À réaliser |
| [07 — Observabilité](parcours/07-observabilite/README.md) | Relier métriques, journaux et traces | À réaliser |
| [08 — Sécurité, SRE et reprise](parcours/08-securite-sre-reprise/README.md) | Contrôler l’accès, alerter et rétablir | À réaliser |
| [09 — Recette de production](parcours/09-recette-production/README.md) | Vérifier un service complet sur une cible définie | À réaliser |
| [10 — Plateforme, MCP et portfolio](parcours/10-plateforme-mcp-portfolio/README.md) | Automatiser une offre, borner un agent et démontrer ses acquis | À réaliser |

Le [mode d’emploi](parcours/README.md) relie les jalons aux 22 chapitres. Terminez le résultat observable et la preuve de sortie d’un jalon avant de poursuivre. Les corrigés sont dans des fichiers séparés.

## Persistance et restauration

Après avoir arrêté le serveur local, et avec Docker disponible :

```sh
npm run doctor -- --docker
docker compose up -d --build
bash scripts/verify-compose.sh
bash scripts/backup-restore.sh
```

Le [jalon 03](parcours/03-docker-postgresql/README.md) explique ces actions et leurs effets. Compose lance PostgreSQL, applique une migration séparée puis démarre l’API. La restauration travaille dans une base distincte ; elle ne remplace pas votre base de départ.

`docker compose down` arrête le laboratoire en conservant son volume. **L’option `-v` supprime aussi les données : elle n’est pas utilisée dans le parcours normal.** Les sauvegardes et preuves locales ne sont pas destinées à Git.

## Contrat du projet

TaskBoard permet de créer et lire des tâches. Il fournit `/healthz` pour le processus, `/readyz` pour sa dépendance, `/version` pour la version exposée et `/metrics` pour les mesures. Une sonde verte ne garantit pas qu’un utilisateur peut accomplir son action. Le [contrat applicatif](docs/contrat-taskboard.md) décrit stockage, limites et tâche témoin.

Cette préédition n’a pas d’authentification utilisateur. L’accès du laboratoire reste lié à `127.0.0.1` ; le mot de passe Compose est public et réservé à cet exercice. La cible avec accès protégé est un livrable à construire, pas un mode déjà prêt à ouvrir au public.

## Se repérer

- `app/`, `db/migrations/`, `scripts/` : application, schéma et vérifications.
- `compose.yaml`, `Dockerfile` : environnement local avec PostgreSQL.
- `.github/workflows/ci.yml` : intégration continue et publication manuelle conditionnelle.
- `parcours/` : exercices, preuves de sortie et corrigés.
- `docs/` : préparation, conventions, glossaire et validation.
- `archive/legacy/` : anciens exemples Kubernetes et Helm, hors parcours actif.

Le [glossaire français–anglais](docs/glossaire.md) accompagne la lecture des outils. Pour proposer une correction, consultez [CONTRIBUTING.md](CONTRIBUTING.md). Le registre de preuves précise la portée de la validation.
