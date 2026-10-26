---
title: Classement et contrôle des documents du projet
status: review
last_updated: 2026-10-26
category: quality
owner: Équipe de maintenance du dépôt
version: 1
---

# Classement et contrôle des documents du projet

## Objet

Cette règle distingue les documents de travail maintenus des archives historiques conservées comme preuves. Elle vise les fichiers de documentation sous `docs/` et ne modifie aucune source archivée.

## Faits, hypothèses et décision

- **Faits vérifiés :** l’inventaire initial comptait 29 Markdown suivis; cinq sont les archives listées ci-dessous. L’ancien contrôle a compté 58 diagnostics au total, dont 10 faux diagnostics liés aux cinq archives Markdown (deux par fichier). Il ne faut pas interpréter 58 comme le nombre d’erreurs distinctes des documents actifs.
- **Hypothèse :** l’équipe veut prévenir les erreurs documentaires avant fusion, y compris sur les fichiers nouvellement ajoutés.
- **Décision DOC-001 :** le contrat de classification est décrit dans le work item; le 2026-10-26, l’utilisateur a autorisé l’implémentation limitée du validateur, des fixtures et de la documentation correspondante.
- **Limite :** `design-readiness.md` produit reste `review`; cette exception ne valide pas le produit et ne permet pas de modifier les archives ou d’autres cartes.
- **Dépendance :** aucune intégration Google, donnée étudiante ou service payant n’est nécessaire à ce contrôle local.

## Catégories observées

Avant l’ajout de ce guide le 2026-10-26, le dépôt suivait 29 fichiers Markdown sous `docs/` : 24 documents actifs et cinq archives historiques situées dans `docs/project-management/cahier-des-charges/holbies-meet-tracker/`. Avec ce guide, le total dans le checkout est maintenant de 30 Markdown : 25 actifs et cinq archives.

Les documents actifs couvrent les guides, la vision, les décisions et la roadmap, la conception, les opérations, la qualité et le suivi du projet. Ils peuvent être corrigés lorsque leur contenu évolue.

Les cinq archives Markdown sont :

- `CHANGE-REQUEST-28a8e6521495644f0996d40e626d1dfd5a6216c7acb35c4823cce4bb2bf2652b.md`
- `PROVENANCE.md`
- `brouillon-historique-incomplet.md`
- `reconstitution-mvp-depuis-historique.md`
- `reconstruction-depuis-brief-accepte.md`

Ces fichiers conservent leur contenu et leur format d’origine. Ils ne reçoivent pas de métadonnées éditoriales ajoutées après coup. Le fichier `RECONSTRUCTION-CANDIDATE.sha256` accompagne l’archive et ne certifie que la reconstruction candidate.

## Métadonnées des documents actifs

Chaque nouveau document actif doit commencer par un front matter YAML comprenant un titre non vide, un statut reconnu par l’équipe, une date `last_updated` valide au format `YYYY-MM-DD` et une catégorie documentaire. Les marqueurs de contenu incomplet doivent être résolus avant qu’un document soit présenté comme final. Le validateur local DOC-001 applique ces règles et signale les documents non conformes, sans les réparer.

Le [registre d’archives](../project-management/archive-manifest.tsv) recense les fichiers historiques et leurs empreintes. Le validateur local DOC-001 lit ce registre, vérifie les fichiers déclarés et échoue si le scan d’un sous-dossier est inaccessible.

## Registre et intégrité des archives

Chaque archive doit être identifiée dans le registre par son chemin exact, sa provenance, sa catégorie et une empreinte SHA-256 de référence. Les catégories sont `historical-source`, `change-record`, `provenance-record`, `candidate-reconstruction` et `checksum-manifest`. Les rôles d’empreinte sont `archive-integrity`, `candidate-reconstruction` et `candidate-checksum`. Une nouvelle archive ne devient pas une exception par son seul nom ou son emplacement : son ajout au registre doit être explicite et relu. Un chemin absent, dupliqué ou modifié doit être signalé.

Le dépôt ne contient pas d’empreinte `ORIGINAL-MVP-BRIEF.sha256`. `RECONSTRUCTION-CANDIDATE.sha256` est une empreinte candidate et ne peut être renommée ou présentée comme l’empreinte du cahier original.

Pour vérifier la reconstruction candidate sur macOS :

```bash
cd docs/project-management/cahier-des-charges/holbies-meet-tracker
shasum -a 256 -c RECONSTRUCTION-CANDIDATE.sha256
```

Cette commande vérifie uniquement le fichier mentionné dans ce manifeste. Elle ne prouve pas l’authenticité historique des autres documents.

## Exemple de diagnostic cible

Exemple de forme des diagnostics produits par le validateur local :

```text
ERREUR docs/design/architecture.md : front matter absent
ERREUR docs/project-management/cahier-des-charges/holbies-meet-tracker/PROVENANCE.md : empreinte différente du registre
Résumé : <nombre> documents actifs conformes, <nombre> archives intactes, 2 erreurs
```

Chaque diagnostic réel présente un chemin relatif et une cause. Le résumé distingue les documents actifs conformes, les fichiers archivés dont l’empreinte est vérifiée et le nombre d’erreurs.

## Limites et suites

Le registre est créé et ses six empreintes concordent avec les fichiers présents. Les fixtures et le runner DOC-001 sont livrés; le contrôle réel vérifie six fichiers archivés et détecte 21 documents actifs sans front matter au 2026-10-26. Ces erreurs actives restent visibles; aucune archive ne produit de diagnostic éditorial. Les copies historiques doivent rester identiques. La conception produit globale garde son propre statut et n’est pas approuvée par DOC-001.

Le risque principal est de masquer un nouveau document actif par une exclusion trop large; le registre explicite et le traitement actif par défaut doivent l’éviter. Toute erreur restante dans les documents actifs doit être corrigée ou explicitement reportée, jamais filtrée pour obtenir un résultat vert.
