import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SallesService } from './salles.service';
import { CreateSalleDto, UpdateSalleBrandingDto, UpdateSalleSettingsDto } from './dto/salle.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CheckQuota } from '../../common/guards/quota.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

@ApiTags('Salles')
@ApiBearerAuth()
@Controller('salles')
export class SallesController {
  constructor(private readonly sallesService: SallesService) {}

  @Post()
  @RequirePermission('create', 'Salle') // exclusif SUPER_ADMIN (§3.2)
  @CheckQuota('salles') // no-op bloquant : autorisé mais facturé si dépassement
  @ApiOperation({ summary: 'Créer une salle — exclusivement réservé au SUPER_ADMIN (§3.2)' })
  create(@Body() dto: CreateSalleDto, @CurrentUser() user: TenantContext) {
    return this.sallesService.create(dto, user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une salle' })
  findOne(@Param('id') id: string) {
    return this.sallesService.findById(id);
  }

  @Get()
  @ApiOperation({
    summary:
      'Liste des salles — vue globale pour SUPER_ADMIN, vue consolidée pour PROPRIETAIRE (§2.3)',
  })
  async findAll(@CurrentUser() user: TenantContext) {
    if (user.isGlobalAccess) {
      return this.sallesService.findAll();
    }
    if (!user.proprietaireId) {
      return []; // GESTIONNAIRE/COACH/ADHERENT n'ont pas de vue "toutes les salles"
    }
    return this.sallesService.findByProprietaire(user.proprietaireId);
  }

  @Patch(':id/branding')
  @RequirePermission('update', 'Salle')
  @ApiOperation({ summary: 'Personnalisation de l\'identité visuelle — SUPER_ADMIN ou le PROPRIETAIRE de cette salle (§3.4)' })
  updateBranding(
    @Param('id') id: string,
    @Body() dto: UpdateSalleBrandingDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.sallesService.updateBranding(id, dto, user);
  }

  @Patch(':id/settings')
  @RequirePermission('update', 'Salle')
  @ApiOperation({ summary: 'Paramètres opérationnels — SUPER_ADMIN ou le PROPRIETAIRE de cette salle (§3.5 à §3.9)' })
  updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateSalleSettingsDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.sallesService.updateSettings(id, dto, user);
  }

  @Patch(':id/suspend')
  @RequirePermission('manage', 'Salle')
  @ApiOperation({ summary: 'Suspendre une salle (§3.3)' })
  suspend(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: TenantContext,
  ) {
    return this.sallesService.suspend(id, user.userId, reason);
  }

  @Patch(':id/reactivate')
  @RequirePermission('manage', 'Salle')
  @ApiOperation({ summary: 'Réactiver une salle (§3.3)' })
  reactivate(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    return this.sallesService.reactivate(id, user.userId);
  }

  @Get(':id/checkin-qr')
  @RequirePermission('read', 'Salle')
  @ApiOperation({
    summary:
      'QR code fixe de la salle, à afficher/imprimer à l\'entrée — les adhérents le scannent avec leur propre téléphone pour pointer eux-mêmes (§6.14)',
  })
  getCheckinQr(@Param('id') id: string) {
    return this.sallesService.getCheckinQrCode(id);
  }
}
