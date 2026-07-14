import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProspectsService } from './prospects.service';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

/**
 * §3.2 — Suivi commercial des prospects captés par le site public
 * d'une salle (inscription en ligne, demande d'essai gratuit).
 */
@ApiTags('Prospects')
@ApiBearerAuth()
@Controller('prospects')
export class ProspectsController {
  constructor(private readonly prospectsService: ProspectsService) {}

  @Get('salle/:salleId')
  @RequirePermission('read', 'Prospect')
  @ApiOperation({ summary: 'Prospects d\'une salle, filtrable par statut (§3.2)' })
  listBySalle(
    @Param('salleId') salleId: string,
    @CurrentUser() user: TenantContext,
    @Query('status') status?: string,
  ) {
    return this.prospectsService.listBySalle(salleId, user, status);
  }

  @Patch(':id/contacted')
  @RequirePermission('manage', 'Prospect')
  @ApiOperation({ summary: 'Marquer un prospect comme contacté' })
  markContacted(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    return this.prospectsService.markContacted(id, user);
  }

  @Patch(':id/converted')
  @RequirePermission('manage', 'Prospect')
  @ApiOperation({
    summary: 'Marquer un prospect comme converti — après avoir créé l\'adhérent via le parcours guichet habituel',
  })
  markConverted(@Param('id') id: string, @Body('note') note: string | undefined, @CurrentUser() user: TenantContext) {
    return this.prospectsService.markConverted(id, user, note);
  }

  @Patch(':id/lost')
  @RequirePermission('manage', 'Prospect')
  @ApiOperation({ summary: 'Marquer un prospect comme perdu — motif obligatoire' })
  markLost(@Param('id') id: string, @Body('note') note: string | undefined, @CurrentUser() user: TenantContext) {
    return this.prospectsService.markLost(id, user, note);
  }
}
