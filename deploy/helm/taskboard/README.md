# Chart TaskBoard — laboratoire Kubernetes local

Ce chart déploie l’API 0.2.0, une migration indépendante et PostgreSQL 17. Il vise un cluster Kind local avec Kubernetes 1.32 ou ultérieur et une StorageClass par défaut. Les images sont désignées par digest SHA-256. Le chart ne crée aucun Ingress, LoadBalancer, NodePort ni Secret.

Le contrat décrit ici ne constitue pas une preuve d’exécution. Les résultats effectivement obtenus doivent être consignés dans `docs/validation.md` après les essais du parcours. Le rendu Helm et l’exécution Kubernetes sont deux vérifications différentes.

## Paramètres obligatoires et identité

Fournir `image.digest` avec le digest multiarchitecture publié et vérifié par le parcours, puis `database.existingSecret` avec le nom du Secret préexistant. Aucune valeur par défaut factice ne permet de contourner cette exigence. `image.repository` contient uniquement le dépôt, sans tag ni digest. Les valeurs finales sont validées par `values.schema.json`.

Le nom de release, limité à 40 caractères, détermine les noms Kubernetes. Avec la release `taskboard`, dans le namespace `taskboard` :

| Ressource | Nom / port |
|---|---|
| Deployment API | `taskboard-api`, deux répliques par défaut |
| Service API | `taskboard-api:3000`, ClusterIP |
| StatefulSet PostgreSQL | `taskboard-postgres`, une réplique |
| Service PostgreSQL | `taskboard-postgres:5432`, ClusterIP |
| Service headless | `taskboard-postgres-headless` |
| PVC | `data-taskboard-postgres-0`, 1 GiB par défaut |
| ServiceAccount | `taskboard`, aucun jeton automatiquement monté |
| Job en mode Helm | `taskboard-migrate-r<révision>` |
| Job en mode Argo CD | `taskboard-migrate` |

Le Secret doit être présent dans ce même namespace et comporter exactement les clés utilisées suivantes :

| Clé | Utilisation |
|---|---|
| `POSTGRES_USER` | Rôle créé à la première initialisation de PostgreSQL |
| `POSTGRES_PASSWORD` | Mot de passe de ce rôle |
| `POSTGRES_DB` | Base créée à la première initialisation |
| `DATABASE_URL` | Connexion de l’API et du Job, hôte `taskboard-postgres:5432` |

Ces quatre valeurs doivent être cohérentes. Les caractères réservés des identifiants dans l’URL doivent être encodés. Ne pas écrire le mot de passe dans un fichier de valeurs Helm, une commande `--set`, Git ou une capture. Le Secret reste extérieur au chart : sa rotation ne redémarre pas automatiquement les Pods et ne modifie pas le mot de passe déjà stocké par PostgreSQL. Une rotation exige de coordonner la modification du rôle dans la base, le Secret et le redémarrage des consommateurs.

Le laboratoire réutilise le rôle d’initialisation pour l’API et la migration. Une production séparerait le rôle applicatif limité du rôle autorisé à modifier le schéma. Le chart ne prétend pas fournir cette séparation.

## Installation Helm

Depuis la racine du dépôt, après création du namespace et du Secret par la procédure du parcours, fournir l’empreinte publiée dans la variable `TASKBOARD_DIGEST`. Cette empreinte est publique ; elle ne contient aucun secret.

```bash
: "${TASKBOARD_DIGEST:?Fournir le digest sha256 publié par le parcours}"
helm lint deploy/helm/taskboard \
  --set-string image.digest="$TASKBOARD_DIGEST" \
  --set-string database.existingSecret=taskboard-db

helm upgrade --install taskboard deploy/helm/taskboard \
  --namespace taskboard \
  --set-string image.digest="$TASKBOARD_DIGEST" \
  --set-string database.existingSecret=taskboard-db \
  --wait --wait-for-jobs --timeout 10m
```

Le Job Helm est une ressource ordinaire dont le nom change à chaque révision. Il peut donc être recréé lors d’une mise à jour malgré l’immutabilité du modèle de Pod d’un Job. L’ancienne ressource est retirée par Helm ; collecter ses journaux avant la mise à jour si l’on souhaite les conserver.

Le Job attend une connexion PostgreSQL, puis lance `npm run migrate` depuis la même image que l’API. La migration applicative conserve son registre, ses checksums et son verrou transactionnel. Chaque Pod API attend ensuite, en lecture seule, que la migration `001_init` corresponde au SQL présent dans son image et que les colonnes de `tasks` existent. Ce contrôle n’exécute aucune migration.

Ce Job n’utilise pas de hook Helm `post-install` : associé à `--wait`, un tel hook attendrait la disponibilité des Pods API alors que ceux-ci attendent le schéma. `--wait --wait-for-jobs` attend ici les ressources ordinaires, sans introduire cette dépendance circulaire. Un succès Helm ne remplace pas le test HTTP et le contrôle du témoin métier.

Le contrôle de schéma est volontairement borné à l’application 0.2.0 et à sa migration `001_init.sql`. Avant d’ajouter d’autres migrations, faire évoluer ce contrôle et tester les mises à jour avec des données conservées. Une migration incompatible reste dangereuse pour les anciens Pods actifs ; ce chart ne fournit pas de retour arrière automatique de la base.

## Import initial sans écriture concurrente

Pour reprendre les données du jalon Compose, déployer d’abord PostgreSQL seul :

```bash
helm upgrade --install taskboard deploy/helm/taskboard \
  --namespace taskboard \
  --set-string image.digest="$TASKBOARD_DIGEST" \
  --set-string database.existingSecret=taskboard-db \
  --set replicaCount=0 --set migration.enabled=false \
  --wait --wait-for-jobs --timeout 10m
```

Restaurer ensuite la sauvegarde selon la procédure du parcours et contrôler le témoin. Ce chart ne restaure rien de lui-même. Garder les écritures sur la source suspendues pendant le transfert. Reprendre la commande normale avec `--set replicaCount=2 --set migration.enabled=true` après validation de l’import. Conserver la source et sa sauvegarde jusqu’à la fin des vérifications. Une restauration qui inclut le registre de migration doit conserver le checksum de la migration originale.

## Réconciliation par Argo CD

Argo CD doit rendre ce chart avec `migration.mode=argocd`, le digest exact et le nom du Secret. Utiliser le nom de release `taskboard` pour conserver les interfaces ci-dessus. Le namespace et le Secret sont préparés avant la synchronisation ; le chart ne les prend pas en charge. Un seul outil doit piloter ces ressources à la fois : après leur adoption par Argo CD, les modifications se font dans sa source Git.

| Vague | Ressources / effet |
|---|---|
| `-2` | ServiceAccount, ConfigMap de contrôle, Services et StatefulSet PostgreSQL |
| `0` | Job marqué `argocd.argoproj.io/hook: Sync` |
| `1` | Deployment API |

La vague suivante attend la disponibilité des ressources précédentes. Le Job est un hook `Sync`, et non `PreSync`, afin que PostgreSQL puisse être créé lors de la première synchronisation. La politique `BeforeHookCreation` remplace le Job avant la prochaine exécution ; elle laisse le résultat courant disponible pour diagnostic. Une synchronisation complète exécute le hook. Une synchronisation sélective n’exécute pas les hooks : elle ne convient donc pas pour livrer une migration. Ne pas activer le mode Argo CD pour une installation pilotée exclusivement par Helm.

Pour un import initial piloté par Argo CD, committer d’abord `replicaCount: 0` et `migration.enabled: false`, synchroniser, restaurer et contrôler la sauvegarde, puis réactiver la migration et les deux répliques dans Git. Les waves ne remplacent ni la sauvegarde ni la validation de compatibilité du schéma.

## Disponibilité, données et limites

Les API s’exécutent avec l’UID 1000, PostgreSQL avec l’UID 999 de l’image Debian épinglée. Les conteneurs utilisent un système de fichiers racine en lecture seule, abandonnent toutes les capabilities et disposent uniquement de montages inscriptibles explicitement définis. Les répertoires temporaires sont des `emptyDir` ; seules les données PostgreSQL résident sur le PVC. Les probes API distinguent `/healthz` de `/readyz` : une base indisponible retire les Pods du Service sans transformer automatiquement cette dépendance en redémarrage du processus API.

Deux répliques API ne rendent pas PostgreSQL hautement disponible. Le StatefulSet conserve une seule base et le stockage local Kind dépend de son nœud. Les sauvegardes indépendantes restent nécessaires. Les migrations et API utilisent le même digest, mais le chart ne vérifie pas une signature de l’image.

La politique du StatefulSet conserve le PVC à la suppression du StatefulSet et à la réduction de ses répliques. Une désinstallation Helm retire les ressources applicatives et conserve ce PVC. Réinstaller avec le même nom de release, le même namespace et des identifiants cohérents permet de réutiliser les données. Changer le nom de release crée une autre identité de stockage. La suppression explicite du PVC, du namespace ou du cluster Kind reste destructrice ; `Retain` ne constitue pas une sauvegarde. Les modifications de taille ou de classe de stockage ne sont pas automatiquement gérées par ce chart.

Aucune NetworkPolicy n’est livrée : le réseau Kind par défaut ne doit pas être présenté comme un dispositif qui les applique. Une étape ultérieure doit choisir un CNI qui applique les politiques et vérifier les flux autorisés et refusés. Les Services ClusterIP ne garantissent pas une isolation entre workloads d’un même cluster.

L’API n’a pas d’authentification utilisateur. Pour l’atelier, ouvrir seulement un transfert local :

```bash
kubectl -n taskboard port-forward --address 127.0.0.1 \
  svc/taskboard-api 3000:3000
```

## Références officielles

- [Hooks Helm et ordre d’exécution](https://helm.sh/docs/topics/charts_hooks/).
- [Vagues de synchronisation Argo CD](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-waves/).
- [Hooks Argo CD et synchronisations sélectives](https://argo-cd.readthedocs.io/en/stable/user-guide/resource_hooks/).
- [StatefulSet et conservation des PVC](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/).
- [Probes Kubernetes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/).
