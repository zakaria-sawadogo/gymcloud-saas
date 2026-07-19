import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

const AUTO_CLOSE_AFTER_HOURS = 6; // durée max d'une session avant fermeture automatique (§6.8)

/**
 * Service de contrôle d'accès par QR Code (§6.1 à §6.20).
 *
 * Logique tourniquet : un premier scan du jour ouvre une session
 * (check-in), le scan suivant du même adhérent la ferme (check-out).
 * Le statut d'abonnement est vérifié à CHAQUE scan — un adhérent
 * SUSPENDU ou EXPIRE est refusé à l'entrée même s'il possède un QR
 * valide, conformément à §6.5 (« Vérification en temps réel »).
 */
@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Point d'entrée unique pour un scan de borne. Détermine lui-même
   * s'il s'agit d'une entrée ou d'une sortie selon qu'une session est
   * déjà ouverte pour cet adhérent (§6.3, §6.4).
   */
  async scan(qrCodeToken: string, salleId: string) {
    const adherent = await this.prisma.adherentProfile.findUnique({ where: { qrCodeToken } });
    if (!adherent) {
      throw new NotFoundException('QR code invalide ou inconnu');
    }
    if (adherent.salleId !== salleId) {
      throw new ForbiddenException('Ce QR code n\'est pas rattaché à cette salle (§2.3)');
    }

    const openSession = await this.prisma.accessLog.findFirst({
      where: { adherentId: adherent.id, checkOutAt: null },
      orderBy: { checkInAt: 'desc' },
    });

    if (openSession) {
      return this.checkOut(openSession.id);
    }

    return this.checkIn(adherent.id, salleId, 'QR_CODE');
  }

  /**
   * Accès manuel par un gestionnaire (adhérent sans téléphone — §6.6).
   * Soumis aux mêmes contrôles de statut que le scan QR.
   */
  async manualAccess(adherentId: string, salleId: string, actorUserId: string, reason?: string) {
    const openSession = await this.prisma.accessLog.findFirst({
      where: { adherentId, checkOutAt: null },
    });
    if (openSession) {
      return this.checkOut(openSession.id, actorUserId);
    }
    const log = await this.checkIn(adherentId, salleId, 'MANUEL', actorUserId);
    await this.audit.log({
      userId: actorUserId,
      salleId,
      action: 'access_control.manual_override',
      entityType: 'AccessLog',
      entityId: log.id,
      metadata: { reason },
    });
    return log;
  }

  /**
   * §6.14 — Auto-pointage : l'adhérent scanne lui-même, avec son
   * propre téléphone, le QR fixe affiché à l'entrée de la salle
   * (distinct de son propre badge, que le personnel scanne de son
   * côté — les deux coexistent). L'identité de l'adhérent vient
   * exclusivement de son propre jeton de connexion, jamais d'une
   * valeur transmise par le client — impossible de pointer pour
   * quelqu'un d'autre via ce chemin.
   */
  async selfCheckin(checkinQrToken: string, callerUserId: string) {
    const salle = await this.prisma.salle.findUnique({ where: { checkinQrToken } });
    if (!salle) {
      throw new NotFoundException('QR code de salle invalide ou inconnu');
    }

    const adherent = await this.prisma.adherentProfile.findUnique({ where: { userId: callerUserId } });
    if (!adherent) {
      throw new ForbiddenException('Seul un adhérent peut pointer son propre accès de cette façon');
    }
    if (adherent.salleId !== salle.id) {
      throw new ForbiddenException('Ce QR appartient à une autre salle que la vôtre (§2.3)');
    }

    const openSession = await this.prisma.accessLog.findFirst({
      where: { adherentId: adherent.id, checkOutAt: null },
      orderBy: { checkInAt: 'desc' },
    });

    if (openSession) {
      return this.checkOut(openSession.id);
    }
    return this.checkIn(adherent.id, salle.id, 'AUTO_ADHERENT');
  }

  private async checkIn(
    adherentId: string,
    salleId: string,
    method: 'QR_CODE' | 'MANUEL' | 'AUTO_ADHERENT',
    createdByUserId?: string,
  ) {
    const adherent = await this.prisma.adherentProfile.findUniqueOrThrow({
      where: { id: adherentId },
      include: {
        subscriptions: {
          where: { status: { in: ['ACTIF', 'EN_GRACE'] } },
          orderBy: { endDate: 'desc' },
          take: 1,
        },
      },
    });

    // Vérification en temps réel du statut (§6.5) — bloque avant toute écriture
    if (adherent.status === 'SUSPENDU') {
      throw new ForbiddenException('Adhérent suspendu — accès refusé');
    }
    if (adherent.status === 'EXPIRE' || adherent.subscriptions.length === 0) {
      throw new ForbiddenException('Aucun abonnement actif — accès refusé, réabonnement requis');
    }

    const log = await this.prisma.accessLog.create({
      data: {
        id: randomUUID(),
        salleId,
        adherentId,
        method,
        checkInAt: new Date(),
        createdByUserId,
      },
    });

    return { ...log, direction: 'ENTREE' as const, adherentStatus: adherent.status };
  }

  private async checkOut(accessLogId: string, actorUserId?: string) {
    const log = await this.prisma.accessLog.update({
      where: { id: accessLogId },
      data: { checkOutAt: new Date() },
    });
    return { ...log, direction: 'SORTIE' as const };
  }

  // ─────────────────────────────────────────────────────────────
  // Consultation (§6.9 à §6.12)
  // ─────────────────────────────────────────────────────────────

  /** Adhérents actuellement présents dans la salle — vue temps réel gestionnaire */
  async currentOccupancy(salleId: string) {
    return this.prisma.accessLog.findMany({
      where: { salleId, checkOutAt: null },
      include: { adherent: { include: { user: true } } },
      orderBy: { checkInAt: 'desc' },
    });
  }

  async history(salleId: string, from?: Date, to?: Date) {
    return this.prisma.accessLog.findMany({
      where: {
        salleId,
        checkInAt: { gte: from, lte: to },
      },
      include: { adherent: { include: { user: true } } },
      orderBy: { checkInAt: 'desc' },
    });
  }

  async adherentHistory(adherentId: string) {
    return this.prisma.accessLog.findMany({
      where: { adherentId },
      orderBy: { checkInAt: 'desc' },
      take: 100,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Fermeture automatique et détection d'anomalies (§6.8, §6.13)
  // ─────────────────────────────────────────────────────────────

  /**
   * Tâche planifiée (voir access-control.scheduler.ts) : ferme
   * automatiquement les sessions ouvertes depuis trop longtemps
   * (téléphone perdu, oubli de scan sortie) et les marque comme
   * anomalie pour investigation par le gestionnaire.
   */
  async autoCloseForgottenSessions(): Promise<{ closed: number }> {
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - AUTO_CLOSE_AFTER_HOURS);

    const stale = await this.prisma.accessLog.findMany({
      where: { checkOutAt: null, checkInAt: { lt: threshold } },
      select: { id: true },
    });

    if (stale.length === 0) return { closed: 0 };

    await this.prisma.accessLog.updateMany({
      where: { id: { in: stale.map((s: { id: string }) => s.id) } },
      data: { checkOutAt: new Date(), autoClosed: true, anomalyFlag: true },
    });

    this.logger.log(`${stale.length} session(s) fermée(s) automatiquement (§6.8)`);
    return { closed: stale.length };
  }

  /** Liste des anomalies à investiguer par le gestionnaire (§6.13) */
  async listAnomalies(salleId: string) {
    return this.prisma.accessLog.findMany({
      where: { salleId, anomalyFlag: true },
      include: { adherent: { include: { user: true } } },
      orderBy: { checkInAt: 'desc' },
    });
  }
}
