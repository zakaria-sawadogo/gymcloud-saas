import { Module } from '@nestjs/common';
import { SaasBillingService } from './saas-billing.service';
import { SaasPlansController } from './saas-plans.controller';
import { SaasInvoicesController } from './saas-invoices.controller';
import { SaasBillingSchedulerService } from './saas-billing.scheduler';
import { InvoicePdfService } from './invoice-pdf.service';

@Module({
  controllers: [SaasPlansController, SaasInvoicesController],
  providers: [SaasBillingService, SaasBillingSchedulerService, InvoicePdfService],
  exports: [SaasBillingService], // consommé par SallesModule
})
export class SaasBillingModule {}
