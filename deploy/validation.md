# Validation Kubernetes, Helm et GitOps

La [recette du 24 septembre 2026](https://github.com/nicolashedoire/devenir-devops/actions/runs/36016914638) a réussi sur le commit `efc8209f704184efcc83926e5d356b345ac8404f`, sous Ubuntu 24.04 / Linux AMD64. Les versions et empreintes des outils sont fixées dans `tools-lock.json`. Le moteur local de l’auteur n’a pas été sollicité par cette recette.

## Parcours et persistance

Une source Compose contenant une tâche synthétique est créée pour le test. Les trois imports vers `taskboard-lab`, `taskboard-recette` et `taskboard-production` comparent toutes les lignes, la séquence et les champs du témoin. Les six contrôles de `scripts/verify-kubernetes.mjs` confirment image et témoin dans les trois namespaces, remplacement du Pod API, remplacement du Pod PostgreSQL avec le même PVC, puis réparation d’une dérive de capacité par Argo CD. L’adoption exige une opération `Succeeded`, en plus de `Synced` et `Healthy`.

Le script `scripts/verify-reader-kubernetes.mjs` a réussi les onze cas suivants :

| Cas | Observation exigée et obtenue |
|---|---|
| 1 | Tunnel local 3006, disponibilité PostgreSQL, version et témoin exacts |
| 2 | Suppression de tous les Pods API, nouvelles identités et données intactes |
| 3 | Trois API interrogées directement, même témoin |
| 4 | Remplacement d’un seul Pod parmi trois sans perte de données |
| 5 | Requests 100m/128Mi et limits 500m/256Mi réellement appliquées |
| 6 | Faux sélecteur : zéro destination, échec du Service, lecture directe au Pod correcte |
| 7 | Sélecteur restauré, destinations puis lecture revenues |
| 8 | Lint et rendu Helm à trois API acceptés ; cinq refusé par le schéma |
| 9 | Digest absent, commande du livre avec wait-for-jobs et délai de 90 s, échec attendu |
| 10 | Rollback exact, image initiale et témoin contrôlés par tunnel |
| 11 | Valeurs Helm normales retrouvées, deux API, même PVC et même témoin |

Le fichier `lecteur-kubernetes-1790262133860/resultat.json` date ces contrôles du 24 septembre, 15:02:13.861 à 15:04:35.494 UTC. La panne Helm indique `ImagePullBackOff` et `PodInitializing` : un conteneur initial peut être bloqué avant le démarrage de l’API. Un ancien Pod disponible ne transforme pas la nouvelle livraison en succès.

Les premières tentatives ont reproduit un conflit de propriété avec Helm 4 après une modification de `replicas` au terminal. Le retour de laboratoire reprend volontairement les champs connus avec `--force-conflicts`, sans `--force-replace`. Les sondes attendent séparément destinations et lecture du Service, dans une fenêtre bornée. Le diagnostic conserve le statut HTTP même lorsqu’une réponse ne se décode pas en JSON.

## Promotion et retour

`scripts/verify-gitops-promotion.mjs` vérifie quatre étapes : candidat en recette, candidat en production, retour en recette, retour en production. À chaque étape, le digest exécuté, la révision servie et le témoin sont comparés. Les références sont :

- image initiale : `sha256:12ea642202176da67ad6f4244f8ec01840db11b0a883ca39304a281c2d749d63` ; source `819be000ad7499955a5772eaa847b275ba52c8b2` ;
- reconstruction candidate : `sha256:bf5a8ddbeddf5eeedfba3194b7743120640f341c87173978e297709a288b4977` ; source `0e1766c9b704867bf878437b9bdb3b091e30b1c1` ;
- configuration candidate : `c73b1a836c8a305f9d7b4cbe05655a36c16273fa` ; configuration de retour : `0e1766c9b704867bf878437b9bdb3b091e30b1c1`.

La CI lit ces deux configurations publiques préparées. Elle ne pousse aucun commit. Le challenge du lecteur crée, lui, un commit distinct par environnement dans son fork. Une recette locale séparée a exercé le générateur, ces deux commits, les pushes vers un dépôt local et l’annulation du seul second commit ; elle ne prétend pas à une publication publique depuis ce sous-test.

## Image GitOps introuvable

`scripts/verify-gitops-failure.mjs` utilise deux commits publics de la branche pédagogique `atelier/panne-gitops-verifiee` : panne `3e727aa22eebd1598be210028187430a5779fe77`, puis revert `3aa398311028c942dc836b722bf84bd865cb738c`. La seule configuration défectueuse concerne recette.

Entre 15:07:31.448 et 15:08:04.269 UTC, le test observe `database-ready` en `ErrImagePull` dans le Job de migration, l’opération encore `Running` et l’ancienne API conservant le témoin. Le retour Git n’annule pas automatiquement cette opération déjà engagée. Le script contrôle sa révision et sa phase avant de demander `Terminating`, puis exige une opération réussie du commit corrigé, la santé, le digest initial et les mêmes données. Il confirme ensuite production inchangée, PVC conservés et retour à la branche initiale. Le résultat se trouve dans `panne-gitops-1790262451448/resultat.json`.

La terminaison concerne un hook dont le processus n’a pas démarré, bloqué sur le téléchargement de l’image. Ce test ne constitue pas une procédure générale d’interruption d’une migration SQL active.

## Preuves et limites

L’artefact `kubernetes-gitops` de la recette contient les imports, les onze cas lecteur, le rollback Helm, les six contrôles Kubernetes, les quatre promotions/retours et les trois contrôles de panne GitOps, ainsi que le SHA du code. Il contient des données synthétiques et des résultats expurgés, pas les Secrets PostgreSQL. Les durées sont des observations du runner, pas des engagements de disponibilité.

Les trois namespaces se trouvent dans un cluster kind local au runner. Ils possèdent des copies indépendantes d’un snapshot ; ils ne répliquent pas les écritures de la source. Le PVC conservé ne prouve pas une reprise après perte du disque ou du serveur. Aucune validation EKS, RDS, réseau cloud, haute disponibilité multizone, exposition publique ni charge représentative n’est revendiquée. Un retour d’image ne restaure pas automatiquement un schéma ou des transactions SQL.
