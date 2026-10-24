# GitHub Project

## Configuration

| Champ | Valeur |
|---|---|
| Système de suivi | GitHub Projects uniquement |
| Dépôt cible | `Krapaud-Labs/holbies-meet-tracker` |
| État de synchronisation | Project privé relu : 18 Issues existantes et 1 carte brouillon privée QLT-003/004; détails CR-008/CR-010 conservés localement |
| Project ID / URL | `PVT_kwDOE_HAeM4Boa_z` / [Holbies Meet Tracker, #4](https://github.com/orgs/Krapaud-Labs/projects/4) |
| Visibilité | Privée, relue à distance |
| Trello | Désactivé, décision utilisateur antérieure réutilisée |

Le choix de l'utilisateur « On utilise uniquement GitHub Projects » active ce suivi.

La liste de l'organisation ne contenait aucun project Holbies Meet Tracker. Le Project privé #4 a été créé, relié au dépôt et relu après écriture. La relecture courante confirme 18 Issues et une carte brouillon QLT-003/004; `DEC-001` est clôturée et marquée `Done`, les autres Issues restent ouvertes selon leurs décisions et preuves.

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
| DEC-001 | Baseline reconstituée non certifiée | Baseline de travail acceptée seulement | Aucune | [#120](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/120), clôturée; authenticité et hash original non certifiés |
| CR-001 | Export Sheets automatique | MVP accepté | DEC-001 | [#121](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/121), Todo; activation, compte/destination, non-partage, OpenID design et fallback local jusqu'à réouverture décidés; CR-004 inclut les réunions rejointes même organisées par un tiers, sans rapport inter-mentors; voie documentée `spaces.get` puis record connu à vérifier pour le participant; capture impossible si extension/appareil indisponible durant tout l'appel, garantie de toutes réunions non prouvée; finalité et zéro frais partagé bloquent l'activation |
| CR-004 | Limiter les rapports au compte connecté | MVP accepté | CR-001 | [#137](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/137), Todo; compte connecté seulement; les réunions organisées par un autre mentor sont incluses si ce compte y participe; voie plausible via `spaces.get` pendant l'appel puis `conferenceRecords.get`; capture, droits invité et limitation hors ligne à arbitrer, aucun rapport inter-mentors |
| CR-005 | Partage manuel du dossier Drive | MVP accepté | CR-001; CR-004 | [#138](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/138), Todo; partage via Google Drive par le propriétaire, sans opération de partage automatique de l'extension |
| CR-006 | Classement Drive par année et mois | MVP accepté | CR-001; CR-004; CR-005 | [#139](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/139), Todo; `Holbies Meet Tracker/AAAA/MM - Mois/`; la règle de nommage de fichier est précisée par CR-007 |
| CR-007 | Nommer les rapports par réunion et date | MVP accepté | CR-001; CR-004; CR-006 | [#140](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/140), Todo; `{nom de réunion} - JJ/MM/AAAA`, année quatre chiffres, suffixe anti-collision; finalité et coût zéro restent des gates |
| CR-002 | Backend et persistance serveur | Post-MVP accepté | DEC-001 | [#122](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/122), Todo; garde rétention/sécurité avant livraison |
| CR-003 | Suivi en arrière-plan sans mentor | Post-MVP accepté | CR-002 | [#123](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/123), Todo; aucune collecte autonome au MVP |
| MVP-BOUNDARY-001 | Désactiver le suivi CR-003 avant le MVP | Remédiation obligatoire avant livraison MVP; CR-002 et CR-003 restent Post-MVP | CR-002; CR-003; revue et readiness de conception | [#135](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/135), Todo; proposition: retirer l'alarme de fond et l'auto-démarrage backend, conserver l'analyse et les exports locaux; attente des arbitrages design CR-001 puis approbation indépendante |
| MVP-001 | Preuves des flux Google et règles de présence | MVP, candidat historique | DEC-001; CR-001 pour Sheets | [#124](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/124), Todo; APIs réelles et pagination Meet à prouver |
| POST-MVP-001 | Rétention et suppression serveur | Post-MVP, conditionnel à CR-002 | CR-002 | [#125](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/125), Todo |
| POST-MVP-002 | Authentification du webhook Google | Post-MVP, conditionnel à CR-002 | CR-002 | [#126](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/126), Todo |
| POST-MVP-003 | Sécurité du compose backend | Post-MVP, conditionnel à CR-002 | CR-002 | [#127](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/127), Todo |
| POST-MVP-004 | Reproductibilité et chaîne CI backend | Post-MVP, conditionnel à CR-002 | CR-002 | [#128](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/128), Todo |
| QLT-001 | Clavier du dialogue Agenda | Remédiation qualité, périmètre à décider | Décision avant implémentation | [#129](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/129), Todo, `Needs-decision`; parcours Tab de l'état déconnecté observé, dialogue et trap de focus restent à vérifier |
| QLT-002 | Popup étroite et zoom élevé | Remédiation qualité, périmètre à décider | Décision avant implémentation | [#130](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/130), Todo, `Needs-decision`; CSS fixe 720px empêche le breakpoint 680px, preuve persistée à produire |
| QLT-003/004 | Fiabiliser les rapports de présence | Corrections MVP acceptées; rapport PARTIEL permis après collecte complète | Identité incertaine, complétude de collecte, revue QA/Sécurité | Carte brouillon privée `PVTI_lADOE_HAeM4Boa_zzhDROgI`, `In Progress`; aucun détail OAuth/API dans une Issue publique |
| MVP-004 | Licence de l'illustration | Précondition avant diffusion | Aucune | [#131](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/131), Todo |
| DOC-001 | Validateur documentaire et archives | Maintenance documentaire | Métadonnées compatibles avec archives immuables | [#132](https://github.com/Krapaud-Labs/holbies-meet-tracker/issues/132), Todo |
| CR-008 | Collecte VPS autonome pour rapport planifié | MVP accepté, détails sensibles locaux | CR-001; réouverture partielle CR-002 | Pas d'Issue publique créée ni de détail synchronisé; CR-010 précise localement les conditions de sécurité, couverture fiable et fenêtre tardive |

## Couverture

La reconstitution historique est archivée dans [`cahier-des-charges/holbies-meet-tracker/reconstitution-mvp-depuis-historique.md`](cahier-des-charges/holbies-meet-tracker/reconstitution-mvp-depuis-historique.md). Les décisions CR-001 à CR-003 sont séparées dans [`CHANGE-REQUEST-28a8e6521495644f0996d40e626d1dfd5a6216c7acb35c4823cce4bb2bf2652b.md`](cahier-des-charges/holbies-meet-tracker/CHANGE-REQUEST-28a8e6521495644f0996d40e626d1dfd5a6216c7acb35c4823cce4bb2bf2652b.md). La relecture courante confirme la visibilité privée, les 18 Issues, la carte brouillon QLT-003/004 et l’unique vue `Kanban` (`BOARD_LAYOUT`). Les labels sont affichés sur les cartes, avec colonnes regroupées par statut.

## Critères et preuves de clôture des Issues synchronisées

### DEC-001 : baseline documentaire

- Décision : la demande initiale de reconstituer le cahier depuis les documents du dépôt accepte cette synthèse comme baseline de travail uniquement; elle ne certifie pas qu'il s'agit du cahier original authentique.
- Critères : provenance, dates, commits et hashes relus; brief historique immuable conservé; les limites sont explicites.
- Preuves : `PROVENANCE.md`, `RECONSTRUCTION-CANDIDATE.sha256`, historique Git et réponse de décision.
- DoD : décision écrite, baseline référencée dans le project; aucune modification de l'archive après acceptation. L'empreinte originale reste non vérifiable tant que la source originale est introuvable.

### CR-001 : export Sheets

- Décision utilisateur : cible MVP automatique conforme à la baseline reconstituée. L'implémentation doit exécuter l'export à la fin, avec réessais puis fallback local JSON/CSV.
- CR-004 limite les rapports au compte connecté et exclut les rapports inter-mentors; l'utilisateur confirme aussi l'inclusion des réunions organisées par un tiers si ce compte y participe. La convention `conferenceRecords.list` documentée organizer-only est une limite de cette méthode, pas une exclusion de périmètre. Une piste est de lire `activeConference.conferenceRecord` via `spaces.get` pendant la réunion, puis le record connu avec `conferenceRecords.get`; l'accès pour un participant non-organisateur reste à prouver et cette piste n'est ni approuvée ni implémentée. La finalité reste non approuvée et le coût zéro sans plafond partagé reste à démontrer; l'activation est suspendue. Avant présence confirmée, la vérification candidate limite les champs Meet, ne persiste aucun non-match et n'appelle pas le backend. Cette vérification d'éligibilité est distincte du suivi complet CR-003, qui reste Post-MVP.
- Décisions utilisateur 2026-10-23 : activation globale explicite désactivée par défaut; scopes Sheets/Drive et `openid` à demander à l'activation; compte connecté affiché, dossier fixe, aucun partage ni effacement automatique des feuilles; fallback local conservé jusqu'à la prochaine ouverture, avec action explicite de téléchargement ou suppression; l'établissement fixe la durée avant usage.
- Dépendances : DEC-001; preuve de correspondance d'identité Meet/OpenID, erreurs et reprises, événement de fin, durée institutionnelle avant activation et accès à un compte de test autorisé.
- Critères : parcours, consentement, scopes, nouvelles feuilles, erreurs, réessais, CSV et cas de doublon testables et cohérents.
- Preuve attendue : décision datée liée à DEC-001; scope OAuth, parcours UI et matrice de scénarios mis à jour; tests de succès et d'échec observables; preuve réelle d'écriture sur compte de test autorisé.
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

### MVP-BOUNDARY-001 : désactivation pré-MVP

- Décision utilisateur : désactiver le suivi CR-003 avant toute livraison MVP, dans un work item séparé.
- Distinction : #123 suit la capacité de suivi sans mentor Post-MVP; #135 suit une remédiation préalable à la livraison MVP, car l'alarme existe déjà dans le produit. Ce ne sont pas deux cartes pour la même livraison.
- Dépendances : frontière Post-MVP de CR-002/CR-003; conception et readiness approuvées avant toute modification produit.
- Proposition de frontière mise à jour après décision utilisateur du 2026-10-23 : remplacer le worker général qui synchronise tous les participants sans condition par une vérification limitée à l'identifiant du mentor dans les agendas suivis; ne conserver aucune donnée avant présence confirmée. Désactiver le démarrage automatique du backend live après analyse popup; conserver l'analyse Meet locale et l'export Sheets automatique CR-001.
- DoD : aucune collecte ou persistance du roster complet sans mentor, aucun démarrage backend automatique en MVP; vérification minimale d'éligibilité sans données persistées avant match; analyse/exports conservés et vérifiés; aucun effacement de données existantes; documentation et preuves indépendamment revues.

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

### QLT-003 : collisions d'identité dans la déduplication

- Constat local : des noms normalisés identiques peuvent fusionner des identifiants étudiant ou e-mails explicitement différents; une fusion transitive peut propager l'ambiguïté. Le backend applique un motif similaire.
- Périmètre accepté via CR-011 : association uniquement par e-mail complet normalisé identique; aucun rapprochement par nom, alias ou identifiant provider. Les conflits, candidats ambigus et données incomplètes restent « à vérifier »; tests de collision/permutation dans l'extension et le backend.
- Classement : correction produit MVP acceptée par CR-011; conception en revue et code non commencé. Détails locaux dans le work item `2026-10-24-qlt-003-004-remediation`.
- Synchronisation : conservé localement jusqu'à décision de publication; la recherche distante en lecture seule n'a trouvé aucune Issue dédiée.

### QLT-004 : validation fail-closed de la session OAuth Sheets

- Constat local : `null`, `undefined`, une session sans propriété `token` ou une valeur falsy peut conduire l'export à envoyer une requête avec un en-tête Bearer invalide.
- Périmètre accepté via CR-012 : valider une chaîne non blanche avant état connecté ou requête Google; invalide signifie zéro requête, token précédent préservé et CSV de secours.
- Classement : correction produit MVP acceptée par CR-012; conception en revue et code non commencé. Détails locaux dans le work item `2026-10-24-qlt-003-004-remediation`.
- Synchronisation : conservé localement jusqu'à décision de publication; la recherche distante en lecture seule n'a trouvé aucune Issue dédiée.

### MVP-004 : média

- Critères : retrouver l'autorisation de réutilisation de `assets/holberton-seahorse.png` ou remplacer l'asset dans une demande séparée si la licence ne le permet pas.
- Dépendances : aucune.
- DoD : preuve de licence archivée ou décision écrite de retrait/remplacement; aucun asset non vérifié dans une livraison publique.

### DOC-001 : validateur documentaire

- Critères : définir quels documents doivent avoir front matter et `last_updated`; préserver octet pour octet les copies historiques et leurs hashes.
- Preuves : exécution du validateur avec sorties explicites et vérification des empreintes archivées.
- DoD : règles alignées sur les catégories documentaires; aucun document-source historique réécrit pour faire passer le contrôle.
