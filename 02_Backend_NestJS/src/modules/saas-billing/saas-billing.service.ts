import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { TenantContext } from '../../common/decorators/current-user.decorator';
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
    description: string;
    priceMonthly: number;
    priceAnnual: number;
    extraSalleFee: number;
    annualDiscountPct: number;
    trialDays: number;
    taxRatePct: number;
    quotaSalles: number;
    quotaGestionnaires: number | null;
    quotaCoachs: number | null;
    quotaAdherents: number | null;
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

    // §9.7 — Pendant la période d'essai gratuit, rien n'est facturé,
    // y compris une salle supplémentaire : l'essai porte sur
    // l'ensemble de l'offre, pas seulement la première salle. Sans
    // cette vérification, getOrCreateCurrentInvoice générait une
    // facture au tarif plein en ignorant complètement l'essai en
    // cours (même bug racine que changePlan, corrigé au même endroit).
    const trialEndDate = new Date(subscription.startDate);
    trialEndDate.setDate(trialEndDate.getDate() + subscription.saasPlan.trialDays);
    if (subscription.saasPlan.trialDays > 0 && new Date() < trialEndDate) {
      await this.audit.log({
        userId: actorUserId,
        salleId,
        action: 'saas_billing.extra_salle_added_during_trial',
        entityType: 'SaasSubscription',
        entityId: subscriptionId,
        metadata: { note: 'Aucune charge — salle ajoutée pendant la période d\'essai gratuit' },
      });
      return null;
    }

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
   *
   * Période d'essai (§9.7) : une facture est TOUJOURS créée — même
   * gratuite, l'historique de facturation doit rester continu, sans
   * trou entre l'inscription et le premier renouvellement payant. Son
   * montant est forcé à 0 et elle est immédiatement soldée (statut
   * PAYEE) : rien n'est réellement dû ni à encaisser pendant l'essai.
   */
  async generateBootstrapInvoice(subscriptionId: string) {
    const subscription = await this.prisma.saasSubscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      include: { saasPlan: true },
    });

    if (subscription.saasPlan.trialDays > 0) {
      return this.prisma.saasInvoice.create({
        data: {
          id: randomUUID(),
          subscriptionId: subscription.id,
          invoiceNumber: this.generateInvoiceNumber(),
          periodStart: subscription.startDate,
          periodEnd: subscription.currentPeriodEnd,
          baseAmount: 0,
          extraSallesCount: 0,
          extraSallesAmount: 0,
          addonsAmount: 0,
          taxAmount: 0,
          totalAmount: 0,
          currency: 'XOF',
          status: 'PAYEE',
          paidAt: new Date(),
          paymentMethod: 'ESSAI_GRATUIT',
        },
      });
    }

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
   * (facturé) ; seule la différence est due. Dès qu'un montant est
   * réellement dû (upgrade), l'encaissement est intégré à cette même
   * opération — jamais une facture EMISE laissée en suspens à régler
   * plus tard séparément : en espèces, réglé immédiatement ; en
   * Mobile Money, un code de confirmation est envoyé (même flux OTP
   * que le paiement self-service d'une facture, §9.8).
   *
   * Un downgrade (différence négative = crédit) n'exige par nature
   * aucun encaissement — impossible de "faire payer" un montant
   * négatif au client ; il est enregistré directement comme réglé
   * (crédit constaté), aucune méthode de paiement requise dans ce cas.
   *
   * Accessible au PROPRIETAIRE (sur SA PROPRE souscription) et au
   * SUPER_ADMIN (sur n'importe laquelle).
   *
   * Approximation assumée : la durée du cycle est fixée à 30 jours
   * (mensuel) ou 365 jours (annuel) plutôt que la durée exacte du
   * mois en cours — cohérent avec le reste du moteur de facturation,
   * suffisant pour un calcul de prorata qui reste une estimation par
   * nature.
   */
  async changePlan(
    subscriptionId: string,
    newPlanId: string,
    actorUserId: string,
    actor?: TenantContext,
    newBillingCycle?: 'MENSUEL' | 'ANNUEL',
    payment?: { method: 'ESPECES' | 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE'; phoneNumber?: string },
  ) {
    const subscription = await this.prisma.saasSubscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      include: { _count: { select: { salles: true } }, saasPlan: true },
    });

    // §2.8 — Un PROPRIETAIRE ne peut changer/renouveler que SA PROPRE
    // souscription ; seul le SUPER_ADMIN (accès global) peut agir sur
    // n'importe laquelle. `actor` optionnel pour rester compatible avec
    // d'éventuels appels internes/système sans contexte utilisateur.
    if (actor && !actor.isGlobalAccess && subscription.proprietaireId !== actor.proprietaireId) {
      throw new ForbiddenException('Vous ne pouvez modifier que votre propre abonnement SaaS');
    }

    const newPlan = await this.prisma.saasPlan.findUniqueOrThrow({ where: { id: newPlanId } });
    const oldPlan = subscription.saasPlan;
    // §9.8 — Le propriétaire peut aussi changer de périodicité
    // (mensuel ↔ annuel) au moment du réabonnement, pas seulement de
    // plan. Par défaut, on garde le cycle actuel si rien n'est précisé.
    const targetBillingCycle = newBillingCycle ?? subscription.billingCycle;

    if (actor && !actor.isGlobalAccess && newPlan.status !== 'ACTIF') {
      throw new BadRequestException('Ce plan n\'est plus disponible à la souscription');
    }

    const now = new Date();

    // §9.7 — Si la souscription est encore en période d'essai gratuit,
    // aucun prorata ne doit être calculé : la période en cours n'a
    // jamais rien coûté, il n'y a donc rien à créditer ni à facturer.
    const trialEndDate = new Date(subscription.startDate);
    trialEndDate.setDate(trialEndDate.getDate() + oldPlan.trialDays);
    const isInFreeTrial = oldPlan.trialDays > 0 && now < trialEndDate;

    let prorataInvoiceId: string | null = null;
    let prorataDifference = 0;
    let remainingDays = 0;
    let paymentResult: any = null;
    // §9.8, §9.12 — Un propriétaire agissant pour lui-même ne peut
    // jamais s'auto-valider : dès qu'un montant est dû, le changement
    // de plan attend la validation SUPER_ADMIN du paiement déclaré. Le
    // SUPER_ADMIN, lui, applique immédiatement — il EST le validateur.
    const isSelfService = !!actor && !actor.isGlobalAccess;
    let planChangeApplied = false;

    if (!isInFreeTrial) {
      const oldCycleLengthDays = subscription.billingCycle === 'ANNUEL' ? 365 : 30;
      const newCycleLengthDays = targetBillingCycle === 'ANNUEL' ? 365 : 30;
      remainingDays = Math.max(
        0,
        Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      );
      const oldDailyRate =
        Number(subscription.billingCycle === 'ANNUEL' ? oldPlan.priceAnnual : oldPlan.priceMonthly) /
        oldCycleLengthDays;
      const newDailyRate =
        Number(targetBillingCycle === 'ANNUEL' ? newPlan.priceAnnual : newPlan.priceMonthly) / newCycleLengthDays;
      const creditForUnusedOldPlan = oldDailyRate * remainingDays;
      const chargeForNewPlanRemainder = newDailyRate * remainingDays;
      prorataDifference = Math.round((chargeForNewPlanRemainder - creditForUnusedOldPlan) * 100) / 100;

      if (Math.abs(prorataDifference) >= 1) {
        const isAmountDue = prorataDifference > 0;

        if (isAmountDue && !payment) {
          throw new BadRequestException(
            `Un complément de ${prorataDifference} XOF est dû au prorata — précisez une méthode de paiement pour l'encaisser`,
          );
        }

        // Un montant dû réglé en self-service reste EMISE (en attente
        // de validation) ; sans montant dû (crédit) ou réglé par le
        // SUPER_ADMIN, la facture est directement soldée.
        const requiresValidation = isAmountDue && isSelfService;

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
            status: isAmountDue ? 'EMISE' : 'PAYEE',
            paidAt: isAmountDue ? null : now,
            // Le changement n'est écrit sur la souscription qu'après
            // validation quand une validation est requise ; sinon il
            // est appliqué tout de suite plus bas.
            pendingPlanId: requiresValidation ? newPlanId : null,
            pendingBillingCycle: requiresValidation ? targetBillingCycle : null,
          },
        });
        prorataInvoiceId = prorataInvoice.id;

        if (isAmountDue && payment) {
          if (requiresValidation) {
            if (payment.method === 'ESPECES') {
              // Pas d'OTP possible pour une déclaration "espèces" —
              // la déclaration est la soumission elle-même.
              await this.prisma.saasInvoice.update({
                where: { id: prorataInvoice.id },
                data: {
                  declaredPaymentMethod: 'ESPECES',
                  declaredAt: new Date(),
                  declaredByUserId: actorUserId,
                },
              });
              paymentResult = { pendingValidation: true };
            } else if (actor) {
              const otpResult = await this.initiateMobileMoneyPayment(prorataInvoice.id, actor, {
                method: payment.method,
                phoneNumber: payment.phoneNumber ?? '',
              });
              paymentResult = { pendingValidation: true, ...otpResult };
            }
          } else if (payment.method === 'ESPECES') {
            // SUPER_ADMIN réglant directement — pas d'auto-validation à attendre.
            await this.prisma.saasInvoice.update({
              where: { id: prorataInvoice.id },
              data: { status: 'PAYEE', paidAt: new Date(), paymentMethod: 'ESPECES' },
            });
            await this.audit.log({
              userId: actorUserId,
              action: 'saas_invoice.marked_paid',
              entityType: 'SaasInvoice',
              entityId: prorataInvoice.id,
              metadata: { totalAmount: prorataDifference, paymentMethod: 'ESPECES', context: 'change_plan' },
            });
            paymentResult = { immediate: true, status: 'PAYEE' };
          } else if (actor) {
            const otpResult = await this.initiateMobileMoneyPayment(prorataInvoice.id, actor, {
              method: payment.method,
              phoneNumber: payment.phoneNumber ?? '',
            });
            paymentResult = { immediate: false, ...otpResult };
          }
        }
      }
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

    // §9.8, §9.12 — N'applique le changement de plan MAINTENANT que
    // s'il n'y avait rien à valider (pas de montant dû, ou réglé
    // directement par le SUPER_ADMIN). Sinon, la souscription garde
    // son plan actuel jusqu'à approveDeclaredPayment.
    const shouldApplyNow = !(prorataInvoiceId && isSelfService && prorataDifference > 0);
    const updated = shouldApplyNow
      ? await this.prisma.saasSubscription.update({
          where: { id: subscriptionId },
          data: { saasPlanId: newPlanId, billingCycle: targetBillingCycle },
        })
      : subscription;
    if (shouldApplyNow) planChangeApplied = true;

    await this.audit.log({
      userId: actorUserId,
      action: shouldApplyNow ? 'saas_subscription.plan_changed' : 'saas_subscription.plan_change_pending_validation',
      entityType: 'SaasSubscription',
      entityId: subscriptionId,
      metadata: {
        fromPlanId: subscription.saasPlanId,
        toPlanId: newPlanId,
        fromBillingCycle: subscription.billingCycle,
        toBillingCycle: targetBillingCycle,
        remainingDays,
        prorataDifference,
        prorataInvoiceId,
      },
    });

    return {
      subscription: updated,
      planChangeApplied,
      prorata: {
        remainingDays,
        difference: prorataDifference,
        invoiceId: prorataInvoiceId,
      },
      payment: paymentResult,
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

  /** Souscription du propriétaire connecté — évite d'avoir à connaître son subscriptionId à l'avance côté client. */
  async getMySubscription(proprietaireId: string) {
    return this.prisma.saasSubscription.findUniqueOrThrow({
      where: { proprietaireId },
      include: { saasPlan: true },
    });
  }

  /** Souscription d'un propriétaire donné — usage SUPER_ADMIN (gestion depuis la fiche propriétaire). */
  async getSubscriptionForProprietaire(proprietaireId: string) {
    return this.prisma.saasSubscription.findUniqueOrThrow({
      where: { proprietaireId },
      include: { saasPlan: true },
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
    // grâce ou suspendue.
    await this.reactivateSubscriptionIfNeeded(invoice, actorUserId);

    return updated;
  }

  /**
   * §9.11 — Réactive une souscription EN_GRACE/SUSPENDU dès qu'une de
   * ses factures est réglée (peu importe le mode de règlement —
   * encaissement manuel par le SUPER_ADMIN/FINANCE ou paiement
   * self-service Mobile Money par le propriétaire). La période
   * couverte par la facture (calculée à l'émission) devient la
   * nouvelle échéance. Toutes les données restent conservées — on ne
   * fait que changer le statut et la date, jamais de suppression.
   */
  private async reactivateSubscriptionIfNeeded(
    invoice: { id: string; subscriptionId: string; periodEnd: Date; subscription: { status: string } },
    actorUserId?: string,
  ) {
    if (invoice.subscription.status !== 'EN_GRACE' && invoice.subscription.status !== 'SUSPENDU') return;

    await this.prisma.saasSubscription.update({
      where: { id: invoice.subscriptionId },
      data: { status: 'ACTIF', currentPeriodEnd: invoice.periodEnd, graceEndsAt: null },
    });
    await this.audit.log({
      userId: actorUserId,
      action: 'saas_subscription.reactivated',
      entityType: 'SaasSubscription',
      entityId: invoice.subscriptionId,
      metadata: { viaInvoiceId: invoice.id, newPeriodEnd: invoice.periodEnd },
    });
    // TODO(module notifications): confirmer la réactivation au propriétaire.
  }

  // ─────────────────────────────────────────────────────────────
  // Paiement self-service Mobile Money par le propriétaire (§9.8)
  // ─────────────────────────────────────────────────────────────
  //
  // Simule un flux Orange/Moov/Wave à deux temps (initiation → OTP)
  // faute d'intégration réelle avec les opérateurs à ce stade — même
  // simplification assumée que pour le module Paiements adhérent
  // (PaymentsService.initiateMobileMoney). Le code OTP est exposé
  // directement dans la réponse d'initiation (`devOtpCode`) pour
  // permettre les tests sans SMS réel ; à retirer dès qu'un vrai
  // fournisseur SMS est branché (§9.9, module Notifications).

  private readonly OTP_VALIDITY_MINUTES = 5;

  /** Génère et "envoie" un code OTP à 6 chiffres pour régler une facture SaaS par Mobile Money. */
  async initiateMobileMoneyPayment(
    invoiceId: string,
    actor: TenantContext,
    details: { method: 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE'; phoneNumber: string },
  ) {
    const invoice = await this.prisma.saasInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { subscription: true },
    });

    if (!actor.isGlobalAccess && invoice.subscription.proprietaireId !== actor.proprietaireId) {
      throw new ForbiddenException('Vous ne pouvez régler que vos propres factures');
    }
    if (invoice.status === 'PAYEE') {
      throw new BadRequestException('Cette facture est déjà payée');
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + this.OTP_VALIDITY_MINUTES * 60 * 1000);

    await this.prisma.saasInvoice.update({
      where: { id: invoiceId },
      data: {
        pendingOtpCode: otpCode,
        pendingOtpExpiresAt: otpExpiresAt,
        pendingPaymentMethod: details.method,
        pendingPhoneNumber: details.phoneNumber,
      },
    });

    await this.audit.log({
      userId: actor.userId,
      action: 'saas_invoice.mobile_money_initiated',
      entityType: 'SaasInvoice',
      entityId: invoiceId,
      metadata: { method: details.method, phoneNumber: details.phoneNumber },
    });

    return {
      message: `Code de confirmation envoyé au ${details.phoneNumber}`,
      expiresInMinutes: this.OTP_VALIDITY_MINUTES,
      devOtpCode: otpCode, // TODO(module notifications): retirer une fois le SMS réel branché
    };
  }

  /** Valide le code OTP et solde la facture — réactive la souscription si nécessaire (§9.11). */
  /**
   * §9.8, §9.12 — Valide le code OTP, puis :
   *  - SUPER_ADMIN/personnel interne (accès global) : règle directement
   *    la facture (PAYEE) et applique un changement de plan en attente
   *    le cas échéant — il EST le validateur, pas de double étape.
   *  - PROPRIETAIRE (self-service) : ne fait que DÉCLARER le paiement,
   *    sans le régler — la facture reste EMISE jusqu'à ce qu'un
   *    SUPER_ADMIN/RESPONSABLE_FINANCE vérifie réellement la réception
   *    des fonds et approuve via approveDeclaredPayment.
   */
  async confirmMobileMoneyOtp(invoiceId: string, actor: TenantContext, otpCode: string) {
    const invoice = await this.prisma.saasInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { subscription: true },
    });

    if (!actor.isGlobalAccess && invoice.subscription.proprietaireId !== actor.proprietaireId) {
      throw new ForbiddenException('Vous ne pouvez régler que vos propres factures');
    }
    if (!invoice.pendingOtpCode || !invoice.pendingOtpExpiresAt) {
      throw new BadRequestException('Aucun paiement Mobile Money en attente pour cette facture');
    }
    if (invoice.pendingOtpExpiresAt < new Date()) {
      throw new BadRequestException('Code expiré — merci de relancer le paiement');
    }
    if (invoice.pendingOtpCode !== otpCode) {
      throw new BadRequestException('Code incorrect');
    }

    if (actor.isGlobalAccess) {
      // Réglé directement — pas d'auto-validation à attendre.
      const updated = await this.prisma.saasInvoice.update({
        where: { id: invoiceId },
        data: {
          status: 'PAYEE',
          paidAt: new Date(),
          paymentMethod: invoice.pendingPaymentMethod,
          paymentReference: invoice.pendingPhoneNumber,
          pendingOtpCode: null,
          pendingOtpExpiresAt: null,
          pendingPaymentMethod: null,
          pendingPhoneNumber: null,
        },
      });

      if (invoice.pendingPlanId) {
        await this.prisma.saasSubscription.update({
          where: { id: invoice.subscriptionId },
          data: {
            saasPlanId: invoice.pendingPlanId,
            billingCycle: invoice.pendingBillingCycle ?? invoice.subscription.billingCycle,
          },
        });
        await this.prisma.saasInvoice.update({
          where: { id: invoiceId },
          data: { pendingPlanId: null, pendingBillingCycle: null },
        });
      }

      await this.audit.log({
        userId: actor.userId,
        action: 'saas_invoice.mobile_money_confirmed',
        entityType: 'SaasInvoice',
        entityId: invoiceId,
        metadata: { totalAmount: Number(invoice.totalAmount) },
      });

      await this.reactivateSubscriptionIfNeeded(invoice, actor.userId);
      return updated;
    }

    const updated = await this.prisma.saasInvoice.update({
      where: { id: invoiceId },
      data: {
        // Toujours EMISE : la déclaration n'est pas un règlement.
        declaredPaymentMethod: invoice.pendingPaymentMethod,
        declaredPaymentReference: invoice.pendingPhoneNumber,
        declaredAt: new Date(),
        declaredByUserId: actor.userId,
        pendingOtpCode: null,
        pendingOtpExpiresAt: null,
        pendingPaymentMethod: null,
        pendingPhoneNumber: null,
      },
    });

    await this.audit.log({
      userId: actor.userId,
      action: 'saas_invoice.payment_declared',
      entityType: 'SaasInvoice',
      entityId: invoiceId,
      metadata: { totalAmount: Number(invoice.totalAmount), method: invoice.pendingPaymentMethod },
    });

    // Pas de règlement ni de réactivation ici — en attente du
    // SUPER_ADMIN (voir approveDeclaredPayment).
    return updated;
  }

  /**
   * §9.8, §9.12 — Approuve une facture déclarée payée par le
   * propriétaire : constate réellement le règlement (statut PAYEE),
   * réactive la souscription si elle était en grâce/suspendue, et
   * applique un changement de plan en attente le cas échéant
   * (pendingPlanId/pendingBillingCycle, voir changePlan).
   */
  async approveDeclaredPayment(invoiceId: string, actorUserId: string) {
    const invoice = await this.prisma.saasInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { subscription: true },
    });

    if (invoice.status === 'PAYEE') {
      throw new BadRequestException('Cette facture est déjà validée');
    }
    if (!invoice.declaredAt) {
      throw new BadRequestException('Aucun paiement déclaré par le propriétaire pour cette facture');
    }

    const updated = await this.prisma.saasInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAYEE',
        paidAt: new Date(),
        paymentMethod: invoice.declaredPaymentMethod,
        paymentReference: invoice.declaredPaymentReference,
      },
    });

    if (invoice.pendingPlanId) {
      await this.prisma.saasSubscription.update({
        where: { id: invoice.subscriptionId },
        data: {
          saasPlanId: invoice.pendingPlanId,
          billingCycle: invoice.pendingBillingCycle ?? invoice.subscription.billingCycle,
        },
      });
      await this.prisma.saasInvoice.update({
        where: { id: invoiceId },
        data: { pendingPlanId: null, pendingBillingCycle: null },
      });
    }

    await this.audit.log({
      userId: actorUserId,
      action: 'saas_invoice.approved',
      entityType: 'SaasInvoice',
      entityId: invoiceId,
      metadata: { totalAmount: Number(invoice.totalAmount), planApplied: invoice.pendingPlanId ?? null },
    });

    await this.reactivateSubscriptionIfNeeded(invoice, actorUserId);

    // TODO(module notifications): confirmer la validation au propriétaire.

    return updated;
  }

  /**
   * §9.8 — Rejette une déclaration de paiement (fonds non retrouvés
   * après vérification) : la facture reste EMISE, la déclaration est
   * effacée pour que le propriétaire puisse en soumettre une nouvelle,
   * et un changement de plan en attente est abandonné.
   */
  async rejectDeclaredPayment(invoiceId: string, actorUserId: string, reason?: string) {
    const invoice = await this.prisma.saasInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (!invoice.declaredAt) {
      throw new BadRequestException('Aucun paiement déclaré à rejeter pour cette facture');
    }

    const updated = await this.prisma.saasInvoice.update({
      where: { id: invoiceId },
      data: {
        declaredPaymentMethod: null,
        declaredPaymentReference: null,
        declaredAt: null,
        declaredByUserId: null,
        pendingPlanId: null,
        pendingBillingCycle: null,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'saas_invoice.declaration_rejected',
      entityType: 'SaasInvoice',
      entityId: invoiceId,
      metadata: { reason },
    });

    // TODO(module notifications): informer le propriétaire du rejet et du motif.

    return updated;
  }

  /** Factures avec une déclaration de paiement en attente de validation SUPER_ADMIN (§9.8, §9.12). */
  async listPendingValidation() {
    return this.prisma.saasInvoice.findMany({
      where: { status: 'EMISE', declaredAt: { not: null } },
      include: {
        subscription: {
          include: { proprietaire: { include: { user: true } }, saasPlan: true },
        },
      },
      orderBy: { declaredAt: 'asc' },
    });
  }
}
