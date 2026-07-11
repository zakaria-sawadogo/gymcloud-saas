import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccessControlService } from './access-control.service';
import { ScanQrDto, ManualAccessDto } from './dto/access-control.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

@ApiTags('Contrôle d\'accès')
@ApiBearerAuth()
@Controller('access-control')
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Post('scan')
  @RequirePermission('manage', 'AccessLog')
  @ApiOperation({
    summary:
      'Scan de borne — ouvre une session à l\'entrée, la ferme à la sortie (§6.3, §6.4)',
  })
  scan(@Body() dto: ScanQrDto) {
    return this.accessControlService.scan(dto.qrCodeToken, dto.salleId);
  }

  @Post('manual')
  @RequirePermission('manage', 'AccessLog')
  @ApiOperation({ summary: 'Accès manuel par un gestionnaire (§6.6)' })
  manual(@Body() dto: ManualAccessDto, @CurrentUser() user: TenantContext) {
    return this.accessControlService.manualAccess(
      dto.adherentId,
      dto.salleId,
      user.userId,
      dto.reason,
    );
  }

  @Get('salle/:salleId/current')
  @RequirePermission('read', 'AccessLog')
  @ApiOperation({ summary: 'Adhérents actuellement présents dans la salle (§6.9)' })
  currentOccupancy(@Param('salleId') salleId: string) {
    return this.accessControlService.currentOccupancy(salleId);
  }

  @Get('salle/:salleId/history')
  @RequirePermission('read', 'AccessLog')
  @ApiOperation({ summary: 'Historique des passages sur une période (§6.10)' })
  history(
    @Param('salleId') salleId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.accessControlService.history(
      salleId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('salle/:salleId/anomalies')
  @RequirePermission('read', 'AccessLog')
  @ApiOperation({ summary: 'Sessions fermées automatiquement à investiguer (§6.13)' })
  anomalies(@Param('salleId') salleId: string) {
    return this.accessControlService.listAnomalies(salleId);
  }

  @Get('adherent/:adherentId/history')
  @RequirePermission('read', 'AccessLog')
  @ApiOperation({ summary: 'Historique de fréquentation d\'un adhérent (§6.11)' })
  adherentHistory(@Param('adherentId') adherentId: string) {
    return this.accessControlService.adherentHistory(adherentId);
  }
}
