# Corrigé — Accès, SLI et incident

Une bonne preuve mentionne sa date, la révision servie et le chemin de son résultat. Elle ne se réduit pas à « tout est vert ».

## Accès

Le client sans CA approuvée doit échouer pendant TLS. Avec la CA correcte mais sans jeton, la passerelle répond 401. Avec un jeton valide, une création répond 201 et la tâche peut être relue. Ces trois résultats testent des propriétés différentes : identité du serveur, authentification du client et droit d’effectuer l’opération. Le test vérifie aussi des routes interdites, une méthode destructive et un corps trop grand.

La rotation est réussie si le jeton précédent reçoit 401 et le nouveau 200. Le secret n’apparaît pas dans la preuve. Le mécanisme reste un accès partagé : il n’associe pas chaque tâche à une personne et ne prouve aucune autorisation individuelle.

## SQL

`SELECT` et `INSERT` nécessaires à l’API fonctionnent. `CREATE TABLE` doit échouer avec `42501`. Un simple compte « différent de postgres » ne serait pas une preuve de moindre privilège : le test vérifie une action effectivement interdite. L’identité de migration détient les droits de schéma ; elle ne doit pas être utilisée par le service pendant son fonctionnement normal.

## SLI et budget

Pour 100 000 requêtes, le budget est `100000 × (1 − 0,999) = 100` échecs. Soixante-dix échecs en consomment 70 % et laissent 30 échecs dans cet exemple à volume fixé. Une fenêtre glissante réelle évolue avec le trafic : ce calcul n’est pas un compteur de crédits éternels.

La sonde locale compte ses tentatives, y compris les erreurs réseau. Le ratio de latence porte sur les lectures réussies ; il peut être excellent pendant que la disponibilité est mauvaise. Les deux indicateurs doivent donc être lus ensemble.

## Chronologie

La preuve d’incident contient le début observé, les événements reçus `firing` et `resolved`, la durée d’impact observée, la durée de reprise après action et les contrôles d’accès/données. Utilisez ces valeurs réellement produites ; n’inventez pas d’heures pour obtenir une histoire propre.

`firing` signifie que le destinataire a reçu une notification ; il ne signifie pas qu’un humain a pris en charge la panne. `resolved` dépend aussi de la fenêtre de mesure : son arrivée peut suivre le retour effectif de l’API. Le service est rétabli lorsque les lectures utiles réussissent et que le témoin est conservé.

Trois réplicas API utilisent la même base : ils ne créent pas une base disponible. Une augmentation de réplicas peut même accroître les tentatives de connexion pendant sa panne. La mitigation testée consiste à redémarrer la dépendance arrêtée, puis à vérifier le parcours.

## Limites à citer

Le certificat est approuvé localement et expire après sept jours ; il n’est pas une chaîne de confiance publique. Le jeton donne les mêmes droits à tout son groupe. PostgreSQL est mono-instance, le destinataire d’alertes conserve les événements en mémoire et les flux internes ne sont pas chiffrés. Le laboratoire prouve des mécanismes sur cette cible, pas une disponibilité cloud.

Une exécution interrompue ou un résultat absent reste non validé. Reprenez les services avec `node operations/lab.mjs up`, examinez le périmètre, puis rejouez uniquement la commande qui a échoué avant de conclure.
