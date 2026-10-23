# Documentation du projet

Cette documentation décrit le périmètre proposé, les flux, l'architecture et les contrôles de Holbies Meet Tracker. Le classement MVP historique reste soumis aux décisions consignées dans l'archive et le manifeste de changements.

## Provenance du MVP

L'archive contient la [reconstitution depuis l'historique](project-management/cahier-des-charges/holbies-meet-tracker/reconstitution-mvp-depuis-historique.md), la [copie du brief local accepté](project-management/cahier-des-charges/holbies-meet-tracker/reconstruction-depuis-brief-accepte.md), le [brouillon local incomplet](project-management/cahier-des-charges/holbies-meet-tracker/brouillon-historique-incomplet.md) et une [note de provenance](project-management/cahier-des-charges/holbies-meet-tracker/PROVENANCE.md) qui référence aussi les sources Git sans les recopier.

L'empreinte de la reconstitution est candidate et ne prouve pas son originalité historique. Les écarts sont consignés dans la [demande de changement](project-management/cahier-des-charges/holbies-meet-tracker/CHANGE-REQUEST-28a8e6521495644f0996d40e626d1dfd5a6216c7acb35c4823cce4bb2bf2652b.md) : CR-001 est accepté au MVP; CR-002 et CR-003 sont Post-MVP. Aucune pièce historique n'est réécrite pour intégrer ces décisions.

Le [journal des décisions](delivery/decision-log.md) et la [cible d'export](design/sheets-export.md) décrivent l'écart entre la cible MVP automatique et l'implémentation actuelle à action manuelle.

## Suivi GitHub Projects

Le manifeste local et les preuves de synchronisation sont consignés dans [GitHub Project](project-management/github-project.md). Le Project privé [Holbies Meet Tracker, #4](https://github.com/orgs/Krapaud-Labs/projects/4) est relié au dépôt; ses 13 Issues ont été créées puis relues. Les Issues consignent tâches, critères et preuves attendues à des niveaux de détail différents; chaque clôture doit être étayée par les preuves de l’Issue concernée. Le Project a une unique vue Kanban (`BOARD_LAYOUT`) regroupée par `Status`; labels de phase et domaine visibles sur les cartes. Les Issues ouvertes contiennent des objectifs, checklists, critères d’acceptation, preuves attendues et définitions de clôture.

## Audit de reprise

Les résultats d'audit du 2026-10-23, les contrôles exécutés et les limites constatées sont consignés dans [l'audit de reprise](quality/project-recovery-audit.md).

## Parcours principal

Le parcours actuellement documenté est : connexion Google explicite, lecture des événements Agenda, sélection d'un événement Meet, lecture des participants et de leurs sessions, calcul d'un statut, puis export consenti vers une nouvelle feuille Sheets. Ces comportements courants ne valent pas acceptation MVP.
