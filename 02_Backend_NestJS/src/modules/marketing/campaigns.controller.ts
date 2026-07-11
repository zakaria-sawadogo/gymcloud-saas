import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MarketingService } from './marketing.service';
import { CreateCampaignDto, SegmentCriteriaDto } from './dto/marketing.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

@ApiTags('Marketing — Campagnes')
@ApiBearerAuth()
@Controller('salles/:salleId/campaigns')
export class CampaignsController {
  constructor(private readonly marketingService: MarketingService) {}

  @Post()
  @RequirePermission('manage', 'MarketingCampaign')
  @ApiOperation({
    summary: 'Créer une campagne — envoyée immédiatement si aucune date planifiée (§10.1)',
  })
  create(
    @Param('salleId') salleId: string,
    @Body() dto: CreateCampaignDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.marketingService.createCampaign(salleId, dto, user.userId);
  }

  @Post('preview-segment')
  @RequirePermission('read', 'MarketingCampaign')
  @ApiOperation({ summary: 'Compter les destinataires ciblés avant envoi' })
  previewSegment(@Param('salleId') salleId: string, @Body() criteria: SegmentCriteriaDto) {
    return this.marketingService.previewSegmentCount(salleId, criteria);
  }

  @Post(':campaignId/send')
  @RequirePermission('manage', 'MarketingCampaign')
  @ApiOperation({ summary: 'Envoyer une campagne planifiée ou restée en brouillon' })
  send(@Param('campaignId') campaignId: string, @CurrentUser() user: TenantContext) {
    return this.marketingService.send(campaignId, user.userId);
  }

  @Get()
  @RequirePermission('read', 'MarketingCampaign')
  @ApiOperation({ summary: 'Historique des campagnes de la salle' })
  list(@Param('salleId') salleId: string) {
    return this.marketingService.listCampaigns(salleId);
  }
}
