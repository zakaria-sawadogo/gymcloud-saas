import { Body, Controller, Get, Post, Patch, Param } from '@nestjs/common';
import { IsString, IsEmail, IsOptional, IsUUID } from 'class-validator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

export class CreateInternalUserDto {
  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'ID d\'un rôle à portée INTERNAL (voir GET /roles?scope=INTERNAL)' })
  @IsUUID()
  roleId!: string;

  @ApiPropertyOptional({ description: 'Pays de rattachement — pertinent pour un rôle SUPERVISEUR_PAYS' })
  @IsOptional()
  @IsUUID()
  countryId?: string;
}

export class UpdateInternalUserRoleDto {
  @ApiProperty({ description: 'ID du nouveau rôle à portée INTERNAL' })
  @IsUUID()
  roleId!: string;
}

/**
 * §2.2 — Personnel interne GymCloud (Support, Finance, Commercial,
 * Marketing, Superviseur Pays...), distinct des comptes clients
 * (Propriétaire, Gestionnaire, Coach, Adhérent). Exclusivement géré
 * par le SUPER_ADMIN.
 */
@ApiTags('Personnel interne GymCloud')
@ApiBearerAuth()
@Controller('internal-users')
export class InternalUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermission('manage', 'Role')
  @ApiOperation({ summary: 'Créer un compte de personnel interne (§2.2)' })
  create(@Body() dto: CreateInternalUserDto, @CurrentUser() user: TenantContext) {
    return this.usersService.createInternalUser(dto, user);
  }

  @Get()
  @RequirePermission('manage', 'Role')
  @ApiOperation({ summary: 'Liste du personnel interne GymCloud' })
  list() {
    return this.usersService.listInternalUsers();
  }

  @Patch(':userId/role')
  @RequirePermission('manage', 'Role')
  @ApiOperation({ summary: 'Changer le rôle d\'un membre du personnel interne — SUPER_ADMIN uniquement (§2.2)' })
  updateRole(
    @Param('userId') userId: string,
    @Body() dto: UpdateInternalUserRoleDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.usersService.updateInternalUserRole(userId, dto.roleId, user);
  }
}
