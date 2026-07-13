import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { randomUUID, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { PaymentsService } from '../payments/payments.service';
import { PaymentTypeDto } from '../payments/dto/payments.dto';
import {
  CreateAdherentDto,
  UpdateAdherentDto,
  CreateAbonnementCatalogueDto,
  UpdateAbonnementCatalogueDto,
  SubscribeAdherentDto,
} from './dto/adherents.dto';

const BCRYPT_ROUNDS = 12;
const GRACE_PERIOD_DAYS = 3; // délai de grâce après expiration (§5.12) — non chiffré dans le cahier des charges, valeur d'exemple configurable ultérieurement au niveau salle

/**
 * Service de gestion des adhérents (§4.6, §5.1 à §5.22).
 *
 * Trois responsabilités distinctes regroupées ici car intimement liées :
 *  1. Le dossier adhérent (identité, QR code, statut).
 *  2. Le catalogue d'abonnements propre à chaque salle (§3.8, §5.6).
 *  3. Le cycle de vie des souscriptions : attribution initiale,
 *     réabonnement, délai de grâce, expiration (§5.7 à §5.13).
 */
@Injectable()
export class AdherentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly paymentsService: PaymentsService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Dossier adhérent (§4.6, §5.1, §5.2)
  // ─────────────────────────────────────────────────────────────

  async create(dto: CreateAdherentDto, actorUserId: string) {
    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existing) {
      throw new ConflictException('Un utilisateur existe déjà avec ce numéro de téléphone');
    }

    const salle = await this.prisma.salle.findUnique({ where: { id: dto.salleId } });
    if (!salle) throw new NotFoundException('Salle introuvable');

    const role = await this.prisma.role.findUniqueOrThrow({ where: { code: 'ADHERENT' } });
    const tempPassword = randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        phone: dto.phone,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        roleId: role.id,
        status: 'ACTIF',
      },
    });

    const adherent = await this.prisma.adherentProfile.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        salleId: dto.salleId,
        memberCode: await this.generateMemberCode(dto.salleId),
        qrCodeToken: this.generateQrToken(),
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        address: dto.address,
        emergencyContact: dto.emergencyContact,
        status: 'ACTIF',
      },
    });

    await this.audit.log({
      userId: actorUserId,
      salleId: dto.salleId,
      action: 'adherent.create',
      entityType: 'AdherentProfile',
      entityId: adherent.id,
    });

    // Souscription immédiate si un abonnement a été précisé à l'inscription (§5.6)
    let subscription = null;
    if (dto.abonnementCatalogueId) {
      subscription = await this.subscribe(
        adherent.id,
        { abonnementCatalogueId: dto.abonnementCatalogueId },
        actorUserId,
      );
    }

    return { adherent, user, tempPassword, subscription };
  }

  /**
   * §5.1, §5.6, §8.3 — Flux guichet complet : le gestionnaire crée
   * l'adhérent, choisit sa formule d'abonnement ET encaisse le premier
   * paiement en une seule opération, plutôt que trois actions
   * séparées. La facture (reçu) et la carte membre ne sont
   * pertinentes qu'une fois le paiement réellement effectué — c'est
   * pourquoi elles ne sont générées (côté frontend, via les endpoints
   * dédiés) qu'après le retour de cette méthode, jamais avant.
   *
   * Le montant facturé est TOUJOURS celui du catalogue au moment de
   * l'appel (jamais une valeur transmise par le client) — évite qu'un
   * montant trafiqué soit encaissé pour une formule donnée.
   */
  async createWithPayment(
    dto: CreateAdherentDto & { abonnementCatalogueId: string },
    payment: { method: 'ESPECES' | 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE'; phoneNumber?: string },
    actorUserId: string,
  ) {
    const catalogue = await this.prisma.abonnementCatalogue.findUniqueOrThrow({
      where: { id: dto.abonnementCatalogueId },
    });

    const { adherent, user, tempPassword, subscription } = await this.create(dto, actorUserId);

    const paymentPayload = {
      salleId: dto.salleId,
      adherentId: adherent.id,
      adherentAbonnementId: subscription!.id,
      type: PaymentTypeDto.ABONNEMENT,
      amount: Number(catalogue.price),
      currency: catalogue.currency,
    };

    const paymentResult =
      payment.method === 'ESPECES'
        ? await this.paymentsService.recordCashPayment(paymentPayload, actorUserId)
        : await this.paymentsService.initiateMobileMoney(
            { ...paymentPayload, method: payment.method, phoneNumber: payment.phoneNumber ?? '' },
            actorUserId,
          );

    return { adherent, user, tempPassword, subscription, payment: paymentResult };
  }

  async findById(adherentId: string) {
    const adherent = await this.prisma.adherentProfile.findUnique({
      where: { id: adherentId },
      include: {
        user: true,
        subscriptions: { include: { abonnementCatalogue: true }, orderBy: { startDate: 'desc' } },
      },
    });
    if (!adherent) throw new NotFoundException('Adhérent introuvable');
    return adherent;
  }

  /** Recherche par QR code — utilisé par le module Contrôle d'accès (§6) */
  async findByQrToken(qrCodeToken: string) {
    const adherent = await this.prisma.adherentProfile.findUnique({
      where: { qrCodeToken },
      include: { user: true },
    });
    if (!adherent) throw new NotFoundException('QR code invalide ou inconnu');
    return adherent;
  }

  async findBySalle(salleId: string, filters?: { status?: string }) {
    return this.prisma.adherentProfile.findMany({
      where: { salleId, status: filters?.status as any },
      include: { user: true },
      orderBy: { joinedAt: 'desc' },
    });
  }

  async update(adherentId: string, dto: UpdateAdherentDto, actorUserId: string) {
    const adherent = await this.prisma.adherentProfile.findUniqueOrThrow({
      where: { id: adherentId },
    });

    if (dto.email) {
      await this.prisma.user.update({ where: { id: adherent.userId }, data: { email: dto.email } });
    }

    const updated = await this.prisma.adherentProfile.update({
      where: { id: adherentId },
      data: { address: dto.address, emergencyContact: dto.emergencyContact },
    });

    await this.audit.log({
      userId: actorUserId,
      salleId: adherent.salleId,
      action: 'adherent.update',
      entityType: 'AdherentProfile',
      entityId: adherentId,
    });

    return updated;
  }

  /** Renouvelle le jeton QR (perte de téléphone, suspicion de partage — §6.x) */
  async regenerateQrToken(adherentId: string, actorUserId: string) {
    const adherent = await this.prisma.adherentProfile.update({
      where: { id: adherentId },
      data: { qrCodeToken: this.generateQrToken() },
    });
    await this.audit.log({
      userId: actorUserId,
      salleId: adherent.salleId,
      action: 'adherent.qr_regenerate',
      entityType: 'AdherentProfile',
      entityId: adherentId,
    });
    return adherent;
  }

  async suspend(adherentId: string, actorUserId: string, reason?: string) {
    const adherent = await this.prisma.adherentProfile.update({
      where: { id: adherentId },
      data: { status: 'SUSPENDU' },
    });
    await this.audit.log({
      userId: actorUserId,
      salleId: adherent.salleId,
      action: 'adherent.suspend',
      entityType: 'AdherentProfile',
      entityId: adherentId,
      metadata: { reason },
    });
    return adherent;
  }

  /**
   * Réactive un adhérent suspendu (§4.6). Le statut cible dépend de
   * son abonnement réel : s'il a toujours un abonnement valide, il
   * redevient ACTIF/EN_GRACE ; sinon EXPIRE (débloqué administrativement
   * mais devra tout de même se réabonner pour accéder à la salle,
   * cohérent avec le contrôle fait par AccessControlService.checkIn).
   */
  async reactivate(adherentId: string, actorUserId: string) {
    const activeSubscription = await this.prisma.adherentAbonnement.findFirst({
      where: { adherentId, status: { in: ['ACTIF', 'EN_GRACE'] } },
      orderBy: { endDate: 'desc' },
    });
    const newStatus = activeSubscription?.status ?? 'EXPIRE';

    const adherent = await this.prisma.adherentProfile.update({
      where: { id: adherentId },
      data: { status: newStatus },
    });
    await this.audit.log({
      userId: actorUserId,
      salleId: adherent.salleId,
      action: 'adherent.reactivate',
      entityType: 'AdherentProfile',
      entityId: adherentId,
    });
    return adherent;
  }

  // ─────────────────────────────────────────────────────────────
  // Catalogue d'abonnements par salle (§3.8, §5.6)
  // ─────────────────────────────────────────────────────────────

  async createAbonnementCatalogue(
    salleId: string,
    dto: CreateAbonnementCatalogueDto,
    actorUserId: string,
  ) {
    const salle = await this.prisma.salle.findUnique({ where: { id: salleId } });
    if (!salle) throw new NotFoundException('Salle introuvable');

    const catalogue = await this.prisma.abonnementCatalogue.create({
      data: { id: randomUUID(), salleId, ...dto },
    });
    await this.audit.log({
      userId: actorUserId,
      salleId,
      action: 'abonnement_catalogue.create',
      entityType: 'AbonnementCatalogue',
      entityId: catalogue.id,
    });
    return catalogue;
  }

  async updateAbonnementCatalogue(
    catalogueId: string,
    dto: UpdateAbonnementCatalogueDto,
    actorUserId: string,
  ) {
    const catalogue = await this.prisma.abonnementCatalogue.update({
      where: { id: catalogueId },
      data: dto,
    });
    await this.audit.log({
      userId: actorUserId,
      salleId: catalogue.salleId,
      action: 'abonnement_catalogue.update',
      entityType: 'AbonnementCatalogue',
      entityId: catalogueId,
    });
    return catalogue;
  }

  async listAbonnementCatalogue(salleId: string) {
    return this.prisma.abonnementCatalogue.findMany({
      where: { salleId, active: true },
      orderBy: { price: 'asc' },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Attribution et réabonnement (§5.7, §5.8, §5.12, §5.13)
  // ─────────────────────────────────────────────────────────────

  /**
   * Souscrit un adhérent à un abonnement du catalogue.
   *
   * Règle de chaînage (§5.13) : si l'adhérent a déjà un abonnement actif
   * non expiré, le nouveau démarre au lendemain de la fin du précédent
   * (réabonnement anticipé, pas de perte de jours payés). Sinon il
   * démarre à la date demandée (par défaut aujourd'hui).
   */
  async subscribe(adherentId: string, dto: SubscribeAdherentDto, actorUserId: string) {
    const [adherent, catalogue] = await Promise.all([
      this.prisma.adherentProfile.findUniqueOrThrow({ where: { id: adherentId } }),
      this.prisma.abonnementCatalogue.findUniqueOrThrow({
        where: { id: dto.abonnementCatalogueId },
      }),
    ]);

    if (!catalogue.active) {
      throw new BadRequestException('Cet abonnement n\'est plus disponible à la vente');
    }

    const currentActive = await this.prisma.adherentAbonnement.findFirst({
      where: { adherentId, status: { in: ['ACTIF', 'EN_GRACE'] } },
      orderBy: { endDate: 'desc' },
    });

    const isRenewal = !!currentActive;
    let startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    if (currentActive && currentActive.endDate > startDate) {
      // Chaînage : le nouvel abonnement prend le relais sans chevauchement
      startDate = new Date(currentActive.endDate);
      startDate.setDate(startDate.getDate() + 1);
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + catalogue.durationDays);

    const subscription = await this.prisma.adherentAbonnement.create({
      data: {
        id: randomUUID(),
        adherentId,
        abonnementCatalogueId: catalogue.id,
        startDate,
        endDate,
        status: 'ACTIF',
        isRenewal,
      },
    });

    // Un réabonnement réactive un adhérent précédemment EXPIRE (§5.12)
    if (adherent.status === 'EXPIRE' || adherent.status === 'EN_GRACE') {
      await this.prisma.adherentProfile.update({
        where: { id: adherentId },
        data: { status: 'ACTIF' },
      });
    }

    await this.audit.log({
      userId: actorUserId,
      salleId: adherent.salleId,
      action: isRenewal ? 'adherent_abonnement.renew' : 'adherent_abonnement.create',
      entityType: 'AdherentAbonnement',
      entityId: subscription.id,
      metadata: { abonnementCatalogueId: catalogue.id, startDate, endDate },
    });

    return subscription;
  }

  async history(adherentId: string) {
    return this.prisma.adherentAbonnement.findMany({
      where: { adherentId },
      include: { abonnementCatalogue: true },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Tâche planifiée quotidienne (§5.12) — à invoquer par un job BullMQ
   * cron (voir jobs/ dans une prochaine itération). Fait transiter :
   *   ACTIF → EN_GRACE à l'expiration
   *   EN_GRACE → EXPIRE après le délai de grâce
   * et aligne le statut de l'AdherentProfile en conséquence.
   */
  async processExpirations(): Promise<{ movedToGrace: number; movedToExpired: number }> {
    const now = new Date();

    const toGrace = await this.prisma.adherentAbonnement.updateMany({
      where: { status: 'ACTIF', endDate: { lt: now } },
      data: { status: 'EN_GRACE' },
    });

    const graceLimit = new Date(now);
    graceLimit.setDate(graceLimit.getDate() - GRACE_PERIOD_DAYS);

    const expiredSubs = await this.prisma.adherentAbonnement.findMany({
      where: { status: 'EN_GRACE', endDate: { lt: graceLimit } },
      select: { id: true, adherentId: true },
    });

    if (expiredSubs.length > 0) {
      await this.prisma.adherentAbonnement.updateMany({
        where: { id: { in: expiredSubs.map((s: { id: string; adherentId: string }) => s.id) } },
        data: { status: 'EXPIRE' },
      });
      await this.prisma.adherentProfile.updateMany({
        where: { id: { in: expiredSubs.map((s: { id: string; adherentId: string }) => s.adherentId) } },
        data: { status: 'EXPIRE' },
      });
    }

    // Alignement du statut adhérent pour les nouveaux EN_GRACE
    const graceAdherentIds = await this.prisma.adherentAbonnement.findMany({
      where: { status: 'EN_GRACE', endDate: { gte: graceLimit, lt: now } },
      select: { adherentId: true },
    });
    if (graceAdherentIds.length > 0) {
      await this.prisma.adherentProfile.updateMany({
        where: { id: { in: graceAdherentIds.map((s: { adherentId: string }) => s.adherentId) } },
        data: { status: 'EN_GRACE' },
      });
    }

    // TODO(module notifications): notifier les adhérents passés en
    // EN_GRACE ou EXPIRE (rappel de réabonnement — §10.x).

    return { movedToGrace: toGrace.count, movedToExpired: expiredSubs.length };
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers internes
  // ─────────────────────────────────────────────────────────────

  private async generateMemberCode(salleId: string): Promise<string> {
    const salle = await this.prisma.salle.findUniqueOrThrow({ where: { id: salleId } });
    const count = await this.prisma.adherentProfile.count({ where: { salleId } });
    const prefix = salle.slug.slice(0, 4).toUpperCase();
    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }

  private generateQrToken(): string {
    return randomBytes(24).toString('base64url'); // jeton long, imprévisible (§6.x sécurité QR)
  }
}
