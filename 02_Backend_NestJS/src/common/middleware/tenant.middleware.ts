import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface TenantContext {
  userId: string;
  roleCode: string;
  salleId: string | null;
  proprietaireId: string | null; // renseigné uniquement pour le rôle PROPRIETAIRE
  isGlobalAccess: boolean;
}

export interface AuthenticatedRequest extends Request {
  tenant?: TenantContext;
}

/**
 * Middleware central de l'isolation multi-tenant (§13.8 du cahier des
 * charges).
 *
 * Rôle :
 *  1. Décode le JWT et en extrait roleCode + salleId.
 *  2. Détermine si l'utilisateur a un accès global (SUPER_ADMIN et
 *     rôles internes GymCloud habilités) ou restreint à une salle
 *     (GESTIONNAIRE, COACH, ADHERENT).
 *  3. Attache ce contexte à la requête (`req.tenant`), consommé ensuite
 *     par les services métier pour filtrer chaque requête Prisma.
 *  4. Définit les variables de session PostgreSQL pour les policies RLS
 *     — double verrou d'isolation (voir rls_policies.sql).
 *
 * Les routes publiques (login, health-check) sont exclues via
 * `MiddlewareConsumer.exclude()` dans AppModule ET, en filet de
 * sécurité, vérifiées directement ci-dessous (`PUBLIC_PATHS`) — le
 * mécanisme `.exclude()` combiné à `.forRoutes('*')` s'est révélé peu
 * fiable en pratique selon la version de NestJS/l'adaptateur HTTP, ne
 * pas s'y fier comme unique garde-fou.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private readonly GLOBAL_ACCESS_ROLES = new Set([
    'SUPER_ADMIN',
    'ADMIN_GYMCLOUD',
    'RESPONSABLE_SUPPORT',
    'RESPONSABLE_FINANCE',
    'RESPONSABLE_COMMERCIAL',
    'RESPONSABLE_MARKETING',
    'SUPERVISEUR_PAYS',
  ]);

  // Chemins publics, vérifiés sur req.path (sans le préfixe global
  // api/v1, déjà retiré par Express au moment où le middleware s'exécute).
  private readonly PUBLIC_PATHS = [
    '/auth/login',
    '/auth/refresh',
    '/auth/forgot-password',
    '/payments/mobile-money/webhook',
  ];

  private isPublicPath(req: Request): boolean {
    return this.PUBLIC_PATHS.some((p) => req.path === p || req.path.endsWith(p));
  }

  async use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (this.isPublicPath(req)) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token manquant');
    }

    try {
      const token = authHeader.slice('Bearer '.length);
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });

      const isGlobalAccess = this.GLOBAL_ACCESS_ROLES.has(payload.roleCode);
      const salleId: string | null = isGlobalAccess ? null : (payload.salleId ?? null);

      req.tenant = {
        userId: payload.sub,
        roleCode: payload.roleCode,
        salleId,
        proprietaireId: payload.proprietaireId ?? null,
        isGlobalAccess,
      };

      // Injection du contexte dans la session PostgreSQL pour les policies RLS
      await this.prisma.setTenantContext(salleId, isGlobalAccess);

      next();
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }
}
