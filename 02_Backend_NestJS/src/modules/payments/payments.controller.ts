import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { PaymentReceiptPdfService } from './payment-receipt-pdf.service';
import {
  CreateCashPaymentDto,
  InitiateMobileMoneyDto,
  ConfirmMobileMoneyDto,
  RefundPaymentDto,
} from './dto/payments.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('Paiements')
@ApiBearerAuth()
@RequireModule('paiements')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly receiptPdfService: PaymentReceiptPdfService,
  ) {}

  @Post('cash')
  @RequirePermission('manage', 'Payment')
  @ApiOperation({ summary: 'Encaisser un paiement en espèces — validation immédiate (§8.3)' })
  cash(@Body() dto: CreateCashPaymentDto, @CurrentUser() user: TenantContext) {
    return this.paymentsService.recordCashPayment(dto, user.userId);
  }

  @Post('mobile-money/initiate')
  @RequirePermission('manage', 'Payment')
  @ApiOperation({ summary: 'Initier un paiement Mobile Money (Orange/Moov/Wave — §8.3)' })
  initiateMobileMoney(@Body() dto: InitiateMobileMoneyDto, @CurrentUser() user: TenantContext) {
    return this.paymentsService.initiateMobileMoney(dto, user.userId);
  }

  @Post('mobile-money/webhook')
  @ApiOperation({
    summary:
      'Webhook de confirmation opérateur — non protégé par JWT, sécurisé par signature (TODO intégration réelle)',
  })
  confirmMobileMoney(@Body() dto: ConfirmMobileMoneyDto) {
    return this.paymentsService.confirmMobileMoney(dto);
  }

  @Patch(':id/refund')
  @RequirePermission('manage', 'Payment')
  @ApiOperation({ summary: 'Rembourser un paiement validé' })
  refund(
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.paymentsService.refund(id, user.userId, dto.reason);
  }

  @Get('salle/:salleId')
  @RequirePermission('read', 'Payment')
  @ApiOperation({ summary: 'Historique des paiements d\'une salle' })
  bySalle(
    @Param('salleId') salleId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.paymentsService.listBySalle(
      salleId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('salle/:salleId/caisse')
  @RequirePermission('read', 'Payment')
  @ApiOperation({ summary: 'Synthèse de caisse journalière, par moyen de paiement' })
  caisse(@Param('salleId') salleId: string, @Query('date') date?: string) {
    return this.paymentsService.dailyCashRegisterSummary(
      salleId,
      date ? new Date(date) : new Date(),
    );
  }

  @Get('adherent/:adherentId')
  @RequirePermission('read', 'Payment')
  @ApiOperation({ summary: 'Historique des paiements d\'un adhérent' })
  byAdherent(@Param('adherentId') adherentId: string) {
    return this.paymentsService.listByAdherent(adherentId);
  }

  @Get(':id/receipt')
  @RequirePermission('read', 'Payment')
  @ApiOperation({ summary: 'Télécharger le reçu de paiement au format PDF' })
  async downloadReceipt(@Param('id') id: string, @CurrentUser() user: TenantContext, @Res() res: Response) {
    const pdfBuffer = await this.receiptPdfService.generateReceipt(id, user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recu-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }
}
