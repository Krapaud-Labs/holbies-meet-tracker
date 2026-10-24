# Séquence cible de collecte et d'export

> **Proposition documentaire, non implémentée et non approuvée.** Cette séquence ne prouve pas la détection fiable ni l'accès d'un principal VPS aux réunions organisées par autrui.

```mermaid
sequenceDiagram
  actor Mentor
  participant Popup as Extension / popup
  participant OAuth as OAuth Google serveur
  participant Vault as Coffre credentials
  participant Scheduler as Scheduler VPS
  participant Jobs as État des jobs
  participant Collector as Collecteur
  participant Meet as Calendar / Meet API
  participant Sheets as Drive / Sheets
  participant Buffer as Buffer CR-009

  Mentor->>Popup: Active globalement l'export
  Popup->>OAuth: Demande le consentement serveur préalable
  OAuth-->>Vault: Enregistre le refresh token chiffré par mentor (proposition)
  Note over OAuth,Vault: Protocole, scopes et gestion des clés à revoir
  Scheduler->>Jobs: Planifie l'événement admissible
  Scheduler->>Collector: Déclenche à T-2 minutes
  Collector->>Jobs: Réclame le job et persiste l'étape
  Collector->>Collector: Vérifie config tardive, TTL et garde de coût
  alt Configuration ou garde absente
    Collector->>Jobs: manual_review_required
    Note over Collector: Aucun rapport et aucune absence ne sont produits
  else Configuration présente
    Collector->>Vault: Demande un accès autorisé pour le mentor
    Vault-->>Collector: Jeton d'accès temporaire, si autorisé
    Collector->>Meet: Détecte la conférence avec la méthode à démontrer
    Note over Collector,Meet: spaces.get/polling et Workspace Events ne prouvent pas encore la couverture
    alt Aucune capture fiable avant l'échéance
      Collector->>Jobs: not_detected ou manual_review_required
      Note over Collector: Une réunion manquée ne devient jamais une absence
    else Record capturé
      Collector->>Meet: Lit transitoirement l'identité minimale du participant
      Meet-->>Collector: Identifiants participants, comparaison en mémoire
      alt Identité du mentor inconnue ou ambiguë
        Collector->>Jobs: manual_review_required
        Note over Collector: Pas de rapport ni d'absence calculée
      else Mentor confirmé
        Collector->>Meet: Attend endTime, puis lit toutes les pages
        Meet-->>Collector: Record terminé et pages complètes
        alt Fin ou pages manquantes
          Collector->>Jobs: manual_review_required
          Note over Collector: Pagination incomplète = aucun export; identité « à vérifier » = aucune absence déduite
        else Données complètes
          Collector->>Collector: Calcule report_status complete ou partial
          Note over Collector: Identités non résolues = « à vérifier »; marqueur visible, 7 colonnes inchangées
          Collector->>Sheets: Crée la feuille, métadonnées A1:A2 et données A4:G
          alt Export Sheets réussi
            Sheets-->>Collector: Écriture confirmée
            alt Rapport COMPLET
              Collector->>Jobs: exported_complete, puis purge des données temporaires
            else Rapport PARTIEL
              Collector->>Jobs: exported_partial, puis purge des données temporaires
            end
          else Sheets échoue et Chrome est fermé
            Sheets-->>Collector: Échec d'écriture
            Collector->>Buffer: Dépose le rapport complet ou PARTIEL, son statut et échéance institutionnelle
            Mentor->>Popup: Ouvre la popup et s'authentifie
            Popup->>Buffer: Récupère le rapport pour ce mentor
            Buffer-->>Popup: Rapport complet ou PARTIEL avec statut conservé
            Popup->>Buffer: Accusé de récupération
            Popup->>Jobs: recovered_complete ou recovered_partial
            Buffer->>Buffer: Supprime après accusé; purge aussi à l'échéance
          end
        end
      end
    end
  end
```

## Conditions de validité

- La méthode de découverte doit couvrir les réunions courtes, les événements manqués et les réunions organisées par un tiers; sans preuve, l'automatisation reste désactivée.
- Le lien entre `openid.sub` et `Participant.signedinUser.user` doit être validé avec un compte autorisé.
- Toutes les pages Meet doivent être complètes et `ConferenceRecord.endTime` présent avant le calcul.
- Le fallback requiert un TTL strictement positif fourni par l'établissement, une isolation et une récupération authentifiée; aucun défaut de rétention n'est permis.
- Le diagramme n'autorise ni l'usage institutionnel, ni les scopes OAuth, ni une dépense ou l'activation d'une facturation.
