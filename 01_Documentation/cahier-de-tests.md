# Cahier de tests — GymCloud SaaS

Document de vérification systématique, organisé par rôle et par module. Cochez au fur et à mesure de vos tests sur `https://gymcloud.sahelsystem.com`.

---

## 1. Authentification & compte (tous rôles)

- [ ] Connexion avec téléphone + mot de passe valides
- [ ] Connexion refusée avec mauvais mot de passe (message clair, pas de plantage)
- [ ] Connexion refusée pour un compte `SUSPENDU` ou `DESACTIVE`
- [ ] **Mot de passe oublié** : demande de code → code affiché en mode démo (`devOtpCode`) → réinitialisation réussie → reconnexion avec le nouveau mot de passe
- [ ] Code de réinitialisation expiré ou invalide → message d'erreur clair, pas de plantage
- [ ] **Paramètres** (menu commun à tous les rôles) : modifier prénom/nom/email → sauvegarde réussie → nom mis à jour dans la sidebar
- [ ] **Paramètres** : changer le mot de passe (actuel + nouveau) → déconnexion des autres sessions confirmée → reconnexion avec le nouveau mot de passe
- [ ] Déconnexion fonctionne et redirige vers la page de connexion

---

## 2. SUPER_ADMIN

Connexion : `+22600000000` / mot de passe défini.

### Salles & Propriétaires
- [ ] Liste des salles s'affiche
- [ ] Liste des propriétaires s'affiche
- [ ] **Nouveau propriétaire** : création complète (propriétaire + salle + plan) → mot de passe temporaire affiché
- [ ] Suspendre / réactiver un propriétaire
- [ ] "Gérer l'abonnement" d'un propriétaire → historique visible → changement de plan appliqué immédiatement

### Plans SaaS & Facturation
- [ ] Liste des plans SaaS (Starter/Professional/Enterprise) avec bons tarifs
- [ ] Modifier un plan (tarif, quotas) → répercuté sur la page d'accueil publique
- [ ] **Facturation SaaS** : liste des factures, filtre par statut
- [ ] **Validations en attente** : une déclaration de paiement propriétaire apparaît, "Approuver" fonctionne, "Rejeter" avec motif fonctionne
- [ ] Téléchargement PDF d'une facture

### Demandes d'abonnement (site vitrine)
- [ ] Une demande soumise depuis la page d'accueil apparaît dans la liste, statut "Nouvelle"
- [ ] "Créer le propriétaire" depuis une demande → formulaire pré-rempli correctement (nom, téléphone, email, salle, ville, plan)
- [ ] Une fois le propriétaire créé, la demande passe automatiquement en "Convertie"
- [ ] "Contactée" et "Rejetée" (avec motif) fonctionnent

### Personnel interne
- [ ] Liste du personnel interne (rôles RESPONSABLE_*, ADMIN_GYMCLOUD, etc.)
- [ ] Un compte RESPONSABLE_COMMERCIAL **ne peut pas** créer de propriétaire (lecture seule + demandes d'abonnement uniquement — comportement volontaire, pas un bug)

---

## 3. PROPRIETAIRE

- [ ] Vue consolidée (toutes ses salles, revenus)
- [ ] **Mon abonnement** : plan actuel affiché, historique des changements visible
- [ ] Changer de plan → si montant dû, déclaration + attente de validation SUPER_ADMIN (jamais appliqué directement)
- [ ] Changer de plan pendant la période d'essai → doit aussi passer par validation SUPER_ADMIN (pas de contournement)
- [ ] Créer un gestionnaire
- [ ] Créer un coach
- [ ] **Suspendre / réactiver / désactiver un gestionnaire** — uniquement sur ses propres salles (tester qu'il ne peut pas agir sur un gestionnaire d'un autre propriétaire)

---

## 4. GESTIONNAIRE

### Adhérents
- [ ] **Nouvel adhérent avec paiement** (espèces) → encaissement immédiat → carte membre + reçu téléchargeables
- [ ] Nouvel adhérent avec paiement (Mobile Money) → OTP → confirmation → activation
- [ ] Réabonnement d'un adhérent existant avec encaissement
- [ ] Historique des abonnements d'un adhérent visible sur sa fiche
- [ ] **Suspendre / réactiver / désactiver le compte** d'un adhérent (distinct du statut d'abonnement) — uniquement sur les adhérents de sa propre salle

### Formules & Catalogue
- [ ] Créer/modifier une formule d'abonnement

### Contrôle d'accès
- [ ] Scan QR d'un adhérent actif → accès autorisé
- [ ] Scan QR d'un adhérent expiré/suspendu → accès refusé

### Paiements
- [ ] Historique des paiements de la salle
- [ ] **Demandes en attente** (adhérent ayant demandé un réabonnement depuis mobile) — vide tant qu'aucune demande, section quand même visible
- [ ] Approuver/rejeter une demande

### Prospects
- [ ] Un prospect soumis depuis le site public d'une salle apparaît
- [ ] Marquer "Contacté" / "Converti" / "Perdu" (avec motif)

### Coachs
- [ ] **Suspendre / réactiver / désactiver un coach** — uniquement sur sa propre salle
- [ ] Configurer les tarifs d'un coach (séance/mensuel)

### Marketing & Réservations
- [ ] Créer une campagne marketing
- [ ] Créer un cours collectif
- [ ] Réservation d'un cours par un adhérent, liste d'attente si complet

---

## 5. COACH

- [ ] Voir son planning / réservations
- [ ] Tarification séance individuelle appliquée correctement à une réservation

---

## 6. Site d'accueil public (gymcloud.sahelsystem.com, non connecté)

- [ ] Page d'accueil s'affiche sans être connecté
- [ ] **Menu reste fixé** en défilant vers le bas
- [ ] Section tarifs affiche les **vrais plans** (cohérents avec "Plans SaaS" côté SUPER_ADMIN)
- [ ] **Formulaire "Demander une démo"** : soumission réussie → message de confirmation → apparaît dans "Demandes d'abonnement" côté SUPER_ADMIN
- [ ] Lien "Se connecter" → redirige vers l'écran de connexion
- [ ] Un utilisateur déjà connecté qui visite "/" est redirigé vers "/dashboard", pas vers la page publique

---

## 7. Site public par salle (08_Site_Public_Salles — hébergement séparé, à tester si déployé)

- [ ] `votresousdomaine.gymcloud.africa` (ou `/s/xxx` en local) affiche la salle correcte
- [ ] Inscription en ligne → crée un **prospect**, jamais un compte adhérent direct
- [ ] Demande d'essai gratuit → crée un prospect lié au cours, jamais une vraie réservation

---

## 8. Application mobile Flutter (⚠️ jamais testée dans cette session — code non vérifié en conditions réelles)

- [ ] L'app démarre et route vers le bon écran selon le rôle du compte connecté
- [ ] Adhérent : QR code affiché, réservations, paiements visibles
- [ ] Coach : planning visible
- [ ] Gestionnaire/Propriétaire : écrans correspondants

---

## 9. Sécurité transverse (tests d'intrusion légers)

- [ ] Un gestionnaire de la Salle A ne peut pas suspendre un coach/adhérent de la Salle B (doit recevoir une erreur 403)
- [ ] Un propriétaire ne peut pas gérer l'abonnement SaaS d'un autre propriétaire
- [ ] Les routes `/public/*` répondent sans token — toutes les autres routes exigent un token valide
- [ ] Un rôle sans permission explicite (ex: COACH tentant de créer un propriétaire) reçoit "Forbidden resource"

---

## Notes de suivi

| Date | Testé par | Problèmes trouvés |
|---|---|---|
| | | |

