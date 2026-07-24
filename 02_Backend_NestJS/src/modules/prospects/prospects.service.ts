import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/decorators/current-user.decorator';
import { AdherentsService } from '../adherents/adherents.service';

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
    private readonly adherentsService: AdherentsService,
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

  /**
   * §3.2, §5.6 — Convertir un prospect crée réellement l'adhérent (à
   * partir des informations déjà captées : nom, téléphone) et déclenche
   * son premier paiement, pour la formule choisie par le gestionnaire —
   * pré-remplie avec la formule souhaitée si le prospect en avait
   * indiqué une (inscription en ligne), sinon à choisir manuellement
   * (ex: prospect venu pour un essai gratuit, converti ensuite).
   *
   * Avant cette évolution, "convertir" ne faisait que changer
   * l'étiquette de suivi commercial, sans créer ni facturer quoi que ce
   * soit — volontairement simplifié en V1, mais ça obligeait à ressaisir
   * l'inscription en double au guichet.
   */
  async markConverted(
    prospectId: string,
    actor: TenantContext,
    dto: {
      abonnementCatalogueId: string;
      paymentMethod: 'ESPECES' | 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE';
      phoneNumber?: string;
    },
    note?: string,
  ) {
    const prospect = await this.assertOwnership(prospectId, actor);
    if (prospect.status === 'CONVERTI') {
      throw new BadRequestException('Ce prospect est déjà converti');
    }

    const result = await this.adherentsService.createWithPayment(
      {
        firstName: prospect.firstName,
        lastName: prospect.lastName,
        phone: prospect.phone,
        email: prospect.email ?? undefined,
        salleId: prospect.salleId,
        abonnementCatalogueId: dto.abonnementCatalogueId,
      },
      { method: dto.paymentMethod, phoneNumber: dto.phoneNumber },
      actor.userId,
    );

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
      metadata: { adherentId: result.adherent.id },
    });

    return { prospect: updated, ...result };
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
