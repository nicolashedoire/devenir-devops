# Jalon 06 — Kubernetes, Helm et GitOps

**Chapitres 11–14. À réaliser : contrat de progression.** Les fichiers historiques de `archive/legacy/` ne satisfont pas ce contrat, notamment parce que le chart utilise un stockage en mémoire.

## Problème et état d’entrée

Il faut changer de mécanisme de déploiement tout en conservant les données et l’identité du logiciel. Les fondations du jalon 05 et l’image publiée du jalon 04 doivent être disponibles. La migration de données commence depuis une sauvegarde vérifiée ; créer une nouvelle tâche de même titre n’est pas une migration réussie.

## Livrables à construire

Fournir un environnement Kubernetes local de référence puis une adaptation à la cible retenue ; un chart Helm persistant ; les migrations séparées de l’API ; les droits et la configuration de connexion à PostgreSQL. Le chart devra accepter une référence d’image par digest, valider ses valeurs et prendre en charge plusieurs réplicas partageant les mêmes données.

Deux configurations de recette distinctes devront être suivies par Argo CD avec ses versions, ses identités et son périmètre documentés. Une promotion modifiera la référence d’image dans Git, sans reconstruction. La procédure distinguera clairement cluster local, recette et production réelle.

## Incidents à intégrer

Supprimer un Pod API, proposer une image inexistante puis modifier une valeur hors Git. Pour chaque cas : symptômes, événements, état désiré, état observé et preuve de rétablissement. Une synchronisation verte doit être complétée par une lecture métier.

## Critères de réussite

- Le témoin garde ses trois champs après transfert de base et remplacement de tous les Pods API.
- Deux réplicas relisent la même tâche ; la base ne dépend pas de leur mémoire.
- Une valeur invalide est refusée avant déploiement.
- La même référence au digest est promue entre environnements.
- Un retour arrière Git rétablit l’ancienne version compatible sans perte du témoin.
- La procédure de migration explique l’interruption éventuelle et le retour à la source.

## Preuves et nettoyage attendus

Conserver commit de configuration, digest, états de réconciliation, réponse métier et comparaison des données. Documenter le retrait des applications, des accès Argo CD et des ressources ; aucun volume persistant ne doit disparaître par un nettoyage implicite. Ce jalon demande des fichiers nouveaux et des essais avant de devenir exécutable.

[Retour au parcours](../README.md) · [Jalon suivant](../07-observabilite/README.md)
