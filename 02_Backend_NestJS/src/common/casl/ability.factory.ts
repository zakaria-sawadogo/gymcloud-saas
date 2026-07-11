import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { PrismaService } from '../../prisma/prisma.service';
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
  | 'all';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

/**
 * Construit dynamiquement les permissions (CASL) d'un utilisateur.
 *
 * Deux niveaux, conformément à §2.2 du cahier des charges :
 *  - Les 5 rôles système ont des permissions codées ici (comportement
 *    stable, non modifiable).
 *  - Les rôles internes GymCloud (RESPONSABLE_SUPPORT, etc.) sont
 *    entièrement pilotés par la table `RolePermission` en base,
 *    éditable par le SUPER_ADMIN sans déploiement de code.
 */
@Injectable()
export class AbilityFactory {
  constructor(private readonly prisma: PrismaService) {}

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
        can('read', 'AccessLog'); // nécessaire au tableau de bord consolidé (§11)
        can('read', 'Booking');
        can('read', 'MarketingCampaign');
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

      default: {
        // Rôle interne GymCloud : permissions chargées depuis la base
        const rolePermissions = await this.prisma.rolePermission.findMany({
          where: { role: { code: context.roleCode } },
          include: { permission: true },
        });
        for (const rp of rolePermissions) {
          const [action, subject] = rp.permission.code.split('.') as [Actions, Subjects];
          can(action, subject);
        }
      }
    }

    return build();
  }
}
