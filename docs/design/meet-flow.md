# Parcours Google Meet

## Objectif MVP

Depuis un événement Google Agenda contenant un lien Meet, l'extension recherche le compte rendu de conférence, récupère les participants et agrège leurs sessions pour préparer un statut de présence. Un service worker MV3 relance ce cycle toutes les minutes dans la fenêtre de l'événement, crée la session backend et envoie les snapshots même si la popup est fermée et si le mentor ne rejoint pas le Meet.
Après l'heure de fin Agenda, le worker attend dix minutes puis clôture la session via l'endpoint authentifié. Les invités restent donc « en attente » pendant la réunion et deviennent « absents » seulement après cette clôture ou un événement de fin Meet.

## Meet actuellement ouvert

Lorsque la popup est ouverte depuis un onglet `https://meet.google.com/...`, elle détecte le code de la réunion via la permission Chrome `tabs` et affiche le bouton « Analyser le Meet ouvert ». Si le code correspond à un événement déjà chargé, l'extension réutilise son titre, son horaire et ses invités Agenda afin de calculer aussi les absents. Sinon, elle analyse le Meet sans invités connus. Dans les deux cas, les participants Meet sont affichés et le suivi live peut être démarré si Google expose déjà le compte rendu de conférence.

## Appels API

1. Le lien est lu en priorité depuis `hangoutLink`, puis depuis `conferenceData.entryPoints`, le lieu ou la description de l'événement. Le code est extrait d'un lien `https://meet.google.com/abc-mnop-xyz`.
2. Le compte rendu est recherché avec :

   `GET https://meet.googleapis.com/v2/conferenceRecords?filter=space.meeting_code%3D%22abc-mnop-xyz%22&pageSize=10`

3. Les participants sont listés avec :

   `GET https://meet.googleapis.com/v2/conferenceRecords/{record}/participants?pageSize=250`

4. Les sessions de chaque participant sont listées avec :

   `GET https://meet.googleapis.com/v2/conferenceRecords/{record}/participants/{participant}/participantSessions?pageSize=250`

Chaque réponse paginée doit être parcourue avec `nextPageToken`. Les reconnexions sont conservées comme plusieurs sessions et agrégées par participant.

La popup affiche ensuite un résumé séparé des statuts `à l'heure`, `en retard` et `absent`. Les participants dont l'identité doit être vérifiée restent dans la liste détaillée sans être comptés dans ces trois catégories.

Sources : [conferenceRecords.list](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords/list), [participants](https://developers.google.com/workspace/meet/api/guides/participants), [participantSessions.list](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.participants.participantSessions/list).

## Statuts affichés

- `Présent à l'heure` : première session au plus tard deux minutes après le début prévu.
- `Présent en retard` : une session existe, mais l'arrivée dépasse la tolérance de deux minutes.
- `Absent` : l'invité Agenda n'est pas retrouvé dans les participants identifiables.
- `Identité à vérifier` : participant anonyme, téléphonique ou correspondance ambiguë.
- `Réunion encore active` : une session n'a pas encore de date de fin.

Le nom affiché n'est pas une preuve suffisante d'identité. L'extension ne rapproche donc pas automatiquement un participant anonyme d'un invité Agenda.

## Limites et confidentialité

Les heures d'arrivée et de départ sont des données personnelles. Le MVP ne journalise ni token OAuth ni réponse brute et ne persiste pas les résultats localement. L'export Sheets doit encore recevoir une validation de sa finalité, de ses destinataires, de sa durée de conservation et de sa suppression.

Le scope `meetings.space.readonly` peut nécessiter une vérification OAuth pour une application publique. La validation fonctionnelle doit être faite avec un compte Google de test autorisé, sans présenter les contrôles statiques comme un test API réel.
