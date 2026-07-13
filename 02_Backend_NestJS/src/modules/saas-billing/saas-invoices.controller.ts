import { Body, Controller, Get, Param, Patch, Post, Query, Res, ForbiddenException } from '@nestjs/common';
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

export class InitiateMobileMoneyDto {
  @ApiProperty({ enum: ['ORANGE_MONEY', 'MOOV_MONEY', 'WAVE'] })
  @IsIn(['ORANGE_MONEY', 'MOOV_MONEY', 'WAVE'])
  method!: 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE';

  @ApiProperty()
  @IsString()
  phoneNumber!: string;
}

export class ConfirmOtpDto {
  @ApiProperty({ description: 'Code à 6 chiffres reçu par SMS' })
  @IsString()
  otpCode!: string;
}

/**
 * §9.13 — Facturation SaaS (GymCloud facture ses propriétaires),
 * distincte du module Paiements (adhérent → salle). L'encaissement
 * manuel (`mark-paid`) reste réservé au SUPER_ADMIN/RESPONSABLE_FINANCE ;
 * le paiement self-service Mobile Money (§9.8) est ouvert au
 * PROPRIETAIRE sur ses propres factures uniquement.
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

  @Get('me/subscription')
  @RequirePermission('read', 'SaasSubscription')
  @ApiOperation({ summary: 'Ma souscription SaaS (PROPRIETAIRE) — plan actuel, statut, échéance' })
  mySubscription(@CurrentUser() user: TenantContext) {
    if (!user.proprietaireId) {
      throw new ForbiddenException('Cet endpoint est réservé aux comptes Propriétaire');
    }
    return this.saasBillingService.getMySubscription(user.proprietaireId);
  }

  @Get('me/invoices')
  @RequirePermission('read', 'SaasSubscription')
  @ApiOperation({ summary: 'Mes factures SaaS (PROPRIETAIRE)' })
  myInvoices(@CurrentUser() user: TenantContext) {
    if (!user.proprietaireId) {
      throw new ForbiddenException('Cet endpoint est réservé aux comptes Propriétaire');
    }
    return this.saasBillingService.listInvoicesForProprietaire(user.proprietaireId);
  }

  @Get(':id/pdf')
  @RequirePermission('read', 'SaasSubscription')
  @ApiOperation({
    summary:
      'Télécharger la facture au format PDF (§9.13) — SUPER_ADMIN sur n\'importe laquelle, PROPRIETAIRE uniquement sur les siennes',
  })
  async downloadPdf(@Param('id') id: string, @CurrentUser() user: TenantContext, @Res() res: Response) {
    const pdfBuffer = await this.invoicePdfService.generatePdf(id, user);
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

  @Post(':id/pay/mobile-money/initiate')
  @RequirePermission('update', 'SaasSubscription')
  @ApiOperation({
    summary: 'Initier le règlement d\'une facture SaaS par Mobile Money (§9.8) — envoie un code de confirmation',
  })
  initiateMobileMoney(
    @Param('id') id: string,
    @Body() dto: InitiateMobileMoneyDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.saasBillingService.initiateMobileMoneyPayment(id, user, dto);
  }

  @Post(':id/pay/mobile-money/confirm')
  @RequirePermission('update', 'SaasSubscription')
  @ApiOperation({ summary: 'Confirmer le règlement Mobile Money avec le code reçu (§9.8)' })
  confirmMobileMoney(
    @Param('id') id: string,
    @Body() dto: ConfirmOtpDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.saasBillingService.confirmMobileMoneyOtp(id, user, dto.otpCode);
  }
}
