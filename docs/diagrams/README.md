# Diagrammes de conception

Ces diagrammes distinguent les composants actuellement présents des composants cibles non implémentés. Leur cohérence documentaire a été relue indépendamment; cette revue ne prouve pas l'accès Google, une couverture fiable, la sécurité du stockage ou un coût nul.

## Architecture

Voir [architecture as-built et cible MVP](architecture.md). Le diagramme sépare l'extension et le backend live observés du scheduler, du collecteur VPS, du stockage des credentials et du buffer CR-009 proposés.

## Séquence de collecte et d'export

Voir [séquence cible CR-008/CR-009](attendance-export-sequence.md). Les branches d'échec se terminent en `not_detected` ou `manual_review_required` et ne génèrent jamais d'absences à partir de données manquantes.

## Revue requise

Les composants proposés et les frontières de confiance restent soumis à la revue finale globale. Les gates d'accès Meet tiers, couverture de réunions courtes et manquées, identité `sub`/Meet, OAuth serveur, rétention institutionnelle, finalité et quota agrégé sans frais restent `needs-review`.
