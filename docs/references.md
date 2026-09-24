# Références du livre — Édition 2027

Les sources ci-dessous accompagnent les chapitres de **Devenir DevOps — De zéro à la production**, de Nicolas Hedoire. Cette page rend les liens accessibles aux lecteurs du livre imprimé. Les documentations peuvent évoluer ; les versions des outils du laboratoire sont fixées dans le compagnon. Préparation : septembre 2026.

## 01 — Le métier DevOps

- [Google SRE — Introduction](https://sre.google/sre-book/introduction/)
- [DORA — Guides](https://dora.dev/guides/)

## 02 — Votre première application

- [Node.js 24 — HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html)
- [npm — npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci)

## 03 — Linux sous le capot

- [systemd — systemd.service](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html)
- [GNU Coreutils — File permissions](https://www.gnu.org/software/coreutils/manual/html_node/File-permissions.html)
- [OpenSSH — Manuels](https://www.openssh.com/manual.html)

## 04 — Le trajet d’une requête

- [MDN — Vue d’ensemble de HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)
- [Nginx — Module proxy HTTP](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [curl — Manuel](https://curl.se/docs/manpage.html)

## 05 — Git et l’histoire du changement

- [Git — commandes et modèle d’utilisation](https://git-scm.com/docs/git)
- [Git — restaurer le travail et l’index](https://git-scm.com/docs/git-restore)
- [Git — annuler un commit par un nouveau commit](https://git-scm.com/docs/git-revert)

## 06 — Docker de l’image au conteneur

- [Docker — bonnes pratiques de construction](https://docs.docker.com/build/building/best-practices/)
- [Docker — démarrage, ports et limites des conteneurs](https://docs.docker.com/engine/containers/run/)
- [Docker — environnement de développement Node.js](https://docs.docker.com/guides/nodejs/develop/)

## 07 — Des données qui survivent

- [Docker — ordre de démarrage des services](https://docs.docker.com/compose/how-tos/startup-order/)
- [Docker — propriétés des services Compose](https://docs.docker.com/reference/compose-file/services/)
- [PostgreSQL 17 — sauvegarde logique avec pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)
- [PostgreSQL 17 — restauration avec pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html)
- [Docker — suppression d’un ensemble Compose et de ses volumes](https://docs.docker.com/reference/cli/docker/compose/down/)

## 08 — Une livraison vérifiable

- [GitHub Actions — syntaxe des workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub Actions — utilisation sécurisée](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub Actions — authentification OIDC](https://docs.github.com/en/actions/concepts/security/openid-connect)

## 09 — Les frontières du cloud

- [AWS — réseau VPC](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html)
- [AWS — pratiques IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS CLI — authentification IAM Identity Center](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)
- [AWS — budgets et délais de notification](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)
- [Google Cloud — comparaison AWS, Azure et Google Cloud](https://docs.cloud.google.com/docs/get-started/aws-azure-gcp-service-comparison)

## 10 — Décrire son infrastructure

- [OpenTofu — état](https://opentofu.org/docs/language/state/)
- [Fournisseur local — fichier géré](https://registry.terraform.io/providers/hashicorp/local/latest/docs/resources/file)
- [Terraform — verrouillage des dépendances](https://developer.hashicorp.com/terraform/language/files/dependency-lock)
- [OpenTofu — stockage et verrouillage](https://opentofu.org/docs/language/state/backends/)
- [OpenTofu — chiffrement de l’état et des plans](https://opentofu.org/docs/language/state/encryption/)
- [OpenTofu — plans et application des changements](https://opentofu.org/docs/cli/commands/apply/)

## 11 — Kubernetes et l’état désiré

- [Options de mise à jour Helm 4](https://helm.sh/docs/helm/helm_upgrade/)
- [Installation et usage de kind](https://kind.sigs.k8s.io/docs/user/quick-start/)
- [Objets de charge de travail](https://kubernetes.io/docs/concepts/workloads/controllers/)
- [Sondes de disponibilité et de vitalité](https://kubernetes.io/docs/concepts/workloads/pods/probes/)

## 12 — Configurer les services Kubernetes

- [Secrets Kubernetes](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Horizontal Pod Autoscaling](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/)
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Gateway API](https://gateway-api.sigs.k8s.io/)

## 13 — Helm et les déploiements paramétrables

- [Chart Template Guide](https://helm.sh/docs/chart_template_guide/)
- [helm upgrade](https://helm.sh/docs/helm/helm_upgrade/)
- [helm rollback](https://helm.sh/docs/helm/helm_rollback/)

## 14 — GitOps avec Argo CD

- [Installation Argo CD](https://argo-cd.readthedocs.io/en/stable/getting_started/)
- [Synchronisation automatique](https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/)
- [Rendu Helm](https://argo-cd.readthedocs.io/en/stable/user-guide/helm/)
- [AppProjects](https://argo-cd.readthedocs.io/en/stable/user-guide/projects/)

## 15 — Observer pour comprendre

- [Prometheus : histogrammes et quantiles](https://prometheus.io/docs/practices/histograms/)
- [Prometheus : fonctions PromQL](https://prometheus.io/docs/prometheus/latest/querying/functions/)
- [OpenTelemetry JavaScript : instrumentation](https://opentelemetry.io/docs/languages/js/instrumentation/)
- [OpenTelemetry Collector : configuration](https://opentelemetry.io/docs/collector/configuration/)
- [Loki : ingestion OpenTelemetry](https://grafana.com/docs/loki/latest/send-data/otel/)
- [Grafana : provisionnement](https://grafana.com/docs/grafana/latest/administration/provisioning/)

## 16 — La fiabilité avec la SRE

- [Google SRE : mettre en œuvre des SLO](https://sre.google/workbook/implementing-slos/)
- [Google SRE : alertes fondées sur les SLO](https://sre.google/workbook/alerting-on-slos/)
- [Prometheus : règles d’alerte](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)
- [Alertmanager : configuration](https://prometheus.io/docs/alerting/latest/configuration/)

## 17 — La sécurité dans chaque changement

- [OWASP : autorisation](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP : gestion des secrets](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [PostgreSQL : privilèges](https://www.postgresql.org/docs/17/ddl-priv.html)
- [Kubernetes : Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)

## 18 — Conduire un incident

- [Google SRE : réponse aux incidents](https://sre.google/workbook/incident-response/)
- [Google SRE : culture des postmortems](https://sre.google/sre-book/postmortem-culture/)
- [Kubernetes : disruptions et PodDisruptionBudget](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/)
- [PostgreSQL : sauvegarde et restauration](https://www.postgresql.org/docs/17/backup.html)

## 19 — La plateforme au service des équipes

- [Platforms White Paper](https://tag-app-delivery.cncf.io/whitepapers/platforms/)
- [Software Catalog](https://backstage.io/docs/features/software-catalog/)
- [format des descripteurs](https://backstage.io/docs/features/software-catalog/descriptor-format/)
- [livraison plateforme exécutée en CI](https://github.com/nicolashedoire/devenir-devops/actions/runs/36010610896)

## 20 — IA agents et MCP en opérations

- [spécification du 25 novembre 2025](https://modelcontextprotocol.io/specification/2025-11-25)
- [outils et schémas d'appel](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [autorisation](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [bonnes pratiques de sécurité](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices)

## 21 — Assembler la production

- [modèle des ressources](https://gateway-api.sigs.k8s.io/docs/concepts/api-overview/)
- [fiabilité d'Amazon EKS](https://docs.aws.amazon.com/eks/latest/best-practices/reliability.html)
- [restaurer RDS à un instant choisi](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html)
- [ingestion de logs OpenTelemetry](https://grafana.com/docs/loki/latest/send-data/otel/)
- [recette opérations exécutée en CI](https://github.com/nicolashedoire/devenir-devops/actions/runs/36009530009)

## 22 — Prouver ses compétences

- [présenter un dépôt avec un README](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)
- [détection de secrets](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)
