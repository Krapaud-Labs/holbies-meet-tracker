# Architecture

L'extension est une popup Chrome Manifest V3 sans build. `popup.html` structure l'interface, `popup.css` porte le thème, `popup.js` orchestre OAuth et les appels Google, et `attendance.js` contient le calcul pur des statuts.

Le backend Live VPS dans `backend/` devient le point d'entrée du suivi temps réel. Il refuse les adresses hors domaine `holbertonschool.com`, vérifie le propriétaire des lectures, conserve l'état actif en mémoire et persiste les sessions et invités quand PostgreSQL est configuré. La popup actualise l'état par polling court et le rapport HTML est protégé par le même compte Google. Les tokens OAuth ne sont jamais stockés. En production, les notifications Google Workspace Events doivent utiliser `GOOGLE_EVENTS_SECRET`, un reverse-proxy TLS et un endpoint Pub/Sub authentifié.
