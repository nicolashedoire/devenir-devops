# Historique du compagnon

## 1.0.0 — Parcours complet accompagné du livre, 24 septembre 2026

Les dix jalons disposent désormais de guides pratiques, d’incidents contrôlés et de corrigés. La version **1.0.0 désigne le compagnon pédagogique** ; TaskBoard conserve sa version applicative **0.2.0**. Les explications sont en français, avec introduction progressive du vocabulaire professionnel anglais.

- Kubernetes et Helm : copie contrôlée de PostgreSQL et du témoin, migration séparée, image fixée par digest, vérification métier et conservation des volumes.
- GitOps : environnements locaux gérés par Argo CD, promotion et retour d’image, panne de téléchargement et terminaison ciblée du hook bloqué ; onze contrôles supplémentaires rejouent les manipulations Kubernetes/Helm du livre.
- Observabilité : OpenTelemetry, Prometheus, Grafana, Loki et Tempo ; scénarios normal, lent et en erreur, parentage HTTP→SQL, journaux corrélés et alertes ; panne Collector et arrêt/reprise de la pile avec historique conservé.
- Sécurité et SRE : HTTPS de laboratoire, contrôle d’accès par jeton, privilèges SQL limités, rotation, panne de base, alerte, restauration et recette assorties de preuves.
- Plateforme et MCP : catalogue d’offre locale, génération contrôlée sans déploiement automatique, serveur MCP borné en lecture seule, client de démonstration et exercices de portfolio.
- Entrées du parcours actualisées : prérequis, correspondance avec les 22 chapitres, conservation de la tâche témoin et séparation entre source et copies de laboratoire.

Les validations publiées comprennent [Kubernetes, Helm et GitOps](https://github.com/nicolashedoire/devenir-devops/actions/runs/36016914638), [l’observabilité](https://github.com/nicolashedoire/devenir-devops/actions/runs/36014240703) et [les opérations et la recette](https://github.com/nicolashedoire/devenir-devops/actions/runs/36013187338). Le [registre](docs/validation.md) et les registres spécialisés précisent les commits, les environnements et les limites de chaque essai ; les résultats d’un workflow ne valent pas validation de toute installation possible.

L’extension AWS du jalon 05 reste **non exécutée sur un compte AWS réel**. Les noms d’environnements locaux, les tests et la passerelle de laboratoire ne suffisent pas à rendre TaskBoard exploitable comme service public de production. L’application ne possède pas de comptes utilisateurs ni d’autorisation par utilisateur.

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
