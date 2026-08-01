import { Body, Controller, Get, Param, Patch, Post, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SallesService } from './salles.service';
import { CreateSalleDto, CreateOwnSalleDto, RejectSalleRequestDto, UpdateSalleBrandingDto, UpdateSalleSettingsDto } from './dto/salle.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
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

  @Post('requests')
  @RequirePermission('read', 'Salle') // PROPRIETAIRE seul — proprietaireId dérivé du contexte, jamais du corps de la requête
  @ApiOperation({
    summary:
      "Le propriétaire DEMANDE une salle supplémentaire (§3.2, §14.x) — jamais créée directement : facture générée (0 si dans le quota, sinon le tarif salle supplémentaire), la salle n'existe qu'après validation SUPER_ADMIN.",
  })
  requestAdditional(@Body() dto: CreateOwnSalleDto, @CurrentUser() user: TenantContext) {
    if (!user.proprietaireId) {
      throw new ForbiddenException('Réservé aux comptes propriétaire');
    }
    return this.sallesService.requestAdditionalSalle(user.proprietaireId, dto, user.userId);
  }

  @Get('requests/mine')
  @RequirePermission('read', 'Salle')
  @ApiOperation({ summary: 'Mes demandes de salle supplémentaire (§14.x)' })
  myRequests(@CurrentUser() user: TenantContext) {
    if (!user.proprietaireId) {
      throw new ForbiddenException('Réservé aux comptes propriétaire');
    }
    return this.sallesService.listMySalleRequests(user.proprietaireId);
  }

  @Get('requests/pending')
  @RequirePermission('manage', 'Salle') // réservé SUPER_ADMIN
  @ApiOperation({ summary: 'Demandes de salle en attente de validation — SUPER_ADMIN (§14.x)' })
  pendingRequests() {
    return this.sallesService.listPendingSalleRequests();
  }

  @Patch('requests/:requestId/reject')
  @RequirePermission('manage', 'Salle') // réservé SUPER_ADMIN
  @ApiOperation({ summary: 'Rejeter une demande de salle supplémentaire — SUPER_ADMIN' })
  rejectRequest(
    @Param('requestId') requestId: string,
    @Body() dto: RejectSalleRequestDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.sallesService.rejectSalleRequest(requestId, dto.note, user.userId);
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
  @RequireModule('site_public')
  @ApiOperation({ summary: 'Personnalisation de l\'identité visuelle — SUPER_ADMIN ou le PROPRIETAIRE de cette salle (§3.4, §9.3 module site_public)' })
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

  @Get(':id/app-access')
  @ApiOperation({
    summary:
      'Cette salle a-t-elle l\'add-on "Application mobile" actif ? — vérifié au lancement de l\'app mobile (§9.3). Accessible à tout compte authentifié de la salle (gestionnaire, coach, adhérent) : aucune permission "read Salle" requise, donnée peu sensible (un simple booléen).',
  })
  async getAppAccess(@Param('id') id: string) {
    return { hasAccess: await this.sallesService.hasApplicationAccess(id) };
  }
}
