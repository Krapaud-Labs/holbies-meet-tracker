# Cahier des charges MVP reconstitué depuis l'historique disponible

## Statut et limites de provenance

Statut : reconstitution documentaire, non certifiée comme copie exacte du cahier initial.

Le dépôt ne contient pas l'empreinte originale `ORIGINAL-MVP-BRIEF.sha256`, ni un cahier complet suivi sous ce nom. La source suivie la plus ancienne retrouvée pour le périmètre MVP est le commit d'onboarding `d890828` du 2026-10-13, notamment `docs/product/vision-and-scope.md`, `docs/product/user-stories.md`, `docs/product/user-flows.md`, `docs/delivery/decision-log.md` et les documents de conception présents dans ce commit. Le fichier local `.codex/PROJECT-BRIEF.md`, marqué `accepted`, est une source distincte non suivie par Git.

Cette reconstitution synthétise les éléments MVP de ces sources anciennes. Elle ne prouve pas qu'aucun cahier antérieur n'a existé. Le brouillon incomplet et le brief accepté local sont conservés séparément.

## Vision

Réduire le travail manuel des animateurs qui comparent les invités Google Agenda aux participants Google Meet et reportent les présences dans Google Sheets, en limitant les erreurs d'identité, d'horodatage et de calcul du retard.

## Utilisateurs

- Animateur : suit ses réunions, consulte les présences et obtient un compte rendu exploitable.
- Étudiant invité : son statut de présence est calculé à partir de sa participation à la réunion.

## Objectifs mesurables documentés

- Comparer les invités et participants pour toutes les réunions supportées dans les scénarios de test.
- Appliquer correctement le seuil de retard de deux minutes dans les cas de test.
- Créer un onglet Google Sheets dédié ou signaler l'échec dans tous les scénarios simulés.

## Périmètre MVP retrouvé dans le premier dossier produit suivi

1. Détecter une réunion Google Meet active à laquelle l'utilisateur participe.
2. Retrouver l'événement et les invités dans Google Agenda.
3. Lire via l'accès Meet retenu les participants et leurs sessions d'arrivée et de départ, si les données sont exposées.
4. Associer les participants aux invités, principalement par adresse e-mail.
5. Classer les invités à l'heure, en retard ou absents avec une tolérance de deux minutes.
6. Signaler les participants inconnus et les identités ambiguës sans les résoudre automatiquement.
7. Créer un onglet Google Sheets par réunion avec les données de présence attendues.
8. Après échec Sheets, réessayer puis proposer un export local JSON/CSV.

## Hors périmètre et limites

- Réunions auxquelles l'utilisateur ne participe pas.
- Résolution automatique d'une identité ambiguë.
- Collecte de données sans rapport avec le suivi de présence.
- Application mobile et administration multi-classes.
- La disponibilité des e-mails et horaires Meet, les quotas, la conservation des données et les scopes OAuth exacts restent à prouver ou préciser.

## Contraintes et décisions datées retrouvées

- Extension Google Chrome, cible initiale Chrome stable sur macOS et Linux.
- Intégrations Google Agenda, Meet et Sheets.
- API Google Meet officielle prioritaire, sous réserve de faisabilité.
- OAuth 2.0 et moindre privilège; stockage local minimal; pas de token dans les logs.
- Trello désactivé dans le journal de décisions daté du 2026-10-13.
- Budget et délai non précisés.

## Critères d'acceptation reconstitués

- L'événement correspondant et ses invités sont identifiés.
- Les participants et sessions disponibles sont lus.
- Le seuil de deux minutes classe correctement les présences.
- Les absents sont distingués des identités inconnues ou ambiguës.
- Un onglet Sheets dédié est créé; un échec donne lieu à des reprises puis à une option locale.
- Les tests couvrent les règles métier et un audit de sécurité est effectué.

## Écarts avec les documents ultérieurs

La version de `docs/product/vision-and-scope.md` au commit `4b23619` réduit l'export à une action volontaire et exclut le backend serveur. Le dépôt actuel contient pourtant un backend live, PostgreSQL et de la collecte périodique. Ces éléments sont postérieurs à la première vision suivie ou la contredisent; ils ne sont donc pas inclus automatiquement dans cette reconstitution du MVP. Ils exigent une demande de changement et une décision explicite MVP ou Post-MVP avant d'être considérés comme périmètre accepté.

Le brief local accepté décrit l'enregistrement automatique à la sortie. Cette version est archivée comme source séparée; son statut Git local ne permet pas de la dater ni de l'authentifier comme cahier initial.
