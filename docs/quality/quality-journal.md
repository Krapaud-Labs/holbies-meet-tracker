---
title: Journal qualité
status: updated
last_updated: 2026-10-26
category: quality
---

# Journal qualité

- `node --test tests/attendance.test.js` couvre le calcul des sessions et statuts.
- `node --check popup.js` vérifie la syntaxe JavaScript de la popup.
- `python3 -m json.tool manifest.json` vérifie le manifeste.
- `git diff --check` vérifie les espaces et erreurs de patch.
- La validation distante CI doit réussir avant fusion dans `dev`.
- 2026-10-23 : l'audit de reprise a exécuté les suites locales (extension 18/18, backend 23/23); voir [`project-recovery-audit.md`](project-recovery-audit.md) pour les limites d'intégration réelle, sécurité, UX et périmètre.
- 2026-10-23 : `validate-documentation.sh` a signalé 58 absences de front matter/date sur 29 Markdown, y compris les copies historiques immuables. Le contrôle est consigné sous DOC-001; les sources archivées n'ont pas été altérées.
- 2026-10-23 : décisions CR-001 (MVP automatique) et CR-002/003 (Post-MVP) consignées sans modification de l'archive. La cible Sheets et les parcours OAuth/Meet ont été alignés dans la documentation; le comportement réel reste à implémenter et vérifier.
- 2026-10-26 : le validateur DOC-001 local lit le manifeste d’archives et ses six empreintes. Les tests isolés réussissent; l’exécution sur le dépôt détecte 21 documents actifs sans métadonnées, n’émet aucun faux positif sur les archives et vérifie le sidecar de reconstruction candidate sans le présenter comme empreinte originale. La readiness produit demeure `review`.
