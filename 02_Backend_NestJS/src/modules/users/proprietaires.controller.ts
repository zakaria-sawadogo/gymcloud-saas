import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateProprietaireDto } from './dto/users.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

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
}
