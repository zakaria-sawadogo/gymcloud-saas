import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  roleCode: string;
  salleId: string | null;
  proprietaireId: string | null;
}

/**
 * Service d'authentification.
 *
 * Couvre §4.7 (Authentification), §4.8 (Changement de mot de passe),
 * §4.9 (Réinitialisation), §4.10 (Historique des connexions) et
 * §13.3/§13.4/§13.6 (politique de sécurité).
 *
 * Le salleId inclus dans le JWT reflète l'affectation de l'utilisateur
 * (§2.3) : null pour SUPER_ADMIN et rôles internes à accès global,
 * fixe pour GESTIONNAIRE/COACH/ADHERENT (une seule salle en V1).
 */
@Injectable()
export class AuthService {
  private readonly BCRYPT_ROUNDS = 12;
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly PASSWORD_RESET_OTP_VALIDITY_MINUTES = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(phone: string, password: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: {
        role: true,
        proprietaireProfile: true,
        gestionnaireProfile: true,
        coachProfile: true,
        adherentProfile: true,
      },
    });

    const success = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    // Historique de connexion tracé même en cas d'échec (§4.10)
    if (user) {
      await this.prisma.loginHistory.create({
        data: { userId: user.id, success, ipAddress },
      });
    }

    if (!user || !success) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (user.status !== 'ACTIF') {
      throw new UnauthorizedException(`Compte ${user.status.toLowerCase()}`);
    }

    const salleId =
      user.gestionnaireProfile?.salleId ??
      user.coachProfile?.salleId ??
      user.adherentProfile?.salleId ??
      null;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(user.id, user.role.code, salleId, user.proprietaireProfile?.id ?? null);
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide');
    }

    const tokenHash = await bcrypt.hash(refreshToken, 4); // hash léger pour lookup
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, revoked: false, expiresAt: { gt: new Date() } },
    });
    if (!stored) {
      throw new UnauthorizedException('Session expirée, veuillez vous reconnecter');
    }

    return this.issueTokens(payload.sub, payload.roleCode, payload.salleId, payload.proprietaireId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Mot de passe actuel incorrect');

    const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date() },
    });

    // Invalide toutes les sessions actives par sécurité
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  }

  /**
   * Émission d'un code OTP de réinitialisation (§4.9). L'envoi effectif
   * (SMS/WhatsApp) est délégué au module Notifications — non implémenté
   * à ce stade du développement, d'où l'exposition temporaire du code
   * en clair (devOtpCode), à retirer une fois une passerelle SMS réelle
   * branchée — même convention que le reste du projet (Mobile Money).
   */
  async requestPasswordReset(phone: string): Promise<{ message: string; devOtpCode?: string }> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    // Réponse identique que l'utilisateur existe ou non (anti-énumération)
    if (!user) {
      return { message: 'Si ce numéro existe, un code a été envoyé.' };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + this.PASSWORD_RESET_OTP_VALIDITY_MINUTES * 60 * 1000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetOtpCode: otp, passwordResetOtpExpiresAt: expiresAt },
    });

    return { message: 'Si ce numéro existe, un code a été envoyé.', devOtpCode: otp };
  }

  /**
   * Confirmation de la réinitialisation (§4.9) : vérifie le code OTP
   * émis par requestPasswordReset, applique le nouveau mot de passe,
   * et invalide toutes les sessions actives par sécurité — même
   * comportement qu'un changement de mot de passe classique.
   */
  async confirmPasswordReset(phone: string, otpCode: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || !user.passwordResetOtpCode || !user.passwordResetOtpExpiresAt) {
      throw new BadRequestException('Code invalide ou expiré');
    }
    if (user.passwordResetOtpExpiresAt < new Date()) {
      throw new BadRequestException('Code invalide ou expiré');
    }
    if (user.passwordResetOtpCode !== otpCode) {
      throw new BadRequestException('Code invalide ou expiré');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        passwordResetOtpCode: null,
        passwordResetOtpExpiresAt: null,
      },
    });
    await this.prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revoked: true } });

    return { message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' };
  }

  /**
   * Profil de l'utilisateur connecté — consommé par le frontend juste
   * après le login pour connaître son rôle, sa salle et ses
   * informations d'affichage (le JWT ne contient volontairement que
   * le strict nécessaire à l'autorisation, pas le profil complet).
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        role: true,
        proprietaireProfile: true,
        gestionnaireProfile: { include: { salle: true } },
        coachProfile: { include: { salle: true } },
        adherentProfile: { include: { salle: true } },
      },
    });

    const salle =
      user.gestionnaireProfile?.salle ?? user.coachProfile?.salle ?? user.adherentProfile?.salle ?? null;

    return {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      email: user.email,
      roleCode: user.role.code,
      proprietaireId: user.proprietaireProfile?.id ?? null,
      adherentId: user.adherentProfile?.id ?? null,
      coachId: user.coachProfile?.id ?? null,
      gestionnaireId: user.gestionnaireProfile?.id ?? null,
      salle: salle ? { id: salle.id, name: salle.name, logoUrl: salle.logoUrl } : null,
    };
  }

  private async issueTokens(
    userId: string,
    roleCode: string,
    salleId: string | null,
    proprietaireId: string | null,
  ) {
    const payload: JwtPayload = { sub: userId, roleCode, salleId, proprietaireId };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
    });

    const tokenHash = await bcrypt.hash(refreshToken, 4);
    await this.prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }
}
