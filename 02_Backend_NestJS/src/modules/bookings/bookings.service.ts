import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  CreateCoursCollectifDto,
  UpdateCoursCollectifDto,
  BookSeanceIndividuelleDto,
  SetCoachAvailabilityDto,
} from './dto/bookings.dto';

const DEFAULT_CANCELLATION_DEADLINE_HOURS = 2; // non chiffré explicitement au §7 — valeur d'exemple, configurable par salle via reservationSettings

/**
 * Service de gestion des réservations (§7.1 à §7.20).
 *
 * Deux types de réservation :
 *  - Cours collectifs : capacité limitée, liste d'attente avec
 *    promotion automatique dès qu'une place se libère (§7.4, §7.5).
 *  - Séances individuelles : vérifiées contre les disponibilités
 *    déclarées du coach et l'absence de chevauchement (§7.6, §7.7).
 */
@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Cours collectifs (§7.1, §7.2)
  // ─────────────────────────────────────────────────────────────

  async createCoursCollectif(salleId: string, dto: CreateCoursCollectifDto, actorUserId: string) {
    const coach = await this.prisma.coachProfile.findUnique({ where: { id: dto.coachId } });
    if (!coach || coach.salleId !== salleId) {
      throw new NotFoundException('Coach introuvable pour cette salle');
    }

    const cours = await this.prisma.coursCollectif.create({
      data: {
        id: randomUUID(),
        salleId,
        coachId: dto.coachId,
        name: dto.name,
        capacity: dto.capacity,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        recurring: dto.recurring ?? false,
        recurrenceRule: dto.recurrenceRule,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      salleId,
      action: 'cours_collectif.create',
      entityType: 'CoursCollectif',
      entityId: cours.id,
    });

    return cours;
  }

  async updateCoursCollectif(coursId: string, dto: UpdateCoursCollectifDto, actorUserId: string) {
    const data: any = { ...dto };
    if (dto.startAt) data.startAt = new Date(dto.startAt);
    if (dto.endAt) data.endAt = new Date(dto.endAt);

    const cours = await this.prisma.coursCollectif.update({ where: { id: coursId }, data });
    await this.audit.log({
      userId: actorUserId,
      salleId: cours.salleId,
      action: 'cours_collectif.update',
      entityType: 'CoursCollectif',
      entityId: coursId,
    });
    return cours;
  }

  async listCoursCollectifs(salleId: string, from?: Date, to?: Date) {
    return this.prisma.coursCollectif.findMany({
      where: { salleId, startAt: { gte: from, lte: to } },
      include: {
        coach: { include: { user: true } },
        _count: { select: { bookings: { where: { status: 'CONFIRMEE' } } } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  /**
   * Réserve une place à un cours collectif. Si complet, l'adhérent est
   * automatiquement placé en liste d'attente plutôt que rejeté (§7.4).
   */
  async bookCoursCollectif(coursId: string, adherentId: string, actorUserId: string) {
    const cours = await this.prisma.coursCollectif.findUniqueOrThrow({
      where: { id: coursId },
      include: { _count: { select: { bookings: { where: { status: 'CONFIRMEE' } } } } },
    });

    await this.assertAdherentActive(adherentId);
    await this.assertNotAlreadyBooked(adherentId, coursId);

    const isFull = cours._count.bookings >= cours.capacity;

    if (isFull) {
      const lastPosition = await this.prisma.waitingListEntry.count({
        where: { coursCollectifId: coursId },
      });
      const entry = await this.prisma.waitingListEntry.create({
        data: {
          id: randomUUID(),
          coursCollectifId: coursId,
          adherentId,
          position: lastPosition + 1,
        },
      });
      await this.audit.log({
        userId: actorUserId,
        salleId: cours.salleId,
        action: 'booking.waiting_list_add',
        entityType: 'WaitingListEntry',
        entityId: entry.id,
      });
      return { status: 'LISTE_ATTENTE' as const, position: entry.position };
    }

    const booking = await this.prisma.booking.create({
      data: {
        id: randomUUID(),
        salleId: cours.salleId,
        adherentId,
        coachId: cours.coachId,
        coursCollectifId: coursId,
        type: 'COURS_COLLECTIF',
        status: 'CONFIRMEE',
        startAt: cours.startAt,
        endAt: cours.endAt,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      salleId: cours.salleId,
      action: 'booking.create',
      entityType: 'Booking',
      entityId: booking.id,
    });

    return { status: 'CONFIRMEE' as const, booking };
  }

  // ─────────────────────────────────────────────────────────────
  // Séances individuelles (§7.6, §7.7)
  // ─────────────────────────────────────────────────────────────

  async bookSeanceIndividuelle(salleId: string, dto: BookSeanceIndividuelleDto, actorUserId: string) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    await this.assertAdherentActive(dto.adherentId);
    await this.assertCoachAvailable(dto.coachId, startAt, endAt);
    await this.assertNoOverlap(dto.coachId, startAt, endAt);

    const booking = await this.prisma.booking.create({
      data: {
        id: randomUUID(),
        salleId,
        adherentId: dto.adherentId,
        coachId: dto.coachId,
        type: 'SEANCE_INDIVIDUELLE',
        status: 'CONFIRMEE',
        startAt,
        endAt,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      salleId,
      action: 'booking.create',
      entityType: 'Booking',
      entityId: booking.id,
    });

    return booking;
  }

  // ─────────────────────────────────────────────────────────────
  // Annulation avec promotion automatique de la liste d'attente (§7.5)
  // ─────────────────────────────────────────────────────────────

  async cancelBooking(bookingId: string, actorUserId: string, reason?: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    if (booking.status !== 'CONFIRMEE' && booking.status !== 'EN_ATTENTE') {
      throw new BadRequestException('Cette réservation ne peut plus être annulée');
    }

    const hoursUntilStart = (booking.startAt.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilStart < DEFAULT_CANCELLATION_DEADLINE_HOURS) {
      throw new BadRequestException(
        `Annulation impossible moins de ${DEFAULT_CANCELLATION_DEADLINE_HOURS}h avant la séance`,
      );
    }

    const cancelled = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'ANNULEE', cancelledAt: new Date(), cancelledBy: actorUserId },
    });

    await this.audit.log({
      userId: actorUserId,
      salleId: booking.salleId,
      action: 'booking.cancel',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { reason },
    });

    // Promotion automatique du premier de la liste d'attente (§7.5)
    if (booking.coursCollectifId) {
      await this.promoteNextFromWaitingList(booking.coursCollectifId, actorUserId);
    }

    return cancelled;
  }

  private async promoteNextFromWaitingList(coursCollectifId: string, actorUserId: string) {
    const next = await this.prisma.waitingListEntry.findFirst({
      where: { coursCollectifId },
      orderBy: { position: 'asc' },
    });
    if (!next) return;

    const cours = await this.prisma.coursCollectif.findUniqueOrThrow({
      where: { id: coursCollectifId },
    });

    await this.prisma.booking.create({
      data: {
        id: randomUUID(),
        salleId: cours.salleId,
        adherentId: next.adherentId,
        coachId: cours.coachId,
        coursCollectifId,
        type: 'COURS_COLLECTIF',
        status: 'CONFIRMEE',
        startAt: cours.startAt,
        endAt: cours.endAt,
      },
    });

    await this.prisma.waitingListEntry.delete({ where: { id: next.id } });

    // Décale les positions restantes
    await this.prisma.waitingListEntry.updateMany({
      where: { coursCollectifId, position: { gt: next.position } },
      data: { position: { decrement: 1 } },
    });

    await this.audit.log({
      userId: actorUserId,
      salleId: cours.salleId,
      action: 'booking.waiting_list_promoted',
      entityType: 'WaitingListEntry',
      entityId: next.id,
      metadata: { adherentId: next.adherentId, coursCollectifId },
    });

    // TODO(module notifications): notifier l'adhérent promu (§7.5, §10.x).
  }

  // ─────────────────────────────────────────────────────────────
  // Présence à la séance (§7.12)
  // ─────────────────────────────────────────────────────────────

  async markAttendance(bookingId: string, actorUserId: string) {
    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'TERMINEE', attendedAt: new Date() },
    });
    await this.audit.log({
      userId: actorUserId,
      salleId: booking.salleId,
      action: 'booking.attendance_marked',
      entityType: 'Booking',
      entityId: bookingId,
    });
    return booking;
  }

  async markAbsence(bookingId: string, actorUserId: string) {
    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'ABSENCE' },
    });
    await this.audit.log({
      userId: actorUserId,
      salleId: booking.salleId,
      action: 'booking.absence_marked',
      entityType: 'Booking',
      entityId: bookingId,
    });
    return booking;
  }

  // ─────────────────────────────────────────────────────────────
  // Disponibilités coach (§7.6)
  // ─────────────────────────────────────────────────────────────

  async setCoachAvailability(coachId: string, dto: SetCoachAvailabilityDto) {
    return this.prisma.coachAvailability.create({
      data: { id: randomUUID(), coachId, ...dto },
    });
  }

  async listCoachAvailability(coachId: string) {
    return this.prisma.coachAvailability.findMany({
      where: { coachId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Consultation (§7.10, §7.11)
  // ─────────────────────────────────────────────────────────────

  async listByAdherent(adherentId: string) {
    return this.prisma.booking.findMany({
      where: { adherentId },
      include: { coach: { include: { user: true } }, coursCollectif: true },
      orderBy: { startAt: 'desc' },
    });
  }

  async listByCoach(coachId: string, from?: Date, to?: Date) {
    return this.prisma.booking.findMany({
      where: { coachId, startAt: { gte: from, lte: to } },
      include: { adherent: { include: { user: true } }, coursCollectif: true },
      orderBy: { startAt: 'asc' },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers internes
  // ─────────────────────────────────────────────────────────────

  private async assertAdherentActive(adherentId: string) {
    const adherent = await this.prisma.adherentProfile.findUniqueOrThrow({
      where: { id: adherentId },
    });
    if (adherent.status === 'SUSPENDU' || adherent.status === 'EXPIRE') {
      throw new BadRequestException('Adhérent suspendu ou sans abonnement actif');
    }
  }

  private async assertNotAlreadyBooked(adherentId: string, coursCollectifId: string) {
    const existing = await this.prisma.booking.findFirst({
      where: { adherentId, coursCollectifId, status: { in: ['CONFIRMEE', 'EN_ATTENTE'] } },
    });
    if (existing) {
      throw new ConflictException('Vous êtes déjà inscrit à ce cours');
    }
  }

  private async assertCoachAvailable(coachId: string, startAt: Date, endAt: Date) {
    const dayOfWeek = startAt.getDay();
    const startTime = startAt.toTimeString().slice(0, 5);
    const endTime = endAt.toTimeString().slice(0, 5);

    const availability = await this.prisma.coachAvailability.findFirst({
      where: {
        coachId,
        dayOfWeek,
        startTime: { lte: startTime },
        endTime: { gte: endTime },
      },
    });

    if (!availability) {
      throw new BadRequestException('Le coach n\'est pas disponible sur ce créneau');
    }
  }

  private async assertNoOverlap(coachId: string, startAt: Date, endAt: Date) {
    const overlapping = await this.prisma.booking.findFirst({
      where: {
        coachId,
        status: { in: ['CONFIRMEE', 'EN_ATTENTE'] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });
    if (overlapping) {
      throw new ConflictException('Le coach a déjà une séance sur ce créneau');
    }
  }
}
