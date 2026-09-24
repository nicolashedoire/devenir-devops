# Prévoir, observer et arrêter les coûts du laboratoire AWS

Cette fiche accompagne le [jalon 05](../parcours/05-cloud-opentofu/README.md). Elle décrit ce que sa configuration peut créer, puis une méthode pour suivre la dépense. **Aucun montant réellement facturé n’a été mesuré pour cet atelier : les contrôles locaux ne créent pas de ressources AWS.** Consultez le [registre de validation](validation.md) pour la portée exacte des essais.

## Ce qui entre dans le périmètre

Le laboratoire crée les fondations d’un réseau dans deux zones de disponibilité (*Availability Zones*, AZ) et un compartiment S3 (*bucket*) pour l’état d’OpenTofu. Il ne déploie ni TaskBoard ni PostgreSQL dans AWS. Leur volume et leurs sauvegardes restent sur votre machine.

| Élément prévu | Ce qu’il faut examiner avant de créer |
| --- | --- |
| VPC, sous-réseaux, tables de routage et passerelle Internet | Le réseau décrit est vide : aucune machine n’envoie de trafic. Vérifier que le plan reste limité aux fondations prévues. |
| État distant S3 | Stockage de l’état courant et de ses anciennes versions ; requêtes de lecture, d’écriture, de liste et de verrouillage. |
| Chiffrement S3 | Le module utilise le chiffrement côté S3, sans créer de clé KMS gérée par le lecteur. |
| Suivi budgétaire du compte | Examiner les options sélectionnées et la tarification propre à AWS Budgets ; le module ne crée pas automatiquement ce suivi. |

Le module ne crée **aucune passerelle NAT, adresse IPv4 publique allouée, instance EC2, base RDS, cluster EKS, équilibreur de charge ou point de terminaison VPC payant**. Ces services changeraient le périmètre financier. La présence d’un sous-réseau nommé « public » n’alloue pas, à elle seule, une adresse publique à une machine. Consultez la [tarification VPC](https://aws.amazon.com/vpc/pricing/) si vous envisagez une extension.

## Faire une estimation avant l’atelier

Choisissez la région de l’exercice, puis ouvrez la [tarification S3](https://aws.amazon.com/s3/pricing/). Notez la date, la région, la classe de stockage, la devise et les catégories de requêtes utilisées. L’état est normalement petit, mais sa taille réelle et le nombre de versions dépendent de votre travail. Chaque modification peut ajouter une version ; un historique conservé continue d’occuper du stockage. Lisez aussi les conditions de transfert applicables à votre situation.

Rédigez dans `preuves/cloud/estimation.md` une courte hypothèse : durée de conservation, taille approximative des états, nombre de séances, nombre de plans et d’applications. Indiquez les hypothèses inconnues. Ce document est une estimation personnelle, pas un tarif garanti. Ne fondez pas la décision de lancer l’atelier sur une offre gratuite supposée : l’éligibilité dépend de votre compte et des conditions applicables.

Un plan OpenTofu décrit les ressources et changements techniques ; il ne constitue pas une estimation de facture. Une ressource payante ajoutée par erreur doit faire interrompre la lecture du plan, même si la syntaxe est valide.

## Installer un signal budgétaire utile

Dans **Billing and Cost Management → Budgets** — facturation et gestion des coûts —, créez un budget adapté au compte de laboratoire et à votre seuil personnel. Choisissez des destinataires que vous contrôlez, vérifiez la réception et conservez les seuils dans votre compte rendu. Une alerte sur le coût réel et une autre sur la prévision peuvent couvrir deux situations différentes. N’inscrivez pas votre adresse électronique dans un fichier destiné au dépôt public.

**Un budget n’est pas un plafond dur.** Les données de facturation et les notifications ont un délai ; une dépense peut dépasser le seuil avant l’alerte. Les actions de budget, lorsqu’elles sont configurées, ne constituent pas un arrêt universel de toutes les ressources. AWS précise ces limites dans ses [bonnes pratiques Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html). L’arrêt effectif repose ici sur le démontage des ressources identifiées et le contrôle de ce qui reste.

## Observer pendant et après

Au début, relevez compte, région, heure et ressources déjà présentes. Après création, comparez l’inventaire aux sorties OpenTofu. Suivez ensuite la facturation dans le compte en distinguant S3, éventuels autres services et ressources préexistantes. Les étiquettes (*tags*) du laboratoire facilitent l’inventaire ; leur présence ne garantit pas que la ventilation des coûts soit déjà activée ou disponible.

Après retrait du réseau, notez ce que vous avez volontairement conservé : le compartiment d’état, ses versions et les preuves locales. Revenez lire les coûts après actualisation des données de facturation. Une facture encore vide immédiatement après l’atelier ne prouve pas une dépense nulle.

## Nettoyer sans perdre la capacité de diagnostic

Suivez l’ordre du guide : **fondations réseau d’abord, stockage de l’état ensuite**. Conservez l’état d’amorçage et les preuves tant que des ressources existent. Supprimer un dossier local ne supprime aucune ressource AWS.

Le compartiment versionné est conservé par défaut ; il n’est pas vidé automatiquement. Dans S3, supprimer un objet courant peut seulement ajouter un marqueur de suppression (*delete marker*) et laisser les versions antérieures. AWS décrit la [suppression des versions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeletingObjectVersions.html). Une fermeture complète du compartiment exige de traiter explicitement ses versions et marqueurs, puis de vérifier qu’il est vide ; voir la [suppression d’un compartiment](https://docs.aws.amazon.com/AmazonS3/latest/userguide/delete-bucket.html).

Avant cette fermeture, vérifiez qu’aucun autre environnement n’utilise le compartiment, que les fondations ont bien disparu et qu’une copie protégée de l’historique utile existe. L’absence de suppression forcée est volontaire : un compartiment non vide doit bloquer le retrait, pas entraîner silencieusement la perte des états. Documentez le choix « état conservé » ou « compte de laboratoire nettoyé » au lieu d’annoncer indistinctement « tout supprimé ».

## Trace de décision à conserver

Votre preuve de fin contient la région et la date de l’estimation, les catégories facturables retenues, le suivi budgétaire configuré, l’inventaire final et le coût observé à une date donnée — ou « pas encore disponible ». Expurgez les identifiants de compte et informations personnelles avant tout partage public. Une preuve honnête peut laisser une mesure en attente ; elle ne remplace jamais cette mesure par un zéro inventé.
