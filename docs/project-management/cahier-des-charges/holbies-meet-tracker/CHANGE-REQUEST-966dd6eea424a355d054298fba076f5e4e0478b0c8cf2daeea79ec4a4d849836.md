# CR-006 : Classer les exports par date dans Drive

**Empreinte SHA-256 de la demande :** `966dd6eea424a355d054298fba076f5e4e0478b0c8cf2daeea79ec4a4d849836`  
**Date :** 2026-10-23  
**Classement :** MVP, organisation des rapports d'export.

## Demande

Le dossier Drive doit porter le nom de l'extension, puis contenir des sous-dossiers par année et par mois, avec les rapports classés selon leur date.

## Décision et structure cible

Le nom exact de l'extension dans `manifest.json` est `Holbies Meet Tracker`. Le chemin cible est :

```text
Holbies Meet Tracker/
└── 2026/
    └── 10 - Octobre/
        └── Check-in - 23/10/2026 (Google Sheets)
```

- Créer les dossiers d'année et de mois à la demande, sans répliquer les dossiers s'ils existent déjà.
- Utiliser l'année et le mois de la date de la réunion dans le fuseau horaire du compte/événement. La règle de nommage des fichiers est précisée ultérieurement par CR-007.
- La réconciliation technique conserve l'identifiant opaque d'opération défini par CR-001.
- Le propriétaire peut partager manuellement le dossier racine comme défini par CR-005. Les permissions héritées donnent accès aux rapports des sous-dossiers; pour limiter la portée, partager un sous-dossier année/mois dédié plutôt que la racine.
- L'extension ne partage aucun dossier ou fichier automatiquement et ne modifie pas les permissions.

## Impact et dépendances

- Remplace la création directement dans le seul dossier `Holbies Meet Tracker` par une navigation/création Drive idempotente dans une hiérarchie `année/mois`.
- Dépend de CR-001 (écriture Sheets/Drive et réconciliation), CR-004 (un seul compte Google connecté) et CR-005 (partage manuel).
- L'automatisation reste suspendue tant que la finalité n'est pas approuvée et que le coût zéro partagé n'est pas démontré.
- Aucun service payant, quota augmenté, partage automatique, nouvel accès OAuth ou élargissement de la rétention n'est autorisé par CR-006.

## Preuves

- Demande explicite utilisateur reçue le 2026-10-23.
- Nom d'extension relu dans `manifest.json` : `Holbies Meet Tracker`.
- Google Drive documente le parent folder de création et les permissions héritées des dossiers : [création de fichiers dans un dossier](https://developers.google.com/workspace/drive/api/guides/folder) et [partage de dossiers](https://support.google.com/drive/answer/7166529?hl=en-en-4), consultés le 2026-10-23.

## Critères d'acceptation

- Les exports vont dans le dossier racine nommé exactement `Holbies Meet Tracker`, puis dans `AAAA/MM - Mois`.
- Chaque rapport porte la date ISO de la réunion et un suffixe en cas de doublon de date.
- Les dossiers existants sont réutilisés; les issues incertaines ne créent pas de doublons.
- Le partage reste manuel et aucun changement de permission n'est exécuté par l'extension.
- La documentation et le README expliquent l'arborescence et la portée du partage manuel.
- Aucune activation automatique ne survient tant que les gates de conception restent ouvertes.

## Historique immuable

CR-006 est une demande séparée. Elle complète CR-001 et CR-005 sans réécrire le cahier MVP historique.

## Clarification ultérieure

CR-007 précise le nom des rapports : `{nom de la réunion} - JJ/MM/AAAA`. Cette règle remplace le détail antérieur « préfixer les fichiers avec la date ISO » uniquement pour le nom de fichier; la structure des dossiers `AAAA/MM - Mois` de CR-006 reste en vigueur.
