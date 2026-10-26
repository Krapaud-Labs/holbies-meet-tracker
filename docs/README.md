---
title: Documentation de Holbies Meet Tracker
status: updated
last_updated: 2026-10-26
category: project-management
---

# Documentation du projet

Cette documentation décrit le périmètre proposé, les flux, l'architecture et les contrôles de Holbies Meet Tracker. Le classement MVP historique reste soumis aux décisions consignées dans l'archive et le manifeste de changements.

## Provenance du MVP

L'archive contient la [reconstitution depuis l'historique](project-management/cahier-des-charges/holbies-meet-tracker/reconstitution-mvp-depuis-historique.md), la [copie du brief local accepté](project-management/cahier-des-charges/holbies-meet-tracker/reconstruction-depuis-brief-accepte.md), le [brouillon local incomplet](project-management/cahier-des-charges/holbies-meet-tracker/brouillon-historique-incomplet.md) et une [note de provenance](project-management/cahier-des-charges/holbies-meet-tracker/PROVENANCE.md) qui référence aussi les sources Git sans les recopier.

L'empreinte de la reconstitution est candidate et ne prouve pas son originalité historique. Les écarts sont consignés dans la [demande de changement](project-management/cahier-des-charges/holbies-meet-tracker/CHANGE-REQUEST-28a8e6521495644f0996d40e626d1dfd5a6216c7acb35c4823cce4bb2bf2652b.md) : CR-001 est accepté au MVP; CR-002 et CR-003 sont Post-MVP. Aucune pièce historique n'est réécrite pour intégrer ces décisions.

Le [journal des décisions](delivery/decision-log.md) et la [cible d'export](design/sheets-export.md) décrivent l'écart entre la cible MVP automatique et l'implémentation actuelle à action manuelle.

Le parcours de connexion Google et sa matrice de diagnostics sont décrits dans [Diagnostic de connexion](design/auth-connection-diagnostics.md). Cette conception ciblée est approuvée; elle n'approuve ni la readiness globale du produit ni la configuration OAuth réelle.

## Suivi GitHub Projects

Le manifeste local et les preuves de synchronisation sont consignés dans [GitHub Project](project-management/github-project.md). Le Project privé [Holbies Meet Tracker, #4](https://github.com/orgs/Krapaud-Labs/projects/4) est relié au dépôt. Il contient actuellement 19 Issues : 17 en backlog, une en cours et une en revue au 2026-10-26. Les Issues consignent tâches et preuves attendues selon leur périmètre; vérifie que les critères et la définition de terminé sont explicites avant toute clôture. Le Project a une unique vue Kanban (`BOARD_LAYOUT`) regroupée par `Status`; labels de phase et domaine visibles sur les cartes.

Les règles de classement des documents actifs et des archives historiques sont décrites dans [Classement et contrôle des documents](quality/documentation-classification.md), et les empreintes de référence sont dans le [registre des archives](project-management/archive-manifest.tsv). Depuis la racine du dépôt, exécute `bash scripts/validate-documentation.sh` pour contrôler tous les Markdown actifs de `docs/`, y compris les nouveaux fichiers non suivis, et l’intégrité des archives, puis `bash scripts/test-documentation-validator.sh` pour lancer les fixtures. Python 3.11 ou supérieur est requis; seuls des modules standards sont utilisés. Le front matter pris en charge utilise des paires simples `clé: valeur`. Code 0 : aucun problème; code 1 : erreurs de contenu, manifeste ou intégrité; code 2 : invocation invalide, racine absente, manifeste indispensable absent ou environnement requis indisponible. Le validateur lit les fichiers sans les réparer et ne contacte aucun service externe. Le runner travaille sur des copies temporaires. La CI actuelle ne lance pas encore ces commandes.

## Audit de reprise

Les résultats d'audit du 2026-10-23, les contrôles exécutés et les limites constatées sont consignés dans [l'audit de reprise](quality/project-recovery-audit.md).

## Parcours principal

Le parcours actuellement documenté est : connexion Google explicite, lecture des événements Agenda, sélection d'un événement Meet, lecture des participants et de leurs sessions, calcul d'un statut, puis export consenti vers une nouvelle feuille Sheets. Ces comportements courants ne valent pas acceptation MVP.
