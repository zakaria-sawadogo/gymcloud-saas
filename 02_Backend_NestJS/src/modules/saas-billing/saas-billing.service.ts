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

  /**
   * Par défaut, ne retourne que les plans ACTIF (pertinent pour le
   * choix d'un plan à la création d'une salle — un plan suspendu ou
   * archivé ne doit plus être proposable à un nouveau client). Le
   * SUPER_ADMIN gérant le catalogue passe `includeAll: true` pour voir
   * aussi les plans SUSPENDU/ARCHIVE et pouvoir les réactiver.
   */
  listPlans(includeAll = false) {
    return this.prisma.saasPlan.findMany({
      where: includeAll ? undefined : { status: 'ACTIF' },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /**
   * §9.3 — Change le statut d'un plan. Un plan SUSPENDU ou ARCHIVE
   * n'apparaît plus dans le catalogue proposé (listPlans), mais les
   * souscriptions déjà actives sur ce plan ne sont jamais affectées :
   * seule la disponibilité à la SOUSCRIPTION change, pas les clients
   * existants.
   */
  async setPlanStatus(planId: string, status: 'ACTIF' | 'SUSPENDU' | 'ARCHIVE', actorUserId: string) {
    const plan = await this.prisma.saasPlan.update({ where: { id: planId }, data: { status } });
    await this.audit.log({
      userId: actorUserId,
      action: `saas_plan.${status.toLowerCase()}`,
      entityType: 'SaasPlan',
      entityId: planId,
    });
    return plan;
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
   * §9.3 — Applique les remises configurables sur le montant de base :
   *  - `annualDiscountPct` (plan) : remise plan-wide sur la
   *    facturation annuelle, incitant au paiement annuel plutôt que
   *    mensuel — ne s'applique jamais au cycle mensuel.
   *  - `promotionalDiscountPct` (souscription) : remise négociée
   *    propre à CE client (ex: partenariat, geste commercial),
   *    cumulable avec la remise annuelle.
   * Aucun montant codé en dur : les deux taux sont entièrement
   * configurables par le SUPER_ADMIN (§9.3).
   */
  private applyDiscounts(
    rawAmount: number,
    billingCycle: 'MENSUEL' | 'ANNUEL',
    annualDiscountPct: any,
    promotionalDiscountPct: any,
  ): { discountedAmount: number; totalDiscountApplied: number } {
    let amount = rawAmount;

    if (billingCycle === 'ANNUEL' && Number(annualDiscountPct ?? 0) > 0) {
      amount = amount * (1 - Number(annualDiscountPct) / 100);
    }
    if (Number(promotionalDiscountPct ?? 0) > 0) {
      amount = amount * (1 - Number(promotionalDiscountPct) / 100);
    }

    return { discountedAmount: amount, totalDiscountApplied: rawAmount - amount };
  }

  /**
   * §9.7, §9.13 — Génère la toute première facture d'une souscription,
   * immédiatement après sa création (bootstrap, voir SallesService.create).
   * Sans cet appel, une salle créée DANS le quota inclus (jamais
   * "supplémentaire") n'aurait aucune facture générée avant son tout
   * premier renouvellement automatique 30 jours plus tard — aucune
   * trace de ce qui est dû pour la toute première période, rien à
   * encaisser (bug réel identifié en test : un propriétaire nouvellement
   * créé avec sa première salle n'apparaissait jamais en facturation).
   */
  async generateBootstrapInvoice(subscriptionId: string) {
    const subscription = await this.prisma.saasSubscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      include: { saasPlan: true },
    });
    return this.getOrCreateCurrentInvoice(subscription);
  }

  /**
   * Retourne la facture SaaS de la période courante ; la crée si elle
   * n'existe pas encore (première charge de la période).
   */
  private async getOrCreateCurrentInvoice(subscription: {
    id: string;
    billingCycle: 'MENSUEL' | 'ANNUEL';
    currentPeriodEnd: Date;
    promotionalDiscountPct?: any;
    saasPlan: { priceMonthly: any; priceAnnual: any; taxRatePct: any; annualDiscountPct: any };
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
    const rawAmount =
      subscription.billingCycle === 'ANNUEL'
        ? subscription.saasPlan.priceAnnual
        : subscription.saasPlan.priceMonthly;
    const { discountedAmount: baseAmount } = this.applyDiscounts(
      Number(rawAmount),
      subscription.billingCycle,
      subscription.saasPlan.annualDiscountPct,
      subscription.promotionalDiscountPct,
    );
    const taxAmount = (baseAmount * Number(subscription.saasPlan.taxRatePct ?? 0)) / 100;

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

  private computeNextPeriodEnd(from: Date, billingCycle: 'MENSUEL' | 'ANNUEL'): Date {
    const next = new Date(from);
    if (billingCycle === 'ANNUEL') {
      next.setFullYear(next.getFullYear() + 1);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  }

  /**
   * §9.8, §9.13 — Génère la facture de renouvellement pour la période
   * à venir, dès qu'une souscription entre en grâce (voir
   * processSubscriptionLifecycle). Recalcule le nombre de salles
   * supplémentaires à partir du décompte RÉEL actuel plutôt que de
   * reprendre l'ancien montant — le propriétaire peut avoir
   * ajouté/retiré des salles depuis la dernière facture.
   */
  private async generateRenewalInvoice(subscription: {
    id: string;
    billingCycle: 'MENSUEL' | 'ANNUEL';
    currentPeriodEnd: Date;
    saasPlanId: string;
    promotionalDiscountPct?: any;
    saasPlan: {
      priceMonthly: any;
      priceAnnual: any;
      taxRatePct: any;
      quotaSalles: number;
      extraSalleFee: any;
      annualDiscountPct: any;
    };
  }) {
    const periodStart = subscription.currentPeriodEnd;
    const periodEnd = this.computeNextPeriodEnd(periodStart, subscription.billingCycle);

    const salleCount = await this.prisma.salle.count({ where: { subscriptionId: subscription.id } });
    const extraSallesCount = Math.max(0, salleCount - subscription.saasPlan.quotaSalles);
    const extraSallesAmount = extraSallesCount * Number(subscription.saasPlan.extraSalleFee);

    const rawAmount =
      subscription.billingCycle === 'ANNUEL'
        ? subscription.saasPlan.priceAnnual
        : subscription.saasPlan.priceMonthly;
    const { discountedAmount: baseAmount } = this.applyDiscounts(
      Number(rawAmount),
      subscription.billingCycle,
      subscription.saasPlan.annualDiscountPct,
      subscription.promotionalDiscountPct,
    );
    const taxAmount = ((baseAmount + extraSallesAmount) * Number(subscription.saasPlan.taxRatePct ?? 0)) / 100;

    return this.prisma.saasInvoice.create({
      data: {
        id: randomUUID(),
        subscriptionId: subscription.id,
        invoiceNumber: this.generateInvoiceNumber(),
        periodStart,
        periodEnd,
        baseAmount,
        extraSallesCount,
        extraSallesAmount,
        addonsAmount: 0,
        taxAmount,
        totalAmount: baseAmount + extraSallesAmount + taxAmount,
        currency: 'XOF', // TODO: dériver de Country.currency selon proprietaire.countryId
        status: 'EMISE',
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Cycle de vie de l'abonnement (§9.7 à §9.12)
  // ─────────────────────────────────────────────────────────────

  /**
   * §9.12 — Changement de plan avec calcul automatique du prorata :
   * les jours restants sur la période en cours sont valorisés au
   * tarif journalier de l'ancien plan (crédité) et du nouveau plan
   * (facturé) ; seule la différence est due immédiatement. Un
   * downgrade peut donc produire un montant négatif (crédit),
   * enregistré directement comme réglé (`PAYEE`) puisqu'aucun
   * paiement n'est réellement attendu du client dans ce cas.
   *
   * Approximation assumée : la durée du cycle est fixée à 30 jours
   * (mensuel) ou 365 jours (annuel) plutôt que la durée exacte du
   * mois en cours — cohérent avec le reste du moteur de facturation,
   * suffisant pour un calcul de prorata qui reste une estimation par
   * nature.
   */
  async changePlan(subscriptionId: string, newPlanId: string, actorUserId: string) {
    const subscription = await this.prisma.saasSubscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      include: { _count: { select: { salles: true } }, saasPlan: true },
    });
    const newPlan = await this.prisma.saasPlan.findUniqueOrThrow({ where: { id: newPlanId } });
    const oldPlan = subscription.saasPlan;

    const now = new Date();
    const cycleLengthDays = subscription.billingCycle === 'ANNUEL' ? 365 : 30;
    const remainingDays = Math.max(
      0,
      Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const oldDailyRate =
      Number(subscription.billingCycle === 'ANNUEL' ? oldPlan.priceAnnual : oldPlan.priceMonthly) / cycleLengthDays;
    const newDailyRate =
      Number(subscription.billingCycle === 'ANNUEL' ? newPlan.priceAnnual : newPlan.priceMonthly) / cycleLengthDays;
    const creditForUnusedOldPlan = oldDailyRate * remainingDays;
    const chargeForNewPlanRemainder = newDailyRate * remainingDays;
    const prorataDifference = Math.round((chargeForNewPlanRemainder - creditForUnusedOldPlan) * 100) / 100;

    let prorataInvoiceId: string | null = null;
    if (Math.abs(prorataDifference) >= 1) {
      const prorataInvoice = await this.prisma.saasInvoice.create({
        data: {
          id: randomUUID(),
          subscriptionId,
          invoiceNumber: this.generateInvoiceNumber(),
          periodStart: now,
          periodEnd: subscription.currentPeriodEnd,
          baseAmount: prorataDifference,
          extraSallesCount: 0,
          extraSallesAmount: 0,
          addonsAmount: 0,
          taxAmount: 0,
          totalAmount: prorataDifference,
          currency: 'XOF',
          // Un downgrade (différence négative = crédit) n'exige aucun
          // règlement du client : il est marqué PAYEE d'emblée. Un
          // upgrade (différence positive) reste EMISE, à encaisser.
          status: prorataDifference > 0 ? 'EMISE' : 'PAYEE',
          paidAt: prorataDifference > 0 ? null : now,
        },
      });
      prorataInvoiceId = prorataInvoice.id;
    }

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
      metadata: {
        fromPlanId: subscription.saasPlanId,
        toPlanId: newPlanId,
        remainingDays,
        prorataDifference,
        prorataInvoiceId,
      },
    });

    return {
      subscription: updated,
      prorata: {
        remainingDays,
        difference: prorataDifference,
        invoiceId: prorataInvoiceId,
      },
      nouvelleEcheance: subscription.currentPeriodEnd, // inchangée par un changement de plan — seul le tarif change
      nouveauxQuotas: {
        quotaSalles: newPlan.quotaSalles,
        quotaGestionnaires: newPlan.quotaGestionnaires,
        quotaCoachs: newPlan.quotaCoachs,
        quotaAdherents: newPlan.quotaAdherents,
      },
    };
  }

  /**
   * §9.7, §9.10 — Cycle de vie automatique des abonnements SaaS,
   * exécuté quotidiennement (voir SaasBillingSchedulerService) :
   *  - ACTIF → EN_GRACE dès que `currentPeriodEnd` est dépassé, avec
   *    génération immédiate de la facture de renouvellement — sans
   *    quoi rien ne permettrait de sortir de la grâce (le mode
   *    dégradé à J+8 est déjà géré en temps réel par
   *    SubscriptionAccessGuard à partir des mêmes dates, indépendamment
   *    de ce job).
   *  - EN_GRACE → SUSPENDU au-delà de `graceEndsAt` (J+15).
   */
  async processSubscriptionLifecycle() {
    const now = new Date();
    let movedToGrace = 0;
    let movedToSuspended = 0;

    const expiring = await this.prisma.saasSubscription.findMany({
      where: { status: 'ACTIF', currentPeriodEnd: { lt: now } },
      include: { saasPlan: true },
    });
    for (const sub of expiring) {
      const graceEndsAt = new Date(sub.currentPeriodEnd);
      graceEndsAt.setDate(graceEndsAt.getDate() + 15);

      await this.prisma.saasSubscription.update({
        where: { id: sub.id },
        data: { status: 'EN_GRACE', graceEndsAt },
      });
      await this.generateRenewalInvoice(sub);
      await this.audit.log({
        action: 'saas_subscription.entered_grace',
        entityType: 'SaasSubscription',
        entityId: sub.id,
      });
      movedToGrace++;
      // TODO(module notifications): notifier le propriétaire — J-30/15/7/3/1
      // sont envoyés AVANT expiration (§9.9, pas encore implémenté) ;
      // ce point-ci correspond au moment où l'expiration vient de se
      // produire.
    }

    const overdue = await this.prisma.saasSubscription.findMany({
      where: { status: 'EN_GRACE', graceEndsAt: { lt: now } },
    });
    for (const sub of overdue) {
      await this.prisma.saasSubscription.update({
        where: { id: sub.id },
        data: { status: 'SUSPENDU' },
      });
      await this.audit.log({
        action: 'saas_subscription.suspended_after_grace',
        entityType: 'SaasSubscription',
        entityId: sub.id,
      });
      movedToSuspended++;
    }

    return { movedToGrace, movedToSuspended };
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
   * (virement bancaire, Mobile Money, espèces...) a lieu hors
   * plateforme à ce niveau B2B — cette action enregistre la
   * confirmation par le SUPER_ADMIN/RESPONSABLE_FINANCE après
   * vérification, avec la méthode et la référence de paiement pour
   * traçabilité comptable (§9.13), à l'image de l'encaissement
   * adhérent → salle (PaymentsService.recordCashPayment).
   */
  async markInvoicePaid(
    invoiceId: string,
    actorUserId: string,
    details: { paymentMethod: string; paymentReference?: string },
  ) {
    const invoice = await this.prisma.saasInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { subscription: true },
    });
    if (invoice.status === 'PAYEE') {
      throw new BadRequestException('Cette facture est déjà marquée comme payée');
    }

    const updated = await this.prisma.saasInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAYEE',
        paidAt: new Date(),
        paymentMethod: details.paymentMethod,
        paymentReference: details.paymentReference,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'saas_invoice.marked_paid',
      entityType: 'SaasInvoice',
      entityId: invoiceId,
      metadata: {
        totalAmount: Number(invoice.totalAmount),
        paymentMethod: details.paymentMethod,
        paymentReference: details.paymentReference,
      },
    });

    // §9.11 — Réactivation automatique si la souscription était en
    // grâce ou suspendue : la période couverte par cette facture
    // (calculée à l'émission, voir generateRenewalInvoice) devient la
    // nouvelle échéance. Toutes les données restent conservées — on ne
    // fait que changer le statut et la date, jamais de suppression.
    if (invoice.subscription.status === 'EN_GRACE' || invoice.subscription.status === 'SUSPENDU') {
      await this.prisma.saasSubscription.update({
        where: { id: invoice.subscriptionId },
        data: {
          status: 'ACTIF',
          currentPeriodEnd: invoice.periodEnd,
          graceEndsAt: null,
        },
      });
      await this.audit.log({
        userId: actorUserId,
        action: 'saas_subscription.reactivated',
        entityType: 'SaasSubscription',
        entityId: invoice.subscriptionId,
        metadata: { viaInvoiceId: invoiceId, newPeriodEnd: invoice.periodEnd },
      });
      // TODO(module notifications): confirmer la réactivation au propriétaire.
    }

    return updated;
  }
}
