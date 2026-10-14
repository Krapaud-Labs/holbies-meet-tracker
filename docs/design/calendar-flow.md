# Lecture Google Agenda

## Périmètre livré

Après une autorisation Google réussie, la popup liste d'abord les agendas accessibles via `calendarList`, puis permet de sélectionner ceux à suivre. Elle interroge chaque agenda sélectionné pour la semaine civile en cours, du lundi au dimanche. Toutes les pages retournées par Google via `nextPageToken` sont chargées avant le filtrage et le tri. Un événement terminé depuis plus d'une heure est retiré de la liste.

Le bouton engrenage du bloc Agenda ouvre un menu interne contenant le sélecteur d'agendas. Il se ferme avec le bouton ou la touche `Escape`. Le bouton de rafraîchissement relance le chargement avec le jeton courant, se désactive pendant l'appel et ne modifie pas la sélection enregistrée.

La réponse affiche uniquement le titre, la date et le lien Google Agenda fourni par l'API. Les valeurs sont rendues avec `textContent` et aucun token ou événement n'est écrit dans un stockage local.

## Sécurité et résilience

- Scopes OAuth : `calendar.readonly` pour lister les agendas, puis `calendar.events.readonly` pour lire les événements et leurs invités.
- Permission réseau : `https://www.googleapis.com/*` uniquement.
- Token transmis dans l'en-tête `Authorization`, sans journalisation ni persistance.
- Timeout réseau : huit secondes avec `AbortController`.
- Réponse `401` : suppression du token du cache Chrome et état d'erreur accessible.
- Réponse vide : état explicite « Aucun événement récent ou prochain ».

## Limites

La correspondance automatique avec un lien Meet, les événements récurrents complexes, les fuseaux affichés selon le compte et les appels Meet réels restent à traiter dans les incréments suivants. Aucun suivi de présence n'est déclenché par cette lecture Agenda seule.
