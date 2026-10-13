# Parcours OAuth Google

## Périmètre actuel

Le prototype utilise `chrome.identity.getAuthToken({ interactive: true })` uniquement après le clic explicite sur « Se connecter avec Google ». Chrome conserve le token dans son cache mémoire ; l’extension ne l’écrit ni dans le DOM, ni dans `localStorage`, ni dans `chrome.storage`, ni dans les journaux.

Référence technique : [API Chrome Identity](https://developer.chrome.com/docs/extensions/reference/api/identity), consultée le 2026-10-13. Le code utilise la forme Promise de `getAuthToken`, disponible à partir de Chrome 105 ; la cible du projet reste Chrome stable.

## Scopes déclarés

| Scope | Usage prévu | Moment d'utilisation |
| --- | --- | --- |
| `meetings.space.readonly` | Lire les informations Meet nécessaires au suivi post-réunion | Après détection d'une réunion et décision de conformité |
| `calendar.events.readonly` | Lire l'événement Agenda et ses invités | Lors de l'identification de la réunion |
| `drive.file` | Créer ou gérer les fichiers Sheets autorisés par l'utilisateur | Au moment de l'export |
| `spreadsheets` | Créer et remplir la feuille exportée | Au moment de l'export |

La lecture Google Agenda est implémentée en lecture seule sur `https://www.googleapis.com/*`. Les appels Meet utilisent `https://meet.googleapis.com/*` et l'export utilise `https://sheets.googleapis.com/*`. Aucune permission générique n'est utilisée.

## États et erreurs

- `Connexion requise` : aucun jeton demandé automatiquement.
- `Connexion en cours` : bouton désactivé et message annoncé par `aria-live`.
- `Compte Google connecté` : succès uniquement si un token et tous les scopes déclarés sont retournés.

Après l'obtention du token, l'extension interroge `https://www.googleapis.com/oauth2/v2/userinfo` avec le scope `userinfo.email` pour afficher l'adresse du compte utilisé. Si cette information n'est pas disponible, l'état reste connecté et affiche le libellé générique `Compte Google connecté`.

À l'ouverture de la popup, `chrome.identity.getAuthToken({ interactive: false })` tente de réutiliser le cache Chrome. Cette restauration silencieuse permet de conserver l'affichage du compte et l'agenda sans demander une nouvelle interaction. Une absence de token est traitée comme une première connexion.
- `Autorisations incomplètes` ou refus utilisateur : message explicite, sans détail sensible.

Le code ne conserve pas le token après le callback. L'appel Agenda expire après huit secondes et supprime le token du cache Chrome en cas de réponse `401`. L'action de déconnexion appelle `clearAllCachedAuthTokens()` et vide les résultats en mémoire.

## Limites et décisions en attente

- Les appels Agenda et Meet doivent être vérifiés dans Chrome avec un compte de test autorisé ; les contrôles locaux ne remplacent pas ce test réel.
- L'export crée une nouvelle feuille et ne la partage pas automatiquement. `drive.file` et `spreadsheets` sont utilisés ensemble pour ce flux.
- La finalité pédagogique, l'information des participants, la conservation et la conformité de l'usage des données Meet doivent être validées avant toute collecte de présence.
- Le test Chrome doit utiliser l'identifiant d'extension réellement configuré dans le client OAuth et un compte Google de test.
