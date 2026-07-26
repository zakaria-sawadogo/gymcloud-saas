import { Module } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { CampaignsController } from './campaigns.controller';
import { MessageTemplatesController } from './message-templates.controller';
import { CouponsController } from './coupons.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [CampaignsController, MessageTemplatesController, CouponsController],
  providers: [MarketingService],
  exports: [MarketingService],
})
export class MarketingModule {}
