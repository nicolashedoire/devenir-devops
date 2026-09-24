# Contribuer au parcours

L’objectif est de rendre chaque étape compréhensible et reproductible. Une correction de prérequis, une sortie attendue clarifiée ou un incident mieux expliqué sont des contributions utiles.

## Signaler un blocage

Ouvrez un ticket (*issue*) sur le dépôt avec le jalon, le commit, votre système, les versions d’outils, la commande exécutée, sa sortie et le résultat attendu. Ajoutez les vérifications déjà essayées. Retirez mots de passe, jetons, adresses privées et données personnelles ; ne joignez pas de sauvegarde ni de fichier `.env`. Le [modèle de preuve](docs/preuves.md) distingue constat et hypothèse.

## Proposer une modification

Travaillez sur une branche de votre copie, limitée à un problème. Décrivez dans la demande de fusion (*pull request*) le symptôme, le changement et les essais réellement réalisés. Mentionnez aussi ce qui n’a pas été exécuté.

Pour une modification applicative, commencez par `npm test`. Si elle touche PostgreSQL, les migrations ou Compose, exécutez aussi les scripts de vérification et de restauration dans un laboratoire adapté. Une modification documentaire demande une lecture des commandes, liens et prérequis concernés. Les tests doivent protéger un comportement utile, sans répéter mécaniquement le code.

Conservez le contrat `id`, `title`, `created_at` de la tâche témoin. Tout changement du schéma passe par une migration documentée ; supprimer le volume n’est pas une stratégie de migration. Les anciens exemples de `archive/legacy/` ne constituent pas une base implicitement validée.

## Écrire en français

Les README, guides, questions, incidents, corrigés et explications sont rédigés en français. Introduisez une notion comme « demande de fusion (*pull request*) », puis employez le terme le plus clair. Gardez commandes, noms d’API, identifiants et messages réels inchangés ; expliquez leur sens à proximité. Les [conventions](docs/conventions.md) et le [glossaire](docs/glossaire.md) font référence. Aucun anglais préalable n’est requis pour comprendre la pédagogie.

## Protéger les preuves et le périmètre

Les observations personnelles vont dans `preuves/`, les sauvegardes dans `backups/`. Ces dossiers sont ignorés par Git. `docs/validation.md` est consolidé par le mainteneur à partir de résultats identifiables. Une copie du résultat attendu n’est pas une preuve d’exécution.

La publication d’image est une action manuelle réservée à la branche principale, après réussite des contrôles. Le manuscrit et ses fichiers de fabrication ne doivent pas entrer dans ce dépôt. Le compagnon est distribué sous licence MIT ; les contributions doivent pouvoir être distribuées sous cette même licence. Le manuscrit, la couverture et les illustrations du livre restent exclus. Consultez [le périmètre de la licence](docs/licence.md).
