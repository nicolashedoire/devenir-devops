# Corrigé du jalon 01

L’instance du jalon doit être arrêtée avant le challenge. Dans le premier terminal :

```sh
env -u DATABASE_URL HOST=127.0.0.1 PORT=3100 FAULT_MODE=off npm start
```

Dans le second :

```sh
curl -i -X POST http://127.0.0.1:3100/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Préparer la démonstration"}'
curl -i http://127.0.0.1:3100/api/tasks
curl --max-time 3 -i http://127.0.0.1:3000/api/tasks
```

La création répond 201 et la lecture sur 3100 répond 200 avec le titre accentué intact. Si aucun autre service n’écoute sur 3000, la dernière connexion échoue : cette commande ne s’adresse pas à l’instance lancée. Si elle reçoit une réponse, un autre processus occupe ce port ; il faut l’identifier plutôt que conclure que TaskBoard a changé de port.

La limite de trois secondes borne l’attente ; elle ne corrige pas l’adresse. `Ctrl+C` dans le premier terminal arrête l’instance. En mode mémoire, la tâche disparaît avec elle.

Votre réponse est complète si elle distingue port d’écoute, réponse métier et durée de vie des données. Un titre présent avant l’arrêt ne démontre aucune persistance. Revenez au [guide](README.md).
