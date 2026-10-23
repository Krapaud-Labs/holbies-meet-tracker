# Parcours OAuth Google

## Implémentation actuelle

Le prototype utilise `chrome.identity.getAuthToken({ interactive: true })` uniquement après le clic explicite sur « Se connecter avec Google ». Chrome conserve le token dans son cache mémoire ; l’extension ne l’écrit ni dans le DOM, ni dans `localStorage`, ni dans `chrome.storage`, ni dans les journaux.

Référence technique : [API Chrome Identity](https://developer.chrome.com/docs/extensions/reference/api/identity), consultée le 2026-10-13. Le code utilise la forme Promise de `getAuthToken`, disponible à partir de Chrome 105 ; la cible du projet reste Chrome stable.

## Scopes déclarés

| Scope | Usage prévu | Moment d'utilisation |
| --- | --- | --- |
| `meetings.space.readonly` | Lire les informations Meet nécessaires au suivi post-réunion | Après détection d'une réunion et décision de conformité |
| `calendar.readonly` | Lister les agendas accessibles et lire leurs événements | Après connexion, pour afficher le sélecteur d'agendas et la semaine en cours |
| `calendar.events.readonly` | Lire l'événement Agenda et ses invités | Lors de l'identification de la réunion |
| `drive.file` | Créer ou gérer la feuille exportée et le dossier `Holbies Meet Tracker` utilisé par l'extension | Actuel : au clic d'export. Cible CR-001 : consentement avant la réunion; parcours d'autorisation à concevoir. |
| `spreadsheets` | Créer et remplir la feuille exportée | Actuel : au clic d'export. Cible CR-001 : consentement avant la réunion; parcours d'autorisation à concevoir. |

## Cible MVP retenue par CR-001

Les scopes `drive.file` et `spreadsheets` doivent être accordés avant qu'un export automatique soit possible. Le consentement Google doit être explicite et ne peut pas être demandé de façon interactive à la fin de la réunion. Le contrôle d'activation dans l'interface, son libellé et le moment précis de la demande OAuth restent à concevoir. Tant que l'autorisation préalable manque, l'export automatique est indisponible et l'extension doit l'indiquer; aucun export ne doit être prétendu réussi.

L'export automatique cible uniquement une réunion à laquelle l'utilisateur connecté a participé. Le consentement préalable à l'écriture ne déclenche pas la collecte des réunions auxquelles il n'a pas participé, qui reste Post-MVP (CR-003). Les tokens restent dans le cache d'identité Chrome et ne sont ni journalisés ni copiés dans le stockage applicatif.

La lecture Google Agenda est implémentée en lecture seule sur `https://www.googleapis.com/*`. Les appels Meet utilisent `https://meet.googleapis.com/*` et l'export utilise `https://sheets.googleapis.com/*`. Aucune permission générique n'est utilisée.

## États et erreurs

- `Connexion requise` : aucun jeton demandé automatiquement.
- `Connexion en cours` : bouton désactivé et message annoncé par `aria-live`.
- Implémentation actuelle : la connexion demande Meet, Agenda et l'identité; Sheets/Drive sont demandés au moment de l'export manuel. Cible CR-001 : demander ces scopes avant la réunion, selon un parcours explicite à concevoir.
- `Compte Google connecté` : succès si Chrome retourne un token valide; lorsque Chrome fournit `grantedScopes`, ils sont contrôlés, sinon l'API d'identité est considérée comme source de cette validation.
- Si Chrome ne termine pas `getAuthToken` sous 15 secondes, la popup revient à un état d'erreur actionnable au lieu de rester bloquée sur « Connexion en cours ». Il faut alors recharger l'extension depuis `chrome://extensions` et vérifier le compte test OAuth.

Après l'obtention du token, l'extension interroge `https://www.googleapis.com/oauth2/v2/userinfo` avec le scope `userinfo.email` pour afficher l'adresse du compte utilisé. Si cette information n'est pas disponible, l'état reste connecté et affiche le libellé générique `Compte Google connecté`.

À l'ouverture de la popup, `chrome.identity.getAuthToken({ interactive: false })` tente de réutiliser le cache Chrome. Cette restauration silencieuse permet de conserver l'affichage du compte et l'agenda sans demander une nouvelle interaction. Une absence de token est traitée comme une première connexion.

- `Autorisations incomplètes` ou refus utilisateur : message explicite, sans détail sensible.
- Si la liste des agendas répond `403`, l'ancien jeton ne possède probablement pas le nouveau scope `calendar.readonly`. L'utilisateur doit se déconnecter puis se reconnecter afin que Chrome redemande cette autorisation.

Le code ne conserve pas le token après le callback. L'appel Agenda expire après huit secondes et supprime le token du cache Chrome en cas de réponse `401`. L'action de déconnexion appelle `clearAllCachedAuthTokens()` et vide les résultats en mémoire.

## Limites et preuves à obtenir

- Les appels Agenda et Meet doivent être vérifiés dans Chrome avec un compte de test autorisé ; les contrôles locaux ne remplacent pas ce test réel.
- La cible MVP crée une nouvelle feuille, la range dans le dossier Drive `Holbies Meet Tracker` et ne la partage pas automatiquement. `drive.file` et `spreadsheets` doivent être accordés avant la réunion; cette cible diffère du prototype à export manuel.
- La finalité pédagogique, l'information des participants, la conservation et la conformité de l'usage des données Meet doivent être validées avant toute collecte de présence.
- Le test Chrome doit utiliser l'identifiant d'extension réellement configuré dans le client OAuth et un compte Google de test.
