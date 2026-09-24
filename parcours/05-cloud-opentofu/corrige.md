# Corrigé du jalon 05

Ce corrigé décrit les résultats attendus et leur interprétation. Il ne constitue pas un compte rendu d’exécution AWS. Le [registre de validation](../../docs/validation.md) conserve les observations effectivement obtenues.

## 1. Résoudre le challenge local

Le paramètre `owner` est une entrée de configuration. Pour changer le responsable déclaré, créez `infra/repetition/terraform.tfvars` avec ce contenu, ou modifiez uniquement cette valeur si ce fichier existe déjà :

```hcl
owner = "equipe-plateforme"
```

Ne modifiez pas `run/environnement.json` : ce fichier est la ressource dont OpenTofu doit gérer le contenu. Depuis la racine du dépôt, avec la même version d’OpenTofu que dans le guide :

```sh
umask 077
mkdir -p preuves/cloud
tofu -chdir=infra/repetition init -lockfile=readonly
tofu -chdir=infra/repetition plan -out="$PWD/preuves/cloud/challenge-local.tfplan"
tofu -chdir=infra/repetition show "$PWD/preuves/cloud/challenge-local.tfplan"
```

Si vous avez déjà retiré la répétition, le plan crée le fichier. Sinon, il propose son adaptation, éventuellement sous forme de remplacement : changer le contenu peut remplacer une ressource `local_file`. Ce comportement est acceptable pour **ce fichier jetable**, pas une raison d’accepter automatiquement le remplacement d’un réseau ou d’une base.

Après relecture, appliquez le plan. Cette commande ne redemande pas de confirmation :

```sh
tofu -chdir=infra/repetition apply "$PWD/preuves/cloud/challenge-local.tfplan"
cat infra/repetition/run/environnement.json
tofu -chdir=infra/repetition plan -detailed-exitcode
printf 'Code du dernier plan : %s\n' "$?"
```

Le fichier doit contenir `"owner":"equipe-plateforme"` et `"scope":"repetition-locale-sans-aws"`. Le dernier plan ne propose aucun changement et retourne `0`. Avec `-detailed-exitcode`, `2` signale un plan réussi contenant des changements ; `1` signale une erreur. Lisez le résultat juste après la commande : une autre commande remplacerait ce code.

La preuve attendue relie trois objets : `terraform.tfvars` porte votre intention, l’état local mémorise la ressource suivie et `run/environnement.json` est le résultat observable. Ne publiez pas l’état brut ; une synthèse des trois rôles suffit pour votre compte rendu.

Retirez le fichier géré avec :

```sh
tofu -chdir=infra/repetition destroy
```

Confirmez `yes` seulement après avoir vérifié que le plan vise ce fichier. Le dossier vide peut subsister ; il ne représente pas une ressource AWS. Si vous aviez créé `terraform.tfvars` uniquement pour le challenge, retirez ce fichier d’exercice manuellement après avoir gardé votre preuve. Cela remet les prochaines répétitions sur les valeurs par défaut ; ne supprimez pas un fichier de paramètres antérieur qui vous appartenait déjà.

## 2. Comprendre la dérive AWS

Le tag du VPC est non sensible et n’affecte pas le routage dans ce laboratoire. Le nom voulu vient de la configuration ; la sortie `expected_vpc_name` permet de le lire sans le reconstruire de mémoire :

```sh
tofu -chdir=infra/foundations output -raw expected_vpc_name
```

Avec les valeurs du guide, il vaut `taskboard-lab-vpc`. Après la modification manuelle, le plan de réparation doit montrer le passage du nom d’incident vers ce nom déclaré. Aucune création, suppression ou opération de remplacement n’est attendue. `tags_all` peut apparaître en plus de `tags` : il représente également les étiquettes héritées du fournisseur.

La réussite demande trois constats concordants : l’identifiant `vpc_id` est resté identique ; la lecture AWS retourne le nom déclaré ; le plan suivant ne propose plus de changement. Une sortie verte de la commande `create-tags` ne prouve aucune de ces trois propriétés à elle seule. Le code reste la référence de l’intention et l’API établit la valeur réellement présente.

Un `apply -refresh-only` ne serait pas la réparation demandée : cette opération actualiserait les informations d’état sans remettre le tag à la valeur du code. Ne corrigez pas la dérive en changeant silencieusement le code pour accepter la panne ; cela changerait l’objectif de l’exercice.

## 3. Réponses aux questions d’entretien

**Pourquoi un état si le code existe ?** Le code décrit le résultat voulu ; l’état relie les adresses de ressources à leurs identifiants concrets. Il faut cette correspondance pour savoir quel objet relire, modifier ou retirer. Une sauvegarde de l’état ne sauvegarde pas les données métier de PostgreSQL.

**Pourquoi un plan valide peut-il être impossible à appliquer ?** La cohérence de la configuration ne garantit ni les droits d’écriture, ni la disponibilité des zones, ni les quotas, ni l’absence de modification concurrente. Un fournisseur simulé ne teste pas ces propriétés d’un compte AWS réel. Une session peut aussi expirer entre les deux opérations.

**Versionnement ou verrouillage ?** Le versionnement conserve des révisions récupérables. Le verrouillage coordonne l’accès au même état pendant une opération. Le premier n’empêche pas une écriture concurrente ; le second ne choisit pas une bonne version à restaurer.

**Comment une machine privée téléchargerait-elle une image ?** Il lui faut une route et les accès nécessaires vers un service qui l’héberge. Ce module ne fournit ni NAT ni point de terminaison adapté. Inventer un accès implicite cacherait une dépendance fonctionnelle et éventuellement financière.

**Pourquoi retirer les fondations d’abord ?** Leur état distant reste nécessaire pour identifier les ressources à détruire et enregistrer le résultat. Supprimer le backend en premier rend cette opération plus difficile et peut supprimer un historique utile. Le compartiment est conservé volontairement après l’atelier.

## 4. Prouver le retrait sans annoncer trop

Après le retrait des fondations, rapprochez la liste d’état et l’inventaire AWS. Notez la disparition du VPC et de ses objets, mais aussi la présence volontaire du compartiment S3, des versions d’état et de l’état local d’amorçage. Conservez ces derniers sous accès privé. La protection `prevent_destroy` constitue un garde-fou OpenTofu ; elle ne remplace pas une politique IAM ni une sauvegarde.

La clôture peut donc être : « fondations retirées ; stockage d’état conservé », avec la date de vérification et les coûts encore à lire. Si vous avez seulement exécuté la répétition, écrivez : « cycle local création/dérive/réparation/retrait vérifié ; AWS non exécuté ». Ne présentez pas le second résultat comme le premier.

Enfin, relisez **la même tâche témoin** dans TaskBoard en comparant `id`, `title` et `created_at`. Les opérations AWS de cet atelier ne demandent aucune suppression du volume PostgreSQL local. Un témoin perdu nécessite un diagnostic du laboratoire local, pas sa recréation sous un nouveau numéro.

[Retour au guide](README.md) · [Coûts et retrait](../../docs/cloud-couts.md) · [Identité et état](../../docs/cloud-identites-et-etat.md)
