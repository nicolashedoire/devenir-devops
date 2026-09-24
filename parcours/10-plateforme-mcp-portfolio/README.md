# Jalon 10 — Plateforme, outil MCP et portfolio

**Chapitres 19–20 et 22. À réaliser : contrat de progression.** Une fiche d’offre, un exemple JSON et une liste d’outils ne constituent pas encore ces trois livrables.

## Problème et état d’entrée

Le parcours de recette doit devenir utilisable par une autre personne, avec une aide opérationnelle bornée. Le service, ses preuves et ses limites des jalons précédents servent de matière ; on ne remplace pas TaskBoard par une démonstration sans données.

## Livrables à construire

**Plateforme.** Produire une demande structurée — propriétaire, image autorisée, environnement, ressources — qui déclenche des validations puis une livraison GitOps. Une interface simple suffit ; un portail n’est pas une obligation. Fournir les erreurs compréhensibles, le suivi de la demande, la version du modèle et le retrait du service.

**MCP et IA.** Livrer un serveur MCP de laboratoire, son client, la version du protocole et un outil de lecture du statut de TaskBoard. Le serveur impose environnement, fenêtre de temps, volume et durée ; les réponses sont expurgées. Commencer sans pouvoir de modification. Le choix `stdio` ou HTTP doit être explicite, avec son mécanisme d’accès et ses tests. MCP décrit les échanges ; les permissions sont imposées par le programme et les systèmes cibles.

**Portfolio.** Fournir une démonstration, des décisions d’architecture, un incident inconnu du candidat et une grille d’entretien. Le lecteur sépare réalisé et vérifié, conçu seulement et restant à apprendre.

## Incidents à intégrer

Demande de plateforme sans propriétaire, image hors contrat, outil MCP appelé sur un environnement interdit et journal contenant une instruction piégée. Les refus doivent être observables sans divulguer de secret ni élargir le mandat de l’agent.

## Critères de réussite

- Un tiers demande un service, reçoit un résultat vérifiable et comprend un refus.
- Les données du service existant et son témoin restent inchangés.
- L’outil MCP lit un état réel ; une demande hors périmètre est refusée par le code.
- Les tests couvrent limites, erreurs, délai et données non fiables ; les journaux attribuent l’action.
- Le tiers reproduit le portfolio et évalue un diagnostic avec une grille explicite.
- Aucune expérience de production non vécue n’est présentée comme acquise.

## Preuves et nettoyage attendus

Conserver les demandes, validations, réponses expurgées, résultats d’évaluation et retours du lecteur. Retirer les identités de test et les services créés ; arrêter le serveur MCP. La finalisation demande des implémentations et une évaluation indépendante, pas seulement une nouvelle illustration.

[Retour au parcours](../README.md)
