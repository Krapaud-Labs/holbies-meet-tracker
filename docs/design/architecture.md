# Architecture

L'extension est une popup Chrome Manifest V3 sans build. `popup.html` structure l'interface, `popup.css` porte le thème, `popup.js` orchestre OAuth et les appels Google, et `attendance.js` contient le calcul pur des statuts.

Le backend Live VPS dans `backend/` devient le point d'entrée du suivi temps réel. Il refuse les adresses hors domaine `holbertonschool.com`, conserve l'état de session actif temporairement et sera relié aux événements Google Workspace. PostgreSQL est prévu pour l'historique durable, sans y stocker de token OAuth en clair. Les appels paginés Meet sont agrégés avant le rendu.
