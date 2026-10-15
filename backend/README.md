# Backend Live Holbies Meet Tracker

Backend local destiné au suivi Live et aux rapports HTML des réunions Google Meet. Il refuse les mentors dont l’adresse ne se termine pas par `@holbertonschool.com`.

La page HTML des rapports sera la sortie principale : synthèse de la réunion, participants attendus, arrivées, retards, absents et historique. Google Sheets restera un export optionnel, pas la base de consultation. Les rapports sont servis sans cache avec une CSP restrictive adaptée à leur HTML statique.

## Lancer les tests

```bash
npm test
```

## Lancer le service

```bash
npm install
npm start
```

Le service écoute sur `http://localhost:8080` par défaut. `schema.sql` décrit la persistance des sessions, invités et événements. Les lectures de session et de rapport vérifient le compte Google du mentor et le propriétaire de la session. La popup peut interroger le backend toutes les cinq secondes via `LIVE_BACKEND_URL` dans `popup.js`; remplacez cette valeur par l’URL HTTPS du VPS avant publication. Le backend expose aussi `wss://<hôte>/api/v1/live/sessions/{id}/stream` : le client doit proposer les sous-protocoles `holbies-live-v1` et `bearer.<token Google>`. Après l’état initial, les messages `session.updated`, `session.created` et `session.ended` contiennent la session et ses `participantStatuses`. Le serveur envoie des ping WebSocket, accepte un message applicatif `{"type":"ping"}` et limite par défaut à 20 connexions par session (`MAX_WEBSOCKET_CLIENTS_PER_SESSION`). Le polling HTTP reste le fallback recommandé. `GOOGLE_EVENTS_SECRET` est obligatoire : le webhook Google Workspace Events répond `401` si le secret est absent, vide ou incorrect. `ALLOWED_EXTENSION_ORIGIN` doit contenir l’origine exacte `chrome-extension://jilidimjjdkgdggfkackomkmjjldlpaf` (ou l’ID de publication réel), et `MAX_BODY_BYTES` permet de réduire la limite de payload, fixée à 256 KiB par défaut. Le secret doit rester uniquement dans l’environnement du VPS.

## Déploiement VPS sans service payant

Copiez `production-env.template` vers `.env` (ou renseignez les variables dans Dokploy, qui génère ce fichier) sur le VPS, remplacez toutes les valeurs `CHANGE_ME` et ne versionnez jamais ce fichier. Le compose de production lie le backend à `127.0.0.1`; exposez-le uniquement derrière un reverse-proxy HTTPS. Initialisez la base puis démarrez :

```bash
docker compose -f docker-compose.production.yml up -d --build
```

Le service `tunnel` fournit un endpoint HTTPS temporaire gratuit via Cloudflare Tunnel Quick Tunnels, sans nom de domaine ni compte payant. Relisez son URL dans les logs Dokploy et renseignez-la dans `LIVE_BACKEND_URL` avant le test. Cette URL change si le tunnel est recréé et ne convient pas à une publication permanente.

Lors du premier démarrage, PostgreSQL applique automatiquement `schema.sql` via le volume d’initialisation officiel de l’image. Ce mécanisme ne rejoue pas le fichier sur un volume déjà initialisé : utilisez une migration versionnée pour toute évolution ultérieure.

Avant d’ouvrir le service, vérifiez `GET /health`, le certificat TLS, le secret du webhook et la sauvegarde du volume PostgreSQL. Le client autorisé peut aussi envoyer un snapshot via `PUT /api/v1/live/sessions/{id}/participants`; le serveur recalcule les statuts avant de répondre. Pour revenir à l’image précédente, arrêtez le compose, restaurez la version Git précédente et relancez `up -d --build`. La création de l’abonnement Google Workspace Events/Pub/Sub reste une opération manuelle dans le projet Google autorisé.

Le suivi live expose aussi `/api/v1/live/sessions/{id}/stream` en WebSocket sécurisé. Le client doit négocier `holbies-live-v1` et transmettre le jeton Google dans un second sous-protocole préfixé par `bearer.`. Le serveur envoie un snapshot initial puis diffuse les événements `session.updated`, `session.created` et `session.ended`, avec `participantStatuses`. Le heartbeat ping/pong maintient les connexions et le serveur limite par défaut à 20 clients par session via `MAX_WEBSOCKET_CLIENTS_PER_SESSION`. La popup conserve le polling comme solution de repli.
