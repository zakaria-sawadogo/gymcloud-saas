import { Body, Controller, Get, Param, Post, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateGestionnaireDto } from './dto/users.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CheckQuota } from '../../common/guards/quota.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

@ApiTags('Utilisateurs — Gestionnaires')
@ApiBearerAuth()
@Controller('gestionnaires')
export class GestionnairesController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermission('create', 'User')
  @CheckQuota('gestionnaires') // vérifie le quota du plan SaaS (§13.20)
  @ApiOperation({ summary: 'Créer un gestionnaire — SUPER_ADMIN ou PROPRIETAIRE (§4.4, §2.8)' })
  create(@Body() dto: CreateGestionnaireDto, @CurrentUser() user: TenantContext) {
    return this.usersService.createGestionnaire(dto, user);
  }

  @Get('salle/:salleId')
  @RequirePermission('read', 'User')
  @ApiOperation({ summary: 'Liste des gestionnaires d\'une salle' })
  findBySalle(@Param('salleId') salleId: string) {
    return this.usersService.findGestionnairesBySalle(salleId);
  }

  @Patch(':userId/suspend')
  @RequirePermission('manage', 'User')
  @ApiOperation({ summary: 'Suspendre un gestionnaire — PROPRIETAIRE, sur l\'une de ses salles uniquement (§4.2, §4.4)' })
  suspend(@Param('userId') userId: string, @CurrentUser() user: TenantContext) {
    return this.usersService.suspendGestionnaire(userId, user);
  }

  @Patch(':userId/reactivate')
  @RequirePermission('manage', 'User')
  @ApiOperation({ summary: 'Réactiver un gestionnaire' })
  reactivate(@Param('userId') userId: string, @CurrentUser() user: TenantContext) {
    return this.usersService.reactivateGestionnaire(userId, user);
  }

  @Patch(':userId/deactivate')
  @RequirePermission('manage', 'User')
  @ApiOperation({ summary: 'Désactiver (« supprimer ») un gestionnaire — historique conservé' })
  deactivate(@Param('userId') userId: string, @CurrentUser() user: TenantContext) {
    return this.usersService.deactivateGestionnaire(userId, user);
  }
}
