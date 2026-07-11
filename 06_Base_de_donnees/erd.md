# ERD simplifié — entités centrales

Ce diagramme montre les 8 entités centrales du modèle (sur 35 au total). Le détail complet est dans `schema.prisma`. Ouvrir ce fichier sur GitHub ou dans un éditeur supportant mermaid pour un rendu visuel.

```mermaid
erDiagram
  USER ||--o| PROPRIETAIRE : est
  USER }o--|| ROLE : possede
  PROPRIETAIRE ||--|| SAAS_SUBSCRIPTION : souscrit
  SAAS_SUBSCRIPTION }o--|| SAAS_PLAN : utilise
  PROPRIETAIRE ||--o{ SALLE : possede
  SALLE ||--o{ ADHERENT_PROFILE : accueille
  SALLE ||--o{ ABONNEMENT_CATALOGUE : propose
  ADHERENT_PROFILE ||--o{ ADHERENT_ABONNEMENT : souscrit
  ABONNEMENT_CATALOGUE ||--o{ ADHERENT_ABONNEMENT : instancie
  ADHERENT_PROFILE ||--o{ PAYMENT : effectue

  USER {
    uuid id PK
    string phone
    string roleId FK
  }
  SALLE {
    uuid id PK
    uuid proprietaireId FK
    uuid subscriptionId FK
    string name
  }
  SAAS_PLAN {
    uuid id PK
    string code
    int quotaSalles
  }
  ADHERENT_PROFILE {
    uuid id PK
    uuid salleId FK
    string memberCode
  }
```

## Groupes d'entités non représentés ici (voir `schema.prisma`)

- RBAC détaillé : `Permission`, `RolePermission`
- SaaS avancé : `SaasCountryPricing`, `SaasAddon`, `SaasPlanAddon`, `SaasSubscriptionAddon`, `SaasInvoice`
- Contrôle d'accès : `AccessLog`
- Réservations : `CoursCollectif`, `Booking`, `WaitingListEntry`, `CoachAvailability`
- Paiements détaillés : `Receipt`
- Marketing : `MessageTemplate`, `MarketingCampaign`, `Coupon`
- Sécurité : `AuditLog`, `ApiCredential`, `RefreshToken`, `LoginHistory`
- Internationalisation : `Country`
