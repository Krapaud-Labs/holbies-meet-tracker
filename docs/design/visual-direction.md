# Direction artistique et expérience visuelle

## Statut et intention

Statut : en cours de validation, 2026-10-13

Interface sobre et lisible, orientée confiance et vérification, avec l'énergie visuelle de Holberton School. Les états de permission, collecte, succès et erreur doivent être immédiatement compréhensibles.

## Références et anti-références

- Référence principale : [Holberton School France](https://www.holbertonschool.fr/), consulté le 2026-10-13
- Principes repris : fond sombre, titres forts, libellés en capitales, cartes structurées et appels à l'action visibles. La palette est adaptée au site actuel avec un contraste noir, lime acide et blanc cassé.
- Anti-références : surcharge visuelle, couleurs seules pour signaler un statut
- Différenciation attendue : statut explicite, explication des participants non reconnus et absence de logo, police ou média copiés du site de référence

## Système visuel

| Élément | Décision | Justification produit | Exemple ou token |
| --- | --- | --- | --- |
| Palette | Charbon `#101010`, surface `#1b1b1b`, lime `#d7ff00`, lime clair `#efff8a`, texte crème `#f5f1e9` | Contraste élevé et énergie visuelle sans reprendre l'ancien orange | Le lime porte les actions et la hiérarchie, le texte et l'icône doublent chaque statut |
| Typographie | Sans empattement système, titres courts et gras | Lisibilité sans dépendance externe | Les capitales restent réservées aux labels |
| Espacement | Grille compacte de popup, marges régulières | Zones cliquables confortables | Largeur cible 360 px |
| Formes et profondeur | Cartes sombres, bordure discrète, accent lime | Hiérarchie claire | Hippocampe local dans la marque, sans dépendance réseau |
| Iconographie et illustration | Icônes accompagnées de texte | Compréhensible au clavier | Pas de média externe au MVP |

## Composants, états et motion

Documenter les composants réutilisables, les états loading, vide, erreur, succès, focus et désactivé. Décrire les transitions, durées, courbes, déclencheurs et comportement avec `prefers-reduced-motion`.

La popup expose le statut de connexion, la réunion détectée, les erreurs et le résultat. Une zone dédiée liste les participants à vérifier manuellement. Les états prévus sont : prêt, connexion requise, réunion détectée, chargement, succès, erreur et données à vérifier.

## Responsive, accessibilité et performance

Points de rupture : permissions refusées, participant inconnu et export local. Navigation clavier, libellés accessibles, contraste AA et messages textuels obligatoires. Les transitions restent courtes et sont désactivées avec `prefers-reduced-motion`. Aucun service de police, image ou script distant n'est utilisé.

## Validation visuelle

Capture réalisée : popup avec état « connexion requise », vérifiée dans Chrome via un serveur local isolé le 2026-10-13.
Captures restantes : réunion détectée, succès et erreur d'export lorsque les flux métier seront implémentés.
Contraste théorique des tokens CSS : texte crème `#f5f1e9` sur charbon `#101010` `16.75:1`, lime `#d7ff00` sur charbon `#101010` `16.63:1`, lime clair `#efff8a` sur charbon `#101010` `18.28:1`. L'accent secondaire violet `#b8a7ff` est réservé aux éléments décoratifs et aux icônes, pas au texte courant.
Parcours vérifiés : structure HTML, feuille CSS locale, focus visible, mode `prefers-reduced-motion` et rendu de l'état connexion requise dans Chrome.
Auditeur : contrôle indépendant effectué; validation produit globale encore ouverte jusqu'à l'implémentation des flux métier.
Date : 2026-10-13

## Mise à jour de palette

La palette orange de la première version a été retirée de la popup. L'interface reprend désormais une base noir/vert acide/lime/blanc cassé, avec un accent secondaire violet limité aux éléments non essentiels. Cette direction s'inspire de l'énergie visuelle et des titres forts observés sur [Holberton School France](https://www.holbertonschool.fr/) le 2026-10-13. L'hippocampe local provient d'un asset officiel consulté via [le blog Holberton](https://blog.holbertonschool.com/holberton-school-define-your-future/), puis a été isolé pour la marque de l'extension.
