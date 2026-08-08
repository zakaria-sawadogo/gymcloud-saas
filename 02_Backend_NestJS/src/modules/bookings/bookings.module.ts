import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CoursCollectifsController } from './cours-collectifs.controller';
import { BookingsController } from './bookings.controller';
import { CoachAvailabilityController } from './coach-availability.controller';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PaymentsModule, NotificationsModule],
  controllers: [CoursCollectifsController, BookingsController, CoachAvailabilityController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
