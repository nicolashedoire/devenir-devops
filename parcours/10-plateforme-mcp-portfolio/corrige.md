# Corrigé du jalon 10

## La même tâche, une autre entrée

Après démarrage de l’offre sur 3400, exécutez ce contrôle en lecture seule :

```sh
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const before = JSON.parse(await readFile('preuves/tache-temoin.json', 'utf8'));
const response = await fetch(`http://127.0.0.1:3400/api/tasks/${before.id}`);
assert.equal(response.status, 200);
const after = await response.json();
for (const field of ['id', 'title', 'created_at']) {
  assert.equal(after[field], before[field], `Champ modifié : ${field}`);
}
console.log('Même tâche conservée par l’offre locale.');
JS
```

Le port sélectionne une entrée réseau, pas un emplacement de données. La combinaison des fichiers Compose garde le projet et le volume. L’image au digest donne un contenu identifié ; elle ne sauvegarde pas PostgreSQL. Le contrat généré est une intention contrôlée, tandis que cette relecture apporte une preuve après livraison.

## Une troisième preuve bornée

Une preuve de restauration pourrait accepter uniquement `id: restauration-recente`, pointer vers un fichier sélectionné par le programme et retourner date, référence de source, égalité des lignes et durée. Elle devrait refuser le contenu non conforme, une preuve trop volumineuse et une date trop ancienne selon une règle explicite. Son statut serait « dernière restauration observée », jamais « toutes les sauvegardes sont saines ».

Un paramètre `path` ouvrirait l’accès à des fichiers imprévus ; un paramètre `command` transformerait le serveur de lecture en relais de commandes. Une validation de schéma ne suffit pas si l’implémentation concatène ensuite ce paramètre dans un terminal. Il faut limiter les capacités dans le programme et dans l’identité d’exécution.

L’instruction piégée de la fixture demeure une donnée. Le test vérifie qu’elle est absente de la réponse et qu’aucune action n’est exécutée. Il ne prouve pas le comportement d’un modèle qui n’a pas été appelé. Décrivez séparément : tests du protocole, contrôles d’accès, expurgation et évaluation éventuelle d’un assistant.

## Réponse d’entretien et portfolio

Une bonne présentation tient en trois minutes : problème rencontré, changement limité, preuve conservée, incident provoqué et limite restante. Vous pouvez montrer l’erreur de port, le refus MCP et le retour à la disponibilité. Si le laboratoire seul a été exécuté, écrivez « laboratoire local » ; un recruteur ou un collègue pourra alors discuter du raisonnement sans devoir deviner l’expérience réellement acquise.

[Retour à l’atelier](README.md)
