# Export Google Sheets

L'export crée une nouvelle feuille via `spreadsheets.create`, puis écrit les colonnes `Prénom`, `Nom`, `Date`, `Réunion`, `Arrivée`, `Départ` et `Statut` avec `spreadsheets.values.update`. Les données sont préparées en mémoire dans la popup et ne sont pas stockées par l'extension.

L'export reste désactivé jusqu'à un consentement explicite dans la popup. L'utilisateur est responsable de la finalité du suivi, des destinataires, de la durée de conservation et de la suppression de la feuille créée. Le bouton de déconnexion invalide le token courant et vide les résultats de la popup.

Les invités Agenda sont comparés aux participants Meet par adresse e-mail lorsqu'elle est fournie par l'API. Un invité sans correspondance reçoit le statut `absent`; les participants sans e-mail restent affichés comme identités à vérifier.

Le fichier est créé dans le Drive du compte connecté. Le MVP ne partage pas automatiquement la feuille et ne conserve pas son identifiant. L'accès, la durée de conservation et la suppression doivent être validés avant un usage institutionnel.

Le scope `spreadsheets` est demandé en plus de `drive.file` afin d'autoriser l'écriture dans la feuille créée par l'extension. Sources : [spreadsheets.create](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/create) et [values.update](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/update).
