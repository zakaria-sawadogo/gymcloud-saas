import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { SetCoachAvailabilityDto } from './dto/bookings.dto';
import { RequirePermission } from '../../common/casl/policies.guard';

@ApiTags('Réservations — Disponibilités coach')
@ApiBearerAuth()
@Controller('coachs/:coachId/availability')
export class CoachAvailabilityController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @RequirePermission('manage', 'Booking')
  @ApiOperation({ summary: 'Déclarer un créneau de disponibilité récurrent (§7.6)' })
  set(@Param('coachId') coachId: string, @Body() dto: SetCoachAvailabilityDto) {
    return this.bookingsService.setCoachAvailability(coachId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des créneaux de disponibilité du coach' })
  list(@Param('coachId') coachId: string) {
    return this.bookingsService.listCoachAvailability(coachId);
  }
}
