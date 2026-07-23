import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { MarketingService } from '../marketing/marketing.service';
import { TenantContext } from '../../common/middleware/tenant.middleware';
import {
  CreateCashPaymentDto,
  InitiateMobileMoneyDto,
  ConfirmMobileMoneyDto,
} from './dto/payments.dto';

/**
 * Service de gestion des paiements et de la caisse (§8.1 à §8.21).
 *
 * Deux flux distincts conformément à §8.3 :
 *  - Espèces : validation manuelle immédiate, reçu généré sur-le-champ.
 *  - Mobile Money (Orange/Moov/Wave) : le paiement est créé EN_ATTENTE,
 *    puis confirmé de façon asynchrone par le webhook opérateur
 *    (`confirmMobileMoney`, à brancher sur les endpoints réels des
 *    opérateurs — simulé ici en attendant l'intégration).
 *
 * Intégration coupons (§10.x) : le coupon est validé et sa réduction
 * appliquée au moment de la création du paiement (espèces ou
 * initiation Mobile Money), et son compteur d'usage est incrémenté
 * immédiatement — y compris pour un paiement Mobile Money encore
 * EN_ATTENTE. Simplification assumée : un paiement Mobile Money
 * rejeté ensuite ne restitue pas l'usage du coupon (comportement
 * courant de nombreux systèmes de codes promo, cohérent avec le fait
 * que le coupon a bien été « réservé » pour cette tentative).
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly marketingService: MarketingService,
  ) {}

  /**
   * Valide un coupon (s'il est fourni) et calcule le montant final
   * après réduction. Incrémente immédiatement son compteur d'usage
   * (voir note de classe ci-dessus).
   */
  private async applyCouponIfProvided(
    salleId: string,
    amount: number,
    couponCode?: string,
  ): Promise<{ finalAmount: number; discountApplied: number }> {
    if (!couponCode) return { finalAmount: amount, discountApplied: 0 };

    const coupon = await this.marketingService.validateCoupon(salleId, couponCode);
    const discount =
      coupon.discountType === 'PERCENT'
        ? (amount * Number(coupon.discountValue)) / 100
        : Number(coupon.discountValue);
    const finalAmount = Math.max(0, amount - discount);

    await this.marketingService.redeemCoupon(couponCode);

    return { finalAmount, discountApplied: amount - finalAmount };
  }

  // ─────────────────────────────────────────────────────────────
  // Espèces — validation manuelle immédiate (§8.3)
  // ─────────────────────────────────────────────────────────────

  async recordCashPayment(dto: CreateCashPaymentDto, actorUserId: string) {
    await this.assertConsistentReferences(dto);
    const { finalAmount, discountApplied } = await this.applyCouponIfProvided(
      dto.salleId,
      dto.amount,
      dto.couponCode,
    );

    const payment = await this.prisma.payment.create({
      data: {
        id: randomUUID(),
        salleId: dto.salleId,
        adherentId: dto.adherentId,
        adherentAbonnementId: dto.adherentAbonnementId,
        type: dto.type,
        amount: finalAmount,
        currency: dto.currency,
        method: 'ESPECES',
        status: 'VALIDE',
        validatedByUserId: actorUserId,
        validatedAt: new Date(),
      },
    });

    const receipt = await this.generateReceipt(payment.id);

    await this.audit.log({
      userId: actorUserId,
      salleId: dto.salleId,
      action: 'payment.cash_recorded',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: { amount: finalAmount, currency: dto.currency, couponCode: dto.couponCode, discountApplied },
    });

    return { payment, receipt, discountApplied };
  }

  // ─────────────────────────────────────────────────────────────
  // Mobile Money — flux asynchrone (§8.3)
  // ─────────────────────────────────────────────────────────────

  async initiateMobileMoney(dto: InitiateMobileMoneyDto, actorUserId: string) {
    await this.assertConsistentReferences(dto);
    const { finalAmount, discountApplied } = await this.applyCouponIfProvided(
      dto.salleId,
      dto.amount,
      dto.couponCode,
    );

    const reference = this.generateOperatorReference(dto.method);

    const payment = await this.prisma.payment.create({
      data: {
        id: randomUUID(),
        salleId: dto.salleId,
        adherentId: dto.adherentId,
        adherentAbonnementId: dto.adherentAbonnementId,
        type: dto.type,
        amount: finalAmount,
        currency: dto.currency,
        method: dto.method,
        status: 'EN_ATTENTE',
        reference,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      salleId: dto.salleId,
      action: 'payment.mobile_money_initiated',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: {
        method: dto.method,
        phoneNumber: dto.phoneNumber,
        reference,
        couponCode: dto.couponCode,
        discountApplied,
      },
    });

    // TODO(intégration opérateur): appeler l'API réelle Orange Money /
    // Moov Money / Wave avec `phoneNumber` + `amount` + `reference`, en
    // utilisant les identifiants stockés dans ApiCredential (chiffrés).
    // La confirmation arrive ensuite via webhook → confirmMobileMoney().

    return {
      payment,
      reference,
      discountApplied,
      instructions: `Confirmez le paiement sur votre téléphone ${dto.phoneNumber}`,
    };
  }

  /**
   * Point d'entrée du webhook opérateur (§8.x). En production, cet
   * endpoint doit vérifier la signature de la requête avant tout
   * traitement (clé partagée stockée dans ApiCredential).
   */
  async confirmMobileMoney(dto: ConfirmMobileMoneyDto) {
    const payment = await this.prisma.payment.findFirst({ where: { reference: dto.reference } });
    if (!payment) throw new NotFoundException('Paiement introuvable pour cette référence');
    if (payment.status !== 'EN_ATTENTE') {
      throw new BadRequestException('Ce paiement a déjà été traité');
    }

    if (dto.externalStatus === 'FAILED') {
      const rejected = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'REJETE' },
      });
      await this.audit.log({
        salleId: payment.salleId,
        action: 'payment.mobile_money_failed',
        entityType: 'Payment',
        entityId: payment.id,
      });
      return { payment: rejected };
    }

    const validated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'VALIDE', validatedAt: new Date() },
    });
    const receipt = await this.generateReceipt(payment.id);

    await this.audit.log({
      salleId: payment.salleId,
      action: 'payment.mobile_money_confirmed',
      entityType: 'Payment',
      entityId: payment.id,
    });

    // TODO(module notifications): confirmer le paiement à l'adhérent.

    return { payment: validated, receipt };
  }

  // ─────────────────────────────────────────────────────────────
  // Remboursement (§8.x)
  // ─────────────────────────────────────────────────────────────

  async refund(paymentId: string, actorUserId: string, reason?: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status !== 'VALIDE') {
      throw new BadRequestException('Seul un paiement validé peut être remboursé');
    }

    const refunded = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REMBOURSE' },
    });

    await this.audit.log({
      userId: actorUserId,
      salleId: payment.salleId,
      action: 'payment.refund',
      entityType: 'Payment',
      entityId: paymentId,
      metadata: { reason },
    });

    return refunded;
  }

  // ─────────────────────────────────────────────────────────────
  // Reçus
  // ─────────────────────────────────────────────────────────────

  private async generateReceipt(paymentId: string) {
    const existing = await this.prisma.receipt.findUnique({ where: { paymentId } });
    if (existing) return existing;

    return this.prisma.receipt.create({
      data: {
        id: randomUUID(),
        paymentId,
        number: this.generateReceiptNumber(),
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Consultation et caisse (§8.x)
  // ─────────────────────────────────────────────────────────────

  async listBySalle(salleId: string, from?: Date, to?: Date) {
    return this.prisma.payment.findMany({
      where: { salleId, createdAt: { gte: from, lte: to } },
      include: { adherent: { include: { user: true } }, receipt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Historique des paiements d'un adhérent. Un adhérent ne peut
   * consulter que le sien — sans quoi n'importe quel adhérent pourrait
   * voir l'historique de paiement d'un autre en devinant son
   * identifiant (aucune restriction n'existait jusqu'ici).
   */
  async listByAdherent(adherentId: string, actor?: TenantContext) {
    if (actor && actor.roleCode === 'ADHERENT') {
      const adherent = await this.prisma.adherentProfile.findUnique({ where: { id: adherentId } });
      if (!adherent || adherent.userId !== actor.userId) {
        throw new ForbiddenException('Vous ne pouvez consulter que vos propres paiements');
      }
    }
    return this.prisma.payment.findMany({
      where: { adherentId },
      include: { receipt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Synthèse de caisse journalière (§8.x) — total encaissé par moyen de
   * paiement, utile pour la clôture de caisse quotidienne du
   * gestionnaire.
   */
  async dailyCashRegisterSummary(salleId: string, date: Date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const payments = await this.prisma.payment.findMany({
      where: { salleId, status: 'VALIDE', validatedAt: { gte: dayStart, lte: dayEnd } },
    });

    const byMethod: Record<string, number> = {};
    let total = 0;
    for (const p of payments) {
      const amount = Number(p.amount);
      byMethod[p.method] = (byMethod[p.method] ?? 0) + amount;
      total += amount;
    }

    return {
      date: dayStart.toISOString().slice(0, 10),
      transactionCount: payments.length,
      total,
      byMethod,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers internes
  // ─────────────────────────────────────────────────────────────

  private async assertConsistentReferences(dto: {
    adherentId?: string;
    adherentAbonnementId?: string;
  }) {
    if (dto.adherentAbonnementId) {
      const sub = await this.prisma.adherentAbonnement.findUnique({
        where: { id: dto.adherentAbonnementId },
      });
      if (!sub) throw new NotFoundException('Abonnement introuvable');
      if (dto.adherentId && sub.adherentId !== dto.adherentId) {
        throw new ConflictException('Cet abonnement n\'appartient pas à cet adhérent');
      }
    }
  }

  private generateReceiptNumber(): string {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `GC-REC-${yyyymm}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private generateOperatorReference(method: string): string {
    return `${method}-${randomUUID().slice(0, 10).toUpperCase()}`;
  }
}
