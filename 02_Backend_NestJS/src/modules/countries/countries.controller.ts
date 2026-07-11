import { Controller, Get, Injectable } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Module minimal exposant la liste des pays actifs (§14.4).
 *
 * Nécessaire pour les formulaires (création de salle, tarification
 * SaaS par pays) — jusqu'ici seul le seed peuplait `Country`, sans
 * aucun moyen de le consulter depuis le frontend.
 */
@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.country.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }
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
}
