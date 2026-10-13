# Export Google Sheets

L'export crée une nouvelle feuille via `spreadsheets.create`, puis écrit deux colonnes (`Participant`, `Statut`) avec `spreadsheets.values.update`. Les données sont préparées en mémoire dans la popup et ne sont pas stockées par l'extension.

Le fichier est créé dans le Drive du compte connecté. Le MVP ne partage pas automatiquement la feuille et ne conserve pas son identifiant. L'accès, la durée de conservation et la suppression doivent être validés avant un usage institutionnel.

Le scope `spreadsheets` est demandé en plus de `drive.file` afin d'autoriser l'écriture dans la feuille créée par l'extension. Sources : [spreadsheets.create](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/create) et [values.update](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/update).
