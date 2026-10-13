# Lecture Google Agenda

## Périmètre livré

Après une autorisation Google réussie, la popup interroge en lecture seule l'endpoint `calendar/v3/calendars/primary/events` pour les sept derniers jours et les trente prochains événements, avec un maximum de dix résultats.

La réponse affiche uniquement le titre, la date et le lien Google Agenda fourni par l'API. Les valeurs sont rendues avec `textContent` et aucun token ou événement n'est écrit dans un stockage local.

## Sécurité et résilience

- Scope OAuth : `calendar.events.readonly`.
- Permission réseau : `https://www.googleapis.com/*` uniquement.
- Token transmis dans l'en-tête `Authorization`, sans journalisation ni persistance.
- Timeout réseau : huit secondes avec `AbortController`.
- Réponse `401` : suppression du token du cache Chrome et état d'erreur accessible.
- Réponse vide : état explicite « Aucun événement récent ou prochain ».

## Limites

La correspondance automatique avec un lien Meet, les événements récurrents complexes, les fuseaux affichés selon le compte et les appels Meet réels restent à traiter dans les incréments suivants. Aucun suivi de présence n'est déclenché par cette lecture Agenda seule.
