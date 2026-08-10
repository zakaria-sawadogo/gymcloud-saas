import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApiCredentialsService } from './api-credentials.service';
import { SetSalleCredentialDto } from './dto/api-credentials.dto';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

@ApiTags('Identifiants marchand (Mobile Money)')
@ApiBearerAuth()
@Controller('salles/:salleId/api-credentials')
export class ApiCredentialsController {
  constructor(private readonly apiCredentialsService: ApiCredentialsService) {}

  @Post()
  @ApiOperation({
    summary:
      "Enregistrer/remplacer les identifiants marchand d'un opérateur pour cette salle (§14.x) — propriétaire de la salle ou SUPER_ADMIN uniquement",
  })
  setCredential(
    @Param('salleId') salleId: string,
    @Body() dto: SetSalleCredentialDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.apiCredentialsService.setSalleCredential(salleId, dto, user);
  }

  @Get('status')
  @ApiOperation({ summary: 'Statut de configuration (jamais le secret) — pour afficher "configuré" ou non côté web' })
  getStatus(
    @Param('salleId') salleId: string,
    @Query('provider') provider: string,
    @CurrentUser() user: TenantContext,
  ) {
    return this.apiCredentialsService.getSalleCredentialStatus(salleId, provider, user);
  }

  @Delete()
  @ApiOperation({ summary: "Révoquer l'identifiant actif d'un opérateur pour cette salle" })
  revoke(
    @Param('salleId') salleId: string,
    @Query('provider') provider: string,
    @CurrentUser() user: TenantContext,
  ) {
    return this.apiCredentialsService.revokeSalleCredential(salleId, provider, user);
  }
}
