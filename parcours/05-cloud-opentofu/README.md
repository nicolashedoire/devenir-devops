# Jalon 05 — Cloud et OpenTofu

**Chapitres 9–10. À réaliser : contrat de progression, pas tutoriel achevé.** Aucun provisionnement cloud complet n’est fourni par cette préédition. Le [registre](../../docs/validation.md) est la référence des essais réels.

## Problème et état d’entrée

Une application reproductible sur votre ordinateur ne suffit pas à créer son environnement distant. Vous disposez de l’image traçable du jalon 04, d’une base locale sauvegardée et du témoin `id/title/created_at`. Ce jalon doit produire des fondations cloud identifiées, bornées et supprimables, sans perdre ce témoin ni exposer un service non protégé.

## Livrables à construire

Un dossier `infra/` devra réunir un fournisseur de référence, une version d’OpenTofu, les versions de fournisseurs (*providers*) et leur verrou, les variables documentées, un état distant protégé et les ressources nécessaires à la cible retenue. Le guide devra expliquer compte, région, identités, réseau, base privée, estimation et suivi des coûts. Les commandes de création, vérification, dérive et retrait devront être complètes et exécutées sur un compte de laboratoire.

Le choix d’AWS dans le livre constitue une cible de conception ; il ne tient pas lieu de module livré. Les exercices simples d’import d’un objet ne remplacent pas l’infrastructure de TaskBoard.

## Incident à intégrer

Modifier une propriété non sensible d’une ressource de laboratoire hors d’OpenTofu, observer la dérive (*drift*), puis faire converger l’état vers la configuration. Une mauvaise identité de compte doit faire interrompre l’opération avant création. La procédure doit distinguer divergence attendue et remplacement destructeur.

## Critères de réussite

- Le plan décrit uniquement les ressources prévues, dans le compte attendu.
- Les ressources créées correspondent à la configuration ; l’état est protégé et récupérable.
- Une dérive est détectée, comprise puis corrigée ; un second plan ne propose plus de changement.
- La suppression du laboratoire et la recherche de ressources résiduelles sont démontrées.
- La base locale et le témoin du jalon 03 demeurent intacts ; toute future migration dispose d’un protocole d’export/restauration.

## Preuves et nettoyage attendus

Conserver versions, commit, plans expurgés, inventaires avant/après, coût observé et rapport de retrait. Le démontage du cloud ne doit pas supprimer le volume local ni ses sauvegardes. Il faudra une exécution indépendante avant de remplacer ce contrat par un guide validé.

[Retour au parcours](../README.md) · [Jalon suivant](../06-kubernetes-helm-gitops/README.md)
