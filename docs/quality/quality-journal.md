# Journal qualité

- `node --test tests/attendance.test.js` couvre le calcul des sessions et statuts.
- `node --check popup.js` vérifie la syntaxe JavaScript de la popup.
- `python3 -m json.tool manifest.json` vérifie le manifeste.
- `git diff --check` vérifie les espaces et erreurs de patch.
- La validation distante CI doit réussir avant fusion dans `dev`.
