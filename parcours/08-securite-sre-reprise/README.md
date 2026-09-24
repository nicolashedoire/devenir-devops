# Jalon 08 — Contrôler l’accès, alerter et reprendre

**Chapitres 16–18. À réaliser : contrat de progression.** Les protections de laboratoire existantes ne constituent pas encore une authentification utilisateur ni une politique complète de production.

## Problème et état d’entrée

Le service persistant et observable des jalons précédents doit maintenant refuser les accès non autorisés et disposer d’une reprise démontrée. La sauvegarde locale du jalon 03 est un point de départ ; elle ne couvre pas une perte du stockage, d’une machine ou d’un compte cloud.

## Livrables à construire

Définir un espace de tâches partagé pour un groupe identifié, puis protéger tous les chemins d’accès avec un mécanisme d’identité et d’autorisation vérifiable. Séparer les droits de migration des droits courants de l’API, gérer les secrets hors du dépôt et fournir un exercice de rotation.

Définir un indicateur et un objectif de service, une règle d’alerte acheminée vers une destination de laboratoire, une procédure d’incident et une restauration dans un périmètre séparé. Les objectifs de perte de données et de durée de reprise devront être annoncés puis comparés aux mesures obtenues.

## Incidents à intégrer

Accès sans droit, secret de laboratoire révoqué, dépendance dégradée et restauration d’une sauvegarde connue. Fournir des dossiers d’observation séparés de la cause, avec indices gradués. Les essais doivent être bornés et disposer d’un retour explicite au service normal.

## Critères de réussite

- Un utilisateur autorisé réalise son action ; un utilisateur non autorisé est refusé, y compris via l’API directe.
- Le compte courant ne peut pas modifier arbitrairement le schéma.
- Un ancien secret cesse de fonctionner après rotation.
- Une dégradation produit une alerte utile, puis une résolution vérifiée.
- La restauration retrouve le témoin exact dans une cible distincte ; temps et perte éventuelle sont mesurés.
- Le compte rendu sépare faits, hypothèses et décisions.

## Preuves et nettoyage attendus

Conserver les tests d’accès sans jetons, l’alerte, sa résolution, la chronologie, les mesures de reprise et une action corrective testable. Retirer les comptes et canaux temporaires ; ne pas supprimer la sauvegarde avant d’avoir accepté le résultat. Une répétition indépendante précède la recette du jalon 09.

[Retour au parcours](../README.md) · [Jalon suivant](../09-recette-production/README.md)
