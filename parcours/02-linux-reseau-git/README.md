# Jalon 02 — Relier processus, réseau et changement Git

**Chapitres 3–5. Guide disponible.** [Portée des essais](../../docs/validation.md).

## Le problème

« Le site ne répond pas » ne désigne pas une cause unique. Vous allez relier une adresse à un processus, provoquer une erreur de port et enregistrer un changement explicable dans Git. Le but est d’obtenir une méthode, pas de mémoriser des commandes isolées.

## Prérequis et état d’entrée

Le jalon 01 est terminé ; ses serveurs sont arrêtés. Node.js 24.19.0, Git et `curl` sont disponibles. Linux utilise ici `ps` et `ss` ; macOS utilise `ps` et `lsof`. Les commandes Linux du parcours Windows s’exécutent dans WSL. Les données restent temporaires jusqu’au jalon 03.

## Étape 1 — Se repérer dans le système

```sh
pwd
ls -ld . app
ls -l app/server.mjs
git status --short
```

`pwd` indique où vous êtes ; `ls -l` montre notamment propriétaire et permissions. `r` signifie lecture, `w` écriture et `x` exécution ou traversée d’un dossier. Ne changez pas ces droits pour cet exercice. Une commande qui échoue dans le mauvais dossier demande d’abord de corriger le chemin.

Dans un premier terminal, démarrez un processus au premier plan :

```sh
env -u DATABASE_URL HOST=127.0.0.1 PORT=3100 FAULT_MODE=off npm start
```

## Étape 2 — Trouver le processus et son écoute

Dans un second terminal :

```sh
ps -eo pid,ppid,args
```

Repérez `node app/server.mjs`. Le PID est le numéro du processus, le PPID celui de son parent. Le lanceur npm et le serveur Node peuvent être deux processus distincts ; ne confondez pas leur rôle.

Sous Linux :

```sh
ss -ltnp 'sport = :3100'
```

Sous macOS :

```sh
lsof -nP -iTCP:3100 -sTCP:LISTEN
```

L’écoute attendue est locale sur 3100. Le nom du processus peut ne pas être affiché avec les mêmes détails selon les permissions ; l’adresse et le port restent une observation utile. N’ajoutez pas des privilèges sans comprendre ce qui manque.

```sh
curl --max-time 3 -i http://127.0.0.1:3100/readyz
curl --max-time 3 -i http://localhost:3100/readyz
```

La première commande utilise directement l’adresse de bouclage. La seconde utilise un nom que la machine résout ; selon sa configuration, `localhost` peut proposer IPv4 et IPv6. Si les résultats diffèrent, comparez les adresses réellement tentées avec `curl -v`, sans modifier TaskBoard au hasard.

## Incident contrôlé — Une fiche indique le mauvais port

```sh
curl --max-time 3 -i http://127.0.0.1:3101/readyz
curl --max-time 3 -i http://127.0.0.1:3100/healthz
```

3101 est volontairement différent du port lancé. La première connexion doit échouer si aucun autre service n’y écoute ; la seconde doit répondre 200. Si 3101 répond, identifiez ce service et consignez cette observation : le résultat attendu supposait un port libre.

## Diagnostic

Écrivez trois faits : port demandé par la commande, port observé par l’outil système et résultat sur l’adresse correcte. L’hypothèse « mauvais port » explique ces faits ; une hypothèse « base PostgreSQL arrêtée » ne convient pas à cette instance en mémoire. Corrigez la fiche de lancement, pas le code applicatif.

## Étape 3 — Versionner ce que l’on a compris

Arrêtez le serveur avec `Ctrl+C`. Vérifiez que votre copie ne contient pas d’autres changements à mélanger :

```sh
git status --short
git log -3 --oneline
git switch -c apprentissage/jalon-02
mkdir -p notes
```

Créez avec votre éditeur `notes/reseau.md`, contenant le port choisi, les trois observations et l’hypothèse rejetée. N’y placez aucun secret. Puis :

```sh
git diff
git add notes/reseau.md
git diff --cached
git commit -m "Documenter le diagnostic de port local"
git log -1 --oneline
```

Un fichier nouveau n’apparaît pas dans `git diff` avant son ajout : `git status --short` le montre comme non suivi (*untracked*). `git diff --cached` permet de relire le contenu préparé pour l’enregistrement (*commit*). Si Git demande une identité, configurez-la pour ce dépôt. Remplacez les deux valeurs ci-dessous par le nom et l’adresse que vous souhaitez associer à vos commits, puis relancez la commande `git commit` :

```sh
git config --local user.name "VOTRE NOM À REMPLACER"
git config --local user.email "VOTRE ADRESSE À REMPLACER"
```

Ne conservez pas les valeurs d’exemple. Si vous comptez publier ces commits, choisissez l’adresse que vous acceptez d’y afficher ; GitHub peut vous fournir une adresse masquée dans vos paramètres de compte. L’option `--local` limite le réglage à ce dépôt.

## Nettoyage

Ce jalon ne nécessite aucun envoi distant (*push*). Gardez votre branche et votre commit comme preuve. Assurez-vous que le serveur local est arrêté pour libérer les ports avant Compose. Ne supprimez pas vos notes ni l’historique pour obtenir artificiellement un dossier « propre ».

## Preuve de sortie

Conservez l’identification du processus, son écoute, les deux résultats de connexion, le commit et l’explication de la différence entre fichier non suivi, modification préparée et commit enregistré.

## Challenge

Ajoutez dans `notes/reseau.md` la phrase erronée « Toute erreur de connexion prouve une panne DNS. », enregistrez-la dans un nouveau commit, puis annulez **ce seul commit** par un commit inverse. Expliquez pourquoi l’historique obtenu est plus informatif qu’une suppression des preuves.

[Corrigé séparé](corrige.md) · [Jalon suivant](../03-docker-postgresql/README.md)
