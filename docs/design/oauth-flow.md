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

Les appels réels aux API Google ne sont pas encore implémentés. Aucun `host_permissions` n'est donc ajouté à ce stade. Toute permission réseau future devra être limitée aux domaines et appels réellement nécessaires.

## États et erreurs

- `Connexion requise` : aucun jeton demandé automatiquement.
- `Connexion en cours` : bouton désactivé et message annoncé par `aria-live`.
- `Compte Google connecté` : succès uniquement si un token et tous les scopes déclarés sont retournés.
- `Autorisations incomplètes` ou refus utilisateur : message explicite, sans détail sensible.

Le code ne conserve pas le token après le callback. Lorsqu'un appel API futur recevra une réponse `401`, il devra appeler `chrome.identity.removeCachedAuthToken()` puis demander un nouveau token. Une action de déconnexion avec `clearAllCachedAuthTokens()` devra être conçue avant une livraison fonctionnelle complète.

## Limites et décisions en attente

- Le prototype ne vérifie pas encore un appel réel Meet, Agenda ou Sheets.
- `drive.file` devra être confirmé avec le choix du classeur cible.
- La finalité pédagogique, l'information des participants, la conservation et la conformité de l'usage des données Meet doivent être validées avant toute collecte de présence.
- Le test Chrome doit utiliser l'identifiant d'extension réellement configuré dans le client OAuth et un compte Google de test.
