# Corrigé du jalon 04

Une reconstruction crée un nouvel artefact. Même avec un code identique, des entrées non maîtrisées ou un environnement différent peuvent modifier le résultat. Le workflow du parcours conserve l’image éprouvée par Compose, la transmet puis publie ce même objet. Ce lien est plus précis que « les tests étaient verts avant une autre construction ».

Les éléments à rapprocher sont :

1. le **commit complet** et l’URL de l’exécution qui l’a testé ;
2. la **référence au digest** fournie par le registre et conservée dans `publication-<SHA>` ;
3. la **révision exposée** par `/version` de l’instance démarrée depuis cette référence.

Le label OCI de l’image doit également correspondre. Une révision déclarée n’est pas une attestation inviolable : l’intérêt vient de la chaîne observable, des contrôles et de la conservation de l’artefact testé. La signature et la vérification de provenance restent un approfondissement à réaliser.

Le test volontairement faux doit échouer avec un code non nul. Le simple ajout d’un fichier de test ne suffit pas si `npm test` ne le découvre pas : c’est pourquoi le guide demande de l’ajouter explicitement à la liste. La correction rétablit le test et le périmètre initial, après relecture du diff. La branche d’exercice n’a pas à être fusionnée.

PostgreSQL conserve un état indépendant de l’image. Une nouvelle version peut avoir écrit des données ou appliqué une migration ; une ancienne image doit rester compatible avec ce schéma, ou demander une procédure de reprise distincte. Retirer le volume ne constitue pas un retour arrière.

Votre dossier est complet s’il permet à un tiers de retrouver le commit, les essais, le digest publié et la tâche conservée après exécution de l’image. Le numéro de version `0.2.0` seul ne suffit pas à identifier tous ces éléments. [Retour au guide](README.md).
