# GymCloud — Écart entre le cahier des charges et l'état construit

Comparaison systématique du cahier des charges (`Cahier_des_charges_GymCloud_v1_0.docx`, 14 chapitres) contre le code réellement présent dans l'archive livrée. Vérifié par recherche directe dans le code, pas seulement par mémoire de la conversation — chaque ligne ci-dessous s'appuie sur un fichier ou un modèle concret trouvé (ou absent).

**Légende** : ✅ construit et vérifié · 🟡 partiellement construit · ❌ non construit

---

## Chapitres 1 à 9 — Cœur du produit

C'est la partie la plus aboutie du projet — construite et retravaillée sur l'essentiel de la conversation.

- ✅ **Ch.1-2** Rôles, hiérarchie, permissions (CASL) par rôle
- ✅ **Ch.3** Salles, branding, catalogue d'abonnements, sous-domaine public
- ✅ **Ch.4** Utilisateurs, authentification, changement de mot de passe, **réinitialisation par OTP** (complétée récemment), suspendre/réactiver/désactiver avec vérification d'appartenance
- 🟡 **Ch.4** §4.10 Historique des connexions (`login_history` existe en base, mais aucune page ne l'affiche) · §4.13 Recherche globale — **absente** · §4.14 Import/export en masse — **absent**
- ✅ **Ch.5** Cycle de vie adhérent, catalogue, réabonnement, historique, délai de grâce, suspension auto
- ✅ **Ch.6** QR code, contrôle d'accès, présences, fermeture auto après délai
- ✅ **Ch.7** Réservations, cours collectifs, disponibilités coach, liste d'attente
- ✅ **Ch.8** Paiements (espèces + Mobile Money avec OTP), reçus, factures PDF, caisse
- ✅ **Ch.9** Plans SaaS, changement de plan avec prorata et validation, essai gratuit, historique, demandes d'abonnement (avec création de propriétaire pré-remplie)

---

## Chapitre 10 — Marketing, campagnes, fidélisation

C'est ici que l'écart devient significatif.

- ✅ Création de campagne (nom, canal, segment, dates) — modèle et endpoint existent
- ✅ Coupons (fixe/pourcentage, dates de validité) — modèle et contrôleur existent
- ✅ Segmentation par critères (inactifs, expirés, VIP...) — **mais calculée à la demande**, pas matérialisée ni automatique
- ❌ **Envoi réel de SMS/WhatsApp/Email** — aucune passerelle branchée (Twilio, WhatsApp Business API...). Le modèle `ApiCredential` prévoit d'accueillir ces clés plus tard, mais rien n'envoie de message aujourd'hui
- ❌ **Messages automatisés** (bienvenue, paiement validé, rappel de séance 24h/2h avant, anniversaire) — aucun déclencheur trouvé
- ❌ **Automatisation des relances de réabonnement** (J-7/J-3/J-1/J+1/J+3) — pas de tâche planifiée dédiée à ça (le scheduler existant gère la période de grâce et la suspension auto, pas l'envoi de rappels)
- ❌ **Détection automatique des inactifs avec relance** — la requête de segment existe, mais rien ne la déclenche seule ni n'envoie de message
- ❌ **Programme de parrainage** — absent du code, aucune trace
- ❌ **Bibliothèque de modèles de messages** — absente
- ❌ **KPI marketing** (taux d'ouverture, de clic, de conversion) — impossibles à calculer sans envois réels

**En résumé** : la structure (segments, coupons, campagnes) existe, mais tout ce qui suppose un envoi de message réel ou une automatisation planifiée est à construire.

---

## Chapitre 11 — Rapports, statistiques, Business Intelligence

- ✅ KPI SaaS (MRR, ARR, churn, rétention, revenu moyen) — **vraiment calculés**, code vérifié dans `reporting.service.ts`
- 🟡 Dashboards Gestionnaire/Propriétaire/SUPER_ADMIN — présents avec des chiffres réels (revenus, adhérents, présences), mais moins exhaustifs que la liste complète du cahier des charges (pas de comparatifs temporels avancés, pas de classement des salles avec tous les critères listés)
- ❌ **Dashboard Coach dédié** (séances, taux de présence, heures de coaching) — non trouvé
- ❌ **Graphiques interactifs** (courbes, histogrammes, répartitions par âge/sexe) — pas de bibliothèque de visualisation intégrée côté backend/API dédiée à ça
- ❌ **Export Excel/CSV** des rapports — seul le PDF existe (factures/reçus), aucun package Excel/CSV présent dans les dépendances
- ❌ **Rapports automatisés planifiés** (quotidien/hebdomadaire, envoyés par email) — absent
- ❌ **KPI marketing avancés** — dépendent du chapitre 10, donc absents pour la même raison

---

## Chapitre 12 — Application mobile

- ✅ Architecture unifiée (1 seule app, routage par rôle) — construite tôt dans le projet
- 🟡 Écrans de base par rôle présents à la conception, mais **jamais testés en conditions réelles dans cette conversation** (pas d'exécution Flutter réelle, pas de vérification visuelle)
- ❌ Demande de réabonnement adhérent depuis mobile (`POST /adherents/me/request-subscription`) — mentionnée comme non construite dans les résumés de sessions précédentes, jamais revenue depuis
- ❌ Notifications push — dépend du module notifications, absent
- ❌ Mode hors ligne — explicitement marqué V2 dans le cahier des charges, donc hors périmètre attendu

---

## Chapitre 13 — Sécurité, audit, administration

- ✅ RBAC (CASL), isolation multi-tenant (RLS PostgreSQL + filtrage applicatif), politique de mot de passe, chiffrement des secrets (`ApiCredential.encryptedValue`)
- ✅ Journal d'audit (`AuditService`, table `audit_logs`) — utilisé de façon cohérente à travers les modules
- 🟡 Gestion des sessions — révocation **globale** possible (déconnexion de toutes les sessions au changement de mot de passe), mais **pas de vue "mes sessions actives" ni de révocation individuelle** d'un appareil précis
- ❌ **Authentification multifactorielle (MFA)** — absente (mais explicitement marquée V2 dans le cahier des charges, donc normal à ce stade)
- ❌ **Sauvegarde et restauration (PCA)** — aucun script ou politique de sauvegarde automatisée trouvé dans l'infrastructure livrée
- ❌ **Détection d'anomalies** de sécurité (tentatives suspectes, connexions inhabituelles) — absente
- ❌ **Centre de notifications in-app** — le modèle `Notification` existe en base, mais **aucun service ne l'alimente et aucune page ne l'affiche**
- 🟡 **Quotas et gestion des clés API** — modèle `ApiCredential` présent pour stocker des secrets tiers, mais pas de module de gestion de clés API **publiques** (pour des intégrations externes de salles, par exemple) — sujet aussi marqué V2 dans le cahier des charges

⚠️ **Point trouvé en cours de route, à corriger séparément** : une quinzaine d'endroits dans le backend renvoient l'objet `User` complet (donc `passwordHash` inclus) au frontend via `include: { user: true }` au lieu d'un `select` explicite. Deux ont été corrigés en construisant les actions de suspension. Les treize autres restent à traiter.

---

## Chapitre 14 — Architecture technique, multi-pays

- ✅ Multi-tenant, multi-pays au niveau données (`Country`, `SaasCountryPricing`)
- ✅ Plans SaaS avec tarification par pays
- ❌ **Gestion des fuseaux horaires** — aucune conversion ou stockage de fuseau par pays/salle trouvé (toutes les dates semblent traitées en UTC/heure serveur uniquement)
- ❌ **Conversion multi-devises** en temps réel — les prix sont stockés en XOF/devise fixe par pays, mais pas de moteur de conversion (taux de change)
- ❌ **API publique** — explicitement marquée V2 dans le cahier des charges, donc normal
- ❌ **Intégrations externes** (comptabilité, autres logiciels) — absentes, également au-delà du périmètre initial probable

---

## Ce qui mérite une décision de votre part

Le cœur métier (chapitres 1 à 9) est solide. Les écarts se concentrent sur :
1. **L'envoi réel de messages** (SMS/WhatsApp/Email) — sans ça, tout le chapitre 10 reste théorique
2. **L'automatisation planifiée** (relances, détection d'inactifs) — actuellement tout est "à la demande", rien ne se déclenche seul
3. **Les rapports exportables et le BI visuel** — les chiffres existent, leur mise en forme avancée (graphiques, export, planification) manque
4. **Le centre de notifications in-app** — la table existe, rien ne l'utilise

Dites-moi lesquels de ces chantiers vous voulez prioriser — vu l'ampleur, mieux vaut y aller un par un plutôt que tout attaquer en même temps.
