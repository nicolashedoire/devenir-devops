# Mode d’emploi des dix jalons

Vous faites évoluer TaskBoard à chaque étape. Les deux premiers jalons enseignent l’exécution locale avec des données temporaires. Le troisième introduit PostgreSQL et la tâche témoin à conserver jusqu’à la recette finale.

**Préédition 0.3.0 :** les guides 01–05 sont disponibles ; 06–10 restent à réaliser. Le jalon 05 comprend des tests locaux et simulés ; la création, la dérive et le retrait sur un vrai compte AWS restent à attester. Le [registre](../docs/validation.md) indique les essais réels. Aucun temps de réalisation n’est présenté comme mesuré sans observation.

| Jalon | Chapitres | Preuve de passage |
| --- | --- | --- |
| [01 — Machine et local](01-machine-local/README.md) | 1–2 | Réponse HTTP, création/lecture, perte en mémoire expliquée |
| [02 — Linux, réseau, Git](02-linux-reseau-git/README.md) | 3–5 | Processus et port identifiés ; changement relu puis annulé par Git |
| [03 — Docker et PostgreSQL](03-docker-postgresql/README.md) | 6–7 | Même tâche après recréation de l’API et restauration séparée |
| [04 — CI et image traçable](04-ci-image/README.md) | 8 | Commit, contrôles et image reliés par leurs identifiants |
| [05 — Cloud et OpenTofu](05-cloud-opentofu/README.md) | 9–10 | Fondations créées, dérive corrigée et retrait démontré |
| [06 — Kubernetes, Helm, GitOps](06-kubernetes-helm-gitops/README.md) | 11–14 | Même donnée, même digest, promotion et retour arrière |
| [07 — Observabilité](07-observabilite/README.md) | 15 | Requête corrélée dans mesures, journaux et traces |
| [08 — Sécurité, SRE, reprise](08-securite-sre-reprise/README.md) | 16–18 | Accès refusé, alerte utile et restauration chronométrée |
| [09 — Recette](09-recette-production/README.md) | 21 | Matrice d’acceptation et preuves de reprise |
| [10 — Plateforme, MCP, portfolio](10-plateforme-mcp-portfolio/README.md) | 19–20, 22 | Libre-service, outil borné testé et portfolio reproduit |

Lisez l’état d’entrée. Exécutez les étapes en observant chaque résultat. Faites l’incident uniquement dans le laboratoire indiqué, puis prouvez le retour à l’état normal. Répondez au challenge avant d’ouvrir `corrige.md`. Conservez une [fiche de preuve](../docs/preuves.md).

Les étapes suivantes ne doivent pas réinitialiser l’application pour contourner une difficulté. Si un changement de stockage est nécessaire, exportez et restaurez les données, puis comparez la tâche témoin avant toute bascule. Même titre et nouvel identifiant ne prouvent pas une conservation.

Un contrat 06–10 décrit un résultat, des fichiers à construire, des incidents et les preuves exigées. Il ne fournit pas un tutoriel achevé. Les anciens exemples de `archive/legacy/` ne remplacent pas ses livrables manquants : le chart historique, notamment, fonctionne en mémoire.

L’ordre est volontaire : installation, système, persistance, livraison traçable, infrastructure, déploiement, observation, protection et reprise, recette, puis plateforme et agents. Les contrôles de sécurité de base accompagnent toutes les étapes ; l’accès public attend la recette protégée.
