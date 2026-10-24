# Holbies Meet Tracker

Extension Chrome Manifest V3 pour analyser les présences aux réunions Google Meet à partir des événements Google Agenda.

## Périmètre MVP

Le produit vise l'export automatique des réunions auxquelles le mentor participe, avec une collecte VPS indépendante de Chrome et une couverture fiable à démontrer. Le collecteur démarre deux minutes avant l'horaire Agenda et attend la fin réelle de Meet. Si Sheets échoue alors que Chrome est fermé, la cible prévoit un buffer VPS protégé, avec durée fixée par l'établissement. Ces parcours cibles ne sont pas encore implémentés. L'activation automatique reste suspendue tant que la couverture fiable, l'accès Google, les autorisations, la protection des données et les coûts ne sont pas validés. Le suivi sans participation du mentor et les fonctions live générales ne font pas partie du MVP. Voir le [périmètre produit](docs/product/vision-and-scope.md) et la [conception](docs/design/architecture.md).

Après la fin réelle de Meet et la pagination complète, l'export manuel de la popup marque « PARTIEL » les rapports contenant des identités étudiantes « à vérifier »; ces lignes ne sont pas comptées présentes ou absentes. Une collecte incomplète ne produit aucun rapport. Sheets affiche le statut et le nombre d'identités à vérifier avant les sept colonnes métier; le CSV garde les mêmes métadonnées et neutralise les valeurs qui pourraient être interprétées comme des formules. L'export automatique VPS reste une cible distincte et n'est pas implémenté.

Un invité avec une adresse e-mail complète comparable est déclaré absent uniquement après la fin réelle de Meet, la collecte de toutes les pages et un roster Agenda complet (`attendeesOmitted` absent ou faux), sans participant anonyme ni candidat de même nom normalisé avec une autre adresse. Si Calendar indique que des invités peuvent manquer, le rapport est marqué PARTIEL même lorsque toutes les lignes visibles sont rapprochées. Les adresses manquantes ou invalides et les situations ambiguës restent « à vérifier »; un nom n'est jamais utilisé pour associer deux personnes.

Pour le backend live actuel, les présences avec e-mail complet comparable restent possibles, mais les invités attendus non observés restent « à vérifier » faute de preuve serveur vérifiable de fin Meet et de pagination complète. Aucun booléen de complétude envoyé par le client n'est accepté; une future absence backend requiert un CR/work item distinct.

Le rapprochement s'appuie uniquement sur un e-mail complet comparable et les tokens OAuth absents, blancs ou non textuels sont refusés avant toute requête, y compris lors de la validation d'une session par le backend. Les résultats de fusion du backend sont stables quel que soit l'ordre des lignes. Un échec Sheets ne remplace pas le token Agenda/Meet courant. Aucune API Google réelle n'a été appelée pour ces contrôles.

## Fonctionnalités présentes

- Connexion Google et lecture des événements Agenda de la semaine en cours.
- Sélection des agendas à afficher et pagination des événements.
- Analyse des participants Meet et rapprochement uniquement par e-mail complet comparable; les identités non résolues restent « à vérifier » et ne sont pas comptées présentes ou absentes.
- Rapports HTML et CSV locaux, et export Sheets manuel.
- Backend Live facultatif pour les sessions et rapports, décrit dans [`backend/README.md`](backend/README.md).

Les pages Agenda et Meet sont limitées à 100 par collecte; une page sans sa clé de collection, un jeton de page invalide, répété ou malformé bloque le résultat, sans rapport ni écriture backend. Les tokens OAuth invalides sont refusés avant toute requête. Les tests utilisent des doubles locaux et ne valident pas l'accès Google réel.

## Limites du suivi en arrière-plan

Le cycle périodique actuellement présent dans le dépôt tourne dans le service worker Chrome. Il envoie des snapshots au backend VPS; le VPS ne planifie pas lui-même les réunions. Chrome doit rester ouvert et l'extension doit avoir reçu le consentement Google. Ce worker démarre aussi un suivi sans vérifier que le mentor a rejoint Meet; ce comportement dépasse la frontière MVP choisie et doit être neutralisé avant une livraison MVP. Il ne constitue pas le collecteur VPS planifié.

L'export Sheets actuel demande une action manuelle et crée une nouvelle feuille à chaque export. Il ne fournit pas encore l'automatisation ni la réconciliation des doublons prévues pour le MVP. Toute activation reste suspendue jusqu'à validation de l'usage, des autorisations, de la sécurité et des coûts.

## Installation locale

1. Ouvrir `chrome://extensions` dans Chrome.
2. Activer le mode développeur.
3. Choisir **Charger l'extension non empaquetée** et sélectionner ce dossier.
4. Ouvrir la popup depuis l'icône de l'extension.

Le projet ne nécessite pas de build : Chrome charge directement les fichiers HTML, CSS et JavaScript.

## Vérifications locales

```bash
node --test tests/*.test.js
npm test --prefix backend
```

Les tests utilisent des scénarios locaux et des doubles; ils ne prouvent pas l'accès aux comptes Google ni les échanges réels avec Meet, Sheets ou Drive.

## CI GitHub Actions

Le workflow `Validate extension` se déclenche sur les pull requests vers `dev` et `main`. Il vérifie la syntaxe de `popup.js`, `attendance.js`, `backend/src/server.js` et `backend/src/live.js`, lance tous les fichiers `tests/*.test.js` pour l'extension, puis installe les dépendances et exécute les tests backend. Il construit aussi l'image Docker, valide le manifeste JSON et vérifie les espaces du diff. Les exécutions concurrentes d'une même pull request sont annulées au profit de la plus récente. Aucun de ces contrôles ne valide les échanges avec un compte Google réel.

## Documentation

- [Architecture](docs/design/architecture.md)
- [Flux de présence Meet](docs/design/meet-flow.md)
- [Export Sheets](docs/design/sheets-export.md)
- [Parcours OAuth](docs/design/oauth-flow.md)
- [Guide backend et déploiement VPS](backend/README.md)
