# Architecture

L'extension est une popup Chrome Manifest V3 sans build. `popup.html` structure l'interface, `popup.css` porte le thème, `popup.js` orchestre OAuth et les appels Google, et `attendance.js` contient le calcul pur des statuts.

Les données transitent directement entre la popup et les APIs Google autorisées. Aucun backend ni stockage persistant de token n'est utilisé. Les appels paginés Meet sont agrégés avant le rendu.
