import { Module } from '@nestjs/common';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';
import { FinancesSchedulerService } from './finances.scheduler';
import { StorageModule } from '../../common/storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [StorageModule, NotificationsModule],
  controllers: [FinancesController],
  providers: [FinancesService, FinancesSchedulerService],
})
export class FinancesModule {}
