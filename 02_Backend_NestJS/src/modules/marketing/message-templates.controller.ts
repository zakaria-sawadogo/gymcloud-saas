import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MarketingService } from './marketing.service';
import { CreateMessageTemplateDto } from './dto/marketing.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('Marketing — Templates')
@ApiBearerAuth()
@RequireModule('marketing')
@Controller('salles/:salleId/message-templates')
export class MessageTemplatesController {
  constructor(private readonly marketingService: MarketingService) {}

  @Post()
  @RequirePermission('manage', 'MarketingCampaign')
  @ApiOperation({ summary: 'Créer un modèle de message réutilisable' })
  create(
    @Param('salleId') salleId: string,
    @Body() dto: CreateMessageTemplateDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.marketingService.createTemplate(salleId, dto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des modèles de la salle' })
  list(@Param('salleId') salleId: string) {
    return this.marketingService.listTemplates(salleId);
  }
}
