# User stories et critères d'acceptation

Les critères ci-dessous distinguent l'état as-built des décisions de cible. « Accepté » décrit une décision de périmètre, pas une fonctionnalité implémentée ou activable. Les gates marquées `needs-review` doivent être levées avant l'activation concernée.

## US-01 : connexion et agenda

**Histoire.** En tant que mentor, je veux me connecter explicitement avec Google et consulter mes événements admissibles.

**État.** Connexion et lecture d'agenda partiellement implémentées; intégration réelle non certifiée.

**Critères.**

- Aucun prompt interactif OAuth ne survient sans action d'authentification/activation.
- L'interface indique clairement l'état déconnecté, le compte utilisé ou l'erreur d'accès.
- Les événements affichés viennent des calendriers autorisés et la pagination est complète avant d'affirmer qu'il n'existe pas d'événement.
- Une erreur ou une permission manquante est affichée comme indisponibilité, pas comme absence de réunion.

## US-02 : consulter les présences

**Histoire.** En tant que mentor, je veux sélectionner une réunion Meet et consulter les invités, les arrivées, les départs et leurs statuts.

**État.** Analyse locale et calcul de statuts présents dans le dépôt; intégration Meet réelle et identités ambiguës non entièrement validées.

**Critères.**

- Une arrivée dans la tolérance de deux minutes est « présent à l'heure »; au-delà, elle est « présent en retard ».
- Un invité n'est déclaré absent qu'après la fin effective et la collecte/pagination complète sans erreur, si une clé e-mail comparable existe côté roster et Meet et qu'aucun match ni candidat ambigu ne subsiste; sans e-mail Meet comparable, il reste « à vérifier », jamais absent.
- Dans le backend live actuel, les présences dont l'e-mail complet est comparable peuvent être reconnues, mais les invités attendus non observés restent « à vérifier » faute de preuve serveur de `ConferenceRecord.endTime` et de pagination complète. Aucun booléen client de complétude ne permet de les déclarer absents. Une capacité d'absence backend attend un CR/work item séparé avec collecte complète prouvée côté serveur.
- Une identité anonyme, contradictoire ou non rapprochable reste « à vérifier ».
- Un échec API, une pagination incomplète ou un record manquant ne produit aucun rapport d'absence.

## US-03 : exporter automatiquement une réunion rejointe

**Histoire.** En tant que mentor, je veux activer une fois l'export automatique des réunions auxquelles mon compte participe, y compris celles organisées par un autre mentor, sans rapport inter-mentors.

**Décision.** Cible MVP acceptée par CR-001/004/008/010; non implémentée et suspendue.

**Critères.**

- Activation globale explicite dans les réglages, désactivée par défaut; le compte et les scopes consentis sont visibles avant usage.
- Le job démarre à T-2 minutes même lorsque Chrome et l'extension sont fermés; une durée positive de démarrage tardif est configurée par l'établissement, sans défaut.
- Le collecteur prouve la présence du mentor et une couverture fiable des réunions courtes, organisées par un tiers et manquées par un worker; la cadence best-effort actuelle ne satisfait pas ce critère.
- Le rapport n'est finalisé qu'après `ConferenceRecord.endTime` et lecture complète des pages.
- Le compte rendu ne porte que sur le mentor authentifié; aucun non-match ni roster n'est conservé avant identité confirmée.
- Finalité institutionnelle, autorisation Meet, correspondance `openid.sub`/identifiant Meet et quota partagé sans frais sont des gates `needs-review`.

## US-04 : écrire dans Sheets sans doublon automatique

**Histoire.** En tant que mentor, je veux que le rapport soit écrit dans mon compte Google au bon emplacement sans partage automatique, et que son statut complet ou PARTIEL reflète les identités réellement résolues.

**Décision.** Export automatique et destination MVP acceptés par CR-001/005/006/007; le code actuel demande encore une action manuelle.

**Critères.**

- Activation et scopes Sheets/Drive sont accordés à l'avance; aucun dialogue OAuth n'apparaît à la fin de la réunion.
- Destination `Holbies Meet Tracker/AAAA/MM - Mois/`; nom `{nom de réunion} - JJ/MM/AAAA`, année à quatre chiffres, suffixe stable en cas de collision.
- Aucun partage automatique, changement de permission ou suppression automatique du fichier.
- Un `operation_id` stable lie le record à sa création. Après réponse ambiguë, rechercher la création existante; ne pas relancer `files.create` automatiquement.
- Une identité mentor non prouvée ou une page manquante bloque l'écriture. Si la collecte est complète mais que des identités étudiantes restent « à vérifier », écrire un rapport « PARTIEL » clairement marqué; ces lignes ne comptent pas comme présentes ou absentes.

## US-05 : récupérer un export Sheets échoué

**Histoire.** En tant que mentor, je veux récupérer à la prochaine ouverture le rapport finalisé lorsque Chrome était fermé et que Sheets a échoué.

**Décision.** Fallback VPS CR-009 accepté au MVP; non implémenté.

**Critères.**

- Le VPS peut conserver un rapport complet ou « PARTIEL » des sept colonnes et un identifiant d'opération opaque, isolés par mentor et protégés; il préserve le statut lors du retrait.
- La popup récupère le rapport après authentification du même mentor et l'accusé de réception entraîne sa suppression.
- Une durée strictement positive, fournie par l'établissement et sans défaut, fixe l'échéance de purge.
- Le buffer, son endpoint ou l'export automatique sont désactivés si la rétention, l'authentification ou l'autorisation manque.
- Le protocole de transfert, de reprise et de purge reste `needs-review` sécurité/API.

## US-06 : se déconnecter

**Histoire.** En tant que mentor, je veux révoquer mon accès et supprimer le credential serveur associé.

**Décision.** CR-010 accepte le principe de révocation et de suppression du refresh token par mentor; le flux reste à concevoir.

**Critères.**

- La déconnexion révoque le credential auprès de Google et supprime le refresh token chiffré lié au mentor.
- Aucun secret n'est journalisé; la preuve de suppression et le traitement des jobs/fallbacks en attente sont spécifiés.
- L'extension ne conserve pas son token dans le stockage applicatif.
- Échec de révocation ou d'effacement mène à un état de retrait explicite et bloque toute nouvelle collecte.

## Corrections qualité MVP acceptées par CR-011/012

Ces corrections produit MVP sont acceptées séparément du cahier historique via CR-011/012 et suivies dans `.codex/work-items/2026-10-24-qlt-003-004-remediation/`.

- **US-02 / CR-011, identité d'apprenant fiable.** Lorsque les deux sources fournissent une adresse, retirer les espaces périphériques, normaliser en NFC, conserver exactement la casse de la partie locale et comparer le domaine en minuscules. Seules les clés complètes identiques associent automatiquement. Deux e-mails distincts ne sont jamais fusionnés via le nom ou la partie locale. Aucun alias, identifiant provider ni People API n'est accepté dans le périmètre courant. Les snapshots et événements backend suivent la même règle. Tout rapprochement nominal, anonyme, conflit un-à-plusieurs, non corrélé ou incomplet reçoit « à vérifier » et n'est compté ni présent ni absent. Les résultats restent invariants à l'ordre d'entrée. Meet n'expose pas l'e-mail étudiant; l'utilisateur refuse d'appeler « complet » un rapport qui contient des identités non résolues. Il autorise le rapport « PARTIEL » après pagination complète, sans People API ni nouveau scope.
- **US-04 / CR-012/013, autorisation OAuth sûre.** Toute source OAuth de `popup.js` et `background.js:getToken()` doit retourner une chaîne non blanche avant état connecté, affectation ou appel réseau; `background.js:googleJson` et `syncEvent` ne lancent aucun fetch Google/backend avec un `Bearer` avant validation. Les valeurs absentes, blanches ou truthy non textuelles produisent zéro appel réseau dans ces chemins. La popup affiche un message générique et le fallback CSV; elle ne remplace pas le token Agenda/Meet valide. Aucune valeur du token n'est journalisée ou affichée, y compris dans les erreurs du worker.

## Comportement as-built à caractériser

L'export manuel actuel crée une feuille après clic et consentement; le worker Chrome suit un cycle différent de la cible VPS. Le work item QA/CI teste ces comportements présents sur doubles locaux seulement; il ne valide aucune story cible CR-001/008/009. CR-011/012 sont désormais des corrections produit MVP autorisées dans un work item distinct.
