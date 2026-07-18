import { Body, Controller, Get, Param, Post, Patch } from '@nestjs/common';
import { IsOptional, IsNumber, IsString, Min } from 'class-validator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiPropertyOptional } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateCoachDto } from './dto/users.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CheckQuota } from '../../common/guards/quota.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

class UpdateCoachPricingDto {
  @ApiPropertyOptional({ description: 'Tarif par séance individuelle — null pour retirer' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerSession?: number;

  @ApiPropertyOptional({ description: 'Tarif du forfait mensuel illimité — null pour retirer' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMonthly?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;
}

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

  @Patch(':id/pricing')
  @RequirePermission('manage', 'User')
  @ApiOperation({
    summary:
      'Configurer la tarification des séances individuelles (§7.7) — laisser vide = séances incluses dans l\'abonnement standard',
  })
  updatePricing(@Param('id') id: string, @Body() dto: UpdateCoachPricingDto) {
    return this.usersService.updateCoachPricing(id, dto);
  }

  @Patch(':userId/suspend')
  @RequirePermission('manage', 'User')
  @ApiOperation({ summary: 'Suspendre un compte coach — GESTIONNAIRE (sa salle) ou PROPRIETAIRE (ses salles) (§4.2, §4.5)' })
  suspend(@Param('userId') userId: string, @CurrentUser() user: TenantContext) {
    return this.usersService.suspendCoach(userId, user);
  }

  @Patch(':userId/reactivate')
  @RequirePermission('manage', 'User')
  @ApiOperation({ summary: 'Réactiver un coach' })
  reactivate(@Param('userId') userId: string, @CurrentUser() user: TenantContext) {
    return this.usersService.reactivateCoach(userId, user);
  }

  @Patch(':userId/deactivate')
  @RequirePermission('manage', 'User')
  @ApiOperation({ summary: 'Désactiver (« supprimer ») un coach — historique conservé' })
  deactivate(@Param('userId') userId: string, @CurrentUser() user: TenantContext) {
    return this.usersService.deactivateCoach(userId, user);
  }
}
