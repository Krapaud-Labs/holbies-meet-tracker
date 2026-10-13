# Flux utilisateur

1. L'utilisateur ouvre la popup et choisit « Se connecter avec Google ».
2. L'extension obtient un token via `chrome.identity` et charge les événements du calendrier primaire.
3. L'utilisateur choisit un événement contenant un lien Meet.
4. L'extension récupère le compte rendu, les participants et leurs sessions, puis affiche les statuts.
5. L'utilisateur vérifie le résumé et coche le consentement d'export.
6. L'extension crée et remplit une feuille Sheets. En cas d'échec, un CSV local est proposé.
