# Jalon 07 — Observer une même requête

**Chapitre 15. À réaliser : contrat de progression.** L’API expose déjà des journaux et `/metrics`, mais le dépôt ne livre pas encore une chaîne intégrée de collecte, stockage et consultation des trois signaux.

## Problème et état d’entrée

Une erreur doit pouvoir être suivie du client jusqu’à sa dépendance. Le jalon 06 doit fournir TaskBoard persistant et son image identifiée. Le témoin demeure dans la même base ; instrumenter le service ne doit pas le réinitialiser.

## Livrables à construire

Versionner une configuration de Prometheus et Grafana, un Collector OpenTelemetry, un stockage de traces et une collecte de journaux. Instrumenter le client, le serveur et les appels PostgreSQL ; propager le contexte, puis inclure l’identifiant de trace dans les journaux sans y copier titres ni secrets. Fournir un tableau de bord exploitable, les requêtes de consultation, les rétentions et une procédure de diagnostic de la collecte elle-même.

L’intégration HTTP OpenTelemetry expérimentée pendant la préparation du livre est une preuve limitée : elle ne vaut pas installation de cette chaîne complète dans le dépôt. Son intégration future devra préciser exactement quels éléments et tests sont repris.

## Incidents à intégrer

Injecter une latence puis une erreur métier bornée. Arrêter ensuite uniquement un collecteur pour distinguer « aucun événement » d’« aucune mesure reçue ». Les données et l’API doivent rester utilisables quand le composant d’observation est indisponible, dans les limites définies.

## Critères de réussite

- Une requête possède un identifiant commun entre trace et journal.
- Les spans client, serveur et SQL ont un parentage démontré.
- La latence injectée apparaît dans le segment concerné et dans les mesures agrégées.
- Le tableau de bord rend visible une erreur et la fraîcheur des données.
- Les étiquettes de métriques restent bornées ; aucune donnée sensible n’est exportée.
- Le témoin est identique avant et après l’instrumentation.

## Preuves et nettoyage attendus

Conserver les versions, exports représentatifs, requêtes utilisées et résultats réels. Une capture fictive de Grafana ou une proximité d’horodatage ne démontre pas une corrélation. Le nettoyage doit arrêter les collecteurs et décrire le devenir de leurs données, en conservant PostgreSQL et le témoin.

[Retour au parcours](../README.md) · [Jalon suivant](../08-securite-sre-reprise/README.md)
