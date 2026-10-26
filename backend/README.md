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

Le service écoute sur `http://localhost:8080` par défaut. `schema.sql` décrit la persistance des sessions, invités et événements. Les lectures de session et de rapport vérifient le compte Google du mentor et le propriétaire de la session. La popup peut interroger le backend toutes les cinq secondes via `LIVE_BACKEND_URL` dans `popup.js`; remplacez cette valeur par l’URL HTTPS du VPS avant publication.

Pour le lancement local avec Docker Compose, créez `backend/.env` à partir de `.env.example`, puis renseignez les deux valeurs OAuth privées correspondant au client et à l’origine exacts de l’extension installée. Depuis `backend/`, lancez `docker compose up --build`. Compose refuse explicitement de démarrer si l’une de ces valeurs manque; `.env.example` n’est pas chargé implicitement par Docker.

Avant de lancer le service, configurez dans l’environnement privé `GOOGLE_CLIENT_ID` (client OAuth Google associé à l’extension distribuée) et `ALLOWED_EXTENSION_ORIGIN` (une origine exacte `chrome-extension://` suivie de 32 lettres minuscules de `a` à `p`). Ces deux variables sont obligatoires; une valeur absente ou invalide empêche le backend de démarrer. Les fichiers `.env.example` et `production-env.template` ne contiennent que des champs vides. Ne mettez jamais un vrai identifiant client dans le dépôt. L’origine doit correspondre à l’identifiant du paquet CWS, pas à une installation unpacked locale.

Chaque requête Bearer est validée via un `POST` HTTPS vers l’API OAuth2 v2 `https://www.googleapis.com/oauth2/v2/tokeninfo`, avec `access_token` dans le paramètre query documenté par Google. La réponse est contrôlée en mode fermé : `audience` et `issued_to` doivent égaler exactement `GOOGLE_CLIENT_ID`, l’adresse doit être vérifiée et dans le domaine autorisé, le scope Meet doit être présent, `expires_in` positif et `user_id` non vide. Le code ne journalise ni le jeton, ni l’URL tokeninfo, ni le corps Google. Les journaux des proxys sortants doivent également masquer le paramètre OAuth sensible. Voir [la conception de validation du jeton backend](../docs/design/backend-auth-token-validation.md) pour les contrats, limites et preuves.

Le backend expose aussi `wss://<hôte>/api/v1/live/sessions/{id}/stream`. Le client obtient d’abord un ticket éphémère via `POST /api/v1/live/sessions/{id}/stream-ticket` avec son Bearer Google et l’origine exacte de l’extension; une origine invalide est refusée avant la validation du jeton. Il propose ensuite uniquement le sous-protocole `holbies-live-v1` avec le ticket dans l’URL. Le ticket expire après 30 secondes et ne peut être utilisé qu’une fois. Après l’état initial, les messages `session.updated`, `session.created` et `session.ended` contiennent la session et ses `participantStatuses`. Le serveur envoie des ping WebSocket et limite par défaut à 20 connexions par session (`MAX_WEBSOCKET_CLIENTS_PER_SESSION`). Le polling HTTP reste le fallback recommandé. `GOOGLE_EVENTS_SECRET` est obligatoire : le webhook Google Workspace Events répond `401` si le secret est absent, vide ou incorrect. `MAX_BODY_BYTES` permet de réduire la limite de payload, fixée à 256 KiB par défaut. Le secret doit rester uniquement dans l’environnement du VPS.

La règle d’accès actuelle est le suffixe `ALLOWED_EMAIL_DOMAIN`; elle ne vérifie pas l’appartenance à un groupe Google de mentors. Le mécanisme de Google Group reste une demande de changement séparée. La validation locale en tests ne prouve ni la disponibilité durable du endpoint tokeninfo access-token, ni les valeurs réelles du VPS, ni un login depuis une extension installée via le Chrome Web Store. Consultez [le diagnostic de connexion](../docs/design/auth-connection-diagnostics.md) et les [notes CWS](../docs/operations/cws-privacy-submission-notes.md) avant distribution.

## Déploiement VPS sans service payant

Copiez `production-env.template` vers `.env` (ou renseignez les variables dans Dokploy, qui génère ce fichier) sur le VPS, remplacez toutes les valeurs `CHANGE_ME` et ne versionnez jamais ce fichier. Le compose de production lie le backend à `127.0.0.1`; exposez-le uniquement derrière un reverse-proxy HTTPS. Initialisez la base puis démarrez :

```bash
docker compose -f docker-compose.production.yml up -d --build
```

Le service `tunnel` fournit une adresse HTTPS temporaire. Relisez cette adresse dans les logs de déploiement et renseignez-la dans `LIVE_BACKEND_URL` avant le test. Elle peut changer si le tunnel est recréé et ne convient pas à une publication permanente.

Lors du premier démarrage, PostgreSQL applique automatiquement `schema.sql` via le volume d’initialisation officiel de l’image. Ce mécanisme ne rejoue pas le fichier sur un volume déjà initialisé : utilisez une migration versionnée pour toute évolution ultérieure.

Avant d’ouvrir le service, vérifiez `GET /health`, le certificat TLS, le secret du webhook et la sauvegarde du volume PostgreSQL. Le client autorisé peut aussi envoyer un snapshot via `PUT /api/v1/live/sessions/{id}/participants`; le serveur recalcule les statuts avant de répondre. Pour revenir à l’image précédente, arrêtez le compose, restaurez la version Git précédente et relancez `up -d --build`. La création de l’abonnement Google Workspace Events/Pub/Sub reste une opération manuelle dans le projet Google autorisé.

Le suivi live expose `POST /api/v1/live/sessions/{id}/stream-ticket` avec le Bearer Google et l’Origin de l’extension. Le serveur retourne un ticket aléatoire à usage unique, valable 30 secondes par défaut. Le client ouvre ensuite `/api/v1/live/sessions/{id}/stream?ticket=...` en négociant uniquement `holbies-live-v1`; l’Origin est vérifiée strictement. Le serveur envoie un snapshot initial puis diffuse les événements `session.updated`, `session.created` et `session.ended`, avec `participantStatuses`. Le heartbeat ping/pong maintient les connexions et le serveur limite par défaut à 20 clients par session via `MAX_WEBSOCKET_CLIENTS_PER_SESSION`. La popup conserve le polling comme solution de repli.
