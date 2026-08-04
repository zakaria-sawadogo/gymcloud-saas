import { Controller, Get, Post, Query, Body, Res, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';

/**
 * §14.x — Point d'entrée des webhooks WhatsApp (Meta Cloud API).
 * Route sous /public/ pour bénéficier de l'exemption d'authentification
 * déjà en place pour le reste du site public (voir tenant.middleware.ts,
 * PUBLIC_PATH_PREFIXES) — Meta appelle cette route depuis l'extérieur,
 * sans jeton GymCloud, donc jamais derrière l'authentification interne.
 *
 * Deux responsabilités distinctes exigées par Meta :
 *  - GET  : poignée de main de vérification, une seule fois à la
 *    configuration (Meta envoie un "challenge" à renvoyer tel quel si
 *    le jeton de vérification correspond).
 *  - POST : réception réelle des événements (messages entrants, accusés
 *    de lecture/livraison). Pour l'instant, se contente de journaliser
 *    et d'accuser réception (200 OK) — Meta exige une réponse rapide,
 *    sinous désactive le webhook après des échecs répétés. Le
 *    traitement métier des messages entrants (répondre à un adhérent,
 *    etc.) est un chantier séparé, non couvert ici.
 */
@ApiTags('whatsapp')
@Controller('public/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);
  private readonly verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  @Get('webhook')
  @ApiExcludeEndpoint() // appelé exclusivement par Meta, pas un endpoint destiné à un client de l'app
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && this.verifyToken && token === this.verifyToken) {
      this.logger.log('Vérification du webhook WhatsApp réussie');
      return res.status(HttpStatus.OK).send(challenge);
    }
    this.logger.warn('Échec de vérification du webhook WhatsApp — jeton invalide ou non configuré');
    return res.sendStatus(HttpStatus.FORBIDDEN);
  }

  @Post('webhook')
  @ApiExcludeEndpoint()
  receive(@Body() body: unknown, @Res() res: Response) {
    // Accusé de réception immédiat exigé par Meta — le traitement
    // métier des messages entrants n'est pas encore implémenté.
    this.logger.log(`Webhook WhatsApp reçu: ${JSON.stringify(body).slice(0, 500)}`);
    return res.sendStatus(HttpStatus.OK);
  }
}
