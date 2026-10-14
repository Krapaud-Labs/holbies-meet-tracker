# Contrats API

- Google Calendar `events.list` : lecture des événements du calendrier primaire.
- Google Meet `conferenceRecords.list`, `participants.list` et `participantSessions.list` : lecture des comptes rendus et sessions.
- Google Sheets `spreadsheets.create` puis `spreadsheets.values.update` : création et remplissage de la feuille exportée.
- Backend `PUT /api/v1/live/sessions/{id}/participants` : snapshot de participants envoyé par un client autorisé pour alimenter le suivi live sans Pub/Sub. Chaque entrée accepte `name`, `email`, `joinedAt` et `leftAt`; le serveur recalcule le statut et le retard.
- Backend `POST /api/v1/live/sessions/{id}/end` : clôture authentifiée d'une session après la fin Agenda et une marge de dix minutes, afin de transformer les invités non observés en absents sans les déclarer absents pendant la réunion.

Les réponses HTTP non réussies sont affichées comme erreurs utilisateur, avec le détail API lorsqu'il est exploitable. Les listes paginées suivent `nextPageToken`.
