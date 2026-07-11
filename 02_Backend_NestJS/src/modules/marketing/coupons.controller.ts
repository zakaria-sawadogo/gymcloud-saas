import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MarketingService } from './marketing.service';
import { CreateCouponDto } from './dto/marketing.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

@ApiTags('Marketing — Coupons')
@ApiBearerAuth()
@Controller('salles/:salleId/coupons')
export class CouponsController {
  constructor(private readonly marketingService: MarketingService) {}

  @Post()
  @RequirePermission('manage', 'MarketingCampaign')
  @ApiOperation({ summary: 'Créer un coupon de réduction' })
  create(
    @Param('salleId') salleId: string,
    @Body() dto: CreateCouponDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.marketingService.createCoupon(salleId, dto, user.userId);
  }

  @Get(':code/validate')
  @RequirePermission('read', 'MarketingCampaign')
  @ApiOperation({ summary: 'Valider un coupon avant application à un paiement' })
  validate(@Param('salleId') salleId: string, @Param('code') code: string) {
    return this.marketingService.validateCoupon(salleId, code);
  }

  @Get()
  @RequirePermission('read', 'MarketingCampaign')
  @ApiOperation({ summary: 'Liste des coupons de la salle' })
  list(@Param('salleId') salleId: string) {
    return this.marketingService.listCoupons(salleId);
  }
}
