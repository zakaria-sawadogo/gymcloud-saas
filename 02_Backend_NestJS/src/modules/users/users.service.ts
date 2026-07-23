import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { TenantContext } from '../../common/decorators/current-user.decorator';
import { SallesService } from '../salles/salles.service';
import { StorageService } from '../../common/storage/storage.service';
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
  async createProprietaire(dto: CreateProprietaireDto, actor: TenantContext) {
    if (actor.roleCode !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Seul le SUPER_ADMIN peut créer un propriétaire (§2.8)');
    }

    const { user, tempPassword } = await this.createBaseUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email,
      roleCode: 'PROPRIETAIRE',
    });

    const proprietaire = await this.prisma.proprietaire.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        companyName: dto.companyName,
        address: dto.address,
        countryId: dto.countryId,
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
      // Retour arrière : pas de propriétaire orphelin sans salle (§2.4)
      await this.prisma.proprietaire.delete({ where: { id: proprietaire.id } });
      await this.prisma.user.delete({ where: { id: user.id } });
      throw error;
    }

    await this.audit.log({
      userId: actor.userId,
      action: 'proprietaire.create',
      entityType: 'Proprietaire',
      entityId: proprietaire.id,
      metadata: { salleId: salle.id },
    });

    // TODO(module notifications): envoyer tempPassword par SMS/WhatsApp,
    // jamais par retour d'API en production — exposé ici uniquement
    // pour faciliter les tests durant le développement.
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
    if (actor.roleCode !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Seul le SUPER_ADMIN peut créer un compte de personnel interne (§2.2)');
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

    // TODO(module notifications): envoyer tempPassword par SMS/WhatsApp.
    return { user, tempPassword };
  }

  /** Liste tous les comptes internes GymCloud (tous rôles à portée INTERNAL confondus). */
  async listInternalUsers() {
    return this.prisma.user.findMany({
      where: { role: { scope: 'INTERNAL' } },
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
    if (actor.roleCode !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Seul le SUPER_ADMIN peut modifier le rôle du personnel interne (§2.2)');
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
   * §2.2, §4.2 — Cycle de vie d'un compte de personnel interne.
   * Exclusivement SUPER_ADMIN — contrairement aux gestionnaires/coachs,
   * aucune vérification d'appartenance à une salle n'est pertinente
   * ici (le personnel interne n'est rattaché à aucune salle).
   */
  private assertCanManageInternalUser(actor: TenantContext) {
    if (actor.roleCode !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Seul le SUPER_ADMIN peut gérer les comptes de personnel interne (§2.2)');
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
