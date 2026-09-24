# Validation des opérations

Le workflow [36009530009](https://github.com/nicolashedoire/devenir-devops/actions/runs/36009530009), exécuté le 24 septembre 2026 sur le commit `8bceb86`, a terminé avec succès sur un runner Linux indépendant. Il a créé sa propre source PostgreSQL et sa tâche témoin, puis initialisé le projet opérations. Aucune base de l’ordinateur ni ressource AWS n’a participé à ce contrôle.

| Contrôle réel | Résultat |
|---|---|
| Tests de frontière de la passerelle | 8 tests réussis |
| Import du snapshot | lignes, séquence et témoin conservés |
| TLS et autorisation | certificat non approuvé refusé ; sans/faux jeton 401 ; création autorisée et relue |
| Limites | routes, méthodes et corps hors contrat refusés |
| Rôle SQL | lecture/insertion autorisées ; CREATE TABLE refusé |
| Rotation | ancien jeton refusé ; nouveau accepté |
| Sonde HTTPS | 20 lectures réussies sur 20, toutes sous 300 ms lors de cette exécution |
| Restauration distincte | lignes et séquence identiques ; 668 ms création/import/contrôle |
| Notification d’incident | `firing` reçu à 14:01:18.871 UTC, `resolved` à 14:01:43.876 UTC |
| Récupération | impact local observé 20,183 s ; reprise après action 1,186 s |
| Recette | cinq étapes réussies ; sept fichiers de preuve expurgés conservés en artefact |

Ces durées sont les observations de cette exécution, pas des performances garanties. La restauration concernait une petite fixture d’une tâche ; le test ne démontre ni le temps d’une base volumineuse, ni le délai de reconstruction d’un serveur, ni une disponibilité multizone. La sonde ne prouve pas un SLO de trente jours. Le rapport final conserve explicitement `public_exposure_authorized: false`.

Les artefacts ne contiennent pas les secrets, la clé de CA, le dump, les mots de passe ou les titres des tâches. Le run et son commit permettent de retrouver le code réellement testé. Un changement du code ou des images exige une nouvelle validation appropriée.
