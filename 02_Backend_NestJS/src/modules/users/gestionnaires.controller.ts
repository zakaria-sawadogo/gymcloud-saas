import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
}
