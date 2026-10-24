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

## Relevé accessible actuel

Le 2026-10-23, l'arbre d'accessibilité de la popup Chrome installée a été relu sans interaction ni autorisation Google. Il expose le lien « Aller au contenu principal », un titre de niveau 1, les sections Agenda et Présences en niveau 2, le bouton de connexion, la case de consentement Sheets et le bouton d'export désactivé. Le contenu annonce aussi que le suivi en arrière-plan est indisponible et demande une nouvelle autorisation. Cette lecture confirme les rôles et libellés de l'état « connexion requise » observé; elle ne prouve ni l'ordre réel de tabulation, ni la visibilité du focus, ni les contrastes/rendu actuels. La capture visuelle et le contrôle clavier restent ouverts.

La relecture indépendante frontend du même état dans Chrome a observé le fond prune, l'accent cerise, l'identité visuelle et trois cartes côte à côte. Le parcours Tab observé est : lien d'évitement, connexion Google, configuration Agenda, rafraîchir, consentement Sheets, puis retour au lien; le focus est visible et le bouton d'export désactivé est ignoré. Cette capture n'a pas été conservée comme artefact partageable. La vue montrait des lignes comprimées dans les cartes et un statut backend sur plusieurs lignes. Le dialogue Agenda n'a pas été ouvert, car le compte est déconnecté.

Défaut responsive à traiter dans un work item distinct : `popup.css:25-31` impose `width`, `min-width` et `max-width` à 720px; le breakpoint `max-width: 680px` ne peut donc pas réduire le viewport effectif. Le focus trap de sélection Agenda (`popup.js:397-409`) n'a pas été exercé. Il reste à vérifier le dialogue, le zoom, le viewport étroit et les états métier. Cette revue ne permet pas d'approuver la readiness globale.
