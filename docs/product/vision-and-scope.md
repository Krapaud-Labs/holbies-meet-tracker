# Vision et périmètre

> **Statut : baseline de travail reconstituée, origine non certifiée.** Les décisions CR-001 à CR-003 du 2026-10-23 sont consignées dans [`la demande de changement dédiée`](../project-management/cahier-des-charges/holbies-meet-tracker/CHANGE-REQUEST-28a8e6521495644f0996d40e626d1dfd5a6216c7acb35c4823cce4bb2bf2652b.md). Les capacités présentes dans le code ne deviennent pas MVP sans décision documentée.

## Vision

Réduire le travail manuel nécessaire pour vérifier la présence à des réunions pédagogiques Google Meet, en donnant une lecture locale et compréhensible des participants.

## Périmètre historique reconstitué et cible décidée

- connexion Google déclenchée par l'utilisateur ;
- lecture en lecture seule des événements Agenda ;
- détection des liens Meet dans l'événement ;
- récupération des participants et sessions Meet ;
- statuts à l'heure, en retard, absent ou identité à vérifier ;
- selon CR-001, export Google Sheets automatique à la fin d'une réunion à laquelle le formateur a participé, après autorisation préalable, avec réessais puis fallback local JSON/CSV. La mise en œuvre actuelle, qui demande un clic et embarque un suivi autonome, ne satisfait pas encore la cible MVP décidée.

## Hors périmètre du MVP et capacités réservées au Post-MVP

- Pas de suivi d'une réunion à laquelle le formateur ne participe pas; cette capacité est Post-MVP par CR-003.
- Pas de backend ni de persistance serveur des présences dans le MVP; CR-002 classe ces capacités Post-MVP.
- Pas de partage automatique de la feuille, de modification d'Agenda ni de facturation.
- Le MVP ne suit pas les réunions auxquelles le formateur ne participe pas; la collecte sans sa présence et le backend live restent Post-MVP (CR-002/003).
