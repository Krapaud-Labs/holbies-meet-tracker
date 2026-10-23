# Design readiness

Status: review

Le statut approuvé antérieur ne couvre pas la récupération de provenance du 2026-10-23. La baseline historique est reconstituée depuis le commit `d890828`, mais l'empreinte originale manque. CR-001 est classé MVP; CR-002 et CR-003 sont Post-MVP, selon les décisions explicites de l'utilisateur. La cible automatique Sheets, ses autorisations préalables, le test réel des API et la vérification visuelle restent à réaliser. Aucune évolution de périmètre n'est validée par sa seule présence dans le code.

Le périmètre visuel est documenté dans `visual-direction.md` et `popup-visual-validation.md`. Les états de chargement, succès, erreur, consentement et identité à vérifier disposent de textes visibles; leur accessibilité complète reste à prouver. L'audit a relevé une largeur fixe de popup et une gestion de focus de modale incomplète. Aucun rendu navigateur actuel n'a été fourni comme preuve. La validation visuelle et clavier reste donc ouverte.
