# Glossaire français–anglais

Ces 25 entrées suivent les opérations du parcours. Elles servent à reconnaître les mots dans les outils, pas à mémoriser une liste avant de commencer.

| Terme français | Terme rencontré | Sens dans le parcours |
| --- | --- | --- |
| Terminal | terminal | Fenêtre dans laquelle saisir une commande et lire son résultat |
| Interpréteur de commandes | shell | Programme qui interprète les commandes, par exemple Bash |
| Processus | process | Programme en cours d’exécution, identifié par un numéro |
| Variable d’environnement | environment variable | Valeur transmise à un programme, par exemple `PORT` |
| Port | port | Numéro qui distingue un service réseau sur une adresse |
| Requête / réponse | request / response | Message envoyé au service et message retourné |
| Code de sortie | exit code | Résultat numérique d’un programme ; zéro indique habituellement la réussite |
| Dépôt | repository, repo | Fichiers et historique Git d’un projet |
| Branche | branch | Ligne de travail isolant une série de changements |
| Enregistrement Git | commit | Version enregistrée avec une empreinte et un message |
| Demande de fusion | pull request, PR | Proposition de changement relue avant son intégration |
| Intégration continue | continuous integration, CI | Vérifications automatisées d’un changement |
| Artefact | artifact | Résultat conservé d’une étape, par exemple une image ou un rapport |
| Image de conteneur | container image | Fichiers et métadonnées pour démarrer un conteneur |
| Conteneur | container | Processus exécuté dans un environnement isolé à partir d’une image |
| Registre d’images | image registry | Service qui conserve et distribue les images |
| Étiquette | tag | Nom lisible d’une référence, qui peut désigner un autre contenu ultérieurement |
| Empreinte de contenu | digest | Identifiant du contenu d’une image pour retrouver la même version |
| Volume | volume | Stockage conservé indépendamment du remplacement d’un conteneur |
| Migration | migration | Modification versionnée du schéma, exécutée séparément de l’API |
| Sauvegarde / restauration | backup / restore | Copie récupérable des données, puis opération qui les reconstruit |
| Vérification minimale | smoke test | Court essai d’un parcours important, sans prétendre tout vérifier |
| Journal | log | Événements produits par un programme pendant son exécution |
| Contrôle de disponibilité | readiness check | Vérification indiquant si le service peut recevoir le trafic prévu |
| Retour arrière | rollback | Retour à une version précédente, sans restauration automatique des données |

Quelques messages à reconnaître : `command not found` signifie « programme introuvable » ; `connection refused`, « connexion refusée » ; `address already in use`, « adresse et port déjà occupés » ; `permission denied`, « autorisation manquante ». Notez la commande et le contexte avant d’en déduire une correction.
