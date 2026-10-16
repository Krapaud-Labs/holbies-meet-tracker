# Direction artistique et expérience visuelle

## Statut et intention

Statut : en cours de validation, 2026-10-13

Interface sobre et lisible, orientée confiance et vérification, avec l'énergie visuelle de Holberton School. Les états de permission, collecte, succès et erreur doivent être immédiatement compréhensibles.

## Références et anti-références

- Référence principale : [Holberton School France](https://www.holbertonschool.fr/), consulté le 2026-10-13
- Principes repris : fond sombre, titres forts, libellés en capitales, cartes structurées et appels à l'action visibles. La palette est adaptée à l'univers actuel avec un contraste charbon, rouge cerise, rose et blanc rosé.
- Anti-références : surcharge visuelle, couleurs seules pour signaler un statut
- Différenciation attendue : statut explicite, explication des participants non reconnus et absence de logo, police ou média copiés du site de référence

## Système visuel

| Élément | Décision | Justification produit | Exemple ou token |
| --- | --- | --- | --- |
| Palette | Encre prune `#160b12`, surface vin `#24101b`, cerise `#ff2d55`, rose doux `#ff8da3`, texte blanc rosé `#fff5f7` | Contraste élevé et énergie visuelle rouge/rose, cohérente avec la perception cerise du site | La cerise porte les actions et la hiérarchie, le texte et l'icône doublent chaque statut |
| Typographie | Sans empattement système, titres courts et gras | Lisibilité sans dépendance externe | Les capitales restent réservées aux labels |
| Espacement | Grille compacte de popup, marges régulières | Zones cliquables confortables | Largeur cible 720 px, sous la limite Chrome de 800 px |
| Formes et profondeur | Cartes prune sombres, bordure discrète, accent cerise | Hiérarchie claire | Hippocampe local conservé dans la marque, sans dépendance réseau |
| Iconographie et illustration | Icônes accompagnées de texte | Compréhensible au clavier | Pas de média externe au MVP |

## Composants, états et motion

Documenter les composants réutilisables, les états loading, vide, erreur, succès, focus et désactivé. Décrire les transitions, durées, courbes, déclencheurs et comportement avec `prefers-reduced-motion`.

La popup expose le statut de connexion, la réunion détectée, les erreurs et le résultat. Sur une largeur standard, les cartes Agenda et Présences sont présentées côte à côte pour éviter une longue colonne verticale. Une zone dédiée liste les participants à vérifier manuellement. Les états prévus sont : prêt, connexion requise, réunion détectée, chargement, succès, erreur et données à vérifier.

## Responsive, accessibilité et performance

Points de rupture : permissions refusées, participant inconnu et export local. Navigation clavier, libellés accessibles, contraste AA et messages textuels obligatoires. Les transitions restent courtes et sont désactivées avec `prefers-reduced-motion`. Aucun service de police, image ou script distant n'est utilisé.

## Validation visuelle

Capture réalisée : popup avec état « connexion requise », vérifiée dans Chrome via un serveur local isolé le 2026-10-13.
Captures restantes : réunion détectée, succès et erreur d'export lorsque les flux métier seront implémentés.
Contraste théorique des tokens CSS : blanc rosé `#fff5f7` sur encre prune `#160b12` `18.02:1`, cerise `#ff2d55` sur encre prune `#160b12` `5.28:1`, rose doux `#ff8da3` sur encre prune `#160b12` `8.79:1`, texte secondaire `#d5b8c2` sur encre prune `#160b12` `10.51:1`. Les ratios dépassent le niveau AA pour les usages définis ; la cerise reste réservée aux accents et contrôles, tandis que le texte courant utilise le blanc rosé ou le rose doux.
Parcours vérifiés : structure HTML, feuille CSS locale, focus visible, mode `prefers-reduced-motion` et rendu de l'état connexion requise dans Chrome.
Auditeur : contrôle indépendant effectué; validation produit globale encore ouverte jusqu'à l'implémentation des flux métier.
Date : 2026-10-13

## Mise à jour de palette

La palette lime de la version précédente a été retirée de la popup. L'interface reprend désormais une base encre prune, rouge cerise, rose doux et blanc rosé, avec une profondeur vin sombre. Cette direction s'inspire de l'univers sombre, des titres forts et de la présence visuelle rouge/rose observés sur [Holberton School France](https://www.holbertonschool.fr/) le 2026-10-13. L'hippocampe local est conservé sans modification ; il provient d'un asset officiel consulté via [le blog Holberton](https://blog.holbertonschool.com/holberton-school-define-your-future/).
