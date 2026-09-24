# Historique du compagnon

## 0.3.0 — Jalon cloud, préédition du 24 septembre 2026

Le jalon 05 fournit désormais un guide complet, son corrigé, une répétition locale avec dérive, un stockage d’état S3 et des fondations réseau AWS sur deux zones. Aucun serveur, NAT, cluster ou base RDS n’est lancé par ces fondations. TaskBoard reste local et en version applicative 0.2.0.

Les versions d’OpenTofu et des fournisseurs sont verrouillées. Les outils ajoutés vérifient l’identité attendue, les ressources d’un plan et la séparation entre retrait du réseau et conservation des états. Le guide distingue les essais locaux/simulés de la validation AWS réelle, qui reste à mener sur un compte de laboratoire autorisé. Les étapes 06–10 restent des contrats de réalisation.

## 0.2.0 — Préédition du 24 septembre 2026

- Parcours en français organisé en dix jalons ; quatre guides pratiques et leurs corrigés séparés.
- Glossaire pour apprendre progressivement le vocabulaire technique anglais.
- Contrôle préalable de la machine, test fonctionnel créant une tâche témoin et endpoint de version.
- Migration PostgreSQL explicite, idempotente et vérifiée par empreinte.
- Vérification de persistance après remplacement de l’API et restauration dans une base distincte.
- CI avec preuves téléchargeables ; publication manuelle de l’image effectivement testée, sans reconstruction.
- Anciens exemples Kubernetes et Helm conservés dans une archive clairement séparée.

La version 0.2.0 prépare le parcours de référence. Elle n’inclut pas encore un déploiement cloud, l’authentification utilisateur, une plateforme ou un serveur MCP. Les critères des jalons suivants et la portée exacte des essais sont documentés.
