# Préparer sa machine

Le parcours utilise un terminal de type POSIX, Git, `curl`, Node.js **24.19.0** et npm. À partir du jalon 03, il utilise aussi Bash, Docker et Docker Compose. Il ne demande pas d’anglais préalable ; le [glossaire](glossaire.md) explique les termes rencontrés. Vous installerez les outils spécialisés au moment de leur atelier.

## Choisir son environnement

- **Linux** : utilisez votre terminal habituel. Le jalon 02 fournit une commande Linux pour observer les ports.
- **macOS** : Terminal convient aux commandes proposées ; la commande d’inspection des ports diffère et est indiquée. Les exercices du livre utilisant `systemd` demandent un environnement Linux : ils ne s’exécutent pas directement dans macOS.
- **Windows** : ouvrez un environnement Linux WSL2 et placez le dépôt dans son espace de fichiers Linux. Les exemples ne sont pas des commandes PowerShell. L’intégration Docker doit fonctionner dans cet environnement avant le jalon 03.

Les essais consignés couvrent notamment un poste macOS ARM64 et des exécutions CI Linux AMD64. L’installateur des outils Kubernetes fournit des binaires pour macOS et Linux, sur AMD64 et ARM64 ; cette disponibilité ne signifie pas que l’intégralité du parcours a été rejouée sur chacune de ces combinaisons. Consultez [le registre](validation.md) pour les environnements et les limites réellement observés.

## Installer les premiers outils

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

`docker version` doit lire les informations du client et du serveur. Une erreur de connexion au moteur est un prérequis manquant, pas une panne de TaskBoard. Ne modifiez pas arbitrairement les permissions d’un socket pour la contourner. Les commandes utilisent `docker compose`, le module Compose intégré à Docker, et non l’ancien programme séparé `docker-compose`.

## Prévoir les ressources et les outils des étapes suivantes

Les deux premiers jalons demandent peu de ressources. Le laboratoire Kubernetes du jalon 06 prévoit **8 Gio de mémoire attribuée à Docker au minimum, 12 Gio conseillés et 15 Gio d’espace libre**. Ce budget de préparation n’est pas une garantie de performance sur toute machine. Les images téléchargées et les volumes occupent également l’espace du disque virtuel de Docker Desktop, dont la capacité peut différer de l’espace disponible sur le disque de l’ordinateur.

Ne démarrez pas tous les ateliers lourds en même temps. Suivez le nettoyage indiqué à la fin de chacun, sans supprimer les volumes contenant la base source. Une machine saturée peut provoquer des délais dépassés et des arrêts de conteneurs ; commencez alors par lire l’usage de mémoire et de disque avant de modifier TaskBoard.

| Étape | Préparation supplémentaire |
|---|---|
| 03–04 — Conteneurs et CI | Docker et Compose accessibles ; connexion Internet pour les images et les dépendances. Un compte GitHub est nécessaire pour pousser vos modifications et exécuter les workflows dans votre propre dépôt. |
| 05 — Infrastructure | L’installateur fourni télécharge OpenTofu avec vérification d’empreinte. La répétition locale n’exige aucun compte AWS. L’extension AWS demande AWS CLI v2, une identité autorisée et le suivi des coûts. |
| 06 — Kubernetes et GitOps | L’installateur fourni prépare kind, kubectl et Helm. Le guide isole leur configuration dans le dépôt et vérifie le contexte local avant d’agir. Les versions et empreintes sont dans [le fichier de verrouillage](../deploy/tools-lock.json). |
| 07 — Observabilité | Docker doit pouvoir démarrer les collecteurs et les stockages de métriques, journaux et traces. Arrêtez les laboratoires lourds inutilisés et gardez leurs données. |
| 08–09 — Sécurité et reprise | OpenSSL doit être disponible ; vérifiez avec `openssl version`. Le guide crée une autorité de certification locale pour l’atelier et indique explicitement comment la fournir au client. |
| 10 — Plateforme et MCP | Node suffit aux tests, au générateur et à la démonstration MCP. Le lancement de l’offre générée demande la base Compose des étapes précédentes. Aucun abonnement à un modèle d’IA n’est nécessaire. |

Le parcours principal se poursuit après la répétition locale du jalon 05 sans créer de ressources AWS. L’extension cloud reste distincte : le dépôt vérifie ses configurations et des scénarios simulés, mais ne présente pas ces contrôles comme un déploiement AWS réel.

## Obtenir le projet

Choisissez un dossier où vous pouvez écrire, puis :

```sh
git clone https://github.com/nicolashedoire/devenir-devops.git
cd devenir-devops
git switch --detach v1.0.0
npm run doctor
```

La référence figée `v1.0.0` correspond au parcours accompagné par cette édition. La version applicative TaskBoard reste `0.2.0` : le numéro du parcours et celui de l’application ne décrivent pas la même chose. `main` est la branche de développement et peut recevoir des changements ultérieurs.

Le mode détaché (*detached HEAD*) place les fichiers sur une version précise ; ce message Git n’est pas une erreur. Au jalon 02, vous créerez une branche pour vos propres commits. Ne limitez pas la profondeur du clone : les exercices utilisent l’historique. Si le dépôt existe déjà, consultez `git status` et préservez vos modifications avant de changer de version ; un nouveau clone dans un autre dossier évite de mélanger deux ateliers.

`doctor` effectue un diagnostic en lecture seule : il ne télécharge rien, ne démarre pas de conteneur et ne modifie pas la machine. `npm run doctor -- --docker` exige aussi un moteur Docker accessible. L’option `--json` produit une sortie structurée. Un accès Internet reste nécessaire pour les installations ultérieures ; le diagnostic ne prétend pas vérifier tous les services externes.

## Lire les commandes et conserver ses preuves

Exécutez les blocs depuis la racine du dépôt, sauf indication contraire. Une ligne terminée par `\` continue sur la suivante : copiez le bloc entier sans ajouter une ligne vide. Les résultats attendus sont distingués des commandes. Ne tapez pas les accents graves qui encadrent un exemple.

Un terminal peut rester occupé par le serveur pendant qu’un second envoie une requête. `Ctrl+C` interrompt le processus au premier plan. `127.0.0.1` désigne votre machine ; un port distingue le service demandé. Si le port 3000 est occupé, arrêtez uniquement votre atelier précédent ou utilisez le port alternatif indiqué ; ne tuez pas un processus inconnu. L’observabilité utilise notamment les ports 3010–3012, 3100, 3200, 3300 et 9090 ; une ancienne API démarrée sur 3100 doit donc être arrêtée avant cet atelier. Les guides donnent la liste correspondant à leur configuration.

Conservez la tâche témoin créée au jalon 03, ses trois champs exacts et les sauvegardes. Les dossiers de preuves, de travail et de sauvegardes sont ignorés par Git ; ils ne sont pas pour autant sauvegardés automatiquement ailleurs. N’y placez pas de données de production. Les copies Kubernetes, observabilité et opérations sont des destinations de laboratoire distinctes ; le guide précise quelle base reste la source d’autorité.

Passez au [jalon 01](../parcours/01-machine-local/README.md) lorsque les commandes de version fonctionnent, que vous êtes dans le dossier contenant `package.json` et que les remarques de `doctor` sont comprises. Docker peut attendre le jalon 03.
