# Flux utilisateur

## Cible MVP après décision CR-001

1. L'utilisateur se connecte explicitement avec Google et autorise Agenda/Meet en lecture.
2. Avant une réunion, il accorde explicitement les scopes Sheets/Drive nécessaires à l'écriture automatique. Le contrôle d'activation et le parcours OAuth précis restent à concevoir.
3. Il rejoint un événement Meet et sélectionne cet événement dans l'extension; le suivi ne s'active que pour une réunion à laquelle il participe.
4. L'extension lit les sessions de présence nécessaires et calcule les statuts, sans démarrer le suivi de réunions auxquelles l'utilisateur ne participe pas.
5. Quand le compte rendu de cette réunion est disponible et complet, l'extension crée la feuille automatiquement, après les réessais prévus.
6. En cas d'échec persistant, elle propose le téléchargement local JSON/CSV. Elle n'envoie pas de données à un serveur et ne partage pas la feuille automatiquement.

Le signal exact de fin et la disponibilité des comptes rendus Meet doivent être prouvés avec un compte de test. La demande de scopes ne se fait pas à la fin d'une réunion; l'interface et le moment du consentement préalable restent à concevoir.

## Flux actuellement implémenté

1. L'utilisateur ouvre la popup et choisit « Se connecter avec Google ».
2. L'extension obtient un token via `chrome.identity` et charge les événements du calendrier primaire.
3. L'utilisateur choisit un événement contenant un lien Meet.
4. L'extension récupère le compte rendu, les participants et leurs sessions, puis affiche les statuts.
5. L'utilisateur vérifie le résumé et coche le consentement d'export.
6. L'extension crée et remplit une feuille Sheets. En cas d'échec, un CSV local est proposé.

Ce flux as-built est volontaire; il ne correspond pas encore à la cible MVP automatique.
