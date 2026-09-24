# Corrigé — observer une requête

## Le témoin reste le même

L’import ne valide pas seulement le nombre de lignes. Il compare les trois propriétés de la tâche à la preuve du parcours et contrôle la migration appliquée. Un titre identique avec un nouvel identifiant serait une recréation, pas une preuve de continuité. La copie sert à lire ; la source conserve son autorité.

Après `down` sans `-v`, la reprise par `bash scripts/verify-observability.sh` réutilise le volume. Le script relit le témoin et produit une nouvelle preuve. Il ne faut pas relancer l’import sur la base déjà remplie : son refus est intentionnel.

## Deux diagnostics différents

Pour le scénario lent, le statut reste 200 et la tâche reste identique. Le graphe de latence augmente. Le journal fournit un `request_id` et un `trace_id`. La trace HTTP dure environ le délai simulé ; son enfant `SELECT tasks` est normalement beaucoup plus bref. La mesure soutient donc l’hypothèse d’un délai hors SQL. Le code de simulation permet ensuite de confirmer le délai placé avant l’appel à la base.

Pour le scénario erreur, le statut est 503 et la proportion de 5xx augmente. La trace porte une erreur HTTP et ne comporte pas de span SQL. La simulation renvoie sa réponse avant d’interroger PostgreSQL. Une base réellement inaccessible produirait normalement une tentative SQL et une erreur de dépendance ; le statut seul ne distingue pas ces causes.

Pour prouver le lien, le `trace_id` du journal doit correspondre à celui de la réponse. Son `span_id` doit être celui du span serveur HTTP. Le `parentSpanId` du span SQL doit être égal à cet identifiant HTTP. Une simple proximité dans le temps n’établit pas le parentage.

## Le p95 n’est pas le chronomètre d’une requête

Les buckets cumulatifs indiquent combien de requêtes ont duré au plus 10 ms, 50 ms, 100 ms, 300 ms, 1 s, 2,5 s ou 5 s. Les requêtes proches de 1,5 s se trouvent entre 1 et 2,5 s. L’estimation interpole dans cet intervalle ; elle peut donc approcher 2,425 s lorsque les observations de la fenêtre se concentrent dans ce bucket.

Ce résultat n’invalide ni l’histogramme ni la trace : ils répondent à des questions différentes. Pour améliorer la précision autour d’un seuil métier, choisir des bornes adaptées puis vérifier le coût du nombre de séries. Ne pas remplacer la mesure par une moyenne qui masque les requêtes lentes.

## Les alertes ont un périmètre explicite

`TaskboardErreursHTTP` passe à `firing` si le ratio dépasse 5 % assez longtemps dans le scénario erreur. `TaskboardLatenceHTTP` le fait lorsque le p95 dépasse une seconde dans le scénario lent. Le test vérifie leurs labels : une alerte portant sur un autre scénario ne suffirait pas.

Le laboratoire 07 n’envoie aucune notification externe. Il montre l’évaluation d’une règle par Prometheus. Un chemin d’astreinte comprend ensuite le routage, le regroupement, les silences, la réception, l’acquittement humain et un runbook. Les seuils accélérés de cet exercice ne valent pas politique de production.

## Réponses aux questions d’entretien

1. Un histogramme regroupe les observations dans des bornes et le p95 interpole ; une trace mesure une requête donnée.
2. Un identifiant presque unique créerait un nombre de séries proportionnel aux requêtes. Les identifiants restent dans les journaux et les traces.
3. Comparer le trace ID et le parent span ID ; vérifier aussi le service et la route pour éviter d’ouvrir une autre requête.
4. La collecte peut être indisponible alors que le service métier continue de répondre. Les indicateurs de santé de ces deux fonctions doivent être séparés.
5. Prévoir au minimum les identités, les autorisations, TLS, la politique de données, les limites de stockage et la capacité à restaurer les backends, puis tester leur fonctionnement.

## Une preuve suffisante pour le challenge

La réponse doit nommer une trace réellement retrouvée et des mesures réellement observées. Copier les durées d’un exemple n’est pas une vérification. Conserver les fichiers `trace-*.json`, `journal-*.json`, `metriques.json` et `alertes.json` de votre exécution, ainsi que `resultat.json`. Une preuve partielle ou un statut `echec` décrit un travail à terminer.
