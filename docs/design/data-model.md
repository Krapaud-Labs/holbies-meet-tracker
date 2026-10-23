# Modèle de données

Un événement Agenda fournit son titre, sa date, ses invités et un lien Meet. Un participant Meet fournit son identité et ses sessions. Le calcul produit `firstJoin`, `lastLeave` et un statut métier.

Les lignes d'export ciblées contiennent : `Prénom`, `Nom`, `Date`, `Réunion`, `Arrivée`, `Départ`, `Statut`. L'export MVP doit être déclenché automatiquement en fin de réunion après activation et autorisation explicites préalables. Dans l'implémentation actuelle, ces données restent en mémoire pendant la popup et sont envoyées après consentement au clic.

Les modèles persistés par le backend appartiennent au périmètre Post-MVP CR-002 et ne sont pas requis par le modèle MVP local.
