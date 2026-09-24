# Anciennes configurations hors parcours actuel

Les dossiers `k8s/` et `helm/` proviennent du premier compagnon. Ils sont conservés
comme archives, **non validées et hors du parcours actuel**. Ils ne constituent pas
une étape de déploiement et ne doivent pas servir de référence de production.

Le chart initial utilisait notamment le stockage en mémoire de l’application.
Le parcours actif valide d’abord le poste local, Git, Docker Compose avec
PostgreSQL persistant, puis la CI. Ses migrations sont exécutées séparément et
la sauvegarde est restaurée dans une autre base avec comparaison du contenu.

Une reprise Kubernetes devra préserver les mêmes données et démontrer ses
migrations, sa restauration et ses contrôles d’accès avant de réintégrer le
parcours. Ces fichiers ne sont ni construits dans l’image Docker, ni exécutés
par les scripts de vérification actuels.
