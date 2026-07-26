import { Module } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { AccessControlController } from './access-control.controller';
import { AccessControlSchedulerService } from './access-control.scheduler';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AccessControlController],
  providers: [AccessControlService, AccessControlSchedulerService],
  exports: [AccessControlService],
})
export class AccessControlModule {}
