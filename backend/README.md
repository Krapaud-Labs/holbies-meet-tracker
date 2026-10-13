# Backend Live Holbies Meet Tracker

Backend local destiné au suivi Live et aux rapports HTML des réunions Google Meet. Il refuse les mentors dont l’adresse ne se termine pas par `@holbertonschool.com`.

La page HTML des rapports sera la sortie principale : synthèse de la réunion, participants attendus, arrivées, retards, absents et historique. Google Sheets restera un export optionnel, pas la base de consultation.

## Lancer les tests

```bash
npm test
```

## Lancer le service

```bash
npm install
npm start
```

Le service écoute sur `http://localhost:8080` par défaut. `schema.sql` décrit la persistance des sessions, invités et événements. L’API actuelle fournit la base du contrat Live ; l’authentification Google vérifiée côté serveur, la réception Google Workspace Events et le rendu Live dans la popup restent les prochaines étapes avant le déploiement VPS.
