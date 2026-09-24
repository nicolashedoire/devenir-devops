# Jalon 07 — Observer une même requête

**Chapitre 15.** Le laboratoire complet se trouve dans [`observabilite/`](../../observabilite/README.md) : Prometheus, Grafana, Collector OpenTelemetry, Loki, Tempo et une enveloppe instrumentée de TaskBoard. Il relie les journaux d’une requête à son span serveur HTTP et à son span client PostgreSQL.

## Problème et état d’entrée

Une réponse lente ou un statut 503 ne désignent pas, à eux seuls, la dépendance responsable. Vous disposez de TaskBoard persistant, d’une sauvegarde PostgreSQL 17 vérifiée et du JSON de la tâche témoin présente dans cette sauvegarde. Docker Compose et Node.js 24.19.0 doivent être disponibles ; prévoir plusieurs gigaoctets libres pour les images.

La source du parcours reste autoritative. Ce jalon restaure une **copie pédagogique**, dans le projet Docker distinct `taskboard-observabilite`. Il ne bascule aucun trafic de production. Les trois API d’observation accèdent à cette copie avec un rôle sans droit d’écriture. Le témoin conserve exactement son identifiant, son titre et son horodatage.

## Mise en pratique

Depuis la racine du dépôt, remplacer les chemins de l’exemple par votre sauvegarde et votre témoin :

```bash
bash observabilite/importer-snapshot.sh \
  backups/VOTRE-EXECUTION/taskboard.dump \
  preuves/tache-temoin.json

bash scripts/verify-observability.sh
```

La première commande refuse d’écraser une copie déjà remplie, restaure dans une transaction et contrôle le checksum de migration. La seconde construit l’image dédiée à l’instrumentation, démarre les composants et produit des lectures normales, lentes et en erreur. Le code, les dépendances et l’image applicative principale restent indépendants de ce laboratoire.

Ouvrir [le tableau de bord local](http://127.0.0.1:3300/d/taskboard-observabilite). Les API normale, lente et en erreur écoutent respectivement sur les ports 3010, 3011 et 3012, exclusivement sur `127.0.0.1`. Le [guide complet](../../observabilite/README.md) explique chaque flux, les paramètres, les requêtes et les limites.

## Résultats à vérifier

Le script doit finir avec un code de sortie nul et le nouveau fichier `observabilite/preuves/verification-XXXXXX/resultat.json` doit porter `statut: valide`. Il vérifie la tâche témoin, les réponses 200/200/503, la lenteur, les histogrammes, les alertes déclenchées, le provisionnement Grafana et la corrélation trace/journal. La preuve d’import est distincte : `observabilite/imports/resultat.json`.

Le parentage exporté et contrôlé est **serveur HTTP → client PostgreSQL**. Le générateur de trafic ne produit pas de span client HTTP. La prise en charge d’un contexte `traceparent` entrant ne doit pas être confondue avec la livraison d’un client instrumenté complet.

## Pannes et diagnostic

Le scénario lent attend avant d’interroger la base : comparer la durée du span HTTP à celle du span SQL. Le scénario erreur renvoie 503 avant l’appel SQL : une trace sans span SQL aide à réfuter une accusation prématurée contre PostgreSQL. Les règles rapides servent à apprendre ; leurs seuils ne constituent pas des SLO de production.

Le guide propose aussi d’arrêter seulement le Collector, puis de le redémarrer. Les métriques Prometheus peuvent continuer d’arriver alors que les traces et journaux ne sont plus exportés. Examiner successivement les cibles Prometheus, le Collector, Tempo, Loki et le lien Grafana. Les files en mémoire ne garantissent pas la conservation de tous les événements pendant une panne.

## Challenge et corrigé

Retrouver une nouvelle trace lente et une nouvelle trace en erreur. Pour chacune, noter le symptôme, une mesure agrégée, le trace ID, la durée HTTP, la présence du span SQL et une conclusion fondée sur ces observations. Puis arrêter et reprendre le laboratoire en retrouvant le même témoin.

Le [corrigé détaillé](../../observabilite/corrige.md) explique le parentage, la différence entre durée individuelle et p95 estimé, les alertes et les réponses aux questions d’entretien. Le [registre de validation](../../observabilite/validation.md) précise les essais effectivement exécutés ; une fixture CI ne remplace pas la preuve locale de vos propres données.

## Arrêt et reprise

```bash
docker compose -p taskboard-observabilite \
  -f observabilite/compose.yaml down
```

Cette commande conserve les volumes ; ne pas ajouter `-v` pour reprendre la séance. Relancer ensuite `bash scripts/verify-observability.sh`, sans réimporter dans la base déjà remplie. Les ports, identifiants publics et accès anonymes de ce laboratoire imposent de le garder local.

[Retour au parcours](../README.md) · [Jalon suivant](../08-securite-sre-reprise/README.md)
