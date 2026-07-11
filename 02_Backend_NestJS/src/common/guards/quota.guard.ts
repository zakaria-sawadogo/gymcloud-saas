import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedRequest } from '../middleware/tenant.middleware';

export type QuotaResource = 'gestionnaires' | 'coachs' | 'adherents' | 'salles';

export const QUOTA_KEY = 'quota_resource';

/**
 * Décore une route de création avec la ressource à contrôler.
 *
 * @example
 * @CheckQuota('adherents')
 * @Post('adherents')
 * create() { ... }
 */
export const CheckQuota = (resource: QuotaResource) => SetMetadata(QUOTA_KEY, resource);

/**
 * Guard transverse implémentant §13.20 « Gestion des Licences SaaS et
 * Contrôle des Quotas ».
 *
 * Avant toute création (gestionnaire, coach, adhérent, salle), vérifie
 * que le propriétaire n'a pas atteint le quota de son plan SaaS actif.
 * Ne bloque PAS la création de salle supplémentaire (celle-ci est
 * autorisée mais facturée automatiquement — voir SaasBillingService) ;
 * en revanche bloque la création si le quota de gestionnaires / coachs
 * / adhérents est atteint, car ces quotas n'ont pas de mécanisme de
 * dépassement facturé dans le cahier des charges.
 */
@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.get<QuotaResource>(QUOTA_KEY, context.getHandler());
    if (!resource) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const salleId = request.tenant?.salleId;
    if (!salleId) return true; // routes SUPER_ADMIN hors périmètre salle

    const salle = await this.prisma.salle.findUniqueOrThrow({
      where: { id: salleId },
      include: { subscription: { include: { saasPlan: true } } },
    });
    const plan = salle.subscription.saasPlan;

    if (resource === 'salles') {
      // Pas de blocage : la salle supplémentaire est autorisée et facturée
      // automatiquement par SaasBillingService.calculateExtraSalles().
      return true;
    }

    const quotaMap: Record<Exclude<QuotaResource, 'salles'>, number | null> = {
      gestionnaires: plan.quotaGestionnaires,
      coachs: plan.quotaCoachs,
      adherents: plan.quotaAdherents,
    };
    const quota = quotaMap[resource as Exclude<QuotaResource, 'salles'>];
    if (quota === null) return true; // illimité

    const countMap = {
      gestionnaires: () => this.prisma.gestionnaireProfile.count({ where: { salleId } }),
      coachs: () => this.prisma.coachProfile.count({ where: { salleId } }),
      adherents: () => this.prisma.adherentProfile.count({ where: { salleId } }),
    };
    const currentCount = await countMap[resource as Exclude<QuotaResource, 'salles'>]();

    if (currentCount >= quota) {
      throw new ForbiddenException(
        `Quota atteint (${currentCount}/${quota}) pour "${resource}" sur le plan ${plan.name}. Veuillez changer de plan ou d'add-on.`,
      );
    }

    return true;
  }
}
