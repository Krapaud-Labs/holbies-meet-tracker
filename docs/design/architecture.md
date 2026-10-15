# Architecture

L'extension est une popup Chrome Manifest V3 sans build. `popup.html` structure l'interface, `popup.css` porte le thème, `popup.js` orchestre OAuth et les appels Google, et `attendance.js` contient le calcul pur des statuts.

Le backend Live VPS dans `backend/` devient le point d'entrée du suivi temps réel. Il refuse les adresses hors domaine `holbertonschool.com`, vérifie le propriétaire des lectures, conserve l'état actif en mémoire et persiste les sessions et invités quand PostgreSQL est configuré. La popup actualise l'état par polling court et le rapport HTML est protégé par le même compte Google. Les tokens OAuth ne sont jamais stockés. Le polling reste le fallback gratuit vérifié. En production, les notifications Google Workspace Events nécessitent un topic Pub/Sub, une souscription active, une livraison HTTPS authentifiée et `GOOGLE_EVENTS_SECRET` pour le relais configuré; voir le runbook d'exploitation.

Le flux live dispose également de WebSocket sécurisé sur `/api/v1/live/sessions/{id}/stream`, avec le sous-protocole `holbies-live-v1`. Le backend authentifie le jeton Google transmis dans le sous-protocole, envoie un snapshot initial et diffuse les changements de session. La popup revient au polling et retente la connexion avec un délai progressif si le WebSocket est indisponible.
