# Jalon 09 — Réaliser la recette de production

**Chapitre 21. À réaliser : contrat de progression.** L’architecture du livre est une cible ; ce dépôt ne revendique pas encore son déploiement complet.

## Problème et état d’entrée

Des composants qui réussissent séparément peuvent échouer ensemble. Il faut assembler les jalons 05–08 sur une cible de recette, puis décider si le service peut être ouvert. Chaque environnement possède ses identités, sa base, sa configuration et son périmètre de ressources.

## Livrables à construire

Fournir une architecture à jour, un inventaire, une matrice d’acceptation, une procédure de mise en service et un dossier de retrait. DNS, HTTPS, contrôle d’accès, base privée, migrations, livraison par digest, observation et sauvegardes doivent fonctionner dans le même système. Définir responsables, coûts, seuils d’arrêt et retour arrière avant ouverture.

La tâche témoin issue du jalon 03 doit être transférée selon une procédure explicite, vérifiée en recette et préservée lors des exercices. Les données du laboratoire restent synthétiques ; aucune donnée personnelle n’est nécessaire pour cette preuve.

## Incidents à intégrer

Version applicative défectueuse, perte d’une capacité prévue par l’architecture et indisponibilité d’une dépendance. Les domaines de panne réellement testés doivent être nommés : arrêter un Pod ne démontre pas une reprise après perte d’une zone cloud.

## Critères de réussite

- Une personne indépendante provisionne puis vérifie la recette depuis les fichiers versionnés.
- HTTPS et les refus d’accès sont testés sur les chemins exposés.
- Commit, digest et configuration déployée sont reliés.
- Le témoin conserve son identité après livraison, remplacement et restauration.
- Les alertes arrivent au bon destinataire ; les procédures sont exécutables.
- Les objectifs de capacité et de reprise ont des mesures et des limites connues.
- Le retrait laisse un inventaire expliqué des ressources et sauvegardes conservées.

## Preuves et décision

Le dossier de recette doit contenir un résultat par exigence, un exécutant, une date et un lien de preuve. Une case non testée n’est pas une réussite. Le décideur peut accepter une limite connue ou refuser l’ouverture ; le statut du système doit refléter cette décision. Le nettoyage et la rétention sont des étapes à vérifier, pas une note finale facultative.

[Retour au parcours](../README.md) · [Jalon suivant](../10-plateforme-mcp-portfolio/README.md)
