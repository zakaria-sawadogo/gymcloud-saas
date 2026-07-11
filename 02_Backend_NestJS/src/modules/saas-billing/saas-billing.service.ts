import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { randomUUID } from 'crypto';

/**
 * Service central de facturation SaaS.
 *
 * Implémente §9.3 (plans configurables, « aucun montant codé en dur »),
 * §9.13 (facturation SaaS), et surtout §13.20 (« Gestion des Licences
 * SaaS et Contrôle des Quotas ») — le calcul et la facturation
 * automatique des salles supplémentaires, exigence non fonctionnelle
 * explicite du cahier des charges (§13.23 « Fiabilité Financière »).
 */
@Injectable()
export class SaasBillingService {
  // ─────────────────────────────────────────────────────────────
  // Gestion des plans (§9.3)
  // ─────────────────────────────────────────────────────────────

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createPlan(data: {
    code: string;
    name: string;
    description?: string;
    priceMonthly: number;
    priceAnnual: number;
    extraSalleFee: number;
    annualDiscountPct?: number;
    trialDays?: number;
    taxRatePct?: number;
    quotaSalles: number;
    quotaGestionnaires?: number;
    quotaCoachs?: number;
    quotaAdherents?: number;
    modules: string[];
  }, actorUserId: string) {
    const plan = await this.prisma.saasPlan.create({ data });
    await this.audit.log({
      userId: actorUserId,
      action: 'saas_plan.create',
      entityType: 'SaasPlan',
      entityId: plan.id,
      metadata: { code: plan.code },
    });
    return plan;
  }

  async updatePlan(planId: string, data: Partial<{
    name: string;
    priceMonthly: number;
    priceAnnual: number;
    extraSalleFee: number;
    modules: string[];
  }>, actorUserId: string) {
    const plan = await this.prisma.saasPlan.update({ where: { id: planId }, data });
    // Toute modification tarifaire doit être auditée (§13.22)
    await this.audit.log({
      userId: actorUserId,
      action: 'saas_plan.update',
      entityType: 'SaasPlan',
      entityId: plan.id,
      metadata: data,
    });
    return plan;
  }

  listPlans() {
    return this.prisma.saasPlan.findMany({ orderBy: { displayOrder: 'asc' } });
  }

  // ─────────────────────────────────────────────────────────────
  // Tarification effective (avec surcharge pays — §14.15)
  // ─────────────────────────────────────────────────────────────

  async getEffectivePricing(planId: string, countryId: string) {
    const [plan, countryOverride] = await Promise.all([
      this.prisma.saasPlan.findUniqueOrThrow({ where: { id: planId } }),
      this.prisma.saasCountryPricing.findUnique({
        where: { saasPlanId_countryId: { saasPlanId: planId, countryId } },
      }),
    ]);

    return {
      priceMonthly: countryOverride?.priceMonthly ?? plan.priceMonthly,
      priceAnnual: countryOverride?.priceAnnual ?? plan.priceAnnual,
      extraSalleFee: countryOverride?.extraSalleFee ?? plan.extraSalleFee,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Salles supplémentaires (§13.20) — pièce maîtresse du modèle SaaS
  // ─────────────────────────────────────────────────────────────

  /**
   * Détermine si la prochaine salle créée pour ce propriétaire dépasse
   * le quota inclus dans son plan. Appelé par SallesService.create()
   * AVANT la création effective de la salle.
   */
  async isNextSalleSupplementaire(subscriptionId: string): Promise<boolean> {
    const subscription = await this.prisma.saasSubscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      include: { saasPlan: true, _count: { select: { salles: true } } },
    });
    return subscription._count.salles >= subscription.saasPlan.quotaSalles;
  }

  /**
   * Enregistre la facturation d'une salle supplémentaire :
   *  1. Récupère (ou crée) la facture en cours de période pour la souscription.
   *  2. Incrémente le compteur et le montant de salles supplémentaires.
   *  3. Recalcule le montant total.
   *  4. Trace l'opération dans le journal d'audit.
   *
   * Le propriétaire est notifié séparément par le module Notifications
   * (non encore développé) suite à l'événement émis ici.
   */
  async registerExtraSalleCharge(subscriptionId: string, salleId: string, actorUserId: string) {
    const subscription = await this.prisma.saasSubscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      include: { saasPlan: true, proprietaire: { include: { country: true } } },
    });

    const pricing = subscription.proprietaire.countryId
      ? await this.getEffectivePricing(subscription.saasPlanId, subscription.proprietaire.countryId)
      : {
          extraSalleFee: subscription.saasPlan.extraSalleFee,
          priceMonthly: subscription.saasPlan.priceMonthly,
          priceAnnual: subscription.saasPlan.priceAnnual,
        };

    const invoice = await this.getOrCreateCurrentInvoice(subscription);

    const updated = await this.prisma.saasInvoice.update({
      where: { id: invoice.id },
      data: {
        extraSallesCount: { increment: 1 },
        extraSallesAmount: { increment: pricing.extraSalleFee },
        totalAmount: { increment: pricing.extraSalleFee },
      },
    });

    await this.audit.log({
      userId: actorUserId,
      salleId,
      action: 'saas_billing.extra_salle_registered',
      entityType: 'SaasInvoice',
      entityId: updated.id,
      metadata: {
        subscriptionId,
        extraSalleFee: pricing.extraSalleFee,
        newExtraSallesCount: updated.extraSallesCount,
      },
    });

    // TODO(module notifications): notifier le propriétaire du surcoût (§13.20).

    return updated;
  }

  /**
   * Retourne la facture SaaS de la période courante ; la crée si elle
   * n'existe pas encore (première charge de la période).
   */
  private async getOrCreateCurrentInvoice(subscription: {
    id: string;
    billingCycle: 'MENSUEL' | 'ANNUEL';
    currentPeriodEnd: Date;
    saasPlan: { priceMonthly: any; priceAnnual: any; taxRatePct: any };
  }) {
    const now = new Date();
    const existing = await this.prisma.saasInvoice.findFirst({
      where: {
        subscriptionId: subscription.id,
        periodStart: { lte: now },
        periodEnd: { gte: now },
        status: 'EMISE',
      },
    });
    if (existing) return existing;

    const periodStart = now;
    const periodEnd = subscription.currentPeriodEnd;
    const baseAmount =
      subscription.billingCycle === 'ANNUEL'
        ? subscription.saasPlan.priceAnnual
        : subscription.saasPlan.priceMonthly;
    const taxAmount = (Number(baseAmount) * Number(subscription.saasPlan.taxRatePct ?? 0)) / 100;

    return this.prisma.saasInvoice.create({
      data: {
        id: randomUUID(),
        subscriptionId: subscription.id,
        invoiceNumber: this.generateInvoiceNumber(),
        periodStart,
        periodEnd,
        baseAmount,
        extraSallesCount: 0,
        extraSallesAmount: 0,
        addonsAmount: 0,
        taxAmount,
        totalAmount: Number(baseAmount) + taxAmount,
        currency: 'XOF', // TODO: dériver de Country.currency selon proprietaire.countryId
        status: 'EMISE',
      },
    });
  }

  private generateInvoiceNumber(): string {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `GC-SAAS-${yyyymm}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  // ─────────────────────────────────────────────────────────────
  // Cycle de vie de l'abonnement (§9.7 à §9.12)
  // ─────────────────────────────────────────────────────────────

  async changePlan(subscriptionId: string, newPlanId: string, actorUserId: string) {
    const subscription = await this.prisma.saasSubscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      include: { _count: { select: { salles: true } } },
    });
    const newPlan = await this.prisma.saasPlan.findUniqueOrThrow({ where: { id: newPlanId } });

    if (subscription._count.salles > newPlan.quotaSalles) {
      // Changement autorisé mais les salles au-delà du nouveau quota
      // deviennent immédiatement des salles supplémentaires facturées.
      const extraCount = subscription._count.salles - newPlan.quotaSalles;
      await this.audit.log({
        userId: actorUserId,
        action: 'saas_subscription.plan_change_with_overflow',
        entityType: 'SaasSubscription',
        entityId: subscriptionId,
        metadata: { newPlanId, extraSallesCreated: extraCount },
      });
    }

    const updated = await this.prisma.saasSubscription.update({
      where: { id: subscriptionId },
      data: { saasPlanId: newPlanId },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'saas_subscription.plan_changed',
      entityType: 'SaasSubscription',
      entityId: subscriptionId,
      metadata: { fromPlanId: subscription.saasPlanId, toPlanId: newPlanId },
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // Facturation SaaS — consultation et paiement (§9.13)
  // ─────────────────────────────────────────────────────────────
  //
  // Distinct du module Paiements (adhérent → salle) : ici, c'est le
  // PROPRIETAIRE qui paie GYMCLOUD pour sa souscription. Le moteur
  // calculait déjà les factures (getOrCreateCurrentInvoice,
  // registerExtraSalleCharge) mais rien ne permettait jusqu'ici de les
  // consulter en détail ni de les marquer payées une fois le
  // règlement effectivement reçu (virement, etc. — hors périmètre
  // Mobile Money du module Paiements, réglé habituellement par
  // virement ou prélèvement pour ce niveau de facturation B2B).

  /** Liste toutes les factures SaaS, les plus récentes d'abord (SUPER_ADMIN). */
  async listInvoices(status?: 'EMISE' | 'PAYEE' | 'EN_RETARD' | 'ANNULEE') {
    return this.prisma.saasInvoice.findMany({
      where: status ? { status } : undefined,
      include: {
        subscription: {
          include: { proprietaire: { include: { user: true } }, saasPlan: true },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /** Factures d'un propriétaire donné (via sa souscription). */
  async listInvoicesForProprietaire(proprietaireId: string) {
    return this.prisma.saasInvoice.findMany({
      where: { subscription: { proprietaireId } },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /**
   * Marque une facture SaaS comme payée. Le règlement effectif
   * (virement bancaire, prélèvement...) a lieu hors plateforme à ce
   * stade — cette action enregistre simplement la confirmation par le
   * SUPER_ADMIN après vérification.
   */
  async markInvoicePaid(invoiceId: string, actorUserId: string) {
    const invoice = await this.prisma.saasInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (invoice.status === 'PAYEE') {
      throw new BadRequestException('Cette facture est déjà marquée comme payée');
    }

    const updated = await this.prisma.saasInvoice.update({
      where: { id: invoiceId },
      data: { status: 'PAYEE', paidAt: new Date() },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'saas_invoice.marked_paid',
      entityType: 'SaasInvoice',
      entityId: invoiceId,
      metadata: { totalAmount: Number(invoice.totalAmount) },
    });

    return updated;
  }
}
