# Conserver une preuve utile

Une preuve relie une version, une action et une observation. Elle permet à une autre personne de refaire l’expérience et de comprendre ce qu’elle établit.

Créez un dossier personnel, ignoré par Git :

```sh
mkdir -p preuves
git rev-parse HEAD > preuves/commit.txt
npm run --silent doctor -- --json > preuves/doctor.json
```

La redirection `>` remplace un fichier existant : changez le nom pour conserver plusieurs essais. Pour chaque expérience, remplissez une fiche :

```text
Jalon :
Date et système :
Commit et versions d’outils :
Préconditions (stockage, port, état initial) :
Commande exécutée :
Résultat attendu :
Résultat observé et code de sortie :
Hypothèse confirmée ou rejetée :
Retour à l’état normal :
Limites de cette preuve :
```

Ne recopiez pas une sortie attendue dans « observé ». Un échec documenté aide au diagnostic. Conservez les messages significatifs, sans secrets ni données personnelles.

Au jalon 03, `preuves/tache-temoin.json` conserve la réponse à la création de la tâche canonique. Les scripts créent aussi des témoins de test ; ceux-ci ne remplacent pas cette tâche. Les sauvegardes et rapports de restauration vont dans `backups/`, selon le chemin affiché par le script.

Vos essais ne modifient pas automatiquement le [registre du dépôt](validation.md), tenu à partir de résultats relus et bornés. Une observation sur votre machine ne démontre pas à elle seule la compatibilité avec tous les systèmes.
