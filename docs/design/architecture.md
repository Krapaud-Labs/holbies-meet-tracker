# Architecture

> **Statut : architecture as-built et cible MVP séparées.** CR-001 accepte l'export automatique pour une réunion rejointe par l'utilisateur. Le backend/persistance (CR-002) et le suivi sans mentor (CR-003) sont Post-MVP.

## Cible MVP

L'extension Chrome Manifest V3 lit Agenda et Meet, calcule les statuts localement et écrit automatiquement le rapport dans Sheets à la fin d'une réunion à laquelle l'utilisateur connecté a participé, s'il a autorisé et activé l'export à l'avance. Après les réessais, l'échec propose un export JSON/CSV local. Aucun backend ni stockage serveur n'est requis par cette cible. Le détail du signal de fin et le comportement quand le compte rendu Meet tarde restent à valider par un test réel.

## Architecture actuellement présente dans le dépôt

L'extension est une popup Chrome Manifest V3 sans build. `popup.html` structure l'interface, `popup.css` porte le thème, `popup.js` orchestre OAuth et les appels Google, et `attendance.js` contient le calcul pur des statuts.

Le backend Live VPS dans `backend/` est l'implémentation Post-MVP du suivi temps réel. Il refuse les adresses hors domaine `holbertonschool.com`, vérifie le propriétaire des lectures, conserve l'état actif en mémoire et persiste les sessions et invités quand PostgreSQL est configuré. La popup actualise l'état par polling court et le rapport HTML est protégé par le même compte Google. Les tokens OAuth ne sont jamais stockés. Le polling est disponible comme méthode d'actualisation et de repli dans le code; aucune affirmation de coût ni preuve d'usage réseau réel n'est faite ici. En production, les notifications Google Workspace Events nécessitent un topic Pub/Sub, une souscription active, une livraison HTTPS authentifiée et `GOOGLE_EVENTS_SECRET` pour le relais configuré; voir le runbook d'exploitation.

Le flux live dispose également d'un WebSocket as-built sur `/api/v1/live/sessions/{id}/stream`. La popup échange d'abord le jeton Google contre un ticket à usage unique, puis négocie le sous-protocole `holbies-live-v1` avec ce ticket. Le code et le contrat testé sont documentés dans [`live.js`](../../backend/src/live.js) et [`websocket-contract.test.js`](../../backend/test/websocket-contract.test.js); ces tests ne prouvent pas le comportement réseau en production. La popup revient au polling si le WebSocket est indisponible.
