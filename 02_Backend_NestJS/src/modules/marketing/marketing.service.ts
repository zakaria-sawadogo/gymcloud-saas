import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  CreateMessageTemplateDto,
  CreateCampaignDto,
  CreateCouponDto,
  SegmentCriteriaDto,
} from './dto/marketing.dto';

/**
 * Service Marketing et Fidélisation (§10.1 à §10.21).
 *
 * La segmentation (§10.x) est calculée à la demande plutôt que
 * matérialisée en base : les critères courants (inactifs, expirés, en
 * grâce) évoluent en permanence, une segmentation figée serait obsolète
 * dès sa création.
 */
@Injectable()
export class MarketingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Templates de messages
  // ─────────────────────────────────────────────────────────────

  async createTemplate(salleId: string, dto: CreateMessageTemplateDto, actorUserId: string) {
    const template = await this.prisma.messageTemplate.create({
      data: { id: randomUUID(), salleId, ...dto },
    });
    await this.audit.log({
      userId: actorUserId,
      salleId,
      action: 'message_template.create',
      entityType: 'MessageTemplate',
      entityId: template.id,
    });
    return template;
  }

  async listTemplates(salleId: string) {
    return this.prisma.messageTemplate.findMany({ where: { salleId }, orderBy: { createdAt: 'desc' } });
  }

  // ─────────────────────────────────────────────────────────────
  // Segmentation (§10.x)
  // ─────────────────────────────────────────────────────────────

  /**
   * Résout un critère de segmentation en liste d'adhérents ciblés.
   * Utilisé à la fois pour prévisualiser une campagne (compteur) et
   * pour l'envoi effectif.
   */
  async resolveSegment(salleId: string, criteria: SegmentCriteriaDto) {
    switch (criteria.type) {
      case 'TOUS':
        return this.prisma.adherentProfile.findMany({ where: { salleId }, include: { user: true } });

      case 'ACTIFS':
        return this.prisma.adherentProfile.findMany({
          where: { salleId, status: 'ACTIF' },
          include: { user: true },
        });

      case 'EXPIRES':
        return this.prisma.adherentProfile.findMany({
          where: { salleId, status: 'EXPIRE' },
          include: { user: true },
        });

      case 'EN_GRACE':
        return this.prisma.adherentProfile.findMany({
          where: { salleId, status: 'EN_GRACE' },
          include: { user: true },
        });

      case 'INACTIFS': {
        if (!criteria.inactiveDays) {
          throw new BadRequestException('inactiveDays est requis pour le segment INACTIFS');
        }
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - criteria.inactiveDays);

        const recentlyActive = await this.prisma.accessLog.findMany({
          where: { salleId, checkInAt: { gte: cutoff } },
          select: { adherentId: true },
          distinct: ['adherentId'],
        });
        const activeIds = new Set(recentlyActive.map((a: { adherentId: string }) => a.adherentId));

        const candidates = await this.prisma.adherentProfile.findMany({
          where: { salleId, status: 'ACTIF' },
          include: { user: true },
        });
        return candidates.filter((a: { id: string }) => !activeIds.has(a.id));
      }

      default:
        return [];
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Campagnes (§10.1 à §10.9)
  // ─────────────────────────────────────────────────────────────

  async createCampaign(salleId: string, dto: CreateCampaignDto, actorUserId: string) {
    const campaign = await this.prisma.marketingCampaign.create({
      data: {
        id: randomUUID(),
        salleId,
        name: dto.name,
        channel: dto.channel,
        content: dto.content,
        targetSegment: dto.targetSegment as any,
        status: dto.scheduledAt ? 'PLANIFIEE' : 'BROUILLON',
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      salleId,
      action: 'marketing_campaign.create',
      entityType: 'MarketingCampaign',
      entityId: campaign.id,
    });

    if (!dto.scheduledAt) {
      return this.send(campaign.id, actorUserId);
    }
    return campaign;
  }

  /** Prévisualisation : combien d'adhérents seraient ciblés par ce critère */
  async previewSegmentCount(salleId: string, criteria: SegmentCriteriaDto) {
    const recipients = await this.resolveSegment(salleId, criteria);
    return { count: recipients.length };
  }

  async send(campaignId: string, actorUserId: string) {
    const campaign = await this.prisma.marketingCampaign.findUniqueOrThrow({
      where: { id: campaignId },
    });
    if (campaign.status === 'ENVOYEE') {
      throw new BadRequestException('Cette campagne a déjà été envoyée');
    }

    const recipients = await this.resolveSegment(
      campaign.salleId,
      campaign.targetSegment as unknown as SegmentCriteriaDto,
    );

    // TODO(module notifications): envoi effectif via le canal choisi
    // (SMS/Email/WhatsApp/Push) pour chaque destinataire de `recipients`.
    // Ce service se contente d'orchestrer la segmentation et le
    // journal ; l'acheminement réel est délégué au module Notifications.

    const updated = await this.prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'ENVOYEE',
        sentAt: new Date(),
        recipientCount: recipients.length,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      salleId: campaign.salleId,
      action: 'marketing_campaign.send',
      entityType: 'MarketingCampaign',
      entityId: campaignId,
      metadata: { recipientCount: recipients.length },
    });

    return updated;
  }

  async listCampaigns(salleId: string) {
    return this.prisma.marketingCampaign.findMany({
      where: { salleId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Coupons de réduction (§10.x)
  // ─────────────────────────────────────────────────────────────

  async createCoupon(salleId: string, dto: CreateCouponDto, actorUserId: string) {
    const existing = await this.prisma.coupon.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException('Ce code de coupon existe déjà');

    const coupon = await this.prisma.coupon.create({
      data: {
        id: randomUUID(),
        salleId,
        code: dto.code,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        validFrom: new Date(dto.validFrom),
        validTo: new Date(dto.validTo),
        usageLimit: dto.usageLimit,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      salleId,
      action: 'coupon.create',
      entityType: 'Coupon',
      entityId: coupon.id,
    });

    return coupon;
  }

  /** Valide un coupon sans le consommer — utilisé au moment du paiement */
  async validateCoupon(salleId: string, code: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || coupon.salleId !== salleId) {
      throw new NotFoundException('Coupon introuvable');
    }

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validTo) {
      throw new BadRequestException('Ce coupon n\'est plus valide (hors période)');
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Ce coupon a atteint sa limite d\'utilisation');
    }

    return coupon;
  }

  /** Consomme un coupon — à appeler une fois le paiement effectivement validé */
  async redeemCoupon(code: string) {
    return this.prisma.coupon.update({
      where: { code },
      data: { usedCount: { increment: 1 } },
    });
  }

  async listCoupons(salleId: string) {
    return this.prisma.coupon.findMany({ where: { salleId }, orderBy: { createdAt: 'desc' } });
  }
}
