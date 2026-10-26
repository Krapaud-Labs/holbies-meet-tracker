---
title: Suivi du projet dans GitHub Projects
status: review
last_updated: 2026-10-26
category: project-management
---

# GitHub Project

## Configuration

| Champ | Valeur |
|---|---|
| Système de suivi | GitHub Projects uniquement |
| Dépôt cible | `Krapaud-Labs/holbies-meet-tracker` |
| État de synchronisation | `verified` |
| Project ID / URL | `PVT_kwDOE_HAeM4Boa_z` / [Holbies Meet Tracker, #4](https://github.com/orgs/Krapaud-Labs/projects/4) |
| Visibilité | Privée, relue à distance |
| Trello | Désactivé, décision utilisateur antérieure réutilisée |

Le choix de l'utilisateur « On utilise uniquement GitHub Projects » active ce suivi.

La liste de l'organisation ne contenait aucun project Holbies Meet Tracker. Le Project privé #4 a été créé, relié au dépôt et relu après écriture. Le Project contient 19 Issues; leur statut Kanban a été relu le 2026-10-26. L’Issue DEC-001 (#120) est fermée, mais son item du Project est encore en `Review`; les autres statuts sont indiqués dans le tableau et doivent rester fondés sur leurs preuves.

## Configuration du Project distant

- Une seule vue existe : `Kanban`, disposition `BOARD_LAYOUT`, colonnes `Todo`, `In Progress` et `Done` pilotées par `Status`. Les cartes affichent aussi les labels pour voir immédiatement MVP/Post-MVP et les domaines; les titres, assignés, PR liées et progression des sous-issues restent les autres champs visibles. Le corps de chaque Issue ouverte contient objectif, décision, dépendances, checklist, critères, preuves et Definition of Done. Relecture UI/GraphQL : vue `PVTV_lADOE_HAeM4Boa_zzgMNSq0`.
- Champs présents après relecture : `Title`, `Assignees`, `Status`, `Labels`, `Linked pull requests`, `Milestone`, `Repository`, `Reviewers`, `Parent issue`, `Sub-issues progress`, `Created`, `Updated`, `Closed`.
- Labels : `MVP`, `Post-MVP`, `Needs-decision`, `Audit`, `Security`, `Documentation`, `Accessibility`, `Operations`.
- Les Issues synchronisées portent des tâches, des critères et des preuves attendues à des niveaux de détail différents; les exigences de clôture doivent être vérifiées sur chaque Issue.
- Une demande de changement reste `Needs-decision` jusqu'à arbitrage MVP/Post-MVP ou rejet.

## Issues synchronisées et relues

Les Issues sont reliées au Project #4. Le classement des demandes de changement suit les décisions explicites du 2026-10-23.

| ID stable | Titre | Classement | Dépendances | Statut |
|---|---|---|---|---|
| DEC-001 | Baseline reconstituée non certifiée | Baseline de travail acceptée seulement | Aucune | [#120](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/120), Issue fermée; Project `Review`; authenticité et hash original non certifiés |
| CR-001 | Export Sheets automatique | MVP accepté | DEC-001 | [#121](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/121), Todo; consentement et scopes à concevoir |
| CR-002 | Backend et persistance serveur | Post-MVP accepté | DEC-001 | [#122](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/122), Todo; garde rétention/sécurité avant livraison |
| CR-003 | Suivi en arrière-plan sans mentor | Post-MVP accepté | CR-002 | [#123](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/123), Todo; aucune collecte autonome au MVP |
| MVP-001 | Preuves des flux Google et règles de présence | MVP, candidat historique | DEC-001; CR-001 pour Sheets | [#124](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/124), Todo; APIs réelles et pagination Meet à prouver |
| POST-MVP-001 | Rétention et suppression serveur | Post-MVP, conditionnel à CR-002 | CR-002 | [#125](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/125), Todo |
| POST-MVP-002 | Authentification du webhook Google | Post-MVP, conditionnel à CR-002 | CR-002 | [#126](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/126), Todo |
| POST-MVP-003 | Sécurité du compose backend | Post-MVP, conditionnel à CR-002 | CR-002 | [#127](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/127), Todo |
| POST-MVP-004 | Reproductibilité et chaîne CI backend | Post-MVP, conditionnel à CR-002 | CR-002 | [#128](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/128), Todo |
| QLT-001 | Clavier du dialogue Agenda | Remédiation qualité, périmètre à décider | Décision avant implémentation | [#129](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/129), Todo, `Needs-decision` |
| QLT-002 | Popup étroite et zoom élevé | Remédiation qualité, périmètre à décider | Décision avant implémentation | [#130](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/130), Todo, `Needs-decision` |
| MVP-004 | Licence de l'illustration | Précondition avant diffusion | Aucune | [#131](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/131), Todo |
| DOC-001 | Validateur documentaire et archives | Maintenance documentaire | Métadonnées compatibles avec archives immuables | [#132](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/132), In progress |

## Couverture

La reconstitution historique est archivée dans [`cahier-des-charges/holbies-meet-tracker/reconstitution-mvp-depuis-historique.md`](cahier-des-charges/holbies-meet-tracker/reconstitution-mvp-depuis-historique.md). Les décisions CR-001 à CR-003 sont séparées dans [`CHANGE-REQUEST-28a8e6521495644f0996d40e626d1dfd5a6216c7acb35c4823cce4bb2bf2652b.md`](cahier-des-charges/holbies-meet-tracker/CHANGE-REQUEST-28a8e6521495644f0996d40e626d1dfd5a6216c7acb35c4823cce4bb2bf2652b.md). La matrice distante, le lien au dépôt, la visibilité privée, les 19 Issues du Project et l’unique vue `Kanban` (`BOARD_LAYOUT`) ont été relus après synchronisation. La vue a été convertie depuis `TABLE_LAYOUT` le 2026-10-23, à la demande de l’utilisateur. Le niveau de détail des Issues varie selon leur périmètre; labels sont affichés sur les cartes, avec colonnes regroupées par statut. DOC-001 (#132) a reçu un corps détaillé et une checklist mise à jour le 2026-10-26.

## Critères et preuves de clôture des Issues synchronisées

### DEC-001 : baseline documentaire

- Décision : la demande initiale de reconstituer le cahier depuis les documents du dépôt accepte cette synthèse comme baseline de travail uniquement; elle ne certifie pas qu'il s'agit du cahier original authentique.
- Critères : provenance, dates, commits et hashes relus; brief historique immuable conservé; les limites sont explicites.
- Preuves : `PROVENANCE.md`, `RECONSTRUCTION-CANDIDATE.sha256`, historique Git et réponse de décision.
- DoD : décision écrite, baseline référencée dans le project; aucune modification de l'archive après acceptation. L'empreinte originale reste non vérifiable tant que la source originale est introuvable.

### CR-001 : export Sheets

- Décision utilisateur : cible MVP automatique conforme à la baseline reconstituée. L'implémentation doit exécuter l'export à la fin, avec réessais puis fallback local JSON/CSV.
- Dépendances : DEC-001; scopes Sheets/Drive, erreurs et politique de conservation.
- Critères : parcours, consentement, scopes, nouvelles feuilles, erreurs, réessais, CSV et cas de doublon testables et cohérents.
- Preuve attendue : décision datée liée à DEC-001; scope OAuth, parcours UI et matrice de scénarios mis à jour; tests de succès et d'échec observables.
- DoD : parcours et activation préalable sans clic par réunion, scopes et consentement explicite, erreurs/réessais/fallback alignés; tests et preuve réelle Sheets avant Done.

### CR-002 : backend et stockage serveur

- Décision utilisateur : Post-MVP.
- Dépendance : DEC-001.
- Critères : finalité, données conservées, utilisateurs pouvant y accéder, frontière de confiance, hébergement, coûts et suppression explicités.
- Preuve attendue : décision datée et conception des flux/accès/rétention mise à jour.
- DoD : reste hors MVP; avant livraison Post-MVP, critères de conservation vérifiables; plan de retrait séparé si rejet futur.

### CR-003 : suivi automatique sans présence du mentor

- Décision utilisateur : Post-MVP, dépendant du CR-002.
- Dépendances : DEC-001 et CR-002.
- Critères : finalité, activation explicite, permissions, indication aux utilisateurs/participants, limites temporelles et comportement après révocation explicités.
- Preuve attendue : décision datée et parcours/permissions/rétention mis à jour.
- DoD : reste hors MVP; avant livraison Post-MVP, tests et documentation démontrent activation, permissions et cycle de vie; plan de retrait séparé si rejet futur.

### MVP-001 : preuve des flux Google

- Critères : démontrer l'événement Agenda et ses invités, les participants/sessions Meet, la pagination, l'identité, le seuil de deux minutes et les cas inconnus/ambigus.
- Dépendance : DEC-001. Les tests d'export Sheets sont conditionnés au classement MVP de CR-001.
- Preuves : tests runtime avec environnement de test autorisé, résultats anonymisés, échec d'API et reprise documentés.
- DoD : résultats runtime probants pour chaque critère retenu, pagination, identité, seuil, inconnus/ambigus et erreurs/reprises; aucune affirmation de support d'API fondée seulement sur des mocks.

### POST-MVP-001/004 : backend sécurité et exploitation

- Critères conditionnels si le backend est retenu : TTL/suppression, contrôle OIDC du webhook, bind local et identifiants sûrs en compose de développement, versions reproductibles, analyse dépendances/secrets et moindre privilège CI.
- Dépendance : acceptation de CR-002; ces tâches restent conditionnelles et post-MVP en attendant cette décision.
- Preuves : tests de suppression et d'autorisation, configuration compose relue, build reproductible, sorties scanner et revue permissions.
- DoD : constats corrigés et re-audités avant déploiement.

### QLT-001/002 : interface, accessibilité et responsive

- Critères : gestion complète du focus modal/Tab/Escape; rendu réel à largeur réduite, zoom augmenté et texte long; aucune info essentielle tronquée.
- Dépendances : décision explicite de périmètre avant toute implémentation; la présence de ces critères dans l'audit ne les rend pas automatiquement MVP.
- Preuves : parcours clavier et captures/test navigateur sur viewport réel; tests automatiques ne suffisent pas seuls.
- DoD : classement explicite, revue indépendante QA et accessibilité, documentation des états et résultats.

### MVP-004 : média

- Critères : retrouver l'autorisation de réutilisation de `assets/holberton-seahorse.png` ou remplacer l'asset dans une demande séparée si la licence ne le permet pas.
- Dépendances : aucune.
- DoD : preuve de licence archivée ou décision écrite de retrait/remplacement; aucun asset non vérifié dans une livraison publique.

### DOC-001 : validateur documentaire

- Critères : définir quels documents doivent avoir front matter et `last_updated`; préserver octet pour octet les copies historiques et leurs hashes.
- Preuves : exécution du validateur avec sorties explicites et vérification des empreintes archivées.
- DoD : règles alignées sur les catégories documentaires; aucun document-source historique réécrit pour faire passer le contrôle.
