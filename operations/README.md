# Laboratoire opérations : accès, fiabilité et reprise

Ce laboratoire crée le projet Docker **taskboard-operations**, indépendant de la source Compose. Il restaure un instantané de ses données, conserve la tâche témoin et ajoute une passerelle HTTPS, un jeton de groupe renouvelable, un compte SQL applicatif limité, Prometheus, Alertmanager et un destinataire d’alertes local. Aucun service n’est exposé sur Internet. Aucun compte cloud n’est utilisé.

## Préparer et initialiser

Depuis la racine du dépôt, avec la version Node de `.node-version`, Docker Compose et OpenSSL disponibles, terminez les jalons 03–04. Le service source `db` doit fonctionner et `preuves/tache-temoin.json` doit correspondre à une tâche réellement présente. Vérifiez l’espace libre du disque et de la machine virtuelle Docker avant de télécharger les images. Ne lancez pas d’autre import ou écriture sur la source pendant le snapshot.

```bash
node --test operations/gateway.test.mjs
node operations/lab.mjs init --witness preuves/tache-temoin.json
```

Le programme sélectionne l’image publiée par digest dans `deploy/image-reference.json`. Il crée des secrets aléatoires, une autorité TLS locale et un certificat valable sept jours pour `localhost` et `127.0.0.1`. Il suspend brièvement l’API source uniquement si elle était démarrée, puis la reprend. La source n’est ni supprimée ni remplacée. L’import compare toutes les lignes, leur empreinte SHA-256 et la séquence des identifiants ; la relecture HTTPS contrôle aussi les trois champs exacts du témoin.

La cible est un instantané pédagogique. Les nouvelles tâches créées par les contrôles d’accès appartiennent seulement à cette copie ; elles ne sont jamais réinjectées dans la source. Il n’existe pas de synchronisation entre les bases des ateliers.

Les fichiers `work/operations/lab.env`, les clés, jetons, dump et identité du snapshot sont privés et ignorés par Git. Le répertoire parent est en mode 0700. Les fichiers montés dans le conteneur sont lisibles par son utilisateur non privilégié ; ne les copiez pas dans un dossier partagé. Les preuves expurgées n’incluent ni mots de passe ni jetons ni titres de tâches. Le serveur conserve une clé TLS, jamais la clé privée de l’autorité.

## Rejouer des contrôles précis

```bash
node operations/lab.mjs verify
node operations/lab.mjs rotate
node operations/lab.mjs probe --count 20
node operations/lab.mjs restore
node operations/lab.mjs incident
```

`verify` exige le refus d’un certificat non approuvé, des réponses 401 sans jeton ou avec un faux jeton, le refus des routes/méthodes/corps hors contrat, une écriture autorisée puis sa relecture, le témoin initial et la bonne version. Il contrôle aussi que l’API et PostgreSQL n’ont aucun port hôte et que le rôle applicatif ne peut pas créer une table.

`rotate` remplace atomiquement le jeton puis vérifie ancien jeton refusé et nouveau accepté. Il ne l’affiche pas. `probe` mesure entre 5 et 200 lectures HTTPS ; le taux de réussite et la part des lectures réussies sous 300 ms sont une observation locale ponctuelle, jamais une preuve de SLO sur trente jours.

`restore` crée une **nouvelle base** dans PostgreSQL opérations, restaure le snapshot initial, compare lignes et séquence, et conserve cette cible. Sa durée inclut création, restauration et contrôle ; elle n’inclut pas l’obtention d’un nouveau serveur ni une bascule utilisateur.

`incident` chauffe les mesures, arrête uniquement la base opérations, attend une notification réelle `firing` au destinataire local, reprend la base, vérifie les lectures et attend `resolved`. Le destinataire est un petit serveur privé ; aucun email, SMS ou message à une équipe n’est envoyé. La règle utilise une fenêtre de 30 secondes et 10 secondes de confirmation pour un exercice court. Ce seuil ne constitue pas une politique d’astreinte de production.

## Recette complète et arrêt

```bash
node operations/recette.mjs
node operations/lab.mjs down
node operations/lab.mjs up
```

La recette enchaîne les cinq contrôles et écrit un résumé dans `preuves/recette-locale-.../resultat.json`, avec un lien vers chaque preuve. En cas d’échec, elle s’arrête ; les données restent disponibles. `down` ne supprime aucun volume. `up` reprend les services ; il ne renouvelle pas un certificat expiré. Après sept jours, traitez le renouvellement comme une maintenance explicite en conservant données et preuves ; ne supprimez jamais un volume pour réparer TLS.

## Lire la portée du résultat

HTTPS utilise ici une autorité que le client approuve explicitement, pas une autorité publique. Le jeton donne à un groupe le même droit de lire et créer toutes les tâches ; ce ne sont ni des comptes individuels, ni une autorisation par propriétaire. Le chiffrement entre la passerelle et l’API, puis entre l’API et PostgreSQL, n’est pas déployé dans ce réseau local. La base reste mono-instance sur un disque Docker. Le destinataire d’alertes garde ses événements en mémoire. La recette ne certifie aucune disponibilité AWS, aucun système multizone et aucune ouverture publique.

L’exécution GitHub Actions `operations.yml` crée sa propre source sur un runner éphémère et rejoue les mêmes commandes. Son résultat est une preuve seulement quand le run est terminé avec succès ; l’existence du workflow ne démontre rien à elle seule.
