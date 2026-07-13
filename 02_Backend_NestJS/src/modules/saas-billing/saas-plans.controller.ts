import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
  @ApiOperation({
    summary: 'Liste des plans SaaS — ACTIF uniquement par défaut, ?includeAll=true pour la gestion SUPER_ADMIN',
  })
  list(@Query('includeAll') includeAll?: string) {
    return this.saasBillingService.listPlans(includeAll === 'true');
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

  @Patch(':id/activate')
  @RequirePermission('manage', 'SaasPlan')
  @ApiOperation({ summary: 'Activer un plan (§9.3) — de nouveau proposable à la souscription' })
  activate(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    return this.saasBillingService.setPlanStatus(id, 'ACTIF', user.userId);
  }

  @Patch(':id/suspend')
  @RequirePermission('manage', 'SaasPlan')
  @ApiOperation({
    summary: 'Suspendre un plan (§9.3) — plus proposable aux nouveaux clients, souscriptions existantes non affectées',
  })
  suspend(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    return this.saasBillingService.setPlanStatus(id, 'SUSPENDU', user.userId);
  }

  @Patch(':id/archive')
  @RequirePermission('manage', 'SaasPlan')
  @ApiOperation({ summary: 'Archiver un plan (§9.3) — retrait définitif du catalogue' })
  archive(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    return this.saasBillingService.setPlanStatus(id, 'ARCHIVE', user.userId);
  }

  @Patch(':subscriptionId/change-plan/:newPlanId')
  @RequirePermission('update', 'SaasSubscription')
  @ApiOperation({
    summary:
      'Changer/renouveler le plan d\'une souscription (§9.12) — SUPER_ADMIN sur n\'importe laquelle, PROPRIETAIRE uniquement sur la sienne',
  })
  changePlan(
    @Param('subscriptionId') subscriptionId: string,
    @Param('newPlanId') newPlanId: string,
    @CurrentUser() user: TenantContext,
  ) {
    return this.saasBillingService.changePlan(subscriptionId, newPlanId, user.userId, user);
  }
}
