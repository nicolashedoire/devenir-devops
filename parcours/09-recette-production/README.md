# 09 — Restaurer et décider à partir de preuves

**Résultat visé :** restaurer un snapshot dans une nouvelle base sans remplacer la base active, puis exécuter une recette locale reproductible. **Prérequis :** jalon 08 initialisé avec succès, fichiers privés `work/operations` conservés, Docker accessible. Prévoir 30–45 minutes. Aucune ressource AWS ne sera créée.

Une recette est une série de critères d’acceptation, pas un titre accordé à une architecture. Les contrôles de ce jalon concernent le laboratoire HTTPS local. L’ouverture à des utilisateurs externes demande d’autres preuves et une décision explicite.

## 1. Vérifier la cible

```bash
node operations/lab.mjs up
node operations/lab.mjs verify
```

L’image servie doit correspondre à `deploy/image-reference.json` enregistré lors de l’initialisation. Le témoin doit conserver `id`, `title` et `created_at`. Si le laboratoire provient d’une initialisation interrompue ou ancienne sans empreinte complète, la restauration refuse de prétendre à une comparaison exacte. Conservez ses données et son diagnostic ; ne contournez pas ce refus en inventant une empreinte.

## 2. Restaurer ailleurs

```bash
node operations/lab.mjs restore
```

Le script crée une base `taskboard_restore_ops_...` distincte dans le serveur opérations. Il utilise le dump pris à l’initialisation. La base active continue d’exister et la source Compose reste intacte. Le contrôle compare l’empreinte des lignes ordonnées, leur nombre et la séquence des identifiants.

Le temps `restauration_et_controle_ms` comprend la création de la base cible, l’import et les comparaisons. Il ne comprend pas la reconstruction d’un serveur après perte de disque, la récupération distante du fichier, une résolution DNS ou la remise en service des utilisateurs. C’est une mesure de cette étape de reprise, pas un RTO universel.

Les écritures effectuées après le snapshot, notamment les tâches de contrôle de sécurité, ne sont pas dans ce dump. Leur absence dans la nouvelle base est attendue. Pour mesurer un RPO, on relie l’heure du snapshot au moment de l’incident et à la stratégie de sauvegarde ; « toutes les lignes du dump sont revenues » ne signifie pas « aucune écriture récente ne sera perdue ».

## 3. Exécuter la recette

```bash
node operations/recette.mjs
```

Les étapes sont `verify`, `rotate`, `probe`, `restore` et `incident`. Chaque étape écrit sa propre preuve. Le rapport final donne `result`, les heures de début et fin, la cible et les chemins des résultats. Il s’arrête au premier échec ; il ne masque pas un contrôle absent par une moyenne favorable.

La recette crée des tâches et une base de restauration supplémentaires dans le projet opérations. Elle renouvelle le jeton et provoque une interruption contrôlée de sa base. N’utilisez donc pas cette commande contre un service utilisé par d’autres personnes. Son environnement est fixé par le code, sans paramètre permettant de lui substituer une URL de production.

## 4. Construire une matrice d’acceptation

Dans votre carnet, associez chaque exigence à une preuve :

| Exigence | Preuve attendue | Limite |
|---|---|---|
| Accès protégé | refus TLS/401 et opération autorisée | jeton de groupe local |
| Identité du logiciel | révision et digest choisis | pas une analyse de vulnérabilité exhaustive |
| Données conservées | témoin, toutes les lignes, séquence | snapshot à une date donnée |
| Reprise mesurée | durée et cible distincte | même serveur PostgreSQL |
| Incident détecté | notification reçue `firing` | destinataire local |
| Incident terminé | lecture utile et `resolved` | panne de dépendance seulement |

Ajoutez les preuves du jalon 06 pour les Pods/PVC et GitOps, et du jalon 07 pour les trois signaux. Elles concernent d’autres copies pédagogiques de la même tâche. Elles ne composent pas magiquement un environnement cloud intégré.

## 5. Challenge

Rédigez une décision de mise en service en deux parties. Première partie : ce que cette recette autorise réellement à présenter en démonstration locale. Deuxième partie : ce qui manque avant d’accueillir un groupe externe ou un public multitenant. Pour chaque manque, nommez un test de recette et un responsable fonctionnel, sans inventer de personnes.

Incluez un plan de bascule : arrêter ou contrôler les écritures, réaliser le dernier transfert cohérent, vérifier les comptes et données, diriger progressivement les clients, surveiller les indicateurs et définir le retour arrière. Expliquez pourquoi revenir au digest précédent ne restaure pas une base modifiée.

## 6. Conserver les preuves et arrêter

```bash
node operations/lab.mjs down
```

Publiez seulement une version expurgée des résultats. Gardez localement les sauvegardes et secrets selon votre politique. Ne supprimez jamais la source pour conclure l’exercice. Le [corrigé](corrige.md) propose les critères d’une décision défendable.
