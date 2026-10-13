# Direction artistique et expérience visuelle

## Statut et intention

Statut : en cours de validation, 2026-10-13

Interface sobre et lisible, orientée confiance et vérification, avec l'énergie visuelle de Holberton School. Les états de permission, collecte, succès et erreur doivent être immédiatement compréhensibles.

## Références et anti-références

- Référence principale : [Holberton School France](https://www.holbertonschool.fr/), consulté le 2026-10-13
- Principes repris : fond sombre, accent orange chaud, titres forts, libellés en capitales, cartes structurées et appels à l'action visibles
- Anti-références : surcharge visuelle, couleurs seules pour signaler un statut
- Différenciation attendue : statut explicite, explication des participants non reconnus et absence de logo, police ou média copiés du site de référence

## Système visuel

| Élément | Décision | Justification produit | Exemple ou token |
| --- | --- | --- | --- |
| Palette | Charbon `#111111`, surface `#1d1d1d`, texte crème `#f5f1e8`, orange `#ff6b35` | Contraste et identité énergique | Le texte et l'icône doublent chaque statut |
| Typographie | Sans empattement système, titres courts et gras | Lisibilité sans dépendance externe | Les capitales restent réservées aux labels |
| Espacement | Grille compacte de popup, marges régulières | Zones cliquables confortables | Largeur cible 360 px |
| Formes et profondeur | Cartes sombres, bordure discrète, accent orange | Hiérarchie claire | Pas d'image ou d'effet décoratif externe |
| Iconographie et illustration | Icônes accompagnées de texte | Compréhensible au clavier | Pas de média externe au MVP |

## Composants, états et motion

Documenter les composants réutilisables, les états loading, vide, erreur, succès, focus et désactivé. Décrire les transitions, durées, courbes, déclencheurs et comportement avec `prefers-reduced-motion`.

La popup expose le statut de connexion, la réunion détectée, les erreurs et le résultat. Une zone dédiée liste les participants à vérifier manuellement. Les états prévus sont : prêt, connexion requise, réunion détectée, chargement, succès, erreur et données à vérifier.

## Responsive, accessibilité et performance

Points de rupture : permissions refusées, participant inconnu et export local. Navigation clavier, libellés accessibles, contraste AA et messages textuels obligatoires. Les transitions restent courtes et sont désactivées avec `prefers-reduced-motion`. Aucun service de police, image ou script distant n'est utilisé.

## Validation visuelle

Capture réalisée : popup avec état « connexion requise », vérifiée dans Chrome via un serveur local isolé le 2026-10-13.
Captures restantes : réunion détectée, succès et erreur d'export lorsque les flux métier seront implémentés.
Contraste théorique mesuré sur les tokens CSS actuels : texte crème sur charbon `16.89:1`, orange clair sur charbon `6.96:1`.
Parcours vérifiés : structure HTML, feuille CSS locale, focus visible, mode `prefers-reduced-motion` et rendu de l'état connexion requise dans Chrome.
Auditeur : contrôle indépendant effectué; validation produit globale encore ouverte jusqu'à l'implémentation des flux métier.
Date : 2026-10-13
