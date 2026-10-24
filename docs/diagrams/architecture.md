# Architecture as-built et cible MVP

> **Proposition documentaire, non implémentée et non approuvée.** Les traits pleins représentent les composants as-built décrits dans le dépôt. Les traits pointillés représentent la cible MVP CR-001/008/009. Tout accès au collecteur VPS, la couverture fiable, les credentials durables et le budget commun restent `needs-review`.

```mermaid
flowchart LR
  subgraph Current[As-built dans le dépôt]
    Popup[Popup Chrome]
    Worker[Service worker MV3]
    Live[Backend live VPS]
    DB[(PostgreSQL optionnel)]
    GoogleNow[Google Calendar / Meet / Sheets]
    Popup -->|OAuth Chrome, export manuel| GoogleNow
    Worker -->|snapshots| Live
    Live --> DB
  end

  subgraph Target[Cible MVP CR-001 / CR-008 / CR-009, non implémentée]
    Mentor[Mentor]
    Settings[Réglages : activation globale]
    OAuth[Flux OAuth serveur à concevoir]
    Vault[(Coffre refresh tokens chiffrés par mentor)]
    Schedule[Scheduler VPS]
    JobStore[(État minimal des jobs)]
    Collector[Collecteur Meet]
    Coverage{Garde de couverture fiable}
    Quota{Garde de quota partagé sans frais}
    Report[Finalisation du rapport]
    Sheets[Google Sheets / Drive]
    Buffer[(Buffer CR-009 protégé, TTL institutionnel)]
    PopupNext[Popup à la prochaine ouverture]
    Institution["Configuration établissement<br/>fenêtre tardive positive et TTL positif"]

    Mentor --> Settings
    Settings -. consentement préalable .-> OAuth
    OAuth -. refresh token chiffré .-> Vault
    Settings -. événements autorisés .-> Schedule
    Institution -. paramètres sans défaut .-> Schedule
    Schedule -. crée/reprend .-> JobStore
    Schedule -. déclenche à T-2 min .-> Collector
    Collector -. demande d'accès au nom du mentor .-> Vault
    Vault -. jeton d'accès temporaire, si autorisé .-> Collector
    Collector -. découverte candidate .-> Coverage
    Coverage -. autorise seulement si preuve acquise .-> Quota
    Quota -. réserve partagée avant appels .-> Collector
    Collector -. Calendar / Meet .-> GoogleNow
    Collector -. collecte complète et identité mentor confirmée .-> Report
    Report -. identité étudiante non résolue .-> Report
    Report -. marqueur COMPLET/PARTIEL, 7 colonnes .-> Sheets
    Sheets -. retourne l'échec .-> Report
    Report -. dépose le rapport complet ou PARTIEL si Chrome est fermé .-> Buffer
    Buffer -. rapport après authentification .-> PopupNext
    PopupNext -. accusé de récupération .-> Buffer
    PopupNext -. recovered_complete / recovered_partial .-> JobStore
    Buffer -. supprime après accusé .-> Buffer
  end

  classDef proposed stroke-dasharray: 5 5;
  class Mentor,Settings,OAuth,Vault,Schedule,JobStore,Collector,Coverage,Quota,Report,Sheets,Buffer,PopupNext,Institution proposed;
```

## Interprétation et frontières

- `background.js` et le backend live sont le comportement as-built; ils ne constituent pas le collecteur VPS CR-008.
- Le refresh token durable est accepté en principe par CR-010, mais le flux OAuth, la protection/rotation des clés, la révocation, les scopes et l'audit restent à concevoir.
- La garde de couverture est fermée tant qu'une méthode fiable pour les réunions courtes et les événements manqués n'est pas démontrée. Le polling à la minute et Workspace Events restent des pistes, pas des garanties.
- Après pagination complète, les identités étudiantes non résolues restent « à vérifier » et le rapport porte un marqueur PARTIEL visible; elles ne sont jamais comptées présentes ou absentes. Le rapport COMPLET ou PARTIEL garde sept colonnes de données.
- Le buffer conserve le rapport final complet ou PARTIEL, son `report_status`, le nombre d'identités à vérifier et son identifiant opaque. Il doit être isolé par mentor, protégé, supprimé à la récupération ou à échéance, et désactivé si le TTL institutionnel manque.
- La finalité institutionnelle et l'absence de frais partagés restent des conditions d'activation. Aucun composant du schéma ne les certifie.
