# Corrigé — conserver les données pendant la réconciliation

## Réponse attendue

Un Pod est une instance remplaçable. Le Deployment crée une nouvelle instance selon son modèle. Le Service choisit les Pods prêts correspondant à ses labels. Le PVC représente la demande de stockage persistante de PostgreSQL. Supprimer une instance de l’API ne supprime donc pas les données ; supprimer le PVC peut le faire.

```bash
source scripts/kube-env.sh
kubectl get pods -n taskboard-lab \
  -l app.kubernetes.io/component=api
kubectl get pvc -n taskboard-lab
```

Relevez le nom et l’UID d’un Pod API. Remplacez `POD_API` par son nom réel :

```bash
kubectl delete pod POD_API -n taskboard-lab
kubectl rollout status deployment/taskboard-api \
  -n taskboard-lab --timeout=180s
```

Le nouveau Pod possède une nouvelle identité. Relisez le témoin par le Service. Une réponse issue d’un ancien tunnel vers un Pod supprimé peut échouer : rouvrez le tunnel du Service si nécessaire. Une erreur de tunnel n’est pas une preuve de perte de la base.

```bash
kubectl delete pod taskboard-postgres-0 -n taskboard-lab
kubectl rollout status statefulset/taskboard-postgres \
  -n taskboard-lab --timeout=180s
kubectl get pvc data-taskboard-postgres-0 -n taskboard-lab
```

Cette fois, la disponibilité peut être interrompue brièvement : le laboratoire ne possède qu’un PostgreSQL. Le PVC doit garder son UID et la tâche ses trois champs. Deux API n’assurent pas la haute disponibilité d’une base unique.

Pour la dérive, la consigne à un réplica contredit les deux réplicas de Git. `selfHeal` demande à Argo de corriger cette différence. Une modification durable doit passer par le fichier de valeurs et un commit. Ne mettez pas trois contrôleurs concurrents — Helm, Argo et une boucle shell — à corriger la même ressource.

## Grille de correction

- Pod remplacé et nouvel UID observé : preuve d’un remplacement effectif.
- PVC identique : preuve que le stockage demandé a été conservé.
- Témoin `id`, `title`, `created_at` identique : preuve métier de continuité.
- Digest attendu et `/version` cohérent : preuve de la livraison réellement servie.
- Commit Git comparé et opération `Succeeded` : preuve de réconciliation.
- Limites expliquées : un cluster local, un nœud et une base unique ne constituent pas une production répartie sur plusieurs zones.

Le programme de recette vérifie ces invariants. Un dossier contenant seulement des captures de Pods verts reste insuffisant. À l’inverse, expliquez un échec précisément : contexte, commande, état observé, hypothèse, vérification, correction et preuve de retour.
