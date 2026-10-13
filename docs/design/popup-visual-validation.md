# Validation visuelle de la popup

## Exécution

- Date : 2026-10-13
- Branche : `feat/holberton-cherry-palette`
- Palette : rouge cerise, rose et blanc rosé
- URL locale de contrôle : `http://127.0.0.1:8765/popup.html`
- Source servie : copie temporaire isolée contenant uniquement `popup.html` et `popup.css`

## Résultat observé dans Chrome

La popup s'affiche avec :

- fond encre prune et accents rouge cerise/rose ;
- logo hippocampe local et en-tête ;
- titre principal à deux niveaux ;
- carte « Connexion requise » ;
- bouton d'action cerise ;
- statistiques et pied de page ;
- hiérarchie lisible dans la largeur d'une popup Chrome.

La structure d'accessibilité expose un lien d'accès au contenu, deux titres hiérarchisés, un bouton clavier et un statut `role="status"`.

## Contrôles associés

- `python3 -m json.tool manifest.json` : réussi
- `git diff --check` : réussi
- aucune ressource externe : réussi
- `:focus-visible` et `prefers-reduced-motion` présents : réussi
- ratios mesurés sur les tokens CSS : blanc rosé/encre prune `18.02:1`, cerise/encre prune `5.28:1`, rose doux/encre prune `8.79:1`

Cette preuve concerne le prototype visuel et l'état « connexion requise ». Les flux OAuth, Meet, Sheets et les autres états métier restent hors de cette validation.
