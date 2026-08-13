import { Injectable, NotFoundException, ForbiddenException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { SaasBillingService } from '../saas-billing/saas-billing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TenantContext } from '../../common/middleware/tenant.middleware';
import { UpdateSalleBrandingDto, UpdateSalleSettingsDto } from './dto/salle.dto';

interface CreateSalleInput {
  name: string;
  proprietaireId: string;
  saasPlanId?: string;
  email?: string;
  phone: string;
  address: string;
  city: string;
  countryId: string;
}

/**
 * Service de gestion des salles (§3.1 à §3.15).
 *
 * La création est le point d'entrée du moteur SaaS : c'est ici que
 * sont exécutés les « Contrôles préalables » du §3.2 (vérification de
 * quota, détection de salle supplémentaire, mise à jour de la
 * facturation) avant toute écriture en base.
 */
@Injectable()
export class SallesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => SaasBillingService)) private readonly saasBilling: SaasBillingService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Création d'une salle — exclusivement appelable par SUPER_ADMIN
   * (contrôle fait au niveau du controller via @RequirePermission).
   */
  async create(input: CreateSalleInput, actorUserId: string) {
    const proprietaire = await this.prisma.proprietaire.findUnique({
      where: { id: input.proprietaireId },
      include: { subscription: true },
    });
    if (!proprietaire) {
      throw new NotFoundException('Propriétaire introuvable');
    }

    // Bootstrap de la souscription si c'est la première salle du propriétaire (§9.7)
    let subscription = proprietaire.subscription;
    if (!subscription) {
      if (!input.saasPlanId) {
        throw new ForbiddenException(
          'Le propriétaire n\'a pas encore de souscription SaaS : saasPlanId est requis pour la première salle.',
        );
      }
      const plan = await this.prisma.saasPlan.findUniqueOrThrow({ where: { id: input.saasPlanId } });
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + (plan.trialDays > 0 ? 0 : 1));
      if (plan.trialDays > 0) periodEnd.setDate(periodEnd.getDate() + plan.trialDays);

      subscription = await this.prisma.saasSubscription.create({
        data: {
          id: randomUUID(),
          proprietaireId: proprietaire.id,
          saasPlanId: plan.id,
          billingCycle: 'MENSUEL',
          status: 'ACTIF',
          startDate: new Date(),
          currentPeriodEnd: periodEnd,
        },
      });

      // §9.7, §9.13 — Facture de la première période, générée
      // immédiatement, y compris en période d'essai (facture à 0,
      // immédiatement soldée — voir generateBootstrapInvoice) : sans
      // cet appel, une salle créée dans le quota inclus n'aurait
      // jamais de facture avant son premier renouvellement 30 jours
      // plus tard (bug réel corrigé).
      await this.saasBilling.generateBootstrapInvoice(subscription.id, actorUserId);
    }

    // Contrôle préalable §3.2 : quota de salles inclus vs salle supplémentaire
    const isSupplementaire = await this.saasBilling.isNextSalleSupplementaire(subscription.id);

    const slug = this.slugify(input.name);
    const salle = await this.prisma.salle.create({
      data: {
        id: randomUUID(),
        proprietaireId: proprietaire.id,
        subscriptionId: subscription.id,
        name: input.name,
        slug,
        email: input.email,
        phone: input.phone,
        address: input.address,
        city: input.city,
        countryId: input.countryId,
        isSalleSupplementaire: isSupplementaire,
        status: 'ACTIF',
      },
    });

    // Facturation automatique si quota dépassé (§13.20)
    if (isSupplementaire) {
      await this.saasBilling.registerExtraSalleCharge(subscription.id, salle.id, actorUserId);
    }

    await this.audit.log({
      userId: actorUserId,
      salleId: salle.id,
      action: 'salle.create',
      entityType: 'Salle',
      entityId: salle.id,
      metadata: { isSalleSupplementaire: isSupplementaire, proprietaireId: proprietaire.id },
    });

    // §14.x, §3.2 — confirmation de création ; le coût éventuel
    // (salle supplémentaire) est déjà notifié séparément par
    // registerExtraSalleCharge ci-dessus, pas dupliqué ici.
    await this.notifications.create(
      proprietaire.userId,
      'Nouvelle salle créée',
      `La salle "${salle.name}" a été créée sur votre compte GymCloud.`,
    );

    return salle;
  }

  async findById(salleId: string) {
    const salle = await this.prisma.salle.findUnique({
      where: { id: salleId },
      include: { subscription: { include: { saasPlan: true } }, proprietaire: true, country: true },
    });
    if (!salle) throw new NotFoundException('Salle introuvable');
    return salle;
  }

  /** Vue consolidée du propriétaire — §2.3 */
  async findByProprietaire(proprietaireId: string) {
    return this.prisma.salle.findMany({
      where: { proprietaireId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * §14.x — Corrige une limitation documentée depuis longtemps dans le
   * code : SUPERVISEUR_PAYS voyait toute la plateforme, jamais filtré
   * par son pays malgré le nom du rôle. countryId optionnel : les
   * autres rôles à accès global (SUPER_ADMIN, ADMIN_GYMCLOUD...)
   * continuent de tout voir en ne passant rien.
   */
  async findAll(countryId?: string | null) {
    return this.prisma.salle.findMany({
      where: countryId ? { countryId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { proprietaire: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
  }

  /**
   * §3.4 — Seuls le SUPER_ADMIN et le PROPRIETAIRE de cette salle
   * précise peuvent en modifier l'identité visuelle/les paramètres —
   * jamais un autre propriétaire, jamais un gestionnaire (décision qui
   * dépasse la gestion quotidienne). Centralisé ici pour ne pas
   * dupliquer la vérification entre branding et settings.
   */
  private async assertOwnsSalleForConfig(salleId: string, actor: TenantContext) {
    if (actor.isGlobalAccess) return;
    const salle = await this.prisma.salle.findUnique({ where: { id: salleId } });
    if (!salle) throw new NotFoundException('Salle introuvable');
    if (!actor.proprietaireId || salle.proprietaireId !== actor.proprietaireId) {
      throw new ForbiddenException('Cette salle ne vous appartient pas');
    }
  }

  async updateBranding(salleId: string, dto: UpdateSalleBrandingDto, actor: TenantContext) {
    await this.assertOwnsSalleForConfig(salleId, actor);

    if (dto.publicSubdomain) {
      const existing = await this.prisma.salle.findUnique({ where: { publicSubdomain: dto.publicSubdomain } });
      if (existing && existing.id !== salleId) {
        throw new ConflictException(
          `Le sous-domaine "${dto.publicSubdomain}" est déjà utilisé par une autre salle — choisissez-en un autre`,
        );
      }
    }
    const salle = await this.prisma.salle.update({
      where: { id: salleId },
      data: dto as any,
    });
    await this.audit.log({
      userId: actor.userId,
      salleId,
      action: 'salle.branding_update',
      entityType: 'Salle',
      entityId: salleId,
    });
    return salle;
  }

  async updateSettings(salleId: string, dto: UpdateSalleSettingsDto, actor: TenantContext) {
    await this.assertOwnsSalleForConfig(salleId, actor);

    const salle = await this.prisma.salle.update({
      where: { id: salleId },
      data: dto as any,
    });
    await this.audit.log({
      userId: actor.userId,
      salleId,
      action: 'salle.settings_update',
      entityType: 'Salle',
      entityId: salleId,
    });
    return salle;
  }

  /** §3.3 — Suspension d'une salle (impayé SaaS, décision administrative...) */
  async suspend(salleId: string, actorUserId: string, reason: string) {
    const salle = await this.prisma.salle.update({
      where: { id: salleId },
      data: { status: 'SUSPENDU' },
    });
    await this.audit.log({
      userId: actorUserId,
      salleId,
      action: 'salle.suspend',
      entityType: 'Salle',
      entityId: salleId,
      metadata: { reason },
    });
    return salle;
  }

  async reactivate(salleId: string, actorUserId: string) {
    const salle = await this.prisma.salle.update({
      where: { id: salleId },
      data: { status: 'ACTIF' },
    });
    await this.audit.log({
      userId: actorUserId,
      salleId,
      action: 'salle.reactivate',
      entityType: 'Salle',
      entityId: salleId,
    });
    return salle;
  }

  private slugify(name: string): string {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${base}-${randomUUID().slice(0, 6)}`; // suffixe pour garantir l'unicité
  }

  /**
   * §6.14 — Image du QR fixe de la salle, à afficher ou imprimer à
   * l'entrée. Encode uniquement `checkinQrToken` — la même valeur que
   * l'application mobile envoie ensuite à
   * POST /access-control/self-checkin une fois scannée.
   */
  /**
   * §9.3, §14.x — L'add-on "Application mobile" (APPLICATION_WEB)
   * n'est jamais inclus automatiquement dans un plan : sans lui,
   * gestionnaire, coach et adhérent de cette salle ne peuvent pas
   * utiliser l'app mobile — uniquement le web. Vérifié à chaque
   * lancement de l'app mobile, pas seulement à la connexion (un
   * add-on désactivé en cours de session doit couper l'accès aussi).
   */
  async hasApplicationAccess(salleId: string): Promise<boolean> {
    const salle = await this.prisma.salle.findUnique({
      where: { id: salleId },
      select: {
        addons: { select: { status: true, addon: { select: { code: true } } } },
      },
    });
    return (
      salle?.addons.some(
        (sa: { status: string; addon: { code: string } }) => sa.addon.code === 'APPLICATION_WEB' && sa.status === 'ACTIF',
      ) ?? false
    );
  }

  async getCheckinQrCode(salleId: string) {
    const salle = await this.prisma.salle.findUniqueOrThrow({ where: { id: salleId } });
    const qrDataUrl = await QRCode.toDataURL(salle.checkinQrToken, { margin: 1, width: 400 });
    return { checkinQrToken: salle.checkinQrToken, qrDataUrl };
  }

  // ── Demande de salle supplémentaire (§3.2, §14.x) — délègue à
  // SaasBillingService, qui porte déjà toute la logique de
  // facturation/quota. La salle n'est JAMAIS créée directement par le
  // propriétaire — uniquement à l'approbation de la facture liée.

  requestAdditionalSalle(
    proprietaireId: string,
    dto: { name: string; email?: string; phone: string; address: string; city: string; countryId: string },
    actorUserId: string,
  ) {
    return this.saasBilling.requestAdditionalSalle(proprietaireId, dto, actorUserId);
  }

  listMySalleRequests(proprietaireId: string) {
    return this.saasBilling.listMySalleRequests(proprietaireId);
  }

  listPendingSalleRequests() {
    return this.saasBilling.listPendingSalleRequests();
  }

  rejectSalleRequest(requestId: string, note: string | undefined, actorUserId: string) {
    return this.saasBilling.rejectSalleRequest(requestId, note, actorUserId);
  }
}
