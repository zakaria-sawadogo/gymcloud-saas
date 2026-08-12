import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { NotificationsModule } from '../../modules/notifications/notifications.module';

@Global()
@Module({
  imports: [NotificationsModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
