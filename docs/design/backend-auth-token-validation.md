---
title: Validation backend du jeton Google de l'extension
status: approved
last_updated: 2026-10-27
category: design
---

# Validation backend du jeton Google de l'extension

## Statut et portée

Cette conception cible l'authentification des requêtes backend émises après la connexion Google de l'extension. Elle ne prouve pas que le parcours de connexion du popup fonctionne depuis une installation du Chrome Web Store. Elle ne certifie pas non plus la configuration réelle du VPS.

Ce contrat ciblé a reçu une revue indépendante APPROVED après ajout de la vérification réelle de `audience` et `issued_to` au critère 19. Cette approbation ne valide ni la readiness globale du produit, qui reste `review`, ni l'endpoint d'access-token en production, le déploiement VPS ou le parcours CWS end-to-end.

La cible conserve le jeton d'accès actuellement fourni par `chrome.identity.getAuthToken()`. Elle n'ajoute aucun scope et ne prétend pas implémenter OpenID Connect. La demande antérieure `openid` reste distincte et non implémentée.

## Diagnostic de compatibilité

Le backend envoie actuellement un jeton d'accès à `https://oauth2.googleapis.com/tokeninfo?access_token=...`, puis cherche `aud`, `iss`, `email_verified` et `sub` dans la réponse.

Le Discovery document officiel OAuth2 API v2 décrit la méthode `tokeninfo` sur `https://www.googleapis.com/oauth2/v2/tokeninfo`, en `POST`, avec le paramètre `access_token` dans la requête. Son schéma `Tokeninfo` contient `audience`, `issued_to`, `verified_email`, `user_id`, `expires_in`, `scope` et, lorsque le scope e-mail est accordé, `email`. Il ne définit pas `aud`, `iss`, `email_verified` ou `sub` pour la réponse liée à un jeton d'accès. [Discovery document OAuth2 API v2](https://www.googleapis.com/discovery/v1/apis/oauth2/v2/rest)

Les champs `iss`, `sub`, `aud` et `email_verified` décrivent des claims d'ID token OIDC. Google documente le `tokeninfo` générique de `https://oauth2.googleapis.com/tokeninfo` comme un moyen de valider un ID token à des fins de débogage; ce contrat ne doit pas être confondu avec `tokeninfo(access_token)` d'OAuth2 API v2. [Référence OpenID Connect de Google](https://developers.google.com/identity/openid-connect/reference)

Le code actuel ne respecte donc pas le schéma documenté pour la valeur qu'il transmet. Si Google renvoie le schéma officiel de la réponse access-token, le backend rejette le jeton avant de créer ou lire une session. En outre, le contrôle actuel permet l'acceptation de n'importe quelle audience lorsque `GOOGLE_CLIENT_ID` est absent. Ces constats établissent un défaut statique du contrôle backend; ils ne prouvent pas la cause du message d'erreur du popup.

## Contrat cible de vérification

### Requête de validation

- Endpoint: `https://www.googleapis.com/oauth2/v2/tokeninfo`.
- Méthode: `POST`, telle que déclarée par le Discovery document OAuth2 API v2.
- Paramètre: `access_token`, transmis conformément au paramètre de requête documenté.
- Transport: HTTPS seulement.
- Le jeton et l'URL contenant le paramètre ne doivent jamais être consignés dans les journaux applicatifs, traces, métriques ou messages d'erreur. Les outils d'observabilité et les journaux de proxy sortants doivent masquer le paramètre `access_token`.
- Une réponse autre que HTTP succès, non JSON, incomplète, mal typée ou expirée est refusée. Aucun corps brut fourni par Google ne doit remonter au client.

### Configuration du client OAuth

- `GOOGLE_CLIENT_ID` est obligatoire pour le chemin backend qui accepte des jetons. Une valeur absente, blanche ou mal formée entraîne un refus fermé; elle ne désactive jamais la comparaison d'audience.
- Un seul client Google est admis: le client OAuth Chrome Extension associé à l'unique item CWS du produit. Le backend exige `audience === GOOGLE_CLIENT_ID` et `issued_to === GOOGLE_CLIENT_ID`. Le Discovery document indique que `audience` et `issued_to` sont en général identiques; exiger les deux valeurs identiques à la configuration évite d'accepter un jeton destiné à une autre application ou un résultat incohérent.
- Aucun ID CWS ou client ID réel n'est inscrit dans le code, les exemples publics ou les tests. La même valeur de configuration doit être injectée de façon privée dans le déploiement et alignée avec la configuration OAuth approuvée.
- Il n'y a pas de liste de clients de développement ou de clients historiques implicite. Un client secondaire exigerait une décision et une conception séparées.

### Mapping strict de la réponse

La vérification retourne l'identité backend uniquement si toutes les assertions suivantes sont vraies:

1. Le jeton d'entrée est une chaîne non vide et le tokeninfo répond avec succès.
2. La configuration `GOOGLE_CLIENT_ID` est présente et `audience` ainsi que `issued_to` lui sont strictement égaux.
3. `verified_email` est le booléen JSON `true` et `email` est une chaîne non vide.
4. L'adresse satisfait la règle de domaine existante `ALLOWED_EMAIL_DOMAIN`, sans assouplissement de suffixe ni ajout de domaines dans cette correction.
5. `scope` est une chaîne dont la séparation sur les espaces contient exactement le scope requis `https://www.googleapis.com/auth/meetings.space.readonly` comme élément complet.
6. `expires_in` est un entier fini strictement supérieur à zéro.
7. `user_id` est une chaîne non vide et devient l'identifiant stable `subject` interne. Le code ne lit pas `sub` sur cette réponse.

Le contrôle ne tente pas de lire `iss` ou `aud` sur cette réponse access-token. L'endpoint HTTPS de Google est fixé dans le code et la réponse validée vient de cet endpoint. Une erreur réseau, un timeout, une incohérence de champs ou une valeur absente refuse la requête sans révéler l'état de configuration au client.

### Distinction OAuth access-token et OIDC

Le manifeste courant demande des scopes Meet, Calendar et `userinfo.email`, sans `openid`. `chrome.identity.getAuthToken()` fournit ici le jeton d'accès utilisé par Google APIs; le backend n'a pas d'ID token signé à valider dans ce contrat.

Ce correctif reste une validation d'access-token avec le schéma OAuth2 API v2. Il ne doit pas être présenté comme OIDC. Une conception future qui demande `openid` devrait décrire le flux qui délivre un ID token, vérifier signature/JWKS, `iss`, `aud`, expiration et claims requis, et faire l'objet d'une décision et d'une revue séparées. Aucune portée ne change dans le présent lot.

## Autorisation des mentors et de l'extension

- Le filtre `ALLOWED_EMAIL_DOMAIN` actuel demeure la seule règle d'adresse couverte par ce lot. Il ne prouve pas qu'un compte appartient au groupe des mentors.
- CR-016, qui demande une autorisation via Google Group administré, demeure distincte, en revue et non conçue. Aucun scope Directory API, appel Workspace, changement OAuth ou contrôle de membre de groupe n'est ajouté ici.
- `ALLOWED_EXTENSION_ORIGIN` devient une configuration requise de déploiement, avec une seule origine exacte et aucun ID réel commité. Format accepté: `chrome-extension://` suivi de 32 lettres minuscules de `a` à `p`, sans chemin, slash final, wildcard, espace, query, fragment ou liste.
- Une variable absente ou invalide fait échouer le démarrage avec une erreur de configuration non sensible et exploitable. Aucun fallback vers l'ancien identifiant, aucun wildcard et aucune origine dérivée d'un en-tête entrant ne sont acceptés.
- Les réponses CORS ne sont renvoyées qu'à cette origine exacte. La route de ticket WebSocket et la mise à niveau WebSocket utilisent la même comparaison exacte.
- CORS et l'en-tête `Origin` ne sont pas une authentification: les clients non navigateur peuvent falsifier cet en-tête. Toute session et tout ticket continuent d'exiger une vérification Bearer; la propriété d'une session continue d'être vérifiée côté serveur.

## Impact et préconditions de déploiement

- Avec l'origine par défaut historique, un navigateur exécutant l'extension depuis l'Item CWS courant peut ne pas recevoir l'en-tête CORS attendu; les appels backend échouent même si Google a délivré un jeton valide. Le ticket et le flux WebSocket refusent aussi une origine différente de la valeur configurée.
- Rendre l'origine obligatoire rend incompatibles les environnements qui ne la définissent pas. Avant leur redémarrage, chaque déploiement doit recevoir sa valeur exacte dans son environnement privé; aucun ID réel ne doit être ajouté au dépôt public. Une mauvaise valeur provoquera un échec de démarrage ou bloquera toutes les requêtes navigateur de l'extension.
- La modification ne doit pas être déployée sur le VPS avant la présence et la vérification des valeurs `GOOGLE_CLIENT_ID` et `ALLOWED_EXTENSION_ORIGIN` dans sa configuration privée. Le dépôt ne prouve pas leur état actuel sur l'hôte.
- Le filtre e-mail existant ne distingue pas les mentors des autres comptes du même domaine. Un essai négatif fondé sur un compte hors domaine valide seulement ce filtre; il ne prouve pas CR-016 ni une autorisation par groupe.

## Tests exigés

### Tokeninfo et identité

1. Réponse access-token positive selon le schéma documenté, avec `audience` et `issued_to` égaux au client configuré, `verified_email: true`, scope Meet, expiration positive, e-mail autorisé et `user_id` non vide: identité stable construite avec `user_id`.
2. `GOOGLE_CLIENT_ID` absent ou blanc: refus fermé avant tout appel Google. Un test isolé doit définir la configuration avant le chargement du module pour éviter une valeur capturée dans l'environnement du développeur.
3. `audience` absent, discordant ou différent du client attendu: refus.
4. `issued_to` absent, discordant ou différent du client attendu: refus.
5. E-mail absent, non vérifié, mal formé ou hors du domaine configuré: refus.
6. Scope Meet absent, partiel ou ressemblant seulement au nom du scope: refus.
7. `expires_in` absent, non entier, nul, négatif ou non numérique: refus.
8. `user_id` absent, vide ou mal typé: refus; `sub` seul ne suffit pas.
9. Réponse avec seulement `aud`, `iss`, `email_verified` et `sub` (claims ID-token): refus pour le contrat access-token.
10. Jeton vide, réponse HTTP non-success, JSON invalide, timeout et erreur réseau: refus; aucun appel métier/backend ne suit.
11. Vérifier qu'aucun jeton, URL de requête tokeninfo, e-mail ou corps brut n'est écrit dans la console, les erreurs ou les diagnostics publics.

### Origine CWS et configuration

12. Variable d'origine absente, vide ou invalide: le processus refuse le démarrage avec un diagnostic actionnable qui ne contient aucune donnée sensible.
13. Origine conforme configurée: préflight `OPTIONS` retourne le seul `Access-Control-Allow-Origin` exact attendu.
14. Ancienne origine, origine quelconque, wildcard, chemin, port, fragment, query, casse ou caractères invalides: refus, aucune réponse CORS autorisant la requête.
15. Ticket WebSocket et mise à niveau: origine exacte seulement; mauvais jeton, mauvaise origine, session d'un autre mentor ou ticket expiré/consommé restent refusés.
16. Health check et webhook Google restent couverts séparément; leur disponibilité ne permet pas de contourner la configuration d'origine des routes d'extension.

### Non-régression et preuve réelle

17. Le manifeste et la liste de scopes restent inchangés; aucun `openid` ou scope Directory n'est introduit par ce correctif.
18. Les tests d'intégration isolés utilisent un faux serveur tokeninfo et un faux client ID de test; aucun compte ou token réel n'est stocké.
19. Un essai end-to-end reste requis depuis une installation CWS privée approuvée: pour un compte Google de test autorisé, le backend vérifie en direct que `audience` et `issued_to` sont chacun strictement égaux à `GOOGLE_CLIENT_ID`, puis la session et les appels backend réussissent; un compte hors du domaine permis est refusé par la règle existante. La preuve consigne uniquement le résultat booléen et les codes d'étape non sensibles: ni jeton, ni URL tokeninfo avec paramètre, ni payload Google ne sont conservés. Ce test ne prouve pas qu'un membre non mentor du domaine serait refusé; cette propriété attend la conception et l'implémentation distinctes de CR-016. Les mocks ne remplacent pas cette preuve.

## Limites et portes de production

Google décrit l'endpoint générique `oauth2.googleapis.com/tokeninfo` dans la référence OIDC comme destiné à valider des ID tokens à des fins de débogage, pas comme une validation OIDC de production. La méthode access-token du Discovery OAuth2 API v2 est documentée séparément, mais sa stabilité et sa pertinence opérationnelle pour l'usage production de cette extension doivent être démontrées avant toute activation durable. Tant que ce point n'est pas établi par un appel réel contrôlé ou une confirmation officielle adaptée, garder le déploiement en revue et ne pas annoncer la validation de production.

L'échec actuel du popup local `bad client id` est expliqué par le décalage entre l'identifiant de l'extension unpacked et l'Item ID CWS configuré pour OAuth. La correction du validateur backend traiterait un défaut distinct, après obtention du jeton; elle ne prouve pas que le popup a réussi son authentification Google. Les deux résultats doivent rester séparés dans les preuves.

## Références vérifiées le 2026-10-27

- [Discovery document Google OAuth2 API v2](https://www.googleapis.com/discovery/v1/apis/oauth2/v2/rest): méthode `oauth2.tokeninfo`, chemin versionné, verbe HTTP, emplacement du paramètre et schéma de réponse.
- [Référence Google OpenID Connect](https://developers.google.com/identity/openid-connect/reference): claims d'ID token et limite documentée de l'endpoint OIDC tokeninfo pour le débogage.
- [Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/api/identity): `getAuthToken` et accès OAuth des extensions Chrome.
- [Clé du manifeste Chrome](https://developer.chrome.com/docs/extensions/reference/manifest/key): origine/identité stable d'une extension distribuée.

Ces références prouvent le contrat documentaire consulté, pas la stabilité future de l'endpoint access-token, la configuration réelle de l'environnement, l'appartenance au groupe mentor, l'approbation Google ou le succès d'une authentification CWS.
