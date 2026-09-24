# Préparer sa machine

Le parcours utilise un terminal de type POSIX, Git, `curl`, Node.js **24.19.0** et npm. À partir du jalon 03, il utilise aussi Bash, Docker et Docker Compose. Il ne demande pas d’anglais préalable ; le [glossaire](glossaire.md) explique les mots rencontrés.

## Choisir son environnement

- **Linux** : utilisez votre terminal habituel. Le jalon 02 fournit une commande Linux pour observer les ports.
- **macOS** : Terminal convient aux commandes proposées ; la commande d’inspection des ports diffère et est indiquée.
- **Windows** : ouvrez un environnement Linux WSL et placez le dépôt dans son espace de fichiers Linux. Les exemples ne sont pas des commandes PowerShell. L’intégration Docker doit fonctionner dans cet environnement avant le jalon 03.

Ce périmètre prévu n’est pas une affirmation de validation sur tous les systèmes. Consultez [le registre](validation.md) pour les environnements réellement essayés.

## Installer les outils

Installez Git depuis les [instructions du projet Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) correspondant à votre système. Pour Node, utilisez les [distributions officielles](https://nodejs.org/en/download), choisissez la version **24.19.0** adaptée à votre architecture, ou utilisez votre gestionnaire de versions déjà installé. Ouvrez ensuite un nouveau terminal.

```sh
node --version
npm --version
git --version
curl --version
```

La première commande doit afficher `v24.19.0`. Notez la version de npm installée. `command not found` signifie que le terminal ne trouve pas le programme : vérifiez l’installation et son chemin de recherche avant de poursuivre. La version choisie sert à comparer les essais ; elle n’est pas présentée comme la plus récente disponible.

Pour Docker, choisissez l’[installation officielle adaptée](https://docs.docker.com/get-started/get-docker/). Un client installé ne suffit pas : le moteur doit aussi être démarré.

```sh
docker version
docker compose version
```

`docker version` doit lire les informations du client et du serveur. Une erreur de connexion au moteur est un prérequis manquant, pas une panne de TaskBoard. Ne modifiez pas arbitrairement les permissions d’un socket pour la contourner.

## Obtenir le projet

Choisissez un dossier où vous pouvez écrire, puis :

```sh
git clone https://github.com/nicolashedoire/devenir-devops.git
cd devenir-devops
git switch --detach v0.2.0
npm run doctor
```

La référence stable `v0.2.0` est recommandée pour suivre cette préédition. `main` est la branche de développement et peut recevoir des changements ultérieurs. Le mode détaché (*detached HEAD*) place les fichiers sur une version précise ; ce message Git n’est pas une erreur. Au jalon 02, vous créerez une branche pour vos propres commits. Ne limitez pas la profondeur du clone : les exercices utilisent l’historique.

`doctor` effectue un diagnostic en lecture seule : il ne télécharge rien, ne démarre pas de conteneur et ne modifie pas la machine. `npm run doctor -- --docker` exige aussi un moteur Docker accessible. L’option `--json` produit une sortie structurée.

## Lire les commandes

Exécutez les blocs depuis la racine du dépôt, sauf indication contraire. Une ligne terminée par `\` continue sur la suivante : copiez le bloc entier sans ajouter une ligne vide. Les résultats attendus sont distingués des commandes. Ne tapez pas les accents graves qui encadrent un exemple.

Un terminal peut rester occupé par le serveur pendant qu’un second envoie une requête. `Ctrl+C` interrompt le processus au premier plan. `127.0.0.1` désigne votre machine ; un port distingue le service demandé. Si le port 3000 est occupé, arrêtez uniquement votre atelier précédent ou utilisez le port alternatif indiqué ; ne tuez pas un processus inconnu.

Passez au [jalon 01](../parcours/01-machine-local/README.md) lorsque les commandes de version fonctionnent, que vous êtes dans le dossier contenant `package.json` et que les remarques de `doctor` sont comprises. Docker peut attendre le jalon 03.
