import { Module } from '@nestjs/common';
import { SubscriptionRequestsController } from './subscription-requests.controller';
import { SubscriptionRequestsService } from './subscription-requests.service';

@Module({
  controllers: [SubscriptionRequestsController],
  providers: [SubscriptionRequestsService],
})
export class SubscriptionRequestsModule {}
