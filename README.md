# Devenir DevOps — le parcours TaskBoard

[![Vérification du parcours](https://github.com/nicolashedoire/devenir-devops/actions/workflows/ci.yml/badge.svg)](https://github.com/nicolashedoire/devenir-devops/actions/workflows/ci.yml)

Apprenez à livrer et exploiter **la même application**, en conservant une tâche témoin et des preuves à chaque étape. Les explications, exercices et corrigés sont en français ; le vocabulaire anglais professionnel est introduit progressivement.

Ce dépôt public accompagne **Devenir DevOps — De zéro à la production**, de Nicolas Hedoire. Le livre et ses fichiers éditoriaux restent séparés du code compagnon.

**Livraison du parcours 1.0.0 : les dix jalons disposent de guides exécutables et de corrigés.** La version applicative de TaskBoard reste **0.2.0** : ajouter des ateliers ne change pas automatiquement le serveur. Le [registre de validation](docs/validation.md) relie chaque essai à son commit, son environnement et ses limites. Le parcours principal se déroule localement ; l’extension de création AWS est rédigée, mais aucune exécution AWS réelle n’est revendiquée.

## Commencer

Préparez Git, un terminal POSIX, `curl` et **Node.js 24.19.0**. Docker peut attendre le jalon 03. Le [guide de préparation](docs/demarrer.md) explique les systèmes, les ressources machine et les outils des étapes suivantes. Aucun anglais préalable ni compte cloud n’est nécessaire pour commencer.

```sh
git clone https://github.com/nicolashedoire/devenir-devops.git
cd devenir-devops
git switch --detach v1.0.0
npm run doctor
npm ci
npm test
env -u DATABASE_URL HOST=127.0.0.1 PORT=3000 FAULT_MODE=off npm start
```

Le tag `v1.0.0` fixe le code de cette livraison ; `main` continue d’évoluer. L’état détaché de Git n’est pas une erreur : le jalon 02 vous fera créer une branche. Conservez l’historique complet du clone pour les exercices Git.

Ouvrez <http://127.0.0.1:3000>. `Ctrl+C` arrête le serveur. Les tâches sont d’abord en mémoire et disparaissent à l’arrêt : le [jalon 01](parcours/01-machine-local/README.md) vous fait observer ce comportement. La persistance commence au jalon 03 ; son témoin doit ensuite rester identifiable.

## Les dix jalons et les 22 chapitres

| Guide | Chapitres | Résultat observable |
| --- | --- | --- |
| [01 — Machine et application locale](parcours/01-machine-local/README.md) | 1–2 | Démarrage, réponses HTTP et perte en mémoire expliquée |
| [02 — Linux, réseau et Git](parcours/02-linux-reseau-git/README.md) | 3–5 | Processus, port et changement versionné compris |
| [03 — Docker et PostgreSQL](parcours/03-docker-postgresql/README.md) | 6–7 | Même tâche après remplacement de l’API ; restauration distincte |
| [04 — CI et image traçable](parcours/04-ci-image/README.md) | 8 | Commit, tests, image publiée et version exécutée reliés |
| [05 — Cloud et OpenTofu](parcours/05-cloud-opentofu/README.md) | 9–10 | Dérive locale corrigée ; extension AWS avec compte et coûts explicites |
| [06 — Kubernetes, Helm et GitOps](parcours/06-kubernetes-helm-gitops/README.md) | 11–14 | Import vérifié, Pods/PVC, réconciliation et promotion d’image |
| [07 — Observabilité](parcours/07-observabilite/README.md) | 15 | Métriques, journaux et traces HTTP → SQL corrélés |
| [08 — Sécurité, SRE et reprise](parcours/08-securite-sre-reprise/README.md) | 16–18 | HTTPS, refus d’accès, rotation, panne et notification reçue |
| [09 — Recette locale](parcours/09-recette-production/README.md) | 21 | Restauration comparée et critères d’acceptation vérifiés |
| [10 — Plateforme, MCP et portfolio](parcours/10-plateforme-mcp-portfolio/README.md) | 19–20, 22 | Offre contrôlée, protocole MCP borné et démonstration des acquis |

Le [mode d’emploi](parcours/README.md) explique l’ordre, les copies de données et les preuves de passage. Chaque guide précise ses prérequis et son nettoyage ; ouvrez le corrigé après votre tentative.

## Ce qui a été exécuté

Le socle comporte des tests applicatifs, des essais PostgreSQL de conservation et de restauration, ainsi qu’une publication d’image traçable. L’image référencée dans [deploy/image-reference.json](deploy/image-reference.json) possède des variantes Linux AMD64 et ARM64.

Les exécutions [Kubernetes/Helm/GitOps](https://github.com/nicolashedoire/devenir-devops/actions/runs/36016914638), [observabilité](https://github.com/nicolashedoire/devenir-devops/actions/runs/36014240703) et [sécurité, alertes et restauration](https://github.com/nicolashedoire/devenir-devops/actions/runs/36013187338) ont réussi. Elles concernent leurs commits et leurs données de laboratoire. La promotion entre deux références d’image possède ses contrôles distincts : consultez le [registre](docs/validation.md) pour leur état, ainsi que les registres [observabilité](observabilite/validation.md) et [opérations](operations/validation.md). Un test CI sur une fixture ne remplace pas l’import et la comparaison de votre propre témoin.

Les contrôles OpenTofu associent un fichier local réellement créé/réparé/retiré et des fournisseurs AWS simulés. Ils ne démontrent pas des permissions ou une création de ressources dans un compte AWS réel.

## Données et limites des laboratoires

Compose lance `db`, puis la migration séparée `migrate`, puis `api`. Les scripts de [persistance et restauration](parcours/03-docker-postgresql/README.md) conservent leurs preuves ; la restauration cible une autre base. `docker compose down` garde les volumes. **N’ajoutez pas `-v` pour une pause : cette option demande leur suppression.**

Les jalons Kubernetes, observabilité et opérations importent des **copies vérifiées** de la même source. Ils ne mettent pas en place une réplication continue. Les écritures ultérieures d’une copie ne retournent pas dans la source. Un namespace nommé `production` reste un environnement pédagogique local.

L’application ne fournit pas de comptes utilisateur individuels. Le laboratoire opérations ajoute une passerelle HTTPS, un jeton de groupe et des contrôles de base ; cela ne constitue pas un service public multitenant. Les accès restent locaux. Le [contrat applicatif](docs/contrat-taskboard.md) et chaque guide précisent les restrictions. La recette prépare un raisonnement de mise en service ; elle n’autorise aucune exposition publique automatique.

## Se repérer et signaler un erratum

- `app/`, `db/migrations/`, `scripts/` : application, schéma, outils et vérifications.
- `Dockerfile`, `compose.yaml` : premier laboratoire persistant.
- `infra/` : répétition locale, état S3 et fondations AWS sans serveur.
- `deploy/` : images, versions d’outils, chart Helm et déclarations GitOps.
- `observabilite/`, `operations/` : copies de laboratoire et guides détaillés.
- `platform/`, `scripts/platform/`, `scripts/mcp/` : offre locale et outils MCP.
- `parcours/`, `docs/` : guides, corrigés, glossaire et registres.
- `archive/legacy/` : anciens exemples, hors parcours actif.

Pour une erreur du livre ou du code, ouvrez une [issue](https://github.com/nicolashedoire/devenir-devops/issues) en indiquant le chapitre ou jalon, le tag, votre système, la commande, le résultat attendu et l’observation réelle. Retirez secrets et données personnelles. Les [conventions](docs/conventions.md), le [glossaire](docs/glossaire.md) et [CONTRIBUTING.md](CONTRIBUTING.md) complètent cette démarche. Les changements sont consignés dans [CHANGELOG.md](CHANGELOG.md).

## Licence

Le code, les configurations et les guides du compagnon sont sous [licence MIT](LICENSE). Le manuscrit, la couverture et les illustrations du livre restent exclus. Voir [le périmètre en français](docs/licence.md).
