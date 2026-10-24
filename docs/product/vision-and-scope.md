# Vision et périmètre

> **Statut : baseline de travail reconstituée, origine non certifiée.** Les décisions CR-001 à CR-003 du 2026-10-23 sont consignées dans [`la demande de changement dédiée`](../project-management/cahier-des-charges/holbies-meet-tracker/CHANGE-REQUEST-28a8e6521495644f0996d40e626d1dfd5a6216c7acb35c4823cce4bb2bf2652b.md). Les capacités présentes dans le code ne deviennent pas MVP sans décision documentée.

## Vision

Réduire le travail manuel nécessaire pour vérifier la présence à des réunions pédagogiques Google Meet, en donnant une lecture locale et compréhensible des participants.

## Périmètre historique reconstitué et cible décidée

- connexion Google déclenchée par l'utilisateur ;
- lecture en lecture seule des événements Agenda ;
- détection des liens Meet dans l'événement ;
- récupération des participants et sessions Meet ;
- statuts à l'heure, en retard, absent ou identité à vérifier ;
- selon CR-001 et CR-004, export Google Sheets automatique des réunions auxquelles participe le compte Google connecté, y compris celles organisées par un autre mentor, sans rapport inter-mentors. L'export doit être activé au préalable et utiliser un fallback récupérable à la prochaine ouverture. Pour un rapport généré par le VPS lorsque Chrome est fermé, CR-009 autorise un buffer serveur temporaire, protégé et purgé selon la durée fixée par l'établissement; le transfert à la popup est authentifié et le buffer est supprimé après récupération réussie. La couverture technique de réunions dont ce compte n'est pas l'organisateur reste à concevoir et à prouver; la limite actuelle documentée de `conferenceRecords.list` ne change pas l'exigence utilisateur. Avant présence mentor confirmée, le collecteur VPS peut lire transitoirement les identifiants nécessaires au contrôle, mais ne persiste aucun participant, ne journalise ni ne transmet les non-matchs, et ne crée ni session backend ni rapport. L'activation reste suspendue jusqu'à approbation de la finalité et démonstration d'un plafond partagé sans frais. La mise en œuvre actuelle demande un clic et synchronise tout le roster au backend sans cette garde; elle ne satisfait pas la cible MVP.
- selon CR-008/CR-010 acceptés au MVP, démarrer la collecte serveur deux minutes avant l'horaire prévu même si Chrome et l'extension sont fermés, puis finaliser le rapport après la fin réelle de Meet, même si tous ont quitté avant. Le refresh token est chiffré et isolé par mentor, révocable et supprimé à la déconnexion; le détail technique reste à concevoir. La fenêtre de démarrage tardif est une durée positive configurée par l'établissement, sans défaut. Une couverture fiable de toutes les réunions rejointes est exigée; le best-effort n'est pas accepté et l'automatisation reste suspendue tant que cette couverture n'est pas démontrée. Le collecteur autonome minimal réouvre une partie du backend CR-002; l'interface live et ses fonctionnalités plus larges ne sont pas incluses par cette seule décision. Le mentor peut participer à Meet sans être connecté à l'extension.

## Hors périmètre du MVP et capacités réservées au Post-MVP

- Les fonctionnalités live générales et la persistance backend au-delà du collecteur planifié CR-008 restent Post-MVP par CR-002.
- Le suivi des réunions auxquelles le mentor ne participe pas reste Post-MVP par CR-003. CR-008 couvre l'extension fermée alors que le mentor peut participer à Meet.
- Pas de partage automatique de la feuille, de modification d'Agenda ni de facturation.
