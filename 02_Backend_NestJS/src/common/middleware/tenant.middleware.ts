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

  // Chemins publics. Comparés à req.originalUrl (voir isPublicPath) —
  // PAS req.path, qui s'est révélé toujours égal à "/" dans ce
  // contexte précis (middleware global + préfixe NestJS), un piège
  // découvert en production (§ voir historique du 16/07/2026).
  private readonly PUBLIC_PATHS = [
    '/auth/login',
    '/auth/refresh',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/payments/mobile-money/webhook',
  ];

  // Namespace entier public — site public par salle (§3.2) : recherche
  // d'une salle par sous-domaine, consultation des activités,
  // captation de prospects (inscription / essai gratuit). Jamais de
  // fonction d'administration sous ce préfixe.
  private readonly PUBLIC_PATH_PREFIXES = ['/public/'];

  private isPublicPath(req: Request): boolean {
    // req.path ne reflète pas fiablement le chemin réel dans ce
    // contexte (middleware appliqué globalement avec préfixe NestJS —
    // observé à "/" en toutes circonstances lors du diagnostic en
    // production, malgré une requête réelle vers un autre chemin).
    // req.originalUrl, lui, contient toujours le chemin complet tel
    // que reçu — on retire juste une éventuelle query string.
    const path = req.originalUrl.split('?')[0];
    if (this.PUBLIC_PATHS.some((p) => path === p || path.endsWith(p))) return true;
    return this.PUBLIC_PATH_PREFIXES.some((prefix) => path.includes(prefix));
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
