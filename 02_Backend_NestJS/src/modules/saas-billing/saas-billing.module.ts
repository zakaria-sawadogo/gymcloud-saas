import { Module, forwardRef } from '@nestjs/common';
import { SaasBillingService } from './saas-billing.service';
import { SaasPlansController } from './saas-plans.controller';
import { SaasInvoicesController } from './saas-invoices.controller';
import { SaasBillingSchedulerService } from './saas-billing.scheduler';
import { InvoicePdfService } from './invoice-pdf.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { SallesModule } from '../salles/salles.module';

@Module({
  imports: [NotificationsModule, WhatsAppModule, forwardRef(() => SallesModule)],
  controllers: [SaasPlansController, SaasInvoicesController],
  providers: [SaasBillingService, SaasBillingSchedulerService, InvoicePdfService],
  exports: [SaasBillingService], // consommé par SallesModule
})
export class SaasBillingModule {}
