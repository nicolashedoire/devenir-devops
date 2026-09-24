# Registre de validation

**Compagnon de l’édition 2026 — version de livraison 1.0.0, 24 septembre 2026.** Les dix jalons fournissent leurs ateliers et corrigés. Ce registre décrit les essais réellement exécutés, avec leurs commits et leurs limites. Le jalon cloud fournit une répétition locale et des tests AWS simulés ; aucune infrastructure AWS réelle n’a été créée. La validation technique ne remplace pas l’essai pédagogique par un débutant.

## Résultats locaux

Environnement : macOS arm64, Node.js 24.19.0, Docker 29.3.1 et Compose 5.1.0. L’image PostgreSQL utilisée rapporte la version 17.11. Les images Node et PostgreSQL sont fixées par digest dans les fichiers fournis.

| Vérification exécutée | Résultat | Portée |
| --- | --- | --- |
| Installation des dépendances par `npm ci` | Réussie | Dépendances de package-lock.json |
| Tests automatisés de l’application | 18 tests réussis | HTTP, Unicode, bornes, pannes, migration et smoke |
| Audit npm des dépendances d’exécution | 0 vulnérabilité signalée à cet instant | Ce résultat évolue avec la base de vulnérabilités |
| Parcours HTTP des guides 01–02 | Réussi | Démarrage mémoire, port, réponses, smoke et disparition au redémarrage |
| Exercice Git et challenge du jalon 02 | Réussis dans une copie indépendante | Branche, deux commits, annulation du seul second et état final propre |
| Construction et démarrage Compose | Réussis | PostgreSQL, migration explicite puis API |
| Remplacement du conteneur API | Tâche conservée à l’identique | Identifiant, titre et date contrôlés |
| Sauvegarde puis restauration séparée | Réussie | Lignes, comptage et séquence PostgreSQL identiques |
| Arrêt de PostgreSQL | Santé 200, disponibilité 503, lecture métier 503 | La panne de dépendance est observable |
| Redémarrage de PostgreSQL | Lecture de la tâche rétablie | Aucune recréation métier nécessaire |
| `docker compose down` puis `up` | Tâche conservée à l’identique | Volume conservé, sans option `-v` |

Les tests unitaires des migrations utilisent également des doubles de test : le passage PostgreSQL réel est établi séparément par Compose. Les mesures locales ont été obtenues pendant la préparation ; GitHub Actions reconstruit et rejoue l’intégration sur le commit publié.

## Validation GitHub Actions

La [première validation complète sur GitHub](https://github.com/nicolashedoire/devenir-devops/actions/runs/35986045983) a réussi sur le commit `e9d1ef31da0bbe44bf8a05ca4b5af4eb1cfe5ae7`, dans un environnement Ubuntu 24.04 / Linux AMD64. Les étapes application, documentation, dépendances, PostgreSQL, persistance et restauration ont toutes réussi. Les preuves sont jointes à cette exécution dans `validation-<SHA>`.

Les exécutions suivantes sont consultables dans [GitHub Actions](https://github.com/nicolashedoire/devenir-devops/actions/workflows/ci.yml). La référence précise d’une image publiée, son commit et le résultat de publication figurent dans les notes de [version](https://github.com/nicolashedoire/devenir-devops/releases) et dans l’artefact `publication-<SHA>`. Une exécution verte sans option de publication ne crée pas d’image dans le registre.

Le workflow `.github/workflows/ci.yml` exige le succès des tests, de la persistance et de la restauration avant la publication manuelle. Il conserve et transfère la même image entre validation et publication. Aucun job de déploiement cloud n’est présent.

## Jalon 05 : vérification locale et simulation AWS

Exécuté sur macOS ARM64 avec OpenTofu **1.12.6**, fournisseur `hashicorp/aws` **6.66.0** et fournisseur `hashicorp/local` **2.9.1**. Les verrous contiennent les empreintes officielles vérifiées pour macOS ARM64 et Linux AMD64. L’installateur OpenTofu vérifie une empreinte SHA-256 épinglée avant installation dans `work/bin/`.

| Contrôle réellement exécuté | Résultat | Limite |
| --- | --- | --- |
| Formatage et validation des trois racines | Réussis | Cohérence de configuration, pas autorisation AWS |
| Suites OpenTofu | 13 cas réussis : 2 locaux et 11 avec fournisseur AWS simulé | Aucun appel de création AWS |
| Lecture des plans simulés réellement produits par OpenTofu | Inventaires de 6 et 20 ressources acceptés | N’atteste pas la création des ressources |
| Cycle local complet | Création, dérive détectée avec code 2, rétablissement exact, plan sans changement, retrait et état vide | Un fichier local, pas une émulation cloud |
| Tests des contrôles d’identité et des plans | 8 tests Node réussis | Versions et STS simulés dans ces tests ; aucune session AWS réelle |
| Refus exercés | Compte inattendu, credentials concurrents, endpoints détournés, remplacement, plan partiel, ressource inattendue et retrait du backend | Complète la revue humaine, sans remplacer IAM |
| Confidentialité des résumés | Attributs privés et JSON mal formé non reproduits dans les résumés | Les plans et journaux complets restent hors Git |

`scripts/verify-infra.mjs` teste dans une copie temporaire, sans profils ni credentials AWS utilisables et avec l’accès aux métadonnées EC2 désactivé. Les fichiers du lecteur ne sont pas utilisés comme état de test. Les preuves sont dans `preuves/verification-infra-*/resultat.json`, avec les inventaires expurgés ; une copie de travail en échec reste disponible pour diagnostic. Le téléchargement des outils et fournisseurs nécessite Internet.

Le workflow `infra.yml` rejoue ces contrôles sans compte AWS. Les résultats de la version publiée sont accessibles dans [les exécutions du jalon cloud](https://github.com/nicolashedoire/devenir-devops/actions/workflows/infra.yml) et les [notes de version](https://github.com/nicolashedoire/devenir-devops/releases). Les artefacts sont nommés `infrastructure-simulee-<SHA>` et conservés 14 jours.

**Aucun réseau, bucket, rôle ou service AWS n’a été créé pour cette validation.** STS, permissions IAM, disponibilité des zones, concurrence du verrou S3, dérive réelle et inventaire après retrait restent à vérifier dans un compte de laboratoire autorisé. Aucun montant de facture AWS n’a donc été observé. Le guide distingue explicitement les commandes testées localement des résultats attendus sur AWS.

## Limites qui restent ouvertes

- Parcours intégral par un débutant indépendant, sur une machine propre ; variantes Windows/WSL et distributions non essayées.
- Création et retrait réels des fondations AWS dans un compte autorisé, vérification IAM/STS et concurrence du verrou distant.
- Exposition publique avec identité utilisateur, autorisations par personne, DNS et certificats publics. La passerelle locale à jeton partagé n’implémente pas une identité métier.
- Déploiement EKS/RDS multizone, restauration hors site, capacité et charge représentatives d’utilisateurs réels.
- Fonctionnement complet de la télémétrie sur macOS ARM64 : son import a passé, mais les backends n’ont pas tous démarré avant l’indisponibilité du moteur local.
- Arrêt manuel du Collector, lecture interactive de chaque panneau et notification vers un destinataire externe : la CI teste les API des backends et le récepteur d’alerte local.
- Intégration avec un modèle d’IA ou un autre client MCP : le client/serveur stdio fourni fonctionne sans service payant ni modèle.

Les anciens exemples de `archive/legacy/` restent hors du parcours actif. Les exemples d’architecture de production constituent un dossier de conception ; les ateliers exécutés valident les responsabilités décrites dans le périmètre local annoncé.

## Rejouer les contrôles

```sh
npm ci
npm test
npm run doctor -- --docker
npm run check:docs
bash scripts/verify-compose.sh
bash scripts/backup-restore.sh
node scripts/install-tofu.mjs
export PATH="$PWD/work/bin:$PATH"
npm run test:cloud-guards
bash scripts/verify-infra.sh
```

Les services de laboratoire restent démarrés après les scripts afin d’examiner les résultats. `docker compose down` les arrête en conservant les données. Les dossiers `preuves/` et `backups/` restent locaux et sont ignorés par Git. Les artefacts CI constituent des preuves temporaires ; leur durée de conservation figure dans le workflow.

## Jalon 07 : observabilité complète

La [CI du laboratoire d’observabilité](https://github.com/nicolashedoire/devenir-devops/actions/runs/36009589062) a réussi le 24 septembre 2026 sur `8bceb8608f81e7dd25a5bdfc0a7dde1ee08f4d0a`, sous Ubuntu 24.04 / Linux AMD64. Elle restaure une fixture PostgreSQL 17 dans une copie isolée, puis utilise Collector Contrib 0.161.0, Prometheus 3.14.0, Grafana 13.2.2, Loki 3.7.8 et Tempo 3.0.3, avec images épinglées par digest.

| Contrôle exécuté | Résultat |
|---|---|
| Copie et témoin | Schéma/checksum conformes, témoin id/title/created_at identique, lecteur sans INSERT |
| Scénarios normal / lent / erreur | Réponses 200 / 200 / 503, trois cibles Prometheus disponibles |
| Métriques et règles | Histogrammes vérifiés, deux alertes `firing`, deux règles acceptées par `promtool` |
| Journaux et traces | Corrélation trace ID / request ID / span ID ; parentage serveur HTTP → client SQL démontré |
| Panne volontaire 503 | Absence attendue de span SQL, car erreur provoquée avant la base |
| Grafana | Six panneaux et trois sources provisionnés ; lien des journaux vers Tempo contrôlé par API |

Le script a terminé avec un code nul et `resultat.json` indique `valide`. L’artefact `observabilite` contient les preuves et le SHA sans le dump ; il est conservé 14 jours. Le [registre détaillé](../observabilite/validation.md) distingue les durées individuelles des quantiles estimés et décrit les limites de cette exécution.

L’import local du **véritable fil rouge** a également réussi sur macOS ARM64 : PostgreSQL 17.11, témoin id 1 identique, checksum de migration identique et rôle sans INSERT. Les téléchargements suivants ont été interrompus par un disque plein puis un moteur Docker local indisponible ; la chaîne complète macOS ARM64 n’est pas déclarée validée. La CI Linux utilise une fixture distincte et ne remplace pas la preuve des données du lecteur.

Un contrôle Node local avec récepteur OTLP de test a vérifié séparément la propagation d’un `traceparent` entrant, les exports de logs/traces et l’arrêt du SDK. Le générateur de trafic n’exporte pas de span client HTTP. L’arrêt manuel du Collector, la livraison de notifications externes, les essais de charge, la haute disponibilité et une exposition de production ne font pas partie du verdict de ce jalon.

## Images publiées sur deux architectures

Le workflow `image-multiarch.yml` a testé l’application, PostgreSQL, la persistance et la restauration sur des runners **AMD64 et ARM64 natifs**. Il transmet ensuite les images testées à la publication et assemble leurs digests sans reconstruire l’application. Les deux images de l’exercice de promotion sont accessibles publiquement :

| Image | Source | Preuve |
|---|---|---|
| Référence initiale `12ea6422…` | `819be000ad7499955a5772eaa847b275ba52c8b2` | [Validation et publication multiarchitecture](https://github.com/nicolashedoire/devenir-devops/actions/runs/36002965038) |
| Reconstruction candidate `bf5a8ddb…` | `0e1766c9b704867bf878437b9bdb3b091e30b1c1` | [Validation et publication candidate](https://github.com/nicolashedoire/devenir-devops/actions/runs/36006797979) |

Les références complètes sont dans `deploy/image-reference.json` et `deploy/image-candidates/reconstruction.json`. L’application reste en version fonctionnelle 0.2.0 : le second artefact change sa provenance de construction, sans prétendre ajouter une fonction métier. Le numéro 1.0.0 désigne le compagnon pédagogique.

## Kubernetes, Helm et GitOps

La [recette du 24 septembre](https://github.com/nicolashedoire/devenir-devops/actions/runs/36009525826) a réussi sur `8bceb8608f81e7dd25a5bdfc0a7dde1ee08f4d0a`, sous Ubuntu 24.04 / Linux AMD64. Les outils sont fixés dans `deploy/tools-lock.json` ; leurs empreintes sont vérifiées avant installation.

- Source PostgreSQL et tâche témoin créées pour cette exécution ; import dans trois namespaces distincts, comparaison de toutes les lignes, de la séquence et du témoin.
- Remplacement réel d’un Pod API, puis du Pod PostgreSQL ; identifiant du volume conservé et tâche inchangée.
- Adoption par Argo CD, opération de synchronisation effectivement réussie, contrôle de disponibilité et de la version.
- Dérive volontaire d’un nombre de réplicas en recette, correction automatique vers l’état Git.
- Promotion du digest candidat en recette puis production, retour au digest initial dans les deux environnements ; version et tâche vérifiées à chacune des quatre étapes.

La recette de promotion utilise deux commits Git prépubliés et immuables ; elle n’écrit pas dans Git depuis la CI. Le guide fait exercer au lecteur un changement et une annulation dans son propre fork. Les trois namespaces appartiennent au même cluster local : ils n’établissent pas une isolation cloud ni une haute disponibilité multizone. Les imports du véritable témoin local ont aussi passé avant l’indisponibilité du moteur Docker ; les remplacements complets et la promotion sont attestés par la CI ci-dessus.

## Sécurité, SRE et reprise

La [recette opérations](https://github.com/nicolashedoire/devenir-devops/actions/runs/36009530009), sur `8bceb8608f81e7dd25a5bdfc0a7dde1ee08f4d0a`, a exécuté les **8 tests de frontière HTTPS** puis l’import et les cinq étapes opérationnelles. Le [registre détaillé](../operations/validation.md) conserve mesures et limites.

TLS non approuvé refusé, requêtes sans/faux jeton refusées, écriture autorisée relue, rôle PostgreSQL sans création de table, rotation du jeton, 20 lectures HTTPS réussies sur 20, restauration distincte avec lignes et séquence identiques, réception des notifications `firing` puis `resolved` ont été observés. Le délai de restauration mesuré concerne une petite fixture ; il n’est pas un engagement de production. La sonde enregistre les valeurs ; l’équipe doit les confronter à ses objectifs. Aucune notification n’a été envoyée à un tiers.

## Plateforme locale et MCP

La [recette plateforme/MCP](https://github.com/nicolashedoire/devenir-devops/actions/runs/36010610896) a réussi sur `93774d85bcfa0a3f3ca6869092bb6e0595f79b7d`, sous Linux AMD64 / Node 24.19.0.

Les **9 tests** exercent les demandes hors contrat, l’écrasement refusé, les chemins et liens symboliques refusés, les bornes du transport, le JSON mal formé, l’initialisation et les appels réels par stdio. Le titre piégé d’une tâche n’est pas renvoyé comme instruction. Le client termine proprement le serveur.

La recette a ensuite généré et réellement livré l’offre avec l’image autorisée, retrouvé le témoin identique sur `127.0.0.1:3400` et inspecté les limites : un processeur, 256 Mio, utilisateur `node`, système de fichiers en lecture seule. Les outils MCP ont lu le témoin et le contrat généré. Le générateur seul ne démarre aucun conteneur ; la recette de livraison est une action distincte. Le serveur lit des preuves locales et n’appelle aucun modèle d’IA. L’artefact `plateforme-mcp` conserve le résultat expurgé pendant 30 jours.

### Panne Helm et retour à la version connue

La [recette étendue](https://github.com/nicolashedoire/devenir-devops/actions/runs/36010676439) a réussi sur `d9e60fa9b1991326f48dd6b4d3bfe01e298da14c`. Elle rejoue aussi les imports, remplacements, réconciliation et promotions décrits ci-dessus. Elle déploie volontairement un digest inexistant dans `taskboard-lab`, constate l’échec de Helm et le refus de téléchargement dans les états des conteneurs initiaux, puis revient à la révision précédente. L’image et les trois champs de la tâche sont vérifiés après le retour. Le rollback ne prétend pas restaurer un schéma SQL.


## Passage lecteur des chapitres 01 à 10

Les exercices ont été lus intégralement puis rejoués dans des copies isolées. La [recette finale du 24 septembre 2026](https://github.com/nicolashedoire/devenir-devops/actions/runs/36014246803), sur `e618d1bb7a281d08e218b95ce202d2ef42b835f5`, a réussi ses trois jobs Ubuntu 24.04 / Linux AMD64. Le script `scripts/verify-reader-foundations.sh` conserve les relevés dans les artefacts `lecteur-fondations-linux` (`linux.tsv`), `lecteur-fondations-docker` (`docker.tsv`) et `lecteur-fondations-infra` (`infra.tsv`), accompagnés des journaux et résultats détaillés.

- Linux : refus des permissions puis correction, unité systemd utilisateur, effet distinct de daemon-reload et restart, changements de port, NGINX 200/404/502 puis rétablissement.
- Docker : perte attendue de la mémoire au redémarrage, nouvelle image distincte d’un ancien conteneur, écoute interne corrigée, limites 1 CPU/256 Mio et racine en lecture seule ; PostgreSQL, témoin après remplacement, panne DB 200/503/503, restauration distincte de deux tâches et migration idempotente ; sonde CI au mauvais puis au bon port avec nettoyage dans les deux cas.
- Infrastructure : installation contrôlée d’OpenTofu, validations et fournisseurs AWS simulés, cycle réel de création/dérive/réparation/retrait du seul fichier local. Aucun compte AWS ni déploiement cloud réel n’est validé par ce résultat.

Le passage local macOS ARM64 / Node 24.19.0 a aussi exécuté les 18 tests applicatifs, le formulaire navigateur, les erreurs HTTP, le conflit Git avec abandon/résolution, les commits de correction et le revert, le test volontairement rouge puis rétabli, les permissions et le challenge OpenTofu avec changement de variables. Les exercices de conception ont reçu des réponses écrites comparées aux corrigés ; ils ne sont pas présentés comme des déploiements.

Cette recette a fait corriger le message de collision de port du livre (`startup_failed`, le code système étant masqué), la distinction entre publication AMD64 et workflow multiarchitecture, et les attentes GET de démarrage. La [première tentative](https://github.com/nicolashedoire/devenir-devops/actions/runs/36013946820) avait révélé une connexion réinitialisée après `docker restart` que `--retry-connrefused` ne réessayait pas ; les sondes bornées utilisent maintenant `--retry-all-errors`. Cette répétition concerne des lectures, pas des créations de tâches. La recette ne constitue pas une nouvelle publication GHCR, une configuration SSO ni une validation AWS réelle.


## Passage lecteur des chapitres 11 à 14

La [recette complète du 24 septembre 2026](https://github.com/nicolashedoire/devenir-devops/actions/runs/36016914638) a réussi sur `efc8209f704184efcc83926e5d356b345ac8404f`, sous Ubuntu 24.04 / Linux AMD64. Elle rejoue les imports dans les trois namespaces, la conservation des données, les remplacements de Pods, la dérive corrigée par Argo, les promotions et les retours précédemment décrits. L’artefact `kubernetes-gitops` contient les résultats expurgés et `kubernetes-ci/revision.txt`.

Le script `scripts/verify-reader-kubernetes.mjs` ajoute **onze contrôles correspondant aux manipulations du livre** : tunnel 3006 et témoin, remplacement de tous les Pods API, lecture des trois réplicas, remplacement d’un seul parmi trois, requests/limits exactes, mauvais sélecteur avec zéro destination et Pod encore lisible, restauration du Service, rendu Helm à trois et refus à cinq, échec d’image avec les options et le délai de 90 secondes du livre, rollback exact, puis retour final à deux réplicas avec le même PVC et le même témoin. Les onze cas ont réussi entre 15:02:13.861 et 15:04:35.494 UTC.

Le script `scripts/verify-gitops-failure.mjs` exerce séparément la panne d’image **par GitOps**. Le hook de migration ne peut pas télécharger l’image (`database-ready`, `ErrImagePull`), tandis que les anciennes API conservent leur témoin. Après le commit de retour, la terminaison ciblée de l’opération bloquée et la nouvelle synchronisation rétablissent la référence connue. Le namespace production et les PVC restent inchangés, puis l’Application retrouve sa branche initiale. Cette expérience a réussi de 15:07:31.448 à 15:08:04.269 UTC ; elle n’est pas déduite du seul test Helm.

La recette a fait corriger deux détails du parcours : Helm 4 exige une reprise explicite de propriété des champs volontairement modifiés avec kubectl (`--force-conflicts`, sans remplacement forcé), et la lecture d’un Service attend la convergence de ses destinations et de son trajet HTTP. Une version précédente du helper pouvait perdre le statut HTTP si le décodage JSON échouait ; le diagnostic conserve désormais statut, type et code d’erreur. Un ancien `status:null` ne prouve donc pas, à lui seul, une panne réseau.

Le [registre Kubernetes détaillé](../deploy/validation.md) donne les identités des fixtures et les limites. Les commandes Git du challenge ont également été rejouées dans une copie et un dépôt distant **locaux** : deux commits de promotion distincts, puis annulation du seul second, état propre et recette conservée. La CI Argo lit séparément des commits publics préparés ; ces deux essais ne sont pas présentés comme une unique exécution fork/push public/Argo. Aucun cloud ni changement sur un cluster extérieur au laboratoire n’a été effectué.
