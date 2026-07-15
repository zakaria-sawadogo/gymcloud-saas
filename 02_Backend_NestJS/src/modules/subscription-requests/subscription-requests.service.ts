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
}
