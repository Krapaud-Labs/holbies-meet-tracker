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

Le service écoute sur `http://localhost:8080` par défaut. `schema.sql` décrit la persistance des sessions, invités et événements. Les lectures de session et de rapport vérifient le compte Google du mentor et le propriétaire de la session. La popup peut interroger le backend toutes les cinq secondes via `LIVE_BACKEND_URL` dans `popup.js`; remplacez cette valeur par l’URL HTTPS du VPS avant publication. Le secret `GOOGLE_EVENTS_SECRET` doit protéger le webhook Google Workspace Events en production.

## Déploiement VPS sans service payant

Copiez `production-env.template` vers `.env.production` sur le VPS, remplacez toutes les valeurs `CHANGE_ME` et ne versionnez jamais ce fichier. Le compose de production lie le backend à `127.0.0.1`; exposez-le uniquement derrière un reverse-proxy HTTPS. Initialisez la base puis démarrez :

```bash
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml exec backend node -e "console.log('schema.sql doit être appliqué par votre procédure PostgreSQL sécurisée')"
```

Avant d’ouvrir le service, vérifiez `GET /health`, le certificat TLS, le secret du webhook et la sauvegarde du volume PostgreSQL. Pour revenir à l’image précédente, arrêtez le compose, restaurez la version Git précédente et relancez `up -d --build`. La création de l’abonnement Google Workspace Events/Pub/Sub reste une opération manuelle dans le projet Google autorisé.
