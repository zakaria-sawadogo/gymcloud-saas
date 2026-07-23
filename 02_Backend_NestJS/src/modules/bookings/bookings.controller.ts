import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import {
  BookCoursCollectifDto,
  BookSeanceIndividuelleDto,
  CancelBookingDto,
  PaySeanceDto,
} from './dto/bookings.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { RestrictedInDegradedMode } from '../../common/decorators/restricted-in-degraded-mode.decorator';

@ApiTags('Réservations')
@ApiBearerAuth()
@RequireModule('reservations')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('cours-collectifs/:coursId')
  @RequirePermission('create', 'Booking')
  @RestrictedInDegradedMode() // "création de réservations" bloquée en mode dégradé (§9.10)
  @ApiOperation({
    summary: 'Réserver un cours collectif — bascule en liste d\'attente si complet (§7.4)',
  })
  bookCoursCollectif(
    @Param('coursId') coursId: string,
    @Body() dto: BookCoursCollectifDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.bookingsService.bookCoursCollectif(coursId, dto.adherentId, user.userId);
  }

  @Post('salle/:salleId/seance-individuelle')
  @RequirePermission('create', 'Booking')
  @RestrictedInDegradedMode()
  @ApiOperation({
    summary: 'Réserver une séance individuelle avec un coach (§7.6, §7.7)',
  })
  bookSeance(
    @Param('salleId') salleId: string,
    @Body() dto: BookSeanceIndividuelleDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.bookingsService.bookSeanceIndividuelle(salleId, dto, user.userId, user.roleCode === 'ADHERENT');
  }

  @Patch(':id/approve-seance')
  @RequirePermission('update', 'Booking')
  @ApiOperation({ summary: 'Le coach valide une séance individuelle demandée par un adhérent (§7.7)' })
  approveSeance(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    return this.bookingsService.approveSeance(id, { userId: user.userId, isGlobalAccess: user.isGlobalAccess });
  }

  @Patch(':id/reject-seance')
  @RequirePermission('update', 'Booking')
  @ApiOperation({ summary: 'Le coach refuse une séance individuelle demandée par un adhérent (§7.7)' })
  rejectSeance(
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: TenantContext,
  ) {
    return this.bookingsService.rejectSeance(id, { userId: user.userId, isGlobalAccess: user.isGlobalAccess }, reason);
  }

  @Post(':id/pay-seance')
  @RequirePermission('create', 'Payment')
  @ApiOperation({ summary: 'L\'adhérent paie une séance individuelle déjà validée par le coach (§7.7)' })
  paySeance(@Param('id') id: string, @Body() dto: PaySeanceDto, @CurrentUser() user: TenantContext) {
    return this.bookingsService.paySeance(id, dto, user.userId);
  }

  @Patch(':id/cancel')
  @RequirePermission('manage', 'Booking')
  @ApiOperation({
    summary: 'Annuler une réservation — promotion automatique de la liste d\'attente (§7.5)',
  })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.bookingsService.cancelBooking(id, user.userId, dto.reason);
  }

  @Patch(':id/attendance')
  @RequirePermission('manage', 'Booking')
  @ApiOperation({ summary: 'Pointer la présence à la séance (§7.12)' })
  markAttendance(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    return this.bookingsService.markAttendance(id, user.userId);
  }

  @Patch(':id/absence')
  @RequirePermission('manage', 'Booking')
  @ApiOperation({ summary: 'Marquer une absence' })
  markAbsence(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    return this.bookingsService.markAbsence(id, user.userId);
  }

  @Get('adherent/:adherentId')
  @RequirePermission('read', 'Booking')
  @ApiOperation({ summary: 'Réservations d\'un adhérent (§7.10)' })
  byAdherent(@Param('adherentId') adherentId: string) {
    return this.bookingsService.listByAdherent(adherentId);
  }

  @Get('coach/:coachId')
  @RequirePermission('read', 'Booking')
  @ApiOperation({ summary: 'Planning d\'un coach (§7.11)' })
  byCoach(
    @Param('coachId') coachId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.bookingsService.listByCoach(
      coachId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
