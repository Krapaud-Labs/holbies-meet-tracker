# Contrats API

- Google Calendar `events.list` : lecture des événements du calendrier primaire.
- Google Meet `conferenceRecords.list`, `participants.list` et `participantSessions.list` : lecture des comptes rendus et sessions.
- Google Sheets `spreadsheets.create` puis `spreadsheets.values.update` : création et remplissage de la feuille exportée.
- Backend `PUT /api/v1/live/sessions/{id}/participants` : snapshot de participants envoyé par un client autorisé pour alimenter le suivi live sans Pub/Sub. Chaque entrée accepte `name`, `email`, `joinedAt` et `leftAt`; le serveur recalcule le statut et le retard.

Les réponses HTTP non réussies sont affichées comme erreurs utilisateur, avec le détail API lorsqu'il est exploitable. Les listes paginées suivent `nextPageToken`.
