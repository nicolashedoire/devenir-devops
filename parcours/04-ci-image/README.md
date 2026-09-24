# Jalon 04 — Relier un commit à une image testée

**Chapitre 8. Guide disponible.** Les exécutions et références effectivement publiées figurent dans le [registre](../../docs/validation.md).

## Le problème

Une image portant un nom lisible ne dit pas nécessairement quel code elle contient ni quels essais elle a passés. Vous allez suivre la chaîne **commit → tests → image conservée → registre → empreinte de contenu**, puis distinguer validation et publication.

## Prérequis et état d’entrée

Le jalon 03 est terminé ; sa tâche et son volume sont conservés. Il faut Node.js 24.19.0, Git, Docker et un accès de lecture aux exécutions GitHub Actions. Pour lancer ou modifier la CI, utilisez un dépôt sur lequel vous avez les droits appropriés, par exemple votre propre copie sur GitHub ; la lecture des exécutions publiques suffit pour étudier la chaîne du dépôt de référence.

Les données de CI sont synthétiques et isolées de votre laboratoire. Le témoin personnel du jalon 03 reste local : on n’envoie pas sa base à GitHub pour tester un changement.

## Étape 1 — Vérifier la version locale

```sh
git status --short
git rev-parse HEAD
npm ci
npm test
npm run check:docs
```

Notez le commit et les éventuelles modifications locales. Un commit seul ne décrit pas des fichiers modifiés mais non enregistrés. Le contrôle documentaire vérifie notamment la cohérence des liens ; il ne remplace pas une relecture pédagogique.

## Étape 2 — Lire le circuit de validation

Ouvrez `.github/workflows/ci.yml`, puis l’onglet **Actions** du dépôt GitHub. Le flux de travail (*workflow*) « Vérifier le parcours TaskBoard » démarre sur une demande de fusion (*pull request*), un envoi vers `main` ou un lancement manuel.

Le traitement `validate` installe les dépendances verrouillées, contrôle l’environnement et les documents, exécute les tests puis les vérifications PostgreSQL et restauration. Son artefact `validation-<SHA>` contient les preuves. `SHA` désigne ici le commit complet testé. Ouvrez une exécution réelle et relevez : déclencheur, commit, étapes, résultat et fichiers joints. « Vert » sans ces éléments ne suffit pas à identifier le périmètre vérifié.

Le nettoyage de CI arrête son propre projet Compose. Le laboratoire du lecteur n’est pas sa cible. Les bases de test du système d’exécution (*runner*) ne constituent pas un stockage durable du parcours.

## Étape 3 — Publier uniquement après validation

La publication est distincte : dans **Actions → Vérifier le parcours TaskBoard → Run workflow**, la personne autorisée choisit `main` et active `publish_image`. Sans cette option, l’image n’est pas publiée ; c’est le fonctionnement attendu.

La chaîne conserve l’image testée sous forme d’artefact, puis la transmet au traitement `publish`, qui la charge et la publie **sans la reconstruire**. Le registre du dépôt de référence est `ghcr.io/nicolashedoire/devenir-devops`. L’étiquette (*tag*) publiée est `sha-<commit-complet>` ; aucun `latest` n’est utilisé. Dans une copie du dépôt, le propriétaire du registre est celui de cette copie.

La sortie de publication fournit une référence `ghcr.io/...@sha256:...`. Recopiez la valeur complète observée, et non les points de suspension. L’artefact `publication-<SHA>` conserve `image-digest.txt` et `revision.txt`. Comparez ce dernier au commit de l’exécution. L’empreinte (*digest*) identifie le contenu ; le tag est une référence lisible qui pourrait être déplacée.

**La visibilité du paquet GHCR est distincte de celle du dépôt GitHub.** Pour permettre le téléchargement anonyme de l’image pédagogique, son mainteneur doit vérifier les paramètres de visibilité du paquet et le rendre public. Un dépôt public ne garantit pas à lui seul cet accès. Un refus de téléchargement peut donc provenir des permissions du paquet, même si sa construction a réussi ; voir les [règles du registre GitHub](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

## Étape 4 — Examiner l’image réellement publiée

Dans votre terminal, saisissez la référence complète observée après la commande `read` :

```sh
read -r TASKBOARD_IMAGE
docker pull "$TASKBOARD_IMAGE"
docker image inspect "$TASKBOARD_IMAGE" \
  --format '{{.Architecture}} {{index .Config.Labels "org.opencontainers.image.revision"}}'
```

La commande `read` attend votre saisie sur la ligne suivante. Le label de révision doit correspondre au commit ; il complète le lien fourni par l’exécution de CI, sans constituer une signature cryptographique. La CI de référence construit sur Linux AMD64. Une machine ARM doit disposer d’une exécution compatible pour lancer cette image ; télécharger l’image n’établit pas cette compatibilité.

Pour utiliser cette image avec votre PostgreSQL existant, préparez un remplacement Compose local :

```sh
mkdir -p preuves
cat > preuves/image-publiee.yaml <<YAML
services:
  migrate:
    image: ${TASKBOARD_IMAGE}
  api:
    image: ${TASKBOARD_IMAGE}
YAML
docker compose -f compose.yaml -f preuves/image-publiee.yaml up -d --no-build
```

La référence saisie doit être celle du dépôt TaskBoard attendu. Cette opération conserve la définition de `db` et son volume. Attendez `/readyz` à 200, lisez `/version` et comparez la tâche canonique avec **uniquement le bloc Node de comparaison** du [corrigé du jalon 03](../03-docker-postgresql/corrige.md). Ne rejouez pas ses commandes Compose : toutes les opérations Compose de cette étape doivent conserver les deux options `-f` pour utiliser l’image publiée. Vous avez alors relié image publiée, réponse applicative et conservation d’une donnée. La promotion entre environnements via GitOps reste le contrat du jalon 06.

## Incident contrôlé — Un test doit empêcher une livraison

Sur une branche d’exercice de votre propre copie, créez temporairement `app/incident-ci.test.mjs` :

```js
import test from 'node:test';
import assert from 'node:assert/strict';
test('Incident contrôlé : condition impossible', () => {
  assert.equal(1, 2);
});
```

Exécutez `node --test app/incident-ci.test.mjs` et observez le code de sortie non nul. Le script `npm test` énumère ses fichiers : pour faire exercer la même panne à la CI, ajoutez **ce fichier** à sa liste dans `package.json`, puis créez une demande de fusion depuis votre branche d’exercice. N’intégrez pas cette panne à `main`.

## Diagnostic et rétablissement

L’étape de tests doit échouer à l’assertion ajoutée. Une demande de fusion ne déclenche de toute façon aucune publication ; pour le lancement manuel publiant, `publish` dépend de la réussite de `validate`. Distinguez ces deux garanties dans votre compte rendu.

Retirez le fichier d’incident et son ajout à `npm test`, relisez le diff puis relancez les tests. Enregistrez cette correction dans votre branche si vous avez lancé la CI distante. L’exécution suivante doit retrouver sa réussite. Une panne artificielle démontre l’arrêt de cette chaîne, pas la couverture de tous les défauts applicatifs.

## Nettoyage et preuve de sortie

Arrêtez votre laboratoire avec `docker compose -f compose.yaml -f preuves/image-publiee.yaml down`, sans `-v`. Conservez la référence d’image, le commit, les liens d’exécution et le témoin. Fermez votre demande de fusion d’incident sans la fusionner si elle n’a pas vocation à contribuer au projet.

## Challenge

Pourquoi reconstruire une image après les tests fragilise-t-il le lien de preuve ? Quels trois identifiants permettent de relier les tests, l’image du registre et `/version` ? Expliquez aussi pourquoi revenir à une image précédente ne restaure pas automatiquement PostgreSQL.

[Corrigé séparé](corrige.md) · [Contrat du jalon suivant](../05-cloud-opentofu/README.md)
