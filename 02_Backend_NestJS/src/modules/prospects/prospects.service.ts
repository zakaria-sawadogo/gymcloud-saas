import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/decorators/current-user.decorator';

/**
 * §3.2 — Gestion des prospects captés par le site public d'une salle.
 * Un prospect n'est JAMAIS transformé automatiquement en adhérent :
 * le gestionnaire le rappelle, puis crée l'adhérent lui-même via le
 * parcours guichet habituel (POST /adherents/with-payment) une fois
 * l'inscription confirmée et encaissée — "convertir" ici ne fait que
 * refléter ce constat dans le suivi commercial, sans lien technique
 * fort avec le futur dossier adhérent (volontairement simple).
 */
@Injectable()
export class ProspectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listBySalle(salleId: string, actor: TenantContext, status?: string) {
    if (!actor.isGlobalAccess && actor.salleId !== salleId) {
      throw new ForbiddenException('Ces prospects n\'appartiennent pas à votre salle');
    }
    return this.prisma.prospect.findMany({
      where: { salleId, status: status as any },
      include: { desiredCatalogue: true, trialCoursCollectif: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertOwnership(prospectId: string, actor: TenantContext) {
    const prospect = await this.prisma.prospect.findUniqueOrThrow({ where: { id: prospectId } });
    if (!actor.isGlobalAccess && actor.salleId !== prospect.salleId) {
      throw new ForbiddenException('Ce prospect n\'appartient pas à votre salle');
    }
    return prospect;
  }

  async markContacted(prospectId: string, actor: TenantContext) {
    const prospect = await this.assertOwnership(prospectId, actor);
    const updated = await this.prisma.prospect.update({
      where: { id: prospectId },
      data: { status: 'CONTACTE', contactedByUserId: actor.userId, contactedAt: new Date() },
    });
    await this.audit.log({
      userId: actor.userId,
      salleId: prospect.salleId,
      action: 'prospect.contacted',
      entityType: 'Prospect',
      entityId: prospectId,
    });
    return updated;
  }

  async markConverted(prospectId: string, actor: TenantContext, note?: string) {
    const prospect = await this.assertOwnership(prospectId, actor);
    const updated = await this.prisma.prospect.update({
      where: { id: prospectId },
      data: { status: 'CONVERTI', note },
    });
    await this.audit.log({
      userId: actor.userId,
      salleId: prospect.salleId,
      action: 'prospect.converted',
      entityType: 'Prospect',
      entityId: prospectId,
    });
    return updated;
  }

  async markLost(prospectId: string, actor: TenantContext, note?: string) {
    const prospect = await this.assertOwnership(prospectId, actor);
    if (!note) {
      throw new BadRequestException('Un motif est requis pour marquer un prospect comme perdu');
    }
    const updated = await this.prisma.prospect.update({
      where: { id: prospectId },
      data: { status: 'PERDU', note },
    });
    await this.audit.log({
      userId: actor.userId,
      salleId: prospect.salleId,
      action: 'prospect.lost',
      entityType: 'Prospect',
      entityId: prospectId,
      metadata: { note },
    });
    return updated;
  }
}
