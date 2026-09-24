# Conventions pédagogiques

## Français d’abord, anglais expliqué

Les explications, guides, exercices, incidents et corrigés sont en français. À sa première apparition, une notion utile est présentée avec son terme anglais : « contrôle de disponibilité (*readiness check*) ». Le [glossaire](glossaire.md) permet de retrouver les correspondances.

Les identifiants, commandes, fichiers et messages réels restent inchangés. `connection refused` est expliqué par « connexion refusée » : aucune écoute n’accepte cette connexion à l’adresse demandée, ou une règle la refuse. La traduction aide au diagnostic sans imposer une cause unique.

## Trois catégories distinctes

| Mention | Signification |
| --- | --- |
| Résultat attendu | Ce que doit produire l’exercice si ses conditions sont réunies |
| Résultat observé | Ce qui a réellement été obtenu, avec date, environnement et version |
| À réaliser | Contrat dont le parcours exécutable complet n’est pas livré |

« En validation » signifie que le guide est rédigé mais que sa matrice d’essais reste à compléter. Le [registre](validation.md) précise la portée des résultats. Un test en mémoire ne valide pas PostgreSQL ; le rendu d’un manifeste ne valide pas son déploiement.

## Une progression, un projet

Les jalons 01–02 utilisent des données temporaires. Au jalon 03, une tâche témoin devient persistante. Conservez ensuite son identifiant, son titre et sa date. Changer de base implique un transfert contrôlé puis leur comparaison ; recréer une tâche du même titre ne prouve pas la conservation.

Les guides livrés comprennent problème, prérequis, étapes, observations attendues, panne bornée, diagnostic, nettoyage et challenge. Le corrigé est séparé. Les six derniers jalons énoncent leur contrat, les livrables manquants et les conditions de réussite.

## Commandes et portée

Les commandes partent de la racine du dépôt. Un préfixe d’environnement comme `HOST=127.0.0.1` s’applique à la commande qui suit. Les valeurs propres au lecteur sont désignées comme telles. Aucun exemple ne doit contenir un vrai jeton ni ouvrir un service non protégé au public.

Une commande de nettoyage indique ce qu’elle arrête et conserve. Supprimer les données n’est jamais une remise à zéro implicite. Les preuves personnelles et sauvegardes restent dans les dossiers ignorés prévus.
