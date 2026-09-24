# Corrigé du jalon 02

Sur la branche d’apprentissage, ajoutez la phrase demandée avec votre éditeur, puis :

```sh
git add notes/reseau.md
git diff --cached
git commit -m "Exercice : ajouter une hypothese volontairement fausse"
git show --stat HEAD
git revert --no-edit HEAD
git log -3 --oneline
git show HEAD
```

`git revert` crée un nouvel enregistrement qui inverse le changement ciblé. Exécutez-le immédiatement après le commit d’exercice, après avoir vérifié que `HEAD` est bien ce commit. Ne l’appliquez pas à un changement inconnu. Si votre copie a d’autres modifications non enregistrées, terminez ou isolez ce travail avant le challenge.

La phrase erronée doit avoir disparu, tandis que le diagnostic initial reste présent. L’historique explique l’ajout puis son annulation. Une réécriture de l’historique n’est pas nécessaire pour cette correction.

La phrase est fausse parce que la connexion à `127.0.0.1` n’a pas besoin de résoudre un nom. Un mauvais port, l’absence de processus ou une règle réseau peuvent aussi expliquer l’échec. Le diagnostic exige une comparaison, pas un mot-clé.

Le nettoyage consiste à laisser le serveur arrêté et la branche lisible. Vous pouvez poursuivre sur cette branche ; le parcours n’exige pas de fusionner vos notes dans le dépôt public. [Retour au guide](README.md).
