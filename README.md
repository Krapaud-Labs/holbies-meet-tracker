# Holbies Meet Tracker

Extension Chrome Manifest V3 pour préparer le suivi de présence des réunions Google Meet.

## Interface

La popup adopte une direction sombre et orange inspirée de l'énergie visuelle du [site Holberton School France](https://www.holbertonschool.fr/), sans reprendre ses assets. Elle privilégie les cartes lisibles, les titres courts, les appels à l'action explicites et des messages textuels pour chaque état.

La version actuelle est un prototype d'interface : l'état « connexion requise » est rendu et vérifié dans Chrome. Les états réunion détectée, collecte, vérification et export restent à relier au futur comportement métier. La collecte Meet et l'écriture dans Sheets ne sont pas encore réalisées.

Le bouton de connexion lance désormais le consentement Google via `chrome.identity` après une action explicite. Les scopes retournés sont vérifiés et aucun token n'est persisté par l'extension. Voir [le parcours OAuth](docs/design/oauth-flow.md) pour les limites actuelles.

## Développement local

1. Ouvrir `chrome://extensions` dans Chrome.
2. Activer le mode développeur.
3. Choisir **Charger l'extension non empaquetée** et sélectionner ce dossier.
4. Ouvrir la popup depuis l'icône de l'extension.

Le projet n'utilise pas encore de gestionnaire de paquets ni de build : les fichiers HTML et CSS sont chargés directement par Chrome.
