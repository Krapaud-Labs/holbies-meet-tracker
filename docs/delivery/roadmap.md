# Roadmap

> **Statut : roadmap as-built et cible décidée.** Les capacités ci-dessous sont documentées comme présentes ou envisagées; leur présence dans le dépôt ne prouve ni leur achèvement ni leur acceptation MVP. Les arbitrages sont datés plus bas et détaillés dans les CR.

## Capacités documentées comme présentes, périmètre à confirmer

OAuth explicite, Agenda, détection Meet, statuts de présence, export Sheets, CSV de secours, interface Holberton et documentation de conception.

## Propositions post-MVP, à confirmer

Ajouter des tests d'interface automatisés, une meilleure gestion des fuseaux horaires et une validation de conformité propre au contexte d'utilisation.

## Phases et critères de sortie

Les phases n'ont pas de dates ni d'engagement de déploiement. Une phase ne commence que lorsque ses dépendances sont vérifiées.

| Phase | Résultat | Critères de sortie | État |
|---|---|---|---|
| 0. Fermer la conception | Dossier cohérent, diagrammes, modèle de données, contrats, checklist globale et revue indépendante | Tous les domaines exigés par `DESIGN-FIRST-GATE.md` sont documentés et relus; gates externes sont séparées et étiquetées; `design-readiness.md` approuvée; preflight vert | Readiness approuvée; preflight en attente |
| 1. Audit/remédiation QA et CI | Tests comportementaux de l'export manuel as-built et workflow PR-only | Phase 0 validée; tests locaux simulés passent; workflow vérifié, actions épinglées, concurrence configurée; revue QA/DevOps/Auditeur; PR fusionnée dans `dev` et checkout resynchronisé | Livré par PR #141 fusionnée dans `dev`; CI verte le 2026-10-24 |
| 2. Corriger QLT-003/004 | Éliminer les rapprochements d'identité fondés sur un nom et valider les tokens OAuth avant toute requête | CR-011/012/013 classés MVP; contrat documenté; conception relue et approuvée; tests de collisions/ambiguïtés et valeurs token invalides; PR vers dev | Correction autorisée; readiness approuvée, preflight en attente; aucun code |
| 3. Prouver les gates CR-001/008/009 | Démontrer autorisation, couverture fiable, identité, sécurité, rétention et coût nul partagé | Compte de test autorisé; accès Meet tiers et capture des réunions courtes/manquées prouvés; OAuth et stockage audités; valeurs de durée administrées; finalité institutionnelle approuvée; quota commun contrôlable sans frais | En attente, automatisation suspendue |
| 4. Implémenter et valider le MVP automatique | Collecteur VPS, écriture Sheets, reprise et buffer CR-009 | Phase 0 et 3 sorties; changements produit revus; tests locaux, intégrations autorisées, sécurité, opérations et interface vérifiés; rapport PARTIEL permis après pagination complète, jamais après collecte incomplète; aucune dépense | Non commencé |
| 5. Autoriser l'activation | Permettre l'usage institutionnel du collecteur | Critères de Phase 4 prouvés sur environnement autorisé; information/rétention validées; contrôle de coût actif; approbation de rollout documentée | Non commencé |

## Arbitrages de périmètre du 2026-10-23

- **CR-001, MVP accepté :** export Sheets automatique en fin de réunion, après autorisation préalable et avec réessais. Le fallback local initial est précisé par CR-009 : un rapport finalisé lorsque Chrome est fermé est conservé dans un buffer VPS protégé. L'interface actuelle à export manuel reste à aligner et le flux réel n'est pas encore prouvé.
- **CR-002, Post-MVP accepté, portée générale :** backend live et persistance serveur des présences. CR-008 réouvre uniquement l'infrastructure minimale nécessaire à la collecte planifiée et au rapport autonome.
- **CR-003, Post-MVP accepté :** suivi automatique des réunions auxquelles le mentor ne participe pas. CR-008 ne le remplace pas, puisque l'utilisateur confirme que le mentor peut être présent dans Meet sans extension.
- **CR-008, MVP accepté, précisé par CR-010 :** le collecteur VPS démarre deux minutes avant l'heure Agenda même si l'extension est fermée, et attend la fin réelle du Meet avant de finaliser et exporter, même si tous quittent avant. Le refresh token est autorisé par mentor, chiffré, révocable et supprimé à la déconnexion. Une durée positive de démarrage tardif est configurée par l'établissement, sans défaut. La couverture fiable est obligatoire; une collecte best-effort ne satisfait pas le besoin et l'automatisation reste suspendue jusqu'à preuve. L'authentification sécurisée, l'accès organisateur tiers, les coûts, la conservation, la fiabilité de collecte et la readiness restent à concevoir/prouver; aucune implémentation n'est établie. Voir [CR-010](../project-management/cahier-des-charges/holbies-meet-tracker/CHANGE-REQUEST-a0b3331ef998b1e658f7684b5eb29d5ef202de193935c3f90041659a77f58fb6.md).
- **CR-009, MVP accepté :** si Sheets échoue lorsque Chrome est fermé, garder temporairement le rapport final complet ou PARTIEL dans un buffer VPS protégé, avec son état durable, le récupérer à la prochaine ouverture de l'extension et le supprimer après récupération. L'établissement doit fixer une durée positive; aucune valeur par défaut n'est permise. L'isolation, l'authentification, le chiffrement, la purge et le coût restent à concevoir/prouver; aucune implémentation n'est établie. Voir [CR-009](../project-management/cahier-des-charges/holbies-meet-tracker/CHANGE-REQUEST-b77682aef346dc4f1c544eecb023ceea48d01b43e43443ec7915d02207b84f7c.md).

Les décisions sont détaillées dans [`CHANGE-REQUEST-28a8e652`](../project-management/cahier-des-charges/holbies-meet-tracker/CHANGE-REQUEST-28a8e6521495644f0996d40e626d1dfd5a6216c7acb35c4823cce4bb2bf2652b.md). Le classement n'est pas une preuve que les comportements sont implémentés ou validés en conditions réelles.
