# Parcours OAuth Google

## Validation fail-closed CR-012/013

Chaque source OAuth de `popup.js` et `background.js:getToken()` fournit une chaîne non blanche avant état connecté ou affectation. La garde est répétée dans `background.js:googleJson` et `syncEvent` avant tout fetch et en-tête Bearer, qu'il cible Google ou le backend. Une valeur absente, null, undefined, chaîne vide/blanche ou truthy non textuelle est refusée sans fetch, retry, mutation d'état ou fuite dans les messages/logs. Lors d'un consentement Sheets invalide, le token Agenda/Meet précédemment valide reste actif; la popup affiche une erreur générique et propose le CSV. Les revues QA, Cybersécurité et Auditeur ont rendu APPROVE. L'implémentation et les tests simulés sont présents dans le checkout local; aucune API Google réelle n'a été appelée.

## Implémentation actuelle

Le prototype utilise `chrome.identity.getAuthToken({ interactive: true })` uniquement après le clic explicite sur « Se connecter avec Google ». Chrome conserve le token dans son cache mémoire ; l’extension ne l’écrit ni dans le DOM, ni dans `localStorage`, ni dans `chrome.storage`, ni dans les journaux.

Référence technique : [API Chrome Identity](https://developer.chrome.com/docs/extensions/reference/api/identity), consultée le 2026-10-13. Le code utilise la forme Promise de `getAuthToken`, disponible à partir de Chrome 105 ; la cible du projet reste Chrome stable.

## Scopes déclarés

| Scope | Usage prévu | Moment d'utilisation |
| --- | --- | --- |
| `meetings.space.readonly` | Lire les informations Meet nécessaires au suivi post-réunion | Après détection d'une réunion et décision de conformité |
| `calendar.readonly` | Lister les agendas accessibles et lire leurs événements | Après connexion, pour afficher le sélecteur d'agendas et la semaine en cours |
| `calendar.events.readonly` | Lire l'événement Agenda et ses invités | Lors de l'identification de la réunion |
| `drive.file` | Créer ou gérer la feuille exportée et le dossier `Holbies Meet Tracker` utilisé par l'extension | Actuel : au clic d'export. Cible CR-001 : au moment où l'utilisateur active explicitement l'export automatique dans les réglages. |
| `spreadsheets` | Créer et remplir la feuille exportée | Actuel : au clic d'export. Cible CR-001 : au moment où l'utilisateur active explicitement l'export automatique dans les réglages. |
| `openid` | Lire le `sub` de l'utilisateur connecté pour vérifier son identité de participant Meet | Cible CR-001 : au moment où l'utilisateur active explicitement l'export automatique; autorisation de conception reçue le 2026-10-23. Absent de l'implémentation actuelle. |

## Cible MVP retenue par CR-001

Les scopes `drive.file`, `spreadsheets` et `openid` doivent être accordés avant qu'un export automatique soit possible. Le consentement Google doit être explicite et ne peut pas être demandé de façon interactive à la fin de la réunion. Décision utilisateur du 2026-10-23 : proposer une activation globale explicite dans les réglages, désactivée par défaut; demander les scopes lors de cette activation. Si l'utilisateur refuse, l'activation reste désactivée. Tant que l'autorisation préalable manque ou est révoquée, l'export automatique est indisponible et l'extension doit l'indiquer; aucun export ne doit être prétendu réussi.

L'export automatique cible uniquement une réunion à laquelle le mentor du compte connecté a participé. Le consentement préalable à l'écriture ne déclenche pas la collecte des réunions auxquelles il n'a pas participé, qui reste Post-MVP (CR-003). As-built, les tokens de l'extension restent dans le cache d'identité Chrome et ne sont ni journalisés ni copiés dans son stockage applicatif. Cela ne fournit pas au VPS l'accès autonome demandé par CR-008; l'authentification serveur par mentor, sa révocation et la protection de ses credentials restent à concevoir et ne sont pas implémentées.

### Accès autonome CR-008 : principe de consentement accepté, mécanisme à concevoir

Le jeton court de `chrome.identity.getAuthToken` n'est pas stocké ni transmis par le prototype et ne suffit donc pas à un job VPS lorsque Chrome est fermé. Le 2026-10-24, l'utilisateur a accepté le principe d'un refresh token durable par mentor, chiffré, révocable côté Google et supprimé à la déconnexion (CR-010). L'option documentaire est un flux OAuth 2.0 serveur séparé, avec autorisation par code, `state` aléatoire et `access_type=offline`, afin que l'utilisateur autorise explicitement le VPS à renouveler son accès sans interaction. Google indique qu'un tel accès retourne un refresh token et exige sa conservation côté serveur. Le serveur devra isoler ce secret par mentor, limiter son usage aux scopes consentis, ne jamais le journaliser, protéger la clé de chiffrement hors de la base, effacer le credential au retrait et révoquer l'accès auprès de Google. L'application publique pourrait aussi devoir suivre la vérification OAuth applicable à ses scopes sensibles ou restreints. L'accord porte sur le principe, pas sur un protocole approuvé : le mécanisme, les scopes, la clé, la révocation, l'effacement et la revue de sécurité restent à concevoir. Source officielle relue le 2026-10-24 : [OAuth 2.0 pour applications Web serveur](https://developers.google.com/identity/protocols/oauth2/web-server), [vérification des apps OAuth](https://support.google.com/cloud/answer/13463073?hl=fr).

La lecture Google Agenda est implémentée en lecture seule sur `https://www.googleapis.com/*`. Les appels Meet utilisent `https://meet.googleapis.com/*` et l'export utilise `https://sheets.googleapis.com/*`. Le flux cible OpenID consulte `https://openidconnect.googleapis.com/v1/userinfo`, ce qui requiert une host permission ciblée pour `openidconnect.googleapis.com`. Aucune permission générique n'est utilisée.

## États et erreurs

- `Connexion requise` : aucun jeton demandé automatiquement.
- `Connexion en cours` : bouton désactivé et message annoncé par `aria-live`.
- Implémentation actuelle : la connexion demande Meet, Agenda et l'identité; Sheets/Drive sont demandés au moment de l'export manuel. Cible CR-001 : demander ces scopes quand l'utilisateur active explicitement l'export automatique dans les réglages.
- `Compte Google connecté` : succès si Chrome retourne un token valide; lorsque Chrome fournit `grantedScopes`, ils sont contrôlés, sinon l'API d'identité est considérée comme source de cette validation.
- Si Chrome ne termine pas `getAuthToken` sous 15 secondes, la popup revient à un état d'erreur actionnable au lieu de rester bloquée sur « Connexion en cours ». Il faut alors recharger l'extension depuis `chrome://extensions` et vérifier le compte test OAuth.

Après l'obtention du token, l'extension interroge `https://www.googleapis.com/oauth2/v2/userinfo` avec le scope `userinfo.email` pour afficher l'adresse du compte utilisé. Si cette information n'est pas disponible, l'état reste connecté et affiche le libellé générique `Compte Google connecté`.

Pour le parcours OAuth de l'extension CR-001, après activation explicite, réutiliser un token Chrome préautorisé avec le scope `openid` pour appeler `https://openidconnect.googleapis.com/v1/userinfo` et lire le `sub`. Comparer ce `sub` à l'identifiant Meet `signedinUser.user` uniquement si un test autorisé confirme l'égalité après retrait du préfixe `users/`. Cette voie côté extension ne donne pas au VPS l'accès autonome CR-008. Le principal serveur par mentor, son consentement, sa révocation et son accès UserInfo/Meet restent une conception séparée. En cas d'absence de `sub`, de format différent ou de correspondance non prouvée, aucune feuille automatique n'est créée. People API n'est pas appelée sans décision et scope supplémentaires. Références : [OpenID UserInfo](https://developers.google.com/identity/openid-connect/reference) et [Meet Participant](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.participants).

À l'ouverture de la popup, `chrome.identity.getAuthToken({ interactive: false })` tente de réutiliser le cache Chrome. Cette restauration silencieuse permet de conserver l'affichage du compte et l'agenda sans demander une nouvelle interaction. Une absence de token est traitée comme une première connexion.

- `Autorisations incomplètes` ou refus utilisateur : message explicite, sans détail sensible.
- Si la liste des agendas répond `403`, l'ancien jeton ne possède probablement pas le nouveau scope `calendar.readonly`. L'utilisateur doit se déconnecter puis se reconnecter afin que Chrome redemande cette autorisation.

Le token validé reste en mémoire de la popup pour Agenda, Meet et les actions d'export; il n'est pas persisté dans le stockage applicatif. Le worker redemande un token au cache Chrome pour chaque cycle. L'appel Agenda expire après huit secondes et supprime le token du cache Chrome en cas de réponse `401`. L'action de déconnexion appelle `clearAllCachedAuthTokens()` et vide les résultats en mémoire.

## Limites et preuves à obtenir

- Les appels Agenda et Meet doivent être vérifiés dans Chrome avec un compte de test autorisé ; les contrôles locaux ne remplacent pas ce test réel.
- La cible MVP crée une nouvelle feuille, la range dans le dossier Drive `Holbies Meet Tracker` et ne la partage pas automatiquement. `drive.file` et `spreadsheets` doivent être accordés avant la réunion; cette cible diffère du prototype à export manuel.
- Décision utilisateur du 2026-10-23 et CR-009 : le compte doit être visible avant export; le dossier est fixe et les feuilles ne sont pas supprimées automatiquement. L'établissement fournit une durée positive `fallbackRetentionDays`. Le fallback récupérable à la prochaine ouverture est conservé temporairement sur le VPS si Chrome était fermé, puis supprimé après retrait authentifié ou purgé à l'échéance. Aucun délai par défaut n'est embarqué. L'isolation, le transport, le chiffrement, le contrôle d'accès et la purge restent à concevoir et prouver; sans policy valide, le buffer et l'export automatique restent désactivés.
- Décision utilisateur du 2026-10-23 : l'export cible est global, activé dans les réglages, sans armement par réunion; l'utilisateur accepte une vérification Meet en arrière-plan. CR-008 exige un collecteur VPS autonome, démarré deux minutes avant l'horaire Agenda; la disponibilité de Chrome n'est donc pas une dépendance de la cible. Le principal serveur doit lire l'Agenda, découvrir le record actif et vérifier la participation du mentor. Son OAuth par mentor, sa révocation, l'accès aux réunions organisées par un tiers, la fiabilité du scheduler VPS et la réconciliation après échec restent à concevoir et prouver.
- Proposition de limite d'usage, non approuvée : registre factuel de présence/absence et signalement des absences, sans note, classement, décision disciplinaire ni évaluation de performance. L'utilisateur a choisi le 2026-10-23 de garder la finalité comme hypothèse non approuvée et de suspendre toute activation. L'établissement doit fournir une décision institutionnelle explicite et définir l'information aux participants et la conservation avant réexamen; cette conception ne certifie pas la conformité.
- Le test Chrome doit utiliser l'identifiant d'extension réellement configuré dans le client OAuth et un compte Google de test.
