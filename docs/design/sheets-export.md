# Export Google Sheets

> **Statut : implémentation actuelle et cible MVP distinctes.** CR-001 a été accepté au MVP le 2026-10-23 : la cible est l'export automatique à la fin de la réunion, après autorisation préalable. La popup actuelle demande un clic et n'atteint pas encore cette cible.

## Cible MVP acceptée par CR-001

À la fin de la réunion, créer automatiquement l'onglet Sheets dédié. Si les appels échouent après les réessais, proposer un export local JSON/CSV. L'autorisation Google pour l'écriture doit être donnée au préalable et le flux doit rester explicite sur le compte et le dossier utilisés. Les scopes, l'activation de cette fonction, les destinataires et la rétention restent à préciser dans la conception avant implémentation. Cette décision de portée ne prouve pas un test réel de Sheets.

## Comportement actuellement implémenté

L'export crée une nouvelle feuille via `spreadsheets.create`, retrouve ou crée le dossier Drive racine `Holbies Meet Tracker`, déplace la feuille dans ce dossier via l'API Drive, puis écrit les colonnes `Prénom`, `Nom`, `Date`, `Réunion`, `Arrivée`, `Départ` et `Statut` avec `spreadsheets.values.update`. Les données sont préparées en mémoire dans la popup et ne sont pas stockées par l'extension.

L'export reste désactivé jusqu'à un consentement explicite dans la popup. L'utilisateur est responsable de la finalité du suivi, des destinataires, de la durée de conservation et de la suppression de la feuille créée. Le bouton de déconnexion invalide le token courant et vide les résultats de la popup.

Chaque appel Sheets est tenté deux fois. Si la création ou l'écriture échoue, la popup propose un téléchargement CSV local des mêmes sept colonnes afin de ne pas perdre le compte rendu.

Les invités Agenda sont comparés aux participants Meet par adresse e-mail lorsqu'elle est fournie par l'API. Un invité sans correspondance reçoit le statut `absent`; les participants sans e-mail restent affichés comme identités à vérifier.

Le fichier est créé dans le dossier `Holbies Meet Tracker` du Drive du compte connecté. L'implémentation actuelle ne partage pas automatiquement la feuille et ne conserve pas son identifiant. Si le dossier ne peut pas être lu ou créé, l'export échoue explicitement et propose le CSV local, sans laisser la feuille à la racine. L'accès, la durée de conservation et la suppression doivent être validés avant un usage institutionnel.

Les scopes `spreadsheets` et `drive.file` sont demandés ensemble au moment de l'export afin d'autoriser l'écriture dans la feuille créée par l'extension et son rangement dans le dossier créé ou géré par l'extension. Sources : [spreadsheets.create](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/create), [values.update](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/update), [files.list](https://developers.google.com/drive/api/reference/rest/v3/files/list), [files.create](https://developers.google.com/drive/api/reference/rest/v3/files/create) et [files.update](https://developers.google.com/drive/api/reference/rest/v3/files/update).
