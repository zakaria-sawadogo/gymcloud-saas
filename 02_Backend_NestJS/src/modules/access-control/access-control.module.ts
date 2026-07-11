import { Module } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { AccessControlController } from './access-control.controller';
import { AccessControlSchedulerService } from './access-control.scheduler';

@Module({
  controllers: [AccessControlController],
  providers: [AccessControlService, AccessControlSchedulerService],
  exports: [AccessControlService],
})
export class AccessControlModule {}
