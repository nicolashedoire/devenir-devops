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

## Panne du Collector exécutée en CI

La [recette complémentaire 36012870701](https://github.com/nicolashedoire/devenir-devops/actions/runs/36012870701) a réussi sur le commit `787f00d2a345be5e371e934f34ecdc06e065bc74`, sous Linux AMD64. Elle rejoue la chaîne complète puis lance `bash scripts/verify-observability-collector.sh`. Le script termine avec un code nul et la preuve `preuves/collector-ETl1jA/resultat.json` de l’artefact porte `statut: valide`.

Le Collector ciblé est identifié par son projet et son service Compose, puis son arrêt est confirmé. Pendant cette interruption, l’API normale répond 200 avec le témoin strictement identique ; Prometheus conserve `up=1` et son compteur de lectures métier passe de 44 à 49. La trace et le journal d’une requête produite après l’arrêt ne sont pas présents dans Tempo et Loki pendant le contrôle. Le Collector est ensuite redémarré ; une nouvelle lecture produit à nouveau une trace et un journal corrélés, avec le parentage HTTP → SQL vérifié.

Cette preuve couvre une panne courte et le retour de nouveaux exports. Elle ne garantit ni le rattrapage de toutes les données émises pendant l’arrêt, ni leur conservation après saturation ou redémarrage des files en mémoire. Le test tente la reprise du Collector dans sa phase de sortie, y compris lorsqu’un contrôle échoue. Il ne modifie pas la source PostgreSQL ni les volumes.

## Arrêt complet et reprise exécutés en CI

La [recette 36014240703](https://github.com/nicolashedoire/devenir-devops/actions/runs/36014240703) a réussi sur le commit `e618d1bb7a281d08e218b95ce202d2ef42b835f5`, le 24 septembre 2026, sous Ubuntu 24.04 / Linux AMD64. La chaîne des trois signaux, la panne Collector et le cycle complet `down` puis `up -d --no-build` ont terminé avec un code nul. La preuve `preuves/collector-4qUe8r/resultat.json` de l’artefact porte `statut: valide`, tout comme sa section `reprise_pile`.

Pendant la panne du Collector, la lecture reste à 200 avec le témoin identique ; le compteur métier collecté par Prometheus passe de 43 à 48. Après reprise du Collector, le test retire tous les conteneurs du seul projet d’observation sans supprimer ses volumes, puis relance la pile sans reconstruire ni réimporter la base.

| Contrôle de reprise complète | Résultat observé |
|---|---|
| Retrait des conteneurs | Aucun conteneur du projet restant après `down` |
| Volumes | Les cinq volumes PostgreSQL, Prometheus, Grafana, Loki et Tempo gardent leur nom, date de création et pilote |
| Services | Les huit points de disponibilité redeviennent accessibles |
| Données métier | Même tâche `id/title/created_at`, sans réimport |
| Mesure historique Prometheus | Valeur `48` au timestamp `1790260885.451`, identique avant et après reprise |
| Ancienne observation | Trace `7056afb98ff3349c0221dffb4edaf786` et journal corrélé toujours consultables |
| Nouvelle observation | Trace `1f27b0c85424e85ab9b78de5a8f6328a`, journal et parentage HTTP → SQL reçus après reprise |

Le contrôle de métrique interroge **le même instant historique** avant et après : les compteurs applicatifs en mémoire repartent avec les processus, tandis que les échantillons conservés dans Prometheus restent consultables. Cette recette prouve un arrêt ordinaire et une reprise sur le même hôte, pas une récupération après perte de disque. Elle ne garantit pas non plus la conservation de toute la télémétrie produite pendant une panne longue. La base source du parcours et les autres projets ne sont pas touchés.

## Limites conservées dans la preuve

 La configuration du lien Grafana est vérifiée par son API, sans prétendre à une validation visuelle interactive de chaque panneau. Aucune notification externe, charge de production, haute disponibilité, exposition publique ou restauration des backends de télémétrie n’a été validée.
