# 06 — Kubernetes, Helm et GitOps

Vous disposez d’une image immuable et d’une base PostgreSQL contenant la tâche témoin du jalon 03. Ce jalon transfère une copie vérifiée de ces données dans Kubernetes, puis confie deux environnements à Argo CD. Vous apprendrez à distinguer une ressource déclarée, un déploiement prêt et un résultat métier correct.

Le laboratoire reste sur votre ordinateur. Le namespace nommé `taskboard-production` sert à répéter une promotion ; son nom ne lui apporte ni plusieurs zones de disponibilité, ni accès public protégé. L’ouverture et la recette de sécurité arrivent aux jalons 08–09.

## État d’entrée et résultat attendu

Préparez Docker, Node.js 24.19.0 et Bash. Sous Windows, utilisez WSL2 avec l’intégration Docker. Prévoyez au moins 8 Gio de mémoire attribuée à Docker, 12 Gio conseillés pour ce jalon, et 15 Gio d’espace libre. Arrêtez les autres ateliers lourds avant de continuer. Les paramètres de la machine influencent le temps nécessaire ; un délai dépassé doit être diagnostiqué.

La base source du jalon 03 doit encore exister. `preuves/tache-temoin.json` contient les trois champs exacts renvoyés par l’API : `id`, `title`, `created_at`. Si vous avez utilisé le script automatisé du jalon 03, copiez son fichier `preuves/verify-compose-…/tache-temoin.json` vers ce chemin. Ne recréez pas une tâche pour remplacer silencieusement un témoin perdu.

À la sortie, trois preuves doivent coïncider : le digest déployé, le commit indiqué par `/version` et la tâche témoin. Une nouvelle adresse IP de Pod est normale ; un nouvel identifiant de tâche ne l’est pas.

## 1. Installer et isoler les outils

Depuis la racine du dépôt :

```bash
node scripts/install-kube-tools.mjs
source scripts/kube-env.sh
kind version
helm version
kubectl version --client
node scripts/kube-lab.mjs init
```

Les binaires sont téléchargés depuis leurs projets officiels, vérifiés par SHA-256 puis placés dans `work/bin`. Les versions sont inscrites dans `deploy/tools-lock.json` : kind 0.33.0, Kubernetes et kubectl 1.35.8, Helm 4.3.0. L’image du nœud Kubernetes est également fixée par digest.

Le kubeconfig est `work/kubeconfig-taskboard-lab`. Votre configuration habituelle `~/.kube/config` reste indépendante. Rechargez `source scripts/kube-env.sh` dans chaque terminal réservé à cet atelier. Vérifiez toujours :

```bash
kubectl config current-context
kubectl get nodes
```

Le contexte attendu est `kind-taskboard-lab`, le nœud devient `Ready`. Les programmes du compagnon refusent un contexte différent ou un serveur Kubernetes qui n’est pas local. Une commande kubectl saisie manuellement exige la même attention.

## 2. Lire le contrat avant de déployer

Ouvrez `deploy/helm/taskboard/values.yaml`, son schéma JSON et son README. Le chart définit : un StatefulSet PostgreSQL avec un PVC, trois Services internes, un Job migrateur et un Deployment API. Deux API partagent la même base ; elles ne possèdent pas chacune leur propre copie des tâches.

`deploy/image-reference.json` relie le dépôt d’image, son digest, les architectures, le commit source et l’exécution de publication. Un tag pratique comme `latest` peut changer. Un digest désigne le contenu précis à récupérer. Les images amd64 et arm64 ont chacune subi les tests avant d’être réunies dans l’index multiarchitecture.

Le Secret `taskboard-db` doit exister avant le chart. Il contient les paramètres PostgreSQL et l’URL de connexion. Le programme d’import le prépare avec un mot de passe aléatoire, sans le placer dans Git. Dans ce laboratoire, l’API partage encore l’identité propriétaire de la base : le jalon 08 introduit un rôle applicatif distinct et vérifie le refus du DDL. Un Secret Kubernetes n’est pas automatiquement un coffre chiffré.

## 3. Importer le témoin sans écraser une base existante

```bash
node scripts/kube-lab.mjs import \
  --witness preuves/tache-temoin.json \
  --namespace taskboard-lab
```

L’import crée une destination vide, installe PostgreSQL avec zéro API et désactive temporairement le migrateur. Si le namespace contient déjà un PVC, il refuse de recommencer : ce refus protège une destination dont l’état mérite d’être compris.

Pendant le snapshot, l’API Compose source est arrêtée si elle fonctionnait, puis son état de marche est rétabli dans une clause de nettoyage. Le programme compare le témoin à la source, exporte la base, restaure la copie et compare **toutes les lignes ainsi que la séquence d’identifiants**. Il conserve la sauvegarde dans un dossier de preuve privé, ignoré par Git.

Ensuite seulement, le programme réactive la migration et les deux API. Le migrateur reconnaît la migration déjà appliquée et vérifie son checksum. Les init containers attendent le schéma sans effectuer de DDL. La vérification finale relit le témoin par HTTP dans l’API Kubernetes. Le message `Import vérifié` est accompagné du chemin de `resultat.json`.

Une copie n’est pas une réplication continue. Les nouvelles écritures dans Compose ne sont pas transmises à Kubernetes ; les nouvelles écritures Kubernetes ne retournent pas dans Compose. Le témoin établit une continuité à l’instant du snapshot. Une vraie bascule nécessite aussi un arrêt maîtrisé des écritures et une désignation explicite de la nouvelle source d’autorité.

## 4. Observer les ressources et le résultat métier

```bash
kubectl get pods,services,jobs,pvc -n taskboard-lab
kubectl logs -n taskboard-lab job/taskboard-migrate-r2
kubectl rollout status -n taskboard-lab \
  deployment/taskboard-api --timeout=180s
kubectl port-forward --address 127.0.0.1 \
  -n taskboard-lab svc/taskboard-api 3006:3000
```

Le nom `r2` correspond au deuxième passage Helm de l’import initial. Après un autre upgrade, cherchez le nouveau nom dans `kubectl get jobs`. Un Job terminé n’est pas un service qui doit rester en marche.

Conservez le tunnel ouvert et utilisez un autre terminal :

```bash
curl --fail http://127.0.0.1:3006/readyz
curl --fail http://127.0.0.1:3006/version
node -p "JSON.parse(require('fs').readFileSync('preuves/tache-temoin.json')).id"
```

Relisez `/api/tasks/IDENTIFIANT` avec l’identifiant affiché. Comparez les trois champs au fichier témoin. Le port 3006 évite le port 3000 de Compose. `Ctrl+C` ferme le tunnel sans arrêter les Pods.

## 5. Une panne contrôlée : la nouvelle image n’existe pas

Avant l’incident, relevez une révision réussie :

```bash
helm history taskboard -n taskboard-lab
helm upgrade taskboard deploy/helm/taskboard \
  -n taskboard-lab \
  -f work/kubernetes/values-taskboard-lab.json \
  --set-string image.digest=sha256:0000000000000000000000000000000000000000000000000000000000000000 \
  --wait --wait-for-jobs --timeout=90s
```

L’échec est attendu. La forme du digest est correcte ; aucun contenu ne correspond à cette référence. La stratégie de mise à jour peut garder les anciennes API disponibles. Une réponse HTTP correcte ne suffit donc pas à déclarer la nouvelle livraison réussie.

```bash
kubectl get pods,jobs -n taskboard-lab
kubectl get events -n taskboard-lab \
  --sort-by=.metadata.creationTimestamp
helm history taskboard -n taskboard-lab
```

Recherchez les erreurs de récupération d’image. Si aucun conteneur n’a démarré, il peut n’exister aucun journal applicatif. Remplacez `REVISION_OK` par la révision saine réellement relevée :

```bash
helm rollback taskboard REVISION_OK -n taskboard-lab \
  --wait --wait-for-jobs --timeout=180s
```

Relisez `/version` et le témoin. Le retour arrière remet une configuration de ressources ; il ne remonte pas le temps pour la base de données. Gardez le même PVC.

## 6. Préparer deux environnements GitOps

Pour modifier les valeurs et pratiquer une promotion, créez votre fork public du dépôt sur GitHub. Le programme n’a besoin que d’une lecture publique pour Argo CD ; il ne reçoit jamais votre jeton personnel. Dans votre copie locale, vérifiez que `origin` désigne votre fork avant tout push.

```bash
git remote -v
git switch -c parcours-devops v1.0.0
git push -u origin parcours-devops
```

Si vous avez déjà créé cette branche, utilisez `git switch parcours-devops`. La branche du livre reste distincte de votre branche principale. Remplacez `VOTRE_COMPTE` ci-dessous par votre compte GitHub.

```bash
node scripts/kube-lab.mjs import \
  --witness preuves/tache-temoin.json \
  --namespace taskboard-recette
node scripts/kube-lab.mjs import \
  --witness preuves/tache-temoin.json \
  --namespace taskboard-production
node scripts/gitops-lab.mjs install \
  --repo https://github.com/VOTRE_COMPTE/devenir-devops.git \
  --revision parcours-devops
node scripts/gitops-lab.mjs verify
```

Les deux bases sont indépendantes et contiennent le même snapshot initial. Une promotion déplace une **référence d’image**, pas les données de recette vers la production.

L’installation récupère Argo CD 3.5.3 avec une empreinte vérifiée et utilise l’application côté serveur nécessaire aux grandes définitions de ressources. L’AppProject autorise seulement le dépôt choisi, les deux namespaces et les types de ressources du chart. Les Secrets sont préparés hors Git. Les fichiers `deploy/gitops/apps/*.json` décrivent les Applications ; `deploy/gitops/environments/*/values.yaml` contient les valeurs.

Après l’import Helm, les ressources peuvent déjà être identiques aux manifests Git. Argo pourrait alors afficher `Synced` sans avoir encore exécuté de synchronisation. Le programme déclenche une première opération explicite d’adoption, puis exige son statut `Succeeded`, en plus de `Synced` et `Healthy`. Le Job de migration Argo s’exécute en vague 0, après PostgreSQL en vague −2 et avant les API en vague 1.

Dès l’adoption, évitez les upgrades Helm concurrents dans ces deux namespaces : Git possède désormais l’état souhaité. La release de démonstration `taskboard-lab` reste disponible pour les exercices Helm.

## 7. Constater une dérive puis sa correction

```bash
kubectl scale deployment/taskboard-api \
  -n taskboard-recette --replicas=1
kubectl get deployment taskboard-api -n taskboard-recette
kubectl annotate application taskboard-recette -n argocd \
  argocd.argoproj.io/refresh=hard --overwrite
kubectl wait -n taskboard-recette \
  '--for=jsonpath={.spec.replicas}=2' \
  deployment/taskboard-api --timeout=180s
```

Le premier changement contourne Git. La réconciliation retrouve ensuite deux réplicas, car `selfHeal` est activé. Si votre modification disparaît, ne relancez pas indéfiniment la même commande : recherchez le contrôleur propriétaire. Les changements durables s’écrivent dans le fichier de valeurs puis dans un commit.

## 8. Promouvoir une image testée et revenir par Git

Le dossier `deploy/image-candidates` contient une autre reconstruction vérifiée de TaskBoard. Son code métier reste équivalent : l’exercice porte sur l’identité de livraison et la conservation des données. Consultez la preuve de publication indiquée dans sa référence avant de l’utiliser.

```bash
node scripts/promote-image.mjs recette \
  deploy/image-candidates/reconstruction.json
git diff -- deploy/gitops/environments/recette/values.yaml
git add deploy/gitops/environments/recette/values.yaml
git commit -m "Promouvoir l’image vérifiée en recette"
git push
```

Attendez que l’Application signale le nouveau commit et une opération réussie. Ouvrez un tunnel sur son Service, puis comparez `/version`, le digest du Deployment et le témoin. Ne recopiez pas seulement le mot `Healthy` dans votre preuve : relevez le commit Git effectivement comparé et la révision de l’image effectivement servie.

Une fois la recette démontrée, répétez la commande de promotion avec `production`, créez un commit distinct et poussez. C’est le même digest ; aucune nouvelle construction n’a lieu. Pour revenir en arrière, relevez l’identifiant du commit de promotion production et exécutez :

```bash
git revert IDENTIFIANT_DU_COMMIT_DE_PROMOTION
git push
```

Git conserve la décision et son annulation. Argo applique la déclaration restaurée. Vérifiez encore l’image et le témoin. L’existence d’un commit de retour arrière ne prouve pas que le contrôleur l’a déjà réconcilié.

## 9. Diagnostiquer dans le bon ordre

| Observation | Hypothèse à tester | Preuve utile |
| --- | --- | --- |
| Aucun nœud prêt | Ressources Docker ou démarrage du cluster | État kind, espace libre, événements du nœud |
| PVC en attente | Classe de stockage ou provisionnement | Description PVC et événements |
| Job en échec | Connexion, schéma ou checksum | Logs du Job et Secret nommé, sans afficher sa valeur |
| `ImagePullBackOff` | Référence absente ou accès au registre | Digest demandé, événement de récupération |
| API vivante mais non prête | PostgreSQL ou schéma indisponible | `/healthz`, `/readyz`, logs et état PostgreSQL |
| Argo refuse un objet | Contrat AppProject trop restreint ou ressource inattendue | Condition de l’Application et type de ressource |
| `Synced` sans changement servi | Adoption non effectuée, commit ancien ou test incomplet | Opération, révision Git et `/version` |

Une NetworkPolicy présente dans un manifeste n’est pas une preuve de filtrage. Le CNI kind de ce laboratoire n’applique pas ces politiques. Les exercices de refus d’accès du jalon 08 apportent d’autres contrôles concrets ; pour un cluster de production, choisissez et testez un moteur réseau qui applique la politique retenue.

## 10. Questions, challenge et preuve de passage

Expliquez à voix haute la différence entre Pod, Deployment, Service et PVC. Pourquoi l’API peut-elle être remplacée sans perdre une tâche ? Pourquoi une mise à jour de base peut-elle rendre un retour d’image impossible ? Pourquoi Argo CD a-t-il besoin d’un commit et d’une opération réussie pour documenter une livraison ?

**Challenge.** Remplacez un Pod API, puis le Pod PostgreSQL, sans supprimer le PVC. Prouvez ensuite la correction de la dérive de capacité en recette. Votre dossier doit contenir les identités des ressources remplacées, le PVC conservé, le digest et la même tâche. Le [corrigé](corrige.md) précise le raisonnement et les commandes.

Le programme `node scripts/verify-kubernetes.mjs preuves/tache-temoin.json` réalise cette recette sur les références initiales du dépôt. Exécutez-le avant la promotion ou après avoir rétabli ces références. Il écrit ses résultats sous `preuves/` et ne remplace pas l’explication de ce que vous avez observé.

## 11. Conserver et arrêter

Fermez les tunnels avec `Ctrl+C`. Les volumes Kubernetes appartiennent au cluster kind : supprimer le cluster ou son conteneur peut supprimer ces données. Exportez une sauvegarde et vérifiez sa restauration avant tout retrait. `helm uninstall` conserve le PVC du chart, mais ce mécanisme ne protège pas d’une suppression du namespace ou du cluster.

Conservez au minimum le témoin, les résultats d’import, les commits de promotion et de retour, la référence d’image et les preuves de restauration. Gardez les dumps et les secrets hors du dépôt public. Le [registre de validation](../../docs/validation.md) distingue les résultats déjà observés et les exercices qui nécessitent encore votre propre preuve.
