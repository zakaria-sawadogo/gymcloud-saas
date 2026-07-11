import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SaasBillingService } from './saas-billing.service';
import { CreateSaasPlanDto, UpdateSaasPlanDto } from './dto/saas-plan.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

/**
 * §9.3 — Gestion des plans SaaS, entièrement réservée au SUPER_ADMIN.
 * `RequirePermission('manage', 'SaasPlan')` n'est accordé qu'au rôle
 * SUPER_ADMIN dans AbilityFactory (voir common/casl/ability.factory.ts).
 */
@ApiTags('SaaS — Plans')
@ApiBearerAuth()
@Controller('saas/plans')
export class SaasPlansController {
  constructor(private readonly saasBillingService: SaasBillingService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des plans SaaS disponibles (§9.3)' })
  list() {
    return this.saasBillingService.listPlans();
  }

  @Post()
  @RequirePermission('manage', 'SaasPlan')
  @ApiOperation({ summary: 'Créer un plan SaaS (SUPER_ADMIN uniquement)' })
  create(@Body() dto: CreateSaasPlanDto, @CurrentUser() user: TenantContext) {
    return this.saasBillingService.createPlan(dto, user.userId);
  }

  @Patch(':id')
  @RequirePermission('manage', 'SaasPlan')
  @ApiOperation({ summary: 'Modifier un plan SaaS — toute modification tarifaire est auditée (§13.22)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSaasPlanDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.saasBillingService.updatePlan(id, dto, user.userId);
  }

  @Patch(':subscriptionId/change-plan/:newPlanId')
  @RequirePermission('manage', 'SaasSubscription')
  @ApiOperation({ summary: 'Changer le plan d\'un propriétaire (§9.12)' })
  changePlan(
    @Param('subscriptionId') subscriptionId: string,
    @Param('newPlanId') newPlanId: string,
    @CurrentUser() user: TenantContext,
  ) {
    return this.saasBillingService.changePlan(subscriptionId, newPlanId, user.userId);
  }
}
