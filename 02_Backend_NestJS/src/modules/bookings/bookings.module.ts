import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CoursCollectifsController } from './cours-collectifs.controller';
import { BookingsController } from './bookings.controller';
import { CoachAvailabilityController } from './coach-availability.controller';

@Module({
  controllers: [CoursCollectifsController, BookingsController, CoachAvailabilityController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
