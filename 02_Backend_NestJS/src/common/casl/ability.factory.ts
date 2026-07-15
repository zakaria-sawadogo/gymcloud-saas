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
  | 'Booking'
  | 'AccessLog'
  | 'MarketingCampaign'
  | 'SaasPlan'
  | 'SaasSubscription'
  | 'AuditLog'
  | 'Role'
  | 'Prospect'
  | 'SaasSubscriptionRequest'
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
 */
@Injectable()
export class AbilityFactory {
  async createForUser(context: TenantContext): Promise<AppAbility> {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    switch (context.roleCode) {
      case 'SUPER_ADMIN':
        can('manage', 'all');
        break;

      case 'PROPRIETAIRE':
        can('read', 'Salle');
        can('read', 'Adherent');
        can('read', 'Payment');
        can('read', 'SaasSubscription');
        can('update', 'SaasSubscription'); // changement/renouvellement de SON PROPRE plan (§9.12) — vérifié en service
        can('read', 'AccessLog'); // nécessaire au tableau de bord consolidé (§11)
        can('read', 'Booking');
        can('read', 'MarketingCampaign');
        can('read', 'Prospect');
        // Peut créer des GESTIONNAIRE et COACH (matrice §2.8). La
        // restriction fine (quel rôle précis, quelle salle) est
        // appliquée dans UsersService, pas ici — CASL reste
        // volontairement grossier pour rester lisible.
        can('create', 'User');
        can('read', 'User');
        cannot('update', 'SaasPlan');
        cannot('create', 'Salle'); // création exclusive SUPER_ADMIN (§3.2)
        break;

      case 'GESTIONNAIRE':
        can('manage', 'Adherent');
        can('manage', 'AdherentAbonnement');
        can('manage', 'Payment');
        can('manage', 'Booking');
        can('manage', 'AccessLog');
        can('manage', 'MarketingCampaign');
        can('manage', 'Prospect'); // prospects captés depuis le site public de sa salle (§3.2)
        can('create', 'User'); // création de COACH uniquement (§2.8) — restriction fine en service
        can('read', 'User');
        cannot('manage', 'SaasPlan');
        cannot('manage', 'SaasSubscription');
        break;

      case 'COACH':
        can('read', 'Booking');
        can('update', 'Booking'); // ses propres séances uniquement — filtré au niveau service
        break;

      case 'ADHERENT':
        can('read', 'AdherentAbonnement');
        can('create', 'Booking');
        can('create', 'Payment');
        break;

      // ── Personnel interne GymCloud (§2.2) — accès global (non lié
      // à une salle), portée définie par la fonction du poste. Toujours
      // en LECTURE sur les données clients : la création/modification
      // reste un acte SUPER_ADMIN sauf mention contraire explicite.

      case 'ADMIN_GYMCLOUD':
        // Bras droit du SUPER_ADMIN sur l'exploitation courante, sans
        // les pouvoirs les plus sensibles (rôles internes, plans SaaS,
        // création de salle/propriétaire — actions volontairement non
        // couvertes par 'manage', qui inclurait 'create' à tort).
        can('read', 'Salle');
        can('update', 'Salle'); // support/branding/paramètres — pas la création
        cannot('create', 'Salle');
        can('read', 'User');
        can('read', 'SaasSubscription');
        can('read', 'SaasPlan'); // consultation uniquement
        can('read', 'AuditLog');
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
        can('read', 'SaasPlan');
        can('manage', 'SaasPlan'); // nécessaire pour marquer une facture payée (voir SaasInvoicesController)
        can('read', 'SaasSubscription');
        can('read', 'Payment');
        can('read', 'User'); // pour identifier le propriétaire facturé
        break;

      case 'RESPONSABLE_COMMERCIAL':
        // Suivi des propriétaires/salles à des fins commerciales —
        // lecture seule, la création reste SUPER_ADMIN (§2.8). Le
        // traitement des demandes d'abonnement du site vitrine est en
        // revanche pleinement de son ressort (§3.2, §9.5).
        can('read', 'User');
        can('read', 'Salle');
        can('read', 'SaasSubscription');
        can('manage', 'SaasSubscriptionRequest');
        break;

      case 'RESPONSABLE_MARKETING':
        // Périmètre volontairement réduit : le module Marketing actuel
        // (campagnes, coupons) est à l'échelle d'une salle, pas de la
        // plateforme — ce rôle s'étoffera avec un futur marketing
        // corporate GymCloud. Lecture de base pour l'instant.
        can('read', 'Salle');
        can('read', 'User');
        break;

      case 'SUPERVISEUR_PAYS':
        // ⚠️ Limitation connue : les droits ci-dessous sont globaux, pas
        // encore filtrés par le countryId du superviseur — un vrai
        // filtrage par pays nécessiterait d'adapter chaque service
        // (findAll des salles/propriétaires) pour croiser avec
        // User.countryId. À court terme, le superviseur voit donc toute
        // la plateforme comme un lecteur, pas seulement son pays.
        can('read', 'Salle');
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

    return build();
  }
}
