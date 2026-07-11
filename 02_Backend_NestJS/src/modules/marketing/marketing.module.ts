import { Module } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { CampaignsController } from './campaigns.controller';
import { MessageTemplatesController } from './message-templates.controller';
import { CouponsController } from './coupons.controller';

@Module({
  controllers: [CampaignsController, MessageTemplatesController, CouponsController],
  providers: [MarketingService],
  exports: [MarketingService],
})
export class MarketingModule {}
