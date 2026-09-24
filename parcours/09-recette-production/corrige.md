# Corrigé — Recette et reprise

La restauration réussit si la cible est distincte, si toutes les lignes du snapshot et la séquence correspondent, et si les bases source et active sont conservées. Un nombre de lignes identique seul est insuffisant : des valeurs pourraient avoir changé. Un témoin seul est également insuffisant : il ne décrit pas tout le jeu de données. Les trois contrôles se complètent.

Le résultat de la recette doit être `succes` et pointer vers les cinq preuves. Une ligne `echec`, une preuve ambiguë ou un contrôle interrompu bloque la conclusion. Le rapport contient volontairement `public_exposure_authorized: false` : réussir des essais locaux ne remplace pas une décision de mise en service.

## Exemple de décision recevable

« Le laboratoire permet de démontrer la lecture et l’écriture derrière une passerelle HTTPS explicitement approuvée, le refus d’accès sans jeton, sa rotation, la séparation des droits SQL, une restauration contrôlée et une alerte reçue puis résolue. Ces résultats portent sur une cible Docker locale, une base mono-instance et un jeton de groupe. Les preuves sont attachées avec leur date et leur révision. »

Pour un accès externe, il faudrait notamment une identité TLS adaptée, un mécanisme d’identité/autorisation correspondant au produit, une gestion durable des secrets et sauvegardes, une exploitation supervisée et un réseau validé. Pour un service multitenant, deux comptes ne doivent jamais lire les tâches l’un de l’autre ; le modèle partagé actuel ne fournit pas cette propriété.

## Bascule et retour

Une bascule ne commence pas par modifier un DNS. Elle commence par vérifier la destination, ses identités, sa capacité, sa migration et le dernier état cohérent des données. On choisit ensuite comment arrêter les écritures ou les répliquer, comment comparer les données et comment mesurer l’impact du changement de destination.

Si des écritures arrivent sur la nouvelle base, revenir vers l’ancienne peut perdre ces écritures. Le retour applicatif et le retour de données sont deux décisions distinctes. Une migration compatible avec l’ancienne version permet parfois de revenir à son image sans revenir en arrière sur les données ; une migration destructive peut l’interdire.

La durée de restauration mesurée ici reste un élément du RTO : elle n’inclut pas les délais humains, la fourniture d’un nouveau serveur ou la bascule des clients. Le RPO porte sur les transactions potentiellement perdues entre le dernier point récupérable et la panne. Dans l’atelier, les tâches créées après le snapshot démontrent concrètement cette différence.

## Portfolio

Une preuve solide indique la commande, la date, la révision, la cible, le résultat et la limite. Le candidat explique aussi un échec rencontré et la manière de le diagnostiquer. Une collection de captures vertes sans provenance n’est pas plus convaincante qu’une architecture dessinée sans aucun exercice.
