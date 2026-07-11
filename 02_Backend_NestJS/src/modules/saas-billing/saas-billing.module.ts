import { Module } from '@nestjs/common';
import { SaasBillingService } from './saas-billing.service';
import { SaasPlansController } from './saas-plans.controller';
import { SaasInvoicesController } from './saas-invoices.controller';

@Module({
  controllers: [SaasPlansController, SaasInvoicesController],
  providers: [SaasBillingService],
  exports: [SaasBillingService], // consommé par SallesModule
})
export class SaasBillingModule {}
