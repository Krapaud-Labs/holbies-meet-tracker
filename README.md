# Holbies Meet Tracker

Extension Chrome Manifest V3 pour préparer le suivi de présence des réunions Google Meet.

## Interface

La popup adopte une direction sombre, rouge cerise, rose et blanc rosé inspirée de l'énergie visuelle du [site Holberton School France](https://www.holbertonschool.fr/). Elle utilise un asset hippocampe local, avec une alternative textuelle, des cartes lisibles, des titres courts, des appels à l'action explicites et des messages textuels pour chaque état.

La version actuelle charge les événements Google Agenda, analyse les comptes rendus Meet liés, calcule des statuts de présence et crée une nouvelle feuille Google Sheets avec le relevé courant. Les tests réels nécessitent un compte Google de test autorisé et les règles de confidentialité de l'établissement.

Le bouton de connexion lance désormais le consentement Google via `chrome.identity` après une action explicite. Les scopes retournés sont vérifiés et aucun token n'est persisté par l'extension. Voir [le parcours OAuth](docs/design/oauth-flow.md) pour les limites actuelles.

## Développement local

1. Ouvrir `chrome://extensions` dans Chrome.
2. Activer le mode développeur.
3. Choisir **Charger l'extension non empaquetée** et sélectionner ce dossier.
4. Ouvrir la popup depuis l'icône de l'extension.

Le projet n'utilise pas encore de gestionnaire de paquets ni de build : les fichiers HTML et CSS sont chargés directement par Chrome.
