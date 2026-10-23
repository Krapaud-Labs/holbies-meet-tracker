# Provenance du cahier des charges

## Résultat de la recherche

Le dépôt ne contenait aucun fichier `ORIGINAL-MVP-BRIEF.sha256` avant cette récupération. Aucune empreinte originale n'a donc pu être vérifiée. `RECONSTRUCTION-CANDIDATE.sha256` empreinte la reconstitution produite à partir de l'historique disponible; elle n'est pas l'empreinte originale et ne certifie pas à elle seule l'authenticité historique.

## Sources et copies archivées sans modification

| Fichier d'archive | Source retrouvée | SHA-256 | Statut observé |
| --- | --- | --- | --- |
| `reconstruction-depuis-brief-accepte.md` | `.codex/PROJECT-BRIEF.md` | `fd291ef394d08c9f75b8f1d9d2bd0874ac0666a37f51d55212ab651fa28ee498` | Brief local marqué `accepted`, ignoré par Git; copie identique à la source vérifiée le 2026-10-23 |
| `brouillon-historique-incomplet.md` | `Cahier-des-Charges/holbies-meet-tracker/cahier-des-charges.md` | `983ee7e0adb577740a67ee63d9897972421b9601707a0a93dcf645ebc9c84599` | Brouillon marqué « À compléter »; non suivi par Git |
| `docs/product/vision-and-scope.md` | Historique Git, commit `d890828` puis compléments `4b23619` | voir `git show` pour la version source | Document produit suivi; décrit un périmètre divergent |
| `reconstitution-mvp-depuis-historique.md` | Première version suivie au commit `d890828` et décisions datées associées | voir `RECONSTRUCTION-CANDIDATE.sha256` | Synthèse reconstruite; empreinte candidate vérifiable, authenticité historique non certifiée |

## Écarts de périmètre et décisions

- Le brief accepté local décrit l'enregistrement automatique dans Google Sheets à la sortie de la réunion.
- La vision produit suivie prévoit un export volontaire vers une nouvelle feuille ou un CSV local.
- Le brief local et le profil citent les intégrations Meet, Agenda et Sheets; les décisions et documents de conception ultérieurs excluent le stockage serveur, alors que le dépôt courant contient `backend/` et une base PostgreSQL.
- Le brief local contient des décisions de complétude, mais aucun journal ne prouve qu'elles constituent le cahier initial immuable.

Ces écarts sont consignés comme provenance incertaine et demandes de changement séparées. CR-001 est classé MVP; CR-002 et CR-003 sont Post-MVP selon les décisions utilisateur du 2026-10-23. Aucun classement ne modifie les sources archivées.

Le registre [`CHANGE-REQUEST-28a8e6521495644f0996d40e626d1dfd5a6216c7acb35c4823cce4bb2bf2652b.md`](CHANGE-REQUEST-28a8e6521495644f0996d40e626d1dfd5a6216c7acb35c4823cce4bb2bf2652b.md) détaille les divergences et les classements explicites du 2026-10-23 : CR-001 MVP, CR-002 et CR-003 Post-MVP. Ce journal de décisions n'altère aucune copie de source ni la reconstitution historique.

## Limite de l'archive

`reconstitution-mvp-depuis-historique.md` est la meilleure reconstruction possible depuis les sources suivies disponibles, non une copie certifiée du cahier initial. `reconstruction-depuis-brief-accepte.md` conserve séparément le brief local accepté; `brouillon-historique-incomplet.md` conserve le brouillon antérieur. Les sources d'origine restent intactes.
