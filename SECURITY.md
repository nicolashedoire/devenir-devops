# Sécurité du compagnon pédagogique

TaskBoard est un laboratoire local sans comptes utilisateurs ni autorisation par utilisateur. Les ports publiés par les ateliers sont limités à la boucle locale ; les services Kubernetes restent internes au cluster local. Les identifiants présents dans le Compose initial sont publics et réservés à cet exercice. Les jalons 08–09 ajoutent une passerelle HTTPS locale, un jeton d’accès commun à l’atelier, sa rotation et un rôle PostgreSQL limité. Ces contrôles ne constituent pas une gestion d’identités pour un service public : n’exposez pas ce laboratoire sur Internet.

Pour signaler un problème de sécurité, utiliser le signalement privé de vulnérabilité du dépôt lorsque cette fonction est activée. Les difficultés ordinaires d’atelier peuvent être signalées dans les issues. Retirer les secrets, sauvegardes et données personnelles des exemples.

Le [registre de validation](docs/validation.md) décrit les versions contrôlées, les vérifications réalisées et leurs limites. Les guides distinguent les résultats testés des adaptations qui restent nécessaires dans un environnement de production.
