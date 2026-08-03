import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { UsersService } from './users.service';
import { CreateProprietaireDto } from './dto/users.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

export class SendEmailDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  body!: string;
}

export class UpdateProprietaireDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false, description: 'Requis pour que la taxe par pays soit correctement appliquée sur ses factures' })
  @IsOptional()
  @IsString()
  countryId?: string;
}

@ApiTags('Utilisateurs — Propriétaires')
@ApiBearerAuth()
@Controller('proprietaires')
export class ProprietairesController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermission('create', 'User')
  @ApiOperation({ summary: 'Créer un propriétaire — exclusif SUPER_ADMIN (§4.3, §2.8)' })
  create(@Body() dto: CreateProprietaireDto, @CurrentUser() user: TenantContext) {
    return this.usersService.createProprietaire(dto, user);
  }

  @Get()
  @RequirePermission('read', 'User')
  @ApiOperation({ summary: 'Liste des propriétaires (§9.4)' })
  list() {
    return this.usersService.listProprietaires();
  }

  @Patch(':id/suspend')
  @RequirePermission('manage', 'User')
  @ApiOperation({ summary: 'Suspendre un propriétaire (§9.4) — révoque aussi ses sessions actives' })
  async suspend(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    const proprietaire = await this.usersService.findProprietaireById(id);
    return this.usersService.suspendUser(proprietaire.userId, user.userId);
  }

  @Patch(':id/reactivate')
  @RequirePermission('manage', 'User')
  @ApiOperation({ summary: 'Réactiver un propriétaire suspendu (§9.4)' })
  async reactivate(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    const proprietaire = await this.usersService.findProprietaireById(id);
    return this.usersService.reactivateUser(proprietaire.userId, user.userId);
  }

  @Post(':id/send-email')
  @RequirePermission('manage', 'User')
  @ApiOperation({ summary: 'Envoyer un e-mail ponctuel à ce propriétaire — réservé SUPER_ADMIN (§14.x)' })
  sendEmail(@Param('id') id: string, @Body() dto: SendEmailDto) {
    return this.usersService.sendEmailToProprietaire(id, dto.subject, dto.body);
  }

  @Patch(':id')
  @RequirePermission('manage', 'User')
  @ApiOperation({ summary: 'Modifier les infos d\'un propriétaire (dont le pays, requis pour la taxe) (§14.x)' })
  update(@Param('id') id: string, @Body() dto: UpdateProprietaireDto) {
    return this.usersService.updateProprietaire(id, dto);
  }

  @Delete(':id')
  @RequirePermission('manage', 'User')
  @ApiOperation({
    summary:
      'Supprime définitivement un propriétaire et tout ce qui lui appartient (salles, adhérents, paiements, personnel...) — irréversible, réservé SUPER_ADMIN (§9.4).',
  })
  remove(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    return this.usersService.deleteProprietaire(id, user.userId);
  }
}
