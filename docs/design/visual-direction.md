# Direction artistique et expérience visuelle

## Statut et intention

Statut : baseline de conception complétée le 2026-10-23; validation de readiness toujours ouverte

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

Composants : en-tête et compte Google courant; bannière de statut; cartes Agenda et Présences; liste des participants à vérifier; activation globale; statut de vérification Meet en arrière-plan; résumé de destination Sheets; progression; résultat et erreurs; dialogue Agenda; zone de rapport de repli. Le libellé et l'icône accompagnent toujours la couleur.

États et comportements ci-dessus sont des spécifications de conception, pas des preuves runtime. Leur validation dans l'interface réelle, y compris clavier, zoom, responsive, dialogue Agenda et états métier, relève du contrôle produit pré-livraison décrit dans `popup-visual-validation.md`; aucun état non implémenté n'est déclaré testé. Une région `role=status` doit annoncer la progression sans déplacer le focus. Une erreur persistante doit avoir un titre et une action corrective. Le dialogue Agenda doit recevoir le focus à l'ouverture, contenir Tab et Shift+Tab, fermer sur Escape et rendre le focus à son déclencheur. Une confirmation doit nommer l'effet, notamment pour une suppression ou une création susceptible de doublon. Les transitions doivent être courtes et désactivées avec `prefers-reduced-motion`.

## Responsive, accessibilité et performance

Le rendu s'adapte à la largeur réellement disponible, cible de conception 360 à 720 px. Sous 680 px, cartes empilées et actions pleine largeur, sans débordement horizontal ni texte tronqué; à 200 % de zoom, le contenu reste accessible par défilement. Navigation clavier complète, libellés accessibles, contraste AA et messages textuels obligatoires. Le constat actuel de largeur CSS fixe 720 px et de breakpoint inopérant reste à corriger dans un work item distinct. Aucun service de police, image ou script distant n'est utilisé.

## Validation visuelle

Capture réalisée : popup avec état « connexion requise », vérifiée dans Chrome via un serveur local isolé le 2026-10-13.
Captures restantes : viewport étroit/zoom, dialogue Agenda et états métier lorsqu'ils sont disponibles. Elles constituent des preuves de validation visuelle, distinctes de la description de la baseline.
Contraste théorique des tokens CSS : blanc rosé `#fff5f7` sur encre prune `#160b12` `18.02:1`, cerise `#ff2d55` sur encre prune `#160b12` `5.28:1`, rose doux `#ff8da3` sur encre prune `#160b12` `8.79:1`, texte secondaire `#d5b8c2` sur encre prune `#160b12` `10.51:1`. Les ratios dépassent le niveau AA pour les usages définis ; la cerise reste réservée aux accents et contrôles, tandis que le texte courant utilise le blanc rosé ou le rose doux.
Parcours vérifiés : structure HTML, feuille CSS locale, focus visible, mode `prefers-reduced-motion` et rendu de l'état connexion requise dans Chrome.
Auditeur : contrôle indépendant effectué; validation produit globale encore ouverte jusqu'à l'implémentation des flux métier.
Date : 2026-10-13

## Mise à jour de palette

La palette lime de la version précédente a été retirée de la popup. L'interface reprend désormais une base encre prune, rouge cerise, rose doux et blanc rosé, avec une profondeur vin sombre. Cette direction s'inspire de l'univers sombre, des titres forts et de la présence visuelle rouge/rose observés sur [Holberton School France](https://www.holbertonschool.fr/) le 2026-10-13. L'hippocampe local est conservé sans modification ; il provient d'un asset officiel consulté via [le blog Holberton](https://blog.holbertonschool.com/holberton-school-define-your-future/).
