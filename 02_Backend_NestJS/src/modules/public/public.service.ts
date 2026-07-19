import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterProspectDto, RequestTrialSessionDto, RequestSubscriptionDto } from './dto/public.dto';

/**
 * §3.2 — Site public par salle (fitnessclub.gymcloud.africa). Chaque
 * méthode ici ne retourne QUE des champs sûrs à exposer publiquement
 * — jamais d'ID interne autre que ceux strictement nécessaires à la
 * navigation (coursCollectifId pour choisir un essai, catalogueId
 * pour indiquer une formule), jamais de données financières internes,
 * de quotas, ni d'informations sur d'autres adhérents.
 *
 * Aucune fonction d'administration n'est accessible ici : les deux
 * seules écritures possibles (registerProspect, requestTrialSession)
 * créent une simple piste commerciale (Prospect) — jamais un compte
 * adhérent, jamais une réservation réelle. C'est le gestionnaire qui
 * rappelle et convertit lui-même via le parcours guichet habituel.
 */
@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  /** Salle par sous-domaine public — 404 si inexistante, désactivée, ou sans sous-domaine configuré. */
  async getSalleBySubdomain(subdomain: string) {
    const salle = await this.prisma.salle.findFirst({
      where: { publicSubdomain: subdomain.toLowerCase(), status: 'ACTIF' },
      select: {
        id: true,
        name: true,
        slogan: true,
        description: true,
        logoUrl: true,
        coverImageUrl: true,
        primaryColor: true,
        secondaryColor: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        website: true,
        socialLinks: true,
        openingHours: true,
      },
    });
    if (!salle) throw new NotFoundException('Salle introuvable');
    return salle;
  }

  /** Formules publiques (nom, prix, durée) — jamais de coût interne (tarif salle supplémentaire, etc.). */
  async getPublicCatalogue(subdomain: string) {
    const salle = await this.getSalleBySubdomain(subdomain);
    return this.prisma.abonnementCatalogue.findMany({
      where: { salleId: salle.id, active: true },
      select: { id: true, name: true, description: true, durationDays: true, price: true, currency: true },
      orderBy: { price: 'asc' },
    });
  }

  /** Cours collectifs à venir — pour la présentation des activités et le choix d'un essai gratuit. */
  async getUpcomingCoursCollectifs(subdomain: string) {
    const salle = await this.getSalleBySubdomain(subdomain);
    return this.prisma.coursCollectif.findMany({
      where: { salleId: salle.id, startAt: { gte: new Date() } },
      select: {
        id: true,
        name: true,
        startAt: true,
        endAt: true,
        capacity: true,
        coach: { select: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { bookings: true } },
      },
      orderBy: { startAt: 'asc' },
      take: 30,
    });
  }

  /** §3.2, §3.4 — Galerie photo publique. */
  async getGallery(subdomain: string) {
    const salle = await this.getSalleBySubdomain(subdomain);
    return this.prisma.salleGalleryImage.findMany({
      where: { salleId: salle.id },
      select: { id: true, imageUrl: true, caption: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /** §3.2, §3.4 — Publications promotionnelles publiées, les plus récentes en premier. */
  async getPosts(subdomain: string) {
    const salle = await this.getSalleBySubdomain(subdomain);
    return this.prisma.sallePost.findMany({
      where: { salleId: salle.id, published: true },
      select: { id: true, title: true, content: true, imageUrl: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });
  }

  /** §3.2 — Inscription en ligne : crée un prospect léger, jamais un compte adhérent. */
  async registerProspect(subdomain: string, dto: RegisterProspectDto) {
    const salle = await this.getSalleBySubdomain(subdomain);

    if (dto.desiredCatalogueId) {
      const catalogue = await this.prisma.abonnementCatalogue.findUnique({
        where: { id: dto.desiredCatalogueId },
      });
      if (!catalogue || catalogue.salleId !== salle.id) {
        throw new NotFoundException('Formule introuvable pour cette salle');
      }
    }

    const prospect = await this.prisma.prospect.create({
      data: {
        id: randomUUID(),
        salleId: salle.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        message: dto.message,
        desiredCatalogueId: dto.desiredCatalogueId,
        source: 'INSCRIPTION',
      },
    });

    // TODO(module notifications): alerter le gestionnaire d'un nouveau prospect.

    return { id: prospect.id, message: 'Votre demande a bien été reçue, la salle vous recontactera rapidement.' };
  }

  /** §3.2 — Demande de séance d'essai gratuite : crée un prospect lié au cours visé, jamais une vraie réservation. */
  async requestTrialSession(subdomain: string, dto: RequestTrialSessionDto) {
    const salle = await this.getSalleBySubdomain(subdomain);

    const cours = await this.prisma.coursCollectif.findUnique({ where: { id: dto.trialCoursCollectifId } });
    if (!cours || cours.salleId !== salle.id) {
      throw new NotFoundException('Cours introuvable pour cette salle');
    }

    const prospect = await this.prisma.prospect.create({
      data: {
        id: randomUUID(),
        salleId: salle.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        message: dto.message,
        trialCoursCollectifId: dto.trialCoursCollectifId,
        source: 'ESSAI_GRATUIT',
      },
    });

    // TODO(module notifications): alerter le gestionnaire d'une demande d'essai.

    return {
      id: prospect.id,
      message: 'Votre demande d\'essai a bien été reçue — la salle confirmera votre place par téléphone.',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Demande d'abonnement plateforme (site vitrine GymCloud, §3.2, §9.5)
  // ─────────────────────────────────────────────────────────────
  //
  // Distinct de tout ce qui précède : ici, la personne n'a PAS encore
  // de salle — elle veut DEVENIR cliente de GymCloud. Ne crée jamais
  // de compte propriétaire automatiquement : le SUPER_ADMIN traite la
  // demande et crée le compte lui-même via le parcours habituel
  // (§2.4) une fois le contact établi.

  /** Plans publics (nom, tarifs, quotas) — pour le sélecteur du formulaire du site vitrine. */
  async getPublicPlans() {
    return this.prisma.saasPlan.findMany({
      where: { status: 'ACTIF' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        priceMonthly: true,
        priceAnnual: true,
        trialDays: true,
        quotaSalles: true,
        quotaGestionnaires: true,
        quotaAdherents: true,
        modules: true,
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /** §3.2, §9.5 — Demande d'abonnement depuis le site vitrine : crée une piste, jamais un compte propriétaire. */
  async requestSubscription(dto: RequestSubscriptionDto) {
    if (dto.desiredPlanId) {
      const plan = await this.prisma.saasPlan.findUnique({ where: { id: dto.desiredPlanId } });
      if (!plan) throw new NotFoundException('Plan introuvable');
    }

    const request = await this.prisma.saasSubscriptionRequest.create({
      data: {
        id: randomUUID(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        companyName: dto.companyName,
        city: dto.city,
        message: dto.message,
        desiredPlanId: dto.desiredPlanId,
      },
    });

    // TODO(module notifications): alerter le SUPER_ADMIN d'une nouvelle demande.

    return {
      id: request.id,
      message: 'Votre demande a bien été reçue — notre équipe vous recontactera rapidement pour finaliser votre inscription.',
    };
  }
}
