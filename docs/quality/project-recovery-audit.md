# Audit de reprise et d'initialisation

Date : 2026-10-23
Branche observée : `fix/audit-clean`, synchronisée avec `origin/fix/audit-clean` au démarrage.
Périmètre : provenance MVP, extension Chrome, backend, sécurité, tests, UX/accessibilité, CI et exploitation. Audit en lecture seule; aucun code produit n'a été modifié.

## Synthèse

Les tests automatisés locaux passent, mais ils ne prouvent pas l'intégration réelle à Chrome/Google ni l'alignement du produit avec le MVP historique reconstitué. L'empreinte originale du cahier reste absente. Les décisions utilisateur du 2026-10-23 classent l'export automatique Sheets (CR-001) dans le MVP, le backend/persistance (CR-002) et le suivi autonome (CR-003) en Post-MVP. Le Project privé #4 est maintenant relié au dépôt et contient 14 Issues relues; #123 suit CR-003 Post-MVP et #135 suit sa désactivation avant livraison MVP.

## Preuves exécutées

| Contrôle | Résultat observé | Limite |
|---|---|---|
| `node --test tests/*.test.js` | 18/18 réussis | Scénarios simulés; pas d'instance Chrome/Google réelle |
| `npm test` dans `backend/` | 23/23 réussis | Auth et base principalement simulées; pas d'E2E runtime PostgreSQL |
| `node --check popup.js && node --check attendance.js` | Réussi | Syntaxe seulement |
| `python3 -m json.tool manifest.json` | Réussi | Valide la syntaxe, pas l'étendue appropriée des permissions |
| `git diff --check` | Réussi au moment du contrôle | Contrôle d'espaces uniquement |
| Validateur documentaire du projet | Échec : 58 avertissements d'absence de front matter et `last_updated` parmi 29 fichiers Markdown | La règle s'applique également aux copies historiques immuables; aucun fichier archive n'a été modifié pour satisfaire ce validateur générique. DOC-001 est inscrit au manifeste local pour corriger la politique du contrôle. |
| `npm --prefix backend ls --depth=0` | `pg@8.23.1`, `ws@8.22.0` installés | État local courant seulement |
| Connecteur GitHub `get_repo` | Dépôt `Krapaud-Labs/holbies-meet-tracker` trouvé; droits admin/push; défaut `main` | Le connecteur n'expose aucune opération GitHub Projects |
| GitHub Project V2 | Project #4 privé, relié au dépôt; 14 Issues lues; DEC-001 terminée et marquée Done | Les 13 autres Issues restent ouvertes selon leurs preuves et décisions |

## Constats par domaine

### Cahier et périmètre

- Aucun `ORIGINAL-MVP-BRIEF.sha256` antérieur n'existe dans l'historique Git accessible. La reconstitution fondée sur `d890828` est marquée non certifiée; son hash candidat vérifie uniquement le fichier reconstitué.
- Les documents ultérieurs rendent l'export Sheets volontaire, ajoutent un backend PostgreSQL et un suivi automatique même quand le mentor ne rejoint pas Meet. Le 2026-10-23, l'utilisateur a accepté l'export automatique en cible MVP et classé le backend ainsi que le suivi autonome Post-MVP. Le code actuel reste divergent de la cible CR-001.
- Relecture de `background.js` pendant la conception du work item QA/CI : l'alarme périodique est créée à l'installation et au démarrage, puis les événements de l'agenda principal sont suivis et synchronisés au backend sans preuve que le mentor a rejoint Meet. La première requête backend transmet le code Meet, l'horaire et les invités; le backend lit ce corps avant de vérifier le domaine du mentor. Cette implémentation as-built réalise donc un comportement CR-003 classé Post-MVP et transmet des données avant le contrôle de domaine. Aucune correction produit n'est incluse dans le work item courant; la revue indépendante recommande de rétablir cette frontière avant toute livraison MVP.
- La référence Meet documente `ConferenceRecord.endTime` pour les conférences passées, sa suppression 30 jours après la fin, et `ParticipantSession.endTime` lorsqu'une session se termine. Elle ne décrit pas d'adresse e-mail dans `Participant.signedinUser`, qui fournit un identifiant et un nom. La correspondance de l'utilisateur courant avec un participant, et la disponibilité de toutes les pages après la fin, restent à prouver sur compte de test autorisé.
- `docs/design/design-readiness.md` est désormais `review`, car son approbation antérieure ne couvrait pas ces questions de périmètre et de provenance.
- Après revue, les documents de vision, roadmap, flux Meet, export, architecture et sécurité portent maintenant un statut explicite : périmètre proposé ou comportement as-built en attente d'arbitrage; le rendu clavier et responsive reste non vérifié.

### Fonctionnel et qualité

- Couverture positive : seuil de retard de deux minutes, statuts d'attente, sessions/reconnexions, déduplication d'identité, filtrage calendrier, cycle background simulé, snapshots, fermeture et contrats WebSocket.
- Défaut de déduplication confirmé en revue statique indépendante : `attendance.js:13-20,23-38,41-60` donne priorité à la clé de nom normalisée et fusionne les lignes au premier recouvrement, sans refuser des e-mails ou identifiants étudiants explicites contradictoires. Contre-exemple synthétique : `Test Person / 12001@holbertonstudents.com` et `Test Person / 12002@holbertonstudents.com` partagent `name:test person` et deviennent une seule ligne. Une troisième ligne associée à l'un de ces IDs peut ensuite rejoindre le groupe par fermeture transitive; l'identité retenue peut varier avec l'ordre et le statut des lignes. Le backend présente le même risque (`backend/src/live.js:39-55,63-76`). Les tests actuels ne couvrent que des alias présumés équivalents (`tests/attendance.test.js:16-35`, `backend/test/live.test.js:143-170`), sans IDs distincts sous le même nom ni permutation d'ordre. Correction de produit hors du work item QA/CI courant : exiger l'absence de conflit d'identifiants forts avant fusion; marquer tout pont ambigu « à vérifier »; ajouter des cas de collision, transitivité et permutation dans un work item séparé. Aucun code ni test n'a été modifié ou exécuté pour ce constat.
- Défaut d'authentification d'export à traiter séparément : `normalizeAuthSession` (`popup.js:1025-1027`) accepte `null`/`undefined` ou un objet sans propriété `token`; `exportAttendanceToSheets` (`:493-498`) affecte alors `undefined` à `currentAccessToken` et envoie quand même le `POST` de création avec `Authorization: Bearer undefined`. Une chaîne vide envoie `Authorization: Bearer `. Le plan QA/CI courant doit caractériser ces comportements as-built, sans correction produit ni affirmation qu'une session sans token est refusée avant réseau. Un work item produit séparé devra décider et vérifier l'arrêt fermé avant toute requête si l'authentification interactive ne fournit pas un token non vide. Aucun test ni appel réseau n'a été lancé pour ce constat.
- Non vérifié en conditions réelles : détection d'événement depuis une réunion réellement rejointe, disponibilité/pagination des API Meet, écriture Sheets et reprises/CSV en cas de panne, comptes OAuth, Chrome, Postgres, WebSocket réseau, accessibilité avec lecteur d'écran et affichage à zoom/viewport réels.
- Tests Sheets/WebSocket partiellement statiques; absence de preuve de couverture statistique et d'E2E complet.

### Interface et accessibilité

- `popup.css` impose une largeur de 720 px; des media queries plus étroites n'annulent pas cette largeur minimale. Le test de layout fixe vérifie le choix CSS, mais pas le rendu en fenêtre étroite ou zoom fort.
- Le sélecteur Agenda annonce un dialogue modal, mais le focus n'est pas confiné hors du dialogue.
- Les libellés et retours textuels sont présents; aucune revue navigateur ou lecteur d'écran actuelle ne prouve l'accessibilité complète.

### Sécurité et exploitation

| Priorité | Constat | Preuve principale | Dépendance / traitement |
|---|---|---|---|
| Élevée | Les sessions, identités et événements PostgreSQL n'ont pas de suppression/TTL identifiée. | `backend/schema.sql`, `backend/src/database.js:19-23,63-68` | À définir avant la livraison Post-MVP du backend/persistance (CR-002). |
| Élevée | Le webhook valide un secret partagé; aucun contrôle OIDC/Pub/Sub n'est visible dans le dépôt. | `backend/src/server.js:240-246`, `docs/operations/google-events-pubsub.md:14-15` | Si backend conservé, authentifier l'émetteur et l'audience; le relais externe reste inconnu. |
| Moyenne/élevée | Compose de développement expose `8080` sur toutes interfaces et utilise les identifiants PostgreSQL `holbies/holbies`. | `backend/docker-compose.yml:2-18` | Limiter aux usages locaux et supprimer les identifiants triviaux si compose conservé. |
| Moyenne | Images `latest` et tags flottants; actions CI non épinglées partout; aucun scan de dépendances/secrets dans le workflow principal. | `backend/docker-compose.production.yml:2-5,26`, `backend/Dockerfile:1`, `.github/workflows/validate.yml:16-47` | À classer après arbitrage backend; vérifier règles de branche séparément. |
| Moyenne | Scopes Sheets/Drive documentés à la demande, absents du manifeste fixe; vérifier le parcours réel de consentement et le libellé utilisateur. | `manifest.json:20-27`, `docs/design/oauth-flow.md:16-25` | Aligner documentation et code; confirmer tests comportementaux. |
| Moyenne | `tabs`, `alarms`, stockage local et hôte de tunnel temporaire élargissent la surface du client. | `manifest.json:6-18`, `background.js:155-185` | Le suivi autonome est classé Post-MVP (CR-003); revoir permissions et besoin avant sa livraison. |
| À traiter | Origine/licence de `assets/holberton-seahorse.png` mentionnée dans la documentation, licence de réutilisation non établie dans le dépôt. | `docs/design/visual-direction.md`, `assets/holberton-seahorse.png` | Établir la licence avant diffusion publique. |

Les vérifications locales n'ont affiché ni secret réel ni jeton. L'absence de secret dans les fichiers inspectés ne prouve pas l'absence de secrets dans l'historique complet ou les environnements distants. Aucun service Cloud n'a été activé ou lancé.

## Issues synchronisées

Les Issues publiées indiquées par un numéro dans [le manifeste GitHub Project](../project-management/github-project.md) ont été synchronisées et relues dans le Project distant. Les éléments marqués « local seulement » (notamment CR-008/CR-010 et QLT-003/QLT-004) n'y sont pas publiés. Les décisions utilisateur séparent les demandes hors cahier; les constats de qualité non arbitrés restent à décider avant implémentation.

## Limites et suite

- Aucune CI distante, règle de protection, déploiement VPS ou compte Google de test n'a été interrogé dans cet audit.
- Le Project distant est créé, relié au dépôt et relu; les 13 Issues initiales et la carte #135 de frontière MVP sont synchronisées.
- Les classements CR-001 à CR-003 sont décidés. L'autorisation préalable et les détails cibles de l'export CR-001 sont documentés depuis le 2026-10-23; leur approbation, la preuve d'identité, la durée institutionnelle concrète et l'intégration réelle restent ouvertes. L'empreinte originale du cahier reste à retrouver si elle existe hors du dépôt.

## Relecture QA/CI du work item de remédiation

Cette relecture documentaire ne lance pas les tests et ne modifie ni le workflow ni le code produit, car la readiness design reste `review` et la porte design-first s'applique aux tests et à la configuration CI.

- `.github/workflows/validate.yml` lance `node tests/attendance.test.js`, et non la commande locale complète `node --test tests/*.test.js` documentée dans le README. Les contrôles backend et la construction Docker restent présents dans le workflow.
- Les déclencheurs actuels couvrent les pushes sur `dev`/`main` et les PR vers `dev`/`main`; ce chevauchement pourrait produire des validations doubles selon le flux de fusion, mais aucun run précis n'a été vérifié. Les actions `checkout` et `setup-node` sont référencées par tags, sans SHA complet, et aucune concurrence n'annule les exécutions obsolètes.
- Au moment de cette mise à jour, le profil local ignoré `.codex/project-profile.toml` indique `pull-request-only`, décision explicite de l'utilisateur. Le workflow versionné conserve encore `push` et `pull_request`; aucun run précis en double n'a été établi. La synchronisation du profil ne modifie pas le workflow.
- `tests/report-html.test.js` vérifie statiquement les fragments de structure et la présence des appels d'export Drive. Les revues locales QA identifient l'absence de tests comportementaux pour les transformations CSV, les réessais, les succès/échecs Sheets et le fallback local.
- Le work item interdit la modification de `popup.js` et du comportement produit. Si les tests robustes exigent une extraction de module, cette dépendance doit être classée et arbitrée séparément; elle ne peut être introduite implicitement comme simple test.
- Aucun test n'a été exécuté pendant cette relecture et aucune modification CI/test n'est présentée comme achevée. Les corrections de documentation et la résolution du design-gate restent les prochaines étapes.
- Aucun workflow distant n'a été lancé et aucun coût/quota n'a été vérifié dans cette relecture; la gratuité ne doit pas être présumée avant un futur déclenchement.

## Reprise du work item QA : présence, doublons et export

Relecture effectuée le 2026-10-23 à partir du work item `2026-10-23-qa-ci-export-remediation`, de son registre d'obligations, de `RUNTIME-STATE.md`, de la readiness et des demandes de changement archivées. Le Goal natif `01a1696e-11fa-7532-86d4-0487ac26107d` est actif. L'empreinte originale `ORIGINAL-MVP-BRIEF.sha256` reste absente; l'empreinte candidate de la reconstruction est vérifiée, mais ne prouve pas l'authenticité de l'original.

### Décision de portée

| Sujet | Décision actuelle | Travail autorisé dans le work item QA/CI |
|---|---|---|
| Liste de présence et déduplication | `tests/attendance.test.js:6-12` couvre l'agrégation de plusieurs sessions (première arrivée, dernier départ); `:16-35` couvre la fusion de quelques alias et la priorité du statut; `:37-45` couvre le seuil de deux minutes. `attendance.js:41-65` réalise la fusion, appelée avant affichage/export par `popup.js:736-738,766`. Ces exemples ne couvrent ni toutes les collisions d'identité, ni la pagination Meet, ni les doublons de fichier ou la reprise après crash. | Documenter les limites observées. Les tests locaux de l'export manuel restent interdits avant approbation du design-gate et preflight vert. Ne pas présenter ces tests comme preuve de l'export automatique CR-001. |
| Doublons de fichiers d'export | `tests/report-html.test.js:27-30` vérifie seulement la présence de fragments Drive. `popup.js:486-515` exécute un `POST /v4/spreadsheets` à chaque export et le bouton devient « Exporter à nouveau » après succès; aucun identifiant d'opération ni rapprochement n'est appliqué dans ce chemin as-built. Une répétition manuelle peut donc créer un autre fichier. | Enregistrer ce constat pour CR-001. Ne pas implémenter l'idempotence ni ajouter/faire tourner des tests export dans ce work item tant que la porte de conception reste fermée. |
| Export Sheets | CR-001 vise un export automatique MVP, mais l'implémentation observée reste manuelle et nomme actuellement les fichiers `Présences Meet - <date locale>` (`popup.js:495-499`). CR-004 limite les rapports au compte connecté et inclut les réunions rejointes organisées par d'autres mentors; la couverture technique reste à prouver. CR-005 autorise le partage humain dans Drive; CR-006 fixe l'arborescence annuelle/mensuelle; CR-007 définit le nom réunion-date. | Les documents de périmètre et d'audit peuvent refléter ces décisions et distinguer la cible du comportement actuel. Aucun changement de code produit ou interaction Google n'est autorisé ici. |
| CR-002 / backend | Post-MVP pour le backend live général; CR-008 réouvre au MVP le collecteur VPS minimal pour rapports planifiés. | Ce work item QA/CI reste documentaire et n'implémente aucun backend. Le work item produit CR-008 dépend d'une readiness approuvée et de preuves auth, quota, sécurité et rétention. |
| CR-003 / polling sans mentor | Classé Post-MVP; l'utilisateur a explicitement demandé de le désactiver avant livraison MVP dans un travail séparé. | Créer ou poursuivre uniquement le suivi séparé. Ne pas intégrer ce correctif au work item QA/CI. |
| CR-008 / collecte planifiée VPS | MVP accepté : démarrage deux minutes avant Agenda, collecte même extension fermée, export après fin réelle même si tous ont quitté. | Documenter le besoin et les gates seulement. Le dépôt prouve le worker Chrome `background.js` et les snapshots vers VPS, pas un worker serveur autonome; aucun test ni appel Google/Cloud dans ce work item. |
| Tests et workflow | `.codex/policies/DESIGN-FIRST-GATE.md` interdit l'implémentation tant que la readiness n'est pas `approved`, toutes ses cases prouvées et le preflight passé. La readiness courante est `review`. | Corrections documentaires strictement factuelles et relecture indépendante. Aucun test, modification de workflow, commit de livraison ou PR avant levée vérifiée de la porte. |

Clarification utilisateur reçue le 2026-10-23 : les réunions organisées par un autre mentor sont incluses si le compte connecté y participe. Cette réponse confirme « toutes les réunions rejointes » et précise que « limiter au compte connecté » exclut les rapports inter-mentors, pas les réunions organisées par autrui. L'exclusion organizer-only de la première conception est retirée comme interprétation de périmètre; `conferenceRecords.list` documenté ne prouve pas cette couverture, et la voie Meet permettant de satisfaire l'exigence reste un blocker technique à concevoir et prouver.

### Action et preuve de reprise

La relecture QA indépendante des exigences de présence, de dédoublonnage et d'export est terminée. Elle confirme que les tests existants couvrent les agrégats et certains alias, mais ne prouvent ni l'absence de doublons de fichiers ni la reprise après résultat incertain. Elle confirme aussi que la readiness reste `review` et que les tests/workflow attendent son approbation et le preflight vert. Les corrections autorisées dans ce work item restent documentaires; toute correction de comportement doit être traitée dans un work item produit distinct après la porte de conception.

La décision utilisateur de limiter les rapports au compte connecté conserve les réunions rejointes organisées par autrui, sans rapport inter-mentors. La revue documentaire du 2026-10-23 identifie la piste `spaces.get` pendant une réunion, puis `conferenceRecords.get` via `activeConference.conferenceRecord`, en complément de `conferenceRecords.list`. Cette séquence et ses permissions restent à vérifier; elle ne prouve ni l'accès effectif au record d'un organisateur tiers, ni l'exhaustivité Meet, ni le mapping d'identité, ni la gratuité partagée. L'activation demeure suspendue tant que la couverture technique, les gates explicites de finalité et de coût zéro ne sont pas levées. Aucun appel API Google, accès Drive, modification produit ou exécution CI n'a été effectué pendant cette reprise.

### Addendum CR-008, 2026-10-23

L'utilisateur classe au MVP le collecteur VPS autonome nécessaire et précise le comportement : le mentor peut être dans Meet alors que l'extension est fermée; démarrer deux minutes avant l'horaire Agenda; attendre la fin réelle de Meet avant l'export, même si tous ont quitté avant. CR-008 réouvre uniquement le backend minimal requis de CR-002; CR-003 reste Post-MVP pour les réunions sans participation du mentor. La revue indépendante confirme que le backend actuel reçoit un Bearer de l'extension, persiste les sessions poussées et n'a ni principal Google serveur par mentor ni worker autonome de découverte. Le design doit établir un consentement révocable et une gestion sûre des credentials, l'accès au calendrier/Meet/Sheets, les états de réunion annulée/non démarrée/données incomplètes et une garde de coût partagé sans frais. Readiness `review`; implémentation, tests produit, API Google/Cloud, déploiement et publication GitHub restent non autorisés/non effectués. Le détail est dans [CR-008](../project-management/cahier-des-charges/holbies-meet-tracker/CHANGE-REQUEST-63fb0fedc5c73c99d8b20e22899f11452c6757ac4a4b10a41c79b0b024104cbc.md).

### Addendum README et flux de collecte, 2026-10-23

La comparaison du README de la branche avec son contenu courant a montré que les ajouts locaux liés aux arbitrages de périmètre avaient transformé le README produit en registre d'historique : décisions détaillées, état d'audit, répétitions de déduplication et référence Kanban cassée. Ces ajouts étaient dans le diff non commité, pas dans le commit de base. Le README a été réorganisé pour garder une présentation concise du périmètre, des fonctions présentes, de l'écart entre le worker Chrome actuel et le collecteur VPS, des limites, de l'installation et des commandes locales. Les détails de provenance et de décision restent dans les documents dédiés.

La relecture indépendante a trouvé des phrases héritées de la conception extension seule, qui attribuaient au maintien de Chrome la couverture CR-008, et un récit historique restant dans le README. Ces formulations ont été corrigées. L'auditeur final confirme que le README est centré produit, que les flux distinguent le worker Chrome du collecteur VPS et qu'aucun rapport d'absence n'est créé à partir de données manquantes. Il a signalé une formulation ambiguë dans le titre du document d'export, corrigée de « réduite » en « précisée ». Les exigences ouvertes du collecteur VPS sont OAuth serveur par mentor et révocation, accès aux réunions organisées par un tiers, disponibilité du scheduler, réconciliation après échec, rétention et garde de coût partagé. La readiness reste `review`; aucun changement produit, test, workflow, appel Google/Cloud ou livraison distante n'a été exécuté. `git diff --check` passe.

La relecture croisée de la modélisation CR-008 a relevé que le fallback utilisateur était défini dans le stockage de l'extension, alors que le VPS doit pouvoir produire un rapport pendant que Chrome est fermé. Le 2026-10-24, l'utilisateur a décidé en CR-009 d'autoriser un buffer VPS temporaire, protégé et purgé selon la durée fixée par l'établissement. La décision de périmètre est prise; l'authentification du retrait, l'isolation, la protection au repos et en transit, le transfert, la suppression et la policy de durée restent à concevoir et prouver avant approbation ou implémentation.

### Addendum planification et quotas, 2026-10-24

La revue indépendante complète du design gate confirme `Status: review`. La documentation propose maintenant des états durables de job, un nettoyage du `meetingCode` après usage, la suppression du `conferenceRecordId` après finalisation, une cadence candidate d'une lecture par minute pour l'état du record et pour la vérification minimale du mentor, ainsi qu'un répartiteur commun fail-closed. Cette cadence n'est pas acceptée comme couverture garantie : une réunion peut commencer et se terminer entre deux lectures. Le délai de démarrage tardif après `event.end`, les retries/réconciliation, le contrat OAuth serveur et les endpoints de retrait CR-009 restent à concevoir. Les quotas Google documentés sont des valeurs affichées, les quotas réels peuvent différer et le budget du collecteur ne couvre pas les autres clients du projet. Si l'usage partagé ne peut pas être mesuré et plafonné sans dépense, la collecte automatique reste inactive. Aucun test produit, appel Google, changement de workflow ou déploiement n'a été effectué.

### Addendum décisions CR-010 et reprise QA/CI, 2026-10-24

CR-010 consigne la décision utilisateur d'autoriser en principe un refresh token chiffré et isolé par mentor, révocable et supprimé à la déconnexion. Le mécanisme de chiffrement, la gestion des clés et le parcours OAuth restent à concevoir et auditer. La fenêtre de démarrage tardif doit être strictement positive, configurée par l'établissement et sans défaut. L'utilisateur refuse une collecte best-effort : la couverture des réunions courtes et des événements manqués doit être démontrée avant activation; le polling périodique et la piste Workspace Events actuellement documentée ne constituent pas cette preuve. L'automatisation reste suspendue. Ces décisions ne changent pas le périmètre du work item QA/CI, limité aux tests de l'export manuel existant et aux corrections de documentation/CI autorisées après gate.

La relecture courante confirme que le README décrit le workflow versionné, y compris ses déclencheurs `push` et `pull_request`, les tests d'extension effectivement lancés, les contrôles backend, la construction Docker et la validation du manifeste. La cible PR-only et la suite d'extension complète sont présentées comme non implémentées. L'obligation de documentation est donc vérifiée à ce stade. La readiness reste `review`, le preflight exige `Status: approved`, et interdit encore toute modification de tests ou de workflow. Aucun test, workflow distant, appel Google ou changement produit n'a été lancé dans cette reprise.

### État courant après approbation documentaire, 2026-10-24

La revue indépendante finale a jugé le dossier cohérent pour approbation documentaire. `docs/design/design-readiness.md` porte maintenant `Status: approved` et `bash .codex/scripts/preflight.sh` passe; cela ne lève pas les gates `needs-review` d'accès Meet, couverture fiable, OAuth/crypto, finalité institutionnelle, rétention et coût zéro avant implémentation/activation concernée. Le work item QA/CI reprend uniquement ses changements permis. Ajout local de `tests/popup-export.test.js` pour caractériser l'export Sheets manuel via doubles, son CSV, ses erreurs et retries; le test ciblé passe (18 cas comptés par le runner). Le workflow local passe à pull request seulement, suite complète d'extension, concurrence annulant les runs obsolètes et actions épinglées. README actualisé en conséquence. Aucun code produit, appel Google, exécution CI distante, commit ou livraison n'a été fait dans cet addendum.

### Livraison QA/CI vers `dev`, 2026-10-24

PR [#141](https://github.com/Krapaud-Labs/holbies-meet-tracker/pull/141) contient uniquement `.github/workflows/validate.yml`, `README.md` et `tests/popup-export.test.js`; son impact produit est `aucune`. La CI GitHub Actions a réussi sur l'événement pull request (run 40115518486), y compris le build Docker indisponible localement, puis la PR a été fusionnée vers `dev`. SHA fusionné et `origin/dev` vérifié via GitHub : `984d00fa5d78a46184a5dff54fd6dce681d728ca`. Le clone de travail conserve ses modifications documentaires locales non incluses dans cette PR; le `.git` de cet environnement n'est pas accessible en écriture, donc le checkout local n'a pas été avancé. Les détails Meet/OAuth restent dans les documents locaux et n'ont pas été publiés dans un Issue.
### Revue QLT-003/004, 2026-10-24

L'utilisateur autorise les corrections produit MVP séparées du cahier historique. QLT-004 est documenté fail-closed. La revue indépendante a corrigé la règle « non observé = absent », précisé les cas ambigus/incomplets, puis identifié que l'API Meet ne fournit pas l'e-mail étudiant. L'utilisateur choisit de ne pas ajouter People API ni de scope; les étudiants non reliables restent « à vérifier ». Il autorise ensuite l'export Sheets/CSV d'un rapport « PARTIEL » après pagination complète, sans compter ces lignes comme présentes ou absentes. Readiness reste `review` pendant l'alignement et la revue indépendante finale; aucune implémentation, test produit, API réelle, commit ou publication distante n'a eu lieu. `git diff --check` passe.
