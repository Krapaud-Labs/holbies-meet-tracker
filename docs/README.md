# Documentation du projet

Cette documentation décrit le périmètre proposé, les flux, l'architecture et les contrôles de Holbies Meet Tracker. Le classement MVP historique reste soumis aux décisions consignées dans l'archive et le manifeste de changements.

## Provenance du MVP

L'archive contient la [reconstitution depuis l'historique](project-management/cahier-des-charges/holbies-meet-tracker/reconstitution-mvp-depuis-historique.md), la [copie du brief local accepté](project-management/cahier-des-charges/holbies-meet-tracker/reconstruction-depuis-brief-accepte.md), le [brouillon local incomplet](project-management/cahier-des-charges/holbies-meet-tracker/brouillon-historique-incomplet.md) et une [note de provenance](project-management/cahier-des-charges/holbies-meet-tracker/PROVENANCE.md) qui référence aussi les sources Git sans les recopier.

L'empreinte de la reconstitution est candidate et ne prouve pas son originalité historique. Les écarts sont consignés dans les demandes de changement : CR-001 est accepté au MVP; CR-002 et CR-003 sont Post-MVP, puis CR-008 a réouvert au MVP le collecteur serveur minimal nécessaire au rapport planifié. CR-003 reste Post-MVP pour les réunions sans participation du mentor. Aucune pièce historique n'est réécrite pour intégrer ces décisions.

Les demandes ultérieures CR-004 à CR-007 précisent séparément le compte cible, le partage manuel Drive, l'arborescence `Holbies Meet Tracker/AAAA/MM - Mois/` et le nom de rapport `{nom de réunion} - JJ/MM/AAAA`. Les détails et empreintes sont archivés avec leurs [demandes](project-management/cahier-des-charges/holbies-meet-tracker/).

La [CR-013](project-management/cahier-des-charges/holbies-meet-tracker/CHANGE-REQUEST-5d09b954ea2361f8273599899482bc9c68ecaf67b6fc41134733e20ec7ca28c3.md) complète QLT-004 en couvrant `popup.js`, `background.js:getToken()`, `googleJson` et les fetch Bearer directs de `syncEvent`. Le correctif est maintenant dans le checkout local; les suites simulées passent, sans nouvel scope, endpoint, dépense ni appel Google réel. La revue automatique a refusé le transfert de sources vers le dépôt GitHub public; aucune PR n'a été créée.

CR-008 est accepté au MVP : le collecteur VPS démarre deux minutes avant l'heure Agenda, même si l'extension est fermée, puis attend la fin réelle du Meet pour exporter, même si tous quittent avant. Si Sheets échoue alors que Chrome est fermé, CR-009 autorise un buffer VPS temporaire et protégé, récupéré dans la popup et purgé selon la durée fixée par l'établissement. Le worker prouvé dans le dépôt est actuellement celui de l'extension; aucun collecteur serveur autonome n'a été trouvé. CR-008 réouvre l'infrastructure minimale de CR-002; CR-003 reste Post-MVP pour les réunions auxquelles le mentor ne participe pas. L'authentification serveur, l'accès Google, la readiness, la sécurité, la rétention et le coût zéro bloquent encore l'implémentation/l'activation. Voir [CR-008](project-management/cahier-des-charges/holbies-meet-tracker/CHANGE-REQUEST-63fb0fedc5c73c99d8b20e22899f11452c6757ac4a4b10a41c79b0b024104cbc.md).

Le [journal des décisions](delivery/decision-log.md) et la [cible d'export](design/sheets-export.md) décrivent l'écart entre la cible MVP automatique et l'implémentation actuelle à action manuelle. CR-004 limite les rapports au compte Google connecté et exclut les rapports inter-mentors. L'utilisateur confirme que ce compte doit couvrir les réunions auxquelles il participe même si un autre mentor les organise. Une voie documentée est de récupérer `activeConference.conferenceRecord` avec `spaces.get` pendant la réunion, puis lire le record connu. Le scope Meet existe au manifeste, mais l'accès d'un principal VPS aux réunions d'un participant non-organisateur n'a pas été vérifié. CR-008 demande au job serveur de capturer l'ID avant la fin, indépendamment de l'extension. L'autorisation serveur, la disponibilité du scheduler et la réconciliation après un job manqué restent à concevoir et gardent la couverture globale ouverte. La finalité reste une hypothèse non approuvée et toute activation est suspendue. Une proposition de limitation au registre factuel de présence et au signalement des absences n'a pas été acceptée comme approbation; aucune certification de conformité n'est revendiquée. L'utilisateur exige zéro frais et a choisi de différer l'automatisation sans plafond partagé démontré. Les règles de rétention administrée et de réconciliation Drive en cas d'issue incertaine sont documentées, non implémentées. Voir [CR-004](project-management/cahier-des-charges/holbies-meet-tracker/CHANGE-REQUEST-70f0e312829f61417afdf27fb6e11a312da1177d3a7638ceed0d72322a899d08.md).

## Documents de conception

- [Stories et critères d'acceptation](product/user-stories.md)
- [Architecture](design/architecture.md), [modèle de données](design/data-model.md) et [contrats API](design/api-contracts.md)
- [Diagrammes as-built et cible](diagrams/README.md); les éléments cibles sont des propositions non implémentées et non approuvées
- [Roadmap et critères de sortie](delivery/roadmap.md)

## Suivi GitHub Projects

Le manifeste local et les preuves de synchronisation sont consignés dans [GitHub Project](project-management/github-project.md). Le Project privé [Holbies Meet Tracker, #4](https://github.com/orgs/Krapaud-Labs/projects/4) est relié au dépôt; ses 14 Issues ont été créées puis relues. Les Issues consignent tâches, critères et preuves attendues à des niveaux de détail différents; chaque clôture doit être étayée par les preuves de l’Issue concernée. Le Project a une unique vue Kanban (`BOARD_LAYOUT`) regroupée par `Status`; labels de phase et domaine visibles sur les cartes. Les Issues ouvertes contiennent des objectifs, checklists, critères d’acceptation, preuves attendues et définitions de clôture.

## Audit de reprise

Les résultats d'audit du 2026-10-23, les contrôles exécutés et les limites constatées sont consignés dans [l'audit de reprise](quality/project-recovery-audit.md).

Le [journal qualité](quality/quality-journal.md) consigne aussi une proposition de conception QA/CI limitée aux comportements as-built et à des doubles locaux. Cette proposition n'approuve pas la readiness globale et ne permet pas d'ignorer le preflight.

La [readiness de conception](design/design-readiness.md) est approuvée; le preflight obligatoire reste à passer avant l'implémentation et l'activation demeure suspendue. CR-004 limite les rapports au compte connecté mais inclut les réunions auxquelles il participe même si un autre mentor les organise. `spaces.get` puis `conferenceRecords.get` est une piste pour trouver le record pendant la réunion; son accès avec un compte participant non-organisateur reste à prouver. La finalité demeure une hypothèse non approuvée et le quota partagé sans frais n'est pas démontré. CR-009 choisit un buffer VPS protégé pour le rapport de repli lorsque Chrome est fermé et Sheets échoue; la durée est fixée par l'établissement, avec récupération authentifiée et purge. Ces contrôles restent à concevoir. Les choix autorisent la conception du scope `openid`, sans ajouter ce scope à l'extension ni activer l'intégration. Pour le work item QA/CI, les tests ciblent l'export manuel as-built avec doubles locaux; la CI cible pull-request-only. Les étapes du work item QLT-003/004 restent conditionnées au preflight.

## Parcours principal

Le parcours actuellement documenté est : connexion Google explicite, lecture des événements Agenda, sélection d'un événement Meet, lecture complète des pages de participants et de sessions après la fin réelle de la conférence, calcul d'un statut, puis export consenti manuel vers une nouvelle feuille Sheets ou un CSV local. Les identités sont rapprochées uniquement par e-mail complet comparable. Les identités non résolues restent « à vérifier », ne sont pas comptées présentes ou absentes et produisent un rapport PARTIEL visible après collecte complète. Une collecte incomplète bloque l'export. Les tests sont simulés et ne prouvent pas l'accès Google réel.

La pagination Agenda et Meet est bornée à 100 pages, avec validation des jetons et rejet des boucles. Les valeurs OAuth invalides sont refusées avant réseau. Le CSV neutralise les cellules susceptibles d'être interprétées comme formules de tableur.
