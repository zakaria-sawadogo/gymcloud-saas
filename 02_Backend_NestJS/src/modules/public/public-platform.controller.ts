import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PublicService } from './public.service';
import { RequestSubscriptionDto } from './dto/public.dto';

/**
 * §3.2, §9.5 — Site vitrine GymCloud (le site principal, pas un site
 * de salle) : liste des plans publics et demande d'abonnement pour
 * quelqu'un qui n'a pas encore de salle du tout. Aucune authentification,
 * aucune fonction d'administration — la demande crée une simple piste
 * (SaasSubscriptionRequest), jamais un compte propriétaire. C'est le
 * SUPER_ADMIN qui traite la demande et crée le compte lui-même.
 */
@ApiTags('Site vitrine — Plateforme')
@Controller('public')
export class PublicPlatformController {
  constructor(private readonly publicService: PublicService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Plans SaaS publics (tarifs, quotas) — pour le sélecteur du site vitrine' })
  getPlans() {
    return this.publicService.getPublicPlans();
  }

  @Post('subscription-requests')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Demande d\'abonnement depuis le site vitrine (§3.2, §9.5) — crée une piste, jamais un compte propriétaire. Le SUPER_ADMIN traite la demande.',
  })
  requestSubscription(@Body() dto: RequestSubscriptionDto) {
    return this.publicService.requestSubscription(dto);
  }
}
