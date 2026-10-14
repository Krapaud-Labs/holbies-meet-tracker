# Test manuel du suivi autonome

Cette procédure vérifie le suivi sans couper ni terminer une réunion Google Meet.

## Préparation

1. Utiliser le profil Chrome Mickael avec le compte `@holbertonschool.com` déjà autorisé.
2. Créer un événement Agenda de test avec un lien Meet, au moins deux invités et une durée courte.
3. Recharger l'extension depuis `chrome://extensions` après la livraison de `dev`.
4. Laisser Chrome ouvert. Ne pas cliquer sur le bouton de fin du meeting pendant le test.

## Pendant la réunion

1. Ouvrir la popup de l'extension une fois pour vérifier le compte connecté.
2. Relever le message `Suivi arrière-plan actif` et l'heure du dernier cycle.
3. Faire rejoindre un invité à l'heure et un autre volontairement en retard.
4. Actualiser la popup sans analyser le Meet ouvert. Les invités non encore observés doivent rester `en attente`, jamais `absent`.
5. Vérifier que l'invité arrivé en retard est affiché `en retard` avec le nombre de minutes calculé.

## Après le meeting

1. Quitter normalement le meeting, sans action de fin depuis l'extension.
2. Attendre la fin Agenda plus dix minutes de marge, puis laisser Chrome effectuer un cycle.
3. Rouvrir la popup et vérifier que l'invité réellement absent est devenu `absent`.
4. Vérifier que le rapport HTML reprend les mêmes statuts.

## Preuves à conserver

- heure du dernier cycle affichée par la popup ;
- captures des statuts `en attente`, `en retard` et `absent` ;
- URL du rapport HTML ;
- résultat backend `GET /health` ;
- aucune capture ne doit contenir de jeton OAuth.

Un résultat « en attente » pendant la réunion est correct. L'extension ne peut pas garantir une précision absolue si Google ne fournit pas encore le compte rendu ou si l'autorisation OAuth expire ; elle conserve alors un état explicite plutôt que d'inventer un absent.
