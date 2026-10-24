# Parcours Google Meet

> **Statut : distinguer cible MVP et comportement as-built.** CR-001/CR-004 ciblent les rapports du compte Google connecté pour les réunions auxquelles il participe, y compris celles organisées par autrui; la couverture technique de ces conférences reste à prouver. CR-003 classe Post-MVP le suivi autonome d'une réunion sans sa présence. La baseline et les décisions sont dans `docs/project-management/cahier-des-charges/holbies-meet-tracker/`.

## Cible MVP : collecte VPS d'une réunion à laquelle le mentor participe

**Activation suspendue.** L'export automatique est désactivé par défaut. Il ne peut être activé qu'après validation de l'autorisation Google du collecteur, de l'accès aux réunions organisées par autrui, de la sécurité, de la finalité d'usage, de la rétention et du coût sans frais.

1. Le compte mentor autorise explicitement l'export automatique. L'accès Google de l'extension et le principal OAuth serveur nécessaire à CR-008 sont deux mécanismes distincts. Le consentement, la révocation et le stockage protégé du principal serveur restent à concevoir.
2. Le VPS lit les événements des agendas autorisés et planifie la collecte deux minutes avant l'heure Agenda. Cette tâche continue si Chrome et l'extension sont fermés.
3. À partir du code Meet de l'événement, le collecteur appelle `spaces.get` pendant la conférence et capture `activeConference.conferenceRecord`. La séquence avec un principal serveur pour un compte participant non-organisateur reste à prouver. `conferenceRecords.list`, qui ne retourne que les conférences organisées par l'appelant, ne remplace pas cette découverte.
4. Le collecteur lit transitoirement les champs minimaux `participants(signedinUser(user))` et compare les identifiants au `sub` du mentor. Le masque limite les champs, pas les personnes. Aucun non-match n'est persisté, journalisé ou transmis; aucun rapport ni session n'est créé avant correspondance positive. La correspondance `sub`/Meet doit être prouvée avec un compte autorisé.
5. Après correspondance positive du mentor, le collecteur attend `ConferenceRecord.endTime` et la pagination complète avant de calculer les statuts et d'exporter. Les identités étudiantes sans e-mail comparable restent « à vérifier »; après pagination complète, le rapport Sheets/CSV est exportable avec un marquage visible « PARTIEL » et n'est jamais qualifié de complet. Le départ anticipé de tous les participants ne déclenche pas le rapport.
6. Une annulation, une réunion qui n'a pas démarré, un record absent/incomplet, un échec API ou un job manqué produit un état indisponible ou une revue manuelle. Aucune donnée manquante ne devient une absence.
7. Si Sheets échoue alors que Chrome est fermé, conserver le rapport complet ou « PARTIEL » dans le buffer VPS CR-009, protégé et isolé par mentor, en préservant son statut. Le transférer à la popup après authentification, le supprimer après récupération réussie et le purger selon la durée positive fixée par l'établissement. Si cette durée ou l'autorisation de retrait manque, désactiver ce repli et l'export automatique. Le protocole exact et ses preuves de sécurité restent à concevoir.

La cible ci-dessus décrit un collecteur Meet/VPS capable de prouver `endTime` et la pagination complète. Elle ne décrit pas l'absence du backend live actuel : aucun client ne lui transmet une preuve serveur vérifiable de ces conditions. Pour ce work item, les invités attendus non observés restent `identity-to-check` / « à vérifier »; les présences avec e-mail complet comparable restent possibles. Aucune migration ni aucun booléen client de complétude n'est ajouté. Une future capacité d'absence backend exige un CR et un work item séparés qui conçoivent et prouvent la collecte complète côté serveur.

### Planification, états et budget de lecture

Le job VPS est créé pour chaque événement Meet admissible et démarre à `event.start - 2 minutes`. Cadence candidate à faire relire : appeler `spaces.get` au plus une fois par minute jusqu'à capture de `activeConference.conferenceRecord`; une fois l'ID obtenu, appeler `conferenceRecords.get` une fois par minute pour détecter `endTime` et, tant que l'identité mentor n'est pas confirmée, appeler aussi `participants.list` avec le masque minimal une fois par minute. Après confirmation du mentor, arrêter les lectures d'identité et garder seulement la lecture périodique de l'état du record. Dès que `endTime` est renseigné, lire toutes les pages de participants une fois et finaliser. Aucun roster complet ni rapport n'est récupéré avant confirmation positive du mentor. Cette cadence est une hypothèse et ne garantit pas la capture d'une conférence qui commence et se termine entre deux lectures; avant correspondance, elle peut utiliser jusqu'à deux lectures par minute et par réunion.

Un répartiteur unique VPS réserve un budget commun avant chaque lecture et un budget par principal mentor. Le budget est calculé à partir des quotas réellement configurés, des autres consommateurs du projet et d'une marge de sécurité. Si le quota réel, l'usage partagé ou la marge ne sont pas observables, le job ne lance pas les lectures Meet et passe en `manual_review_required`; un plafond propre au collecteur ne garantit pas le plafond du projet. Aucun quota ne peut être augmenté et aucune facturation activée. Google documente 6 000 lectures/minute/projet et 600 lectures/minute/utilisateur/projet comme limites affichées, l'absence de plafond journalier tant que ces limites par minute sont respectées, et l'usage standard sans coût additionnel. Les quotas réels peuvent différer; Google prévoit de facturer les dépassements plus tard en 2026. Les réponses 429 déclenchent une pause avec backoff exponentiel et gigue, sans transformer l'échec en absence ni répéter indéfiniment. Cette garde de budget partagé est un prérequis, pas une garantie implémentée. Sources relues le 2026-10-24 : [quotas et coûts Meet](https://developers.google.com/workspace/meet/api/guides/limits), [cycle de vie des espaces Meet](https://developers.google.com/workspace/meet/api/guides/meeting-spaces-overview).

CR-010 décide que la fenêtre de démarrage tardif après `event.end` est une durée strictement positive configurée par l'établissement, sans valeur par défaut. Sans configuration valide, arrêter en `manual_review_required`; si la fenêtre expire sans conférence détectée, terminer en `not_detected`, sans générer de rapport d'absence. Une conférence capturée est suivie jusqu'à son `endTime` réel; une erreur API persistante ou des données incomplètes mène à `manual_review_required`, jamais à une fin supposée.

CR-010 refuse une couverture simplement best-effort : l'utilisateur exige une couverture fiable de toutes les réunions rejointes et demande de suspendre l'automatisation tant que cette garantie n'est pas démontrée. La cadence candidate d'une lecture par minute peut manquer une réunion courte; elle ne répond donc pas à l'exigence seule. La disponibilité du scheduler VPS, la réconciliation après job manqué, l'accès aux réunions tierces et le quota partagé sans frais restent aussi à concevoir ou prouver. Aucune réunion non détectée ne peut devenir un rapport d'absence.

## Comportement actuellement implémenté, Post-MVP CR-002/CR-003

Depuis un événement Google Agenda contenant un lien Meet, l'extension recherche le compte rendu de conférence, récupère les participants et agrège leurs sessions pour préparer un statut de présence. Un service worker MV3 relance ce cycle toutes les minutes dans la fenêtre de l'événement, crée la session backend et envoie les snapshots même si la popup est fermée et si le mentor ne rejoint pas le Meet. Ce comportement as-built dépend du backend (CR-002) et du suivi sans mentor (CR-003); il est classé Post-MVP.
Après l'heure de fin Agenda, le worker attend dix minutes puis clôture la session via l'endpoint authentifié. Les invités restent donc « en attente » pendant la réunion et deviennent « absents » seulement après cette clôture ou un événement de fin Meet.

Ce comportement as-built ne constitue pas la règle cible CR-011. Pour la cible, un invité ne peut être déclaré absent que si une clé e-mail comparable existe côté roster et côté Meet, après fin réelle de réunion et collecte/pagination complète sans erreur, sans match ni candidat ambigu. Si l'e-mail Meet manque ou si l'identité ne peut être rapprochée, le statut reste « à vérifier »; aucune People API ni aucun scope supplémentaire n'est utilisé.

Pour le backend live, cette preuve n'est pas disponible aujourd'hui : la clôture Agenda historique ne vérifie ni `ConferenceRecord.endTime` ni la pagination Meet côté serveur. La correction fail-closed laisse donc les invités attendus non observés « à vérifier », même si le client envoie un événement de fin; aucune preuve client booléenne n'est acceptée.

## Meet actuellement ouvert

Lorsque la popup est ouverte depuis un onglet `https://meet.google.com/...`, elle détecte le code de la réunion via la permission Chrome `tabs` et affiche le bouton « Analyser le Meet ouvert ». Si le code correspond à un événement déjà chargé, l'extension réutilise son titre, son horaire et ses invités Agenda afin de calculer aussi les absents. Sinon, elle analyse le Meet sans invités connus. Dans les deux cas, les participants Meet sont affichés et le suivi live peut être démarré si Google expose déjà le compte rendu de conférence.

## Appels API

1. Le lien est lu en priorité depuis `hangoutLink`, puis depuis `conferenceData.entryPoints`, le lieu ou la description de l'événement. Le code est extrait d'un lien `https://meet.google.com/abc-mnop-xyz`.
2. Pour chaque événement Agenda suivi, la cible appelle `spaces.get` avec l'alias du code Meet pendant la fenêtre de l'événement :

   `GET https://meet.googleapis.com/v2/spaces/abc-mnop-xyz`

   Tant que la conférence est active, lire et conserver temporairement le champ `activeConference.conferenceRecord`. Si aucune conférence active n'est retournée et qu'aucun ID n'a été capturé plus tôt, la voie documentée ne permet pas de retrouver rétroactivement le record d'un organisateur tiers par `conferenceRecords.list`.

3. Une fois le record ID connu, lire son état :

   `GET https://meet.googleapis.com/v2/conferenceRecords/{record}`

   Continuer les vérifications limitées jusqu'à présence confirmée du mentor ou fin/expiration de la conférence. La cadence et le budget partagé restent à concevoir et prouver.

4. Avant correspondance mentor, les participants sont listés avec le masque minimal :

   `GET https://meet.googleapis.com/v2/conferenceRecords/{record}/participants?fields=participants(signedinUser(user)),nextPageToken&pageSize=250`

   Le masque ne filtre pas les personnes : il renvoie les identifiants de tous les participants connectés. Les valeurs ne sont comparées qu’en mémoire et celles qui ne correspondent pas au mentor sont immédiatement abandonnées, sans persistance, journalisation ni transmission. Après correspondance positive, le roster complet peut être lu pour calculer le rapport.

5. Après correspondance positive du mentor, récupérer toutes les pages de participants, puis calculer le rapport avec `earliestStartTime` et `latestEndTime`. Ne pas appeler `participantSessions.list` sauf si les agrégats participants se révèlent insuffisants pour un critère accepté. Une erreur de page bloque le rapport. Les identités étudiantes sans e-mail comparable restent « à vérifier »; si elles sont présentes, la sortie est marquée partielle et jamais complète.

La popup affiche ensuite un résumé séparé des statuts `à l'heure`, `en retard` et `absent`. Les participants dont l'identité doit être vérifiée restent dans la liste détaillée sans être comptés dans ces trois catégories.

Sources : [espaces Meet](https://developers.google.com/workspace/meet/api/guides/meeting-spaces-overview), [spaces.get](https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces/get), [conferenceRecords.get](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords/get), [conferenceRecords.list](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords/list), [participants](https://developers.google.com/workspace/meet/api/guides/participants), [ressource Participant](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.participants), [notes de version Meet](https://developers.google.com/workspace/meet/release-notes), consultées le 2026-10-23.

## Statuts affichés

- `Présent à l'heure` : première session au plus tard deux minutes après le début prévu.
- `Présent en retard` : une session existe, mais l'arrivée dépasse la tolérance de deux minutes.
- `Absent` : seulement après fin réelle, pagination complète et comparaison fiable par e-mail lorsqu'une identité comparable existe des deux côtés, sans candidat ambigu. L'absence d'e-mail Meet étudiant implique « à vérifier », jamais absent.
- `Identité à vérifier` : participant anonyme, téléphonique ou correspondance ambiguë.
- `Réunion encore active` : une session n'a pas encore de date de fin.

Le nom affiché n'est pas une preuve suffisante d'identité. L'extension ne rapproche donc pas automatiquement un participant anonyme d'un invité Agenda.

## Limites et confidentialité

Les heures d'arrivée et de départ sont des données personnelles. Le comportement de l'extension et du backend doit être évalué selon les changements CR-001 à CR-003. Les tokens OAuth ne doivent pas être journalisés. La finalité déclarée de présence reste une hypothèse non approuvée; aucune interprétation qui la limiterait à un registre factuel n'est acceptée comme approbation. L'activation demeure suspendue jusqu'à la validation de cette finalité. Avant tout usage, l'établissement doit traiter l'information des participants, les destinataires, la durée de conservation et la suppression. Toute extension évaluative requiert une demande de changement et une revue préalable; ce périmètre ne certifie pas la conformité institutionnelle.

Le scope `meetings.space.readonly` est déjà déclaré dans le manifeste, mais l'autorisation effective et la validation OAuth pour publication restent à vérifier. La chaîne fonctionnelle doit être testée avec un compte Google de test autorisé, sans présenter les contrôles statiques comme un test API réel.
