import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { TenantContext } from '../../common/decorators/current-user.decorator';
import { SallesService } from '../salles/salles.service';
import { StorageService } from '../../common/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../notifications/email.service';
import { AuthService } from '../auth/auth.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { SaasBillingService } from '../saas-billing/saas-billing.service';
import {
  CreateProprietaireDto,
  CreateGestionnaireDto,
  CreateCoachDto,
} from './dto/users.dto';

const BCRYPT_ROUNDS = 12;

/**
 * Service de gestion des utilisateurs (§4.1 à §4.15).
 *
 * La matrice des droits (§2.8) autorise plusieurs rôles à créer un
 * GESTIONNAIRE ou un COACH selon leur position hiérarchique. CASL
 * (AbilityFactory) ne vérifie que « peut créer un User » de façon
 * grossière ; la restriction fine — quel rôle précis, sur quelle
 * salle — est appliquée ici, où le contexte métier est disponible.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sallesService: SallesService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly saasBillingService: SaasBillingService,
    private readonly emailService: EmailService,
    private readonly authService: AuthService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Propriétaires (§4.3) — création exclusive SUPER_ADMIN
  // ─────────────────────────────────────────────────────────────

  /**
   * Crée un propriétaire ET sa première salle (avec bootstrap de la
   * souscription SaaS) en une seule opération (§2.4, §3.2, §9.7) — un
   * propriétaire sans salle ni plan n'a pas de sens dans le modèle
   * GymCloud, ce n'est donc plus une étape séparée.
   *
   * Si la création de la salle échoue après que le propriétaire a été
   * créé (ex: countryId invalide), le propriétaire et son compte
   * utilisateur sont immédiatement supprimés pour éviter tout état
   * orphelin — approximation raisonnable d'une transaction atomique
   * sans avoir à faire transiter un client Prisma transactionnel à
   * travers plusieurs services.
   */
  /**
   * §14.x — Génère un code de parrainage court et lisible (ex:
   * "JEAN4821"), en boucle jusqu'à trouver une valeur libre — la
   * probabilité de collision est faible mais pas nulle, mieux vaut
   * vérifier plutôt que supposer sur un champ @unique.
   */
  private async generateReferralCode(firstName: string): Promise<string> {
    const base = firstName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // retire les accents
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase()
      .slice(0, 6) || 'GYM';

    for (let attempt = 0; attempt < 10; attempt++) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const code = `${base}${suffix}`;
      const existing = await this.prisma.proprietaire.findUnique({ where: { referralCode: code } });
      if (!existing) return code;
    }
    // Filet de sécurité si 10 tentatives échouent (extrêmement
    // improbable) — un suffixe basé sur le temps est garanti unique.
    return `${base}${Date.now().toString().slice(-6)}`;
  }

  /**
   * §14.x — Génération paresseuse pour les comptes créés avant
   * l'existence du parrainage (referralCode encore null en base).
   */
  async getOrCreateReferralCode(proprietaireId: string): Promise<string> {
    const proprietaire = await this.prisma.proprietaire.findUniqueOrThrow({
      where: { id: proprietaireId },
      include: { user: true },
    });
    if (proprietaire.referralCode) return proprietaire.referralCode;
    const code = await this.generateReferralCode(proprietaire.user.firstName);
    await this.prisma.proprietaire.update({ where: { id: proprietaireId }, data: { referralCode: code } });
    return code;
  }

  async createProprietaire(dto: CreateProprietaireDto, actor: TenantContext) {
    if (actor.roleCode !== 'SUPER_ADMIN' && actor.roleCode !== 'RESPONSABLE_COMMERCIAL') {
      throw new ForbiddenException('Seul le SUPER_ADMIN ou le Responsable Commercial peut créer un propriétaire (§2.8, §14.x)');
    }

    const { user, tempPassword } = await this.createBaseUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email,
      roleCode: 'PROPRIETAIRE',
    });

    const referralCode = await this.generateReferralCode(dto.firstName);
    const proprietaire = await this.prisma.proprietaire.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        companyName: dto.companyName,
        address: dto.address,
        // §14.x — hérite du pays de la salle par défaut (jamais
        // collecté séparément jusqu'ici, countryId restait donc
        // toujours null — la taxe par pays retombait silencieusement
        // à 0 pour TOUT propriétaire créé, quel que soit le taux
        // configuré sur son pays réel — bug réel corrigé). Le champ
        // dto.countryId reste accepté pour les cas où le propriétaire
        // gère depuis un pays différent de sa salle.
        countryId: dto.countryId ?? dto.salleCountryId,
        referralCode,
      },
    });

    let salle;
    try {
      salle = await this.sallesService.create(
        {
          name: dto.salleName,
          proprietaireId: proprietaire.id,
          saasPlanId: dto.saasPlanId,
          phone: dto.sallePhone,
          email: dto.salleEmail,
          address: dto.salleAddress,
          city: dto.salleCity,
          countryId: dto.salleCountryId,
        },
        actor.userId,
      );
    } catch (error) {
      // Retour arrière : pas de propriétaire orphelin sans salle (§2.4).
      // La souscription SaaS (et sa facture de bootstrap) peut avoir
      // été créée par sallesService.create AVANT l'échec de la salle
      // elle-même — il faut la retirer en premier, sinon la
      // suppression du propriétaire échoue à son tour sur la
      // contrainte de clé étrangère (bug réel corrigé).
      const orphanSubscription = await this.prisma.saasSubscription.findUnique({
        where: { proprietaireId: proprietaire.id },
      });
      if (orphanSubscription) {
        await this.prisma.saasInvoice.deleteMany({ where: { subscriptionId: orphanSubscription.id } });
        await this.prisma.saasSubscription.delete({ where: { id: orphanSubscription.id } });
      }
      await this.prisma.proprietaire.delete({ where: { id: proprietaire.id } });
      await this.prisma.user.delete({ where: { id: user.id } });
      throw error;
    }

    // §9.3 — Reprend les add-ons souhaités lors d'une demande depuis le
    // site vitrine (jamais activés automatiquement autrement) —
    // activation directe (pas de validation séparée : le SUPER_ADMIN
    // crée déjà ce compte lui-même), durée alignée sur le cycle du
    // plan choisi (mensuel → 1 mois, annuel → 12 mois).
    if (dto.addonCodes && dto.addonCodes.length > 0 && salle.subscriptionId) {
      const [matchingAddons, newSubscription] = await Promise.all([
        this.prisma.saasAddon.findMany({ where: { code: { in: dto.addonCodes } }, select: { id: true } }),
        this.prisma.saasSubscription.findUnique({
          where: { id: salle.subscriptionId },
          select: { billingCycle: true },
        }),
      ]);
      const durationMonths = newSubscription?.billingCycle === 'ANNUEL' ? 12 : 1;
      await Promise.all(
        matchingAddons.map((a: { id: string }) =>
          this.saasBillingService.attachAddonDirect(salle.id, a.id, durationMonths, actor.userId),
        ),
      );
    }

    await this.audit.log({
      userId: actor.userId,
      action: 'proprietaire.create',
      entityType: 'Proprietaire',
      entityId: proprietaire.id,
      metadata: { salleId: salle.id },
    });

    // §2.4, §2.8 — Le propriétaire est rarement physiquement présent
    // avec le SUPER_ADMIN qui crée son compte (contrairement à un
    // adhérent inscrit au guichet) : sans e-mail, il n'aurait aucun
    // moyen de connaître son mot de passe. L'e-mail est un
    // complément — tempPassword continue d'être renvoyé ci-dessous
    // pour que le SUPER_ADMIN puisse aussi le communiquer directement
    // si besoin (pas d'adresse e-mail fournie, panne d'envoi...).
    if (dto.email) {
      await this.notifications.create(
        user.id,
        'Bienvenue sur GymCloud — votre compte propriétaire',
        `Bonjour ${dto.firstName},\n\nVotre compte propriétaire GymCloud a été créé pour "${dto.salleName}".\n\nTéléphone de connexion : ${dto.phone}\nMot de passe temporaire : ${tempPassword}\n\nPensez à le changer dès votre première connexion.`,
      );
    }

    // §14.x — WhatsApp, contrairement à l'e-mail, fonctionne sans
    // condition : le téléphone est toujours renseigné (obligatoire),
    // contrairement à l'e-mail (optionnel) — c'était justement le
    // trou que ce lien d'activation vient combler. Échec silencieux
    // volontaire (voir WhatsAppService) : ne bloque jamais la
    // création du compte elle-même.
    const activationLink = await this.authService.generateActivationLink(user.id);
    await this.whatsAppService.send(dto.phone, 'bienvenue_proprietaire', [dto.firstName, dto.salleName, activationLink]);

    // §14.x — Programme de parrainage : lie le filleul à son parrain
    // si un code valide a été fourni, et accorde 10% sur SA première
    // facture (via promotionalDiscountPct, déjà pris en compte par
    // getOrCreateCurrentInvoice/generateRenewalInvoice). Le parrain,
    // lui, n'est récompensé (un mois offert) qu'une fois cette
    // première facture réellement payée — voir markInvoicePaid /
    // approveDeclaredPayment dans SaasBillingService, jamais ici.
    if (dto.referralCode && salle.subscriptionId) {
      const referrer = await this.prisma.proprietaire.findUnique({
        where: { referralCode: dto.referralCode.trim().toUpperCase() },
      });
      // Un propriétaire ne peut pas se parrainer lui-même (impossible
      // en pratique à ce stade puisque le filleul vient d'être créé,
      // mais gardé par prudence si ce code est un jour réutilisé
      // ailleurs) — un code invalide/inconnu est silencieusement
      // ignoré plutôt que de faire échouer toute la création.
      if (referrer && referrer.id !== proprietaire.id) {
        await this.prisma.referral.create({
          data: { id: randomUUID(), referrerProprietaireId: referrer.id, referredProprietaireId: proprietaire.id },
        });
        await this.prisma.saasSubscription.update({
          where: { id: salle.subscriptionId },
          data: { promotionalDiscountPct: 10 },
        });
      }
    }

    return { proprietaire, salle, user, tempPassword };
  }

  async listProprietaires() {
    return this.prisma.proprietaire.findMany({
      include: { user: true, salles: { select: { id: true, name: true } } },
    });
  }

  async findProprietaireByUserId(userId: string) {
    const proprietaire = await this.prisma.proprietaire.findUnique({ where: { userId } });
    if (!proprietaire) throw new NotFoundException('Propriétaire introuvable');
    return proprietaire;
  }

  async findProprietaireById(id: string) {
    const proprietaire = await this.prisma.proprietaire.findUnique({ where: { id } });
    if (!proprietaire) throw new NotFoundException('Propriétaire introuvable');
    return proprietaire;
  }

  /**
   * §14.x — Modifier les infos d'un propriétaire, notamment son pays
   * — champ jusqu'ici jamais collecté par le formulaire de création,
   * ce qui rendait la taxe par pays silencieusement inopérante pour
   * tout propriétaire créé avant cette correction (countryId restait
   * null, la taxe retombait donc à 0 quel que soit le taux configuré
   * sur le pays lui-même — bug réel corrigé).
   */
  async updateProprietaire(
    id: string,
    dto: { companyName?: string; address?: string; countryId?: string },
  ) {
    const proprietaire = await this.prisma.proprietaire.findUnique({ where: { id } });
    if (!proprietaire) throw new NotFoundException('Propriétaire introuvable');
    return this.prisma.proprietaire.update({
      where: { id },
      data: { companyName: dto.companyName, address: dto.address, countryId: dto.countryId },
    });
  }

  /**
   * §14.x — Envoi manuel d'un e-mail par le SUPER_ADMIN à un
   * propriétaire précis (annonce, relance, information ponctuelle) —
   * réutilise EmailService, déjà en place pour les notifications
   * automatiques, jamais exposé jusqu'ici pour un envoi à la demande.
   */
  async sendEmailToProprietaire(proprietaireId: string, subject: string, body: string) {
    const proprietaire = await this.prisma.proprietaire.findUnique({
      where: { id: proprietaireId },
      include: { user: true },
    });
    if (!proprietaire) throw new NotFoundException('Propriétaire introuvable');
    if (!proprietaire.user.email) {
      throw new BadRequestException('Ce propriétaire n\'a pas d\'adresse e-mail enregistrée');
    }

    const sent = await this.emailService.send(proprietaire.user.email, subject, body);
    if (!sent) {
      throw new BadRequestException(
        'L\'envoi a échoué — vérifiez la configuration e-mail du serveur (RESEND_API_KEY)',
      );
    }
    return { success: true };
  }

  /**
   * §9.4 — Suppression complète et irréversible d'un propriétaire :
   * toutes ses salles et tout ce qu'elles contiennent (adhérents,
   * paiements, réservations, personnel, contenu...), sa souscription
   * SaaS, puis son propre compte. Réservé SUPER_ADMIN.
   *
   * Reproduit fidèlement, mais de façon réutilisable et transactionnelle
   * (tout ou rien), l'enchaînement de suppressions manuelles fait à la
   * main plusieurs fois en base pendant le développement — voir la
   * dépendance salles → subscriptionId qui exige de supprimer les
   * salles AVANT la souscription SaaS, pas après.
   */
  async deleteProprietaire(proprietaireId: string, actorUserId: string) {
    const proprietaire = await this.findProprietaireById(proprietaireId);

    const salles = await this.prisma.salle.findMany({ where: { proprietaireId }, select: { id: true } });
    const salleIds = salles.map((s: { id: string }) => s.id);

    const [gestionnaires, coachs, adherents] = await Promise.all([
      this.prisma.gestionnaireProfile.findMany({ where: { salleId: { in: salleIds } }, select: { userId: true } }),
      this.prisma.coachProfile.findMany({ where: { salleId: { in: salleIds } }, select: { userId: true } }),
      this.prisma.adherentProfile.findMany({ where: { salleId: { in: salleIds } }, select: { userId: true } }),
    ]);
    const staffUserIds = [
      ...gestionnaires.map((g: { userId: string }) => g.userId),
      ...coachs.map((c: { userId: string }) => c.userId),
      ...adherents.map((a: { userId: string }) => a.userId),
    ];
    const allUserIds = [...staffUserIds, proprietaire.userId];

    await this.prisma.$transaction([
      this.prisma.receipt.deleteMany({ where: { payment: { salleId: { in: salleIds } } } }),
      this.prisma.waitingListEntry.deleteMany({ where: { coursCollectif: { salleId: { in: salleIds } } } }),
      this.prisma.booking.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.payment.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.coachMonthlyPass.deleteMany({ where: { coach: { salleId: { in: salleIds } } } }),
      this.prisma.coachAvailability.deleteMany({ where: { coach: { salleId: { in: salleIds } } } }),
      this.prisma.adherentAbonnement.deleteMany({ where: { adherent: { salleId: { in: salleIds } } } }),
      this.prisma.accessLog.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.coursCollectif.deleteMany({ where: { salleId: { in: salleIds } } }),

      this.prisma.adherentProfile.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.coachProfile.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.gestionnaireProfile.deleteMany({ where: { salleId: { in: salleIds } } }),

      this.prisma.prospect.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.coupon.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.marketingCampaign.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.messageTemplate.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.salleDocument.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.salleGalleryImage.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.sallePost.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.salleTestimonial.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.abonnementCatalogue.deleteMany({ where: { salleId: { in: salleIds } } }),

      this.prisma.auditLog.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.notification.deleteMany({ where: { userId: { in: allUserIds } } }),

      // §14.x — ajoutés après la première écriture de cette cascade
      // (Boutique, Finances, demande de salle) — jamais inclus alors
      // que leurs clés étrangères bloquent la suppression de la salle
      // ou du propriétaire (bug réel corrigé). productSale AVANT
      // product (le premier référence le second), salleCreationRequest
      // AVANT salle (référence createdSalleId) ET avant proprietaire
      // (référence proprietaireId, obligatoire).
      this.prisma.productSale.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.product.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.expense.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.expenseBudget.deleteMany({ where: { salleId: { in: salleIds } } }),
      this.prisma.salleCreationRequest.deleteMany({ where: { proprietaireId } }),

      // Salles supprimées AVANT la souscription SaaS (dépendance directe salles.subscriptionId)
      this.prisma.salle.deleteMany({ where: { id: { in: salleIds } } }),

      this.prisma.saasSubscriptionHistory.deleteMany({ where: { subscription: { proprietaireId } } }),
      this.prisma.saasInvoice.deleteMany({ where: { subscription: { proprietaireId } } }),
      this.prisma.saasSubscriptionAddon.deleteMany({ where: { subscription: { proprietaireId } } }),
      this.prisma.saasSubscription.deleteMany({ where: { proprietaireId } }),

      this.prisma.proprietaire.delete({ where: { id: proprietaireId } }),
      this.prisma.user.deleteMany({ where: { id: { in: allUserIds } } }),
    ]);

    await this.audit.log({
      userId: actorUserId,
      action: 'proprietaire.delete',
      entityType: 'Proprietaire',
      entityId: proprietaireId,
      metadata: { salleIds, deletedUserCount: allUserIds.length },
    });

    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────
  // Gestionnaires (§4.4) — SUPER_ADMIN ou PROPRIETAIRE (§2.8)
  // ─────────────────────────────────────────────────────────────

  async createGestionnaire(dto: CreateGestionnaireDto, actor: TenantContext) {
    const salle = await this.prisma.salle.findUnique({ where: { id: dto.salleId } });
    if (!salle) throw new NotFoundException('Salle introuvable');

    if (actor.roleCode !== 'SUPER_ADMIN') {
      if (actor.roleCode !== 'PROPRIETAIRE') {
        throw new ForbiddenException(
          'Seuls le SUPER_ADMIN et le PROPRIETAIRE peuvent créer un gestionnaire (§2.8)',
        );
      }
      if (salle.proprietaireId !== actor.proprietaireId) {
        throw new ForbiddenException('Cette salle n\'appartient pas à ce propriétaire');
      }
    }

    const { user, tempPassword } = await this.createBaseUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email,
      roleCode: 'GESTIONNAIRE',
    });

    const profile = await this.prisma.gestionnaireProfile.create({
      data: { id: randomUUID(), userId: user.id, salleId: dto.salleId },
    });

    await this.audit.log({
      userId: actor.userId,
      salleId: dto.salleId,
      action: 'gestionnaire.create',
      entityType: 'GestionnaireProfile',
      entityId: profile.id,
    });

    if (dto.email) {
      await this.notifications.create(
        user.id,
        'Bienvenue sur GymCloud — votre compte gestionnaire',
        `Bonjour ${dto.firstName},\n\nVotre compte gestionnaire GymCloud a été créé pour "${salle.name}".\n\nTéléphone de connexion : ${dto.phone}\nMot de passe temporaire : ${tempPassword}\n\nPensez à le changer dès votre première connexion.`,
      );
    }

    const gestionnaireActivationLink = await this.authService.generateActivationLink(user.id);
    await this.whatsAppService.sendIfEnabledForSalle(dto.salleId, dto.phone, 'bienvenue_personnel', [
      dto.firstName,
      'Gestionnaire',
      salle.name,
      gestionnaireActivationLink,
    ]);

    return { profile, user, tempPassword };
  }

  async findGestionnairesBySalle(salleId: string) {
    return this.prisma.gestionnaireProfile.findMany({
      where: { salleId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, status: true } },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Coachs (§4.5) — SUPER_ADMIN, PROPRIETAIRE ou GESTIONNAIRE (§2.8)
  // ─────────────────────────────────────────────────────────────

  async createCoach(dto: CreateCoachDto, actor: TenantContext) {
    const salle = await this.prisma.salle.findUnique({ where: { id: dto.salleId } });
    if (!salle) throw new NotFoundException('Salle introuvable');

    if (actor.roleCode !== 'SUPER_ADMIN') {
      if (actor.roleCode === 'PROPRIETAIRE') {
        if (salle.proprietaireId !== actor.proprietaireId) {
          throw new ForbiddenException('Cette salle n\'appartient pas à ce propriétaire');
        }
      } else if (actor.roleCode === 'GESTIONNAIRE') {
        if (actor.salleId !== dto.salleId) {
          throw new ForbiddenException('Un gestionnaire ne peut créer un coach que pour sa propre salle');
        }
      } else {
        throw new ForbiddenException(
          'Seuls SUPER_ADMIN, PROPRIETAIRE et GESTIONNAIRE peuvent créer un coach (§2.8)',
        );
      }
    }

    const { user, tempPassword } = await this.createBaseUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email,
      roleCode: 'COACH',
    });

    const profile = await this.prisma.coachProfile.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        salleId: dto.salleId,
        bio: dto.bio,
        specialties: dto.specialties ?? [],
      },
    });

    await this.audit.log({
      userId: actor.userId,
      salleId: dto.salleId,
      action: 'coach.create',
      entityType: 'CoachProfile',
      entityId: profile.id,
    });

    if (dto.email) {
      await this.notifications.create(
        user.id,
        'Bienvenue sur GymCloud — votre compte coach',
        `Bonjour ${dto.firstName},\n\nVotre compte coach GymCloud a été créé pour "${salle.name}".\n\nTéléphone de connexion : ${dto.phone}\nMot de passe temporaire : ${tempPassword}\n\nPensez à le changer dès votre première connexion.`,
      );
    }

    const coachActivationLink = await this.authService.generateActivationLink(user.id);
    await this.whatsAppService.sendIfEnabledForSalle(dto.salleId, dto.phone, 'bienvenue_personnel', [
      dto.firstName,
      'Coach',
      salle.name,
      coachActivationLink,
    ]);

    return { profile, user, tempPassword };
  }

  async findCoachsBySalle(salleId: string) {
    return this.prisma.coachProfile.findMany({
      where: { salleId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, status: true } },
        availabilities: true,
      },
    });
  }

  /**
   * §7.6, §7.7 — Liste des coachs d'une salle, réservée à la prise de
   * décision de réservation (adhérent choisissant avec qui prendre une
   * séance individuelle) — champs volontairement limités (pas de
   * téléphone/email, contrairement à `findCoachsBySalle` réservé au
   * personnel).
   */
  async findCoachsForBooking(salleId: string) {
    const coachs = await this.prisma.coachProfile.findMany({
      where: { salleId, user: { status: 'ACTIF' } },
      select: {
        id: true,
        bio: true,
        photoUrl: true,
        specialties: true,
        pricePerSession: true,
        priceMonthly: true,
        currency: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    return coachs.map((c: (typeof coachs)[number]) => ({
      id: c.id,
      firstName: c.user.firstName,
      lastName: c.user.lastName,
      bio: c.bio,
      photoUrl: c.photoUrl,
      specialties: c.specialties,
      pricePerSession: c.pricePerSession,
      priceMonthly: c.priceMonthly,
      currency: c.currency,
    }));
  }

  /** §7.7 — Configure la tarification des séances individuelles d'un coach. */
  async updateCoachPricing(
    coachId: string,
    data: { pricePerSession?: number; priceMonthly?: number; currency?: string },
  ) {
    return this.prisma.coachProfile.update({
      where: { id: coachId },
      data,
    });
  }

  /** §3.4, §4.5 — Photo de profil du coach, affichée sur le site public ("Notre équipe"). */
  async updateCoachPhoto(coachId: string, file: { buffer: Buffer; originalname: string; mimetype: string }) {
    const coach = await this.prisma.coachProfile.findUniqueOrThrow({ where: { id: coachId } });
    const photoUrl = await this.storage.uploadFile(file.buffer, `coachs/${coachId}`, file.originalname, file.mimetype);
    await this.prisma.coachProfile.update({ where: { id: coachId }, data: { photoUrl } });
    if (coach.photoUrl) await this.storage.deleteFileByUrl(coach.photoUrl);
    return { photoUrl };
  }

  // ─────────────────────────────────────────────────────────────
  // Cycle de vie commun (§4.2, applicable à tous les profils)
  // ─────────────────────────────────────────────────────────────

  async suspendUser(userId: string, actorUserId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDU' },
    });
    await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
    await this.audit.log({
      userId: actorUserId,
      action: 'user.suspend',
      entityType: 'User',
      entityId: userId,
    });
    return user;
  }

  async reactivateUser(userId: string, actorUserId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIF' },
    });
    await this.audit.log({
      userId: actorUserId,
      action: 'user.reactivate',
      entityType: 'User',
      entityId: userId,
    });
    return user;
  }

  /**
   * §4.2 — Désactivation (« suppression ») d'un compte : jamais un
   * DELETE SQL réel — un utilisateur peut être référencé par des
   * paiements, réservations, journaux d'accès, etc., qu'il serait
   * dangereux d'orphelin ou de perdre. DESACTIVE est distinct de
   * SUSPENDU (généralement temporaire) — plus définitif dans l'esprit,
   * mais techniquement toujours réversible par un SUPER_ADMIN.
   */
  async deactivateUser(userId: string, actorUserId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'DESACTIVE' },
    });
    await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
    await this.audit.log({
      userId: actorUserId,
      action: 'user.deactivate',
      entityType: 'User',
      entityId: userId,
    });
    return user;
  }

  // ─────────────────────────────────────────────────────────────
  // Gestionnaires — cycle de vie avec vérification d'appartenance
  // (§4.2, §4.4) : un PROPRIETAIRE ne peut agir que sur les
  // gestionnaires d'une salle qui lui appartient, jamais sur ceux
  // d'un autre propriétaire.
  // ─────────────────────────────────────────────────────────────

  private async assertOwnsGestionnaire(gestionnaireUserId: string, actor: TenantContext) {
    const profile = await this.prisma.gestionnaireProfile.findUnique({
      where: { userId: gestionnaireUserId },
      include: { salle: true },
    });
    if (!profile) throw new NotFoundException('Gestionnaire introuvable');
    if (!actor.isGlobalAccess && profile.salle.proprietaireId !== actor.proprietaireId) {
      throw new ForbiddenException('Ce gestionnaire n\'appartient pas à l\'une de vos salles');
    }
    return profile;
  }

  async suspendGestionnaire(gestionnaireUserId: string, actor: TenantContext) {
    await this.assertOwnsGestionnaire(gestionnaireUserId, actor);
    return this.suspendUser(gestionnaireUserId, actor.userId);
  }

  async reactivateGestionnaire(gestionnaireUserId: string, actor: TenantContext) {
    await this.assertOwnsGestionnaire(gestionnaireUserId, actor);
    return this.reactivateUser(gestionnaireUserId, actor.userId);
  }

  async deactivateGestionnaire(gestionnaireUserId: string, actor: TenantContext) {
    await this.assertOwnsGestionnaire(gestionnaireUserId, actor);
    return this.deactivateUser(gestionnaireUserId, actor.userId);
  }

  /**
   * §4.2, §4.4 — Suppression définitive et irréversible d'un
   * gestionnaire (contrairement à "désactiver", qui conserve
   * l'historique). Peu de dépendances propres : ses jetons/historique
   * de connexion suivent automatiquement (cascade déjà en place sur
   * User), il ne reste qu'à retirer son profil puis son compte.
   */
  async deleteGestionnaire(gestionnaireUserId: string, actor: TenantContext) {
    const profile = await this.assertOwnsGestionnaire(gestionnaireUserId, actor);
    await this.prisma.notification.deleteMany({ where: { userId: gestionnaireUserId } });
    await this.prisma.gestionnaireProfile.delete({ where: { id: profile.id } });
    await this.prisma.user.delete({ where: { id: gestionnaireUserId } });
    await this.audit.log({
      userId: actor.userId,
      action: 'gestionnaire.delete',
      entityType: 'GestionnaireProfile',
      entityId: profile.id,
    });
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────
  // Coachs — cycle de vie avec vérification d'appartenance (§4.2,
  // §4.5) : un GESTIONNAIRE ne peut agir que sur les coachs de SA
  // salle ; un PROPRIETAIRE, sur les coachs de l'une de ses salles.
  // ─────────────────────────────────────────────────────────────

  private async assertOwnsCoach(coachUserId: string, actor: TenantContext) {
    const profile = await this.prisma.coachProfile.findUnique({
      where: { userId: coachUserId },
      include: { salle: true },
    });
    if (!profile) throw new NotFoundException('Coach introuvable');
    if (actor.isGlobalAccess) return profile;
    if (actor.proprietaireId) {
      if (profile.salle.proprietaireId !== actor.proprietaireId) {
        throw new ForbiddenException('Ce coach n\'appartient pas à l\'une de vos salles');
      }
      return profile;
    }
    if (profile.salleId !== actor.salleId) {
      throw new ForbiddenException('Ce coach n\'appartient pas à votre salle');
    }
    return profile;
  }

  async suspendCoach(coachUserId: string, actor: TenantContext) {
    await this.assertOwnsCoach(coachUserId, actor);
    return this.suspendUser(coachUserId, actor.userId);
  }

  async reactivateCoach(coachUserId: string, actor: TenantContext) {
    await this.assertOwnsCoach(coachUserId, actor);
    return this.reactivateUser(coachUserId, actor.userId);
  }

  async deactivateCoach(coachUserId: string, actor: TenantContext) {
    await this.assertOwnsCoach(coachUserId, actor);
    return this.deactivateUser(coachUserId, actor.userId);
  }

  /**
   * §4.2, §4.5 — Suppression définitive et irréversible d'un coach.
   * Contrairement au gestionnaire, un coach a des dépendances propres
   * (réservations où il intervient, disponibilités déclarées, forfaits
   * mensuels adhérents) qu'il faut nettoyer avant de retirer son
   * profil — sans jamais toucher aux adhérents ou paiements
   * eux-mêmes, seulement au lien vers ce coach précis.
   */
  async deleteCoach(coachUserId: string, actor: TenantContext) {
    const profile = await this.assertOwnsCoach(coachUserId, actor);
    await this.prisma.booking.deleteMany({ where: { coachId: profile.id } });
    await this.prisma.coachAvailability.deleteMany({ where: { coachId: profile.id } });
    await this.prisma.coachMonthlyPass.deleteMany({ where: { coachId: profile.id } });
    await this.prisma.notification.deleteMany({ where: { userId: coachUserId } });
    await this.prisma.coachProfile.delete({ where: { id: profile.id } });
    await this.prisma.user.delete({ where: { id: coachUserId } });
    await this.audit.log({
      userId: actor.userId,
      action: 'coach.delete',
      entityType: 'CoachProfile',
      entityId: profile.id,
    });
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers internes
  // ─────────────────────────────────────────────────────────────

  private async createBaseUser(input: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    roleCode?: string;
    roleId?: string;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
      throw new ConflictException('Un utilisateur existe déjà avec ce numéro de téléphone');
    }
    if (input.email) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email: input.email } });
      if (existingEmail) {
        throw new ConflictException('Un utilisateur existe déjà avec cette adresse e-mail');
      }
    }

    const role = input.roleId
      ? await this.prisma.role.findUniqueOrThrow({ where: { id: input.roleId } })
      : await this.prisma.role.findUniqueOrThrow({ where: { code: input.roleCode } });
    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email,
        passwordHash,
        roleId: role.id,
        status: 'ACTIF',
      },
    });

    return { user, tempPassword };
  }

  private generateTempPassword(): string {
    return randomBytes(9).toString('base64url'); // 12 caractères lisibles, cryptographiquement sûrs
  }

  // ─────────────────────────────────────────────────────────────
  // Personnel interne GymCloud (§2.2) — exclusivement SUPER_ADMIN
  // ─────────────────────────────────────────────────────────────

  /**
   * Crée un compte de personnel interne GymCloud (Support, Finance,
   * Commercial, Marketing, Superviseur Pays...) — rôles à portée
   * INTERNAL, distincts des 5 rôles système fixes. Rejette toute
   * tentative avec un rôle SYSTEM (ces comptes ont leurs propres
   * parcours de création : createProprietaire, createGestionnaire...).
   */
  async createInternalUser(
    dto: { firstName: string; lastName: string; phone: string; email?: string; roleId: string; countryId?: string },
    actor: TenantContext,
  ) {
    if (actor.roleCode !== 'SUPER_ADMIN' && actor.roleCode !== 'ADMIN_GYMCLOUD') {
      throw new ForbiddenException('Seul le SUPER_ADMIN ou l\'Administrateur GymCloud peut créer un compte de personnel interne (§2.2, §14.x)');
    }

    const role = await this.prisma.role.findUniqueOrThrow({ where: { id: dto.roleId } });
    if (role.scope !== 'INTERNAL') {
      throw new ForbiddenException(
        'Ce rôle n\'est pas un rôle interne GymCloud — utilisez le parcours de création dédié (propriétaire, gestionnaire...)',
      );
    }

    const { user, tempPassword } = await this.createBaseUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email,
      roleId: dto.roleId,
    });

    if (dto.countryId) {
      await this.prisma.user.update({ where: { id: user.id }, data: { countryId: dto.countryId } });
    }

    await this.audit.log({
      userId: actor.userId,
      action: 'internal_user.create',
      entityType: 'User',
      entityId: user.id,
      metadata: { roleCode: role.code },
    });

    if (dto.email) {
      await this.notifications.create(
        user.id,
        'Bienvenue sur GymCloud — votre compte',
        `Bonjour ${dto.firstName},\n\nVotre compte ${role.name} a été créé sur la plateforme GymCloud.\n\nTéléphone de connexion : ${dto.phone}\nMot de passe temporaire : ${tempPassword}\n\nPensez à le changer dès votre première connexion.`,
      );
    }

    // §14.x — remplace le TODO laissé ici : envoi réel désormais en
    // place (voir WhatsAppService), un lien de première connexion
    // plutôt que le mot de passe en clair (voir generateActivationLink).
    const internalActivationLink = await this.authService.generateActivationLink(user.id);
    await this.whatsAppService.send(dto.phone, 'bienvenue_personnel_interne', [
      dto.firstName,
      role.name,
      internalActivationLink,
    ]);

    return { user, tempPassword };
  }

  /**
   * §14.x — Créer un compte SUPER_ADMIN supplémentaire, plafonné à 2
   * au total (jamais plus, y compris des comptes suspendus — on ne
   * veut jamais qu'un 3e existe, même inactif). Volontairement
   * exclusif au SUPER_ADMIN lui-même — contrairement à la création de
   * personnel interne, déléguée à Administrateur GymCloud, celle-ci
   * reste la plus sensible de toutes et n'est jamais déléguée.
   * Distinct de createInternalUser : SUPER_ADMIN a un scope SYSTEM,
   * pas INTERNAL, donc rejeté par le garde-fou de cette dernière.
   */
  async createAdditionalSuperAdmin(
    dto: { firstName: string; lastName: string; phone: string; email?: string },
    actor: TenantContext,
  ) {
    if (actor.roleCode !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Seul un SUPER_ADMIN peut créer un autre compte SUPER_ADMIN (§14.x)');
    }

    const superAdminRole = await this.prisma.role.findUniqueOrThrow({ where: { code: 'SUPER_ADMIN' } });
    const existingCount = await this.prisma.user.count({ where: { roleId: superAdminRole.id } });
    if (existingCount >= 2) {
      throw new ForbiddenException(
        'Le nombre maximal de comptes SUPER_ADMIN (2) est déjà atteint — désactivez-en un avant d\'en créer un nouveau.',
      );
    }

    const { user, tempPassword } = await this.createBaseUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email,
      roleId: superAdminRole.id,
    });

    await this.audit.log({
      userId: actor.userId,
      action: 'super_admin.create',
      entityType: 'User',
      entityId: user.id,
    });

    const superAdminActivationLink = await this.authService.generateActivationLink(user.id);
    await this.whatsAppService.send(dto.phone, 'bienvenue_personnel_interne', [
      dto.firstName,
      superAdminRole.name,
      superAdminActivationLink,
    ]);

    return { user, tempPassword };
  }

  /** Liste tous les comptes internes GymCloud (tous rôles à portée INTERNAL confondus). */
  /**
   * §2.2, §14.x — Un compte désactivé disparaît de cette liste (mais
   * pas de la base — historique/audit conservés) : "supprimer" pour
   * le SUPER_ADMIN qui l'utilise au quotidien, sans les risques d'une
   * suppression définitive (jetons de rafraîchissement, logs d'audit,
   * rôles cumulés qui référencent encore ce compte).
   */
  async listInternalUsers() {
    return this.prisma.user.findMany({
      where: { role: { scope: 'INTERNAL' }, status: { not: 'DESACTIVE' } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        status: true,
        createdAt: true,
        role: true,
        country: true,
        additionalRoles: { include: { role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * §2.2 — Changer le rôle d'un membre du personnel interne GymCloud
   * (ex: passer de RESPONSABLE_SUPPORT à RESPONSABLE_COMMERCIAL).
   * Exclusivement SUPER_ADMIN — un rôle interne ne peut être remplacé
   * que par un autre rôle interne, jamais par un rôle client
   * (PROPRIETAIRE, GESTIONNAIRE...), qui suit son propre parcours de
   * création dédié.
   */
  async updateInternalUserRole(userId: string, newRoleId: string, actor: TenantContext) {
    if (actor.roleCode !== 'SUPER_ADMIN' && actor.roleCode !== 'ADMIN_GYMCLOUD') {
      throw new ForbiddenException('Seul le SUPER_ADMIN ou l\'Administrateur GymCloud peut modifier le rôle du personnel interne (§2.2, §14.x)');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!targetUser) throw new NotFoundException('Utilisateur introuvable');
    if (targetUser.role.scope !== 'INTERNAL') {
      throw new ForbiddenException('Ce compte n\'est pas un compte de personnel interne');
    }

    const newRole = await this.prisma.role.findUniqueOrThrow({ where: { id: newRoleId } });
    if (newRole.scope !== 'INTERNAL') {
      throw new ForbiddenException('Le nouveau rôle doit aussi être un rôle interne GymCloud (§2.2)');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { roleId: newRoleId },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, status: true, role: true },
    });

    // Le rôle conditionne les permissions (CASL) — invalider les sessions
    // en cours pour forcer une reconnexion avec les droits à jour.
    await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });

    await this.audit.log({
      userId: actor.userId,
      action: 'internal_user.role_change',
      entityType: 'User',
      entityId: userId,
      metadata: { fromRoleId: targetUser.roleId, toRoleId: newRoleId },
    });

    return updated;
  }

  /**
   * §2.2, §14.x — Cumule un rôle interne SUPPLÉMENTAIRE, en plus du
   * rôle principal (jamais un remplacement) — ex: RESPONSABLE_SUPPORT
   * qui prend AUSSI RESPONSABLE_FINANCE. Exclusivement SUPER_ADMIN,
   * mêmes garde-fous que updateInternalUserRole (rôle interne
   * uniquement, des deux côtés).
   */
  async addAdditionalRole(userId: string, additionalRoleId: string, actor: TenantContext) {
    if (actor.roleCode !== 'SUPER_ADMIN' && actor.roleCode !== 'ADMIN_GYMCLOUD') {
      throw new ForbiddenException('Seul le SUPER_ADMIN ou l\'Administrateur GymCloud peut modifier les rôles du personnel interne (§2.2, §14.x)');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!targetUser) throw new NotFoundException('Utilisateur introuvable');
    if (targetUser.role.scope !== 'INTERNAL') {
      throw new ForbiddenException('Ce compte n\'est pas un compte de personnel interne');
    }
    if (targetUser.roleId === additionalRoleId) {
      throw new BadRequestException('Ce rôle est déjà le rôle principal de cette personne');
    }

    const additionalRole = await this.prisma.role.findUniqueOrThrow({ where: { id: additionalRoleId } });
    if (additionalRole.scope !== 'INTERNAL') {
      throw new ForbiddenException('Le rôle supplémentaire doit aussi être un rôle interne GymCloud (§2.2)');
    }

    await this.prisma.userAdditionalRole.upsert({
      where: { userId_roleId: { userId, roleId: additionalRoleId } },
      update: {},
      create: { id: randomUUID(), userId, roleId: additionalRoleId },
    });

    // Les rôles cumulés conditionnent les permissions (CASL) — invalider
    // les sessions en cours pour forcer une reconnexion avec les droits
    // à jour, même principe que updateInternalUserRole.
    await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });

    await this.audit.log({
      userId: actor.userId,
      action: 'internal_user.additional_role_added',
      entityType: 'User',
      entityId: userId,
      metadata: { additionalRoleId },
    });

    return this.prisma.userAdditionalRole.findMany({ where: { userId }, include: { role: true } });
  }

  async removeAdditionalRole(userId: string, additionalRoleId: string, actor: TenantContext) {
    if (actor.roleCode !== 'SUPER_ADMIN' && actor.roleCode !== 'ADMIN_GYMCLOUD') {
      throw new ForbiddenException('Seul le SUPER_ADMIN ou l\'Administrateur GymCloud peut modifier les rôles du personnel interne (§2.2, §14.x)');
    }

    await this.prisma.userAdditionalRole
      .delete({ where: { userId_roleId: { userId, roleId: additionalRoleId } } })
      .catch(() => null); // déjà retiré — pas une erreur

    await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });

    await this.audit.log({
      userId: actor.userId,
      action: 'internal_user.additional_role_removed',
      entityType: 'User',
      entityId: userId,
      metadata: { additionalRoleId },
    });

    return this.prisma.userAdditionalRole.findMany({ where: { userId }, include: { role: true } });
  }

  /**
   * §2.2, §4.2 — Cycle de vie d'un compte de personnel interne.
   * Exclusivement SUPER_ADMIN — contrairement aux gestionnaires/coachs,
   * aucune vérification d'appartenance à une salle n'est pertinente
   * ici (le personnel interne n'est rattaché à aucune salle).
   */
  private assertCanManageInternalUser(actor: TenantContext) {
    if (actor.roleCode !== 'SUPER_ADMIN' && actor.roleCode !== 'ADMIN_GYMCLOUD') {
      throw new ForbiddenException('Seul le SUPER_ADMIN ou l\'Administrateur GymCloud peut gérer les comptes de personnel interne (§2.2, §14.x)');
    }
  }

  async suspendInternalUser(userId: string, actor: TenantContext) {
    this.assertCanManageInternalUser(actor);
    return this.suspendUser(userId, actor.userId);
  }

  async reactivateInternalUser(userId: string, actor: TenantContext) {
    this.assertCanManageInternalUser(actor);
    return this.reactivateUser(userId, actor.userId);
  }

  async deactivateInternalUser(userId: string, actor: TenantContext) {
    this.assertCanManageInternalUser(actor);
    return this.deactivateUser(userId, actor.userId);
  }
}
