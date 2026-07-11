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
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalSalles,
      totalProprietaires,
      totalAdherents,
      newSallesThisMonth,
      subscriptionsByPlan,
      saasRevenuePaid,
      saasRevenuePending,
    ] = await Promise.all([
      this.prisma.salle.count(),
      this.prisma.proprietaire.count(),
      this.prisma.adherentProfile.count(),
      this.prisma.salle.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.saasSubscription.groupBy({
        by: ['saasPlanId'],
        _count: { _all: true },
      }),
      this.prisma.saasInvoice.aggregate({
        where: { status: 'PAYEE', issuedAt: { gte: monthStart } },
        _sum: { totalAmount: true },
      }),
      this.prisma.saasInvoice.aggregate({
        where: { status: 'EMISE' },
        _sum: { totalAmount: true },
      }),
    ]);

    const plans = await this.prisma.saasPlan.findMany({
      where: { id: { in: subscriptionsByPlan.map((s: { saasPlanId: string }) => s.saasPlanId) } },
    });
    const planBreakdown = subscriptionsByPlan.map((s: { saasPlanId: string; _count: { _all: number } }) => ({
      planCode: plans.find((p: { id: string; code: string }) => p.id === s.saasPlanId)?.code ?? 'INCONNU',
      count: s._count._all,
    }));

    return {
      plateforme: {
        totalSalles,
        totalProprietaires,
        totalAdherents,
        nouvellesSallesCeMois: newSallesThisMonth,
      },
      saas: {
        revenuEncaisseCeMois: Number(saasRevenuePaid._sum.totalAmount ?? 0),
        revenuEnAttente: Number(saasRevenuePending._sum.totalAmount ?? 0),
        repartitionParPlan: planBreakdown,
      },
    };
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
