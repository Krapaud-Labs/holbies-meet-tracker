# Parcours Google Meet

> **Statut : distinguer cible MVP et comportement as-built.** CR-001 autorise l'export automatique d'une réunion à laquelle le formateur a participé. CR-003 classe Post-MVP le suivi autonome d'une réunion sans sa présence. La baseline et les décisions sont dans `docs/project-management/cahier-des-charges/holbies-meet-tracker/`.

## Cible MVP : réunion à laquelle l'utilisateur a participé

L'utilisateur connecté sélectionne l'événement Meet auquel il participe. Seules les réunions effectivement rejointes par ce compte entrent dans le flux MVP. Une fois les sessions de présence disponibles et la réunion terminée, l'extension crée automatiquement le rapport Sheets si l'export a été activé et autorisé au préalable. Elle réessaie les appels et, après échec, propose le fallback JSON/CSV local. L'extension ne partage pas le rapport et ne transmet pas de présence à un backend dans le MVP.

La disponibilité du rapport final Meet, le signal de fin et les reprises doivent être vérifiés en condition réelle. Aucun succès d'API n'est établi par les tests simulés.

## Comportement actuellement implémenté, Post-MVP CR-002/CR-003

Depuis un événement Google Agenda contenant un lien Meet, l'extension recherche le compte rendu de conférence, récupère les participants et agrège leurs sessions pour préparer un statut de présence. Un service worker MV3 relance ce cycle toutes les minutes dans la fenêtre de l'événement, crée la session backend et envoie les snapshots même si la popup est fermée et si le mentor ne rejoint pas le Meet. Ce comportement as-built dépend du backend (CR-002) et du suivi sans mentor (CR-003); il est classé Post-MVP.
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

Les heures d'arrivée et de départ sont des données personnelles. Le comportement de l'extension et du backend doit être évalué selon les changements CR-001 à CR-003. Les tokens OAuth ne doivent pas être journalisés. L'export Sheets doit recevoir une validation de sa finalité, de ses destinataires, de sa durée de conservation et de sa suppression.

Le scope `meetings.space.readonly` peut nécessiter une vérification OAuth pour une application publique. La validation fonctionnelle doit être faite avec un compte Google de test autorisé, sans présenter les contrôles statiques comme un test API réel.
