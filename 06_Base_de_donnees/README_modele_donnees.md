# Modèle de données GymCloud

## Fichiers

- `schema.prisma` — schéma complet (35 modèles, 19 enums), source de vérité, dupliqué dans `02_Backend_NestJS/prisma/`
- `rls_policies.sql` — policies Row Level Security PostgreSQL, à exécuter après chaque migration

## Décisions de modélisation

### Stratégie multi-tenant : base partagée + discriminant `salleId`

Toutes les tables métier (adhérents, paiements, réservations, etc.) portent une colonne `salleId`. Aucune table par tenant, aucun schéma par tenant. Cette approche est la seule qui tient l'objectif du cahier des charges (« plusieurs milliers de salles, plusieurs millions d'adhérents ») sans exploser les coûts d'infrastructure.

Double verrou :
1. **Filtrage applicatif** — chaque requête Prisma passe par un `TenantMiddleware` qui injecte automatiquement `salleId` (voir backend).
2. **RLS PostgreSQL** — même en cas d'oubli du filtre applicatif, la base refuse de retourner des lignes hors périmètre.

### Où vit l'abonnement SaaS ?

Le cahier des charges est ambigu à ce sujet (§2.1 dit que l'abonnement appartient au propriétaire, §3.2 liste des « paramètres SaaS » au niveau salle). J'ai tranché : **`SaasSubscription` appartient au `Proprietaire`** (relation 1-1), car c'est le propriétaire qui souscrit un plan et dont le quota de salles est contrôlé. Chaque `Salle` référence la souscription active de son propriétaire (`subscriptionId`) pour affichage rapide, sans dupliquer la logique de quota.

Le champ `Salle.isSalleSupplementaire` fige, au moment de la création, si cette salle a dépassé le quota inclus — traçabilité exigée par §13.20 même si le plan change ensuite.

### RBAC entièrement dynamique

Plutôt qu'un enum figé de rôles, `Role` est une table : les 5 rôles système (`isDeletable = false`) coexistent avec des rôles internes GymCloud créés librement par le SUPER_ADMIN (§2.2). `Permission` + `RolePermission` permettent l'attribution granulaire décrite en §2.2 sans jamais toucher au code pour créer un nouveau rôle interne.

### Aucun montant codé en dur

Conformément à l'exigence explicite du cahier des charges (§9.3), tous les prix (`SaasPlan.priceMonthly`, `extraSalleFee`, `AbonnementCatalogue.price`...) sont des colonnes, jamais des constantes applicatives. `SaasCountryPricing` permet une surcharge par pays (§14.15) sans dupliquer les plans.

### Un coach/adhérent = une seule salle (V1)

Conforme à §2.3. Le modèle est prêt pour l'extension V2 (coach multi-salles) : il suffira d'ajouter une table de jointure `CoachSalle` sans casser l'existant, `CoachProfile.salleId` devenant alors la salle « principale » par défaut.

## Schéma entité-association (vue simplifiée)

Les relations complètes sont dans `schema.prisma`. Vue d'ensemble des entités centrales :
