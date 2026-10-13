# Holbies Meet Tracker

Extension Chrome Manifest V3 pour préparer le suivi de présence des réunions Google Meet.

## Interface

La popup adopte une direction sombre, rouge cerise, rose et blanc rosé inspirée de l'énergie visuelle du [site Holberton School France](https://www.holbertonschool.fr/). Elle utilise un asset hippocampe local, avec une alternative textuelle, des cartes lisibles, des titres courts, des appels à l'action explicites et des messages textuels pour chaque état.

La version actuelle charge les événements Google Agenda, analyse les comptes rendus Meet liés, calcule des statuts de présence, affiche un résumé des personnes à l'heure, en retard ou absentes, et crée une nouvelle feuille Google Sheets avec le relevé courant. La popup adopte une largeur desktop de 720 px pour garder Connexion, Agenda et Présences visibles côte à côte. Les tests réels nécessitent un compte Google de test autorisé et les règles de confidentialité de l'établissement.

Le bouton de connexion lance désormais le consentement Google via `chrome.identity` après une action explicite. Après connexion, et lors des réouvertures si Chrome possède encore un token valide, l'adresse du compte connecté est affichée dans la popup et le bouton de connexion laisse place à l'action de déconnexion. Les scopes retournés sont vérifiés et aucun token n'est persisté par l'extension. Voir [le parcours OAuth](docs/design/oauth-flow.md) pour les limites actuelles.

## Développement local

1. Ouvrir `chrome://extensions` dans Chrome.
2. Activer le mode développeur.
3. Choisir **Charger l'extension non empaquetée** et sélectionner ce dossier.
4. Ouvrir la popup depuis l'icône de l'extension.

Le projet n'utilise pas encore de gestionnaire de paquets ni de build : les fichiers HTML et CSS sont chargés directement par Chrome.
