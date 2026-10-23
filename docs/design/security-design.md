# Sécurité et confidentialité

> **Statut : conception as-built et Post-MVP.** Le backend/persistance relève de CR-002 et le suivi sans présence du mentor de CR-003. Ces capacités ne font pas partie du MVP accepté.

Les scopes OAuth sont limités à la lecture Agenda/Meet et à la création ou écriture des feuilles nécessaires à l'export. L'export exige une case de consentement. Les tokens ne sont pas persistés par l'extension et la déconnexion invalide le token en mémoire.

Le service worker collecte désormais en arrière-plan les événements Agenda proches de leur horaire et les participants Meet associés, uniquement avec le jeton OAuth déjà accordé par le mentor et pour le domaine autorisé. Il ne partage pas automatiquement la feuille. L'établissement doit informer les participants et définir la conservation appropriée des données de présence.
