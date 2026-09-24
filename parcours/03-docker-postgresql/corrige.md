# Corrigé du jalon 03

Le volume nommé est séparé du conteneur. L’arrêt normal de Compose retire les conteneurs mais conserve ce volume ; la remise en route de **ce même projet Compose** retrouve ses données. Changer le nom du projet peut désigner un autre volume et donner l’impression d’une perte : relevez aussi le contexte du laboratoire.

```sh
docker compose up -d
docker compose run --rm migrate
curl -i http://127.0.0.1:3000/readyz
```

Attendez HTTP 200. L’extrait suivant compare exactement le témoin enregistré avec la réponse actuelle, sur le port par défaut :

```sh
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const before = JSON.parse(await readFile('preuves/tache-temoin.json', 'utf8'));
const response = await fetch(`http://127.0.0.1:3000/api/tasks/${before.id}`);
assert.equal(response.status, 200);
const after = await response.json();
for (const field of ['id', 'title', 'created_at']) {
  assert.equal(after[field], before[field], `Champ modifié : ${field}`);
}
console.log('Témoin conservé : identifiant, titre et date identiques.');
JS
```

Si vous avez choisi un autre port, adaptez cette adresse. Le script échoue si une réponse n’est pas 200 ou si un champ diffère. Il ne crée ni ne corrige de donnée : une divergence demande un diagnostic.

Le même titre seul ne suffit pas : une recréation pourrait changer `id` et `created_at`. Le succès de la migration ne prouve pas non plus la conservation à lui seul ; c’est la relecture qui établit cette propriété.

Pour examiner la restauration, ouvrez les CSV dans le dossier `backups/<identifiant>/` annoncé. `resultat.json` doit conclure à des lignes et une séquence identiques. La base restaurée ne remplace pas automatiquement la base utilisée par l’API : l’essai démontre une récupération séparée, pas une bascule de production.

Terminez par `docker compose down`, sans suppression de volume. [Retour au guide](README.md).
