import { SetMetadata, Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilityFactory, AppAbility, Actions, Subjects } from './ability.factory';
import { AuthenticatedRequest } from '../middleware/tenant.middleware';

export type PolicyHandler = (ability: AppAbility) => boolean;

export const CHECK_POLICIES_KEY = 'check_policies';

/**
 * Décore une route avec une ou plusieurs conditions de permission.
 *
 * @example
 * @CheckPolicies((ability) => ability.can('manage', 'Adherent'))
 * @Post('adherents')
 * create() { ... }
 */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);

/**
 * Raccourci pour le cas courant "peut faire X sur Y".
 *
 * @example
 * @RequirePermission('manage', 'Adherent')
 */
export const RequirePermission = (action: Actions, subject: Subjects) =>
  CheckPolicies((ability) => ability.can(action, subject));

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handlers =
      this.reflector.get<PolicyHandler[]>(CHECK_POLICIES_KEY, context.getHandler()) ?? [];

    if (handlers.length === 0) return true; // route sans contrainte explicite

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.tenant) return false;

    const ability = await this.abilityFactory.createForUser(request.tenant);
    return handlers.every((handler) => handler(ability));
  }
}
