import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MODULE_KEY = 'require_saas_module';

/**
 * §9.2, §9.3 — Marque un controller (ou une route) comme dépendant
 * d'un module SaaS précis. Le plan de la salle doit inclure ce module
 * dans `SaasPlan.modules` pour que l'accès soit autorisé — vérifié par
 * `SubscriptionAccessGuard`.
 *
 * @example
 * @RequireModule('qr_code')
 * @Controller('access-control')
 * export class AccessControlController { ... }
 */
export const RequireModule = (moduleCode: string) => SetMetadata(REQUIRE_MODULE_KEY, moduleCode);
