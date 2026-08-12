import { Injectable, BadRequestException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * §3.2, §9.5 — Traitement des demandes d'abonnement captées depuis le
 * site vitrine GymCloud. Une demande n'est JAMAIS transformée
 * automatiquement en compte propriétaire : le SUPER_ADMIN la
 * contacte, puis crée le propriétaire lui-même via le parcours
 * habituel (§2.4, "Nouveau propriétaire") une fois le contact établi
 * — "convertir" ici ne fait que refléter ce constat dans le suivi,
 * sans lien technique fort avec le futur compte propriétaire
 * (volontairement simple, même principe que ProspectsService).
 */
@Injectable()
export class SubscriptionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(status?: string) {
    return this.prisma.saasSubscriptionRequest.findMany({
      where: status ? { status: status as any } : undefined,
      include: { desiredPlan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markContacted(id: string, actorUserId: string) {
    const request = await this.prisma.saasSubscriptionRequest.findUniqueOrThrow({ where: { id } });
    const updated = await this.prisma.saasSubscriptionRequest.update({
      where: { id },
      data: { status: 'CONTACTEE', processedByUserId: actorUserId, processedAt: new Date() },
    });
    await this.audit.log({
      userId: actorUserId,
      action: 'saas_subscription_request.contacted',
      entityType: 'SaasSubscriptionRequest',
      entityId: id,
    });
    return updated;
  }

  async markConverted(id: string, actorUserId: string, note?: string) {
    const updated = await this.prisma.saasSubscriptionRequest.update({
      where: { id },
      data: { status: 'CONVERTIE', processedByUserId: actorUserId, processedAt: new Date(), note },
    });
    await this.audit.log({
      userId: actorUserId,
      action: 'saas_subscription_request.converted',
      entityType: 'SaasSubscriptionRequest',
      entityId: id,
    });
    return updated;
  }

  async markRejected(id: string, actorUserId: string, note?: string) {
    if (!note) {
      throw new BadRequestException('Un motif est requis pour rejeter une demande');
    }
    const updated = await this.prisma.saasSubscriptionRequest.update({
      where: { id },
      data: { status: 'REJETEE', processedByUserId: actorUserId, processedAt: new Date(), note },
    });
    await this.audit.log({
      userId: actorUserId,
      action: 'saas_subscription_request.rejected',
      entityType: 'SaasSubscriptionRequest',
      entityId: id,
      metadata: { note },
    });
    return updated;
  }

  /**
   * §14.x — Supprimer une demande une fois traitée, pour garder la
   * liste propre — jamais une demande encore "NOUVELLE" (non
   * traitée) : la supprimer à ce stade perdrait une demande jamais
   * suivie, sans aucune trace.
   */
  async delete(id: string, actorUserId: string) {
    const request = await this.prisma.saasSubscriptionRequest.findUniqueOrThrow({ where: { id } });
    if (request.status === 'NOUVELLE') {
      throw new BadRequestException(
        'Cette demande n\'a pas encore été traitée — contactez, convertissez ou rejetez-la avant de la supprimer.',
      );
    }
    await this.prisma.saasSubscriptionRequest.delete({ where: { id } });
    await this.audit.log({
      userId: actorUserId,
      action: 'saas_subscription_request.delete',
      entityType: 'SaasSubscriptionRequest',
      entityId: id,
      metadata: { previousStatus: request.status },
    });
    return { deleted: true };
  }
}
