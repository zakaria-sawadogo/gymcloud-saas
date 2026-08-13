import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { TenantContext } from '../middleware/tenant.middleware';

export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete';
export type Subjects =
  | 'User'
  | 'Salle'
  | 'Adherent'
  | 'AdherentAbonnement'
  | 'Payment'
  | 'Product'
  | 'Expense'
  | 'Booking'
  | 'AccessLog'
  | 'MarketingCampaign'
  | 'SaasPlan'
  | 'SaasInvoice'
  | 'SaasSubscription'
  | 'AuditLog'
  | 'Role'
  | 'Prospect'
  | 'SaasSubscriptionRequest'
  | 'Country'
  | 'PlatformSettings'
  | 'all';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

/**
 * Construit dynamiquement les permissions (CASL) d'un utilisateur.
 *
 * §2.2 — Les 5 rôles système ET les rôles internes GymCloud ont
 * désormais tous des permissions codées explicitement ici. Le parsing
 * dynamique depuis la table `RolePermission` (permissions.code au
 * format "entité.action_métier", ex: "salle.suspend") a été
 * abandonné : sa grammaire ne correspondait pas à celle attendue par
 * CASL ("action CRUD" + "Sujet PascalCase", ex: can('manage','Salle')),
 * si bien qu'aucune permission ne s'appliquait jamais en pratique —
 * tout rôle interne se retrouvait avec zéro droit effectif malgré des
 * lignes en base. La table `Permission`/`RolePermission` reste utile
 * comme métadonnées descriptives (affichage, audit) mais n'est plus la
 * source d'autorité pour ces 6 rôles connus.
 *
 * §14.x — Un utilisateur du personnel interne GymCloud peut désormais
 * cumuler des rôles supplémentaires (UserAdditionalRole) EN PLUS de
 * son rôle principal — createForUser applique les règles de CHAQUE
 * rôle (principal + additionnels) au même builder CASL, qui les
 * additionne naturellement (jamais de perte de droit entre rôles
 * cumulés).
 */
@Injectable()
export class AbilityFactory {
  async createForUser(context: TenantContext): Promise<AppAbility> {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    this.applyRoleRules(context.roleCode, can, cannot);
    for (const additionalRole of context.additionalRoleCodes) {
      this.applyRoleRules(additionalRole, can, cannot);
    }

    return build();
  }

  private applyRoleRules(
    roleCode: string,
    can: AbilityBuilder<AppAbility>['can'],
    cannot: AbilityBuilder<AppAbility>['cannot'],
  ) {
    switch (roleCode) {
      case 'SUPER_ADMIN':
        can('manage', 'all');
        break;

      case 'PROPRIETAIRE':
        can('read', 'Salle');
        can('update', 'Salle'); // identité visuelle et paramètres de SES salles (§3.4-3.9) — appartenance vérifiée en service
        can('read', 'Adherent');
        can('read', 'Payment');
        can('read', 'Product'); // §14.x — supervision de la boutique, pas la vente au comptoir (rôle GESTIONNAIRE)
        can('manage', 'Expense'); // §14.x — le propriétaire saisit lui-même les dépenses confidentielles (salaires, loyer...) — restriction fine en service
        can('read', 'SaasSubscription');
        can('update', 'SaasSubscription'); // changement/renouvellement de SON PROPRE plan (§9.12) — vérifié en service
        can('read', 'AccessLog'); // nécessaire au tableau de bord consolidé (§11)
        can('read', 'Booking');
        can('read', 'MarketingCampaign');
        can('read', 'Prospect');
        // Peut créer des GESTIONNAIRE et COACH (matrice §2.8), et gérer
        // leur cycle de vie (suspendre/réactiver/désactiver — §4.2). La
        // restriction fine (quel rôle précis, quelle salle) est
        // appliquée dans UsersService, pas ici — CASL reste
        // volontairement grossier pour rester lisible.
        can('create', 'User');
        can('read', 'User');
        can('manage', 'User');
        cannot('update', 'SaasPlan');
        cannot('create', 'Salle'); // création exclusive SUPER_ADMIN (§3.2)
        break;

      case 'GESTIONNAIRE':
        can('manage', 'Adherent');
        can('manage', 'AdherentAbonnement');
        can('manage', 'Payment');
        can('manage', 'Product'); // §14.x — boutique, restriction fine (add-on actif) en service
        can('manage', 'Expense'); // §14.x — GymCloud Finances, restriction fine (add-on actif) en service
        can('manage', 'Booking');
        can('manage', 'AccessLog');
        can('manage', 'MarketingCampaign');
        can('manage', 'Prospect'); // prospects captés depuis le site public de sa salle (§3.2)
        can('create', 'User'); // création de COACH uniquement (§2.8) — restriction fine en service
        can('read', 'User');
        can('manage', 'User'); // suspendre/réactiver/désactiver COACH et ADHERENT de sa salle (§4.2) — restriction fine en service
        cannot('manage', 'SaasPlan');
        cannot('manage', 'SaasSubscription');
        break;

      case 'COACH':
        can('read', 'Booking');
        can('create', 'Booking'); // créer ses propres cours collectifs (§7.2) — restriction fine en service
        can('update', 'Booking'); // ses propres séances/cours uniquement — filtré au niveau service
        break;

      case 'ADHERENT':
        can('read', 'Adherent'); // sa propre fiche/carte — restriction stricte en service
        can('read', 'AdherentAbonnement');
        can('read', 'Booking'); // consulter cours/coachs disponibles avant de réserver (§7)
        can('create', 'Booking');
        can('create', 'Payment');
        can('read', 'Payment'); // ses propres paiements — restriction stricte en service
        can('create', 'AccessLog'); // §6.14 — auto-pointage via le QR fixe de sa salle, restriction fine en service
        can('read', 'AccessLog'); // §14.x — son propre historique de fréquentation, restriction stricte en service (findUnique par userId, jamais un autre adherentId)
        can('read', 'Product'); // §14.x — catalogue boutique consultable, jamais de vente/paiement à distance
        break;

      // ── Personnel interne GymCloud (§2.2) — accès global (non lié
      // à une salle), portée définie par la fonction du poste. Toujours
      // en LECTURE sur les données clients : la création/modification
      // reste un acte SUPER_ADMIN sauf mention contraire explicite.

      case 'ADMIN_GYMCLOUD':
        // §14.x — exercice de redistribution des tâches SUPER_ADMIN,
        // validé explicitement : création de salle et gestion du
        // personnel interne, en plus du périmètre déjà large. Reste
        // exclu : rôles internes = 'manage Role' est accordé, mais la
        // création de PROPRIETAIRE et la modification des tarifs de
        // plans SaaS restent hors de ce rôle (pas demandées).
        can('read', 'Salle');
        can('update', 'Salle'); // support/branding/paramètres
        can('create', 'Salle'); // §14.x — délégué depuis SUPER_ADMIN
        can('read', 'User');
        can('read', 'SaasSubscription');
        can('read', 'SaasPlan'); // consultation uniquement, jamais modification des tarifs
        can('read', 'AuditLog');
        can('manage', 'Role'); // §14.x — gestion des comptes de personnel interne (voir assertCanManageInternalUser)
        break;

      case 'RESPONSABLE_SUPPORT':
        // Dépannage clients — lecture large, et réinitialisation de
        // mot de passe (modélisée comme "update" sur User).
        can('read', 'Salle');
        can('read', 'User');
        can('update', 'User'); // user.reset_password, user.unlock (§2.2)
        can('read', 'Adherent');
        can('read', 'AccessLog');
        can('read', 'Payment');
        break;

      case 'RESPONSABLE_FINANCE':
        // Facturation SaaS et visibilité des revenus (§9.13).
        // §14.x — corrigé : 'manage SaasPlan' donnait accidentellement
        // aussi le droit de créer/modifier les TARIFS des plans (voir
        // SaasPlansController), jamais l'intention initiale. Marquer
        // une facture payée utilise maintenant un subject dédié
        // ('SaasInvoice'), distinct de la définition des plans
        // eux-mêmes, qui reste SUPER_ADMIN/ADMIN_GYMCLOUD (lecture seule).
        can('read', 'SaasPlan');
        can('manage', 'SaasInvoice'); // marquer une facture payée — voir SaasInvoicesController
        can('read', 'SaasSubscription');
        can('read', 'Payment');
        can('read', 'User'); // pour identifier le propriétaire facturé
        break;

      case 'RESPONSABLE_COMMERCIAL':
        // Suivi des propriétaires/salles à des fins commerciales —
        // lecture seule, la création reste SUPER_ADMIN (§2.8). Le
        // traitement des demandes d'abonnement du site vitrine est en
        // revanche pleinement de son ressort (§3.2, §9.5).
        // §14.x — délégué depuis SUPER_ADMIN : créer un propriétaire,
        // logique puisque c'est lui qui convertit une demande en client
        // (voir UsersService.createProprietaire).
        can('read', 'User');
        can('create', 'User'); // §14.x — création de PROPRIETAIRE uniquement, restriction fine en service
        can('read', 'Salle');
        can('read', 'SaasSubscription');
        can('manage', 'SaasSubscriptionRequest');
        break;

      case 'SUPERVISEUR_PAYS':
        // §14.x — countryId (User.countryId) désormais transmis dans le
        // JWT et utilisé pour filtrer GET /salles (SallesController) —
        // un superviseur ne voit que les salles de son pays, plus toute
        // la plateforme. Délégué depuis SUPER_ADMIN : suspendre/
        // réactiver une salle de son pays (litige, impayé signalé
        // localement) — restriction par pays vérifiée en service, même
        // principe que le filtrage de la liste.
        can('read', 'Salle');
        can('manage', 'Salle'); // §14.x — suspend/reactivate, restriction par countryId en service
        cannot('create', 'Salle'); // jamais la création — reste SUPER_ADMIN/ADMIN_GYMCLOUD
        cannot('update', 'Salle'); // jamais le branding/paramètres d'une salle — hors de son rôle de supervision
        can('read', 'User');
        can('read', 'SaasSubscription');
        break;

      default:
        // Rôle inconnu (ex: rôle interne créé manuellement après coup,
        // sans mise à jour de ce fichier) : aucun droit par défaut,
        // plus sûr qu'un parsing DB qui accorderait silencieusement des
        // permissions incorrectes.
        break;
    }
  }
}
