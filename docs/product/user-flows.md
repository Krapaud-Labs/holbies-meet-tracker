# Flux utilisateur

## Cible MVP CR-001 / CR-004 / CR-008

1. Le mentor se connecte à Google et active explicitement l'export automatique dans les réglages. L'option est désactivée par défaut. L'autorisation de l'extension et l'authentification du collecteur VPS sont deux accès distincts; le second reste à concevoir, autoriser et sécuriser.
2. Le collecteur VPS lit les événements Agenda du compte mentor lié et planifie le job deux minutes avant l'heure prévue. Chrome et l'extension peuvent être fermés.
3. Pendant la réunion, le collecteur obtient le code Meet depuis l'événement, découvre le `conferenceRecord` actif et vérifie l'identité du mentor. Il peut lire transitoirement les identifiants Meet connectés, mais ne stocke, ne journalise et ne transmet aucun non-match. Il ne crée ni session ni rapport avant une correspondance positive.
4. Après confirmation de la participation du mentor, le collecteur attend `ConferenceRecord.endTime`, puis lit toutes les pages nécessaires. Le départ anticipé de tous les participants ne déclenche pas l'export avant la fin réelle de la conférence.
5. Si l'événement est annulé, la réunion ne démarre pas, le record est absent ou incomplet, ou l'accès échoue, le système affiche un état indisponible ou requiert une revue manuelle. Il ne transforme jamais une donnée manquante en absence.
6. Après fin réelle et pagination complète, le système distingue l'état de collecte du statut du rapport. Si toutes les identités étudiantes sont rapprochées, le rapport est « COMPLET »; sinon, les identités non résolues restent « à vérifier » et le rapport est « PARTIEL ». Aucune People API ni nouveau scope n'est ajouté. Le rapport Sheets est créé ou réconcilié dans `Holbies Meet Tracker/AAAA/MM - Mois/`, sous le nom `{nom de la réunion} - JJ/MM/AAAA`; un marqueur visible précède le tableau à sept colonnes. Une collecte ou pagination incomplète, ou une identité mentor non confirmée, bloque toute sortie. Aucun partage ni effacement automatique n'est effectué. Une issue incertaine n'entraîne pas une nouvelle création automatique.
7. Si Sheets échoue alors que Chrome est fermé, conserver temporairement dans le buffer VPS CR-009 le rapport complet ou PARTIEL, son statut durable et son contenu final, protégé et isolé par mentor. Le transférer à la popup après authentification, le supprimer après récupération réussie et le purger selon la durée positive fixée par l'établissement. Sans durée configurée, désactiver ce repli et l'export automatique.

Le fonctionnement avec un principal serveur pour les réunions organisées par un tiers, la correspondance de l'identité, l'authentification et la révocation OAuth serveur, la disponibilité du scheduler VPS, la réconciliation après job manqué, la sécurité, la rétention et le plafond partagé sans frais restent à concevoir ou à prouver. La finalité d'usage reste une hypothèse non approuvée; toute activation demeure suspendue.

## Comportement actuellement implémenté

1. L'utilisateur ouvre la popup, choisit « Se connecter avec Google » et charge les événements Agenda accessibles.
2. Il sélectionne un événement contenant un lien Meet ou analyse le Meet ouvert.
3. L'extension récupère les données Meet disponibles et affiche les statuts de présence.
4. L'utilisateur déclenche manuellement l'export Sheets; l'extension crée une nouvelle feuille à chaque export. HTML et CSV peuvent être téléchargés localement.
5. Le service worker Chrome peut aussi lancer un suivi périodique et envoyer les snapshots au backend VPS. Ce suivi tourne dans l'extension, exige que Chrome soit ouvert et ne vérifie pas d'abord la présence du mentor. Il ne constitue pas le collecteur VPS CR-008 et doit être neutralisé avant la livraison MVP.

Le backend VPS actuel reçoit et sert les sessions envoyées par l'extension; il ne planifie pas les réunions et ne possède pas l'authentification Google autonome nécessaire à CR-008. Le flux as-built ne satisfait donc pas encore la cible MVP automatique.
# Règles transversales de rapprochement et d’autorisation (CR-011/012)

- Invité Agenda, participant Meet, snapshot et événement backend ne sont associés que par leur e-mail complet normalisé identique. Le nom et la partie locale de l’adresse ne sont jamais des clés de repli. Deux e-mails explicites différents restent deux personnes distinctes.
- Un rapprochement uniquement nominal, anonyme, contradictoire, non corrélé ou incomplet donne le statut « à vérifier »; il ne contribue ni aux présents ni aux absents. Une ambiguïté n’est jamais résolue par l’ordre d’arrivée des lignes ou événements.
- Toute valeur de token Chrome est vérifiée comme chaîne non blanche avant état connecté, affectation du token courant et toute requête Google. En cas d’échec d’export, le token actif Agenda/Meet est conservé; l’interface affiche l’erreur générique et propose le CSV local.
