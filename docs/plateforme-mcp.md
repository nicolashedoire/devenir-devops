# Contrats de la plateforme locale et du serveur MCP

Le [jalon 10](../parcours/10-plateforme-mcp-portfolio/README.md) présente les manipulations. Cette fiche précise ce que l’implémentation garantit et ce qu’elle ne fait pas.

## Offre locale

`platform/catalogue.json` est le catalogue versionné. `scripts/platform/generate.mjs` valide le nom, le propriétaire, le port 3400–3499 et l’image exactement autorisée. Il exige le témoin existant et produit un dossier neuf, sans écraser un précédent résultat. Il n’appelle pas Docker. Le fichier généré remplace seulement la configuration applicative du même Compose ; le volume PostgreSQL reste décrit par le fichier initial. `starts_services: false` décrit l’action du générateur, pas un état mesuré de Docker.

La commande de livraison proposée utilise `TASKBOARD_PORT`, les deux fichiers Compose et `--no-build`. L’utilisateur relit puis exécute cette commande ; aucun mécanisme d’approbation distant ni portail n’est installé. Les rôles d’organisation, l’authentification applicative et les quotas multiéquipes restent hors de cette offre locale.

## Protocole et capacité

Le serveur `scripts/mcp/server.mjs` implémente le sous-ensemble MCP nécessaire au laboratoire, sur **stdio**, en JSON-RPC 2.0, avec la version **2025-11-25**. Il répond à `initialize`, attend `notifications/initialized`, puis accepte `ping`, `tools/list` et `tools/call`. Une version non prise en charge reçoit la version que le serveur sait parler ; le client doit la vérifier et interrompre si elle est incompatible. Notre client le fait.

Les capacités annoncées se limitent à `tools`, sans notification de changement de catalogue. Il n’existe ni ressource distante, ni fonction de génération par modèle, ni tâche asynchrone. Le serveur n’écoute aucun port. Les messages de protocole occupent seuls sa sortie standard. Le client ferme l’entrée pour terminer la session et borne l’attente ; ce n’est pas un serveur HTTP à exposer.

| Outil | Paramètres | Lecture autorisée | Réponse |
| --- | --- | --- | --- |
| `catalogue_offres` | Aucun | Catalogue versionné | Offre locale contrôlée |
| `lire_preuve` | `id: temoin` | `preuves/tache-temoin.json` | Identifiant, date, empreinte du titre |
| `lire_preuve` | `id: plateforme` | Contrat fixe `work/platform/equipe-demo/contrat.json` | Champs autorisés du contrat |

Les chemins ne proviennent jamais d’un argument d’outil. Les lectures de preuve refusent les liens symboliques, les fichiers non réguliers et plus de 16 Kio. Le transport limite une ligne à 8 Kio et une session à 256 messages. Le client limite chaque réponse attendue à trois secondes. Aucune chaîne reçue n’est évaluée comme code ou commande.

Les annotations de lecture seule sont des indications pour le client ; les contrôles du programme réalisent la limitation effective. Une preuve est un instantané local, pas une mesure de disponibilité actuelle. Les titres et champs inconnus sont exclus de la réponse ; une empreinte n’est pas un chiffrement et peut révéler l’égalité de deux textes connus. N’utilisez que des données fictives pour ce laboratoire public.

## Vérification

```sh
node --test scripts/platform/platform.test.mjs scripts/mcp/mcp.test.mjs
node scripts/mcp/demo.mjs temoin
node scripts/mcp/demo.mjs plateforme
```

Les tests couvrent génération et refus, négociation, initialisation obligatoire, liste et appel réels par stdio, JSON invalide, bornes, traversée de chemin, lien symbolique, expurgation d’une instruction piégée et arrêt propre. Le client réel est volontairement indépendant d’un service d’IA payant. La compatibilité avec d’autres clients MCP doit être essayée et documentée ; ce petit serveur n’est pas présenté comme une implémentation de toutes les fonctions optionnelles du protocole.

Références primaires : [cycle de vie MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle), [transport stdio](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [outils MCP](https://modelcontextprotocol.io/specification/2025-11-25/server/tools). Version documentaire consultée le 24 septembre 2026.
