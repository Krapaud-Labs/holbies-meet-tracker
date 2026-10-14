# Holbies Meet Tracker

Extension Chrome Manifest V3 pour préparer le suivi de présence des réunions Google Meet.

## Interface

La popup adopte une direction sombre, rouge cerise, rose et blanc rosé inspirée de l'énergie visuelle du [site Holberton School France](https://www.holbertonschool.fr/). Elle utilise un asset hippocampe local, avec une alternative textuelle, des cartes lisibles, des titres courts, des appels à l'action explicites et des messages textuels pour chaque état. Le parcours OAuth est borné à 15 secondes afin d'éviter une popup bloquée si Chrome ou Google ne répond pas.

La version actuelle charge les événements Google Agenda, analyse les comptes rendus Meet liés, calcule des statuts de présence, affiche un résumé des personnes à l'heure, en retard ou absentes, et conserve l'export Google Sheets comme option. Depuis un onglet Google Meet ouvert, le bouton « Analyser le Meet ouvert » permet aussi de lancer l'analyse sans retrouver l'événement dans la liste Agenda. Le backend VPS préparera une vraie page HTML sécurisée pour consulter les rapports de réunion. La popup adopte une largeur desktop de 720 px pour garder Connexion, Agenda et Présences visibles côte à côte. Les tests réels nécessitent un compte Google de test autorisé et les règles de confidentialité de l'établissement.

Le bouton de connexion lance désormais le consentement Google via `chrome.identity` après une action explicite. Après connexion, et lors des réouvertures si Chrome possède encore un token valide, l'adresse du compte connecté est affichée dans la popup et le bouton de connexion laisse place à l'action de déconnexion. Les scopes retournés sont vérifiés et aucun token n'est persisté par l'extension. Voir [le parcours OAuth](docs/design/oauth-flow.md) pour les limites actuelles.

## Backend Live VPS

Le backend Live est préparé dans `backend/` pour un déploiement sur le VPS. Il limite les mentors au domaine `@holbertonschool.com`, vérifie le propriétaire des sessions et rapports, expose un contrat de session Live et inclut une configuration Docker avec PostgreSQL. Il autorise le preflight CORS limité aux origines `chrome-extension://` pour que la popup puisse appeler le backend avec son jeton OAuth. La popup peut actualiser une session toutes les cinq secondes et ouvrir son rapport HTML. La connexion OAuth initiale reste limitée à Meet, Agenda et l’identité; Sheets/Drive ne sont demandés qu’au clic d’export. Le polling est la voie gratuite vérifiée; l’URL HTTPS active du tunnel gratuit est configurée dans `popup.js` et doit être renouvelée si le Quick Tunnel est relancé. L’activation Google Workspace Events/Pub/Sub est documentée dans [`docs/operations/google-events-pubsub.md`](docs/operations/google-events-pubsub.md) et nécessite une validation séparée du projet Cloud et du budget.

Le runbook de déploiement gratuit et le compose de production sont documentés dans [`backend/README.md`](backend/README.md), avec un fichier `.env.production.example` qui ne contient aucun secret réel.

Voir [la documentation backend](backend/README.md) pour lancer les tests et le service localement.

## Développement local

1. Ouvrir `chrome://extensions` dans Chrome.
2. Activer le mode développeur.
3. Choisir **Charger l'extension non empaquetée** et sélectionner ce dossier.
4. Ouvrir la popup depuis l'icône de l'extension.

Le projet n'utilise pas encore de gestionnaire de paquets ni de build : les fichiers HTML et CSS sont chargés directement par Chrome.
