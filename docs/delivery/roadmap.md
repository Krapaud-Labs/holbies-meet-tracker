# Roadmap

> **Statut : roadmap as-built et cible décidée.** Les capacités ci-dessous sont documentées comme présentes ou envisagées; leur présence dans le dépôt ne prouve ni leur achèvement ni leur acceptation MVP. Les arbitrages sont datés plus bas et détaillés dans les CR.

## Capacités documentées comme présentes, périmètre à confirmer

OAuth explicite, Agenda, détection Meet, statuts de présence, export Sheets, CSV de secours, interface Holberton et documentation de conception.

## Propositions post-MVP, à confirmer

Ajouter des tests d'interface automatisés, une meilleure gestion des fuseaux horaires et une validation de conformité propre au contexte d'utilisation.

## Arbitrages de périmètre du 2026-10-23

- **CR-001, MVP accepté :** export Sheets automatique en fin de réunion, après autorisation préalable, avec réessais et fallback local JSON/CSV. L'interface actuelle à export manuel reste à aligner et le flux réel n'est pas encore prouvé.
- **CR-002, Post-MVP accepté :** backend et persistance serveur des présences.
- **CR-003, Post-MVP accepté :** suivi automatique en arrière-plan lorsque le mentor n'est pas présent. Il dépend de CR-002.

Les décisions sont détaillées dans [`CHANGE-REQUEST-28a8e652`](../project-management/cahier-des-charges/holbies-meet-tracker/CHANGE-REQUEST-28a8e6521495644f0996d40e626d1dfd5a6216c7acb35c4823cce4bb2bf2652b.md). Le classement n'est pas une preuve que les comportements sont implémentés ou validés en conditions réelles.
