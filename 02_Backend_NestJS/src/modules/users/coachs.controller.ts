import { Body, Controller, Get, Param, Post, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateCoachDto } from './dto/users.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CheckQuota } from '../../common/guards/quota.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

@ApiTags('Utilisateurs — Coachs')
@ApiBearerAuth()
@Controller('coachs')
export class CoachsController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermission('create', 'User')
  @CheckQuota('coachs') // vérifie le quota du plan SaaS (§13.20)
  @ApiOperation({
    summary: 'Créer un coach — SUPER_ADMIN, PROPRIETAIRE ou GESTIONNAIRE (§4.5, §2.8)',
  })
  create(@Body() dto: CreateCoachDto, @CurrentUser() user: TenantContext) {
    return this.usersService.createCoach(dto, user);
  }

  @Get('salle/:salleId')
  @RequirePermission('read', 'User')
  @ApiOperation({ summary: 'Liste des coachs d\'une salle' })
  findBySalle(@Param('salleId') salleId: string) {
    return this.usersService.findCoachsBySalle(salleId);
  }

  @Patch(':userId/suspend')
  @RequirePermission('manage', 'User')
  @ApiOperation({ summary: 'Suspendre un compte utilisateur (§4.2)' })
  suspend(@Param('userId') userId: string, @CurrentUser() user: TenantContext) {
    return this.usersService.suspendUser(userId, user.userId);
  }
}
