import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { SaasBillingService } from '../saas-billing/saas-billing.service';
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
    private readonly saasBilling: SaasBillingService,
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
      await this.saasBilling.generateBootstrapInvoice(subscription.id);
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

    // TODO(module notifications): notifier le propriétaire de la création
    // et des éventuels coûts supplémentaires (§3.2).

    return salle;
  }

  async findById(salleId: string) {
    const salle = await this.prisma.salle.findUnique({
      where: { id: salleId },
      include: { subscription: { include: { saasPlan: true } }, proprietaire: true },
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

  async findAll() {
    return this.prisma.salle.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async updateBranding(salleId: string, dto: UpdateSalleBrandingDto, actorUserId: string) {
    const salle = await this.prisma.salle.update({
      where: { id: salleId },
      data: dto as any,
    });
    await this.audit.log({
      userId: actorUserId,
      salleId,
      action: 'salle.branding_update',
      entityType: 'Salle',
      entityId: salleId,
    });
    return salle;
  }

  async updateSettings(salleId: string, dto: UpdateSalleSettingsDto, actorUserId: string) {
    const salle = await this.prisma.salle.update({
      where: { id: salleId },
      data: dto as any,
    });
    await this.audit.log({
      userId: actorUserId,
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
}
