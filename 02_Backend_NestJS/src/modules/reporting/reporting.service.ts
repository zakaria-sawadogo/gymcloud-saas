import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Service de Reporting / BI (§11.1 à §11.x).
 *
 * Agrège les données déjà produites par les modules Adhérents,
 * Contrôle d'accès, Réservations, Paiements et SaaS Billing en
 * tableaux de bord adaptés à chaque rôle :
 *  - GESTIONNAIRE : pilotage quotidien d'une salle.
 *  - PROPRIETAIRE : vue consolidée multi-salles.
 *  - SUPER_ADMIN : santé globale de la plateforme SaaS.
 *
 * Toutes les méthodes sont en lecture seule (aucune écriture), ce qui
 * permet de les exécuter fréquemment sans risque d'effet de bord.
 */
@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────
  // Tableau de bord Gestionnaire (§11.x)
  // ─────────────────────────────────────────────────────────────

  async getGestionnaireDashboard(salleId: string) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekAhead = new Date(now);
    weekAhead.setDate(weekAhead.getDate() + 7);

    const [
      activeAdherents,
      enGraceAdherents,
      expiredAdherents,
      suspendedAdherents,
      newAdherentsThisMonth,
      todayRevenueAgg,
      monthRevenueAgg,
      todayVisits,
      currentOccupancy,
      upcomingBookings,
    ] = await Promise.all([
      this.prisma.adherentProfile.count({ where: { salleId, status: 'ACTIF' } }),
      this.prisma.adherentProfile.count({ where: { salleId, status: 'EN_GRACE' } }),
      this.prisma.adherentProfile.count({ where: { salleId, status: 'EXPIRE' } }),
      this.prisma.adherentProfile.count({ where: { salleId, status: 'SUSPENDU' } }),
      this.prisma.adherentProfile.count({ where: { salleId, joinedAt: { gte: monthStart } } }),
      this.prisma.payment.aggregate({
        where: { salleId, status: 'VALIDE', validatedAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { salleId, status: 'VALIDE', validatedAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.accessLog.count({ where: { salleId, checkInAt: { gte: todayStart } } }),
      this.prisma.accessLog.count({ where: { salleId, checkOutAt: null } }),
      this.prisma.booking.count({
        where: { salleId, status: 'CONFIRMEE', startAt: { gte: now, lte: weekAhead } },
      }),
    ]);

    return {
      adherents: {
        actifs: activeAdherents,
        enGrace: enGraceAdherents,
        expires: expiredAdherents,
        suspendus: suspendedAdherents,
        nouveauxCeMois: newAdherentsThisMonth,
        total: activeAdherents + enGraceAdherents + expiredAdherents + suspendedAdherents,
      },
      revenus: {
        aujourdHui: Number(todayRevenueAgg._sum.amount ?? 0),
        ceMois: Number(monthRevenueAgg._sum.amount ?? 0),
      },
      frequentation: {
        visitesAujourdHui: todayVisits,
        presentsActuellement: currentOccupancy,
      },
      reservations: {
        confirmeesSeptJoursAVenir: upcomingBookings,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Revenus détaillés (§11.x)
  // ─────────────────────────────────────────────────────────────

  async getRevenueReport(salleId: string, from: Date, to: Date) {
    const payments = await this.prisma.payment.findMany({
      where: { salleId, status: 'VALIDE', validatedAt: { gte: from, lte: to } },
      select: { amount: true, method: true, type: true, validatedAt: true },
    });

    const byMethod: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    let total = 0;

    for (const p of payments) {
      const amount = Number(p.amount);
      total += amount;
      byMethod[p.method] = (byMethod[p.method] ?? 0) + amount;
      byType[p.type] = (byType[p.type] ?? 0) + amount;
      const dayKey = p.validatedAt!.toISOString().slice(0, 10);
      byDay[dayKey] = (byDay[dayKey] ?? 0) + amount;
    }

    return { total, transactionCount: payments.length, byMethod, byType, byDay };
  }

  // ─────────────────────────────────────────────────────────────
  // Fréquentation (§11.x)
  // ─────────────────────────────────────────────────────────────

  async getOccupancyTrends(salleId: string, from: Date, to: Date) {
    const logs = await this.prisma.accessLog.findMany({
      where: { salleId, checkInAt: { gte: from, lte: to } },
      select: { checkInAt: true },
    });

    const byDay: Record<string, number> = {};
    for (const log of logs) {
      const dayKey = log.checkInAt.toISOString().slice(0, 10);
      byDay[dayKey] = (byDay[dayKey] ?? 0) + 1;
    }

    return { totalVisits: logs.length, byDay };
  }

  // ─────────────────────────────────────────────────────────────
  // Rétention (§11.x)
  // ─────────────────────────────────────────────────────────────

  /**
   * Taux de rétention simplifié : proportion d'adhérents n'ayant jamais
   * basculé en statut EXPIRE parmi l'ensemble des adhérents de la
   * salle. Métrique volontairement simple pour cette première
   * itération — une analyse de cohortes (rétention à 30/60/90 jours
   * par mois d'inscription) est prévue en évolution du module.
   */
  async getRetentionReport(salleId: string) {
    const [total, expired, active] = await Promise.all([
      this.prisma.adherentProfile.count({ where: { salleId } }),
      this.prisma.adherentProfile.count({ where: { salleId, status: 'EXPIRE' } }),
      this.prisma.adherentProfile.count({ where: { salleId, status: 'ACTIF' } }),
    ]);

    const renewalsCount = await this.prisma.adherentAbonnement.count({
      where: { adherent: { salleId }, isRenewal: true },
    });

    return {
      totalAdherents: total,
      adherentsActifs: active,
      adherentsExpires: expired,
      tauxRetentionApproximatif: total > 0 ? Number((1 - expired / total).toFixed(3)) : null,
      nombreDeReabonnements: renewalsCount,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Tableau de bord Propriétaire — vue consolidée multi-salles (§2.3)
  // ─────────────────────────────────────────────────────────────

  async getProprietaireDashboard(proprietaireId: string) {
    const salles = await this.prisma.salle.findMany({ where: { proprietaireId } });

    const perSalle = await Promise.all(
      salles.map(async (salle: { id: string; name: string }) => {
        const dashboard = await this.getGestionnaireDashboard(salle.id);
        return { salleId: salle.id, salleName: salle.name, ...dashboard };
      }),
    );

    const consolidated = perSalle.reduce(
      (acc, s) => ({
        totalAdherentsActifs: acc.totalAdherentsActifs + s.adherents.actifs,
        revenusAujourdHui: acc.revenusAujourdHui + s.revenus.aujourdHui,
        revenusCeMois: acc.revenusCeMois + s.revenus.ceMois,
        presentsActuellement: acc.presentsActuellement + s.frequentation.presentsActuellement,
      }),
      { totalAdherentsActifs: 0, revenusAujourdHui: 0, revenusCeMois: 0, presentsActuellement: 0 },
    );

    return { consolidated, salles: perSalle };
  }

  // ─────────────────────────────────────────────────────────────
  // Tableau de bord SUPER_ADMIN — santé globale de la plateforme (§9, §13)
  // ─────────────────────────────────────────────────────────────

  async getSuperAdminDashboard() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [
      totalSalles,
      totalProprietaires,
      totalGestionnaires,
      totalCoachs,
      totalAdherents,
      newSallesThisMonth,
      newProprietairesThisMonth,
      subscriptionsByPlan,
      sallesByStatus,
      saasRevenueToday,
      saasRevenueThisMonth,
      saasRevenueThisYear,
      saasRevenuePending,
      extraSallesRevenueThisMonth,
    ] = await Promise.all([
      this.prisma.salle.count(),
      this.prisma.proprietaire.count(),
      this.prisma.gestionnaireProfile.count(),
      this.prisma.coachProfile.count(),
      this.prisma.adherentProfile.count(),
      this.prisma.salle.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.proprietaire.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.saasSubscription.groupBy({ by: ['saasPlanId'], _count: { _all: true } }),
      this.prisma.saasSubscription.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.saasInvoice.aggregate({
        where: { status: 'PAYEE', paidAt: { gte: todayStart } },
        _sum: { totalAmount: true },
      }),
      this.prisma.saasInvoice.aggregate({
        where: { status: 'PAYEE', paidAt: { gte: monthStart } },
        _sum: { totalAmount: true },
      }),
      this.prisma.saasInvoice.aggregate({
        where: { status: 'PAYEE', paidAt: { gte: yearStart } },
        _sum: { totalAmount: true },
      }),
      this.prisma.saasInvoice.aggregate({
        where: { status: 'EMISE' },
        _sum: { totalAmount: true },
      }),
      this.prisma.saasInvoice.aggregate({
        where: { status: 'PAYEE', paidAt: { gte: monthStart } },
        _sum: { extraSallesAmount: true },
      }),
    ]);

    const plans = await this.prisma.saasPlan.findMany({
      where: { id: { in: subscriptionsByPlan.map((s: { saasPlanId: string }) => s.saasPlanId) } },
    });
    const planBreakdown = subscriptionsByPlan.map((s: { saasPlanId: string; _count: { _all: number } }) => ({
      planCode: plans.find((p: { id: string; code: string }) => p.id === s.saasPlanId)?.code ?? 'INCONNU',
      count: s._count._all,
    }));

    const statusBreakdown: Record<string, number> = { ACTIF: 0, EN_GRACE: 0, SUSPENDU: 0, EXPIRE: 0 };
    for (const s of sallesByStatus as Array<{ status: string; _count: { _all: number } }>) {
      statusBreakdown[s.status] = s._count._all;
    }

    // Renouvellements / upgrades / downgrades ce mois (§9.14). Un
    // renouvellement se distingue d'une première facturation par
    // l'existence d'une facture PAYEE antérieure pour la même
    // souscription. Upgrade/downgrade déduits en comparant le prix
    // mensuel effectif des deux plans au moment du changement.
    const [renewalsThisMonth, planChangeLogs] = await Promise.all([
      this.countRenewalsThisMonth(monthStart),
      this.prisma.auditLog.findMany({
        where: { action: 'saas_subscription.plan_changed', createdAt: { gte: monthStart } },
      }),
    ]);
    let upgrades = 0;
    let downgrades = 0;
    for (const log of planChangeLogs) {
      const meta = log.metadata as { fromPlanId?: string; toPlanId?: string } | null;
      if (!meta?.fromPlanId || !meta?.toPlanId) continue;
      const [fromPlan, toPlan] = await Promise.all([
        this.prisma.saasPlan.findUnique({ where: { id: meta.fromPlanId } }),
        this.prisma.saasPlan.findUnique({ where: { id: meta.toPlanId } }),
      ]);
      if (!fromPlan || !toPlan) continue;
      if (Number(toPlan.priceMonthly) > Number(fromPlan.priceMonthly)) upgrades++;
      else if (Number(toPlan.priceMonthly) < Number(fromPlan.priceMonthly)) downgrades++;
    }

    return {
      plateforme: {
        totalSalles,
        totalProprietaires,
        totalGestionnaires,
        totalCoachs,
        totalAdherents,
        nouvellesSallesCeMois: newSallesThisMonth,
        nouveauxProprietairesCeMois: newProprietairesThisMonth,
      },
      activiteSaas: {
        sallesActives: statusBreakdown.ACTIF,
        sallesEnGrace: statusBreakdown.EN_GRACE,
        sallesSuspendues: statusBreakdown.SUSPENDU,
        sallesExpirees: statusBreakdown.EXPIRE,
        renouvellementsCeMois: renewalsThisMonth,
        upgradesCeMois: upgrades,
        downgradesCeMois: downgrades,
      },
      revenus: {
        aujourdHui: Number(saasRevenueToday._sum.totalAmount ?? 0),
        ceMois: Number(saasRevenueThisMonth._sum.totalAmount ?? 0),
        cetteAnnee: Number(saasRevenueThisYear._sum.totalAmount ?? 0),
        enAttente: Number(saasRevenuePending._sum.totalAmount ?? 0),
        sallesSupplementairesCeMois: Number(extraSallesRevenueThisMonth._sum.extraSallesAmount ?? 0),
        repartitionParPlan: planBreakdown,
      },
    };
  }

  /**
   * Compte les factures payées ce mois qui constituent un
   * renouvellement (il existe une facture PAYEE antérieure pour la
   * même souscription), par opposition à une première facturation.
   */
  private async countRenewalsThisMonth(monthStart: Date): Promise<number> {
    const paidThisMonth = await this.prisma.saasInvoice.findMany({
      where: { status: 'PAYEE', paidAt: { gte: monthStart } },
      select: { id: true, subscriptionId: true, issuedAt: true },
    });
    let count = 0;
    for (const invoice of paidThisMonth) {
      const earlierPaid = await this.prisma.saasInvoice.count({
        where: {
          subscriptionId: invoice.subscriptionId,
          status: 'PAYEE',
          issuedAt: { lt: invoice.issuedAt },
        },
      });
      if (earlierPaid > 0) count++;
    }
    return count;
  }

  // ─────────────────────────────────────────────────────────────
  // KPI SaaS (§9.15) — calculs automatiques, exclusif SUPER_ADMIN
  // ─────────────────────────────────────────────────────────────

  /**
   * §9.15 — Indicateurs stratégiques SaaS. Formules standard du
   * secteur, avec des simplifications documentées là où le volume de
   * données historiques ne permet pas encore un calcul de cohorte
   * complet (plateforme récente) :
   *  - MRR/ARR : normalisent chaque souscription active à sa valeur
   *    mensuelle (les souscriptions annuelles sont divisées par 12).
   *  - Rétention/churn : mesurés sur l'ensemble des propriétaires
   *    actuels plutôt qu'une cohorte glissante précise — une vraie
   *    analyse de cohortes (rétention à 30/60/90 jours par mois
   *    d'inscription) est une évolution possible une fois plus
   *    d'historique disponible.
   *  - LTV : formule standard ARPU / taux de churn mensuel.
   */
  async getSaasKpis() {
    const activeSubscriptions = await this.prisma.saasSubscription.findMany({
      where: { status: 'ACTIF' },
      include: { saasPlan: true },
    });

    const mrr = activeSubscriptions.reduce((sum: number, sub: any) => {
      const monthlyValue =
        sub.billingCycle === 'ANNUEL' ? Number(sub.saasPlan.priceAnnual) / 12 : Number(sub.saasPlan.priceMonthly);
      return sum + monthlyValue;
    }, 0);
    const arr = mrr * 12;

    const totalSallesActives = await this.prisma.salle.count({
      where: { subscription: { status: 'ACTIF' } },
    });
    const totalProprietairesActifs = activeSubscriptions.length; // 1 souscription = 1 propriétaire (contrainte unique)

    const revenuMoyenParSalle = totalSallesActives > 0 ? mrr / totalSallesActives : 0;
    const revenuMoyenParProprietaire = totalProprietairesActifs > 0 ? mrr / totalProprietairesActifs : 0;

    // Fidélisation
    const totalProprietaires = await this.prisma.proprietaire.count();
    const proprietairesSuspendusOuExpires = await this.prisma.saasSubscription.count({
      where: { status: { in: ['SUSPENDU', 'EXPIRE'] } },
    });
    const churnRate = totalProprietaires > 0 ? proprietairesSuspendusOuExpires / totalProprietaires : 0;
    const tauxRetention = 1 - churnRate;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const invoicesLast90Days = await this.prisma.saasInvoice.findMany({
      where: { issuedAt: { gte: ninetyDaysAgo } },
      select: { status: true },
    });
    const tauxRenouvellement =
      invoicesLast90Days.length > 0
        ? invoicesLast90Days.filter((i: { status: string }) => i.status === 'PAYEE').length /
          invoicesLast90Days.length
        : null;

    // Rentabilité — LTV = ARPU / taux de churn mensuel (formule standard SaaS)
    const ltv = churnRate > 0 ? revenuMoyenParProprietaire / churnRate : null;

    // Croissance — variation du nombre de propriétaires vs période précédente équivalente
    const croissanceMensuelle = await this.computeGrowthRate(1, 'month');
    const croissanceTrimestrielle = await this.computeGrowthRate(3, 'month');
    const croissanceAnnuelle = await this.computeGrowthRate(1, 'year');

    return {
      revenus: {
        mrr,
        arr,
        revenuMoyenParSalle,
        revenuMoyenParProprietaire,
      },
      fidelisation: {
        tauxRenouvellement,
        tauxRetention,
        churnRate,
      },
      rentabilite: {
        ltv,
        revenuMoyenParClient: revenuMoyenParProprietaire,
      },
      croissance: {
        mensuelle: croissanceMensuelle,
        trimestrielle: croissanceTrimestrielle,
        annuelle: croissanceAnnuelle,
      },
    };
  }

  /** Variation en % du nombre de nouveaux propriétaires vs la période équivalente précédente. */
  private async computeGrowthRate(amount: number, unit: 'month' | 'year'): Promise<number | null> {
    const now = new Date();
    const periodStart = new Date(now);
    const previousPeriodStart = new Date(now);
    if (unit === 'month') {
      periodStart.setMonth(periodStart.getMonth() - amount);
      previousPeriodStart.setMonth(previousPeriodStart.getMonth() - amount * 2);
    } else {
      periodStart.setFullYear(periodStart.getFullYear() - amount);
      previousPeriodStart.setFullYear(previousPeriodStart.getFullYear() - amount * 2);
    }

    const [current, previous] = await Promise.all([
      this.prisma.proprietaire.count({ where: { createdAt: { gte: periodStart } } }),
      this.prisma.proprietaire.count({ where: { createdAt: { gte: previousPeriodStart, lt: periodStart } } }),
    ]);

    if (previous === 0) return null; // pas de base de comparaison valable
    return ((current - previous) / previous) * 100;
  }

  // ─────────────────────────────────────────────────────────────
  // Contrôle d'autorisation (IDOR) — §13.8
  // ─────────────────────────────────────────────────────────────

  /** Vérifie qu'une salle appartient bien au propriétaire donné. */
  async assertSalleBelongsToProprietaire(salleId: string, proprietaireId: string): Promise<boolean> {
    const salle = await this.prisma.salle.findUnique({ where: { id: salleId }, select: { proprietaireId: true } });
    return salle?.proprietaireId === proprietaireId;
  }
}
