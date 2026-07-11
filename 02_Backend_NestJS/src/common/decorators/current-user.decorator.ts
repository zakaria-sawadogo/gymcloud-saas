import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest, TenantContext } from '../middleware/tenant.middleware';

export type { TenantContext };

/**
 * Injecte l'utilisateur courant (extrait du JWT par TenantMiddleware)
 * dans un paramètre de contrôleur.
 *
 * @example
 * findAll(@CurrentUser() user: TenantContext) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.tenant;
  },
);

/**
 * Injecte directement le salleId courant. Lève une erreur explicite si
 * appelé depuis un contexte à accès global (SUPER_ADMIN) où salleId
 * peut être null — force le développeur à gérer ce cas explicitement.
 *
 * @example
 * findAdherents(@CurrentSalle() salleId: string) { ... }
 */
export const CurrentSalle = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.tenant?.salleId ?? null;
  },
);
