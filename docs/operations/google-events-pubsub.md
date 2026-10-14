# Google Workspace Events et Pub/Sub

Le MVP utilise le polling backend toutes les cinq secondes. Cette voie ne nécessite pas de topic Pub/Sub et reste la voie gratuite actuellement vérifiée.

## Prérequis avant activation

L'activation du push natif exige une décision explicite sur le projet Google Cloud et son budget :

1. Sélectionner le projet Google Cloud autorisé par Holberton.
2. Activer `meet.googleapis.com`, `workspaceevents.googleapis.com` et `pubsub.googleapis.com`.
3. Créer un topic Pub/Sub, par exemple `workspace-events`.
4. Autoriser `meet-api-event-push@system.gserviceaccount.com` avec le rôle `Pub/Sub Publisher` sur ce topic.
5. Créer la souscription Workspace Events sur l'espace Meet avec les événements de conférence et de sessions participants.
6. Configurer la livraison Pub/Sub vers l'endpoint HTTPS du VPS avec une authentification OIDC vérifiable par le backend.
7. Renseigner `GOOGLE_EVENTS_SECRET` uniquement si un relais contrôlé ajoute ce secret. Le backend refuse sinon les requêtes webhook directes.

Ces étapes ne doivent pas être exécutées automatiquement : elles peuvent créer une ressource Cloud et entraîner des frais selon le projet. Aucun compte bancaire, quota ou budget n'est modifié par le dépôt.

## Vérifications après activation

```bash
curl -fsS https://URL_VPS/health
```

Puis ouvrir un Meet de test, faire rejoindre et sortir un participant, et vérifier dans le rapport que le statut et l'heure changent sans attendre le cycle de polling. Conserver l'identifiant de la souscription, le topic, la date d'expiration et le résultat dans le journal d'exploitation, sans enregistrer de token.

## Sources officielles

- [Répondre aux événements Google Meet](https://developers.google.com/workspace/meet/api/guides/events-overview)
- [S'abonner aux événements Google Meet](https://developers.google.com/workspace/events/guides/events-meet)
- [Tutoriel Pub/Sub et Meet](https://developers.google.com/workspace/meet/api/guides/tutorial-events-python)

