import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateCoursCollectifDto, UpdateCoursCollectifDto } from './dto/bookings.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('Réservations — Cours collectifs')
@ApiBearerAuth()
@RequireModule('reservations')
@Controller('salles/:salleId/cours-collectifs')
export class CoursCollectifsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @RequirePermission('create', 'Booking')
  @ApiOperation({ summary: 'Planifier un cours collectif — gestionnaire, ou coach pour lui-même (§7.1)' })
  create(
    @Param('salleId') salleId: string,
    @Body() dto: CreateCoursCollectifDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.bookingsService.createCoursCollectif(salleId, dto, { userId: user.userId, roleCode: user.roleCode });
  }

  @Get()
  @ApiOperation({ summary: 'Planning des cours collectifs, avec places restantes (§7.2)' })
  list(
    @Param('salleId') salleId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.bookingsService.listCoursCollectifs(
      salleId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Patch(':coursId')
  @RequirePermission('update', 'Booking')
  @ApiOperation({ summary: 'Modifier un cours collectif — gestionnaire, ou coach pour ses propres cours' })
  update(
    @Param('coursId') coursId: string,
    @Body() dto: UpdateCoursCollectifDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.bookingsService.updateCoursCollectif(coursId, dto, { userId: user.userId, roleCode: user.roleCode });
  }
}
