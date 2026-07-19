import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PublicService } from './public.service';
import { RegisterProspectDto, RequestTrialSessionDto } from './dto/public.dto';

/**
 * §3.2 — Site public par salle (fitnessclub.gymcloud.africa,
 * gymfit.gymcloud.africa...). Aucune authentification, aucune donnée
 * d'administration : uniquement présentation, activités, et captation
 * de prospects. Toutes les opérations d'administration restent sur
 * app.gymcloud.africa — jamais accessibles depuis ces routes.
 *
 * Débit volontairement restreint (5 soumissions/minute/IP) sur les
 * deux écritures possibles, en plus du throttling global (§13.3) —
 * ce sont les seuls endpoints non authentifiés qui écrivent en base.
 */
@ApiTags('Site public par salle')
@Controller('public/salles')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get(':subdomain')
  @ApiOperation({ summary: 'Informations publiques d\'une salle par son sous-domaine (§3.2)' })
  getSalle(@Param('subdomain') subdomain: string) {
    return this.publicService.getSalleBySubdomain(subdomain);
  }

  @Get(':subdomain/catalogue')
  @ApiOperation({ summary: 'Formules d\'abonnement publiques (tarifs affichables)' })
  getCatalogue(@Param('subdomain') subdomain: string) {
    return this.publicService.getPublicCatalogue(subdomain);
  }

  @Get(':subdomain/cours-collectifs')
  @ApiOperation({ summary: 'Activités / cours collectifs à venir' })
  getCoursCollectifs(@Param('subdomain') subdomain: string) {
    return this.publicService.getUpcomingCoursCollectifs(subdomain);
  }

  @Get(':subdomain/gallery')
  @ApiOperation({ summary: 'Galerie photo publique (§3.4)' })
  getGallery(@Param('subdomain') subdomain: string) {
    return this.publicService.getGallery(subdomain);
  }

  @Get(':subdomain/posts')
  @ApiOperation({ summary: 'Publications promotionnelles publiées (§3.4)' })
  getPosts(@Param('subdomain') subdomain: string) {
    return this.publicService.getPosts(subdomain);
  }

  @Post(':subdomain/prospects')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Inscription en ligne (§3.2) — crée un prospect léger, jamais un compte adhérent. Le gestionnaire rappelle et convertit lui-même.',
  })
  registerProspect(@Param('subdomain') subdomain: string, @Body() dto: RegisterProspectDto) {
    return this.publicService.registerProspect(subdomain, dto);
  }

  @Post(':subdomain/essai-gratuit')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Demande de séance d\'essai gratuite (§3.2) — crée un prospect, jamais une vraie réservation.',
  })
  requestTrialSession(@Param('subdomain') subdomain: string, @Body() dto: RequestTrialSessionDto) {
    return this.publicService.requestTrialSession(subdomain, dto);
  }
}
