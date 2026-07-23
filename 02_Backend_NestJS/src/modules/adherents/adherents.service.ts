import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { PaymentsService } from '../payments/payments.service';
import { PaymentTypeDto } from '../payments/dto/payments.dto';
import { TenantContext } from '../../common/decorators/current-user.decorator';
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

  /**
   * §5.6, §8.3 — `allowSubscriptionUnpaid` n'est JAMAIS exposé côté
   * API : seul `createWithPayment` (qui encaisse immédiatement juste
   * après) peut le passer à `true`. L'endpoint public `POST
   * /adherents` (inscription sans formule) laisse ce paramètre à sa
   * valeur par défaut `false` — si un abonnement est malgré tout
   * précisé sans passer par le paiement, la création est refusée
   * plutôt que de créer silencieusement un abonnement actif non payé.
   */
  async create(dto: CreateAdherentDto, actorUserId: string, allowSubscriptionUnpaid = false) {
    if (dto.abonnementCatalogueId && !allowSubscriptionUnpaid) {
      throw new BadRequestException(
        'Une formule d\'abonnement ne peut être attribuée qu\'avec un encaissement — utilisez POST /adherents/with-payment',
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existing) {
      throw new ConflictException('Un utilisateur existe déjà avec ce numéro de téléphone');
    }

    const salle = await this.prisma.salle.findUnique({ where: { id: dto.salleId } });
    if (!salle) throw new NotFoundException('Salle introuvable');

    const role = await this.prisma.role.findUniqueOrThrow({ where: { code: 'ADHERENT' } });
    const tempPassword = randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    // §5.6 — Création atomique : si l'une des deux écritures échoue
    // (ex: collision de memberCode), AUCUNE des deux ne doit persister.
    // Avant cette correction, un compte utilisateur orphelin (sans
    // profil adhérent) restait en base à chaque échec, empêchant même
    // les tentatives suivantes avec le même numéro de téléphone.
    const { user, adherent } = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
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

      const adherent = await tx.adherentProfile.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          salleId: dto.salleId,
          memberCode: await this.generateMemberCode(dto.salleId, tx),
          qrCodeToken: this.generateQrToken(),
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          gender: dto.gender,
          address: dto.address,
          emergencyContact: dto.emergencyContact,
          status: 'ACTIF',
        },
      });

      return { user, adherent };
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

    const { adherent, user, tempPassword, subscription } = await this.create(dto, actorUserId, true);

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

  /**
   * Dossier complet d'un adhérent. Un adhérent ne peut consulter que
   * le sien — jusqu'ici aucune restriction n'empêchait de consulter
   * le dossier de n'importe quel autre adhérent en devinant son
   * identifiant.
   */
  async findById(adherentId: string, actor?: { userId: string; roleCode: string }) {
    const adherent = await this.prisma.adherentProfile.findUnique({
      where: { id: adherentId },
      include: {
        user: true,
        subscriptions: { include: { abonnementCatalogue: true }, orderBy: { startDate: 'desc' } },
      },
    });
    if (!adherent) throw new NotFoundException('Adhérent introuvable');
    if (actor && actor.roleCode === 'ADHERENT' && adherent.userId !== actor.userId) {
      throw new ForbiddenException('Vous ne pouvez consulter que votre propre dossier');
    }
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
  // Compte (connexion) de l'adhérent — §4.2, distinct du statut
  // d'abonnement ci-dessus (ACTIF/EN_GRACE/EXPIRE, qui régule l'accès
  // à la salle). Ici : peut-il encore se connecter à l'application
  // mobile du tout ? Un GESTIONNAIRE ne peut agir que sur les
  // adhérents de SA salle.
  // ─────────────────────────────────────────────────────────────

  private async assertOwnsAdherentAccount(adherentId: string, actor: TenantContext) {
    const adherent = await this.prisma.adherentProfile.findUnique({ where: { id: adherentId } });
    if (!adherent) throw new NotFoundException('Adhérent introuvable');
    if (!actor.isGlobalAccess && adherent.salleId !== actor.salleId) {
      throw new ForbiddenException('Cet adhérent n\'appartient pas à votre salle');
    }
    return adherent;
  }

  async suspendAccount(adherentId: string, actor: TenantContext) {
    const adherent = await this.assertOwnsAdherentAccount(adherentId, actor);
    await this.prisma.user.update({ where: { id: adherent.userId }, data: { status: 'SUSPENDU' } });
    await this.prisma.refreshToken.updateMany({ where: { userId: adherent.userId }, data: { revoked: true } });
    await this.audit.log({
      userId: actor.userId,
      salleId: adherent.salleId,
      action: 'adherent.account_suspend',
      entityType: 'User',
      entityId: adherent.userId,
    });
    return { message: 'Compte suspendu — cet adhérent ne peut plus se connecter à l\'application.' };
  }

  async reactivateAccount(adherentId: string, actor: TenantContext) {
    const adherent = await this.assertOwnsAdherentAccount(adherentId, actor);
    await this.prisma.user.update({ where: { id: adherent.userId }, data: { status: 'ACTIF' } });
    await this.audit.log({
      userId: actor.userId,
      salleId: adherent.salleId,
      action: 'adherent.account_reactivate',
      entityType: 'User',
      entityId: adherent.userId,
    });
    return { message: 'Compte réactivé.' };
  }

  /** §4.2 — Désactivation du compte : jamais un DELETE réel, l'historique (paiements, accès...) reste intact. */
  async deactivateAccount(adherentId: string, actor: TenantContext) {
    const adherent = await this.assertOwnsAdherentAccount(adherentId, actor);
    await this.prisma.user.update({ where: { id: adherent.userId }, data: { status: 'DESACTIVE' } });
    await this.prisma.refreshToken.updateMany({ where: { userId: adherent.userId }, data: { revoked: true } });
    await this.audit.log({
      userId: actor.userId,
      salleId: adherent.salleId,
      action: 'adherent.account_deactivate',
      entityType: 'User',
      entityId: adherent.userId,
    });
    return { message: 'Compte désactivé.' };
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

  /**
   * §5.7, §5.13, §8.3 — Réabonnement avec encaissement immédiat, sur
   * le même principe que createWithPayment (inscription) : la
   * souscription à une formule et le paiement associé sont deux faces
   * de la même action pour un gestionnaire au guichet, jamais deux
   * étapes séparées où l'une pourrait être oubliée. Le montant
   * facturé est TOUJOURS celui du catalogue, jamais une valeur
   * transmise par le client.
   */
  async subscribeWithPayment(
    adherentId: string,
    dto: SubscribeAdherentDto,
    payment: { method: 'ESPECES' | 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE'; phoneNumber?: string },
    actorUserId: string,
  ) {
    const [adherent, catalogue] = await Promise.all([
      this.prisma.adherentProfile.findUniqueOrThrow({ where: { id: adherentId } }),
      this.prisma.abonnementCatalogue.findUniqueOrThrow({ where: { id: dto.abonnementCatalogueId } }),
    ]);

    const subscription = await this.subscribe(adherentId, dto, actorUserId);

    const paymentPayload = {
      salleId: adherent.salleId,
      adherentId,
      adherentAbonnementId: subscription.id,
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

    return { subscription, payment: paymentResult };
  }

  // ─────────────────────────────────────────────────────────────
  // Demande de souscription depuis l'app mobile adhérent (§5.6, §8.3)
  // ─────────────────────────────────────────────────────────────
  //
  // Symétrique du flux propriétaire↔SUPER_ADMIN (§9.8, §9.12) : un
  // adhérent ne peut jamais s'auto-valider. Il déclare vouloir
  // souscrire/se réabonner et son moyen de paiement depuis son
  // téléphone ; la souscription n'est créée/activée, et la facture
  // (reçu) générée, qu'après validation du GESTIONNAIRE — qui
  // constate la réception réelle des fonds (relevé Mobile Money,
  // dépôt en espèces au bureau...).

  /** L'adhérent déclare vouloir souscrire/se réabonner — ne crée PAS encore l'abonnement. */
  async requestSubscriptionFromMobile(
    userId: string,
    dto: { abonnementCatalogueId: string; paymentMethod: 'ESPECES' | 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE'; phoneNumber?: string },
    actorUserId: string,
  ) {
    const adherent = await this.prisma.adherentProfile.findUnique({ where: { userId } });
    if (!adherent) throw new NotFoundException('Profil adhérent introuvable pour ce compte');

    const catalogue = await this.prisma.abonnementCatalogue.findUniqueOrThrow({
      where: { id: dto.abonnementCatalogueId },
    });
    if (catalogue.salleId !== adherent.salleId) {
      throw new BadRequestException('Cette formule n\'appartient pas à votre salle');
    }

    const payment = await this.prisma.payment.create({
      data: {
        id: randomUUID(),
        salleId: adherent.salleId,
        adherentId: adherent.id,
        type: 'ABONNEMENT',
        amount: catalogue.price,
        currency: catalogue.currency,
        method: dto.paymentMethod,
        status: 'EN_ATTENTE',
        reference: dto.phoneNumber,
        pendingAbonnementCatalogueId: catalogue.id,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      salleId: adherent.salleId,
      action: 'adherent_abonnement.requested_from_mobile',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: { abonnementCatalogueId: catalogue.id, amount: Number(catalogue.price) },
    });

    // TODO(module notifications): alerter le gestionnaire d'une nouvelle demande.

    return payment;
  }

  /** Demandes en attente pour une salle — file d'attente du gestionnaire. */
  async listPendingSubscriptionRequests(salleId: string) {
    return this.prisma.payment.findMany({
      where: { salleId, status: 'EN_ATTENTE', pendingAbonnementCatalogueId: { not: null } },
      include: { adherent: { include: { user: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Le gestionnaire valide : constate le règlement (VALIDE), crée et
   * active réellement l'abonnement, et lie le paiement au nouvel
   * abonnement pour la génération du reçu (§8.3).
   */
  async approvePendingSubscription(paymentId: string, actor: TenantContext) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status !== 'EN_ATTENTE' || !payment.pendingAbonnementCatalogueId) {
      throw new BadRequestException('Aucune demande de souscription en attente pour ce paiement');
    }
    if (!actor.isGlobalAccess && actor.salleId !== payment.salleId) {
      throw new ForbiddenException('Cette demande n\'appartient pas à votre salle');
    }

    const subscription = await this.subscribe(
      payment.adherentId!,
      { abonnementCatalogueId: payment.pendingAbonnementCatalogueId },
      actor.userId,
    );

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'VALIDE',
        validatedByUserId: actor.userId,
        validatedAt: new Date(),
        adherentAbonnementId: subscription.id,
        pendingAbonnementCatalogueId: null,
      },
    });

    const receipt = await this.prisma.receipt.create({
      data: { id: randomUUID(), paymentId, number: this.generateReceiptNumber() },
    });

    await this.audit.log({
      userId: actor.userId,
      salleId: payment.salleId,
      action: 'adherent_abonnement.request_approved',
      entityType: 'AdherentAbonnement',
      entityId: subscription.id,
      metadata: { paymentId },
    });

    // TODO(module notifications): confirmer l'activation à l'adhérent.

    return { payment: updated, subscription, receipt };
  }

  /** Le gestionnaire rejette (fonds non retrouvés) — l'adhérent peut soumettre une nouvelle demande. */
  async rejectPendingSubscription(paymentId: string, actor: TenantContext, reason?: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status !== 'EN_ATTENTE' || !payment.pendingAbonnementCatalogueId) {
      throw new BadRequestException('Aucune demande de souscription en attente pour ce paiement');
    }
    if (!actor.isGlobalAccess && actor.salleId !== payment.salleId) {
      throw new ForbiddenException('Cette demande n\'appartient pas à votre salle');
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REJETE', validatedByUserId: actor.userId, validatedAt: new Date() },
    });

    await this.audit.log({
      userId: actor.userId,
      salleId: payment.salleId,
      action: 'adherent_abonnement.request_rejected',
      entityType: 'Payment',
      entityId: paymentId,
      metadata: { reason },
    });

    // TODO(module notifications): informer l'adhérent du rejet et du motif.

    return updated;
  }

  private generateReceiptNumber(): string {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `GC-REC-${yyyymm}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  /** §5.7 — Historique des abonnements. Un adhérent ne peut consulter que le sien. */
  async history(adherentId: string, actor?: { userId: string; roleCode: string }) {
    if (actor && actor.roleCode === 'ADHERENT') {
      const adherent = await this.prisma.adherentProfile.findUnique({ where: { id: adherentId } });
      if (!adherent || adherent.userId !== actor.userId) {
        throw new ForbiddenException('Vous ne pouvez consulter que votre propre historique');
      }
    }
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

  /**
   * §5.6 — Génère un code membre unique. Ne se contente plus de faire
   * confiance à un simple comptage (count+1) : celui-ci peut recalculer
   * le même numéro à chaque nouvel essai si une tentative précédente a
   * échoué après le comptage mais avant l'écriture (ex: collision, ou
   * tout autre échec) — boucle de vérification explicite à la place,
   * jusqu'à trouver un code réellement libre.
   */
  private async generateMemberCode(
    salleId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    const salle = await tx.salle.findUniqueOrThrow({ where: { id: salleId } });
    const prefix = salle.slug.slice(0, 4).toUpperCase();
    const count = await tx.adherentProfile.count({ where: { salleId } });

    for (let attempt = 0; attempt < 1000; attempt++) {
      const candidate = `${prefix}-${String(count + 1 + attempt).padStart(5, '0')}`;
      const existing = await tx.adherentProfile.findUnique({ where: { memberCode: candidate } });
      if (!existing) return candidate;
    }
    // Filet de sécurité si 1000 codes consécutifs sont déjà pris (ne
    // devrait jamais arriver en pratique) — suffixe aléatoire garanti unique.
    return `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private generateQrToken(): string {
    return randomBytes(24).toString('base64url'); // jeton long, imprévisible (§6.x sécurité QR)
  }
}
