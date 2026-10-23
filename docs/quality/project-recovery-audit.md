# Audit de reprise et d'initialisation

Date : 2026-10-23
Branche observée : `fix/audit-clean`, synchronisée avec `origin/fix/audit-clean` au démarrage.
Périmètre : provenance MVP, extension Chrome, backend, sécurité, tests, UX/accessibilité, CI et exploitation. Audit en lecture seule; aucun code produit n'a été modifié.

## Synthèse

Les tests automatisés locaux passent, mais ils ne prouvent pas l'intégration réelle à Chrome/Google ni l'alignement du produit avec le MVP historique reconstitué. L'empreinte originale du cahier reste absente. Les décisions utilisateur du 2026-10-23 classent l'export automatique Sheets (CR-001) dans le MVP, le backend/persistance (CR-002) et le suivi autonome (CR-003) en Post-MVP. Le Project privé #4 est maintenant relié au dépôt et contient 13 Issues relues.

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
| GitHub Project V2 | Project #4 privé, relié au dépôt; 13 Issues lues; DEC-001 terminée et marquée Done | Les 12 autres Issues restent ouvertes selon leurs preuves et décisions |

## Constats par domaine

### Cahier et périmètre

- Aucun `ORIGINAL-MVP-BRIEF.sha256` antérieur n'existe dans l'historique Git accessible. La reconstitution fondée sur `d890828` est marquée non certifiée; son hash candidat vérifie uniquement le fichier reconstitué.
- Les documents ultérieurs rendent l'export Sheets volontaire, ajoutent un backend PostgreSQL et un suivi automatique même quand le mentor ne rejoint pas Meet. Le 2026-10-23, l'utilisateur a accepté l'export automatique en cible MVP et classé le backend ainsi que le suivi autonome Post-MVP. Le code actuel reste divergent de la cible CR-001.
- `docs/design/design-readiness.md` est désormais `review`, car son approbation antérieure ne couvrait pas ces questions de périmètre et de provenance.
- Après revue, les documents de vision, roadmap, flux Meet, export, architecture et sécurité portent maintenant un statut explicite : périmètre proposé ou comportement as-built en attente d'arbitrage; le rendu clavier et responsive reste non vérifié.

### Fonctionnel et qualité

- Couverture positive : seuil de retard de deux minutes, statuts d'attente, sessions/reconnexions, déduplication d'identité, filtrage calendrier, cycle background simulé, snapshots, fermeture et contrats WebSocket.
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

Les Issues détaillées et leurs dépendances sont consignées dans [le manifeste GitHub Project](../project-management/github-project.md) et synchronisées dans le Project distant. Les décisions utilisateur séparent les demandes hors cahier; les constats de qualité non arbitrés restent explicitement `Needs-decision`.

## Limites et suite

- Aucune CI distante, règle de protection, déploiement VPS ou compte Google de test n'a été interrogé dans cet audit.
- Le Project distant est créé, relié au dépôt et relu; les 13 Issues initiales sont synchronisées.
- Les classements CR-001 à CR-003 sont décidés; restent à concevoir l'autorisation préalable et les détails d'export CR-001, ainsi qu'à retrouver l'empreinte originale si elle existe hors du dépôt.
