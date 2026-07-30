# GymCloud SaaS — Dossier de projet

Ce dossier centralise l'ensemble des livrables du projet GymCloud : documentation, backend, frontend, application mobile et infrastructure.

## Structure

```
GymCloud_SaaS/
├── 01_Documentation/          Cahier des charges, notes d'architecture, spécifications
├── 02_Backend_NestJS/         API backend (NestJS + Prisma + PostgreSQL)
│   ├── src/modules/           Modules métier (auth, salles, adherents, paiements, saas, etc.)
│   ├── src/common/            Guards, decorators, interceptors transverses
│   └── prisma/                Schéma de données et migrations
├── 03_Frontend_NextJS/        Application web (Next.js + TypeScript)
│   ├── app/                   Routes (App Router)
│   ├── lib/                   Client API, auth, permissions
│   └── components/            Composants UI réutilisables
├── 04_Mobile_Flutter/         Application mobile (Flutter, 4 profils : Adhérent, Coach, Gestionnaire, Propriétaire)
│   └── lib/
│       ├── core/              Réseau, auth, thème partagés
│       └── features/          Un sous-dossier par profil utilisateur
├── 05_Infrastructure/         Déploiement
│   ├── docker/                Dockerfiles, docker-compose
│   └── ci-cd/                 Workflows GitHub Actions
└── 06_Base_de_donnees/        Schéma Prisma détaillé, diagrammes ERD, scripts SQL
```

## État actuel

- [x] Cahier des charges fonctionnel analysé (01_Documentation)
- [x] Proposition d'architecture technique validée (monolithe modulaire NestJS, multi-tenant par discriminant `salleId` + RLS PostgreSQL)
- [x] **Schéma Prisma complet** — 35 modèles, 19 enums (06_Base_de_donnees/schema.prisma)
- [x] **Policies RLS PostgreSQL** (06_Base_de_donnees/rls_policies.sql)
- [x] **Socle backend** :
  - Configuration projet (package.json, tsconfig, nest-cli, .env.example)
  - `main.ts` + `app.module.ts` (Helmet, CORS, Swagger, Throttler)
  - `PrismaService` avec injection du contexte tenant
  - `TenantMiddleware` — cœur de l'isolation multi-tenant
  - `AbilityFactory` (CASL) — RBAC dynamique, rôles système + rôles internes configurables
  - `PoliciesGuard` + `QuotaGuard` — contrôle des permissions et des quotas SaaS
  - **Module Auth complet** : login, refresh token, changement de mot de passe, reset OTP
- [x] **Module SaaS Billing** (§9, §13.20) : gestion des plans (CRUD SUPER_ADMIN), tarification par pays, calcul et facturation automatique des salles supplémentaires, changement de plan avec gestion du dépassement de quota
- [x] **Module Salles** (§3) : création exclusive SUPER_ADMIN avec bootstrap automatique de la souscription SaaS à la première salle, détection de salle supplémentaire, branding, paramètres, suspension/réactivation
- [x] **Module Utilisateurs** (§4) : Propriétaires (création exclusive SUPER_ADMIN), Gestionnaires et Coachs (création hiérarchique selon la matrice §2.8, avec vérification d'appartenance de salle), quotas SaaS appliqués via `QuotaGuard`, suspension/réactivation générique
- [x] **Seed Prisma** : 5 rôles système + 6 rôles internes GymCloud (exemples §2.2) + permissions de base + Burkina Faso + 3 plans SaaS par défaut (STARTER/PROFESSIONAL/ENTERPRISE)
- [x] **Module Adhérents** (§4.6, §5) : dossier adhérent (QR code, code membre auto-généré), catalogue d'abonnements par salle, souscription avec **chaînage automatique des réabonnements sans perte de jours** (§5.13), tâche planifiée quotidienne (ACTIF → EN_GRACE → EXPIRE, §5.12)
- [x] **Module Contrôle d'accès QR Code** (§6) : scan tourniquet (1er scan = entrée, 2e = sortie), **vérification du statut d'abonnement à chaque scan** (bloque SUSPENDU/EXPIRE même avec QR valide), accès manuel gestionnaire, **fermeture automatique horaire des sessions oubliées avec détection d'anomalie** (§6.8, §6.13), vue occupation temps réel
- [x] **Module Réservations** (§7) : cours collectifs avec capacité limitée, **liste d'attente avec promotion automatique** dès qu'une annulation libère une place (§7.5), séances individuelles vérifiées contre les disponibilités déclarées du coach et l'absence de chevauchement, délai d'annulation configurable, pointage de présence
- [x] **Module Paiements & Caisse** (§8) : espèces (validation immédiate), Mobile Money Orange/Moov/Wave (**flux asynchrone initiation → webhook de confirmation**), génération automatique de reçus, remboursement, **synthèse de caisse journalière par moyen de paiement**
- [x] **Module Marketing** (§10) : templates de messages réutilisables, campagnes segmentées (**TOUS / ACTIFS / EXPIRES / EN_GRACE / INACTIFS avec seuil de jours configurable**), prévisualisation du nombre de destinataires avant envoi, coupons de réduction avec validation et consommation
- [x] **Module Reporting / BI** (§11) : tableau de bord **Gestionnaire** (adhérents par statut, revenus jour/mois, fréquentation, réservations à venir), tableau de bord **Propriétaire** (vue consolidée multi-salles), tableau de bord **SUPER_ADMIN** (santé globale de la plateforme, répartition par plan SaaS, revenus SaaS encaissés/en attente), rapports détaillés (revenus par méthode/jour, tendances de fréquentation, taux de rétention)

### 🎉 Backend NestJS fonctionnellement complet — 9 modules métier, 61 fichiers source

Auth · SaaS Billing · Salles · Utilisateurs · Adhérents · Contrôle d'accès · Réservations · Paiements · Marketing · Reporting

- [ ] Module Notifications (transverse — SMS/Email/WhatsApp/Push, actuellement présent sous forme de `TODO` dans chaque module qui en a besoin)
- [x] **Frontend Next.js — socle et authentification** :
  - Configuration projet (Tailwind avec design tokens propres à GymCloud — émeraude/corail, typographie Space Grotesk + Inter)
  - Client API typé avec **refresh automatique du token** sur 401 (mutualisé entre requêtes concurrentes)
  - Contexte d'authentification React (`AuthProvider` / `useAuth`)
  - Ajout backend complémentaire : endpoint `GET /auth/me` (manquait pour que le frontend récupère rôle/salle/propriétaire après login)
  - Page de connexion
  - Layout dashboard protégé avec sidebar **dont les items changent selon le rôle connecté** (SUPER_ADMIN / PROPRIETAIRE / GESTIONNAIRE / COACH)
  - **3 vues de tableau de bord** (Gestionnaire, Propriétaire consolidé, SUPER_ADMIN) branchées sur le module Reporting déjà construit
- [x] **Frontend — pages de gestion quotidienne** :
  - **Adhérents** : liste avec recherche + filtre par statut, création, fiche détail avec historique d'abonnements, souscription/réabonnement (rappel du chaînage sans perte de jours §5.13), régénération du QR code
  - **Contrôle d'accès** : saisie du jeton QR (simule le scan), affichage entrée/sortie automatique, occupation en temps réel, liste des anomalies avec explication
  - **Paiements & Caisse** : synthèse du jour (total + répartition par méthode), historique, encaissement espèces immédiat ou initiation Mobile Money (Orange/Moov/Wave)
  - Composants UI communs : Modal, Input/Select, EmptyState
- [x] **Frontend — Réservations et Marketing** :
  - **Réservations** : planning des cours collectifs avec places restantes en temps réel, création de cours, réservation d'un adhérent avec **détection automatique de la liste d'attente** (le frontend affiche la position si le cours est complet)
  - **Marketing** (onglets Campagnes / Coupons) : création de campagne avec **prévisualisation du nombre de destinataires avant envoi**, sélection du segment (tous/actifs/expirés/en grâce/inactifs avec seuil de jours), gestion des coupons de réduction
  - Composant Tabs réutilisable

### 🎉 Frontend Next.js fonctionnellement complet — toutes les pages de gestion quotidienne

Dashboard (3 vues par rôle) · Adhérents · Contrôle d'accès · Paiements · Réservations · Marketing

- [x] **Socle Flutter commun** (18 fichiers) :
  - `pubspec.yaml` (Dio, Provider, flutter_secure_storage, qr_flutter, mobile_scanner, Firebase Messaging)
  - Mécanisme de flavors (`FlavorConfig`) — une seule codebase, 4 apps distinctes par profil
  - `ApiClient` (Dio) avec **refresh automatique du token**, mêmes garanties que le client web
  - `TokenStorage` via keychain/keystore natif (flutter_secure_storage)
  - `AuthProvider` (Provider/ChangeNotifier) — même contrat que `AuthContext` côté web
  - Thème Material 3 avec **les mêmes tokens de couleur que le web** (émeraude/corail) — cohérence de marque totale
  - Écran de connexion partagé entre les 4 profils
  - Complément backend : `/auth/me` renvoie désormais aussi `adherentId`/`coachId`/`gestionnaireId`
- [x] **Application Adhérent** (4 écrans, la plus utilisée au quotidien) :
  - **Accueil** : statut d'abonnement en cours avec jours restants, actions rapides
  - **Mon QR code** : affichage plein écran optimisé pour le scan à l'entrée (§1.3, §6.3)
  - **Réservations** : séances à venir/passées, annulation avec confirmation
  - **Paiements** : historique complet avec méthode et statut
- [x] **Application Coach** (2 écrans) :
  - **Planning** : séances groupées par jour, **pointage de présence/absence directement depuis le mobile** (utile en salle, sans revenir au poste gestionnaire)
  - **Disponibilités** : déclaration de créneaux récurrents via un formulaire bottom-sheet (jour + heure début/fin)
- [x] **Application Gestionnaire** (3 écrans, orientée terrain plutôt que réplication complète du web) :
  - **Tableau de bord** : mêmes KPI que la vue web (adhérents actifs, présents, revenus du jour, réservations à venir)
  - **Scanner QR** : caméra en direct (`mobile_scanner`), **verrouillage anti-doublon de 2 secondes après chaque lecture**, bandeau de résultat coloré (entrée/sortie/erreur)
  - **Adhérents** : liste avec recherche instantanée
- [x] **Application Propriétaire** (vue consolidée, sans navigation par onglets — usage de consultation) :
  - **Dashboard consolidé** : KPI multi-salles + liste des salles avec drill-down
  - **Détail par salle** : mêmes indicateurs qu'un gestionnaire, en lecture seule
  - Refactorisation : widget `StatCard` mutualisé entre Gestionnaire et Propriétaire (évite la duplication détectée en construisant cette 4e app)

### 🎉 Les 4 applications Flutter sont complètes — 36 fichiers (Adhérent · Coach · Gestionnaire · Propriétaire)

- [x] **Infrastructure Docker / CI-CD** (8 fichiers) :
  - `Dockerfile.backend` (multi-stage, migrations Prisma appliquées automatiquement au démarrage via un script d'entrée dédié)
  - `Dockerfile.frontend` (multi-stage, sortie Next.js `standalone` pour une image allégée)
  - `docker-compose.yml` complet : PostgreSQL, Redis, MinIO, API, Web, Nginx en façade — **une seule commande pour tout démarrer**
  - Nginx reverse proxy (`/api/*` → backend, reste → frontend)
  - Workflow GitHub Actions : lint + types + build + tests backend (PostgreSQL éphémère) + build des images Docker
  - **Documentation explicite des deux pièges évités en le construisant** : (1) le contexte de build Docker doit être la racine du projet, pas les sous-dossiers, sinon `COPY` échoue ; (2) les policies RLS ne peuvent pas s'appliquer en script d'init PostgreSQL car elles référencent des tables créées plus tard par Prisma — étape manuelle documentée à la place

## 🏁 Projet fonctionnellement complet — 150 fichiers

| Bloc | Contenu |
|---|---|
| **Base de données** | Schéma Prisma (35 modèles), policies RLS, ERD |
| **Backend NestJS** | 9 modules métier complets |
| **Frontend Next.js** | Dashboard (3 vues par rôle) + 5 pages de gestion |
| **Mobile Flutter** | 4 applications (Adhérent, Coach, Gestionnaire, Propriétaire) |
| **Infrastructure** | Docker Compose + CI/CD GitHub Actions |

## Corrections post-livraison

- **`Country` ↔ `User`** : relation inverse manquante dans le schéma Prisma (`Country.users`), provoquant une erreur de validation P1012 au premier `prisma migrate dev`. Corrigée, et un script de vérification maison a confirmé l'absence d'autres relations manquantes ou ambiguës sur les 35 modèles.
- **`package-lock.json` manquants** : `npm ci` (utilisé dans les Dockerfiles) exige un lock file, qui n'avait jamais été généré. Générés pour le backend et le frontend.
- **Next.js 15.1.0 → ^15.1.0** : la version initialement figée contenait une vulnérabilité critique (DoS, RCE potentiel via le protocole React Flight) corrigée dans les releases 15.x ultérieures. La contrainte de version a été assouplie et le lock file régénéré sur une version corrigée.

- **Module Notifications** transverse (SMS/Email/WhatsApp/Push) — 8 points d'intégration déjà marqués `TODO(module notifications)` dans le code ; nécessite le choix effectif des fournisseurs (Twilio, Africa's Talking, WhatsApp Business API...) avant implémentation
- **Tests automatisés** (unitaires/e2e) — la CI est câblée pour les exécuter mais aucun test n'a encore été écrit
- **Intégration réelle des API Mobile Money** (Orange/Moov/Wave) — actuellement simulée (le webhook existe, l'appel sortant vers l'opérateur est un `TODO`)
- **Assets graphiques** (icônes d'app, splash screens, logo) — dossiers `public/`/`assets/` prêts à les recevoir
