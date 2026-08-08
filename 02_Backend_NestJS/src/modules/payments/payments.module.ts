import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentReceiptPdfService } from './payment-receipt-pdf.service';
import { MarketingModule } from '../marketing/marketing.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [MarketingModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentReceiptPdfService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
