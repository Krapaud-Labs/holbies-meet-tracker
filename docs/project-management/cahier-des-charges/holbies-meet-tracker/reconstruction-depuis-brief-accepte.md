# Cahier des charges projet

## Statut

accepted

## Vision et problème à résoudre

Holbies Meet Tracker est une extension Google Chrome destinée au suivi des présences et des retards des étudiants lors de réunions Google Meet programmées dans Google Agenda. Elle compare les invités de l'événement aux participants détectés dans Meet, puis enregistre un compte rendu dans Google Sheets.

## Utilisateurs concernés

Les personnes qui animent ou suivent des réunions avec des étudiants. Les étudiants suivis sont ceux dont l'adresse e-mail figure dans la liste des invités de l'événement Google Agenda associé.

## Objectifs mesurables

- Détecter une réunion Meet à laquelle l'utilisateur se connecte.
- Retrouver l'événement Google Agenda correspondant et ses invités.
- Relever les participants, leurs heures d'arrivée et de départ, puis les associer par adresse e-mail.
- Classer chaque étudiant à l'heure, en retard ou absent selon une tolérance de 2 minutes.
- Signaler les participants non reconnus ou ambigus.
- Enregistrer automatiquement le compte rendu à la sortie de la réunion.

## Fonctionnalités attendues

1. Détecter la réunion Meet active et retrouver l'événement Google Agenda associé.
2. Récupérer le titre, la date, l'heure de début, les invités et le lien Meet.
3. Lire la liste des participants Meet et suivre leurs apparitions, sorties et reconnexions.
4. Associer les participants aux étudiants invités par adresse e-mail.
5. Produire les statuts à l'heure, en retard ou absent.
6. Signaler les participants non reconnus, les e-mails indisponibles et les identifications ambiguës.
7. Créer un onglet Google Sheets distinct par réunion avec prénom, nom, date, réunion, arrivée, départ et statut.
8. Gérer les échecs d'enregistrement dans Google Sheets avec une information exploitable par l'utilisateur.

## Hors périmètre

- Les réunions auxquelles l'utilisateur ne se connecte pas.
- La collecte de données non nécessaires au suivi des présences.
- La résolution automatique des identités ambiguës ou des participants sans e-mail.

## Contraintes

- Extension Google Chrome.
- Intégrations Google Meet, Google Agenda et Google Sheets.
- Autorisations nécessaires pour consulter les événements Agenda et écrire dans Sheets.
- Collecte limitée aux données utiles au suivi des présences.
- Aucun budget, délai ou technologie supplémentaire n'est imposé dans le cahier reçu.
- La faisabilité de l'accès aux e-mails et aux heures d'arrivée et de départ dans Meet doit être vérifiée pendant la conception.

## Critères de réussite

- La réunion Meet de l'utilisateur est détectée.
- L'événement Agenda correspondant et ses invités sont récupérés.
- Les participants sont comparés aux invités par e-mail lorsque l'information est disponible.
- Les heures d'arrivée et de départ sont relevées.
- Le délai de grâce de 2 minutes est appliqué correctement.
- Les absents sont identifiés.
- Les participants inconnus ou ambigus sont signalés.
- Un onglet dédié est créé dans Google Sheets avec les informations attendues.

## Informations manquantes ou décisions attendues

- API et mécanisme exacts d'accès aux participants et aux horaires dans Google Meet.
- Parcours d'autorisation Google OAuth, stockage local et traitement des erreurs.
- Format exact des noms d'onglets et comportement en cas de doublon.
- Stratégie de reprise lorsque l'écriture dans Google Sheets échoue.
- Navigateurs et environnements Chrome ciblés pour les tests.
- Délai, équipe, budget et exigences réglementaires, non précisés dans le cahier.
- Trello : désactivé à la demande de l'utilisateur.

## Décisions de complétude validées

- Accès Meet : API Google Meet officielle en priorité.
- Authentification : OAuth 2.0 avec stockage local minimal.
- Échec Sheets : réessais automatiques puis export local JSON/CSV.
- Onglets doublons : nom déterministe avec suffixe.
- Cible initiale : Chrome stable sur macOS et Linux.
- Équipe et délai : non précisés à ce stade.
