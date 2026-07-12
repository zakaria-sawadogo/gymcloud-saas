import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedRequest } from '../middleware/tenant.middleware';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';
import { RESTRICTED_IN_DEGRADED_MODE_KEY } from '../decorators/restricted-in-degraded-mode.decorator';

const HARD_BLOCKING_STATUSES = new Set(['SUSPENDU', 'EXPIRE']);
const GRACE_FULL_DAYS = 7; // J+1 à J+7 : accès quasi complet (§9.10)
const GRACE_DEGRADED_DAYS = 15; // J+8 à J+15 : mode dégradé ; au-delà, EXPIRE (traité côté scheduler séparément)

/**
 * §9.2, §9.3, §9.10 — « Toute salle doit disposer d'un abonnement SaaS
 * actif afin d'accéder aux fonctionnalités de la plateforme. L'accès
 * aux fonctionnalités dépend : du plan souscrit ; des modules activés ;
 * des quotas configurés. »
 *
 * Ce guard couvre :
 *  1. Blocage total si la souscription est SUSPENDU ou EXPIRE (les
 *     quotas restent couverts séparément par QuotaGuard).
 *  2. Mode dégradé (§9.10) : lorsque le statut est EN_GRACE, calcule
 *     depuis `currentPeriodEnd` si la salle est encore en grâce
 *     "pleine" (J+1 à J+7, aucune restriction) ou en grâce "dégradée"
 *     (J+8 à J+15, les routes @RestrictedInDegradedMode() sont
 *     bloquées) — ce calcul par date reste valable même avant qu'un
 *     job de transition automatique (prévu séparément) n'ait mis à
 *     jour le champ `status` en base.
 *  3. Module requis (`@RequireModule('qr_code')` etc.) si absent du
 *     plan SaaS actuel de la salle.
 *
 * Le SUPER_ADMIN et le personnel interne GymCloud (accès global) ne
 * sont jamais bloqués : ils doivent pouvoir intervenir sur une salle
 * précisément *parce qu'elle est* suspendue (support, facturation).
 */
@Injectable()
export class SubscriptionAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.tenant) return true; // routes publiques (login...), gérées ailleurs

    if (request.tenant.isGlobalAccess) return true; // SUPER_ADMIN + personnel interne

    const salleId = request.tenant.salleId ?? (await this.resolveSalleId(request));
    if (!salleId) return true; // route non rattachée à une salle précise

    const salle = await this.prisma.salle.findUnique({
      where: { id: salleId },
      include: { subscription: { include: { saasPlan: true } } },
    });
    if (!salle) throw new NotFoundException('Salle introuvable');

    if (HARD_BLOCKING_STATUSES.has(salle.subscription.status)) {
      throw new ForbiddenException(
        `Abonnement SaaS ${salle.subscription.status === 'SUSPENDU' ? 'suspendu' : 'expiré'} — ` +
          'accès aux fonctionnalités bloqué (§9.2). Contactez votre propriétaire pour régulariser la situation.',
      );
    }

    const isRestrictedInDegradedMode = this.reflector.getAllAndOverride<boolean | undefined>(
      RESTRICTED_IN_DEGRADED_MODE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isRestrictedInDegradedMode && this.isInDegradedMode(salle.subscription)) {
      throw new ForbiddenException(
        "Abonnement en période de grâce avancée (J+8 à J+15) — cette action est temporairement indisponible " +
          "jusqu'au renouvellement, la consultation et l'encaissement de paiements restent possibles (§9.10).",
      );
    }

    const requiredModule = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredModule && !salle.subscription.saasPlan.modules.includes(requiredModule)) {
      throw new ForbiddenException(
        `Le module "${requiredModule}" n'est pas inclus dans le plan ${salle.subscription.saasPlan.name} (§9.3). ` +
          'Une mise à niveau de plan est nécessaire.',
      );
    }

    return true;
  }

  /** J+8 à J+15 après `currentPeriodEnd` = mode dégradé (§9.10). */
  private isInDegradedMode(subscription: { status: string; currentPeriodEnd: Date }): boolean {
    if (subscription.status !== 'EN_GRACE') return false;

    const daysSinceExpiry = Math.floor(
      (Date.now() - subscription.currentPeriodEnd.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysSinceExpiry > GRACE_FULL_DAYS && daysSinceExpiry <= GRACE_DEGRADED_DAYS;
  }

  /**
   * Complète `request.tenant.salleId` (absent pour un SUPER_ADMIN/
   * PROPRIETAIRE consultant une salle précise) en cherchant un
   * paramètre de route `salleId`, un `salleId` dans le corps de la
   * requête (ex: scan QR), ou en le déduisant d'une ressource
   * imbriquée (ex: coursId → cours.salleId).
   */
  private async resolveSalleId(request: AuthenticatedRequest): Promise<string | null> {
    const params = request.params as Record<string, string> | undefined;
    const body = request.body as Record<string, unknown> | undefined;

    if (params?.salleId) return params.salleId;
    if (typeof body?.salleId === 'string') return body.salleId;

    if (params?.coursId) {
      const cours = await this.prisma.coursCollectif.findUnique({
        where: { id: params.coursId },
        select: { salleId: true },
      });
      if (cours) return cours.salleId;
    }

    if (params?.coachId) {
      const coach = await this.prisma.coachProfile.findUnique({
        where: { id: params.coachId },
        select: { salleId: true },
      });
      if (coach) return coach.salleId;
    }

    // Dernier recours : routes de la forme /adherents/:id/... — `id`
    // n'est ni un coursId ni un coachId, mais peut être un adherentId
    // (ex: POST /adherents/:id/subscribe). Un UUID est globalement
    // unique tous types confondus, donc cette recherche ne risque pas
    // de confondre un adherentId avec un autre type d'identifiant.
    if (params?.id) {
      const adherent = await this.prisma.adherentProfile.findUnique({
        where: { id: params.id },
        select: { salleId: true },
      });
      if (adherent) return adherent.salleId;
    }

    return null;
  }
}
