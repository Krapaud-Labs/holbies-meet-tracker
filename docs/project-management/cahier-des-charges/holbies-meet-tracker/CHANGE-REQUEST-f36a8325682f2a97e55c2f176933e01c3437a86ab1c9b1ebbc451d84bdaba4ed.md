# CR-011/012 : corriger la collision d'identités et l'export OAuth invalide

Empreinte SHA-256 de la réponse utilisateur UTF-8, sans saut de ligne final : `f36a8325682f2a97e55c2f176933e01c3437a86ab1c9b1ebbc451d84bdaba4ed`.

Statut : accepté au MVP le 2026-10-24, par la demande de corriger « en même temps ce genre de défaut ». Cette demande est distincte du cahier initial historique; elle ne le remplace pas.

## CR-011 / QLT-003 : collision d'identités

- **Demande utilisateur source :** « Il faut corriger en même temps ce genre de défaut au moins c'est fait ».
- **Constat prouvé :** l'extension et le backend peuvent fusionner des personnes aux identifiants étudiants ou e-mails forts contradictoires lorsqu'elles partagent un nom normalisé. Les tests existants vérifient des alias supposés équivalents, pas les collisions, ponts ambigus, permutations ou transitivité.
- **Impact :** faux décompte de présence/absence, fusion des arrivées et départs de personnes distinctes, résultat dépendant de l'ordre d'observation.
- **Décision :** correction produit acceptée au MVP. La clé e-mail est trimée et normalisée Unicode NFC; sa partie locale reste sensible à la casse et son domaine est comparé en minuscules. Points et suffixes `+` restent inchangés. Aucun provider ID ni alias n'est utilisé dans le périmètre courant. Des e-mails différents ne se fusionnent pas via le nom. Les chemins Agenda/Meet et les calculs backend appliquent la même règle dès que les deux sources fournissent un e-mail. Toute correspondance nominale, contradictoire, un-à-plusieurs, non corrélée ou issue d'une pagination incomplète reste « à vérifier », sans compter présence ou absence. `absent` exige la fin réelle et un roster complet sans correspondance ni candidat ambigu par email.
- **Limite de faisabilité et arbitrage de sortie :** Meet fournit `signedinUser.user` et `displayName`, pas l'e-mail étudiant. People API exigerait `directory.readonly` et l'administrateur Workspace devrait activer le partage externe des profils. Le 2026-10-24, l'utilisateur choisit de garder les identités sans clé commune « à vérifier », sans People API ni scope supplémentaire, et accepte l'export Sheets/CSV d'un rapport « PARTIEL » après collecte et pagination complètes. Les lignes incertaines ne comptent ni en présence ni en absence et le rapport n'est jamais présenté comme complet. Le buffer CR-009 préserve le statut. Un ajout ultérieur de source d'identité nécessite un CR séparé. Sources officielles consultées le 2026-10-24 : [Participant Meet](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.participants), [guide participants Meet](https://developers.google.com/workspace/meet/api/guides/participants).
- **Dépendances :** règle d'identité déterministe partagée entre extension et backend; conserver les rapprochements sûrs déjà couverts; tests d'égalité, collision, pont ambigu, transitivité et permutations; revue QA indépendante.

## CR-012 / QLT-004 : token OAuth Sheets absent ou invalide

- **Demande utilisateur source :** même réponse ci-dessus, visant les défauts qualité nommés juste avant dans le fil.
- **Constat prouvé :** après le consentement Sheets interactif, un résultat sans token non vide peut être interpolé dans l'en-tête `Authorization` et déclencher des requêtes/réessais avec `Bearer undefined`, `Bearer null` ou une valeur vide.
- **Impact :** requêtes inutiles avec authentification invalide, erreurs opaques et retries, risque d'utiliser une valeur falsy inattendue comme credential. La même validation de type est appliquée à tout retour OAuth utilisé avant les requêtes userinfo et Agenda.
- **Décision :** correction produit acceptée au MVP. Si le résultat OAuth ne contient pas une chaîne non vide, l'export échoue fermé avant tout appel réseau et conserve le fallback CSV local.
- **Dépendances :** contrat de validation appliqué avant toute requête Sheets/Drive; tests `null`, `undefined`, propriété absente, chaîne vide/blanche, `false` et `0`, ainsi qu'un token valide; revue sécurité et QA.

## Périmètre, limites et preuves

Le correctif est limité aux deux constats QLT nommés, à leurs chemins de rapprochement complets, à leurs tests et à la documentation nécessaire. Les autres demandes CR, l'export Sheets automatique, le worker VPS et tout appel Google réel restent hors de ce changement. Aucun credential, compte de test ou service Cloud n'est autorisé.

Preuves initiales : revue QA read-only et tests locaux du 2026-10-24; revue indépendante de l'Auditeur; lignes courantes dans `attendance.js`, `backend/src/live.js`, `popup.js`, `tests/attendance.test.js`, `backend/test/live.test.js` et `tests/popup-export.test.js`. La conception technique doit être approuvée avant le code.
