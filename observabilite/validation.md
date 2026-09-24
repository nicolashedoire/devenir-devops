# Validation du laboratoire 07

## Chaîne complète exécutée en CI

La [validation GitHub Actions du 24 septembre 2026](https://github.com/nicolashedoire/devenir-devops/actions/runs/36009589062) a réussi sur le commit `8bceb8608f81e7dd25a5bdfc0a7dde1ee08f4d0a`, sous Ubuntu 24.04 / Linux AMD64, avec Node.js 24.19.0. Le job a terminé en 3 min 15 s. Le script a rendu un code de sortie nul, `resultat.json` porte `statut: valide` et `promtool` a accepté les deux règles.

Cette CI construit une **source synthétique PostgreSQL 17**, applique la migration réelle, crée un témoin, produit une sauvegarde puis restaure sa copie avec le même importateur que le lecteur. Elle prouve le fonctionnement du parcours d’observation ; elle ne prouve pas la continuité des données personnelles d’un lecteur. Cette dernière demande son propre import et son propre témoin.

| Contrôle exécuté | Résultat observé |
|---|---|
| Version, schéma et témoin après import | PostgreSQL 17, checksum attendu, `id/title/created_at` identiques |
| Droits de la copie | Rôle `lab_reader` sans droit `INSERT` |
| API normale / lente / erreur | Statuts 200 / 200 / 503 |
| Lectures 200 | Témoin strictement identique à celui de la fixture |
| Collecte Prometheus | Les trois cibles `up=1` |
| Histogramme du scénario lent | p95 estimé à 2,425 s sur la fenêtre testée |
| Alertes | `TaskboardLatenceHTTP{scenario="lent"}` et `TaskboardErreursHTTP{scenario="erreur"}` à l’état `firing` |
| Grafana | Tableau de bord à six panneaux et trois sources provisionnés ; lien Loki → Tempo configuré |
| Traces et journaux | Identifiants de trace, de requête et de span corrélés pour les trois scénarios |
| Parentage | Span client SQL enfant du span serveur HTTP dans les scénarios normal et lent |
| Erreur volontaire | Aucun span SQL : la simulation s’arrête avant PostgreSQL |
| Données dans les traces | Mot de passe de laboratoire et titre témoin absents des traces récupérées |

Les durées suivantes proviennent des traces représentatives réellement récupérées pendant **cette** exécution. Elles illustrent les points de mesure et ne constituent pas une promesse de performance :

| Scénario | Durée vue par le client de test | Span serveur HTTP | Span SQL |
|---|---:|---:|---:|
| Normal | 6 ms | 3,226 ms | 2,186 ms |
| Lent | 1 507 ms | 1 503,478 ms | 1,757 ms |
| Erreur | 4 ms | 0,946 ms | Absent |

Le p95 de 2,425 s est une interpolation des buckets entre 1 et 2,5 s. Il ne signifie pas que la requête représentative a duré 2,425 s. Les fichiers `metriques.json`, `trace-*.json` et `journal-*.json` permettent de distinguer les mesures agrégées des observations individuelles.

L’artefact de l’exécution s’appelle `observabilite` et sa rétention est de 14 jours. Il contient les preuves, les journaux de diagnostic, le SHA et la preuve d’import, sans sauvegarde PostgreSQL. Une copie de travail a été téléchargée sous `observabilite/preuves/ci-36009589062/` ; ce répertoire reste hors Git. Les données représentatives se trouvent dans `preuves/verification-P7R1CS/` à l’intérieur de l’artefact.

## Import local du véritable fil rouge

Avant l’indisponibilité du moteur Docker local, l’import a été exécuté sur macOS ARM64 à partir de la sauvegarde existante du parcours. Le 24 septembre 2026 à 13:19 UTC, il a validé PostgreSQL **17.11**, la tâche témoin **id 1** strictement identique, le checksum de `001_init` et l’absence de droit `INSERT` pour `lab_reader`. La preuve locale est `observabilite/imports/resultat.json`.

Le SHA-256 de la sauvegarde importée est `a0044607782d6e286eeba163cefdd3c6377fc8684c08dc2e2c53a86ff8b404e4`. Le checksum de la migration est `ad8f6e6c633f966e6869659e40a6cf2085cae90ccd03e57b7409dfae6a83cd9e`. La base source n’a pas été modifiée par cet import.

Le téléchargement initial des backends locaux a ensuite rencontré une erreur d’entrée-sortie lorsque le disque hôte était plein. Aucun volume n’a été supprimé. La chaîne complète sur macOS ARM64 n’est donc **pas** déclarée validée ; la preuve complète ci-dessus concerne Linux AMD64 en CI.

## Contrôle ciblé de la propagation

Un contrôle Node local, sans Docker, a aussi utilisé un récepteur OTLP de test en mémoire. Il a vérifié la conservation d’un `traceparent` entrant, l’identifiant renvoyé par `X-Trace-ID`, le journal corrélé, les exports `/v1/traces` et `/v1/logs`, l’absence des paramètres d’URL dans ces exports et l’arrêt propre du SDK. Ce contrôle ne remplace pas les backends réels.

Le générateur de trafic de la CI n’exporte pas de span client HTTP. Le parentage démontré de la chaîne stockée est **serveur HTTP → client PostgreSQL**. Les décisions d’échantillonnage d’un parent entrant sont respectées.

## Limites conservées dans la preuve

Le scénario d’arrêt manuel du Collector décrit dans le guide reste un exercice à rejouer ; il n’est pas inclus dans le verdict CI ci-dessus. La configuration du lien Grafana est vérifiée par son API, sans prétendre à une validation visuelle interactive de chaque panneau. Aucune notification externe, charge de production, haute disponibilité, exposition publique ou restauration des backends de télémétrie n’a été validée.
