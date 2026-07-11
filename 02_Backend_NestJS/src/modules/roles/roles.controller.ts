import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermission } from '../../common/casl/policies.guard';

/**
 * §2.2 — Consultation des rôles (système + internes GymCloud).
 * Nécessaire pour peupler le sélecteur de rôle lors de la création
 * d'un compte de personnel interne (voir UsersService.createInternalUser).
 */
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope?: 'SYSTEM' | 'INTERNAL') {
    return this.prisma.role.findMany({
      where: scope ? { scope } : undefined,
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }
}

@ApiTags('Rôles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission('manage', 'Role')
  @ApiOperation({ summary: 'Liste des rôles, filtrable par portée (SYSTEM ou INTERNAL — §2.2)' })
  list(@Query('scope') scope?: 'SYSTEM' | 'INTERNAL') {
    return this.rolesService.list(scope);
  }
}
