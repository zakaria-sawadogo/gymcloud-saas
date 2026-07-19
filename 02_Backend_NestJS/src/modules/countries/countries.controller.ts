import { Body, Controller, Get, Post, Patch, Param, Injectable } from '@nestjs/common';
import { IsString, IsBoolean, IsOptional, Length } from 'class-validator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermission } from '../../common/casl/policies.guard';

/**
 * Module exposant la liste des pays actifs (§14.4), et depuis le
 * 18/07/2026, leur gestion complète par le SUPER_ADMIN — jusqu'ici
 * seul le seed pouvait ajouter un pays (Burkina Faso en dur), aucun
 * moyen de couvrir un nouveau marché sans redéployer le code.
 */
@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.country.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }

  /** Liste complète y compris les pays désactivés — usage SUPER_ADMIN uniquement (page de gestion). */
  listAll() {
    return this.prisma.country.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: { code: string; name: string; currency: string; timezone: string }) {
    return this.prisma.country.create({
      data: { code: dto.code.toUpperCase(), name: dto.name, currency: dto.currency.toUpperCase(), timezone: dto.timezone },
    });
  }

  update(
    id: string,
    dto: { name?: string; currency?: string; timezone?: string; active?: boolean },
  ) {
    return this.prisma.country.update({
      where: { id },
      data: {
        name: dto.name,
        currency: dto.currency?.toUpperCase(),
        timezone: dto.timezone,
        active: dto.active,
      },
    });
  }
}

export class CreateCountryDto {
  @ApiProperty({ description: 'Code ISO 3166-1 alpha-2, ex: "SN"' })
  @IsString()
  @Length(2, 2)
  code!: string;

  @ApiProperty({ example: 'Sénégal' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Code devise ISO 4217, ex: "XOF"', example: 'XOF' })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ description: 'Fuseau horaire IANA, ex: "Africa/Dakar"', example: 'Africa/Dakar' })
  @IsString()
  timezone!: string;
}

export class UpdateCountryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Désactiver un pays le retire des listes de sélection, sans supprimer son historique' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@ApiTags('Pays')
@ApiBearerAuth()
@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des pays actifs — lecture ouverte à tout utilisateur authentifié' })
  list() {
    return this.countriesService.list();
  }

  @Get('all')
  @RequirePermission('manage', 'Country')
  @ApiOperation({ summary: 'Liste complète des pays (y compris désactivés) — SUPER_ADMIN, page de gestion' })
  listAll() {
    return this.countriesService.listAll();
  }

  @Post()
  @RequirePermission('manage', 'Country')
  @ApiOperation({ summary: 'Ajouter un nouveau pays — SUPER_ADMIN uniquement (§14.4)' })
  create(@Body() dto: CreateCountryDto) {
    return this.countriesService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('manage', 'Country')
  @ApiOperation({ summary: 'Modifier un pays (nom, devise, fuseau, actif/inactif) — SUPER_ADMIN uniquement' })
  update(@Param('id') id: string, @Body() dto: UpdateCountryDto) {
    return this.countriesService.update(id, dto);
  }
}
