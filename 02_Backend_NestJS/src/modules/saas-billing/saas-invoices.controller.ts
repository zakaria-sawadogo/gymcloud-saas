import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SaasBillingService } from './saas-billing.service';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

/**
 * §9.13 — Facturation SaaS (GymCloud facture ses propriétaires),
 * distincte du module Paiements (adhérent → salle). Réservée au
 * SUPER_ADMIN : c'est lui qui constate le règlement d'une facture
 * (virement bancaire habituellement, à ce niveau B2B) et la marque
 * payée.
 */
@ApiTags('SaaS — Facturation')
@ApiBearerAuth()
@Controller('saas/invoices')
export class SaasInvoicesController {
  constructor(private readonly saasBillingService: SaasBillingService) {}

  @Get()
  @RequirePermission('read', 'SaasPlan')
  @ApiOperation({ summary: 'Liste des factures SaaS, filtrable par statut' })
  list(@Query('status') status?: 'EMISE' | 'PAYEE' | 'EN_RETARD' | 'ANNULEE') {
    return this.saasBillingService.listInvoices(status);
  }

  @Patch(':id/mark-paid')
  @RequirePermission('manage', 'SaasPlan')
  @ApiOperation({ summary: 'Marquer une facture SaaS comme payée (règlement constaté hors plateforme)' })
  markPaid(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    return this.saasBillingService.markInvoicePaid(id, user.userId);
  }
}
