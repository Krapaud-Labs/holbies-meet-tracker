# Sécurité et confidentialité

Les scopes OAuth sont limités à la lecture Agenda/Meet et à la création ou écriture des feuilles nécessaires à l'export. L'export exige une case de consentement. Les tokens ne sont pas persistés par l'extension et la déconnexion invalide le token en mémoire.

L'extension ne collecte pas de données en arrière-plan et ne partage pas automatiquement la feuille. L'établissement doit informer les participants et définir la conservation appropriée des données de présence.
