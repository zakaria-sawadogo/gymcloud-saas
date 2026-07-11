import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdherentsService } from './adherents.service';
import { CreateAbonnementCatalogueDto, UpdateAbonnementCatalogueDto } from './dto/adherents.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

/**
 * §3.8, §5.6 — Chaque salle définit librement son propre catalogue
 * d'abonnements (aucun montant codé en dur, cohérent avec §9.3).
 */
@ApiTags('Adhérents — Catalogue d\'abonnements')
@ApiBearerAuth()
@Controller('salles/:salleId/abonnement-catalogue')
export class AbonnementCatalogueController {
  constructor(private readonly adherentsService: AdherentsService) {}

  @Post()
  @RequirePermission('manage', 'Adherent')
  @ApiOperation({ summary: 'Créer une formule d\'abonnement pour la salle' })
  create(
    @Param('salleId') salleId: string,
    @Body() dto: CreateAbonnementCatalogueDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.adherentsService.createAbonnementCatalogue(salleId, dto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des formules actives — consultable par tous les rôles de la salle' })
  list(@Param('salleId') salleId: string) {
    return this.adherentsService.listAbonnementCatalogue(salleId);
  }

  @Patch(':catalogueId')
  @RequirePermission('manage', 'Adherent')
  @ApiOperation({ summary: 'Modifier une formule (prix, description, activation)' })
  update(
    @Param('catalogueId') catalogueId: string,
    @Body() dto: UpdateAbonnementCatalogueDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.adherentsService.updateAbonnementCatalogue(catalogueId, dto, user.userId);
  }
}
