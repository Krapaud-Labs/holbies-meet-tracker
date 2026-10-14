# Holbies Meet Tracker

Extension Chrome Manifest V3 pour préparer le suivi de présence des réunions Google Meet.

## Interface

La liste Agenda récupère tous les agendas accessibles du compte, uniquement pour la semaine civile en cours, conserve les événements à venir et ceux terminés depuis moins d'une heure. Les événements plus anciens sont retirés automatiquement au rechargement. La première connexion demande aussi le scope Google en lecture seule nécessaire pour lister ces agendas ; après une mise à jour des scopes, il faut se déconnecter puis se reconnecter.

Le bloc Agenda propose un bouton engrenage pour ouvrir ou fermer la section « Agendas suivis », où les agendas à afficher peuvent être cochés ou décochés. La sélection est conservée localement. Le bouton de rafraîchissement recharge les agendas et leurs événements sans devoir se déconnecter.

La lecture Agenda suit aussi la pagination Google (`nextPageToken`) afin d'afficher tous les événements de la période demandée, et pas seulement la première page.

La popup adopte une direction sombre, rouge cerise, rose et blanc rosé inspirée de l'énergie visuelle du [site Holberton School France](https://www.holbertonschool.fr/). Elle utilise un asset hippocampe local, avec une alternative textuelle, des cartes lisibles, des titres courts, des appels à l'action explicites et des messages textuels pour chaque état. Le parcours OAuth est borné à 15 secondes afin d'éviter une popup bloquée si Chrome ou Google ne répond pas.

La version actuelle charge les événements Google Agenda, analyse les comptes rendus Meet liés, calcule des statuts de présence, affiche un résumé des personnes à l'heure, en retard ou absentes, et conserve l'export Google Sheets comme option. Les identités Meet utilisent les champs officiels `signedinUser`, `anonymousUser` et `phoneUser` de l'API Google Meet. Depuis un onglet Google Meet ouvert, le bouton « Analyser le Meet ouvert » permet aussi de lancer l'analyse sans retrouver l'événement dans la liste Agenda. Quand Google expose déjà le compte rendu, la popup envoie un snapshot Meet au backend toutes les cinq secondes pour recalculer le suivi live gratuitement. Les sessions d'une même personne sont fusionnées : la première arrivée sert au calcul du retard et la reconnexion ne crée ni doublon ni faux absent. Le rapprochement Agenda utilise l'e-mail quand Google le fournit et le nom normalisé en secours, afin d'éviter les faux absents des participants identifiables. Tant que Meet n'a pas envoyé l'événement de fin de conférence, un invité non encore observé reste « en attente » et n'est jamais compté absent. Le Meet ouvert réutilise aussi l'événement Agenda le plus proche si son lien ou son titre n'est pas reconnu directement. Les adresses e-mail longues du compte connecté se renvoient maintenant à la ligne sans troncature. Le preflight CORS autorise les méthodes `POST` et `PUT` utilisées par la création et la mise à jour des sessions live. Le rapport HTML reprend le thème cerise de l'extension et bascule automatiquement entre thème clair et sombre selon `prefers-color-scheme`. La popup adopte une largeur desktop de 720 px pour garder Connexion, Agenda et Présences visibles côte à côte. Les tests réels nécessitent un compte Google de test autorisé et les règles de confidentialité de l'établissement.

Le bouton de connexion lance désormais le consentement Google via `chrome.identity` après une action explicite. Après connexion, et lors des réouvertures si Chrome possède encore un token valide, l'adresse du compte connecté est affichée dans la popup et le bouton de connexion laisse place à l'action de déconnexion. Les scopes retournés sont vérifiés et aucun token n'est persisté par l'extension. Voir [le parcours OAuth](docs/design/oauth-flow.md) pour les limites actuelles.

## Backend Live VPS

Le service worker MV3 lance aussi un cycle périodique gratuit sur les réunions Agenda proches. Il crée la session et envoie les snapshots Meet même si la popup est fermée ou si le mentor ne rejoint pas la réunion. Le navigateur doit rester ouvert et le consentement Google doit avoir été accordé au moins une fois.
Après la fin prévue dans Agenda, il attend dix minutes avant de clôturer la session et de calculer les absents. Cette marge protège les réunions qui débordent ; elle ne déclare jamais absent un invité pendant la réunion active.
La popup affiche aussi le dernier état du worker (dernier cycle, réunions suivies et erreurs éventuelles) pour rendre le suivi autonome vérifiable.
La procédure de test non intrusive est décrite dans [`docs/operations/manual-autonomous-test.md`](docs/operations/manual-autonomous-test.md).

Le backend Live est préparé dans `backend/` pour un déploiement sur le VPS. Il limite les mentors au domaine `@holbertonschool.com`, vérifie le propriétaire des sessions et rapports, expose un contrat de session Live et inclut une configuration Docker avec PostgreSQL. Il autorise le preflight CORS limité aux origines `chrome-extension://` pour que la popup puisse appeler le backend avec son jeton OAuth. La popup peut actualiser une session toutes les cinq secondes, ouvrir son rapport HTML et afficher la cause HTTP d’un échec backend. La connexion OAuth initiale reste limitée à Meet, Agenda et l’identité; Sheets/Drive ne sont demandés qu’au clic d’export. Le polling est la voie gratuite vérifiée; l’URL HTTPS active du tunnel gratuit est configurée dans `popup.js` et doit être renouvelée si le Quick Tunnel est relancé. L’activation Google Workspace Events/Pub/Sub est documentée dans [`docs/operations/google-events-pubsub.md`](docs/operations/google-events-pubsub.md) et nécessite une validation séparée du projet Cloud et du budget.

Le runbook de déploiement gratuit et le compose de production sont documentés dans [`backend/README.md`](backend/README.md), avec un fichier `.env.production.example` qui ne contient aucun secret réel.

Voir [la documentation backend](backend/README.md) pour lancer les tests et le service localement.

## Développement local

1. Ouvrir `chrome://extensions` dans Chrome.
2. Activer le mode développeur.
3. Choisir **Charger l'extension non empaquetée** et sélectionner ce dossier.
4. Ouvrir la popup depuis l'icône de l'extension.

Le projet n'utilise pas encore de gestionnaire de paquets ni de build : les fichiers HTML et CSS sont chargés directement par Chrome.
