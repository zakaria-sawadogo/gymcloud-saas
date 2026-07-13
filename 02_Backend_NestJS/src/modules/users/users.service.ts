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
      include: { user: true },
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
      include: { user: true, availabilities: true },
    });
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
      include: { role: true, country: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
