---
title: Diagnostic du parcours de connexion Google
status: approved
last_updated: 2026-10-26
category: design
---

# Diagnostic du parcours de connexion Google

## Statut et portée

Cette conception ciblée est approuvée. Cette approbation ne vaut ni approbation de la readiness globale du produit ni validation de la configuration OAuth réelle. Le document décrit comment rendre une erreur de connexion compréhensible et sûre, sans confirmer la cause de l'échec observé sur un compte particulier ni autoriser une modification de scope OAuth. Le code actuel peut ramener plusieurs erreurs de `chrome.identity.getAuthToken()` et de validation de session au même texte générique.

Le périmètre couvre l'authentification déclenchée par le bouton de la popup, la restauration silencieuse d'une session, l'obtention de l'identité d'affichage et le chargement initial de l'agenda. Une erreur d'agenda après obtention d'un jeton ne doit pas être présentée comme un échec de connexion.

## Protection des diagnostics

Le diagnostic est produit à partir d'une liste fermée de catégories internes et de codes stables. Aucun texte d'erreur brut provenant de Chrome, de Google ou d'une réponse HTTP n'est repris dans l'interface, les journaux ou un rapport exporté. Une valeur non reconnue produit `AUTH_UNKNOWN`.

Les seuls champs de diagnostic autorisés dans un journal local éventuel sont le code de catégorie et une étape choisie dans une liste fermée : `token_request`, `token_validation`, `profile_lookup` ou `calendar_bootstrap`. Les champs suivants sont interdits dans le DOM de diagnostic, les messages, la console, les journaux et les preuves : jeton d'accès, jeton d'identité, adresse e-mail, URL ou paramètre de redirection, corps de requête ou de réponse, profil utilisateur, en-tête HTTP et message d'erreur brut.

L'affichage distinct du compte connecté, lorsqu'il est disponible, reste séparé du diagnostic d'erreur. Un échec de lecture du profil n'annule pas une connexion dont le jeton a été validé. L'erreur n'affiche jamais l'e-mail du compte ni ne le recopie dans un message ou un journal.

## Catégories et matrice d'action

Le code visible est non secret et ne contient ni compte, ni scope, ni valeur issue de l'erreur brute. Les catégories doivent être assignées uniquement si un signal reconnu permet de le faire; une ambiguïté retombe sur `AUTH_UNKNOWN`.

| Code | Situation reconnue | Message accessible et action | État attendu |
|---|---|---|---|
| `AUTH_CANCELLED` | L'utilisateur ferme ou refuse explicitement la demande Google, selon un signal reconnu | « Connexion annulée. Vous pouvez réessayer avec le bouton. » | Déconnecté; bouton réactivé; aucun changement de scope automatique |
| `AUTH_SIGN_IN_REQUIRED` | Chrome indique qu'une session Google ou une interaction utilisateur est nécessaire | « Connectez-vous à Google dans Chrome, puis réessayez ici. » | Déconnecté; aucune boucle interactive automatique |
| `AUTH_PERMISSION_INCOMPLETE` | Une autorisation requise est explicitement absente ou refusée | « Autorisation incomplète. Réessayez et examinez les accès demandés. » | Déconnecté ou fonction dépendante indisponible; aucune demande élargie silencieuse |
| `AUTH_CONFIGURATION` | Erreur reconnue de configuration client OAuth, origine/identifiant d'extension ou application | « Connexion indisponible. Communiquez le code AUTH_CONFIGURATION au support. » | Échec visible; ne pas demander à l'utilisateur de changer son compte |
| `AUTH_TIMEOUT` | Le délai local configuré est dépassé | « Google met trop de temps à répondre. Réessayez. Code : AUTH_TIMEOUT. » | Déconnecté; réessai explicite seulement |
| `AUTH_NETWORK` | Erreur réseau temporaire reconnue pendant la demande de jeton | « Connexion Google temporairement indisponible. Réessayez. Code : AUTH_NETWORK. » | Déconnecté; réessai explicite seulement |
| `AUTH_TOKEN_INVALID` | Résultat absent ou jeton non conforme au contrat local de validation | « La connexion n'a pas abouti. Relancez-la depuis ce bouton. Code : AUTH_TOKEN_INVALID. » | Aucun état connecté et aucun appel API |
| `AUTH_UNKNOWN` | Cause non classée avec confiance | « Connexion impossible pour le moment. Réessayez; si le problème persiste, communiquez le code AUTH_UNKNOWN au support. » | Déconnecté; détail brut non exposé |
| `PROFILE_UNAVAILABLE` | Le jeton est valide, mais l'information facultative de profil ne peut pas être récupérée | « Compte Google connecté. Les détails du compte ne sont pas disponibles. » | Connecté; poursuivre l'agenda si son autorisation est valide |
| `CALENDAR_PERMISSION_INCOMPLETE` | Le jeton est valide, mais le chargement d'agenda est explicitement refusé pour autorisation insuffisante | « Connexion réussie, mais l'agenda n'est pas autorisé. Vérifiez les accès puis reconnectez-vous. » | Connecté; agenda indisponible; erreur distincte de connexion |
| `CALENDAR_UNAVAILABLE` | Échec réseau, délai dépassé ou réponse non exploitable au démarrage de l'agenda | « Connexion réussie, mais l'agenda est momentanément indisponible. Réessayez. » | Connecté; données Agenda non remplacées par un succès simulé |

La classification repose sur une correspondance fermée avec les signaux effectivement disponibles dans l'API et le navigateur ciblés. La présence d'un mot dans un texte d'erreur arbitraire ne suffit pas à attribuer une catégorie configuration, permission ou annulation. Les chaînes Chrome doivent être vérifiées dans les environnements ciblés avant leur ajout à la table de correspondance.

## Accessibilité et comportement de popup

L'état de connexion continue d'être annoncé par l'élément `#auth-status` avec `role="status"`, `aria-live="polite"` et `aria-atomic="true"`. Le message d'erreur comprend le code de diagnostic quand il aide à la prise en charge, ainsi qu'une action compréhensible. Aucun message n'est injecté comme HTML.

Après un échec, le bouton de connexion est réactivé et le focus clavier reste sur ce bouton. Le texte d'état n'est pas rendu focusable et ne provoque pas de déplacement de focus. Le bouton conserve son association `aria-describedby` vers l'état; une annonce ne doit pas être répétée par plusieurs régions live. Un dialogue ou écran Google externe éventuel ne doit pas déclencher une tentative interactive automatique au retour dans la popup.

La restauration silencieuse `interactive: false` n'affiche pas d'erreur à chaque absence normale de jeton. Elle laisse l'état « connexion requise » disponible. Seule une action explicite de connexion lance le parcours interactif.

## Choix OpenID à résoudre avant tout changement de manifeste

La décision utilisateur enregistrée demande de concevoir un flux OpenID avec le scope `openid`. Le manifeste actuellement suivi déclare `https://www.googleapis.com/auth/userinfo.email`, mais pas `openid`; le code interroge `/oauth2/v2/userinfo` et `getAuthToken()` fournit un jeton d'accès. Les tests de popup simulent encore un manifeste différent du vrai manifeste. Cet écart est confirmé, mais il ne prouve pas la cause de la panne constatée.

L'orientation demandée est de concevoir une authentification OpenID avec `openid`. C'est une cible souhaitée, pas encore une architecture validée, et elle ne permet pas de qualifier l'implémentation actuelle d'OIDC. Avant toute modification de `manifest.json` ou du client OAuth, il faut confirmer, avec la documentation officielle et un environnement autorisé, le contrat exact entre `chrome.identity.getAuthToken()`, le scope OIDC à demander, la récupération des revendications nécessaires et l'usage d'e-mail déjà attendu par les règles de domaine. En particulier, il faut décider si l'identité est établie par le point d'accès UserInfo avec un jeton d'accès ou par un autre flux OIDC, et documenter les revendications minimales.

Jusqu'à cette preuve, le manifeste conserve ses scopes actuels. Ne pas ajouter `openid`, `email`, `profile`, un scope Sheets/Drive ou tout autre scope par opportunisme. Ne pas déclarer le flux actuel OIDC tant que le contrat identité/claims n'est pas vérifié. Les scopes d'API restent séparés des scopes d'identité et suivent l'autorisation incrémentale prévue par la conception d'export.

## Matrice de non-régression à implémenter après validation

Cette matrice définit les contrôles requis pour une implémentation future. Aucun test produit n'est exécuté ou déclaré réussi par ce document.

| Cas | Signal d'entrée contrôlé | Assertions attendues |
|---|---|---|
| Refus ou fermeture de consentement | Erreur simulée reconnue, sans donnée de compte | Code `AUTH_CANCELLED`, action de réessai, focus conservé, aucun fetch |
| Session/interaction requise | Rejet Chrome connu sur la demande interactive | Code ciblé; aucune tentative automatique en boucle |
| Autorisation partielle | Résultat avec portée manquante selon le contrat validé | Échec de la seule fonction qui exige cette portée; aucun ajout de scope silencieux |
| Erreur de configuration | Signal OAuth de configuration connu | `AUTH_CONFIGURATION`; texte brut absent de l'UI et des journaux |
| Erreur inconnue | Texte arbitraire contenant des chaînes sensibles factices | `AUTH_UNKNOWN`; aucune chaîne brute, URL, jeton, adresse ou payload divulgué |
| Jeton absent, blanc ou non textuel | Résultat invalide du fournisseur | Aucun état connecté; zéro appel Google/backend avec Bearer |
| Délai dépassé / réseau | Timeout ou rejet réseau déterministe | Code de catégorie; bouton réactivé; aucun secret dans le message |
| Profil indisponible après token valide | UserInfo 403/5xx ou réseau | Connexion conservée; état de profil distinct; aucun e-mail exposé par le diagnostic |
| Agenda refusé après connexion | Réponse 403 contrôlée | Connexion reste réussie; erreur d'agenda distincte et action correspondante |
| Accessibilité | Chaque transition d'erreur | Mise à jour de la région live existante en poli, annonce unique, focus sur le déclencheur |
| Alignement manifeste | Harness lisant le vrai `manifest.json` | Aucun manifeste simulé divergent; aucune assertion de scope non décidé |

Les tests doivent isoler les erreurs sans authentification Google réelle et couvrir explicitement les limites de sécurité. Un essai manuel avec un compte de test demeure nécessaire pour vérifier la configuration client et les messages réellement produits par Chrome; il ne doit jamais être remplacé par des mocks.

## Limites et preuve de cause

L'implémentation ciblée remplace maintenant le message générique par des catégories allowlistées et garde `AUTH_UNKNOWN` lorsque le signal n'est pas reconnu. La tentative qui a produit `AUTH_UNKNOWN` a été attribuée à une erreur `bad client id` sur la copie locale unpacked : l'ID de cette copie ne correspondait pas à l'Item ID associé au client OAuth Chrome Extension. Cette preuve explique cette installation locale uniquement; elle ne prouve ni un défaut ni un succès du paquet Chrome Web Store.

L'utilisateur a précisé que la cible est une installation normale depuis le Chrome Web Store, sans parcours local/unpacked. Le client OAuth Cloud est maintenant associé à l'Item ID du brouillon CWS, mais la fiche reste non publiée. L'audience OAuth est `Externe` en mode `Test`, avec seulement deux comptes de test; les autres mentors ne peuvent donc pas utiliser l'application dans cet état. Aucun essai d'authentification depuis un paquet installé du Store n'est établi. La connexion de production reste non vérifiée et nécessite un paquet installable ainsi qu'une audience/autorisations permettant les mentors prévus.

L'appel interactif `getAuthToken()` et son `catch` sont dans `popup.js`, pas dans le service worker. La console du service worker ne montre donc pas ce rejet. La cause locale ayant déjà été établie, ne pas demander à l'utilisateur de refaire un essai unpacked ni de copier une erreur brute. Toute nouvelle attribution doit se faire depuis le parcours CWS cible, en ne conservant que des catégories non sensibles; aucun jeton, e-mail, URL de redirection, identifiant client, en-tête, payload ou message brut ne doit entrer dans les preuves ou issues.

## Références officielles consultées le 2026-10-26

- [Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/api/identity) : contrat de `getAuthToken`, résultat du jeton, portées accordées et origine de l'interaction.
- [OpenID Connect de Google](https://developers.google.com/identity/openid-connect/openid-connect) : scopes requis pour OIDC et point UserInfo.
- [Scopes OAuth 2.0 de Google](https://developers.google.com/identity/protocols/oauth2/scopes) : scopes d'identité et d'API disponibles.
- [Utiliser OAuth 2.0 pour accéder aux API Google](https://developers.google.com/identity/protocols/oauth2) : consentement et traitement des portées accordées.
- [Clé de manifeste Chrome](https://developer.chrome.com/docs/extensions/reference/manifest/key) : stabiliser l'identifiant de l'extension en développement.
- [Clients OAuth Google Cloud](https://support.google.com/cloud/answer/15549257) : gérer les clients d'authentification.

Ces références documentent les contrats généraux. Elles ne prouvent ni l'approbation de l'application OAuth, ni la disponibilité de l'extension dans le Store, ni le succès d'une connexion CWS avec un mentor autorisé.
