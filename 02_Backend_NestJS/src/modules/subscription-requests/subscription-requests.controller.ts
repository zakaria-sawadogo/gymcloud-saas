import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionRequestsService } from './subscription-requests.service';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

/**
 * §3.2, §9.5 — Traitement des demandes d'abonnement captées depuis le
 * site vitrine GymCloud (SUPER_ADMIN, RESPONSABLE_COMMERCIAL).
 */
@ApiTags('Demandes d\'abonnement')
@ApiBearerAuth()
@Controller('subscription-requests')
export class SubscriptionRequestsController {
  constructor(private readonly service: SubscriptionRequestsService) {}

  @Get()
  @RequirePermission('read', 'SaasSubscriptionRequest')
  @ApiOperation({ summary: 'Liste des demandes d\'abonnement, filtrable par statut (§3.2, §9.5)' })
  list(@Query('status') status?: string) {
    return this.service.list(status);
  }

  @Patch(':id/contacted')
  @RequirePermission('manage', 'SaasSubscriptionRequest')
  @ApiOperation({ summary: 'Marquer une demande comme contactée' })
  markContacted(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    return this.service.markContacted(id, user.userId);
  }

  @Patch(':id/converted')
  @RequirePermission('manage', 'SaasSubscriptionRequest')
  @ApiOperation({
    summary: 'Marquer une demande comme convertie — après avoir créé le compte propriétaire via le parcours habituel',
  })
  markConverted(@Param('id') id: string, @Body('note') note: string | undefined, @CurrentUser() user: TenantContext) {
    return this.service.markConverted(id, user.userId, note);
  }

  @Patch(':id/rejected')
  @RequirePermission('manage', 'SaasSubscriptionRequest')
  @ApiOperation({ summary: 'Rejeter une demande — motif obligatoire' })
  markRejected(@Param('id') id: string, @Body('note') note: string | undefined, @CurrentUser() user: TenantContext) {
    return this.service.markRejected(id, user.userId, note);
  }
}
