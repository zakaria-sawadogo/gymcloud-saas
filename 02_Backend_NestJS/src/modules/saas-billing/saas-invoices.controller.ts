import { Body, Controller, Get, Param, Patch, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SaasBillingService } from './saas-billing.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

export class MarkInvoicePaidDto {
  @ApiProperty({ enum: ['VIREMENT', 'ESPECES', 'MOBILE_MONEY', 'CHEQUE'] })
  @IsIn(['VIREMENT', 'ESPECES', 'MOBILE_MONEY', 'CHEQUE'])
  paymentMethod!: string;

  @ApiPropertyOptional({ description: 'Référence bancaire, n° de transaction...' })
  @IsOptional()
  @IsString()
  paymentReference?: string;
}

/**
 * §9.13 — Facturation SaaS (GymCloud facture ses propriétaires),
 * distincte du module Paiements (adhérent → salle). Réservée au
 * SUPER_ADMIN et au RESPONSABLE_FINANCE : c'est eux qui constatent le
 * règlement d'une facture et la marquent payée, avec la méthode et la
 * référence pour traçabilité comptable.
 */
@ApiTags('SaaS — Facturation')
@ApiBearerAuth()
@Controller('saas/invoices')
export class SaasInvoicesController {
  constructor(
    private readonly saasBillingService: SaasBillingService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  @Get()
  @RequirePermission('read', 'SaasPlan')
  @ApiOperation({ summary: 'Liste des factures SaaS, filtrable par statut' })
  list(@Query('status') status?: 'EMISE' | 'PAYEE' | 'EN_RETARD' | 'ANNULEE') {
    return this.saasBillingService.listInvoices(status);
  }

  @Get(':id/pdf')
  @RequirePermission('read', 'SaasPlan')
  @ApiOperation({ summary: 'Télécharger la facture au format PDF (§9.13)' })
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.invoicePdfService.generatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="facture-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }

  @Patch(':id/mark-paid')
  @RequirePermission('manage', 'SaasPlan')
  @ApiOperation({ summary: 'Encaisser une facture SaaS — méthode et référence de paiement requises' })
  markPaid(
    @Param('id') id: string,
    @Body() dto: MarkInvoicePaidDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.saasBillingService.markInvoicePaid(id, user.userId, dto);
  }
}
