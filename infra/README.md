# Fondations du jalon 05

Ce dossier contient trois racines OpenTofu indépendantes. **Il ne déploie pas
TaskBoard sur AWS.** Le parcours opératoire, la gestion des identités et les
preuves réelles sont décrits dans le [jalon 05](../parcours/05-cloud-opentofu/README.md),
le [guide des identités et de l’état](../docs/cloud-identites-et-etat.md) et le
[registre de validation](../docs/validation.md).

| Racine | Effet possible d’un `apply` réel | État |
|---|---|---|
| `repetition/` | Un fichier `run/environnement.json` dans cette racine | Local, ignoré par Git |
| `bootstrap-state/` | Un bucket S3 et cinq configurations associées | Local, à protéger et sauvegarder séparément |
| `foundations/` | Un VPC et ses fondations réseau, sans application ni instance de base | S3, bucket créé par l’amorçage |

## Versions de référence

- OpenTofu **1.12.6**, exigé exactement dans chaque racine.
- Provider `hashicorp/aws` **6.66.0** dans les deux racines AWS.
- Provider `hashicorp/local` **2.9.1** dans la répétition locale.

Les fichiers `.terraform.lock.hcl` sont destinés à être versionnés. Ils verrouillent
les packages de providers ; ce ne sont ni les verrous de concurrence de l’état,
ni des états. Les répertoires `.terraform/`, états, plans, variables locales,
configuration backend locale et fichiers `run/` sont exclus par [`.gitignore`](.gitignore).

## Répétition locale sans AWS

Depuis la racine du dépôt, `tofu -chdir=infra/repetition init`, puis `plan`, `apply`
et `destroy` concernent uniquement `infra/repetition/run/environnement.json`.
Les variables sont `environment` (défaut `lab`) et `owner` (défaut `apprenant`).
La sortie `environment_file` désigne le fichier. La suppression laisse éventuellement
le répertoire `run/` vide. Une modification externe du fichier permet d’observer une
dérive puis sa réparation ; le provider peut présenter cette réparation comme une
recréation du fichier. **Ce n’est pas une émulation d’AWS.**

## Contrat AWS

Les exemples `terraform.tfvars.example` contiennent un compte fictif. Un compte
attendu doit être choisi indépendamment de l’identité active : ne jamais le
déduire automatiquement de la session pour faire passer le contrôle. Les deux
providers utilisent `allowed_account_ids` et vérifient aussi le résultat STS par
une postcondition. Ne pas ajouter d’option contournant ces contrôles.

`AWS_PROFILE` et une session temporaire fournissent l’identité hors du code.
`aws_region` vaut `eu-west-3` par défaut ; `owner` est obligatoire. Le projet
`taskboard`, l’environnement `lab` et le workspace `default` sont imposés pour
conserver une identité d’état unique dans ce parcours. Un second environnement
réel demande une conception séparée, pas un changement improvisé de workspace.

Le bootstrap demande aussi `state_bucket_name`, globalement unique. Il active
le blocage des accès publics, la propriété des objets par le propriétaire du
bucket, le versionnement, SSE-S3 `AES256` et le refus du transport non TLS.
`prevent_destroy` et `force_destroy=false` empêchent une purge accidentelle par
la configuration ; ces paramètres ne remplacent pas les permissions IAM.
L’état local du bootstrap n’est pas chiffré par ces réglages S3 : protéger son
support et sa sauvegarde séparément.

La sortie `backend_hcl` produit la configuration des fondations avec la clé
`taskboard/lab/foundations.tfstate`, `allowed_account_ids`, `encrypt=true` et
`use_lockfile=true`. Aucun secret n’y figure. Le backend utilise sa propre chaîne
d’authentification : le réglage du provider ne le protège pas à sa place.
Le versionnement conserve aussi des versions des objets de verrou : prévoir
une rétention adaptée après observation, sans purger aveuglément les états.

## Réseau livré

Les fondations gèrent 20 entrées de ressources : VPC, passerelle Internet,
quatre sous-réseaux, trois tables de routage, quatre associations explicites,
table et groupe de sécurité par défaut du nouveau VPC, deux groupes de sécurité,
deux règles PostgreSQL et un groupe de sous-réseaux de base de données.
Les objets par défaut sont créés par AWS avec le VPC puis pris en gestion ;
aucun VPC préexistant n’est adopté.

Les variables `availability_zones` désignent deux zones standard distinctes,
vérifiées contre celles disponibles dans le compte. `vpc_cidr` est un /16 IPv4
privé canonique (défaut `10.42.0.0/16`). Le code calcule deux /24 publics
aux indices 0–1 et deux /24 privés aux indices 10–11. Vérifier tout risque de
chevauchement avec les réseaux existants avant une éventuelle création.

La table publique possède une route vers la passerelle Internet ; aucun
sous-réseau n’attribue automatiquement d’IPv4 publique. Les tables privées
et la table par défaut ne possèdent aucune route ajoutée. La route locale
du VPC subsiste. Le groupe de sécurité par défaut est fermé ; les règles
déclarées autorisent uniquement TCP 5432 du groupe applicatif vers le groupe
de base. Il n’existe aucune règle d’entrée publique.

Sans NAT, endpoint VPC ni autre sortie, les futurs services privés ne peuvent
pas télécharger librement leurs images ou dépendances depuis Internet. Ce
choix limite les coûts du laboratoire et **doit être revu avant de déployer
l’application**. Aucun NAT, EIP, EC2, EKS, ALB ou RDS n’est créé. Le groupe de
sous-réseaux RDS est une métadonnée de placement, pas une base opérationnelle.
Les frais S3 et les futures extensions restent à évaluer ; aucun engagement
de coût nul n’est donné.

Les sorties sont `vpc_id`, `public_subnet_ids`, `private_subnet_ids`,
`app_security_group_id`, `database_security_group_id`,
`database_subnet_group_name` et `expected_vpc_name`. La dérive pédagogique
porte seulement sur le tag `Name` du VPC (`taskboard-lab-vpc`).

## Contrôles locaux et limites

Les suites AWS utilisent exclusivement `mock_provider "aws"` : les créations
et lectures du provider sont simulées. Les validations négatives contrôlent
notamment compte incohérent, réseau public, zones incorrectes et environnement
non autorisé. Elles ne démontrent pas le fonctionnement réel de STS, des
permissions IAM, des routes, du verrou S3 ou de la facturation.

```sh
tofu -chdir=infra/repetition init -backend=false
tofu -chdir=infra/repetition validate
tofu -chdir=infra/repetition test
tofu -chdir=infra/bootstrap-state init -backend=false
tofu -chdir=infra/bootstrap-state validate
tofu -chdir=infra/bootstrap-state test
tofu -chdir=infra/foundations init -backend=false
tofu -chdir=infra/foundations validate
tofu -chdir=infra/foundations test
```

L’initialisation télécharge des providers depuis leur registre ; elle n’est donc
pas entièrement hors réseau. `-backend=false` évite d’initialiser le backend
S3 dans ce contrôle. Ne pas remplacer ces tests par un `apply` AWS ordinaire.
Un `tofu test` sans provider simulé peut créer puis détruire des ressources
réelles : lire les tests avant d’exécuter une suite modifiée.

La suppression normale vise uniquement les fondations. Le bootstrap et ses
versions d’état sont conservés ; leur retrait nécessite une procédure distincte
après archivage et vérification qu’aucun état actif n’en dépend. Aucun code de
ce dossier ne touche aux volumes Docker ou à la tâche témoin du parcours local.

## Références primaires

- [OpenTofu 1.12.6](https://github.com/opentofu/opentofu/releases/tag/v1.12.6)
- [Provider AWS 6.66.0](https://github.com/hashicorp/terraform-provider-aws/releases/tag/v6.66.0)
- [Provider local 2.9.1](https://github.com/hashicorp/terraform-provider-local/releases/tag/v2.9.1)
- [Tests et providers simulés](https://opentofu.org/docs/cli/commands/test/#the-mock_provider-blocks)
- [Backend S3 et verrou natif](https://opentofu.org/docs/language/settings/backends/s3/)
- [Versionnement S3 : propagation initiale](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketVersioning.html)
