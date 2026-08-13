# GymCloud SaaS — Dossier de projet

Ce dossier centralise l'ensemble des livrables du projet GymCloud : documentation, backend, frontend, application mobile et infrastructure.

## Structure

```
GymCloud_SaaS/
├── 01_Documentation/          Cahier des charges, notes d'architecture, spécifications
├── 02_Backend_NestJS/         API backend (NestJS + Prisma + PostgreSQL)
│   ├── src/modules/           23 modules métier
│   ├── src/common/            Guards, decorators, chiffrement, audit — transverses
│   └── prisma/                Schéma de données et migrations
├── 03_Frontend_NextJS/        Application web (Next.js + TypeScript) — dashboard interne
├── 04_Mobile_Flutter/         Application mobile unique (Flutter) — un seul binaire pour
│                               les 4 profils (Adhérent, Coach, Gestionnaire, Propriétaire),
│                               l'écran affiché dépend du rôle réel après connexion
├── 05_Infrastructure/         Déploiement (Docker Compose, Nginx, CI/CD GitHub Actions)
├── 06_Base_de_donnees/        Schéma Prisma détaillé, diagrammes ERD, scripts SQL
└── 08_Site_Public_Salles/     Site vitrine public par salle (sous-domaine dédié)
```

## État actuel — plateforme fonctionnelle en production

GymCloud est déployé et opérationnel sur `gymcloud.sahelsystem.com`. Ce README reflète l'état du code livré ; le détail complet des sessions de travail est dans `/mnt/transcripts/` (non inclus dans ce dossier).

### Backend NestJS — 23 modules métier

`access-control` · `adherents` · `api-credentials` · `auth` · `bookings` · `boutique` · `countries` · `finances` · `marketing` · `notifications` · `payments` · `platform-settings` · `prospects` · `public` (site vitrine) · `reporting` · `roles` · `saas-billing` · `salle-content` · `salles` · `subscription-requests` · `users` (internal-users, coachs, gestionnaires, proprietaires) · `whatsapp`

Fonctionnalités clés :
- **Multi-tenant** par discriminant `salleId`, isolation stricte vérifiée à chaque niveau (controller + service)
- **RBAC dynamique** (CASL) — rôles système + rôles internes GymCloud configurables
- **Adhérents** : QR code, catalogue d'abonnements, chaînage automatique des réabonnements sans perte de jours, statuts ACTIF/EN_GRACE/EXPIRE automatisés
- **Contrôle d'accès** : scan QR (tourniquet auto entrée/sortie), accès manuel par recherche (sans caméra ni jeton), historique de fréquentation par adhérent, occupation temps réel par salle
- **Paiements & Caisse** : espèces (validation immédiate), Mobile Money (flux "en attente + validation manuelle du gestionnaire", en attendant l'intégration API réelle par opérateur/pays)
- **Boutique** (add-on) : vente au comptoir, historique des ajustements de stock, clôture de caisse journalière (période "depuis la dernière clôture", jamais de vente orpheline)
- **Clôture générale** : agrège automatiquement boutique + paiements, met en avant les espèces à vérifier physiquement
- **Finances** : dépenses catégorisées, budgets avec alertes de dépassement, résultat net simplifié, évolution 6-12 mois, export comptable
- **Journal d'activité (audit log)** : par salle (propriétaire) et vue globale toutes salles (SUPER_ADMIN, usage support), avec export par e-mail
- **Marketing** : modèles de messages réutilisables (reliés à la création de campagne), campagnes segmentées avec envoi réel (e-mail fonctionnel ; SMS/WhatsApp/Push comptabilisés en attendant une passerelle), coupons
- **Identifiants marchand Mobile Money** : chiffrement AES-256-GCM, un identifiant par salle (chaque salle a son propre compte marchand, pas d'agrégateur centralisé) — stockage prêt, appel API réel à brancher pays par pays
- **SaaS Billing** : plans, add-ons par salle, facturation automatique, changement de plan avec paiement immédiat si montant dû (espèces ou Mobile Money), demandes de salle supplémentaire avec workflow d'approbation

### Frontend Next.js — 26 pages de gestion

Dashboard multi-rôle (SUPER_ADMIN / PROPRIETAIRE / GESTIONNAIRE), organisé en sous-onglets sur les pages les plus riches (Boutique, Paiements, Mon abonnement, Clôture, Marketing). Sidebar dont les items changent selon le rôle connecté.

### Application mobile Flutter — unique, 4 profils

Un seul binaire, écran déterminé par le rôle réel après connexion (pas de flavor de compilation séparé). Écran Profil/Paramètres partagé entre tous les rôles (modification des infos, changement de mot de passe). Historique de fréquentation (adhérent), présence actuelle (gestionnaire), et côté propriétaire : journal d'activité, clôture, évolution financière, changement de plan, demande de salle.

### Infrastructure

Docker Compose (PostgreSQL, Redis, MinIO, API, Web, Nginx), CI/CD GitHub Actions, migrations Prisma appliquées automatiquement au démarrage du conteneur API.

## Chantiers connus, pas encore terminés

- **Intégration API réelle Mobile Money par opérateur/pays** — le stockage chiffré des identifiants marchand par salle est prêt ; l'appel réel à chaque opérateur (Orange Money confirmé différent entre pays "Group" et "Local", Moov, Wave) reste à construire une fois la documentation obtenue de chaque opérateur
- **Passerelle SMS/WhatsApp** — les campagnes marketing comptabilisent l'envoi mais n'ont pas encore de fournisseur réel branché (Twilio, Africa's Talking, WhatsApp Business API à choisir)
- **Logs techniques serveur consultables depuis le web** — actuellement uniquement via `docker compose logs`, en SSH ; aucune infrastructure de persistance/consultation web pour les erreurs applicatives
- **7 fonctionnalités propriétaire côté mobile identifiées à l'audit** : contenu du site vitrine et gestion des identifiants Mobile Money restent web-only pour l'instant (5 des 7 ont été construites côté mobile : journal d'activité, clôture, évolution, changement de plan, demande de salle)
- **Tests automatisés** (unitaires/e2e) — la CI est câblée pour les exécuter, peu encore écrits
- **Publication sur les stores** (Play Store / App Store) — pas encore soumis ; nécessite comptes développeur, politique de confidentialité, comptes de démonstration pour la revue

## Historique des corrections notables

Un audit systématique (backend↔web↔mobile, permissions, sécurité) a été mené sur l'ensemble du projet, trouvant et corrigeant une dizaine de trous fonctionnels réels (fonctionnalités backend jamais reliées à un écran) et deux failles de permission (accès non protégé au détail d'une salle, et aux modèles marketing).
